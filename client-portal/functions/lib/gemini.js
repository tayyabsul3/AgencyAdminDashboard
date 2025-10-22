const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI client
let genAI;

// Default generation configuration
// You can override via environment variable GEMINI_MAX_OUTPUT_TOKENS or per-call options
const DEFAULT_MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 60000;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MODEL_FALLBACKS = [DEFAULT_MODEL, 'gemini-2.0-flash', 'gemini-1.5-flash'];

// Small helper for backoff
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Initialize Gemini client for Firebase Functions
const initializeGemini = () => {
  if (genAI) return genAI; // Already initialized

  try {
    // Get API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your-actual-gemini-api-key-here') {
      console.error('GEMINI_API_KEY not configured. Please set your API key in functions/.env');
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('Initializing Gemini with API key:', apiKey.substring(0, 10) + '...');

    // Initialize with the correct Google Generative AI library
    genAI = new GoogleGenerativeAI(apiKey);

    console.log('✅ Gemini client initialized successfully');
    console.log('🔍 Available methods on client:', Object.getOwnPropertyNames(genAI));
    console.log('🔍 Client prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(genAI)));

    return genAI;
  } catch (error) {
    console.error('Gemini AI initialization error:', error);
    throw error; // Don't return null, throw the error
  }
};

/**
 * Build brand voice instructions for AI prompts
 * @param {Object} brandVoiceSettings - User's brand voice settings
 * @returns {string} Brand voice instructions to inject into prompts
 */
const buildBrandVoiceInstructions = (brandVoiceSettings) => {
  if (!brandVoiceSettings || !brandVoiceSettings.enabled) {
    return '';
  }

  let instructions = '\n\n🎯 BRAND VOICE INSTRUCTIONS:\n';

  // Preferred terms
  if (brandVoiceSettings.preferredTerms && brandVoiceSettings.preferredTerms.length > 0) {
    instructions += `- PREFERRED TERMS: Use these terms when possible: ${brandVoiceSettings.preferredTerms.join(', ')}\n`;
  }

  // Banned phrases
  if (brandVoiceSettings.bannedPhrases && brandVoiceSettings.bannedPhrases.length > 0) {
    instructions += `- BANNED PHRASES: NEVER use these phrases: ${brandVoiceSettings.bannedPhrases.join(', ')}\n`;
  }

  // Industry context
  if (brandVoiceSettings.industry && brandVoiceSettings.industry !== 'general') {
    instructions += `- INDUSTRY CONTEXT: This content is for ${brandVoiceSettings.industry} audience\n`;
  }

  // Custom instructions
  if (brandVoiceSettings.customInstructions) {
    instructions += `- TONE GUIDELINES: ${brandVoiceSettings.customInstructions}\n`;
  }

  // Required disclaimer
  if (brandVoiceSettings.defaultDisclaimer) {
    instructions += `- REQUIRED DISCLAIMER: Include this disclaimer in appropriate sections: "${brandVoiceSettings.defaultDisclaimer}"\n`;
  }

  instructions += '- CRITICAL: Follow these brand voice rules throughout ALL content generation.\n';

  return instructions;
};

/**
 * Validate and sanitize brand voice settings
 * @param {Object} brandVoiceSettings - Raw brand voice settings
 * @returns {Object} Sanitized brand voice settings
 */
const sanitizeBrandVoiceSettings = (brandVoiceSettings) => {
  if (!brandVoiceSettings || typeof brandVoiceSettings !== 'object') {
    return null;
  }

  return {
    enabled: Boolean(brandVoiceSettings.enabled),
    preferredTerms: Array.isArray(brandVoiceSettings.preferredTerms) 
      ? brandVoiceSettings.preferredTerms.filter(term => typeof term === 'string' && term.trim().length > 0)
      : [],
    bannedPhrases: Array.isArray(brandVoiceSettings.bannedPhrases)
      ? brandVoiceSettings.bannedPhrases.filter(phrase => typeof phrase === 'string' && phrase.trim().length > 0)
      : [],
    defaultDisclaimer: typeof brandVoiceSettings.defaultDisclaimer === 'string' 
      ? brandVoiceSettings.defaultDisclaimer.trim() 
      : '',
    industry: typeof brandVoiceSettings.industry === 'string' 
      ? brandVoiceSettings.industry.trim() 
      : 'general',
    customInstructions: typeof brandVoiceSettings.customInstructions === 'string'
      ? brandVoiceSettings.customInstructions.trim()
      : ''
  };
};

// Extract JSON string from Gemini text responses which may include Markdown fences
// Example inputs:
// ```json\n{ "a": 1 }\n```
// or prose + fenced block, or raw JSON with whitespace
const extractJsonString = (text) => {
  if (!text || typeof text !== 'string') return text;

  // Prefer a fenced code block tagged as json
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }

  // If no fences, try to locate the first JSON object/array in the text
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let start = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    start = Math.min(firstBrace, firstBracket);
  } else {
    start = Math.max(firstBrace, firstBracket);
  }

  if (start !== -1) {
    // Heuristically find the last closing brace/bracket
    const lastBrace = text.lastIndexOf('}');
    const lastBracket = text.lastIndexOf(']');
    let end = Math.max(lastBrace, lastBracket);
    if (end !== -1 && end > start) {
      return text.slice(start, end + 1).trim();
    }
  }

  return text.trim();
};

