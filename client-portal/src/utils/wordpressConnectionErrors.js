/**
 * WordPress Connection Error Handling Utilities
 * Provides user-friendly error messages and recovery suggestions
 */

/**
 * Error types for WordPress connections
 */
export const WP_CONNECTION_ERROR_TYPES = {
  ENCRYPTION_FAILED: 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  FIRESTORE_ERROR: 'FIRESTORE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONNECTION_NOT_FOUND: 'CONNECTION_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
};

/**
 * Parse and categorize WordPress connection errors
 * @param {Error} error - The error object
 * @returns {Object} Parsed error with type, message, and recovery suggestions
 */
export const parseWordPressConnectionError = (error) => {
  const errorMessage = error?.message || 'Unknown error occurred';
  
  // Encryption/Decryption errors
  if (errorMessage.includes('encryption') || errorMessage.includes('decrypt')) {
    return {
      type: errorMessage.includes('decrypt') ? 
        WP_CONNECTION_ERROR_TYPES.DECRYPTION_FAILED : 
        WP_CONNECTION_ERROR_TYPES.ENCRYPTION_FAILED,
      title: 'Security Error',
      message: 'Failed to process connection credentials securely.',
      userMessage: 'There was a problem with credential security. Please try logging in again.',
      recovery: [
        'Sign out and sign back in to refresh your session',
        'Clear your browser cache and cookies',
        'Try using a different browser'
      ],
      severity: 'high'
    };
  }

  // Authentication errors
  if (errorMessage.includes('auth') || errorMessage.includes('token') || errorMessage.includes('permission')) {
    return {
      type: WP_CONNECTION_ERROR_TYPES.AUTHENTICATION_FAILED,
      title: 'Authentication Error',
      message: 'Your session has expired or authentication failed.',
      userMessage: 'Please sign in again to continue.',
      recovery: [
        'Sign out and sign back in',
        'Check your internet connection',
        'Verify your account is still active'
      ],
      severity: 'high'
    };
  }

  // Network errors and WordPress credential issues
  if (errorMessage.includes('network') || 
      errorMessage.includes('fetch') || 
      errorMessage.includes('connection') ||
      errorMessage.includes('401') ||
      errorMessage.includes('403') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('credentials') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('wordpress') ||
      errorMessage.includes('failed to')) {
    return {
      type: WP_CONNECTION_ERROR_TYPES.NETWORK_ERROR,
      title: 'WordPress Connection Error',
      message: 'Unable to connect to WordPress or credentials are incorrect.',
      userMessage: 'Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.',
      recovery: [
        'Verify your WordPress site URL is correct',
        'Check your username and application password',
        'Ensure your WordPress site is accessible',
        'Contact support if credentials are definitely correct'
      ],
      severity: 'medium'
    };
  }

  // Firestore errors
  if (errorMessage.includes('firestore') || errorMessage.includes('database')) {
    return {
      type: WP_CONNECTION_ERROR_TYPES.FIRESTORE_ERROR,
      title: 'Database Error',
      message: 'Unable to save or retrieve connection data.',
      userMessage: 'There was a problem accessing your saved connections.',
      recovery: [
        'Try again in a few moments',
        'Check your internet connection',
        'Sign out and sign back in if the problem persists'
      ],
      severity: 'medium'
    };
  }

  // Validation errors
  if (errorMessage.includes('invalid') || errorMessage.includes('required') || errorMessage.includes('missing')) {
    return {
      type: WP_CONNECTION_ERROR_TYPES.VALIDATION_ERROR,
      title: 'Invalid Data',
      message: 'The connection data provided is invalid or incomplete.',
      userMessage: 'Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.',
      recovery: [
        'Verify all required fields are filled',
        'Check that URLs are properly formatted',
        'Ensure credentials are correct',
        'Contact support if you need assistance'
      ],
      severity: 'low'
    };
  }

  // Connection not found
  if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
    return {
      type: WP_CONNECTION_ERROR_TYPES.CONNECTION_NOT_FOUND,
      title: 'Connection Not Found',
      message: 'The requested connection could not be found.',
      userMessage: 'This connection may have been deleted or is no longer available.',
      recovery: [
        'Refresh the page to update your connections list',
        'Create a new connection with the same details',
        'Check if the connection was accidentally deleted'
      ],
      severity: 'medium'
    };
  }

  // Default error
  return {
    type: 'UNKNOWN_ERROR',
    title: 'WordPress Connection Error',
    message: errorMessage,
    userMessage: 'Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.',
    recovery: [
      'Verify your WordPress credentials',
      'Check your site URL and accessibility',
      'Try the operation again',
      'Contact support if the problem persists'
    ],
    severity: 'medium'
  };
};

