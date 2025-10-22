/**
 * API Rate Limiting Middleware
 * Implements rate limiting for API endpoints to prevent abuse
 */

import { ENV } from '../config/environment';
import { logError } from '../utils/monitoring';

// In-memory store for development (use Redis in production)
const rateLimitStore = new Map();

// Rate limit configurations
const RATE_LIMITS = {
  // Gemini API endpoints (more restrictive due to external API costs)
  '/api/gemini/': {
    windowMs: ENV.RATE_LIMIT.windowMs, // 15 minutes
    maxRequests: 20, // 20 requests per 15 minutes
    message: 'Too many AI requests. Please try again later.',
    skipFailedRequests: true
  },
  
  // General API endpoints
  '/api/': {
    windowMs: ENV.RATE_LIMIT.windowMs,
    maxRequests: ENV.RATE_LIMIT.maxRequests, // 100 requests per 15 minutes
    message: 'Too many requests. Please try again later.',
    skipFailedRequests: ENV.RATE_LIMIT.skipFailedRequests
  },
  
  // Monitoring endpoints (less restrictive)
  '/api/monitoring/': {
    windowMs: 60000, // 1 minute
    maxRequests: 50, // 50 requests per minute
    message: 'Monitoring rate limit exceeded.',
    skipFailedRequests: true
  }
};

export function createRateLimiter(config = {}) {
  const {
    windowMs = 900000, // 15 minutes
    maxRequests = 100,
    message = 'Too many requests',
    skipFailedRequests = false,
    keyGenerator = defaultKeyGenerator,
    skip = () => false,
    onLimitReached = null
  } = config;
  
  return async (req, res, next) => {
    try {
      // Skip rate limiting if specified
      if (skip(req)) {
        return next ? next() : true;
      }
      
      // Generate unique key for this client
      const key = keyGenerator(req);
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Get or create rate limit data for this key
      let rateLimitData = rateLimitStore.get(key) || {
        requests: [],
        totalRequests: 0
      };
      
      // Clean up old requests outside the window
      rateLimitData.requests = rateLimitData.requests.filter(
        timestamp => timestamp > windowStart
      );
      
      // Check if limit is exceeded
      if (rateLimitData.requests.length >= maxRequests) {
        // Log rate limit violation
        logError(new Error('Rate limit exceeded'), {
          type: 'rate_limit_exceeded',
          key,
          requestCount: rateLimitData.requests.length,
          maxRequests,
          windowMs,
          endpoint: req.url,
          method: req.method,
          userAgent: req.headers['user-agent'],
          ip: getClientIP(req)
        });
        
        // Call onLimitReached callback if provided
        if (onLimitReached) {
          onLimitReached(req, res);
        }
        
        // Set rate limit headers
        setRateLimitHeaders(res, {
          limit: maxRequests,
          remaining: 0,
          reset: Math.ceil((Math.min(...rateLimitData.requests) + windowMs) / 1000),
          retryAfter: Math.ceil(windowMs / 1000)
        });
        
        if (res) {
          return res.status(429).json({
            success: false,
            error: message,
            retryAfter: Math.ceil(windowMs / 1000)
          });
        }
        
        return false;
      }
      
      // Add current request to the list
      rateLimitData.requests.push(now);
      rateLimitData.totalRequests++;
      
      // Update store
      rateLimitStore.set(key, rateLimitData);
      
      // Set rate limit headers
      const remaining = Math.max(0, maxRequests - rateLimitData.requests.length);
      const oldestRequest = Math.min(...rateLimitData.requests);
      const reset = Math.ceil((oldestRequest + windowMs) / 1000);
      
      if (res) {
        setRateLimitHeaders(res, {
          limit: maxRequests,
          remaining,
          reset,
          retryAfter: remaining === 0 ? Math.ceil(windowMs / 1000) : null
        });
      }
      
      // Continue to next middleware or handler
      if (next) {
        next();
      }
      
      return true;
      
    } catch (error) {
      logError(error, {
        type: 'rate_limiter_error',
        endpoint: req.url
      });
      
      // On error, allow the request to proceed
      if (next) {
        next();
      }
      return true;
    }
  };
}

function defaultKeyGenerator(req) {
  // Use user ID if authenticated, otherwise use IP
  const userId = req.user?.uid || req.headers['x-user-id'];
  const ip = getClientIP(req);
  
  return userId ? `user:${userId}` : `ip:${ip}`;
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}

function setRateLimitHeaders(res, { limit, remaining, reset, retryAfter }) {
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', reset);
  
  if (retryAfter) {
    res.setHeader('Retry-After', retryAfter);
  }
}

// Middleware factory for different endpoint types
export function createAPIRateLimiter(endpoint) {
  // Find the most specific rate limit configuration
  const config = Object.entries(RATE_LIMITS)
    .filter(([pattern]) => endpoint.startsWith(pattern))
    .sort((a, b) => b[0].length - a[0].length)[0]; // Most specific first
  
  if (config) {
    const [, rateLimitConfig] = config;
    return createRateLimiter(rateLimitConfig);
  }
  
  // Default rate limiter
  return createRateLimiter(RATE_LIMITS['/api/']);
}

// Express-style middleware wrapper
export function rateLimitMiddleware(req, res, next) {
  const limiter = createAPIRateLimiter(req.url);
  return limiter(req, res, next);
}

// Next.js API route wrapper
export function withRateLimit(handler, customConfig = {}) {
  return async (req, res) => {
    const limiter = createRateLimiter(customConfig);
    const allowed = await limiter(req, res);
    
    if (allowed) {
      return handler(req, res);
    }
    // Response already sent by rate limiter
  };
}

// Utility functions for monitoring
export function getRateLimitStats() {
  const stats = {
    totalKeys: rateLimitStore.size,
    keyBreakdown: {},
    totalRequests: 0
  };
  
  for (const [key, data] of rateLimitStore.entries()) {
    const keyType = key.startsWith('user:') ? 'user' : 'ip';
    if (!stats.keyBreakdown[keyType]) {
      stats.keyBreakdown[keyType] = 0;
    }
    stats.keyBreakdown[keyType]++;
    stats.totalRequests += data.totalRequests;
  }
  
  return stats;
}

export function clearRateLimitData(key = null) {
  if (key) {
    rateLimitStore.delete(key);
  } else {
    rateLimitStore.clear();
  }
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = Math.max(...Object.values(RATE_LIMITS).map(config => config.windowMs));
  
  for (const [key, data] of rateLimitStore.entries()) {
    const oldestRequest = Math.min(...data.requests);
    if (now - oldestRequest > maxAge) {
      rateLimitStore.delete(key);
    }
  }
}, 300000); // Clean up every 5 minutes

export default rateLimitMiddleware;