/**
 * Generate content using Gemini AI with Google Search grounding and brand voice
 * @param {string} prompt - The prompt to send to Gemini
 * @param {Object} options - Additional options for generation
 * @param {Object} options.brandVoiceSettings - Brand voice settings to apply
 * @returns {Promise<string>} Generated content
 */
const generateContent = async (prompt, options = {}) => {
  // Ensure Gemini is initialized
  let client;
  try {
    client = initializeGemini();
  } catch (initError) {
    console.error('Failed to initialize Gemini client:', initError);
    throw new Error(`Gemini AI initialization failed: ${initError.message}`);
  }

  try {
    // Apply brand voice settings if provided
    let enhancedPrompt = prompt;
    if (options.brandVoiceSettings) {
      const sanitizedBrandVoice = sanitizeBrandVoiceSettings(options.brandVoiceSettings);
      if (sanitizedBrandVoice && sanitizedBrandVoice.enabled) {
        const brandVoiceInstructions = buildBrandVoiceInstructions(sanitizedBrandVoice);
        enhancedPrompt = prompt + brandVoiceInstructions;
        console.log('🎯 BRAND VOICE: Applied brand voice instructions');
        console.log('📋 BRAND VOICE SETTINGS:', {
          preferredTerms: sanitizedBrandVoice.preferredTerms.length,
          bannedPhrases: sanitizedBrandVoice.bannedPhrases.length,
          industry: sanitizedBrandVoice.industry,
          hasDisclaimer: !!sanitizedBrandVoice.defaultDisclaimer,
          hasCustomInstructions: !!sanitizedBrandVoice.customInstructions
        });
      }
    }

    console.log('🔍 GEMINI REQUEST - Starting content generation with Google Search grounding');
    console.log('📝 PROMPT:', enhancedPrompt.substring(0, 200) + '...');
    console.log('⚙️ CONFIG: Using Google Search grounding tool');

    const maxOutputTokens = Number(options.maxOutputTokens) || DEFAULT_MAX_OUTPUT_TOKENS;
    console.log('🔧 maxOutputTokens:', maxOutputTokens);

    const modelsToTry = MODEL_FALLBACKS;
    let lastError;
    let response;
    for (const modelName of modelsToTry) {
      console.log(`🧪 Trying model: ${modelName}`);
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const model = client.getGenerativeModel({
            model: modelName,
            tools: [{ googleSearchRetrieval: {} }],
            generationConfig: { maxOutputTokens }
          });
          response = await model.generateContent(enhancedPrompt);
          lastError = undefined;
          break;
        } catch (err) {
          lastError = err;
          const status = err?.status || err?.response?.status;
          const msg = err?.message || '';
          const isOverloaded = status === 503 || /overloaded/i.test(msg);
          const isNotFound = status === 404 || /not found/i.test(msg);
          console.warn(`⚠️ Attempt ${attempt} failed for ${modelName}:`, msg);
          if (isOverloaded && attempt < 3) {
            const backoff = 500 * Math.pow(2, attempt - 1);
            console.log(`⏳ Model overloaded. Retrying in ${backoff}ms...`);
            await sleep(backoff);
            continue;
          }
          // Break retry loop for non-503 or final attempt
          break;
        }
      }
      if (response) {
        console.log(`✅ Succeeded with model: ${modelName}`);
        break;
      }
      // If not found, try next fallback model
      if (lastError) {
        const status = lastError?.status || lastError?.response?.status;
        const msg = lastError?.message || '';
        const isNotFound = status === 404 || /not found/i.test(msg);
        if (isNotFound) {
          console.log(`🔁 Model ${modelName} not available. Trying next fallback...`);
          continue;
        }
      }
    }

    if (!response && lastError) {
      throw lastError;
    }

    console.log('✅ GEMINI RAW RESPONSE RECEIVED');
    console.log('📊 Response object keys:', Object.keys(response));

    // Log grounding metadata if available
    if (response.groundingMetadata) {
      console.log('🌐 GOOGLE SEARCH GROUNDING METADATA:');
      console.log('- Search queries performed:', response.groundingMetadata.searchQueries || 'None');
      console.log('- Grounding chunks:', response.groundingMetadata.groundingChunks?.length || 0);

      if (response.groundingMetadata.groundingChunks) {
        response.groundingMetadata.groundingChunks.forEach((chunk, index) => {
          console.log(`📄 Grounding Chunk ${index + 1}:`);
          console.log(`  - Source: ${chunk.web?.uri || 'Unknown'}`);
          console.log(`  - Title: ${chunk.web?.title || 'No title'}`);
          console.log(`  - Content preview: ${chunk.content?.substring(0, 100)}...`);
        });
      }
    } else {
      console.log('⚠️ No grounding metadata found in response');
    }

    // Log citations if available
    if (response.candidates?.[0]?.citationMetadata) {
      console.log('📚 CITATIONS FOUND:');
      response.candidates[0].citationMetadata.citationSources?.forEach((citation, index) => {
        console.log(`  Citation ${index + 1}: ${citation.uri}`);
      });
    }

    const generatedText = response.response.text();
    console.log('📝 GENERATED TEXT LENGTH:', generatedText?.length || 0);
    console.log('📝 GENERATED TEXT PREVIEW:', generatedText?.substring(0, 300) + '...');

    return generatedText;
  } catch (error) {
    console.error('❌ GEMINI ERROR:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data || 'No response data'
    });
    throw new Error(`Failed to generate content: ${error.message}`);
  }
};