/**
 * Get user-friendly error message for display
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
export const getUserFriendlyErrorMessage = (error) => {
  const parsed = parseWordPressConnectionError(error);
  return parsed.userMessage;
};

/**
 * Get recovery suggestions for an error
 * @param {Error} error - The error object
 * @returns {Array<string>} Array of recovery suggestions
 */
export const getErrorRecoverySuggestions = (error) => {
  const parsed = parseWordPressConnectionError(error);
  return parsed.recovery;
};

/**
 * Determine if an error requires immediate user action
 * @param {Error} error - The error object
 * @returns {boolean} True if immediate action is required
 */
export const requiresImmediateAction = (error) => {
  const parsed = parseWordPressConnectionError(error);
  return parsed.severity === 'high';
};

/**
 * Log error with appropriate level based on severity
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 */
export const logWordPressConnectionError = (error, context = 'WordPress Connection') => {
  const parsed = parseWordPressConnectionError(error);
  
  const logData = {
    context,
    type: parsed.type,
    title: parsed.title,
    message: parsed.message,
    severity: parsed.severity,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
  };

  switch (parsed.severity) {
    case 'high':
      console.error(`🚨 ${context} - Critical Error:`, logData);
      break;
    case 'medium':
      console.warn(`⚠️ ${context} - Warning:`, logData);
      break;
    case 'low':
      console.info(`ℹ️ ${context} - Info:`, logData);
      break;
    default:
      console.log(`📝 ${context} - Log:`, logData);
  }
};

/**
 * Create a retry handler for failed operations
 * @param {Function} operation - The operation to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in milliseconds
 * @returns {Function} Retry handler function
 */
export const createRetryHandler = (operation, maxRetries = 3, delay = 1000) => {
  return async (...args) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation(...args);
      } catch (error) {
        lastError = error;
        const parsed = parseWordPressConnectionError(error);
        
        // Don't retry authentication or validation errors
        if (parsed.type === WP_CONNECTION_ERROR_TYPES.AUTHENTICATION_FAILED ||
            parsed.type === WP_CONNECTION_ERROR_TYPES.VALIDATION_ERROR) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }
        
        console.warn(`Retry attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        // Exponential backoff
        const retryDelay = delay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    throw lastError;
  };
};

/**
 * WordPress connection error boundary component helper
 * @param {Error} error - The error that occurred
 * @param {Function} onRetry - Retry callback function
 * @param {Function} onDismiss - Dismiss callback function
 * @returns {Object} Error boundary props
 */
export const getErrorBoundaryProps = (error, onRetry, onDismiss) => {
  const parsed = parseWordPressConnectionError(error);
  
  return {
    title: parsed.title,
    message: parsed.userMessage,
    recovery: parsed.recovery,
    severity: parsed.severity,
    canRetry: parsed.type !== WP_CONNECTION_ERROR_TYPES.VALIDATION_ERROR,
    requiresAuth: parsed.type === WP_CONNECTION_ERROR_TYPES.AUTHENTICATION_FAILED,
    onRetry: parsed.type !== WP_CONNECTION_ERROR_TYPES.VALIDATION_ERROR ? onRetry : null,
    onDismiss,
    timestamp: new Date().toLocaleTimeString()
  };
};