/**
 * Centralized Error Handling for WordPress Operations
 * Provides structured error handling, logging, and user-friendly error messages
 */

const { ERROR_CODES } = require('./constants');

/**
 * WordPress Error Handler Class
 * Centralizes error handling logic for all WordPress operations
 */
class WordPressErrorHandler {
  /**
   * @param {Object} logger - Logger instance (optional)
   */
  constructor(logger = console) {
    this.logger = logger;
  }

  /**
   * Handle and format WordPress API errors
   * @param {Error} error - Original error object
   * @param {Object} context - Additional context for error handling
   * @returns {Object} Standardized error response
   */
  handleError(error, context = {}) {
    const errorId = this.generateErrorId();
    const timestamp = new Date().toISOString();
    
    // Log the error with full context
    this.logError(error, { ...context, errorId, timestamp });
    
    // Determine error type and create standardized response
    const standardizedError = this.standardizeError(error, context);
    
    return {
      success: false,
      error: {
        ...standardizedError,
        errorId,
        timestamp
      }
    };
  }

  /**
   * Standardize error format based on error type
   * @param {Error} error - Original error
   * @param {Object} context - Error context
   * @returns {Object} Standardized error object
   */
  standardizeError(error, context = {}) {
    // Handle Axios HTTP errors
    if (error.response) {
      return this.handleHttpError(error, context);
    }
    
    // Handle network errors
    if (error.code) {
      return this.handleNetworkError(error, context);
    }
    
    // Handle WordPress-specific errors
    if (error.code && Object.values(ERROR_CODES).includes(error.code)) {
      return this.handleWordPressError(error, context);
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return this.handleValidationError(error, context);
    }
    
    // Handle generic errors
    return this.handleGenericError(error, context);
  }

