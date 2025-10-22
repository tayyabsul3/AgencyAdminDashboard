/**
 * Error Handling Utilities
 * Centralized error handling, classification, and user-friendly message generation
 */

/**
 * Error types for classification
 */
export const ERROR_TYPES = {
  NETWORK: 'network',
  AUTHENTICATION: 'authentication',
  PERMISSION: 'permission',
  VALIDATION: 'validation',
  API: 'api',
  QUOTA: 'quota',
  TIMEOUT: 'timeout',
  UNKNOWN: 'unknown'
};

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Classify error based on error message and properties
 * @param {Error} error - The error to classify
 * @returns {Object} - Error classification with type and severity
 */
export const classifyError = (error) => {
  const message = error.message?.toLowerCase() || '';
  const code = (error.code?.toString() || '').toLowerCase();
  
  // Network errors
  if (message.includes('network') || message.includes('fetch') || 
      message.includes('connection') || code.includes('network')) {
    return { type: ERROR_TYPES.NETWORK, severity: ERROR_SEVERITY.MEDIUM };
  }
  
  // Authentication errors
  if (message.includes('authentication') || message.includes('unauthenticated') ||
      message.includes('login') || code.includes('auth')) {
    return { type: ERROR_TYPES.AUTHENTICATION, severity: ERROR_SEVERITY.HIGH };
  }
  
  // Permission errors
  if (message.includes('permission') || message.includes('unauthorized') ||
      message.includes('forbidden') || code.includes('permission')) {
    return { type: ERROR_TYPES.PERMISSION, severity: ERROR_SEVERITY.HIGH };
  }
  
  // Validation errors
  if (message.includes('validation') || message.includes('invalid') ||
      message.includes('required') || message.includes('format')) {
    return { type: ERROR_TYPES.VALIDATION, severity: ERROR_SEVERITY.LOW };
  }
  
  // Quota/Rate limiting errors
  if (message.includes('quota') || message.includes('rate limit') ||
      message.includes('too many requests') || code.includes('quota')) {
    return { type: ERROR_TYPES.QUOTA, severity: ERROR_SEVERITY.MEDIUM };
  }
  
  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out') ||
      code.includes('timeout')) {
    return { type: ERROR_TYPES.TIMEOUT, severity: ERROR_SEVERITY.MEDIUM };
  }
  
  // API errors
  if (message.includes('api') || message.includes('http') ||
      message.includes('status') || error.status) {
    return { type: ERROR_TYPES.API, severity: ERROR_SEVERITY.MEDIUM };
  }
  
  // Default to unknown
  return { type: ERROR_TYPES.UNKNOWN, severity: ERROR_SEVERITY.MEDIUM };
};

/**
 * Generate user-friendly error messages
 * @param {Error} error - The error object
 * @param {Object} context - Additional context (operation, component, etc.)
 * @returns {Object} - User-friendly error information
 */
export const generateUserFriendlyError = (error, context = {}) => {
  const classification = classifyError(error);
  const { operation = 'operation', component = 'application' } = context;
  
  let title = 'Something went wrong';
  let message = 'An unexpected error occurred. Please try again.';
  let actionText = 'Try Again';
  let canRetry = true;
  let showDetails = false;
  
  switch (classification.type) {
    case ERROR_TYPES.NETWORK:
      title = 'Connection Problem';
      message = 'Unable to connect to our servers. Please check your internet connection and try again.';
      actionText = 'Retry Connection';
      canRetry = true;
      break;
      
    case ERROR_TYPES.AUTHENTICATION:
      title = 'Authentication Required';
      message = 'You need to sign in to continue. You\'ll be redirected to the login page.';
      actionText = 'Sign In';
      canRetry = false;
      break;
      
    case ERROR_TYPES.PERMISSION:
      title = 'Access Denied';
      message = 'You don\'t have permission to perform this action. Please contact support if you believe this is an error.';
      actionText = 'Contact Support';
      canRetry = false;
      break;
      
    case ERROR_TYPES.VALIDATION:
      title = 'Invalid Input';
      message = error.message || 'Please check your input and try again.';
      actionText = 'Fix Input';
      canRetry = true;
      showDetails = true;
      break;
      
    case ERROR_TYPES.QUOTA:
      title = 'Service Temporarily Unavailable';
      message = 'We\'re experiencing high demand. Please wait a moment and try again.';
      actionText = 'Try Again Later';
      canRetry = true;
      break;
      
    case ERROR_TYPES.TIMEOUT:
      title = 'Request Timed Out';
      message = `The ${operation} is taking longer than expected. Please try again.`;
      actionText = 'Retry';
      canRetry = true;
      break;
      
    case ERROR_TYPES.API:
      title = 'Service Error';
      message = `There was a problem with the ${operation}. Our team has been notified.`;
      actionText = 'Try Again';
      canRetry = true;
      break;
      
    default:
      title = 'Unexpected Error';
      message = `An unexpected error occurred in ${component}. Please try again or contact support if the problem persists.`;
      actionText = 'Try Again';
      canRetry = true;
      showDetails = true;
  }
  
  return {
    title,
    message,
    actionText,
    canRetry,
    showDetails,
    severity: classification.severity,
    type: classification.type,
    originalError: error
  };
};

