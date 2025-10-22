const { GoogleGenAI } = require('@google/genai');
const { admin } = require('../lib/firebase-admin');
const { validateMethod, validateRequiredFields, sanitizeInput, handleApiError, sendResponse } = require('../lib/api-utils');

// Get Firebase Storage bucket
const getBucket = () => {
  if (!admin.apps.length) {
    require('../lib/firebase-admin').initializeFirebaseAdmin();
  }
  return admin.storage().bucket();
};

// Initialize Gemini AI client
const initGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Upload base64 image to Firebase Storage
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} fileName - Name for the file
 * @returns {Promise<string>} - Public URL of the uploaded image
 */
const uploadToStorage = async (base64Data, fileName) => {
  try {
    const bucket = getBucket();
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Create a unique file name with timestamp
    const timestamp = Date.now();
    const uniqueFileName = `generated-images/${timestamp}-${fileName}.png`;
    
    // Upload to Firebase Storage
    const file = bucket.file(uniqueFileName);
    
    // Generate a download token for the file
    const downloadToken = require('crypto').randomUUID();
    
    await file.save(imageBuffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000',
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        }
      },
    });
    
    // Make the file publicly accessible (this sets proper ACLs)
    await file.makePublic();
    
    // Get a signed download URL that works with CORS
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2500', // Far future expiration
    });
    
    console.log('✅ Image uploaded to Firebase Storage:', signedUrl);
    return signedUrl;
    
  } catch (error) {
    console.error('❌ Failed to upload image to storage:', error);
    throw new Error(`Storage upload failed: ${error.message}`);
  }
};

/**
 * Generate image using Gemini 2.5 Flash Image (Nano Banana)
 * @param {string} prompt - Text prompt for image generation
 * @param {object} config - Optional configuration (aspectRatio, etc.)
 * @returns {Promise<object>} - Generated image data
 */
const generateImageWithGemini = async (prompt, config = {}) => {
  try {
    const ai = initGeminiClient();
    
    console.log('🎨 Generating image with Gemini Nano Banana');
    console.log('📝 Prompt:', prompt);
    
    // Build configuration
    const generationConfig = {
      responseModalities: ['Image'], // Only return image, no text
    };
    
    // Add aspect ratio if specified
    if (config.aspectRatio) {
      generationConfig.imageConfig = {
        aspectRatio: config.aspectRatio, // e.g., "16:9", "1:1", "4:3"
      };
    }
    
    // Generate content with Gemini 2.5 Flash Image model
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
      config: generationConfig,
    });
    
    console.log('📦 Received response from Gemini');
    
    // Debug: Log the response structure
    console.log('🔍 Response structure:', JSON.stringify({
      hasCandidates: !!response.candidates,
      candidatesLength: response.candidates?.length,
      hasContent: !!response.candidates?.[0]?.content,
      hasParts: !!response.candidates?.[0]?.content?.parts,
    }));
    
    // Check if response has the expected structure
    if (!response.candidates || !response.candidates[0]) {
      console.error('❌ Invalid response structure:', JSON.stringify(response, null, 2));
      throw new Error('Gemini returned invalid response structure');
    }
    
    if (!response.candidates[0].content || !response.candidates[0].content.parts) {
      console.error('❌ Missing content.parts:', JSON.stringify(response.candidates[0], null, 2));
      throw new Error('Gemini response missing content.parts');
    }
    
    // Extract image data from response
    let imageData = null;
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageData = part.inlineData.data;
        console.log('✅ Image data extracted successfully');
        break;
      }
    }
    
    if (!imageData) {
      console.error('❌ No inlineData found in parts:', JSON.stringify(response.candidates[0].content.parts, null, 2));
      throw new Error('No image data returned from Gemini');
    }
    
    return {
      success: true,
      imageData: imageData, // Base64 encoded image
      mimeType: response.candidates[0].content.parts[0].inlineData?.mimeType || 'image/png',
    };
    
  } catch (error) {
    console.error('❌ Gemini image generation failed:', error);
    throw new Error(`Image generation failed: ${error.message}`);
  }
};

/**
 * Handle Image generation requests using Gemini Nano Banana
 * Expects payload with { title, prompt, description, aspectRatio }
 */
const handler = async (req, res) => {
  try {
    validateMethod(req, ['POST']);

    const body = sanitizeInput(req.body);

    // Accept either { imageData: {...} } or a simple { title, prompt }
    let imageConfig = body.imageData || body;
    
    // Build the prompt
    const userPrompt = imageConfig.prompt || imageConfig.title;
    
    if (!userPrompt) {
      return sendResponse(res, 400, false, null, {
        code: 'INVALID_REQUEST',
        message: 'Missing required field: prompt or title'
      });
    }

    console.log('🖼️ Starting Gemini Nano Banana Image Generation');
    console.log('🧾 Image config:', {
      hasPrompt: !!userPrompt,
      hasDescription: !!imageConfig.description,
      aspectRatio: imageConfig.aspectRatio || '1:1',
    });

    // Enhance the prompt for better image generation
    let enhancedPrompt = userPrompt;
    
    // If there's a description, incorporate it
    if (imageConfig.description) {
      enhancedPrompt = `${userPrompt}. ${imageConfig.description}`;
    }
    
    // Add professional styling hints if not already in prompt
    if (!enhancedPrompt.toLowerCase().includes('professional') && 
        !enhancedPrompt.toLowerCase().includes('high-quality')) {
      enhancedPrompt = `Professional, high-quality image: ${enhancedPrompt}`;
    }

    console.log('📝 Enhanced prompt:', enhancedPrompt);

    // Generate image with Gemini
    const result = await generateImageWithGemini(enhancedPrompt, {
      aspectRatio: imageConfig.aspectRatio || '16:9', // Default to wide format
    });

    if (!result.success || !result.imageData) {
      throw new Error('Failed to generate image');
    }

    console.log('⬆️ Uploading image to Firebase Storage...');
    
    // Upload to Firebase Storage
    const fileName = (imageConfig.title || 'generated-image')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 50);
    
    const publicUrl = await uploadToStorage(result.imageData, fileName);

    console.log('✅ Image generation complete!');

    return sendResponse(res, 200, true, {
      shareableLink: publicUrl,
      url: publicUrl,
      title: imageConfig.title || userPrompt,
      createdAt: new Date().toISOString(),
      model: 'gemini-2.5-flash-image',
      aspectRatio: imageConfig.aspectRatio || '16:9',
    });

  } catch (error) {
    console.error('❌ Image generation error:', error);
    const errorResponse = handleApiError(error, 'gemini-image-generator');
    return sendResponse(res, errorResponse.status, false, null, errorResponse.response.error);
  }
};

module.exports = { handler, generateImageWithGemini, uploadToStorage };
