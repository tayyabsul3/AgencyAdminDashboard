const functions = require('firebase-functions');
const { rateLimiter } = require('../lib/rateLimiter');
const { usageMonitor } = require('../lib/usageMonitor');
const { audioCache } = require('../lib/audioCache');

/**
 * Main ElevenLabs API handler
 */
async function handler(req, res) {
  const path = req.path.replace('/elevenlabs', '');
  
  try {
    switch (path) {
      case '/synthesize':
        return await handleSynthesize(req, res);
      case '/voices':
        return await handleVoices(req, res);
      case '/usage':
        return await handleUsage(req, res);
      case '/health':
        return await handleHealth(req, res);
      default:
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `ElevenLabs route ${path} not found`
          }
        });
    }
  } catch (error) {
    console.error('ElevenLabs API Error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: error.message
      }
    });
  }
}

/**
 * Handle speech synthesis with production features
 */
async function handleSynthesize(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST method allowed' }
    });
  }

  const startTime = Date.now();
  let userId = 'anonymous';

  try {
    const { text, voiceId, settings, userId: requestUserId } = req.body;
    userId = requestUserId || 'anonymous';

    // Validate required parameters
    if (!text) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_TEXT', message: 'Text is required' }
      });
    }

    // Validate text length
    if (text.length > 5000) {
      return res.status(400).json({
        success: false,
        error: { code: 'TEXT_TOO_LONG', message: 'Text must be less than 5000 characters' }
      });
    }

    // Check rate limits
    const rateLimitResult = rateLimiter.checkRateLimit(userId, text.length);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded: ${rateLimitResult.reason}`,
          resetTime: rateLimitResult.resetTime,
          limits: rateLimitResult.limits
        }
      });
    }

    // Get API key from environment variables
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('ElevenLabs API key not configured');
      usageMonitor.recordError(userId, new Error('API key not configured'), text.length);
      return res.status(500).json({
        success: false,
        error: { code: 'API_KEY_MISSING', message: 'ElevenLabs API not configured' }
      });
    }

    // Use default voice ID if not provided
    const defaultVoiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
    const selectedVoiceId = voiceId || defaultVoiceId;

    // Prepare voice settings with production defaults
    const voiceSettings = {
      stability: settings?.stability || parseFloat(process.env.ELEVENLABS_DEFAULT_STABILITY) || 0.75,
      similarity_boost: settings?.similarity_boost || parseFloat(process.env.ELEVENLABS_DEFAULT_SIMILARITY_BOOST) || 0.75,
      style: settings?.style || parseFloat(process.env.ELEVENLABS_DEFAULT_STYLE) || 0.5,
      use_speaker_boost: settings?.use_speaker_boost !== undefined ? settings.use_speaker_boost : (process.env.ELEVENLABS_USE_SPEAKER_BOOST === 'true')
    };

    // Check cache first
    const cachedAudio = audioCache.get(text, selectedVoiceId, voiceSettings);
    if (cachedAudio) {
      const responseTime = Date.now() - startTime;
      usageMonitor.recordSuccess(userId, text.length, responseTime);
      
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': cachedAudio.audio.length.toString(),
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': 'HIT',
        'X-Cache-Hits': cachedAudio.hits.toString()
      });
      
      return res.send(cachedAudio.audio);
    }

    // Prepare request to ElevenLabs API
    const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`;
    const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5';
    
    const requestBody = {
      text,
      model_id: modelId,
      voice_settings: voiceSettings
    };

    // Make request to ElevenLabs API with timeout
    const fetch = (await import('node-fetch')).default;
    const timeoutMs = parseInt(process.env.API_TIMEOUT_MS) || 30000;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(elevenLabsUrl, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API error:', response.status, response.statusText, errorText);
        
        const error = new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
        usageMonitor.recordError(userId, error, text.length);
        
        return res.status(response.status).json({
          success: false,
          error: {
            code: 'ELEVENLABS_API_ERROR',
            message: `ElevenLabs API error: ${response.status} ${response.statusText}`,
            details: errorText
          }
        });
      }

      // Get audio data
      const audioBuffer = await response.buffer();
      
      // Cache the result
      audioCache.set(text, selectedVoiceId, voiceSettings, audioBuffer);
      
      // Record success metrics
      const responseTime = Date.now() - startTime;
      usageMonitor.recordSuccess(userId, text.length, responseTime);
      
      // Return audio data with proper headers
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': 'MISS',
        'X-Response-Time': `${responseTime}ms`,
        'X-Rate-Limit-Remaining': JSON.stringify(rateLimitResult.limits)
      });
      
      return res.send(audioBuffer);

    } catch (fetchError) {
      clearTimeout(timeout);
      
      if (fetchError.name === 'AbortError') {
        const error = new Error('Request timeout');
        usageMonitor.recordError(userId, error, text.length);
        return res.status(408).json({
          success: false,
          error: { code: 'REQUEST_TIMEOUT', message: 'Request timed out' }
        });
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error('Speech synthesis error:', error);
    usageMonitor.recordError(userId, error, text?.length || 0);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'SYNTHESIS_ERROR',
        message: 'Internal server error during speech synthesis',
        details: error.message
      }
    });
  }
}

