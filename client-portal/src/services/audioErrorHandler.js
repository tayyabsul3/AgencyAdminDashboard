/**
 * Audio Error Handler Service
 * Comprehensive error handling and fallback system for audio features
 */

import { ERROR_TYPES, ERROR_SEVERITY, classifyError, generateUserFriendlyError, logError } from '../utils/errorHandler.js';

/**
 * Audio-specific error types
 */
export const AUDIO_ERROR_TYPES = {
  MICROPHONE_DENIED: 'microphone_denied',
  MICROPHONE_UNAVAILABLE: 'microphone_unavailable',
  SPEECH_RECOGNITION_UNSUPPORTED: 'speech_recognition_unsupported',
  SPEECH_RECOGNITION_FAILED: 'speech_recognition_failed',
  VOICE_SYNTHESIS_FAILED: 'voice_synthesis_failed',
  AUDIO_PLAYBACK_FAILED: 'audio_playback_failed',
  NETWORK_AUDIO_FAILED: 'network_audio_failed',
  BROWSER_COMPATIBILITY: 'browser_compatibility',
  AUDIO_CONTEXT_FAILED: 'audio_context_failed',
  NO_SPEECH_DETECTED: 'no_speech_detected'
};

/**
 * Audio error recovery strategies
 */
export const RECOVERY_STRATEGIES = {
  RETRY: 'retry',
  FALLBACK_TO_TEXT: 'fallback_to_text',
  SWITCH_BROWSER: 'switch_browser',
  CHECK_PERMISSIONS: 'check_permissions',
  CHECK_NETWORK: 'check_network',
  RELOAD_PAGE: 'reload_page',
  CONTACT_SUPPORT: 'contact_support'
};

class AudioErrorHandler {
  constructor() {
    this.errorHistory = [];
    this.fallbackCallbacks = new Map();
    this.recoveryAttempts = new Map();
    this.maxRecoveryAttempts = 3;
    this.listeners = new Set();
    
    // Error thresholds for automatic fallback
    this.thresholds = {
      maxConsecutiveErrors: 3,
      maxErrorsInTimeWindow: 5,
      timeWindowMs: 60000, // 1 minute
      criticalErrorTypes: [
        AUDIO_ERROR_TYPES.MICROPHONE_DENIED,
        AUDIO_ERROR_TYPES.SPEECH_RECOGNITION_UNSUPPORTED,
        AUDIO_ERROR_TYPES.BROWSER_COMPATIBILITY
      ]
    };
  }