/**
 * Generate structured JSON content using Gemini AI with Google Search grounding and brand voice
 * @param {string} prompt - The prompt to send to Gemini
 * @param {Object} schema - Expected JSON schema for validation
 * @param {Object} options - Additional options including brand voice settings
 * @param {Object} options.brandVoiceSettings - Brand voice settings to apply
 * @returns {Promise<Object>} Parsed JSON response
 */
const generateStructuredContent = async (prompt, schema = null, options = {}) => {
  // Ensure Gemini is initialized
  let client;
  try {
    client = initializeGemini();
  } catch (initError) {
    console.error('Failed to initialize Gemini client:', initError);
    throw new Error(`Gemini AI initialization failed: ${initError.message}`);
  }

  let jsonParseAttempts = 0;
  const MAX_JSON_PARSE_ATTEMPTS = 3;
  let finalResponse = null;
  let lastParseError = null;

  // Main retry loop for JSON parsing failures
  while (jsonParseAttempts < MAX_JSON_PARSE_ATTEMPTS && !finalResponse) {
    jsonParseAttempts++;
    console.log(`\n🔄 JSON PARSE ATTEMPT ${jsonParseAttempts}/${MAX_JSON_PARSE_ATTEMPTS}`);
    
    try {
      // Apply brand voice settings if provided
      let enhancedPrompt = prompt;
      if (options.brandVoiceSettings) {
        const sanitizedBrandVoice = sanitizeBrandVoiceSettings(options.brandVoiceSettings);
        if (sanitizedBrandVoice && sanitizedBrandVoice.enabled) {
          const brandVoiceInstructions = buildBrandVoiceInstructions(sanitizedBrandVoice);
          enhancedPrompt = prompt + brandVoiceInstructions;
          console.log('🎯 BRAND VOICE: Applied brand voice instructions to structured content');
          console.log('📋 BRAND VOICE SETTINGS:', {
            preferredTerms: sanitizedBrandVoice.preferredTerms.length,
            bannedPhrases: sanitizedBrandVoice.bannedPhrases.length,
            industry: sanitizedBrandVoice.industry,
            hasDisclaimer: !!sanitizedBrandVoice.defaultDisclaimer,
            hasCustomInstructions: !!sanitizedBrandVoice.customInstructions
          });
        }
      }

      console.log('🔍 GEMINI STRUCTURED REQUEST - Starting with Google Search grounding');
      console.log('📝 PROMPT:', enhancedPrompt.substring(0, 200) + '...');
      console.log('🎯 SCHEMA VALIDATION:', schema ? 'Enabled' : 'Disabled');

      const maxOutputTokens = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || DEFAULT_MAX_OUTPUT_TOKENS;
      console.log('🔧 maxOutputTokens (structured):', maxOutputTokens);

    const modelsToTry = MODEL_FALLBACKS;
    let lastError;
    let response;
    for (const modelName of modelsToTry) {
      console.log(`🧪 Trying model (structured): ${modelName}`);
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const model = client.getGenerativeModel({
            model: modelName,
            generationConfig: { maxOutputTokens }
          });
          response = await model.generateContent(enhancedPrompt);
          lastError = undefined;
          break;
        } catch (err) {
          lastError = err;
          const status = err?.status || err?.response?.status;
          const msg = err?.message || '';
          const isOverloaded = status === 503 || /overloaded/i.test(msg);
          const isNotFound = status === 404 || /not found/i.test(msg);
          console.warn(`⚠️ Attempt ${attempt} failed for ${modelName}:`, msg);
          if (isOverloaded && attempt < 3) {
            const backoff = 500 * Math.pow(2, attempt - 1);
            console.log(`⏳ Model overloaded. Retrying in ${backoff}ms...`);
            await sleep(backoff);
            continue;
          }
          // Break retry loop for non-503 or final attempt
          break;
        }
      }
      if (response) {
        console.log(`✅ Succeeded with model (structured): ${modelName}`);
        break;
      }
      if (lastError) {
        const status = lastError?.status || lastError?.response?.status;
        const msg = lastError?.message || '';
        const isNotFound = status === 404 || /not found/i.test(msg);
        if (isNotFound) {
          console.log(`🔁 Model ${modelName} not available. Trying next fallback...`);
          continue;
        }
      }
    }

    if (!response && lastError) {
      throw lastError;
    }

    console.log('✅ GEMINI STRUCTURED RAW RESPONSE RECEIVED');

    // Log grounding metadata for structured content
    if (response.groundingMetadata) {
      console.log('🌐 GOOGLE SEARCH GROUNDING FOR STRUCTURED CONTENT:');
      console.log('- Search queries:', response.groundingMetadata.searchQueries || 'None');
      console.log('- Sources used:', response.groundingMetadata.groundingChunks?.length || 0);

      if (response.groundingMetadata.groundingChunks) {
        response.groundingMetadata.groundingChunks.forEach((chunk, index) => {
          console.log(`📄 Source ${index + 1}: ${chunk.web?.uri} - "${chunk.web?.title}"`);
        });
      }
    }

    const text = response.response.text();
    console.log('📝 RAW TEXT BEFORE JSON PARSING:', text?.substring(0, 500) + '...');

    // Try to parse as JSON
    try {
      // First, attempt to extract potential JSON from fenced blocks or prose
      const candidate = extractJsonString(text);
      console.log('🔧 EXTRACTED JSON CANDIDATE:', candidate?.substring(0, 300) + '...');

      let jsonResponse;
      try {
        jsonResponse = JSON.parse(candidate);
        console.log('✅ JSON PARSING SUCCESSFUL');
        console.log('📊 PARSED OBJECT KEYS:', Object.keys(jsonResponse));
      } catch (firstParseError) {
        console.log('⚠️ First JSON parse failed, trying unfenced version');
        // As a last resort, remove leading/trailing code fences/backticks if any slipped through
        const unfenced = candidate.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim();
        console.log('🔧 UNFENCED JSON:', unfenced?.substring(0, 300) + '...');
        jsonResponse = JSON.parse(unfenced);
        console.log('✅ JSON PARSING SUCCESSFUL (after unfencing)');
      }

      // Basic schema validation if provided
      if (schema && !validateSchema(jsonResponse, schema)) {
        console.error('❌ SCHEMA VALIDATION FAILED');
        throw new Error('Response does not match expected schema');
      } else if (schema) {
        console.log('🎉 SCHEMA VALIDATION PASSED');
      }

      console.log('🎯 FINAL STRUCTURED RESPONSE READY');
      finalResponse = jsonResponse;
      console.log(`✅ SUCCESS: Valid JSON obtained on attempt ${jsonParseAttempts}`);
      break; // Exit the retry loop
      
    } catch (parseError) {
      lastParseError = parseError;
      console.error(`⚠️ JSON PARSING FAILED on attempt ${jsonParseAttempts}`);
      console.error('Parse error:', parseError.message);
      
      if (jsonParseAttempts < MAX_JSON_PARSE_ATTEMPTS) {
        console.log(`🔄 Retrying with a more explicit JSON instruction...`);
        // Add more explicit JSON formatting instruction for retry
        if (!prompt.includes('CRITICAL: Return ONLY valid JSON')) {
          prompt = prompt + '\n\nCRITICAL: Return ONLY valid JSON. No markdown code blocks, no explanatory text, no comments. Start with { and end with }. Ensure all quotes are properly escaped.';
        }
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error('Raw text that failed to parse:', text);
        console.error(`❌ All ${MAX_JSON_PARSE_ATTEMPTS} attempts failed to get valid JSON`);
      }
    }
    
    } catch (error) {
      // This catches model/API errors (not JSON parsing errors)
      console.error('❌ GEMINI API ERROR:', error);
      throw new Error(`Failed to generate content from Gemini: ${error.message}`);
    }
  } // End of retry loop
  
  // Check if we got a valid response
  if (finalResponse) {
    // Add metadata about the generation process
    if (!finalResponse._metadata) {
      finalResponse._metadata = {};
    }
    finalResponse._metadata.jsonParseAttempts = jsonParseAttempts;
    finalResponse._metadata.generatedAt = new Date().toISOString();
    
    return finalResponse;
  } else {
    // All attempts failed
    const errorMsg = `Failed to get valid JSON after ${jsonParseAttempts} attempts. Last error: ${lastParseError?.message || 'Unknown error'}`;
    console.error('❌ ' + errorMsg);
    throw new Error(errorMsg);
  }
};

