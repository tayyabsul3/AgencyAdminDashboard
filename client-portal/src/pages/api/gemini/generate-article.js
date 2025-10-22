/**
 * API Route: Generate Final Article
 * POST /api/gemini/generate-article
 * 
 * Generates a comprehensive article from interview data
 */

import { withAuth, getUserIdFromRequest } from '../../../middleware/auth';
import { generateFinalArticle } from '../../../services/geminiService';
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
 * Handler for final article generation
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

    // Apply rate limiting (2 requests per minute per user/IP - most restrictive due to complexity)
    checkRateLimit(rateLimitId, 2, 60000);

    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_REQUEST_BODY',
        message: 'Request body must be a valid JSON object'
      }));
    }

    // Sanitize and validate required fields
    const sanitizedBody = sanitizeInput(req.body);
    validateRequiredFields(sanitizedBody, ['topic', 'setup', 'questions']);

    const { topic, setup, questions, articleId } = sanitizedBody;

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

    // Validate setup data
    if (!setup || typeof setup !== 'object') {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_SETUP',
        message: 'Setup data must be an object'
      }));
    }

    if (!setup.expertIntro || typeof setup.expertIntro !== 'object') {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_EXPERT_INTRO',
        message: 'Setup must include expertIntro object'
      }));
    }

    // Validate questions array
    if (!Array.isArray(questions)) {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INVALID_QUESTIONS',
        message: 'Questions must be an array'
      }));
    }

    if (questions.length === 0) {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'NO_QUESTIONS',
        message: 'At least one question is required'
      }));
    }

    // Validate question structure and count answered questions
    let answeredCount = 0;
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      if (!question || typeof question !== 'object') {
        return res.status(400).json(createApiResponse(false, null, {
          code: 'INVALID_QUESTION_STRUCTURE',
          message: `Question at index ${i} must be an object`
        }));
      }

      if (!question.id || !question.question || typeof question.question !== 'string') {
        return res.status(400).json(createApiResponse(false, null, {
          code: 'INVALID_QUESTION_DATA',
          message: `Question at index ${i} must have id and question fields`
        }));
      }

      // Check if question is answered
      if (question.answered && question.answer && typeof question.answer === 'string' && question.answer.trim().length > 0) {
        answeredCount++;
        
        // Validate answer length
        if (question.answer.length > 5000) {
          return res.status(400).json(createApiResponse(false, null, {
            code: 'ANSWER_TOO_LONG',
            message: `Answer for question ${question.id} must be 5000 characters or less`
          }));
        }
      }
    }

    // Require minimum answered questions
    const minAnsweredQuestions = Math.max(1, Math.ceil(questions.length * 0.5)); // At least 50% or 1 question
    if (answeredCount < minAnsweredQuestions) {
      return res.status(400).json(createApiResponse(false, null, {
        code: 'INSUFFICIENT_ANSWERS',
        message: `At least ${minAnsweredQuestions} questions must be answered (currently ${answeredCount} answered)`
      }));
    }

    console.log(`Generating article for topic: "${topic}" with ${answeredCount}/${questions.length} answered questions (User: ${userId || 'anonymous'})`);

    // Prepare article data for generation
    const articleData = {
      topic,
      setup,
      questions
    };

    // Generate final article
    const article = await generateFinalArticle(articleData);

    // Validate response structure
    if (!article || typeof article !== 'object') {
      throw new Error('Invalid response from article generation service');
    }

    if (!article.title || !Array.isArray(article.sections) || !Array.isArray(article.keyTakeaways)) {
      throw new Error('Generated article missing required fields');
    }

    // Validate sections structure
    for (let i = 0; i < article.sections.length; i++) {
      const section = article.sections[i];
      if (!section.type || !section.content) {
        throw new Error(`Invalid section structure at index ${i}`);
      }
    }

    // Add generation metadata
    const responseData = {
      article,
      metadata: {
        topic,
        articleId: articleId || null,
        questionsTotal: questions.length,
        questionsAnswered: answeredCount,
        generatedAt: new Date().toISOString(),
        estimatedReadingTime: article.metadata?.readingTime || Math.ceil(article.sections.length * 2),
        estimatedWordCount: article.metadata?.wordCount || article.sections.length * 200
      }
    };

    // Record successful API response time
    const responseTime = Date.now() - startTime;
    recordApiResponseTime('/api/gemini/generate-article', responseTime, true);

    // Return successful response
    return res.status(200).json(createApiResponse(true, responseData));

  } catch (error) {
    // Record failed API response time and log error
    const responseTime = Date.now() - startTime;
    recordApiResponseTime('/api/gemini/generate-article', responseTime, false);
    logApiError('/api/gemini/generate-article', error, req.body, responseTime);
    
    console.error('Generate article API error:', error);

    // Handle rate limiting errors
    if (error.name === 'RateLimitError') {
      return res.status(429).json(createApiResponse(false, null, {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.'
      }));
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json(handleApiError(error, 'generate-article validation'));
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
    const errorResponse = handleApiError(error, 'generate-article');
    return res.status(500).json(errorResponse);
  }
}

// Create rate-limited handler first, then wrap with auth
const rateLimitedHandler = withRateLimit(handler, {
  windowMs: 900000, // 15 minutes
  maxRequests: 10, // 10 requests per 15 minutes for article generation (more resource intensive)
  message: 'Too many article generation requests. Please try again later.'
});

// Export the handler wrapped with authentication middleware
export default withAuth(rateLimitedHandler);