  /**
   * Add error event listener
   * @param {Function} listener - Error event listener
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * Remove error event listener
   * @param {Function} listener - Error event listener
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of error event
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in audio error handler listener:', error);
      }
    });
  }

  /**
   * Classify audio-specific errors
   * @param {Error} error - The error to classify
   * @param {Object} context - Additional context
   * @returns {Object} - Enhanced error classification
   */
  classifyAudioError(error, context = {}) {
    const message = error.message?.toLowerCase() || '';
    const errorCode = error.error || error.code || '';
    const { operation = 'audio_operation' } = context;

    // Speech recognition errors
    if (errorCode === 'not-allowed' || message.includes('microphone') && message.includes('denied')) {
      return {
        type: AUDIO_ERROR_TYPES.MICROPHONE_DENIED,
        severity: ERROR_SEVERITY.CRITICAL,
        recoveryStrategy: RECOVERY_STRATEGIES.CHECK_PERMISSIONS,
        canRetry: false,
        requiresUserAction: true
      };
    }

    if (errorCode === 'no-speech' || message.includes('no speech')) {
      return {
        type: AUDIO_ERROR_TYPES.NO_SPEECH_DETECTED,
        severity: ERROR_SEVERITY.LOW,
        recoveryStrategy: RECOVERY_STRATEGIES.RETRY,
        canRetry: true,
        requiresUserAction: false
      };
    }

    if (errorCode === 'audio-capture' || message.includes('audio capture')) {
      return {
        type: AUDIO_ERROR_TYPES.MICROPHONE_UNAVAILABLE,
        severity: ERROR_SEVERITY.HIGH,
        recoveryStrategy: RECOVERY_STRATEGIES.CHECK_PERMISSIONS,
        canRetry: true,
        requiresUserAction: true
      };
    }

    if (message.includes('speech recognition') && message.includes('not supported')) {
      return {
        type: AUDIO_ERROR_TYPES.SPEECH_RECOGNITION_UNSUPPORTED,
        severity: ERROR_SEVERITY.CRITICAL,
        recoveryStrategy: RECOVERY_STRATEGIES.FALLBACK_TO_TEXT,
        canRetry: false,
        requiresUserAction: false
      };
    }

    if (errorCode === 'network' || (message.includes('network') && operation.includes('audio'))) {
      return {
        type: AUDIO_ERROR_TYPES.NETWORK_AUDIO_FAILED,
        severity: ERROR_SEVERITY.MEDIUM,
        recoveryStrategy: RECOVERY_STRATEGIES.CHECK_NETWORK,
        canRetry: true,
        requiresUserAction: false
      };
    }

    // Voice synthesis errors
    if (message.includes('elevenlabs') || message.includes('voice synthesis') || message.includes('text-to-speech')) {
      return {
        type: AUDIO_ERROR_TYPES.VOICE_SYNTHESIS_FAILED,
        severity: ERROR_SEVERITY.MEDIUM,
        recoveryStrategy: RECOVERY_STRATEGIES.RETRY,
        canRetry: true,
        requiresUserAction: false
      };
    }

    // Audio playback errors
    if (message.includes('audio playback') || message.includes('play') && message.includes('failed')) {
      return {
        type: AUDIO_ERROR_TYPES.AUDIO_PLAYBACK_FAILED,
        severity: ERROR_SEVERITY.MEDIUM,
        recoveryStrategy: RECOVERY_STRATEGIES.RETRY,
        canRetry: true,
        requiresUserAction: false
      };
    }

    // Browser compatibility errors
    if (message.includes('not supported') || message.includes('unsupported browser')) {
      return {
        type: AUDIO_ERROR_TYPES.BROWSER_COMPATIBILITY,
        severity: ERROR_SEVERITY.CRITICAL,
        recoveryStrategy: RECOVERY_STRATEGIES.SWITCH_BROWSER,
        canRetry: false,
        requiresUserAction: true
      };
    }

    // Audio context errors
    if (message.includes('audiocontext') || message.includes('audio context')) {
      return {
        type: AUDIO_ERROR_TYPES.AUDIO_CONTEXT_FAILED,
        severity: ERROR_SEVERITY.HIGH,
        recoveryStrategy: RECOVERY_STRATEGIES.RELOAD_PAGE,
        canRetry: true,
        requiresUserAction: true
      };
    }

    // Fall back to general classification
    const generalClassification = classifyError(error);
    return {
      type: generalClassification.type,
      severity: generalClassification.severity,
      recoveryStrategy: RECOVERY_STRATEGIES.RETRY,
      canRetry: true,
      requiresUserAction: false
    };
  }

