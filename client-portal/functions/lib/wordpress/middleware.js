/**
 * WordPress API Middleware
 * Provides centralized error handling, logging, and request/response processing
 */

const { defaultLogger } = require('./logger');
const WordPressErrorHandler = require('./errorHandler');
const { defaultRetryHandler } = require('./retryHandler');

/**
 * WordPress Middleware Class
 * Handles request/response processing, error handling, and logging
 */
class WordPressMiddleware {
  /**
   * @param {Object} options - Middleware configuration
   */
  constructor(options = {}) {
    this.options = {
      enableLogging: options.enableLogging !== false,
      enableErrorHandling: options.enableErrorHandling !== false,
      enableRetry: options.enableRetry !== false,
      enableMetrics: options.enableMetrics !== false,
      enableValidation: options.enableValidation !== false,
      ...options
    };
    
    this.logger = options.logger || defaultLogger;
    this.errorHandler = new WordPressErrorHandler(this.logger);
    this.retryHandler = options.retryHandler || defaultRetryHandler;
  }

  /**
   * Create error handling middleware for Express routes
   * @returns {Function} Express middleware function
   */
  createErrorMiddleware() {
    return (error, req, res, next) => {
      const context = this.extractRequestContext(req);
      const handledError = this.errorHandler.handleError(error, context);
      
      // Log the error
      this.logger.error('WordPress API Error', {
        ...context,
        error: handledError.error,
        request: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: req.body
        }
      });
      
      // Send error response
      const statusCode = this.getErrorStatusCode(handledError.error);
      res.status(statusCode).json(handledError);
    };
  }

  /**
   * Create request logging middleware
   * @returns {Function} Express middleware function
   */
  createLoggingMiddleware() {
    return (req, res, next) => {
      if (!this.options.enableLogging) {
        return next();
      }
      
      const startTime = Date.now();
      const context = this.extractRequestContext(req);
      
      // Log incoming request
      this.logger.logRequest({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body
      }, context);
      
      // Override res.json to log response
      const originalJson = res.json;
      res.json = function(body) {
        const duration = Date.now() - startTime;
        
        // Log response
        this.logger.logResponse({
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.getHeaders(),
          data: body
        }, { ...context, duration });
        
        return originalJson.call(this, body);
      }.bind(this);
      
      next();
    };
  }

  /**
   * Create validation middleware
   * @param {Object} schema - Validation schema
   * @returns {Function} Express middleware function
   */
  createValidationMiddleware(schema) {
    return (req, res, next) => {
      if (!this.options.enableValidation) {
        return next();
      }
      
      try {
        const validation = this.validateRequest(req, schema);
        
        if (!validation.valid) {
          const error = new Error('Validation failed');
          error.name = 'ValidationError';
          error.errors = validation.errors;
          error.field = validation.field;
          error.value = validation.value;
          
          return next(error);
        }
        
        // Attach validated data to request
        req.validatedData = validation.data;
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Create authentication middleware
   * @returns {Function} Express middleware function
   */
  createAuthMiddleware() {
    return async (req, res, next) => {
      try {
        const context = this.extractRequestContext(req);
        
        // Extract and verify auth token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          const error = new Error('Authentication required');
          error.code = 'AUTH_REQUIRED';
          return next(error);
        }

        const token = authHeader.split('Bearer ')[1];
        
        // Verify token (this would integrate with Firebase Auth)
        const { getAuth } = require('../firebase-admin');
        const auth = getAuth();
        const decodedToken = await auth.verifyIdToken(token);
        
        // Attach user to request
        req.user = decodedToken;
        
        this.logger.debug('User authenticated', {
          ...context,
          userId: decodedToken.uid
        });
        
        next();
      } catch (error) {
        error.code = error.code || 'AUTH_INVALID';
        next(error);
      }
    };
  }

  /**
   * Create rate limiting middleware
   * @param {Object} options - Rate limiting options
   * @returns {Function} Express middleware function
   */
  createRateLimitMiddleware(options = {}) {
    const {
      windowMs = 60000, // 1 minute
      maxRequests = 100,
      keyGenerator = (req) => req.user?.uid || req.ip
    } = options;
    
    const requests = new Map();
    
    return (req, res, next) => {
      const key = keyGenerator(req);
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Clean old entries
      const userRequests = requests.get(key) || [];
      const recentRequests = userRequests.filter(time => time > windowStart);
      
      if (recentRequests.length >= maxRequests) {
        const error = new Error('Rate limit exceeded');
        error.code = 'RATE_LIMITED';
        error.details = {
          limit: maxRequests,
          windowMs,
          retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
        };
        
        res.set('Retry-After', error.details.retryAfter);
        return next(error);
      }
      
      // Record this request
      recentRequests.push(now);
      requests.set(key, recentRequests);
      
      next();
    };
  }

  /**
   * Wrap WordPress service methods with middleware
   * @param {Object} service - WordPress service instance
   * @returns {Object} Wrapped service
   */
  wrapService(service) {
    const wrappedService = {};
    
    // Get all methods from the service
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(service))
      .filter(name => name !== 'constructor' && typeof service[name] === 'function');
    
    methods.forEach(methodName => {
      wrappedService[methodName] = this.wrapMethod(
        service[methodName].bind(service),
        methodName,
        service
      );
    });
    
    return wrappedService;
  }

  /**
   * Wrap a service method with middleware functionality
   * @param {Function} method - Method to wrap
   * @param {string} methodName - Name of the method
   * @param {Object} service - Service instance
   * @returns {Function} Wrapped method
   */
  wrapMethod(method, methodName, service) {
    return async (...args) => {
      const context = {
        operation: `${service.constructor.name}.${methodName}`,
        service: service.constructor.name,
        method: methodName,
        args: this.sanitizeArgs(args)
      };
      
      try {
        // Execute with retry if enabled
        if (this.options.enableRetry) {
          return await this.retryHandler.executeWithRetry(
            () => method(...args),
            {
              ...context,
              operationName: context.operation,
              circuitBreakerKey: `${service.siteUrl || 'unknown'}_${methodName}`
            }
          );
        } else {
          const timer = this.logger.startOperation(context.operation, context);
          
          try {
            const result = await method(...args);
            timer.end({ success: true });
            return result;
          } catch (error) {
            timer.error(error);
            throw error;
          }
        }
      } catch (error) {
        // Handle error if error handling is enabled
        if (this.options.enableErrorHandling) {
          const handledError = this.errorHandler.handleError(error, context);
          const enhancedError = new Error(handledError.error.message);
          enhancedError.code = handledError.error.code;
          enhancedError.userMessage = handledError.error.userMessage;
          enhancedError.details = handledError.error.details;
          enhancedError.suggestions = handledError.error.details?.suggestions;
          throw enhancedError;
        }
        
        throw error;
      }
    };
  }

  /**
   * Extract request context for logging and error handling
   * @param {Object} req - Express request object
   * @returns {Object} Request context
   */
  extractRequestContext(req) {
    return {
      userId: req.user?.uid,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection?.remoteAddress,
      connectionId: req.params?.connectionId || req.body?.connectionId,
      operation: this.getOperationFromRequest(req)
    };
  }

  /**
   * Get operation name from request
   * @param {Object} req - Express request object
   * @returns {string} Operation name
   */
  getOperationFromRequest(req) {
    const path = req.path || req.url;
    const method = req.method;
    
    // Map common WordPress API paths to operation names
    const operationMap = {
      'POST /wordpress/connect': 'connect_wordpress',
      'GET /wordpress/connections': 'get_connections',
      'DELETE /wordpress/connections': 'delete_connection',
      'GET /wordpress/test': 'test_connection',
      'POST /wordpress/publish': 'publish_article',
      'POST /wordpress/health/check': 'health_check',
      'POST /wordpress/health/retry': 'health_retry'
    };
    
    const key = `${method} ${path.replace(/\/[^\/]+$/, '')}`;
    return operationMap[key] || `${method.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * Validate request against schema
   * @param {Object} req - Express request object
   * @param {Object} schema - Validation schema
   * @returns {Object} Validation result
   */
  validateRequest(req, schema) {
    const errors = [];
    const data = {};
    
    // Validate required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!req.body[field]) {
          errors.push({
            field,
            message: `${field} is required`,
            code: 'REQUIRED_FIELD_MISSING'
          });
        }
      }
    }
    
    // Validate field types and formats
    if (schema.fields) {
      for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
        const value = req.body[fieldName];
        
        if (value !== undefined) {
          const fieldValidation = this.validateField(fieldName, value, fieldSchema);
          if (!fieldValidation.valid) {
            errors.push(...fieldValidation.errors);
          } else {
            data[fieldName] = fieldValidation.value;
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      data,
      field: errors[0]?.field,
      value: errors[0] ? req.body[errors[0].field] : undefined
    };
  }

  /**
   * Validate individual field
   * @param {string} fieldName - Field name
   * @param {*} value - Field value
   * @param {Object} schema - Field schema
   * @returns {Object} Field validation result
   */
  validateField(fieldName, value, schema) {
    const errors = [];
    let processedValue = value;
    
    // Type validation
    if (schema.type) {
      const expectedType = schema.type;
      const actualType = typeof value;
      
      if (expectedType === 'string' && actualType !== 'string') {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be a string`,
          code: 'INVALID_TYPE'
        });
      } else if (expectedType === 'number' && actualType !== 'number') {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be a number`,
          code: 'INVALID_TYPE'
        });
      } else if (expectedType === 'boolean' && actualType !== 'boolean') {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be a boolean`,
          code: 'INVALID_TYPE'
        });
      }
    }
    
    // String validations
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength && value.length < schema.minLength) {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be at least ${schema.minLength} characters`,
          code: 'TOO_SHORT'
        });
      }
      
      if (schema.maxLength && value.length > schema.maxLength) {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be no more than ${schema.maxLength} characters`,
          code: 'TOO_LONG'
        });
      }
      
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        errors.push({
          field: fieldName,
          message: `${fieldName} format is invalid`,
          code: 'INVALID_FORMAT'
        });
      }
      
      // URL validation
      if (schema.format === 'url') {
        try {
          new URL(value);
        } catch {
          errors.push({
            field: fieldName,
            message: `${fieldName} must be a valid URL`,
            code: 'INVALID_URL'
          });
        }
      }
    }
    
    // Transform value if specified
    if (schema.transform && errors.length === 0) {
      try {
        processedValue = schema.transform(value);
      } catch (error) {
        errors.push({
          field: fieldName,
          message: `${fieldName} transformation failed: ${error.message}`,
          code: 'TRANSFORMATION_FAILED'
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      value: processedValue
    };
  }

  /**
   * Get HTTP status code for error
   * @param {Object} error - Error object
   * @returns {number} HTTP status code
   */
  getErrorStatusCode(error) {
    const statusMap = {
      'AUTH_REQUIRED': 401,
      'AUTH_INVALID': 401,
      'AUTH_INVALID_CREDENTIALS': 401,
      'AUTH_EXPIRED_TOKEN': 401,
      'AUTH_INSUFFICIENT_PERMISSIONS': 403,
      'ACCESS_DENIED': 403,
      'CONNECTION_NOT_FOUND': 404,
      'API_NOT_FOUND': 404,
      'NOT_FOUND': 404,
      'MISSING_REQUIRED_FIELDS': 400,
      'MISSING_CONNECTION_ID': 400,
      'INVALID_ARTICLE_DATA': 400,
      'CONTENT_INVALID_FORMAT': 400,
      'CONTENT_TOO_LARGE': 413,
      'RATE_LIMITED': 429,
      'API_RATE_LIMITED': 429,
      'NETWORK_TIMEOUT': 408,
      'VALIDATION_ERROR': 400,
      'METHOD_NOT_ALLOWED': 405
    };
    
    return statusMap[error.code] || 500;
  }

  /**
   * Sanitize method arguments for logging
   * @param {Array} args - Method arguments
   * @returns {Array} Sanitized arguments
   */
  sanitizeArgs(args) {
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        const sanitized = { ...arg };
        
        // Remove sensitive fields
        if (sanitized.password) sanitized.password = '[REDACTED]';
        if (sanitized.applicationPassword) sanitized.applicationPassword = '[REDACTED]';
        if (sanitized.token) sanitized.token = '[REDACTED]';
        
        return sanitized;
      }
      
      return arg;
    });
  }
}

// Create default middleware instance
const defaultMiddleware = new WordPressMiddleware();

module.exports = { WordPressMiddleware, defaultMiddleware };