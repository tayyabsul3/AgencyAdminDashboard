/**
 * API utilities for Firebase Functions
 * Common functions used across API routes
 */

/**
 * Standard API response format
 */
const createApiResponse = (success, data = null, error = null) => {
  return {
    success,
    data,
    error,
    timestamp: new Date().toISOString()
  };
};

/**
 * Handle API errors consistently
 */
const handleApiError = (error, context = '') => {
  console.error(`API Error ${context}:`, error);
  
  // Determine error type and create appropriate response
  if (error.name === 'ValidationError') {
    return {
      status: 400,
      response: createApiResponse(false, null, {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.details || null
      })
    };
  }
  
  if (error.code === 'auth/unauthenticated') {
    return {
      status: 401,
      response: createApiResponse(false, null, {
        code: 'UNAUTHENTICATED',
        message: 'User not authenticated'
      })
    };
  }
  
  if (error.code === 'permission-denied') {
    return {
      status: 403,
      response: createApiResponse(false, null, {
        code: 'PERMISSION_DENIED',
        message: 'Insufficient permissions'
      })
    };
  }
  
  if (error.message && error.message.includes('Rate limit')) {
    return {
      status: 429,
      response: createApiResponse(false, null, {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests'
      })
    };
  }
  
  // Generic error
  return {
    status: 500,
    response: createApiResponse(false, null, {
      code: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred'
    })
  };
};

/**
 * Validate request method
 */
const validateMethod = (req, allowedMethods) => {
  if (!allowedMethods.includes(req.method)) {
    const error = new Error(`Method ${req.method} not allowed. Allowed methods: ${allowedMethods.join(', ')}`);
    error.name = 'ValidationError';
    throw error;
  }
};

/**
 * Validate required fields in request body
 */
const validateRequiredFields = (body, requiredFields) => {
  const missing = requiredFields.filter(field => !(field in body) || body[field] === null || body[field] === undefined);
  
  if (missing.length > 0) {
    const error = new Error(`Missing required fields: ${missing.join(', ')}`);
    error.name = 'ValidationError';
    error.details = { missing };
    throw error;
  }
};

/**
 * Sanitize input data
 */
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim();
  }
  
  // Preserve arrays: sanitize each element but keep Array type
  if (Array.isArray(input)) {
    return input.map((value) => sanitizeInput(value));
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
};

/**
 * Rate limiting helper (basic implementation)
 */
const requestCounts = new Map();

const checkRateLimit = (identifier, maxRequests = 100, windowMs = 60000) => {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Clean old entries
  for (const [key, requests] of requestCounts.entries()) {
    requestCounts.set(key, requests.filter(time => time > windowStart));
    if (requestCounts.get(key).length === 0) {
      requestCounts.delete(key);
    }
  }
  
  // Check current requests
  const currentRequests = requestCounts.get(identifier) || [];
  
  if (currentRequests.length >= maxRequests) {
    const error = new Error('Rate limit exceeded');
    error.name = 'RateLimitError';
    throw error;
  }
  
  // Add current request
  currentRequests.push(now);
  requestCounts.set(identifier, currentRequests);
};

/**
 * Get client IP address
 */
const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         'unknown';
};

/**
 * Send standardized API response
 */
const sendResponse = (res, status, success, data = null, error = null) => {
  res.status(status).json(createApiResponse(success, data, error));
};

module.exports = {
  createApiResponse,
  handleApiError,
  validateMethod,
  validateRequiredFields,
  sanitizeInput,
  checkRateLimit,
  getClientIP,
  sendResponse
};