  /**
   * Generate user-friendly audio error messages
   * @param {Error} error - The error object
   * @param {Object} context - Additional context
   * @returns {Object} - User-friendly error information
   */
  generateAudioErrorMessage(error, context = {}) {
    const classification = this.classifyAudioError(error, context);
    const { operation = 'audio operation' } = context;

    let title = 'Audio Error';
    let message = 'An audio error occurred. Please try again.';
    let actionText = 'Try Again';
    let secondaryActionText = null;
    let instructions = [];
    let canSwitchToText = true;

    switch (classification.type) {
      case AUDIO_ERROR_TYPES.MICROPHONE_DENIED:
        title = 'Microphone Access Denied';
        message = 'We need microphone access for voice interviews. Please allow microphone access and try again.';
        actionText = 'Allow Microphone';
        secondaryActionText = 'Switch to Text Mode';
        instructions = [
          'Click the microphone icon in your browser\'s address bar',
          'Select "Allow" for microphone access',
          'Refresh the page if needed'
        ];
        break;

      case AUDIO_ERROR_TYPES.MICROPHONE_UNAVAILABLE:
        title = 'Microphone Not Available';
        message = 'Your microphone is not available or is being used by another application.';
        actionText = 'Check Microphone';
        secondaryActionText = 'Switch to Text Mode';
        instructions = [
          'Close other applications that might be using your microphone',
          'Check that your microphone is properly connected',
          'Try refreshing the page'
        ];
        break;

      case AUDIO_ERROR_TYPES.SPEECH_RECOGNITION_UNSUPPORTED:
        title = 'Voice Recognition Not Supported';
        message = 'Your browser doesn\'t support voice recognition. Please use text mode or try a different browser.';
        actionText = 'Switch to Text Mode';
        secondaryActionText = 'Try Different Browser';
        canSwitchToText = true;
        instructions = [
          'Chrome and Edge have the best voice recognition support',
          'Make sure your browser is up to date',
          'Text mode works in all browsers'
        ];
        break;

      case AUDIO_ERROR_TYPES.NO_SPEECH_DETECTED:
        title = 'No Speech Detected';
        message = 'We couldn\'t hear you speaking. Please speak clearly into your microphone.';
        actionText = 'Try Speaking Again';
        secondaryActionText = 'Test Microphone';
        instructions = [
          'Speak clearly and directly into your microphone',
          'Check that your microphone is not muted',
          'Reduce background noise if possible'
        ];
        break;

      case AUDIO_ERROR_TYPES.VOICE_SYNTHESIS_FAILED:
        title = 'Voice Generation Failed';
        message = 'We couldn\'t generate the AI voice. The interview will continue with text only.';
        actionText = 'Continue with Text';
        secondaryActionText = 'Retry Voice';
        instructions = [
          'Check your internet connection',
          'The interview can continue without AI voice',
          'You can still use voice input for your responses'
        ];
        break;

      case AUDIO_ERROR_TYPES.AUDIO_PLAYBACK_FAILED:
        title = 'Audio Playback Failed';
        message = 'We couldn\'t play the audio. Please check your speakers or headphones.';
        actionText = 'Check Audio Settings';
        secondaryActionText = 'Continue with Text';
        instructions = [
          'Check that your speakers or headphones are connected',
          'Adjust your system volume',
          'Try refreshing the page'
        ];
        break;

      case AUDIO_ERROR_TYPES.NETWORK_AUDIO_FAILED:
        title = 'Network Connection Issue';
        message = 'Audio features require a stable internet connection. Please check your connection.';
        actionText = 'Check Connection';
        secondaryActionText = 'Switch to Text Mode';
        instructions = [
          'Check your internet connection',
          'Try moving closer to your WiFi router',
          'Text mode uses less bandwidth'
        ];
        break;

      case AUDIO_ERROR_TYPES.BROWSER_COMPATIBILITY:
        title = 'Browser Not Supported';
        message = 'Your browser doesn\'t fully support audio features. Please use Chrome, Edge, or switch to text mode.';
        actionText = 'Switch to Text Mode';
        secondaryActionText = 'Try Chrome/Edge';
        instructions = [
          'Chrome and Edge have the best audio support',
          'Make sure your browser is up to date',
          'Text mode works perfectly in all browsers'
        ];
        break;

      case AUDIO_ERROR_TYPES.AUDIO_CONTEXT_FAILED:
        title = 'Audio System Error';
        message = 'There was a problem with the audio system. Please refresh the page.';
        actionText = 'Refresh Page';
        secondaryActionText = 'Switch to Text Mode';
        instructions = [
          'Refresh the page to reset the audio system',
          'Close other tabs that might be using audio',
          'Restart your browser if the problem persists'
        ];
        break;

      default:
        title = 'Audio Error';
        message = `There was a problem with the ${operation}. You can continue with text mode.`;
        actionText = 'Try Again';
        secondaryActionText = 'Switch to Text Mode';
        instructions = [
          'Try the operation again',
          'Check your internet connection',
          'Switch to text mode if problems persist'
        ];
    }

    return {
      title,
      message,
      actionText,
      secondaryActionText,
      instructions,
      canSwitchToText,
      canRetry: classification.canRetry,
      requiresUserAction: classification.requiresUserAction,
      severity: classification.severity,
      type: classification.type,
      recoveryStrategy: classification.recoveryStrategy,
      originalError: error
    };
  }