/**
 * Handle voices listing
 */
async function handleVoices(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET method allowed' }
    });
  }

  try {
    // Get API key from environment variables
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('ElevenLabs API key not configured');
      return res.status(500).json({
        success: false,
        error: { code: 'API_KEY_MISSING', message: 'ElevenLabs API not configured' }
      });
    }

    // Make request to ElevenLabs API
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'xi-api-key': apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, response.statusText, errorText);
      
      return res.status(response.status).json({
        success: false,
        error: {
          code: 'ELEVENLABS_API_ERROR',
          message: `ElevenLabs API error: ${response.status} ${response.statusText}`,
          details: errorText
        }
      });
    }

    const voicesData = await response.json();
    
    // Return voices data
    res.set({
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    });
    
    return res.json({
      success: true,
      data: voicesData
    });

  } catch (error) {
    console.error('Voices fetch error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'VOICES_ERROR',
        message: 'Internal server error while fetching voices',
        details: error.message
      }
    });
  }
}

/**
 * Handle usage statistics
 */
async function handleUsage(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET method allowed' }
    });
  }

  try {
    const days = parseInt(req.query.days) || 7;
    const userId = req.query.userId || 'all';
    
    const usageStats = usageMonitor.getUsageStats(days);
    const cacheStats = audioCache.getStats();
    
    let userUsage = null;
    if (userId !== 'all') {
      userUsage = rateLimiter.getUsage(userId);
    }
    
    return res.json({
      success: true,
      data: {
        usage: usageStats,
        cache: cacheStats,
        userUsage,
        period: `${days} days`
      }
    });

  } catch (error) {
    console.error('Usage stats error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'USAGE_ERROR',
        message: 'Internal server error while fetching usage stats',
        details: error.message
      }
    });
  }
}

/**
 * Handle health check
 */
async function handleHealth(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET method allowed' }
    });
  }

  try {
    const healthStatus = usageMonitor.getHealthStatus();
    const cacheStats = audioCache.getStats();
    
    // Check API key configuration
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    
    const config = {
      apiKeyConfigured: !!apiKey,
      voiceIdConfigured: !!voiceId,
      cacheEnabled: cacheStats.enabled,
      rateLimitingEnabled: true,
      usageTrackingEnabled: process.env.ELEVENLABS_USAGE_TRACKING_ENABLED === 'true'
    };
    
    // Test API connectivity (optional quick test)
    let apiConnectivity = 'unknown';
    if (req.query.test === 'true' && apiKey) {
      try {
        const fetch = (await import('node-fetch')).default;
        const testResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'xi-api-key': apiKey
          }
        });
        apiConnectivity = testResponse.ok ? 'connected' : 'error';
      } catch (error) {
        apiConnectivity = 'error';
      }
    }
    
    const overallStatus = healthStatus.status === 'healthy' && config.apiKeyConfigured && config.voiceIdConfigured
      ? 'healthy'
      : healthStatus.status === 'unhealthy' || !config.apiKeyConfigured
      ? 'unhealthy'
      : 'degraded';
    
    return res.json({
      success: true,
      data: {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        config,
        health: healthStatus,
        cache: cacheStats,
        apiConnectivity
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_ERROR',
        message: 'Internal server error during health check',
        details: error.message
      }
    });
  }
}

module.exports = { handler };