  /**
   * Handle HTTP response errors from WordPress API
   * @param {Error} error - Axios error with response
   * @param {Object} context - Error context
   * @returns {Object} Standardized error
   */
  handleHttpError(error, context) {
    const status = error.response.status;
    const data = error.response.data;
    const url = error.config?.url || 'unknown';
    
    switch (status) {
      case 400:
        return {
          code: ERROR_CODES.CONTENT_INVALID_FORMAT,
          message: this.extractWordPressErrorMessage(data) || 'Invalid request data',
          userMessage: 'The request contains invalid data. Please check your input and try again.',
          details: {
            status,
            url,
            wpError: data,
            suggestions: this.getValidationSuggestions(data)
          }
        };
        
      case 401:
        return {
          code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
          message: 'Authentication failed',
          userMessage: 'Your WordPress credentials are invalid or have expired. Please check your username and application password.',
          details: {
            status,
            url,
            wpError: data,
            suggestions: [
              'Verify your WordPress username is correct',
              'Check that your Application Password is still valid',
              'Regenerate your Application Password in WordPress admin'
            ]
          }
        };
        
      case 403:
        return {
          code: ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
          message: 'Insufficient permissions',
          userMessage: 'Your WordPress account does not have sufficient permissions for this operation.',
          details: {
            status,
            url,
            wpError: data,
            suggestions: [
              'Ensure your WordPress user has Editor or Administrator role',
              'Check if any security plugins are blocking API access',
              'Contact your site administrator for permission assistance'
            ]
          }
        };
        
      case 404:
        return {
          code: ERROR_CODES.API_NOT_FOUND,
          message: 'WordPress REST API endpoint not found',
          userMessage: 'The WordPress REST API is not available or the endpoint was not found.',
          details: {
            status,
            url,
            wpError: data,
            suggestions: [
              'Ensure WordPress REST API is enabled',
              'Check if any security plugins are blocking API access',
              'Verify your WordPress version supports REST API (5.0+)'
            ]
          }
        };
        
      case 413:
        return {
          code: ERROR_CODES.CONTENT_TOO_LARGE,
          message: 'Content too large',
          userMessage: 'The content you are trying to publish is too large for WordPress to handle.',
          details: {
            status,
            url,
            wpError: data,
            suggestions: [
              'Reduce the size of your content',
              'Split large articles into multiple posts',
              'Contact your hosting provider about upload limits'
            ]
          }
        };
        
      case 429:
        return {
          code: ERROR_CODES.API_RATE_LIMITED,
          message: 'Rate limit exceeded',
          userMessage: 'Too many requests have been made to WordPress. Please wait before trying again.',
          details: {
            status,
            url,
            wpError: data,
            retryAfter: error.response.headers['retry-after'],
            suggestions: [
              'Wait a few minutes before trying again',
              'Check if your hosting provider has API rate limits',
              'Consider upgrading your hosting plan if limits are restrictive'
            ]
          }
        };
        
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          code: 'SERVER_ERROR',
          message: 'WordPress server error',
          userMessage: 'WordPress is experiencing server issues. This is usually temporary.',
          details: {
            status,
            url,
            wpError: data,
            retryable: true,
            suggestions: [
              'Try again in a few minutes',
              'Check your hosting provider status page',
              'Contact your hosting provider if the issue persists'
            ]
          }
        };
        
      default:
        return {
          code: 'HTTP_ERROR',
          message: `HTTP ${status} error`,
          userMessage: 'An unexpected error occurred while communicating with WordPress.',
          details: {
            status,
            url,
            wpError: data,
            suggestions: [
              'Try the operation again',
              'Check your WordPress site status',
              'Contact support if the issue persists'
            ]
          }
        };
    }
  }

  /**
   * Handle network-level errors
   * @param {Error} error - Network error
   * @param {Object} context - Error context
   * @returns {Object} Standardized error
   */
  handleNetworkError(error, context) {
    switch (error.code) {
      case 'ENOTFOUND':
      case 'ECONNREFUSED':
        return {
          code: ERROR_CODES.NETWORK_UNREACHABLE,
          message: 'WordPress site is not reachable',
          userMessage: 'Unable to connect to your WordPress site. Please check the site URL and try again.',
          details: {
            networkError: error.code,
            hostname: error.hostname,
            suggestions: [
              'Verify the WordPress site URL is correct',
              'Check that the site is online and accessible',
              'Ensure there are no firewall restrictions'
            ]
          }
        };
        
      case 'ETIMEDOUT':
        return {
          code: ERROR_CODES.NETWORK_TIMEOUT,
          message: 'Connection to WordPress site timed out',
          userMessage: 'The connection to WordPress took too long. This might be due to slow server response.',
          details: {
            networkError: error.code,
            timeout: error.timeout,
            retryable: true,
            suggestions: [
              'Try again in a few minutes',
              'Check if your WordPress site is experiencing high load',
              'Contact your hosting provider if timeouts persist'
            ]
          }
        };
        
      case 'CERT_HAS_EXPIRED':
      case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
        return {
          code: ERROR_CODES.NETWORK_SSL_ERROR,
          message: 'SSL certificate error',
          userMessage: 'There is an issue with your WordPress site\'s SSL certificate.',
          details: {
            networkError: error.code,
            suggestions: [
              'Contact your hosting provider about SSL certificate issues',
              'Verify your site URL uses the correct protocol (https/http)',
              'Check if your SSL certificate has expired'
            ]
          }
        };
        
      default:
        return {
          code: 'NETWORK_ERROR',
          message: `Network error: ${error.code}`,
          userMessage: 'A network error occurred while connecting to WordPress.',
          details: {
            networkError: error.code,
            suggestions: [
              'Check your internet connection',
              'Verify the WordPress site is accessible',
              'Try again in a few minutes'
            ]
          }
        };
    }
  }

  /**
   * Handle WordPress-specific errors
   * @param {Error} error - WordPress error
   * @param {Object} context - Error context
   * @returns {Object} Standardized error
   */
  handleWordPressError(error, context) {
    const userMessages = {
      [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: 'Your WordPress login credentials are incorrect or have expired.',
      [ERROR_CODES.AUTH_EXPIRED_TOKEN]: 'Your WordPress application password has expired and needs to be regenerated.',
      [ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS]: 'Your WordPress account lacks the necessary permissions for this action.',
      [ERROR_CODES.API_NOT_FOUND]: 'The WordPress REST API is not available on your site.',
      [ERROR_CODES.API_VERSION_INCOMPATIBLE]: 'Your WordPress version is not compatible with this integration.',
      [ERROR_CODES.CONTENT_INVALID_FORMAT]: 'The content format is not valid for WordPress.',
      [ERROR_CODES.CONTENT_TOO_LARGE]: 'The content is too large to be published to WordPress.',
      [ERROR_CODES.CONTENT_MISSING_REQUIRED]: 'Required content fields are missing.'
    };

    return {
      code: error.code,
      message: error.message,
      userMessage: userMessages[error.code] || 'A WordPress-related error occurred.',
      details: {
        ...error.details,
        suggestions: this.getErrorSuggestions(error.code)
      }
    };
  }

  /**
   * Handle validation errors
   * @param {Error} error - Validation error
   * @param {Object} context - Error context
   * @returns {Object} Standardized error
   */
  handleValidationError(error, context) {
    return {
      code: ERROR_CODES.CONTENT_INVALID_FORMAT,
      message: 'Validation failed',
      userMessage: 'The provided data failed validation. Please check the required fields and formats.',
      details: {
        validationErrors: error.errors || [],
        field: error.field,
        value: error.value,
        suggestions: [
          'Check that all required fields are provided',
          'Verify data formats match the expected types',
          'Review the API documentation for field requirements'
        ]
      }
    };
  }

  /**
   * Handle generic errors
   * @param {Error} error - Generic error
   * @param {Object} context - Error context
   * @returns {Object} Standardized error
   */
  handleGenericError(error, context) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      userMessage: 'An unexpected error occurred. Please try again or contact support if the issue persists.',
      details: {
        originalError: error.toString(),
        stack: error.stack,
        suggestions: [
          'Try the operation again',
          'Check your input data for any issues',
          'Contact support with the error details if the problem continues'
        ]
      }
    };
  }

  /**
   * Extract error message from WordPress API response
   * @param {Object} wpData - WordPress API error response
   * @returns {string|null} Extracted error message
   */
  extractWordPressErrorMessage(wpData) {
    if (!wpData) return null;
    
    // WordPress REST API error format
    if (wpData.message) return wpData.message;
    
    // WordPress error with code and message
    if (wpData.code && wpData.message) {
      return wpData.message; // Just return the message, not the code prefix
    }
    
    // Array of errors
    if (Array.isArray(wpData) && wpData.length > 0) {
      return wpData.map(err => err.message || err).join(', ');
    }
    
    return null;
  }

  /**
   * Get validation suggestions based on WordPress error data
   * @param {Object} wpData - WordPress error data
   * @returns {Array} Array of suggestion strings
   */
  getValidationSuggestions(wpData) {
    const suggestions = [];
    
    if (wpData && wpData.code) {
      switch (wpData.code) {
        case 'rest_invalid_param':
          suggestions.push('Check that all parameters have valid values');
          suggestions.push('Verify required fields are not empty');
          break;
        case 'rest_missing_callback_param':
          suggestions.push('Ensure all required parameters are provided');
          break;
        case 'rest_invalid_json':
          suggestions.push('Check that the request contains valid JSON');
          break;
        default:
          suggestions.push('Review the WordPress REST API documentation');
      }
    }
    
    return suggestions.length > 0 ? suggestions : [
      'Verify your input data is correct',
      'Check the WordPress REST API documentation'
    ];
  }

  /**
   * Get error-specific suggestions
   * @param {string} errorCode - Error code
   * @returns {Array} Array of suggestion strings
   */
  getErrorSuggestions(errorCode) {
    const suggestions = {
      [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: [
        'Verify your WordPress username is correct',
        'Check that your Application Password is still valid',
        'Regenerate your Application Password in WordPress admin',
        'Ensure your WordPress user account is active'
      ],
      [ERROR_CODES.AUTH_EXPIRED_TOKEN]: [
        'Generate a new Application Password in WordPress admin',
        'Update your connection with the new credentials',
        'Check if your WordPress user account is still active'
      ],
      [ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS]: [
        'Ensure your WordPress user has Editor or Administrator role',
        'Check if any security plugins are restricting API access',
        'Contact your site administrator for permission assistance'
      ],
      [ERROR_CODES.API_NOT_FOUND]: [
        'Ensure WordPress REST API is enabled on your site',
        'Check if any security plugins are blocking API access',
        'Verify your WordPress version supports REST API (5.0+)',
        'Contact your hosting provider about API restrictions'
      ],
      [ERROR_CODES.NETWORK_UNREACHABLE]: [
        'Check that your WordPress site is online and accessible',
        'Verify the site URL is correct',
        'Check for any firewall or hosting restrictions'
      ],
      [ERROR_CODES.NETWORK_TIMEOUT]: [
        'Try again in a few minutes',
        'Check if your WordPress site is experiencing high load',
        'Contact your hosting provider if timeouts persist'
      ],
      [ERROR_CODES.API_RATE_LIMITED]: [
        'Wait a few minutes before trying again',
        'Check if your hosting provider has API rate limits',
        'Consider upgrading your hosting plan if limits are restrictive'
      ]
    };

    return suggestions[errorCode] || [
      'Try the operation again',
      'Check your WordPress site status',
      'Contact support if the issue persists'
    ];
  }

  /**
   * Log error with structured format
   * @param {Error} error - Error to log
   * @param {Object} context - Additional context
   */
  logError(error, context = {}) {
    const logEntry = {
      timestamp: context.timestamp || new Date().toISOString(),
      errorId: context.errorId,
      level: 'ERROR',
      operation: context.operation || 'wordpress_operation',
      userId: context.userId,
      connectionId: context.connectionId,
      siteUrl: context.siteUrl,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      request: {
        method: context.method,
        url: context.url,
        headers: this.sanitizeHeaders(context.headers),
        body: this.sanitizeRequestBody(context.body)
      },
      response: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        headers: error.response?.headers,
        data: this.sanitizeResponseData(error.response?.data)
      },
      metadata: {
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        retryAttempt: context.retryAttempt,
        totalAttempts: context.totalAttempts
      }
    };

    // Log as JSON for structured logging systems
    this.logger.error('WordPress Operation Error', logEntry);
  }

  /**
   * Log successful operations for monitoring
   * @param {string} operation - Operation name
   * @param {Object} context - Operation context
   * @param {Object} result - Operation result
   */
  logSuccess(operation, context = {}, result = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      operation,
      userId: context.userId,
      connectionId: context.connectionId,
      siteUrl: context.siteUrl,
      duration: context.duration,
      result: {
        success: true,
        ...this.sanitizeResult(result)
      },
      metadata: {
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        retryAttempts: context.retryAttempts || 0
      }
    };

    this.logger.info('WordPress Operation Success', logEntry);
  }

  /**
   * Sanitize headers to remove sensitive information
   * @param {Object} headers - Request headers
   * @returns {Object} Sanitized headers
   */
  sanitizeHeaders(headers = {}) {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.Authorization;
    delete sanitized['x-api-key'];
    delete sanitized['X-API-Key'];
    
    return sanitized;
  }

  /**
   * Sanitize request body to remove sensitive data
   * @param {Object} body - Request body
   * @returns {Object} Sanitized body
   */
  sanitizeRequestBody(body = {}) {
    if (typeof body !== 'object') return body;
    
    const sanitized = { ...body };
    
    // Remove sensitive fields
    if (sanitized.applicationPassword) {
      sanitized.applicationPassword = '[REDACTED]';
    }
    if (sanitized.password) {
      sanitized.password = '[REDACTED]';
    }
    
    return sanitized;
  }

  /**
   * Sanitize response data to remove sensitive information
   * @param {Object} data - Response data
   * @returns {Object} Sanitized data
   */
  sanitizeResponseData(data = {}) {
    if (typeof data !== 'object') return data;
    
    const sanitized = { ...data };
    
    // Remove sensitive WordPress data
    if (sanitized.password) {
      sanitized.password = '[REDACTED]';
    }
    
    return sanitized;
  }

  /**
   * Sanitize operation result for logging
   * @param {Object} result - Operation result
   * @returns {Object} Sanitized result
   */
  sanitizeResult(result = {}) {
    const sanitized = { ...result };
    
    // Remove sensitive result data
    if (sanitized.credentials) {
      sanitized.credentials = '[REDACTED]';
    }
    
    return sanitized;
  }

  /**
   * Generate unique error ID for tracking
   * @returns {string} Unique error ID
   */
  generateErrorId() {
    return `wp_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if an error is retryable
   * @param {Object} error - Standardized error object
   * @returns {boolean} Whether the error is retryable
   */
  isRetryableError(error) {
    if (!error || !error.code) {
      return false;
    }
    
    const retryableCodes = [
      ERROR_CODES.NETWORK_TIMEOUT,
      ERROR_CODES.NETWORK_UNREACHABLE,
      ERROR_CODES.API_RATE_LIMITED,
      'SERVER_ERROR'
    ];
    
    const isInRetryableCodes = retryableCodes.includes(error.code);
    const hasRetryableDetails = !!(error.details && error.details.retryable === true);
    
    return isInRetryableCodes || hasRetryableDetails;
  }

  /**
   * Get retry delay based on attempt number
   * @param {number} attempt - Current attempt number (1-based)
   * @param {Object} options - Retry options
   * @returns {number} Delay in milliseconds
   */
  getRetryDelay(attempt, options = {}) {
    const {
      baseDelay = 1000,
      maxDelay = 30000,
      backoffFactor = 2,
      jitter = false // Default to false for predictable testing
    } = options;
    
    let delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
    
    // Add jitter to prevent thundering herd
    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }
}

module.exports = WordPressErrorHandler;