/**
 * Enhanced Retry Handler for WordPress Operations
 * Provides sophisticated retry logic with exponential backoff, jitter, and circuit breaker
 */

const { defaultLogger } = require('./logger');
const WordPressErrorHandler = require('./errorHandler');

/**
 * Retry Handler Class
 * Manages retry logic for WordPress operations with advanced features
 */
class WordPressRetryHandler {
  /**
   * @param {Object} options - Retry configuration
   * @param {Object} logger - Logger instance
   */
  constructor(options = {}, logger = defaultLogger) {
    this.options = {
      maxAttempts: options.maxAttempts || 3,
      baseDelay: options.baseDelay || 1000,
      maxDelay: options.maxDelay || 30000,
      backoffFactor: options.backoffFactor || 2,
      jitter: options.jitter !== false,
      jitterFactor: options.jitterFactor || 0.1,
      circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
      circuitBreakerWindow: options.circuitBreakerWindow || 300000, // 5 minutes
      ...options
    };
    
    this.logger = logger;
    this.errorHandler = new WordPressErrorHandler(logger);
    
    // Circuit breaker state
    this.circuitBreakers = new Map();
  }

  /**
   * Execute operation with retry logic
   * @param {Function} operation - Async operation to execute
   * @param {Object} context - Operation context
   * @returns {Promise<Object>} Operation result
   */
  async executeWithRetry(operation, context = {}) {
    const {
      operationName = 'wordpress_operation',
      maxAttempts = this.options.maxAttempts,
      retryableErrors = null,
      circuitBreakerKey = null
    } = context;
    
    // Check circuit breaker if enabled
    if (circuitBreakerKey && this.isCircuitOpen(circuitBreakerKey)) {
      throw new Error(`Circuit breaker is open for ${circuitBreakerKey}`);
    }
    
    let lastError = null;
    let attempts = 0;
    
    const timer = this.logger.startOperation(operationName, context);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;
      
      try {
        this.logger.debug(`Executing ${operationName} (attempt ${attempt}/${maxAttempts})`, {
          ...context,
          attempt,
          maxAttempts
        });
        
        const result = await operation();
        
        // Reset circuit breaker on success
        if (circuitBreakerKey) {
          this.resetCircuitBreaker(circuitBreakerKey);
        }
        
        const timerResult = timer.end({ success: true, attempts });
        
        this.logger.info(`${operationName} succeeded`, {
          ...context,
          attempts,
          duration: timerResult.duration
        });
        
        return {
          success: true,
          result,
          attempts,
          duration: timerResult.duration
        };
        
      } catch (error) {
        lastError = error;
        
        // Handle and standardize the error
        const standardizedError = this.errorHandler.handleError(error, {
          ...context,
          operation: operationName,
          attempt,
          maxAttempts
        });
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(
          standardizedError.error, 
          retryableErrors
        );
        
        // Update circuit breaker on error
        if (circuitBreakerKey) {
          this.recordCircuitBreakerError(circuitBreakerKey);
        }
        
        this.logger.warn(`${operationName} failed (attempt ${attempt}/${maxAttempts})`, {
          ...context,
          attempt,
          maxAttempts,
          error: standardizedError.error,
          retryable: isRetryable,
          willRetry: isRetryable && attempt < maxAttempts
        });
        
        // Don't retry if error is not retryable or we've reached max attempts
        if (!isRetryable || attempt >= maxAttempts) {
          break;
        }
        
        // Calculate and apply retry delay
        const delay = this.calculateRetryDelay(attempt, context);
        
        this.logger.logRetry(operationName, attempt + 1, maxAttempts, standardizedError.error, {
          ...context,
          delay
        });
        
        await this.sleep(delay);
      }
    }
    
    // All attempts failed
    const timerResult = timer.error(lastError);
    
    const finalError = this.errorHandler.handleError(lastError, {
      ...context,
      operation: operationName,
      totalAttempts: attempts,
      allAttemptsFailed: true
    });
    
    this.logger.error(`${operationName} failed after ${attempts} attempts`, {
      ...context,
      attempts,
      duration: timerResult.duration,
      finalError: finalError.error
    });
    
    // Enhance error with retry information
    finalError.error.retryInfo = {
      attempts,
      maxAttempts,
      totalDuration: timerResult.duration
    };
    
