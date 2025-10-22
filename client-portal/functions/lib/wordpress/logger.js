/**
 * Structured Logger for WordPress Operations
 * Provides comprehensive logging with different levels and structured output
 */

/**
 * WordPress Logger Class
 * Handles structured logging for all WordPress operations
 */
class WordPressLogger {
  /**
   * @param {Object} options - Logger configuration
   */
  constructor(options = {}) {
    this.options = {
      level: options.level || 'INFO',
      enableConsole: options.enableConsole !== false,
      enableStructured: options.enableStructured !== false,
      enableMetrics: options.enableMetrics !== false,
      serviceName: options.serviceName || 'wordpress-integration',
      version: options.version || '1.0.0',
      ...options
    };
    
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
      TRACE: 4
    };
    
    this.currentLevel = this.levels[this.options.level] || this.levels.INFO;
    
    // Metrics storage for monitoring
    this.metrics = {
      operations: new Map(),
      errors: new Map(),
      performance: new Map()
    };
  }

  /**
   * Log error with full context
   * @param {string} message - Error message
   * @param {Object} context - Error context
   */
  error(message, context = {}) {
    if (this.currentLevel < this.levels.ERROR) return;
    
    const logEntry = this.createLogEntry('ERROR', message, context);
    this.writeLog(logEntry);
    this.updateMetrics('error', context);
  }

  /**
   * Log warning
   * @param {string} message - Warning message
   * @param {Object} context - Warning context
   */
  warn(message, context = {}) {
    if (this.currentLevel < this.levels.WARN) return;
    
    const logEntry = this.createLogEntry('WARN', message, context);
    this.writeLog(logEntry);
  }

  /**
   * Log informational message
   * @param {string} message - Info message
   * @param {Object} context - Info context
   */
  info(message, context = {}) {
    if (this.currentLevel < this.levels.INFO) return;
    
    const logEntry = this.createLogEntry('INFO', message, context);
    this.writeLog(logEntry);
    this.updateMetrics('operation', context);
  }

  /**
   * Log debug information
   * @param {string} message - Debug message
   * @param {Object} context - Debug context
   */
  debug(message, context = {}) {
    if (this.currentLevel < this.levels.DEBUG) return;
    
    const logEntry = this.createLogEntry('DEBUG', message, context);
    this.writeLog(logEntry);
  }

  /**
   * Log trace information
   * @param {string} message - Trace message
   * @param {Object} context - Trace context
   */
  trace(message, context = {}) {
    if (this.currentLevel < this.levels.TRACE) return;
    
    const logEntry = this.createLogEntry('TRACE', message, context);
    this.writeLog(logEntry);
  }

  /**
   * Log WordPress API request
   * @param {Object} request - Request details
   * @param {Object} context - Additional context
   */
  logRequest(request, context = {}) {
    const logEntry = this.createLogEntry('DEBUG', 'WordPress API Request', {
      ...context,
      request: {
        method: request.method,
        url: this.sanitizeUrl(request.url),
        headers: this.sanitizeHeaders(request.headers),
        body: this.sanitizeRequestBody(request.body),
        timeout: request.timeout
      }
    });
    
    this.writeLog(logEntry);
  }

  /**
   * Log WordPress API response
   * @param {Object} response - Response details
   * @param {Object} context - Additional context
   */
  logResponse(response, context = {}) {
    const level = response.status >= 400 ? 'WARN' : 'DEBUG';
    
    const logEntry = this.createLogEntry(level, 'WordPress API Response', {
      ...context,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: this.sanitizeResponseData(response.data),
        duration: context.duration
      }
    });
    
    this.writeLog(logEntry);
    this.updatePerformanceMetrics(context);
  }

  /**
   * Log operation start
   * @param {string} operation - Operation name
   * @param {Object} context - Operation context
   * @returns {Object} Timer object for measuring duration
   */
  startOperation(operation, context = {}) {
    const startTime = Date.now();
    const operationId = this.generateOperationId();
    
    this.debug(`Starting ${operation}`, {
      ...context,
      operationId,
      startTime: new Date(startTime).toISOString()
    });
    
    return {
      operationId,
      startTime,
      end: (result = {}) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        this.info(`Completed ${operation}`, {
          ...context,
          operationId,
          duration,
          endTime: new Date(endTime).toISOString(),
          result: this.sanitizeResult(result)
        });
        
        return { operationId, duration, result };
      },
      error: (error) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        this.error(`Failed ${operation}`, {
          ...context,
          operationId,
          duration,
          endTime: new Date(endTime).toISOString(),
          error: {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack
          }
        });
        
        return { operationId, duration, error };
      }
    };
  }

  /**
   * Log retry attempt
   * @param {string} operation - Operation being retried
   * @param {number} attempt - Current attempt number
   * @param {number} maxAttempts - Maximum attempts
   * @param {Object} error - Previous error
   * @param {Object} context - Additional context
   */
  logRetry(operation, attempt, maxAttempts, error, context = {}) {
    this.warn(`Retrying ${operation} (${attempt}/${maxAttempts})`, {
      ...context,
      retry: {
        attempt,
        maxAttempts,
        previousError: {
          code: error.code,
          message: error.message
        }
      }
    });
  }

  /**
   * Log health check results
   * @param {string} connectionId - Connection ID
   * @param {Object} result - Health check result
   * @param {Object} context - Additional context
   */
  logHealthCheck(connectionId, result, context = {}) {
    const level = result.success ? 'INFO' : 'WARN';
    const message = result.success ? 'Health check passed' : 'Health check failed';
    
    this.log(level, message, {
      ...context,
      connectionId,
      healthCheck: {
        success: result.success,
        status: result.status,
        attempts: result.attempts,
        error: result.error,
        siteInfo: result.siteInfo
      }
    });
  }

  /**
   * Create structured log entry
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} context - Log context
   * @returns {Object} Structured log entry
   */
  createLogEntry(level, message, context = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      service: this.options.serviceName,
      version: this.options.version,
      message,
      ...this.extractStandardFields(context),
      context: this.sanitizeContext(context)
    };
  }

  /**
   * Extract standard fields from context
   * @param {Object} context - Log context
   * @returns {Object} Standard fields
   */
  extractStandardFields(context) {
    const fields = {};
    
    // Extract standard fields
    if (context.userId) fields.userId = context.userId;
    if (context.connectionId) fields.connectionId = context.connectionId;
    if (context.operationId) fields.operationId = context.operationId;
    if (context.errorId) fields.errorId = context.errorId;
    if (context.siteUrl) fields.siteUrl = this.sanitizeUrl(context.siteUrl);
    if (context.operation) fields.operation = context.operation;
    if (context.duration !== undefined) fields.duration = context.duration;
    
    return fields;
  }

  /**
   * Write log entry to configured outputs
   * @param {Object} logEntry - Log entry to write
   */
  writeLog(logEntry) {
    if (this.options.enableConsole) {
      this.writeToConsole(logEntry);
    }
    
    if (this.options.enableStructured) {
      this.writeStructured(logEntry);
    }
  }

  /**
   * Write to console with appropriate formatting
   * @param {Object} logEntry - Log entry
   */
  writeToConsole(logEntry) {
    const { timestamp, level, message, userId, connectionId, operation } = logEntry;
    
    // Create readable console message
    const prefix = `[${timestamp}] ${level}`;
    const context = [userId, connectionId, operation].filter(Boolean).join(' | ');
    const fullMessage = context ? `${prefix} (${context}): ${message}` : `${prefix}: ${message}`;
    
    switch (level) {
      case 'ERROR':
        console.error(fullMessage, logEntry.context);
        break;
      case 'WARN':
        console.warn(fullMessage, logEntry.context);
        break;
      case 'INFO':
        console.info(fullMessage, logEntry.context);
        break;
      case 'DEBUG':
      case 'TRACE':
        console.log(fullMessage, logEntry.context);
        break;
      default:
        console.log(fullMessage, logEntry.context);
    }
  }

  /**
   * Write structured log (JSON format for log aggregation systems)
   * @param {Object} logEntry - Log entry
   */
  writeStructured(logEntry) {
    // In production, this would write to a structured logging system
    // For now, we'll write JSON to console for structured parsing
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Update operation metrics
   * @param {string} type - Metric type
   * @param {Object} context - Context for metrics
   */
  updateMetrics(type, context) {
    if (!this.options.enableMetrics) return;
    
    const key = context.operation || 'unknown';
    
    if (type === 'operation') {
      const current = this.metrics.operations.get(key) || { count: 0, success: 0 };
      current.count++;
      if (context.result && context.result.success !== false) {
        current.success++;
      }
      this.metrics.operations.set(key, current);
    } else if (type === 'error') {
      const errorKey = `${key}:${context.error?.code || 'unknown'}`;
      const current = this.metrics.errors.get(errorKey) || 0;
      this.metrics.errors.set(errorKey, current + 1);
    }
  }

  /**
   * Update performance metrics
   * @param {Object} context - Context with performance data
   */
  updatePerformanceMetrics(context) {
    if (!this.options.enableMetrics || !context.duration) return;
    
    const key = context.operation || 'unknown';
    const current = this.metrics.performance.get(key) || {
      count: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0
    };
    
    current.count++;
    current.totalDuration += context.duration;
    current.minDuration = Math.min(current.minDuration, context.duration);
    current.maxDuration = Math.max(current.maxDuration, context.duration);
    current.avgDuration = current.totalDuration / current.count;
    
    this.metrics.performance.set(key, current);
  }

  /**
   * Get current metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return {
      operations: Object.fromEntries(this.metrics.operations),
      errors: Object.fromEntries(this.metrics.errors),
      performance: Object.fromEntries(this.metrics.performance)
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics.operations.clear();
    this.metrics.errors.clear();
    this.metrics.performance.clear();
  }

  /**
   * Sanitize URL to remove sensitive information
   * @param {string} url - URL to sanitize
   * @returns {string} Sanitized URL
   */
  sanitizeUrl(url) {
    if (!url) return url;
    
    try {
      const urlObj = new URL(url);
      // Remove sensitive query parameters
      urlObj.searchParams.delete('password');
      urlObj.searchParams.delete('token');
      urlObj.searchParams.delete('key');
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Sanitize headers to remove sensitive information
   * @param {Object} headers - Headers to sanitize
   * @returns {Object} Sanitized headers
   */
  sanitizeHeaders(headers = {}) {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    const sensitiveHeaders = [
      'authorization', 'Authorization',
      'x-api-key', 'X-API-Key',
      'cookie', 'Cookie',
      'x-auth-token', 'X-Auth-Token'
    ];
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  /**
   * Sanitize request body to remove sensitive data
   * @param {Object} body - Request body to sanitize
   * @returns {Object} Sanitized body
   */
  sanitizeRequestBody(body) {
    if (!body || typeof body !== 'object') return body;
    
    const sanitized = { ...body };
    
    // Remove sensitive fields
    const sensitiveFields = [
      'password', 'applicationPassword', 'token', 'key', 'secret'
    ];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  /**
   * Sanitize response data to remove sensitive information
   * @param {Object} data - Response data to sanitize
   * @returns {Object} Sanitized data
   */
  sanitizeResponseData(data) {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = { ...data };
    
    // Remove sensitive WordPress response fields
    if (sanitized.password) sanitized.password = '[REDACTED]';
    if (sanitized.token) sanitized.token = '[REDACTED]';
    
    return sanitized;
  }

  /**
   * Sanitize operation result for logging
   * @param {Object} result - Result to sanitize
   * @returns {Object} Sanitized result
   */
  sanitizeResult(result) {
    if (!result || typeof result !== 'object') return result;
    
    const sanitized = { ...result };
    
    // Remove sensitive result fields
    if (sanitized.credentials) sanitized.credentials = '[REDACTED]';
    if (sanitized.encryptedData) sanitized.encryptedData = '[REDACTED]';
    
    return sanitized;
  }

  /**
   * Sanitize context to remove sensitive information
   * @param {Object} context - Context to sanitize
   * @returns {Object} Sanitized context
   */
  sanitizeContext(context) {
    const sanitized = { ...context };
    
    // Remove already extracted standard fields to avoid duplication
    delete sanitized.userId;
    delete sanitized.connectionId;
    delete sanitized.operationId;
    delete sanitized.errorId;
    delete sanitized.siteUrl;
    delete sanitized.operation;
    delete sanitized.duration;
    
    // Sanitize nested objects
    if (sanitized.request) {
      sanitized.request = {
        ...sanitized.request,
        headers: this.sanitizeHeaders(sanitized.request.headers),
        body: this.sanitizeRequestBody(sanitized.request.body)
      };
    }
    
    if (sanitized.response) {
      sanitized.response = {
        ...sanitized.response,
        data: this.sanitizeResponseData(sanitized.response.data)
      };
    }
    
    return sanitized;
  }

  /**
   * Generate unique operation ID
   * @returns {string} Unique operation ID
   */
  generateOperationId() {
    return `wp_op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generic log method
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} context - Log context
   */
  log(level, message, context = {}) {
    const levelNum = this.levels[level.toUpperCase()];
    if (levelNum === undefined || this.currentLevel < levelNum) return;
    
    const logEntry = this.createLogEntry(level.toUpperCase(), message, context);
    this.writeLog(logEntry);
    
    if (level.toUpperCase() === 'ERROR') {
      this.updateMetrics('error', context);
    } else {
      this.updateMetrics('operation', context);
    }
  }
}

// Create default logger instance
const defaultLogger = new WordPressLogger({
  level: process.env.WP_LOG_LEVEL || 'INFO',
  enableConsole: true,
  enableStructured: process.env.NODE_ENV === 'production',
  enableMetrics: true
});

module.exports = { WordPressLogger, defaultLogger };