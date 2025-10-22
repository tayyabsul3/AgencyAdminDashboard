const cors = require('cors')({ origin: true });
const fetch = require('node-fetch');
const { FieldValue } = require('firebase-admin/firestore');
const { getFirestore, getAuth } = require('../lib/firebase-admin');

// Get Firestore and Auth instances using centralized initialization
const db = getFirestore();
const auth = getAuth();

// Debug: Verify FieldValue is loaded
console.log('🔍 FieldValue loaded:', typeof FieldValue, typeof FieldValue?.serverTimestamp);

// HeyGen API Configuration
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_BASE_URL = 'https://api.heygen.com';

if (!HEYGEN_API_KEY) {
  console.warn('⚠️ HEYGEN_API_KEY not found in environment variables');
}

// Video generation configuration
const VIDEO_CONFIG = {
  defaultAvatar: 'Daisy-inskirt-20220818',
  defaultVoice: '1bd001e7e50f421d891986aad5158bc8',
  maxScriptLength: 1500, // HeyGen limit
  dimensions: {
    SD: { width: 1280, height: 720 },
    HD: { width: 1920, height: 1080 }
  },
  maxRetries: 3,
  retryDelay: 2000
};

// In-memory cache for listing endpoints (survives warm invocations)
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const MAX_RETURNED_VOICES = 300;
const inMemoryCache = {
  avatars: { data: null, fetchedAt: 0 },
  voices: { data: null, fetchedAt: 0 }
};

// Realistic background library - NO static colors, only real environments
const REALISTIC_BACKGROUNDS = {
  office: [
    { type: 'image', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80', name: 'Modern Office Space' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1920&q=80', name: 'Contemporary Workspace' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1920&q=80', name: 'Library Bookshelf' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1920&q=80', name: 'Team Workspace' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=1920&q=80', name: 'Clean Desk Setup' }
  ],
  
  home_studio: [
    { type: 'image', url: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1920&q=80', name: 'Home Office' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=1920&q=80', name: 'Cozy Home Studio' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1920&q=80', name: 'Minimalist Home Office' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=1920&q=80', name: 'Personal Workspace' }
  ],
  
  cityscape: [
    { type: 'image', url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&q=80', name: 'City Skyline' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&q=80', name: 'Urban Panorama' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1920&q=80', name: 'Downtown View' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&q=80', name: 'City Architecture' }
  ],
  
  modern_interior: [
    { type: 'image', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&q=80', name: 'Glass Building Interior' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1920&q=80', name: 'Modern Architecture' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1462826303086-329426d1aef5?w=1920&q=80', name: 'Bright Office Interior' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=1920&q=80', name: 'Contemporary Space' }
  ],
  
  conference: [
    { type: 'image', url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1920&q=80', name: 'Conference Room' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&q=80', name: 'Meeting Space' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1582653291997-079a1c04e5a1?w=1920&q=80', name: 'Boardroom' }
  ],
  
  tech_modern: [
    { type: 'image', url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80', name: 'Tech Background' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1920&q=80', name: 'Digital Workspace' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1920&q=80', name: 'Startup Office' }
  ]
};

// Track recently used backgrounds to ensure variety
const recentBackgrounds = [];
const MAX_RECENT_BACKGROUNDS = 8;

const isCacheValid = (entry) => {
  if (!entry || !Array.isArray(entry.data)) return false;
  return (Date.now() - entry.fetchedAt) < CACHE_TTL_MS;
};

const setCache = (key, data) => {
  inMemoryCache[key] = {
    data,
    fetchedAt: Date.now()
  };
};

const extractAvatarArray = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const data = payload.data || payload.result || {};
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.avatars)) return data.avatars;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.public_avatars)) return data.public_avatars;
  if (Array.isArray(data.avatar_list)) return data.avatar_list;
  if (Array.isArray(payload.avatars)) return payload.avatars;

  return [];
};

const normalizeAvatar = (avatar = {}) => {
  const avatarId = avatar.avatar_id || avatar.id;
  if (!avatarId) return null;

  const visibility = avatar.visibility || avatar.scope || avatar.access || avatar.avatar_scope;
  const hasExplicitPublicFlag = typeof avatar.is_public === 'boolean';
  const isPublic = hasExplicitPublicFlag
    ? avatar.is_public
    : visibility
      ? String(visibility).toLowerCase() === 'public'
      : true;

  const languages = Array.isArray(avatar.languages)
    ? avatar.languages
    : avatar.language
      ? [avatar.language]
      : [];

  return {
    avatar_id: avatarId,
    avatar_name: avatar.avatar_name || avatar.name || avatar.display_name || 'Unknown Avatar',
    gender: avatar.gender || avatar.avatar_gender || avatar.character_gender || null,
    languages,
    avatar_style: avatar.avatar_style || avatar.style || null,
    preview_image_url: avatar.preview_image_url || avatar.avatar_video_thumbnail || avatar.avatar_thumbnail_url || avatar.thumbnail_url || avatar.image_url || null,
    preview_video_url: avatar.preview_video_url || avatar.video_url || avatar.avatar_video_url || null,
    is_public: isPublic
  };
};

