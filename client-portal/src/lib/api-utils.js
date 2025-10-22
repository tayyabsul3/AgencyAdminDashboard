/**
 * API utilities for handling requests and responses
 * Common functions used across API routes
 */

/**
 * Standard API response format
 */
export const createApiResponse = (success, data = null, error = null) => {
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
export const handleApiError = (error, context = '') => {
  console.error(`API Error ${context}:`, error);
  
  // Determine error type and create appropriate response
  if (error.name === 'ValidationError') {
    return createApiResponse(false, null, {
      code: 'VALIDATION_ERROR',
      message: error.message,
      details: error.details || null
    });
  }
  
  if (error.code === 'auth/unauthenticated') {
    return createApiResponse(false, null, {
      code: 'UNAUTHENTICATED',
      message: 'User not authenticated'
    });
  }
  
  if (error.code === 'permission-denied') {
    return createApiResponse(false, null, {
      code: 'PERMISSION_DENIED',
      message: 'Insufficient permissions'
    });
  }
  
  // Generic error
  return createApiResponse(false, null, {
    code: 'INTERNAL_ERROR',
    message: error.message || 'An unexpected error occurred'
  });
};

/**
 * Validate request method
 */
export const validateMethod = (req, allowedMethods) => {
  if (!allowedMethods.includes(req.method)) {
    throw new Error(`Method ${req.method} not allowed. Allowed methods: ${allowedMethods.join(', ')}`);
  }
};

/**
 * Validate required fields in request body
 */
export const validateRequiredFields = (body, requiredFields) => {
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
export const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
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

export const checkRateLimit = (identifier, maxRequests = 100, windowMs = 60000) => {
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
export const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         'unknown';
};