  /**
   * Handle audio error with automatic recovery
   * @param {Error} error - The error that occurred
   * @param {Object} context - Error context
   * @param {Object} options - Handling options
   * @returns {Promise<Object>} - Recovery result
   */
  async handleAudioError(error, context = {}, options = {}) {
    const {
      onFallback = null,
      onRetry = null,
      onUserAction = null,
      autoFallback = true,
      maxRetries = 3
    } = options;

    // Classify and log the error
    const classification = this.classifyAudioError(error, context);
    const userError = this.generateAudioErrorMessage(error, context);
    
    // Add to error history
    this.addToErrorHistory(error, classification, context);
    
    // Log the error
    logError(error, { ...context, audioClassification: classification });
    
    // Notify listeners
    this.notifyListeners('audio-error', {
      error,
      classification,
      userError,
      context
    });

    // Check if we should automatically fallback
    if (autoFallback && this.shouldAutoFallback(classification)) {
      return this.executeAutoFallback(userError, onFallback);
    }

    // Check if we can retry
    if (classification.canRetry && this.canRetry(error, context, maxRetries)) {
      return this.executeRetry(error, context, userError, onRetry);
    }

    // Return error information for manual handling
    return {
      success: false,
      error: userError,
      classification,
      recommendedAction: classification.recoveryStrategy,
      canAutoRecover: false
    };
  }

  /**
   * Add error to history for pattern analysis
   * @param {Error} error - The error
   * @param {Object} classification - Error classification
   * @param {Object} context - Error context
   */
  addToErrorHistory(error, classification, context) {
    const errorEntry = {
      timestamp: Date.now(),
      error: error.message,
      type: classification.type,
      severity: classification.severity,
      context: context.operation || 'unknown',
      canRetry: classification.canRetry
    };

    this.errorHistory.push(errorEntry);

    // Keep only recent errors (last 100)
    if (this.errorHistory.length > 100) {
      this.errorHistory = this.errorHistory.slice(-100);
    }
  }

  /**
   * Check if automatic fallback should be triggered
   * @param {Object} classification - Error classification
   * @returns {boolean} - Whether to auto-fallback
   */
  shouldAutoFallback(classification) {
    // Always fallback for critical errors
    if (this.thresholds.criticalErrorTypes.includes(classification.type)) {
      return true;
    }

    // Check consecutive errors
    const recentErrors = this.getRecentErrors(this.thresholds.timeWindowMs);
    const consecutiveErrors = this.getConsecutiveErrors();

    if (consecutiveErrors >= this.thresholds.maxConsecutiveErrors) {
      return true;
    }

    if (recentErrors.length >= this.thresholds.maxErrorsInTimeWindow) {
      return true;
    }

    return false;
  }

  /**
   * Get recent errors within time window
   * @param {number} timeWindowMs - Time window in milliseconds
   * @returns {Array} - Recent errors
   */
  getRecentErrors(timeWindowMs) {
    const cutoff = Date.now() - timeWindowMs;
    return this.errorHistory.filter(error => error.timestamp > cutoff);
  }

  /**
   * Get count of consecutive errors
   * @returns {number} - Number of consecutive errors
   */
  getConsecutiveErrors() {
    let count = 0;
    for (let i = this.errorHistory.length - 1; i >= 0; i--) {
      if (this.errorHistory[i].canRetry === false) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * Check if operation can be retried
   * @param {Error} error - The error
   * @param {Object} context - Error context
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {boolean} - Whether retry is possible
   */
  canRetry(error, context, maxRetries) {
    const key = `${context.operation || 'unknown'}_${error.message}`;
    const attempts = this.recoveryAttempts.get(key) || 0;
    return attempts < maxRetries;
  }

  /**
   * Execute automatic fallback to text mode
   * @param {Object} userError - User-friendly error info
   * @param {Function} onFallback - Fallback callback
   * @returns {Object} - Fallback result
   */
  async executeAutoFallback(userError, onFallback) {
    this.notifyListeners('auto-fallback-triggered', { userError });

    if (onFallback) {
      try {
        await onFallback(userError);
        return {
          success: true,
          action: 'auto_fallback',
          message: 'Automatically switched to text mode due to audio issues.'
        };
      } catch (fallbackError) {
        console.error('Fallback execution failed:', fallbackError);
        return {
          success: false,
          error: userError,
          fallbackError: fallbackError.message
        };
      }
    }

    return {
      success: true,
      action: 'auto_fallback_ready',
      message: 'Ready to switch to text mode.',
      userError
    };
  }

  /**
   * Execute retry with exponential backoff
   * @param {Error} error - The original error
   * @param {Object} context - Error context
   * @param {Object} userError - User-friendly error info
   * @param {Function} onRetry - Retry callback
   * @returns {Object} - Retry result
   */
  async executeRetry(error, context, userError, onRetry) {
    const key = `${context.operation || 'unknown'}_${error.message}`;
    const attempts = this.recoveryAttempts.get(key) || 0;
    const newAttempts = attempts + 1;
    
    this.recoveryAttempts.set(key, newAttempts);

    // Calculate delay with exponential backoff
    const baseDelay = 1000; // 1 second
    const delay = baseDelay * Math.pow(2, attempts) + Math.random() * 1000;

    this.notifyListeners('retry-scheduled', {
      error: userError,
      attempt: newAttempts,
      delay
    });

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));

    if (onRetry) {
      try {
        const result = await onRetry(error, newAttempts);
        
        // Clear retry count on success
        this.recoveryAttempts.delete(key);
        
        this.notifyListeners('retry-success', {
          attempt: newAttempts,
          result
        });

        return {
          success: true,
          action: 'retry_success',
          attempt: newAttempts,
          result
        };
      } catch (retryError) {
        this.notifyListeners('retry-failed', {
          attempt: newAttempts,
          error: retryError
        });

        return {
          success: false,
          action: 'retry_failed',
          attempt: newAttempts,
          error: retryError.message,
          originalError: userError
        };
      }
    }

    return {
      success: false,
      action: 'retry_ready',
      attempt: newAttempts,
      userError
    };
  }