const filterAvatars = (avatars) => {
  const normalized = avatars.map(normalizeAvatar).filter(Boolean);
  if (!normalized.length) return normalized;

  const publicOnly = normalized.filter((avatar) => avatar.is_public !== false);
  return publicOnly.length ? publicOnly : normalized;
};

const fetchAvatarsFromApi = async () => {
  const endpoints = [
    `${HEYGEN_BASE_URL}/v2/avatars?per_page=200`,
    `${HEYGEN_BASE_URL}/v1/avatars`
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-Api-Key': HEYGEN_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ HeyGen avatars request failed (${endpoint}):`, errorText);
        continue;
      }

      const payload = await response.json();
      const rawAvatars = extractAvatarArray(payload);
      const filtered = filterAvatars(rawAvatars);

      if (filtered.length) {
        console.log(`✅ Retrieved ${filtered.length} avatars from ${endpoint.includes('/v2/') ? 'v2' : 'v1'} endpoint`);
        return filtered;
      }
    } catch (error) {
      console.warn(`⚠️ Unable to load avatars from ${endpoint}:`, error.message);
    }
  }

  return [];
};

const extractVoiceArray = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const data = payload.data || payload.result || {};
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.voices)) return data.voices;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(payload.voices)) return payload.voices;

  return [];
};

const normalizeVoice = (voice = {}) => {
  const voiceId = voice.voice_id || voice.id;
  if (!voiceId) return null;

  const languages = Array.isArray(voice.languages)
    ? voice.languages
    : voice.language
      ? [voice.language]
      : [];

  return {
    voice_id: voiceId,
    display_name: voice.display_name || voice.name || voice.voice_name || 'Unknown Voice',
    language: languages[0] || null,
    languages,
    gender: voice.gender || voice.voice_gender || null,
    style: voice.style || voice.voice_style || null,
    tone: voice.tone || null
  };
};

const normalizeVoices = (voices) => voices.map(normalizeVoice).filter(Boolean);

const dedupeById = (items, idKey) => {
  const seen = new Set();
  const cleaned = [];

  for (const item of items) {
    const key = item?.[idKey];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(item);
  }

  return cleaned;
};

