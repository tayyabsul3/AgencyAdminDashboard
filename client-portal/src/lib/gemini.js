import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI client
let genAI;
let model;

// Initialize Gemini client (works in both Next.js and Firebase Functions)
const initializeGemini = () => {
  if (genAI && model) return { genAI, model }; // Already initialized
  
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not found in environment variables');
      return { genAI: null, model: null };
    }
    
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    return { genAI, model };
  } catch (error) {
    console.error('Gemini AI initialization error:', error);
    return { genAI: null, model: null };
  }
};

// Initialize on module load
const { genAI: initialGenAI, model: initialModel } = initializeGemini();
genAI = initialGenAI;
model = initialModel;

/**
 * Generate content using Gemini AI
 * @param {string} prompt - The prompt to send to Gemini
 * @param {Object} options - Additional options for generation
 * @returns {Promise<string>} Generated content
 */
export const generateContent = async (prompt, options = {}) => {
  // Ensure Gemini is initialized (important for Firebase Functions)
  const { model: currentModel } = initializeGemini();
  
  if (!currentModel) {
    throw new Error('Gemini AI not initialized. Please check your API key.');
  }

  try {
    const result = await currentModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini content generation error:', error);
    throw new Error(`Failed to generate content: ${error.message}`);
  }
};

/**
 * Generate structured JSON content using Gemini AI
 * @param {string} prompt - The prompt to send to Gemini
 * @param {Object} schema - Expected JSON schema for validation
 * @returns {Promise<Object>} Parsed JSON response
 */
export const generateStructuredContent = async (prompt, schema = null) => {
  // Ensure Gemini is initialized (important for Firebase Functions)
  const { model: currentModel } = initializeGemini();
  
  if (!currentModel) {
    throw new Error('Gemini AI not initialized. Please check your API key.');
  }

  try {
    const result = await currentModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Try to parse as JSON
    try {
      const jsonResponse = JSON.parse(text);
      
      // Basic schema validation if provided
      if (schema && !validateSchema(jsonResponse, schema)) {
        throw new Error('Response does not match expected schema');
      }
      
      return jsonResponse;
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', text);
      throw new Error(`Invalid JSON response from Gemini: ${parseError.message}`);
    }
  } catch (error) {
    console.error('Gemini structured content generation error:', error);
    throw new Error(`Failed to generate structured content: ${error.message}`);
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
export const isGeminiConfigured = () => {
  return !!(genAI && model && process.env.GEMINI_API_KEY);
};

/**
 * Get Gemini AI configuration status
 * @returns {Object} Configuration status details
 */
export const getGeminiStatus = () => {
  return {
    configured: isGeminiConfigured(),
    hasApiKey: !!process.env.GEMINI_API_KEY,
    hasClient: !!genAI,
    hasModel: !!model
  };
};

export { genAI, model };