/**
 * Basic schema validation helper
 * @param {Object} data - Data to validate
 * @param {Object} schema - Schema to validate against
 * @returns {boolean} Whether data matches schema
 */
const validateSchema = (data, schema) => {
  // Simple validation - can be enhanced based on needs
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in data)) {
        return false;
      }
    }
  }
  return true;
};

/**
 * Check if Gemini AI is properly configured
 * @returns {boolean} Whether Gemini is ready to use
 */
const isGeminiConfigured = () => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    return !!(apiKey && apiKey !== 'your-actual-gemini-api-key-here' && genAI);
  } catch (error) {
    return false;
  }
};

/**
 * Get Gemini AI configuration status
 * @returns {Object} Configuration status details
 */
const getGeminiStatus = () => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const hasApiKey = !!(apiKey && apiKey !== 'your-actual-gemini-api-key-here');
    return {
      configured: isGeminiConfigured(),
      hasApiKey,
      hasClient: !!genAI
    };
  } catch (error) {
    return {
      configured: false,
      hasApiKey: false,
      hasClient: !!genAI
    };
  }
};

module.exports = {
  generateContent,
  generateStructuredContent,
  buildBrandVoiceInstructions,
  sanitizeBrandVoiceSettings,
  isGeminiConfigured,
  getGeminiStatus
};