const fetchVoicesFromApi = async () => {
  try {
    const response = await fetch(`${HEYGEN_BASE_URL}/v2/voices`, {
      method: 'GET',
      headers: {
        'X-Api-Key': HEYGEN_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen voices error ${response.status}: ${errorText}`);
    }

    const payload = await response.json();
    const voices = normalizeVoices(dedupeById(extractVoiceArray(payload), 'voice_id'));
    return voices.slice(0, MAX_RETURNED_VOICES);
  } catch (error) {
    console.error('❌ Failed to load voices from HeyGen:', error.message);
    throw error;
  }
};

// Get all backgrounds flattened with category info
const getAllRealisticBackgrounds = () => {
  const all = [];
  for (const [category, backgrounds] of Object.entries(REALISTIC_BACKGROUNDS)) {
    backgrounds.forEach(bg => {
      all.push({ ...bg, category });
    });
  }
  return all;
};

// Get random realistic background, avoiding recently used ones
const getRandomRealisticBackground = () => {
  const allBackgrounds = getAllRealisticBackgrounds();
  
  // Filter out recently used backgrounds for variety
  const available = allBackgrounds.filter(
    bg => !recentBackgrounds.includes(bg.url)
  );
  
  // If we've used all backgrounds, reset the recent list
  const pool = available.length > 0 ? available : allBackgrounds;
  
  // Pick random
  const selected = pool[Math.floor(Math.random() * pool.length)];
  
  // Track usage
  recentBackgrounds.push(selected.url);
  if (recentBackgrounds.length > MAX_RECENT_BACKGROUNDS) {
    recentBackgrounds.shift();
  }
  
  console.log(`🎨 Selected realistic background: "${selected.name}" (${selected.category})`);
  
  return {
    type: selected.type,
    url: selected.url,
    ...(selected.type === 'video' ? { play_style: 'loop' } : {})
  };
};

// Get backgrounds by category for manual selection
const getBackgroundsByCategory = (category) => {
  return REALISTIC_BACKGROUNDS[category] || [];
};

// Helper: Sleep utility for retries
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const clampNumber = (value, min, max) => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
};

const createNarrativeScript = (faqContent = {}) => {
  // Get the answer and clean it up
  const rawAnswer = (faqContent.answer_md || faqContent.answer || '')
    .replace(/[#*_`]/g, '') // Remove markdown symbols for better speech
    .replace(/\n+/g, '. ') // Convert newlines to pauses
    .replace(/\s+/g, ' ')
    .trim();

  // Get the takeaway if it exists
  const takeaway = (faqContent.takeaway || '')
    .replace(/[#*_`]/g, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!rawAnswer) {
    return 'Here is a quick insight worth remembering.';
  }

  // Just answer + takeaway, nothing else
  if (takeaway) {
    return `${rawAnswer}. Key takeaway: ${takeaway}`;
  }

  return rawAnswer;
};

// Helper: Call HeyGen API with retry logic
const callHeyGenWithRetry = async (url, options, maxRetries = VIDEO_CONFIG.maxRetries) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 HeyGen API attempt ${attempt}/${maxRetries}`);
      
      const response = await fetch(url, options);
      const responseText = await response.text();
      
      if (response.ok) {
        return { ok: true, status: response.status, data: JSON.parse(responseText) };
      }
      
      // Parse error
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        errorData = { message: responseText };
      }
      
      // Check if we should retry
      const shouldRetry = response.status === 429 || response.status >= 500;
      
      if (!shouldRetry || attempt === maxRetries) {
        return { ok: false, status: response.status, error: errorData };
      }
      
      // Exponential backoff
      const delay = VIDEO_CONFIG.retryDelay * attempt;
      console.log(`⏳ Rate limited or server error, retrying in ${delay}ms...`);
      await sleep(delay);
      
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) {
        throw error;
      }
      await sleep(VIDEO_CONFIG.retryDelay * attempt);
    }
  }
  
  throw lastError;
};

// Generate Video endpoint
const generateVideo = async (req, res) => {
  try {
    const { faqContent, faqId, articleId, source, keywordId, options = {} } = req.body;

    if (!faqContent || !faqId || !articleId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required fields: faqContent, faqId, articleId' }
      });
    }

    if (!faqContent.answer) {
      return res.status(400).json({
        success: false,
        error: { message: 'faqContent must include an answer' }
      });
    }

    if (!HEYGEN_API_KEY) {
      return res.status(500).json({
        success: false,
        error: { message: 'HeyGen API key not configured' }
      });
    }

    // Verify user authentication
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: 'No authorization token provided' }
      });
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (authError) {
      console.error('❌ [generateVideo] Token verification failed:', {
        error: authError.message,
        code: authError.code,
        tokenPreview: token?.substring(0, 30) + '...'
      });
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid authentication token' }
      });
    }

    const userId = decodedToken.uid;

    // Create script from FAQ answer + takeaway only
    const finalScript = createNarrativeScript(faqContent);
    
    // Limit script length for HeyGen API (use 1500 char limit)
    const maxLength = VIDEO_CONFIG.maxScriptLength;
    const trimmedScript = finalScript.length > maxLength
      ? `${finalScript.substring(0, maxLength).trim()}...`
      : finalScript;
    
    // Generate callback ID for tracking
    const callbackId = `${userId}_${articleId}_${faqId}_${Date.now()}`;

    console.log('🎬 Generating video for FAQ:', faqId);
    console.log('📝 Final script length:', trimmedScript.length);
    console.log('👤 User ID:', userId);
    console.log('📄 Article ID:', articleId);
    console.log('🔗 Callback ID:', callbackId);
    
    // Determine video quality
    const quality = options.quality || 'SD';
    const dimension = VIDEO_CONFIG.dimensions[quality] || VIDEO_CONFIG.dimensions.SD;

    // Determine background - use realistic backgrounds by default
    let background;
    if (options.backgroundUrl) {
      // Manual override with specific URL
      background = {
        type: 'image',
        url: options.backgroundUrl
      };
      console.log('🎨 Using custom background URL:', options.backgroundUrl);
    } else if (options.backgroundCategory) {
      // Manual selection from category
      const categoryBackgrounds = getBackgroundsByCategory(options.backgroundCategory);
      if (categoryBackgrounds.length > 0) {
        const randomFromCategory = categoryBackgrounds[Math.floor(Math.random() * categoryBackgrounds.length)];
        background = {
          type: randomFromCategory.type,
          url: randomFromCategory.url,
          ...(randomFromCategory.type === 'video' ? { play_style: 'loop' } : {})
        };
        console.log(`🎨 Using ${options.backgroundCategory} background: "${randomFromCategory.name}"`);
      } else {
        background = getRandomRealisticBackground();
      }
    } else {
      // Default: random realistic background (NO static colors!)
      background = getRandomRealisticBackground();
    }

    // Call HeyGen API to generate video with retry logic
    const payload = {
      callback_id: callbackId,
      caption: options.caption || false,
      title: faqContent.question || 'FAQ Video',
      video_inputs: [{
        character: {
          type: 'avatar',
          avatar_id: options.avatarId || VIDEO_CONFIG.defaultAvatar,
          avatar_style: options.avatarStyle || 'normal', // normal, closeUp
          scale: options.scale || 1.0,
          offset: options.offset || { x: 0, y: 0 }
        },
        voice: {
          type: 'text',
          input_text: trimmedScript,
          voice_id: options.voiceId || VIDEO_CONFIG.defaultVoice,
          speed: clampNumber(options.speed || 1.0, 0.5, 1.5),
          pitch: clampNumber(options.pitch || 0, -50, 50),
          emotion: options.emotion || 'Friendly'
        },
        background: background
      }],
      dimension: dimension,
      test: false
    };
    
    console.log('📤 Sending HeyGen request with payload:', JSON.stringify(payload, null, 2));
    
    const heygenResponse = await callHeyGenWithRetry(
      `${HEYGEN_BASE_URL}/v2/video/generate`,
      {
        method: 'POST',
        headers: {
          'X-Api-Key': HEYGEN_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    console.log('🔍 HeyGen Response Status:', heygenResponse.status);
    
    if (!heygenResponse.ok) {
      let errorMessage = 'HeyGen API request failed';
      const errorData = heygenResponse.error;
      
      if (errorData?.error) {
        errorMessage = `${errorData.error.message || errorData.error.code || 'Unknown error'}`;
        if (errorData.error.code) {
          errorMessage = `[${errorData.error.code}] ${errorMessage}`;
        }
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }
      
      console.error('🔍 HeyGen Error Details:', errorData);
      throw new Error(errorMessage);
    }

    const heygenResult = heygenResponse.data;

    // Save video metadata to Firestore
    try {
      const videoDocRef = db.collection('users').doc(userId)
        .collection('articles').doc(articleId)
        .collection('videos').doc(faqId);

      // Debug: Verify FieldValue before use
      console.log('🔍 About to use FieldValue.serverTimestamp:', {
        FieldValueType: typeof FieldValue,
        serverTimestampType: typeof FieldValue?.serverTimestamp,
        hasFunction: typeof FieldValue?.serverTimestamp === 'function'
      });

      const videoMetadata = {
        heygenVideoId: heygenResult.data?.video_id,
        callbackId: callbackId,
        status: 'processing',
        faqId: faqId,
        articleId: articleId,
        question: faqContent.question,
        answer: faqContent.answer,
        userId: userId,
        createdAt: FieldValue.serverTimestamp(),
        source: source || null,
        keywordId: keywordId || null,
        videoUrl: null,
        thumbnailUrl: null,
        gifUrl: null,
        duration: null,
        error: null,
        options: {
          avatarId: options.avatarId || VIDEO_CONFIG.defaultAvatar,
          voiceId: options.voiceId || VIDEO_CONFIG.defaultVoice,
          quality: quality,
          caption: options.caption || false,
          speed: options.speed || 1.0,
          emotion: options.emotion || 'Friendly'
        }
      };

      await videoDocRef.set(videoMetadata);

      console.log('✅ Video generation started and saved to Firestore:', {
        videoId: faqId,
        heygenVideoId: heygenResult.data?.video_id,
        path: `users/${userId}/articles/${articleId}/videos/${faqId}`
      });
    } catch (firestoreError) {
      console.error('⚠️ Failed to save video metadata to Firestore:', firestoreError);
      // Continue execution - video generation still succeeded on HeyGen side
    }

    res.json({
      success: true,
      data: {
        videoId: faqId,
        heygenVideoId: heygenResult.data?.video_id,
        status: 'processing',
        estimatedTime: '2-3 minutes'
      }
    });

  } catch (error) {
    console.error('❌ HeyGen API Error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Internal server error' }
    });
  }
};

// Update Video Status endpoint - Real HeyGen API integration
const updateVideoStatus = async (req, res) => {
  try {
    const { videoId, articleId } = req.body;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing videoId' }
      });
    }

    if (!articleId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing articleId' }
      });
    }

    // Verify user authentication
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: 'No authorization token provided' }
      });
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (authError) {
      console.error('❌ [updateVideoStatus] Token verification failed:', {
        error: authError.message,
        code: authError.code,
        tokenPreview: token?.substring(0, 30) + '...'
      });
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid authentication token' }
      });
    }

    const userId = decodedToken.uid;

    console.log('🔍 Status check requested for video:', videoId);

    // Fetch video metadata from Firestore
    const videoDocRef = db.collection('users').doc(userId)
      .collection('articles').doc(articleId)
      .collection('videos').doc(videoId);

    const videoDoc = await videoDocRef.get();

    if (!videoDoc.exists) {
      return res.status(404).json({
        success: false,
        error: { message: 'Video not found in database' }
      });
    }

    const videoData = videoDoc.data();
    const heygenVideoId = videoData.heygenVideoId;

    if (!heygenVideoId) {
      return res.status(500).json({
        success: false,
        error: { message: 'HeyGen video ID not found in database' }
      });
    }

    if (!HEYGEN_API_KEY) {
      return res.status(500).json({
        success: false,
        error: { message: 'HeyGen API key not configured' }
      });
    }

    console.log('📡 Checking HeyGen API status for video:', heygenVideoId);

    // Call HeyGen API to check video status - using correct v1 endpoint
    const heygenResponse = await fetch(
      `${HEYGEN_BASE_URL}/v1/video_status.get?video_id=${heygenVideoId}`,
      {
        method: 'GET',
        headers: {
          'X-Api-Key': HEYGEN_API_KEY
        }
      }
    );

    if (!heygenResponse.ok) {
      const errorText = await heygenResponse.text();
      console.error('❌ HeyGen status check failed:', errorText);
      throw new Error(`HeyGen API error: ${heygenResponse.status}`);
    }

    const statusResult = await heygenResponse.json();
    console.log('📊 HeyGen status response:', JSON.stringify(statusResult, null, 2));

    // Extract status and video data from HeyGen response
    const status = statusResult.data?.status || 'processing';
    const videoUrl = statusResult.data?.video_url || null;
    const thumbnailUrl = statusResult.data?.thumbnail_url || null;
    const duration = statusResult.data?.duration || null;
    const heygenError = statusResult.data?.error || null;

    // Update Firestore with latest status
    const updateData = {
      status: status,
      lastCheckedAt: FieldValue.serverTimestamp()
    };

    if (videoUrl) updateData.videoUrl = videoUrl;
    if (thumbnailUrl) updateData.thumbnailUrl = thumbnailUrl;
    if (duration) updateData.duration = duration;
    if (heygenError) updateData.error = heygenError;
    
    // Add gif_url if available
    const gifUrl = statusResult.data?.gif_url || null;
    if (gifUrl) updateData.gifUrl = gifUrl;

    await videoDocRef.update(updateData);

    console.log('✅ Video status updated in Firestore:', {
      videoId,
      status,
      hasVideoUrl: !!videoUrl
    });

    return res.json({
      success: true,
      data: {
        videoId: videoId,
        status: status,
        videoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl,
        gifUrl: gifUrl,
        duration: duration,
        error: heygenError
      }
    });

  } catch (error) {
    console.error('❌ Update video status error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Internal server error' }
    });
  }
};

// Webhook endpoint for HeyGen callbacks
const handleWebhook = async (req, res) => {
  try {
    const { event_type, event_data } = req.body;
    
    console.log('🎣 Webhook received:', { event_type, video_id: event_data?.video_id });
    
    if (!event_type || !event_data) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid webhook payload' }
      });
    }
    
    // Parse callback_id to get userId, articleId, faqId
    const callbackId = event_data.callback_id;
    if (!callbackId) {
      console.warn('⚠️ Webhook missing callback_id, cannot process');
      return res.json({ received: true, processed: false });
    }
    
    const [userId, articleId, faqId] = callbackId.split('_');
    
    if (!userId || !articleId || !faqId) {
      console.warn('⚠️ Invalid callback_id format:', callbackId);
      return res.json({ received: true, processed: false });
    }
    
    const videoDocRef = db.collection('users').doc(userId)
      .collection('articles').doc(articleId)
      .collection('videos').doc(faqId);
    
    // Handle success event
    if (event_type === 'avatar_video.success') {
      await videoDocRef.update({
        status: 'completed',
        videoUrl: event_data.url,
        gifUrl: event_data.gif_download_url,
        thumbnailUrl: event_data.thumbnail_url || null,
        completedAt: FieldValue.serverTimestamp(),
        lastCheckedAt: FieldValue.serverTimestamp()
      });
      
      console.log('✅ Webhook: Video completed:', faqId);
      return res.json({ received: true, processed: true });
    }
    
    // Handle failure event
    if (event_type === 'avatar_video.fail') {
      await videoDocRef.update({
        status: 'failed',
        error: { message: event_data.msg || 'Video generation failed' },
        lastCheckedAt: FieldValue.serverTimestamp()
      });
      
      console.log('❌ Webhook: Video failed:', faqId, event_data.msg);
      return res.json({ received: true, processed: true });
    }
    
    // Unknown event type
    console.log('ℹ️ Unknown webhook event type:', event_type);
    return res.json({ received: true, processed: false });
    
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    // Always return 200 to prevent webhook retries
    return res.status(200).json({ received: true, error: error.message });
  }
};

// List available avatars
const listAvatars = async (req, res) => {
  try {
    // Verify user authentication
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: 'No authorization token provided' }
      });
    }

    try {
      await auth.verifyIdToken(token);
    } catch (authError) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid authentication token' }
      });
    }

    if (!HEYGEN_API_KEY) {
      return res.status(500).json({
        success: false,
        error: { message: 'HeyGen API key not configured' }
      });
    }

    if (isCacheValid(inMemoryCache.avatars)) {
      console.log(`🗃️ Returning ${inMemoryCache.avatars.data.length} cached avatars`);
      return res.json({
        success: true,
        data: {
          avatars: inMemoryCache.avatars.data,
          total: inMemoryCache.avatars.data.length,
          cached: true
        }
      });
    }

    console.log('📋 Fetching available avatars...');

    const avatars = await fetchAvatarsFromApi();
    const finalAvatars = avatars.length ? avatars : [
      {
        avatar_id: VIDEO_CONFIG.defaultAvatar,
        avatar_name: 'Daisy (Default)',
        gender: null,
        languages: [],
        avatar_style: 'normal',
        preview_image_url: null,
        preview_video_url: null,
        is_public: true
      }
    ];

    setCache('avatars', finalAvatars);
    console.log(`✅ Returning ${finalAvatars.length} avatars`);

    res.json({
      success: true,
      data: {
        avatars: finalAvatars,
        total: finalAvatars.length,
        cached: false
      }
    });

  } catch (error) {
    console.error('❌ List avatars error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Internal server error' }
    });
  }
};

// List available voices
const listVoices = async (req, res) => {
  try {
    // Verify user authentication
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: 'No authorization token provided' }
      });
    }

    try {
      await auth.verifyIdToken(token);
    } catch (authError) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid authentication token' }
      });
    }

    if (!HEYGEN_API_KEY) {
      return res.status(500).json({
        success: false,
        error: { message: 'HeyGen API key not configured' }
      });
    }

    if (isCacheValid(inMemoryCache.voices)) {
      console.log(`🗃️ Returning ${inMemoryCache.voices.data.length} cached voices`);
      return res.json({
        success: true,
        data: {
          voices: inMemoryCache.voices.data,
          total: inMemoryCache.voices.data.length,
          cached: true
        }
      });
    }

    console.log('📋 Fetching available voices...');

    const voices = await fetchVoicesFromApi();
    setCache('voices', voices);

    console.log(`✅ Returning ${voices.length} voices`);

    res.json({
      success: true,
      data: {
        voices: voices,
        total: voices.length,
        cached: false
      }
    });

  } catch (error) {
    console.error('❌ List voices error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Internal server error' }
    });
  }
};

// List available realistic backgrounds
const listBackgrounds = async (req, res) => {
  try {
    // Verify user authentication
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: 'No authorization token provided' }
      });
    }

    try {
      await auth.verifyIdToken(token);
    } catch (authError) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid authentication token' }
      });
    }

    console.log('📋 Fetching available backgrounds...');

    const allBackgrounds = getAllRealisticBackgrounds();
    
    // Group by category for easier frontend handling
    const groupedBackgrounds = {
      categories: Object.keys(REALISTIC_BACKGROUNDS),
      backgrounds: REALISTIC_BACKGROUNDS,
      all: allBackgrounds,
      total: allBackgrounds.length
    };

    console.log(`✅ Returning ${allBackgrounds.length} realistic backgrounds across ${Object.keys(REALISTIC_BACKGROUNDS).length} categories`);

    res.json({
      success: true,
      data: groupedBackgrounds
    });

  } catch (error) {
    console.error('❌ List backgrounds error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Internal server error' }
    });
  }
};

// Server-side video polling and injection endpoint
const pollAndInjectVideo = async (req, res) => {
  try {
    const { videoId, articleId, faqId, userId, source, keywordId } = req.body;

    if (!videoId || !articleId || !faqId || !userId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required fields: videoId, articleId, faqId, userId' }
      });
    }

    console.log('🔄 [Server-side Polling] Starting for:', { 
      videoId, 
      articleId, 
      faqId, 
      userId, 
      source, 
      keywordId 
    });

    // Start async polling (don't await - run in background)
    pollVideoAndInject(videoId, articleId, faqId, userId, source, keywordId)
      .catch(error => {
        console.error('❌ [Server-side Polling] Background polling failed:', error);
      });

    // Return immediately to client
    res.json({
      success: true,
      message: 'Server-side polling started. Video will be injected when ready.',
      data: { videoId, status: 'polling' }
    });

  } catch (error) {
    console.error('❌ Poll and inject error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Internal server error' }
    });
  }
};

// Background polling function that runs on server
const pollVideoAndInject = async (videoId, articleId, faqId, userId, source, keywordId) => {
  const maxAttempts = 60; // 10 minutes max
  let attempts = 0;
  let pollInterval = 10000; // Start with 10 seconds

  const poll = async () => {
    try {
      attempts++;
      console.log(`🔄 [Attempt ${attempts}/${maxAttempts}] Polling video ${videoId}`);

      // Fetch video metadata from Firestore
      const videoDocRef = db.collection('users').doc(userId)
        .collection('articles').doc(articleId)
        .collection('videos').doc(videoId);

      const videoDoc = await videoDocRef.get();

      if (!videoDoc.exists) {
        console.error('❌ Video document not found:', videoId);
        return;
      }

      const videoData = videoDoc.data();
      const heygenVideoId = videoData.heygenVideoId;

      if (!heygenVideoId) {
        console.error('❌ HeyGen video ID not found in database');
        return;
      }

      // Call HeyGen API to check status
      const heygenResponse = await fetch(
        `${HEYGEN_BASE_URL}/v1/video_status.get?video_id=${heygenVideoId}`,
        {
          method: 'GET',
          headers: {
            'X-Api-Key': HEYGEN_API_KEY
          }
        }
      );

      if (!heygenResponse.ok) {
        const errorText = await heygenResponse.text();
        console.error('❌ HeyGen status check failed:', errorText);
        throw new Error(`HeyGen API error: ${heygenResponse.status}`);
      }

      const statusResult = await heygenResponse.json();
      const status = statusResult.data?.status || 'processing';
      const videoUrl = statusResult.data?.video_url || null;
      const thumbnailUrl = statusResult.data?.thumbnail_url || null;
      const gifUrl = statusResult.data?.gif_url || null;
      const duration = statusResult.data?.duration || null;
      const heygenError = statusResult.data?.error || null;

      console.log(`📊 [Attempt ${attempts}] Status: ${status}`);

      // Update Firestore with latest status
      const updateData = {
        status: status,
        lastCheckedAt: FieldValue.serverTimestamp()
      };

      if (videoUrl) updateData.videoUrl = videoUrl;
      if (thumbnailUrl) updateData.thumbnailUrl = thumbnailUrl;
      if (duration) updateData.duration = duration;
      if (gifUrl) updateData.gifUrl = gifUrl;
      if (heygenError) updateData.error = heygenError;

      await videoDocRef.update(updateData);

      // Check if video is complete
      if (status === 'completed' && videoUrl) {
        console.log('✅ Video completed! Injecting into article HTML...');

        // Determine correct article path based on source
        let articleRef;
        if (source === 'keyword') {
          // Keyword-based article: users/{userId}/Key-word/{keywordId}/json/{articleId}
          if (!keywordId) {
            console.error('❌ Keyword ID is required for keyword articles');
            return;
          }
          articleRef = db.collection('users').doc(userId)
            .collection('Key-word').doc(keywordId)
            .collection('json').doc(articleId);
          console.log(`📂 Using keyword path: users/${userId}/Key-word/${keywordId}/json/${articleId}`);
        } else if (source === 'interview') {
          // Interview-based article: users/{userId}/Interviews/{keywordId}/json/{articleId}
          if (!keywordId) {
            console.error('❌ Topic ID is required for interview articles');
            return;
          }
          articleRef = db.collection('users').doc(userId)
            .collection('Interviews').doc(keywordId)
            .collection('json').doc(articleId);
          console.log(`📂 Using interview path: users/${userId}/Interviews/${keywordId}/json/${articleId}`);
        } else {
          // Legacy article: customers/{userId}/articles/{articleId}
          articleRef = db.collection('customers').doc(userId)
            .collection('articles').doc(articleId);
          console.log(`📂 Using legacy path: customers/${userId}/articles/${articleId}`);
        }

        const articleDoc = await articleRef.get();
        
        if (!articleDoc.exists) {
          console.error('❌ Article not found:', articleId, 'at path:', articleRef.path);
          console.error('❌ Source:', source, 'KeywordId:', keywordId);
          return;
        }

        const articleData = articleDoc.data();
        let htmlContent = articleData.htmlContent || '';

        // Create video HTML
        const videoHtml = `
    <div class="faq-video-player" data-faq-id="${faqId}" style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span style="font-size: 0.9rem; font-weight: 600; color: #00D4FF;">AI Generated Video</span>
      </div>
      <video controls style="width: 100%; max-width: 600px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" poster="${thumbnailUrl || ''}">
        <source src="${videoUrl}" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      ${duration ? `<div style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">Duration: ${Math.round(duration)}s</div>` : ''}
    </div>`;

        // Remove existing video player for this FAQ if present
        const existingVideoPattern = new RegExp(
          `<div class="faq-video-player" data-faq-id="${faqId}"[^>]*>[\\s\\S]*?</div>\\s*(?=<p class="back-to-toc"|</div>)`,
          'gi'
        );
        htmlContent = htmlContent.replace(existingVideoPattern, '');

        // Find and replace the mount point with video HTML
        const mountPointPattern = new RegExp(
          `<div class="faq-video-mount" data-faq-id="${faqId}"[^>]*></div>`,
          'gi'
        );

        if (mountPointPattern.test(htmlContent)) {
          htmlContent = htmlContent.replace(mountPointPattern, videoHtml);
          console.log(`✅ Video injected for ${faqId} (replaced mount point)`);
        } else {
          // Fallback: Insert before "Back to Table of Contents" link
          const faqIndex = faqId.split('-')[1];
          const backToTocPattern = new RegExp(
            `(<div class="faq-item" id="faq-${faqIndex}"[\\s\\S]*?)<p class="back-to-toc">`,
            'i'
          );

          if (backToTocPattern.test(htmlContent)) {
            htmlContent = htmlContent.replace(backToTocPattern, `$1${videoHtml}\n      <p class="back-to-toc">`);
            console.log(`✅ Video injected for ${faqId} (fallback method)`);
          } else {
            console.warn(`⚠️ Could not find injection point for ${faqId}`);
            // Still mark video as complete in videos metadata
          }
        }

        // Prepare video metadata
        const completeVideoData = {
          ...videoData,
          status: 'completed',
          videoUrl: videoUrl,
          thumbnailUrl: thumbnailUrl,
          gifUrl: gifUrl,
          duration: duration,
          generatedAt: videoData.createdAt,
          completedAt: new Date().toISOString()
        };

        // Update article with new HTML and video metadata
        const updates = {
          htmlContent: htmlContent,
          [`videos.${faqId}`]: completeVideoData,
          lastModified: new Date().toISOString()
        };

        await articleRef.update(updates);

        console.log('✅ [Server-side Polling] Video injected and saved to Firestore!');
        return true;

      } else if (status === 'failed') {
        const errorMessage = heygenError?.message || heygenError?.detail || 'Video generation failed';
        console.error('❌ Video generation failed:', errorMessage);
        return false;
      }

      // Still processing - continue polling
      if (attempts >= maxAttempts) {
        console.error(`❌ Polling timeout after ${maxAttempts} attempts`);
        await videoDocRef.update({
          status: 'failed',
          error: { message: 'Polling timeout' }
        });
        return false;
      }

      // Exponential backoff: 10s, 15s, 20s, 25s, 30s (max)
      pollInterval = Math.min(10000 + (attempts * 5000), 30000);
      
      console.log(`⏳ Still processing... waiting ${pollInterval/1000}s before next check`);
      await sleep(pollInterval);
      
      // Recursive call
      return poll();

    } catch (error) {
      console.error('❌ [Server-side Polling] Error:', error);
      
      if (attempts >= maxAttempts) {
        throw error;
      }
      
      // Retry after delay
      await sleep(pollInterval);
      return poll();
    }
  };

  return poll();
};

// Get User Credits endpoint (simplified for testing)
const getUserCredits = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing userId' }
      });
    }

    // Verify user authentication
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: 'No authorization token provided' }
      });
    }

    try {
      const decodedToken = await auth.verifyIdToken(token);
      if (decodedToken.uid !== userId) {
        return res.status(403).json({
          success: false,
          error: { message: 'User ID mismatch' }
        });
      }
    } catch (authError) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid authentication token' }
      });
    }

    // For now, return mock credits since we're not implementing credit system yet
    res.json({
      success: true,
      data: {
        credits: 100, // Mock credits for testing
        videosGenerated: 0
      }
    });

  } catch (error) {
    console.error('❌ Get user credits error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Internal server error' }
    });
  }
};

// Main handler function
const handler = async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Strip /heygen prefix from path
      const rawPath = req.path || '/';
      const path = rawPath.replace(/^\/heygen\b/, '') || '/';
      const method = req.method;

      console.log(`🔍 HeyGen API Request: ${method} ${rawPath} -> ${path}`);

      // Route: POST /generate or /generate-faq-video
      if ((path === '/generate' || path === '/generate-faq-video') && method === 'POST') {
        return await generateVideo(req, res);
      }

      // Route: POST /update-video-status
      if (path === '/update-video-status' && method === 'POST') {
        return await updateVideoStatus(req, res);
      }
      
      // Route: POST /poll-and-inject - Server-side polling endpoint
      if (path === '/poll-and-inject' && method === 'POST') {
        return await pollAndInjectVideo(req, res);
      }
      
      // Route: POST /webhook - HeyGen callback endpoint
      if (path === '/webhook' && method === 'POST') {
        return await handleWebhook(req, res);
      }
      
      // Route: GET /avatars - List available avatars
      if (path === '/avatars' && method === 'GET') {
        return await listAvatars(req, res);
      }
      
      // Route: GET /voices - List available voices
      if (path === '/voices' && method === 'GET') {
        return await listVoices(req, res);
      }
      
      // Route: GET /backgrounds - List realistic backgrounds
      if (path === '/backgrounds' && method === 'GET') {
        return await listBackgrounds(req, res);
      }

      // Route: GET /credits/:userId
      if (path.startsWith('/credits/') && method === 'GET') {
        req.params = { userId: path.split('/')[2] };
        return await getUserCredits(req, res);
      }

      // Default 404 for unknown routes
      return res.status(404).json({
        success: false,
        error: { message: `Route ${path} not found` }
      });

    } catch (error) {
      console.error('❌ HeyGen Handler Error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Internal server error',
          code: 'HEYGEN_ERROR'
        }
      });
    }
  });
};

// Export the handler function
exports.handler = handler;