    throw this.createRetryError(finalError.error, attempts);
  }

  /**
   * Check if an error is retryable
   * @param {Object} error - Standardized error object
   * @param {Array|Function} retryableErrors - Custom retryable error definition
   * @returns {boolean} Whether the error is retryable
   */
  isRetryableError(error, retryableErrors = null) {
    // Use custom retryable error logic if provided
    if (retryableErrors) {
      if (typeof retryableErrors === 'function') {
        return retryableErrors(error);
      }
      if (Array.isArray(retryableErrors)) {
        return retryableErrors.includes(error.code);
      }
    }
    
    // Use error handler's default logic
    return this.errorHandler.isRetryableError(error);
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   * @param {number} attempt - Current attempt number (1-based)
   * @param {Object} context - Operation context
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(attempt, context = {}) {
    const {
      baseDelay = this.options.baseDelay,
      maxDelay = this.options.maxDelay,
      backoffFactor = this.options.backoffFactor,
      jitter = this.options.jitter,
      jitterFactor = this.options.jitterFactor
    } = context;
    
    // Calculate exponential backoff
    let delay = Math.min(
      baseDelay * Math.pow(backoffFactor, attempt - 1),
      maxDelay
    );
    
    // Add jitter to prevent thundering herd
    if (jitter) {
      const jitterAmount = delay * jitterFactor;
      const jitterOffset = (Math.random() - 0.5) * 2 * jitterAmount;
      delay = Math.max(0, delay + jitterOffset);
    }
    
    return Math.floor(delay);
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create retry-specific error
   * @param {Object} error - Original error
   * @param {number} attempts - Number of attempts made
   * @returns {Error} Enhanced error with retry information
   */
  createRetryError(error, attempts) {
    const retryError = new Error(error.message || 'Operation failed after retries');
    retryError.code = error.code || 'RETRY_EXHAUSTED';
    retryError.originalError = error;
    retryError.attempts = attempts;
    retryError.userMessage = error.userMessage || 'The operation failed after multiple attempts. Please try again later.';
    retryError.details = {
      ...error.details,
      retryExhausted: true,
      totalAttempts: attempts
    };
    
    return retryError;
  }

  /**
   * Check if circuit breaker is open for a key
   * @param {string} key - Circuit breaker key
   * @returns {boolean} Whether circuit is open
   */
  isCircuitOpen(key) {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) return false;
    
    const now = Date.now();
    
    // Check if circuit breaker window has expired
    if (now - breaker.windowStart > this.options.circuitBreakerWindow) {
      this.resetCircuitBreaker(key);
      return false;
    }
    
    // Check if error threshold is exceeded
    return breaker.errorCount >= this.options.circuitBreakerThreshold;
  }

  /**
   * Record an error for circuit breaker
   * @param {string} key - Circuit breaker key
   */
  recordCircuitBreakerError(key) {
    const now = Date.now();
    let breaker = this.circuitBreakers.get(key);
    
    if (!breaker) {
      breaker = {
        errorCount: 0,
        windowStart: now
      };
    }
    
    // Reset window if it has expired
    if (now - breaker.windowStart > this.options.circuitBreakerWindow) {
      breaker.errorCount = 0;
      breaker.windowStart = now;
    }
    
    breaker.errorCount++;
    this.circuitBreakers.set(key, breaker);
    
    // Log circuit breaker state change
    if (breaker.errorCount >= this.options.circuitBreakerThreshold) {
      this.logger.warn(`Circuit breaker opened for ${key}`, {
        circuitBreakerKey: key,
        errorCount: breaker.errorCount,
        threshold: this.options.circuitBreakerThreshold,
        windowStart: new Date(breaker.windowStart).toISOString()
      });
    }
  }

  /**
   * Reset circuit breaker for a key
   * @param {string} key - Circuit breaker key
   */
  resetCircuitBreaker(key) {
    const breaker = this.circuitBreakers.get(key);
    if (breaker && breaker.errorCount > 0) {
      this.logger.info(`Circuit breaker reset for ${key}`, {
        circuitBreakerKey: key,
        previousErrorCount: breaker.errorCount
      });
    }
    
    this.circuitBreakers.delete(key);
  }

  /**
   * Get circuit breaker status
   * @param {string} key - Circuit breaker key
   * @returns {Object} Circuit breaker status
   */
  getCircuitBreakerStatus(key) {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) {
      return { status: 'closed', errorCount: 0 };
    }
    
    const now = Date.now();
    const isOpen = this.isCircuitOpen(key);
    const timeRemaining = isOpen ? 
      this.options.circuitBreakerWindow - (now - breaker.windowStart) : 0;
    
    return {
      status: isOpen ? 'open' : 'closed',
      errorCount: breaker.errorCount,
      threshold: this.options.circuitBreakerThreshold,
      windowStart: new Date(breaker.windowStart).toISOString(),
      timeRemaining: Math.max(0, timeRemaining)
    };
  }

  /**
   * Get all circuit breaker statuses
   * @returns {Object} All circuit breaker statuses
   */
  getAllCircuitBreakerStatuses() {
    const statuses = {};
    for (const [key] of this.circuitBreakers) {
      statuses[key] = this.getCircuitBreakerStatus(key);
    }
    return statuses;
  }

  /**
   * Create a retryable wrapper for an operation
   * @param {Function} operation - Operation to wrap
   * @param {Object} defaultContext - Default context for retries
   * @returns {Function} Wrapped operation
   */
  createRetryableOperation(operation, defaultContext = {}) {
    return async (context = {}) => {
      const mergedContext = { ...defaultContext, ...context };
      return this.executeWithRetry(operation, mergedContext);
    };
  }

  /**
   * Batch retry operations with concurrency control
   * @param {Array} operations - Array of operations to retry
   * @param {Object} options - Batch options
   * @returns {Promise<Array>} Array of results
   */
  async batchRetry(operations, options = {}) {
    const {
      concurrency = 3,
      failFast = false,
      context = {}
    } = options;
    
    const results = [];
    const errors = [];
    
    // Process operations in batches
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (operation, index) => {
        try {
          const result = await this.executeWithRetry(operation.fn, {
            ...context,
            ...operation.context,
            operationName: operation.name || `batch_operation_${i + index}`
          });
          return { success: true, result, index: i + index };
        } catch (error) {
          const errorResult = { success: false, error, index: i + index };
          if (failFast) {
            throw errorResult;
          }
          return errorResult;
        }
      });
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        if (failFast) {
          throw error;
        }
        errors.push(error);
      }
    }
    
    return {
      results,
      errors,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length + errors.length,
      total: operations.length
    };
  }
}

// Create default retry handler instance
const defaultRetryHandler = new WordPressRetryHandler();

module.exports = { WordPressRetryHandler, defaultRetryHandler };