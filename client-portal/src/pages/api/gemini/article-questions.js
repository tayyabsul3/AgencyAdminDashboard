/**
 * API Route: Generate Article Questions
 * POST /api/gemini/article-questions
 * 
 * Generates structured interview questions based on topic, count, and expert intro
 */

import { withAuth, getUserIdFromRequest } from '../../../middleware/auth';
import { generateArticleQuestions } from '../../../services/geminiService';
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
 * Handler for article questions generation
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

    // Apply rate limiting (5 requests per minute per user/IP - more restrictive due to complexity)
    checkRateLimit(rateLimitId, 5, 60000);

    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_REQUEST_BODY',
        message: 'Request body must be a valid JSON object'
      }));
    }

    // Sanitize and validate required fields
    const sanitizedBody = sanitizeInput(req.body);
    validateRequiredFields(sanitizedBody, ['topic', 'questionCount', 'expertIntro']);

    const { topic, questionCount, expertIntro } = sanitizedBody;

    // Validate topic
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

    // Validate question count
    if (typeof questionCount !== 'number' || !Number.isInteger(questionCount)) {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_QUESTION_COUNT',
        message: 'Question count must be an integer'
      }));
    }

    if (questionCount < 5 || questionCount > 40) {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'QUESTION_COUNT_OUT_OF_RANGE',
        message: 'Question count must be between 5 and 40'
      }));
    }

    // Validate expert intro
    if (!expertIntro || typeof expertIntro !== 'object') {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_EXPERT_INTRO',
        message: 'Expert intro must be an object'
      }));
    }

    // Validate expert intro has required question-answer pairs (now expecting only 1)
    const requiredIntroFields = ['question1', 'answer1'];
    const missingIntroFields = requiredIntroFields.filter(field => 
      !(field in expertIntro) || 
      typeof expertIntro[field] !== 'string' || 
      expertIntro[field].trim().length === 0
    );

    if (missingIntroFields.length > 0) {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INCOMPLETE_EXPERT_INTRO',
        message: `Expert intro is missing or has empty fields: ${missingIntroFields.join(', ')}`
      }));
    }

    // Validate intro answer lengths (reasonable limits)
    for (const field of requiredIntroFields) {
      if (field.startsWith('answer') && expertIntro[field].length > 2000) {
        return res.status(400).json(createApiResponse(false, null, {
          code: 'INTRO_ANSWER_TOO_LONG',
          message: `${field} must be 2000 characters or less`
        }));
      }
    }

    console.log(`Generating ${questionCount} article questions for topic: "${topic}" (User: ${userId || 'anonymous'})`);

    // Generate article questions
    const result = await generateArticleQuestions(topic, questionCount, expertIntro);

    // Validate response structure
    if (!result || !result.sections || !Array.isArray(result.sections)) {
      throw new Error('Invalid response from article questions generation service');
    }

    // Count total questions for validation
    const totalQuestions = result.sections.reduce((total, section) => {
      return total + (section.questions ? section.questions.length : 0);
    }, 0);

    // Validate sections structure
    for (const section of result.sections) {
      if (!section.title || !section.questions || !Array.isArray(section.questions)) {
        throw new Error('Invalid section structure in generated questions');
      }

      for (const question of section.questions) {
        if (!question.id || !question.question || typeof question.question !== 'string') {
          throw new Error('Invalid question structure in generated questions');
        }
      }
    }

    // Record successful API response time
    const responseTime = Date.now() - startTime;
    recordApiResponseTime('/api/gemini/article-questions', responseTime, true);

    // Return successful response
    return res.status(200).json(createApiResponse(true, {
      sections: result.sections,
      topic,
      requestedCount: questionCount,
      actualCount: totalQuestions,
      sectionCount: result.sections.length
    }));

  } catch (error) {
    // Record failed API response time and log error
    const responseTime = Date.now() - startTime;
    recordApiResponseTime('/api/gemini/article-questions', responseTime, false);
    logApiError('/api/gemini/article-questions', error, req.body, responseTime);
    
    console.error('Article questions API error:', error);

    // Handle rate limiting errors
    if (error.name === 'RateLimitError') {
      return res.status(429).json(createApiResponse(false, null, {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.'
      }));
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json(handleApiError(error, 'article-questions validation'));
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
    const errorResponse = handleApiError(error, 'article-questions');
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