  /**
   * Register fallback callback for specific error types
   * @param {string} errorType - Error type to handle
   * @param {Function} callback - Fallback callback
   */
  registerFallback(errorType, callback) {
    this.fallbackCallbacks.set(errorType, callback);
  }

  /**
   * Execute registered fallback for error type
   * @param {string} errorType - Error type
   * @param {Object} context - Error context
   * @returns {Promise<boolean>} - Whether fallback was executed
   */
  async executeFallback(errorType, context = {}) {
    const callback = this.fallbackCallbacks.get(errorType);
    if (callback) {
      try {
        await callback(context);
        return true;
      } catch (error) {
        console.error(`Fallback execution failed for ${errorType}:`, error);
        return false;
      }
    }
    return false;
  }

  /**
   * Get error statistics and health metrics
   * @returns {Object} - Error statistics
   */
  getErrorStats() {
    const now = Date.now();
    const recentErrors = this.getRecentErrors(this.thresholds.timeWindowMs);
    const consecutiveErrors = this.getConsecutiveErrors();

    const errorsByType = {};
    recentErrors.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    });

    const totalErrors = this.errorHistory.length;
    const criticalErrors = this.errorHistory.filter(e => e.severity === ERROR_SEVERITY.CRITICAL).length;

    return {
      totalErrors,
      recentErrors: recentErrors.length,
      consecutiveErrors,
      criticalErrors,
      errorsByType,
      healthStatus: this.getHealthStatus(recentErrors, consecutiveErrors),
      lastError: this.errorHistory[this.errorHistory.length - 1] || null,
      recoveryAttempts: Object.fromEntries(this.recoveryAttempts)
    };
  }

  /**
   * Get overall health status
   * @param {Array} recentErrors - Recent errors
   * @param {number} consecutiveErrors - Consecutive error count
   * @returns {string} - Health status
   */
  getHealthStatus(recentErrors, consecutiveErrors) {
    if (consecutiveErrors >= this.thresholds.maxConsecutiveErrors) {
      return 'critical';
    }
    if (recentErrors.length >= this.thresholds.maxErrorsInTimeWindow) {
      return 'degraded';
    }
    if (recentErrors.length > 0) {
      return 'warning';
    }
    return 'healthy';
  }

  /**
   * Clear error history and reset recovery attempts
   */
  reset() {
    this.errorHistory = [];
    this.recoveryAttempts.clear();
    this.notifyListeners('error-handler-reset');
  }

  /**
   * Update error handling thresholds
   * @param {Object} newThresholds - New threshold values
   */
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.notifyListeners('thresholds-updated', { thresholds: this.thresholds });
  }
}

// Create singleton instance
export const audioErrorHandler = new AudioErrorHandler();
export default audioErrorHandler;