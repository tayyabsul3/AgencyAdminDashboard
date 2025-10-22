/**
 * API Route: Generate Suggestive Answers
 * POST /api/gemini/generate-suggestions
 * 
 * Generates personalized conversation starters based on expert intro and question context
 */

import { withAuth, getUserIdFromRequest } from '../../../middleware/auth';
import { generateQuestionSuggestions } from '../../../services/geminiService';
import { withRateLimit } from '../../../middleware/rateLimiting';
import { recordApiResponseTime, logApiError } from '../../../utils/monitoring';
import { 
  createApiResponse, 
  handleApiError, 
  validateMethod, 
  validateRequiredFields,
  sanitizeInput,
  checkRateLimit,
  getClientIP
} from '../../../lib/api-utils';

/**
 * In-memory cache for suggestions to improve performance
 * Cache key format: `${questionId}-${expertIntroHash}`
 */
const suggestionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

/**
 * Generate a simple hash for cache key
 * @param {Object} expertIntro - Expert introduction data
 * @returns {string} - Hash string
 */
const generateHash = (expertIntro) => {
  const str = JSON.stringify(expertIntro);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
};

/**
 * Clean expired cache entries
 */
const cleanCache = () => {
  const now = Date.now();
  for (const [key, value] of suggestionCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      suggestionCache.delete(key);
    }
  }
};

/**
 * Handler for suggestion generation
 * @param {Request} req - Request object
 * @param {Response} res - Response object
 */
async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    // Validate HTTP method
    validateMethod(req, ['POST']);

    // Get user ID for rate limiting and logging
    const userId = getUserIdFromRequest(req);
    const clientIP = getClientIP(req);
    const rateLimitId = userId || clientIP;

    // Apply rate limiting (10 requests per minute per user/IP)
    checkRateLimit(rateLimitId, 10, 60000);

    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_REQUEST_BODY',
        message: 'Request body must be a valid JSON object'
      }));
    }

    // Sanitize and validate required fields
    const sanitizedBody = sanitizeInput(req.body);
    validateRequiredFields(sanitizedBody, ['question', 'expertIntro']);

    const { question, expertIntro, context = {} } = sanitizedBody;

    // Validate question
    if (typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_QUESTION',
        message: 'Question must be a non-empty string'
      }));
    }

    if (question.length > 500) {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'QUESTION_TOO_LONG',
        message: 'Question must be 500 characters or less'
      }));
    }

    // Validate expert intro
    if (!expertIntro || typeof expertIntro !== 'object') {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_EXPERT_INTRO',
        message: 'Expert intro must be an object'
      }));
    }

    // Validate context if provided
    if (context && typeof context !== 'object') {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_CONTEXT',
        message: 'Context must be an object'
      }));
    }

    // Check cache first
    const expertHash = generateHash(expertIntro);
    const cacheKey = `${question.substring(0, 50)}-${expertHash}`;
    
    // Clean expired entries periodically
    if (suggestionCache.size > MAX_CACHE_SIZE) {
      cleanCache();
    }

    const cachedResult = suggestionCache.get(cacheKey);
    if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_TTL) {
      console.log(`Returning cached suggestions for question: "${question.substring(0, 50)}..." (User: ${userId || 'anonymous'})`);
      
      // Record successful API response time
      const responseTime = Date.now() - startTime;
      recordApiResponseTime('/api/gemini/generate-suggestions', responseTime, true);
      
      return res.status(200).json(createApiResponse(true, {
        suggestions: cachedResult.suggestions,
        cached: true,
        question: question.substring(0, 100) + (question.length > 100 ? '...' : '')
      }));
    }

    console.log(`Generating suggestions for question: "${question.substring(0, 50)}..." (User: ${userId || 'anonymous'})`);

    // Generate suggestions
    const result = await generateQuestionSuggestions(question, expertIntro, context);

    // Validate response structure
    if (!result || !result.suggestions || !Array.isArray(result.suggestions)) {
      throw new Error('Invalid response from suggestion generation service');
    }

    // Validate suggestions
    const validSuggestions = result.suggestions.filter(suggestion => 
      typeof suggestion === 'string' && 
      suggestion.trim().length > 0 && 
      suggestion.length <= 100
    );

    if (validSuggestions.length < 3) {
      throw new Error('Insufficient valid suggestions generated');
    }

    // Cache the result
    suggestionCache.set(cacheKey, {
      suggestions: validSuggestions,
      timestamp: Date.now()
    });

    // Record successful API response time
    const responseTime = Date.now() - startTime;
    recordApiResponseTime('/api/gemini/generate-suggestions', responseTime, true);

    // Return successful response
    return res.status(200).json(createApiResponse(true, {
      suggestions: validSuggestions,
      cached: false,
      question: question.substring(0, 100) + (question.length > 100 ? '...' : ''),
      suggestionCount: validSuggestions.length
    }));

  } catch (error) {
    // Record failed API response time and log error
    const responseTime = Date.now() - startTime;
    recordApiResponseTime('/api/gemini/generate-suggestions', responseTime, false);
    logApiError('/api/gemini/generate-suggestions', error, req.body, responseTime);
    
    console.error('Suggestion generation API error:', error);

    // Handle rate limiting errors
    if (error.name === 'RateLimitError') {
      return res.status(429).json(createApiResponse(false, null, {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.'
      }));
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json(handleApiError(error, 'suggestion generation validation'));
    }

    // Handle authentication/permission errors
    if (error.message.toLowerCase().includes('authentication') || 
        error.message.toLowerCase().includes('permission')) {
      return res.status(403).json(createApiResponse(false, null, {
        code: 'SERVICE_UNAVAILABLE',
        message: 'AI service is currently unavailable. Please try again later.'
      }));
    }

    // Handle quota exceeded errors
    if (error.message.toLowerCase().includes('quota exceeded')) {
      return res.status(503).json(createApiResponse(false, null, {
        code: 'QUOTA_EXCEEDED',
        message: 'Service quota exceeded. Please try again later.'
      }));
    }

    // Handle method not allowed
    if (error.message.includes('Method') && error.message.includes('not allowed')) {
      return res.status(405).json(createApiResponse(false, null, {
        code: 'METHOD_NOT_ALLOWED',
        message: error.message
      }));
    }

    // Generic error handling
    const errorResponse = handleApiError(error, 'suggestion generation');
    return res.status(500).json(errorResponse);
  }
}

// Create rate-limited handler first, then wrap with auth
const rateLimitedHandler = withRateLimit(handler, {
  windowMs: 900000, // 15 minutes
  maxRequests: 50, // 50 requests per 15 minutes for suggestion endpoints (higher than other Gemini endpoints)
  message: 'Too many suggestion requests. Please try again later.'
});

// Export the handler wrapped with authentication middleware
export default withAuth(rateLimitedHandler);