/**
 * Enhanced error handler with retry logic and user feedback
 * @param {Function} operation - The operation to execute
 * @param {Object} options - Configuration options
 * @returns {Promise} - Result of the operation or throws enhanced error
 */
export const handleAsyncOperation = async (operation, options = {}) => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    backoffMultiplier = 2,
    context = {},
    onRetry = null,
    onError = null,
    shouldRetry = null
  } = options;
  
  let lastError;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempt++;
      
      const classification = classifyError(error);
      const userError = generateUserFriendlyError(error, context);
      
      // Call error callback if provided
      if (onError) {
        onError(error, userError, attempt);
      }
      
      // Check if we should retry
      const shouldRetryError = shouldRetry ? 
        shouldRetry(error, attempt, maxRetries) : 
        defaultShouldRetry(error, attempt, maxRetries);
      
      if (!shouldRetryError || attempt >= maxRetries) {
        // Enhance error with user-friendly information
        const enhancedError = new Error(userError.message);
        enhancedError.originalError = error;
        enhancedError.userFriendly = userError;
        enhancedError.classification = classification;
        enhancedError.attempts = attempt;
        
        throw enhancedError;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1) + 
                   Math.random() * 1000;
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(error, attempt, maxRetries, delay);
      }
      
      console.warn(`Operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`, error.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Default retry logic - determines if an error should be retried
 * @param {Error} error - The error that occurred
 * @param {number} attempt - Current attempt number
 * @param {number} maxRetries - Maximum number of retries
 * @returns {boolean} - Whether to retry the operation
 */
const defaultShouldRetry = (error, attempt, maxRetries) => {
  if (attempt >= maxRetries) return false;
  
  const classification = classifyError(error);
  
  // Don't retry authentication, permission, or validation errors
  if ([ERROR_TYPES.AUTHENTICATION, ERROR_TYPES.PERMISSION, ERROR_TYPES.VALIDATION].includes(classification.type)) {
    return false;
  }
  
  // Retry network, timeout, API, and quota errors
  return [ERROR_TYPES.NETWORK, ERROR_TYPES.TIMEOUT, ERROR_TYPES.API, ERROR_TYPES.QUOTA, ERROR_TYPES.UNKNOWN].includes(classification.type);
};

/**
 * Log error with context and classification
 * @param {Error} error - The error to log
 * @param {Object} context - Additional context
 */
export const logError = (error, context = {}) => {
  const classification = classifyError(error);
  const userError = generateUserFriendlyError(error, context);
  
  const logData = {
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    classification,
    userError,
    context,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    url: typeof window !== 'undefined' ? window.location.href : 'server'
  };
  
  // Log to console with appropriate level
  switch (classification.severity) {
    case ERROR_SEVERITY.CRITICAL:
      console.error('CRITICAL ERROR:', logData);
      break;
    case ERROR_SEVERITY.HIGH:
      console.error('HIGH SEVERITY ERROR:', logData);
      break;
    case ERROR_SEVERITY.MEDIUM:
      console.warn('MEDIUM SEVERITY ERROR:', logData);
      break;
    default:
      console.log('LOW SEVERITY ERROR:', logData);
  }
  
  // Send to monitoring service if available
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'exception', {
      description: error.message,
      fatal: classification.severity === ERROR_SEVERITY.CRITICAL,
      custom_map: {
        error_type: classification.type,
        error_severity: classification.severity,
        component: context.component || 'unknown'
      }
    });
  }
  
  return logData;
};

/**
 * Create a wrapped version of a function with error handling
 * @param {Function} fn - Function to wrap
 * @param {Object} options - Error handling options
 * @returns {Function} - Wrapped function with error handling
 */
export const withErrorHandling = (fn, options = {}) => {
  return async (...args) => {
    return handleAsyncOperation(() => fn(...args), options);
  };
};

/**
 * Error boundary hook for functional components
 * @param {Function} onError - Error callback
 * @returns {Function} - Error handler function
 */
export const useErrorHandler = (onError = null) => {
  return (error, errorInfo = null) => {
    const logData = logError(error, { errorInfo });
    
    if (onError) {
      onError(error, logData);
    }
  };
};