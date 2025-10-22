/**
 * Timer Helper Utilities
 * Common patterns and helpers for the unified timer system
 */

import { ACTION_TYPES, PRIORITIES } from '../hooks/useUnifiedTimer';

/**
 * Helper functions for common timer patterns
 */
export const TimerHelpers = {
  
  /**
   * Schedule an auto-save operation
   * @param {Object} timer - useUnifiedTimer instance
   * @param {string} text - Text to save
   * @param {Function} saveCallback - Function to call for saving
   * @param {number} delay - Delay in milliseconds (default: 5000)
   */
  scheduleAutoSave: (timer, text, saveCallback, delay = 5000) => {
    if (!text || !text.trim() || text.trim().length < 10) {
      return null; // Don't save empty or very short text
    }

    return timer.schedule(
      ACTION_TYPES.AUTO_SAVE,
      delay,
      saveCallback,
      { text: text.trim(), timestamp: Date.now() },
      PRIORITIES.AUTO_SAVE
    );
  },

  /**
   * Schedule error message clearing
   * @param {Object} timer - useUnifiedTimer instance
   * @param {Function} clearCallback - Function to clear the error
   * @param {string} errorType - Type of error for conflict resolution
   * @param {number} delay - Delay in milliseconds (default: 5000)
   */
  scheduleErrorClear: (timer, clearCallback, errorType = 'general', delay = 5000) => {
    return timer.schedule(
      ACTION_TYPES.ERROR_CLEAR,
      delay,
      clearCallback,
      { errorType, clearedAt: Date.now() },
      PRIORITIES.ERROR_CLEAR
    );
  },

  /**
   * Schedule caption hiding
   * @param {Object} timer - useUnifiedTimer instance
   * @param {Function} hideCallback - Function to hide caption
   * @param {number} delay - Delay in milliseconds (default: 1200)
   */
  scheduleHideCaption: (timer, hideCallback, delay = 1200) => {
    return timer.schedule(
      ACTION_TYPES.HIDE_CAPTION,
      delay,
      hideCallback,
      { hiddenAt: Date.now() },
      PRIORITIES.UI_FEEDBACK
    );
  },

  /**
   * Schedule showing suggestions
   * @param {Object} timer - useUnifiedTimer instance
   * @param {Function} showCallback - Function to show suggestions
   * @param {Array} suggestions - Array of suggestions to show
   * @param {number} delay - Delay in milliseconds (default: 5000)
   */
  scheduleShowSuggestions: (timer, showCallback, suggestions = [], delay = 5000) => {
    return timer.schedule(
      ACTION_TYPES.SHOW_SUGGESTIONS,
      delay,
      showCallback,
      { suggestions, shownAt: Date.now() },
      PRIORITIES.SUGGESTIONS
    );
  },

  /**
   * Schedule a retry operation
   * @param {Object} timer - useUnifiedTimer instance
   * @param {Function} retryCallback - Function to retry
   * @param {number} attempt - Current attempt number
   * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
   */
  scheduleRetry: (timer, retryCallback, attempt = 1, baseDelay = 1000) => {
    // Exponential backoff: delay = baseDelay * 2^(attempt-1)
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
    
    return timer.schedule(
      ACTION_TYPES.RETRY_OPERATION,
      delay,
      retryCallback,
      { attempt, delay, retriedAt: Date.now() },
      PRIORITIES.ERROR_RECOVERY
    );
  },

  /**
   * Schedule a state update
   * @param {Object} timer - useUnifiedTimer instance
   * @param {Function} updateCallback - Function to update state
   * @param {Object} updates - State updates to apply
   * @param {number} delay - Delay in milliseconds
   */
  scheduleStateUpdate: (timer, updateCallback, updates, delay) => {
    return timer.schedule(
      ACTION_TYPES.STATE_UPDATE,
      delay,
      updateCallback,
      { updates, updatedAt: Date.now() },
      PRIORITIES.UI_FEEDBACK
    );
  }
};

/**
 * Common delay constants
 */
export const DELAYS = {
  AUTO_SAVE: 300,         // 0.3 seconds for auto-save (reduced from 1 second)
  ERROR_CLEAR: 5000,      // 5 seconds to clear error messages
  CAPTION_HIDE: 1200,     // 1.2 seconds to hide captions
  SUGGESTIONS: 5000,      // 5 seconds to show suggestions
  STATUS_RESET: 3000,     // 3 seconds to reset status messages
  RETRY_BASE: 1000,       // 1 second base for retry operations
  QUICK_FEEDBACK: 500     // 0.5 seconds for quick UI feedback
};

/**
 * Timer debugging utilities
 */
export const TimerDebug = {
  
  /**
   * Log timer status to console
   * @param {Object} timer - useUnifiedTimer instance
   * @param {string} context - Context for the log
   */
  logStatus: (timer, context = 'Timer Status') => {
    const status = timer.getStatus();
    console.group(`🕐 ${context}`);
    console.log('Queue Length:', status.queueLength);
    console.log('Is Active:', status.isActive);
    console.log('Next Action:', status.nextAction);
    console.log('Metrics:', status.metrics);
    console.groupEnd();
  },

  /**
   * Create a timer monitor that logs all activity
   * @param {Object} timer - useUnifiedTimer instance
   * @param {number} interval - Monitoring interval in milliseconds
   */
  createMonitor: (timer, interval = 1000) => {
    const monitor = setInterval(() => {
      const status = timer.getStatus();
      if (status.queueLength > 0 || status.isActive) {
        TimerDebug.logStatus(timer, 'Timer Monitor');
      }
    }, interval);

    return () => clearInterval(monitor);
  }
};

/**
 * Migration helpers for converting old timeout patterns
 */
export const MigrationHelpers = {
  
  /**
   * Convert setTimeout pattern to unified timer
   * @param {Object} timer - useUnifiedTimer instance
   * @param {Function} callback - Original setTimeout callback
   * @param {number} delay - Original setTimeout delay
   * @param {string} actionType - Action type for the unified timer
   */
  convertTimeout: (timer, callback, delay, actionType = ACTION_TYPES.STATE_UPDATE) => {
    return timer.schedule(actionType, delay, callback);
  },

  /**
   * Convert clearTimeout pattern to unified timer
   * @param {Object} timer - useUnifiedTimer instance
   * @param {string} actionType - Action type to cancel
   */
  convertClearTimeout: (timer, actionType) => {
    return timer.cancelByType(actionType);
  }
};

export default TimerHelpers;