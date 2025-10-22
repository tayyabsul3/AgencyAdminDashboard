/**
 * API Route: Generate Conversational Response
 * POST /api/gemini/conversational-response
 * 
 * Generates natural follow-up questions and conversational responses based on user responses
 */

import { withAuth, getUserIdFromRequest } from '../../../middleware/auth';
import { generateConversationalResponse } from '../../../services/geminiService';
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
 * In-memory cache for conversational responses to improve performance
 * Cache key format: `${questionId}-${userResponseHash}-${contextHash}`
 */
const conversationCache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes (shorter for conversational responses)
const MAX_CACHE_SIZE = 500;

/**
 * Generate a simple hash for cache key
 * @param {string} text - Text to hash
 * @returns {string} - Hash string
 */
const generateHash = (text) => {
  const str = typeof text === 'string' ? text : JSON.stringify(text);
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
  for (const [key, value] of conversationCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      conversationCache.delete(key);
    }
  }
};

/**
 * Handler for conversational response generation
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

    // Apply rate limiting (15 requests per minute per user/IP - higher for conversational flow)
    checkRateLimit(rateLimitId, 15, 60000);

    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_REQUEST_BODY',
        message: 'Request body must be a valid JSON object'
      }));
    }

    // Sanitize and validate required fields
    const sanitizedBody = sanitizeInput(req.body);
    validateRequiredFields(sanitizedBody, ['question', 'userResponse', 'context']);

    const { question, userResponse, context, needsFollowUp = false } = sanitizedBody;

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

    // Validate user response
    if (typeof userResponse !== 'string' || userResponse.trim().length === 0) {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_USER_RESPONSE',
        message: 'User response must be a non-empty string'
      }));
    }

    if (userResponse.length > 2000) {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'USER_RESPONSE_TOO_LONG',
        message: 'User response must be 2000 characters or less'
      }));
    }

    // Validate context
    if (!context || typeof context !== 'object') {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_CONTEXT',
        message: 'Context must be an object'
      }));
    }

    // Validate needsFollowUp
    if (typeof needsFollowUp !== 'boolean') {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_NEEDS_FOLLOWUP',
        message: 'needsFollowUp must be a boolean'
      }));
    }

    // Check cache first
    const responseHash = generateHash(userResponse);
    const contextHash = generateHash(context);
    const cacheKey = `${question.substring(0, 30)}-${responseHash}-${contextHash}-${needsFollowUp}`;
    
    // Clean expired entries periodically
    if (conversationCache.size > MAX_CACHE_SIZE) {
      cleanCache();
    }

    const cachedResult = conversationCache.get(cacheKey);
    if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_TTL) {
      console.log(`Returning cached conversational response for question: "${question.substring(0, 30)}..." (User: ${userId || 'anonymous'})`);
      
      // Record successful API response time
      const responseTime = Date.now() - startTime;
      recordApiResponseTime('/api/gemini/conversational-response', responseTime, true);
      
      return res.status(200).json(createApiResponse(true, {
        ...cachedResult.response,
        cached: true
      }));
    }

    console.log(`Generating conversational response for question: "${question.substring(0, 30)}..." (User: ${userId || 'anonymous'})`);

    // Generate conversational response
    const result = await generateConversationalResponse(question, userResponse, context, needsFollowUp);

    // Validate response structure
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response from conversational response generation service');
    }

    if (!result.response || typeof result.response !== 'string') {
      throw new Error('Invalid response structure: missing or invalid response field');
    }

    // Validate response length
    if (result.response.length > 200) {
      console.warn('Generated response is longer than expected, truncating');
      result.response = result.response.substring(0, 197) + '...';
    }

    // Ensure boolean fields exist
    const normalizedResult = {
      response: result.response,
      needsMoreDetail: Boolean(result.needsMoreDetail),
      readyForNext: Boolean(result.readyForNext),
      conversationType: result.conversationType || (needsFollowUp ? 'followup' : 'transition')
    };

    // Cache the result
    conversationCache.set(cacheKey, {
      response: normalizedResult,
      timestamp: Date.now()
    });

    // Record successful API response time
    const responseTime = Date.now() - startTime;
    recordApiResponseTime('/api/gemini/conversational-response', responseTime, true);

    // Return successful response
    return res.status(200).json(createApiResponse(true, {
      ...normalizedResult,
      cached: false,
      question: question.substring(0, 50) + (question.length > 50 ? '...' : ''),
      userResponseLength: userResponse.length
    }));

  } catch (error) {
    // Record failed API response time and log error
    const responseTime = Date.now() - startTime;
    recordApiResponseTime('/api/gemini/conversational-response', responseTime, false);
    logApiError('/api/gemini/conversational-response', error, req.body, responseTime);
    
    console.error('Conversational response API error:', error);

    // Handle rate limiting errors
    if (error.name === 'RateLimitError') {
      return res.status(429).json(createApiResponse(false, null, {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.'
      }));
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json(handleApiError(error, 'conversational response validation'));
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
    const errorResponse = handleApiError(error, 'conversational response');
    return res.status(500).json(errorResponse);
  }
}

// Create rate-limited handler first, then wrap with auth
const rateLimitedHandler = withRateLimit(handler, {
  windowMs: 900000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes for conversational endpoints (higher for real-time conversation)
  message: 'Too many conversational requests. Please try again later.'
});

// Export the handler wrapped with authentication middleware
export default withAuth(rateLimitedHandler);