/**
 * API Route: Generate Introduction Questions
 * POST /api/gemini/intro-questions
 * 
 * Generates 1 expert introduction question based on a topic
 */

import { withAuth, getUserIdFromRequest } from '../../../middleware/auth';
import { generateIntroQuestions } from '../../../services/geminiService';
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
 * Handler for intro questions generation
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
    validateRequiredFields(sanitizedBody, ['topic']);

    const { topic } = sanitizedBody;

    // Additional validation for topic
    if (typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_TOPIC',
        message: 'Topic must be a non-empty string'
      }));
    }

    if (topic.length > 200) {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'TOPIC_TOO_LONG',
        message: 'Topic must be 200 characters or less'
      }));
    }

    console.log(`Generating intro questions for topic: "${topic}" (User: ${userId || 'anonymous'})`);

    // Generate introduction questions
    const questions = await generateIntroQuestions(topic);

    // Validate response
    if (!Array.isArray(questions) || questions.length !== 1) {
      throw new Error('Invalid response from question generation service');
    }

    // Record successful API response time
    const responseTime = Date.now() - startTime;
    recordApiResponseTime('/api/gemini/intro-questions', responseTime, true);

    // Return successful response
    return res.status(200).json(createApiResponse(true, {
      questions,
      topic,
      count: questions.length
    }));

  } catch (error) {
    // Record failed API response time and log error
    const responseTime = Date.now() - startTime;
    recordApiResponseTime('/api/gemini/intro-questions', responseTime, false);
    logApiError('/api/gemini/intro-questions', error, req.body, responseTime);
    
    console.error('Intro questions API error:', error);

    // Handle rate limiting errors
    if (error.name === 'RateLimitError') {
      return res.status(429).json(createApiResponse(false, null, {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.'
      }));
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json(handleApiError(error, 'intro-questions validation'));
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
    const errorResponse = handleApiError(error, 'intro-questions');
    return res.status(500).json(errorResponse);
  }
}

// Create rate-limited handler first, then wrap with auth
const rateLimitedHandler = withRateLimit(handler, {
  windowMs: 900000, // 15 minutes
  maxRequests: 20, // 20 requests per 15 minutes for Gemini endpoints
  message: 'Too many AI requests. Please try again later.'
});

// Export the handler wrapped with authentication middleware
export default withAuth(rateLimitedHandler);