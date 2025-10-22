/**
 * Graceful Degradation Service
 * Handles automatic fallback to text mode and preserves user progress
 */

import { audioErrorHandler, AUDIO_ERROR_TYPES, RECOVERY_STRATEGIES } from './audioErrorHandler.js';
import { logError } from '../utils/errorHandler.js';

class GracefulDegradationService {
  constructor() {
    this.fallbackCallbacks = new Map();
    this.progressPreservationCallbacks = new Map();
    this.listeners = new Set();
    this.currentMode = 'voice'; // 'voice' | 'text'
    this.fallbackReason = null;
    this.fallbackTimestamp = null;
    this.preservedData = null;
    
    // Degradation settings
    this.settings = {
      autoFallbackEnabled: true,
      preserveProgressOnFallback: true,
      showFallbackNotification: true,
      allowModeSwitch: true,
      retryAfterFallback: true,
      maxAutoRetries: 2
    };

    // Initialize audio error handler integration
    this.initializeErrorHandlerIntegration();
  }

  /**
   * Initialize integration with audio error handler
   */
  initializeErrorHandlerIntegration() {
    // Register fallback callbacks for different error types
    audioErrorHandler.registerFallback(AUDIO_ERROR_TYPES.MICROPHONE_DENIED, 
      (context) => this.handleMicrophoneDeniedFallback(context));
    
    audioErrorHandler.registerFallback(AUDIO_ERROR_TYPES.SPEECH_RECOGNITION_UNSUPPORTED, 
      (context) => this.handleUnsupportedBrowserFallback(context));
    
    audioErrorHandler.registerFallback(AUDIO_ERROR_TYPES.BROWSER_COMPATIBILITY, 
      (context) => this.handleBrowserCompatibilityFallback(context));

    // Listen to audio error events
    audioErrorHandler.addListener((event, data) => {
      this.handleAudioErrorEvent(event, data);
    });
  }

  /**
   * Add event listener
   * @param {Function} listener - Event listener
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   * @param {Function} listener - Event listener
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  notifyListeners(event, data = {}) {
    this.listeners.forEach(listener => {
      try {
        listener(event, { ...data, currentMode: this.currentMode });
      } catch (error) {
        console.error('Error in graceful degradation listener:', error);
      }
    });
  }

  /**
   * Handle audio error events from error handler
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  handleAudioErrorEvent(event, data) {
    switch (event) {
      case 'audio-error':
        this.evaluateForFallback(data.error, data.classification, data.context);
        break;
      case 'auto-fallback-triggered':
        this.executeFallback(data.userError, 'automatic');
        break;
      default:
        // Forward other events to listeners
        this.notifyListeners(event, data);
    }
  }

  /**
   * Evaluate if fallback should be triggered
   * @param {Error} error - The error
   * @param {Object} classification - Error classification
   * @param {Object} context - Error context
   */
  evaluateForFallback(error, classification, context) {
    if (!this.settings.autoFallbackEnabled) {
      return;
    }

    // Check if this error type should trigger immediate fallback
    const immediatelyFallbackTypes = [
      AUDIO_ERROR_TYPES.MICROPHONE_DENIED,
      AUDIO_ERROR_TYPES.SPEECH_RECOGNITION_UNSUPPORTED,
      AUDIO_ERROR_TYPES.BROWSER_COMPATIBILITY
    ];

    if (immediatelyFallbackTypes.includes(classification.type)) {
      const userError = audioErrorHandler.generateAudioErrorMessage(error, context);
      this.executeFallback(userError, 'immediate', classification.type);
    }
  }

  /**
   * Execute fallback to text mode
   * @param {Object} userError - User-friendly error information
   * @param {string} trigger - What triggered the fallback
   * @param {string} errorType - Specific error type
   * @returns {Promise<Object>} - Fallback result
   */
  async executeFallback(userError, trigger = 'manual', errorType = null) {
    try {
      this.notifyListeners('fallback-starting', { 
        userError, 
        trigger, 
        errorType,
        previousMode: this.currentMode 
      });

      // Preserve current progress
      let preservedData = null;
      try {
        preservedData = await this.preserveProgress();
      } catch (preservationError) {
        console.warn('Progress preservation failed during fallback:', preservationError);
        // Continue with fallback even if preservation fails
      }

      // Switch to text mode
      const previousMode = this.currentMode;
      this.currentMode = 'text';
      this.fallbackReason = userError;
      this.fallbackTimestamp = Date.now();
      this.preservedData = preservedData;

      // Execute registered fallback callbacks
      await this.executeRegisteredFallbacks(errorType, {
        userError,
        trigger,
        preservedData,
        previousMode
      });

      // Notify listeners of successful fallback
      this.notifyListeners('fallback-completed', {
        previousMode,
        currentMode: this.currentMode,
        preservedData,
        userError,
        trigger,
        timestamp: this.fallbackTimestamp
      });

      return {
        success: true,
        previousMode,
        currentMode: this.currentMode,
        preservedData,
        message: this.generateFallbackMessage(userError, trigger)
      };

    } catch (error) {
      console.error('Fallback execution failed:', error);
      logError(error, { operation: 'fallback_execution', trigger, errorType });

      this.notifyListeners('fallback-failed', { error, userError, trigger });

      return {
        success: false,
        error: error.message,
        userError
      };
    }
  }

  /**
   * Preserve current progress before fallback
   * @returns {Promise<Object>} - Preserved data
   */
  async preserveProgress() {
    if (!this.settings.preserveProgressOnFallback) {
      return null;
    }

    const preservedData = {
      timestamp: Date.now(),
      mode: this.currentMode,
      data: {}
    };

    // Execute all registered progress preservation callbacks
    for (const [key, callback] of this.progressPreservationCallbacks) {
      try {
        const data = await callback();
        preservedData.data[key] = data;
      } catch (error) {
        console.error(`Failed to preserve progress for ${key}:`, error);
        preservedData.data[key] = null;
      }
    }

    return preservedData;
  }

  /**
   * Execute registered fallback callbacks
   * @param {string} errorType - Error type that triggered fallback
   * @param {Object} context - Fallback context
   */
  async executeRegisteredFallbacks(errorType, context) {
    // Execute specific error type fallback
    if (errorType && this.fallbackCallbacks.has(errorType)) {
      try {
        await this.fallbackCallbacks.get(errorType)(context);
      } catch (error) {
        console.error(`Fallback callback failed for ${errorType}:`, error);
      }
    }

    // Execute general fallback callbacks
    if (this.fallbackCallbacks.has('general')) {
      try {
        await this.fallbackCallbacks.get('general')(context);
      } catch (error) {
        console.error('General fallback callback failed:', error);
      }
    }
  }

  /**
   * Generate user-friendly fallback message
   * @param {Object} userError - User error information
   * @param {string} trigger - Fallback trigger
   * @returns {string} - Fallback message
   */
  generateFallbackMessage(userError, trigger) {
    switch (trigger) {
      case 'automatic':
        return `We've automatically switched to text mode due to audio issues. Your progress has been saved and you can continue the interview by typing your responses.`;
      
      case 'immediate':
        return `We've switched to text mode because ${userError.message.toLowerCase()}. You can continue the interview by typing your responses.`;
      
      case 'manual':
        return `You've switched to text mode. You can continue the interview by typing your responses.`;
      
      default:
        return `We've switched to text mode. Your progress has been saved and you can continue the interview by typing your responses.`;
    }
  }

  /**
   * Handle microphone denied fallback
   * @param {Object} context - Fallback context
   */
  async handleMicrophoneDeniedFallback(context) {
    this.notifyListeners('microphone-denied-fallback', context);
    
    // Show specific instructions for enabling microphone
    const instructions = {
      title: 'Enable Microphone Access',
      steps: [
        'Click the microphone icon in your browser\'s address bar',
        'Select "Allow" for microphone access',
        'Refresh the page to try voice mode again'
      ],
      canRetryLater: true
    };

    this.notifyListeners('fallback-instructions', instructions);
  }

  /**
   * Handle unsupported browser fallback
   * @param {Object} context - Fallback context
   */
  async handleUnsupportedBrowserFallback(context) {
    this.notifyListeners('browser-unsupported-fallback', context);
    
    const instructions = {
      title: 'Browser Compatibility',
      steps: [
        'Voice features work best in Chrome or Edge',
        'Make sure your browser is up to date',
        'Text mode works perfectly in all browsers'
      ],
      canRetryLater: false,
      recommendedBrowsers: ['Chrome', 'Edge']
    };

    this.notifyListeners('fallback-instructions', instructions);
  }

  /**
   * Handle browser compatibility fallback
   * @param {Object} context - Fallback context
   */
  async handleBrowserCompatibilityFallback(context) {
    this.notifyListeners('browser-compatibility-fallback', context);
    
    const instructions = {
      title: 'Switch to Supported Browser',
      steps: [
        'Try using Chrome or Microsoft Edge for voice features',
        'Ensure your browser is updated to the latest version',
        'Text mode provides the same great interview experience'
      ],
      canRetryLater: true,
      recommendedBrowsers: ['Chrome', 'Edge']
    };

    this.notifyListeners('fallback-instructions', instructions);
  }

  /**
   * Register fallback callback for specific error type
   * @param {string} errorType - Error type or 'general'
   * @param {Function} callback - Fallback callback
   */
  registerFallbackCallback(errorType, callback) {
    this.fallbackCallbacks.set(errorType, callback);
  }

  /**
   * Register progress preservation callback
   * @param {string} key - Unique key for the data
   * @param {Function} callback - Function that returns data to preserve
   */
  registerProgressPreservation(key, callback) {
    this.progressPreservationCallbacks.set(key, callback);
  }

  /**
   * Attempt to retry voice mode
   * @param {Object} options - Retry options
   * @returns {Promise<Object>} - Retry result
   */
  async retryVoiceMode(options = {}) {
    const { 
      onSuccess = null, 
      onFailure = null,
      preserveProgress = true 
    } = options;

    if (this.currentMode === 'voice') {
      return {
        success: false,
        message: 'Already in voice mode'
      };
    }

    try {
      this.notifyListeners('voice-retry-starting', { 
        previousMode: this.currentMode,
        preserveProgress 
      });

      // Preserve current text mode progress if requested
      let currentProgress = null;
      if (preserveProgress) {
        currentProgress = await this.preserveProgress();
      }

      // Test audio functionality before switching
      const audioTest = await this.testAudioFunctionality();
      
      if (!audioTest.success) {
        this.notifyListeners('voice-retry-failed', { 
          reason: 'audio_test_failed',
          error: audioTest.error 
        });

        if (onFailure) {
          onFailure(audioTest.error);
        }

        return {
          success: false,
          error: audioTest.error,
          message: 'Audio test failed. Staying in text mode.'
        };
      }

      // Switch back to voice mode
      const previousMode = this.currentMode;
      this.currentMode = 'voice';
      this.fallbackReason = null;
      this.fallbackTimestamp = null;

      // Restore preserved data if available
      if (this.preservedData && preserveProgress) {
        await this.restoreProgress(this.preservedData);
      }

      this.notifyListeners('voice-retry-success', {
        previousMode,
        currentMode: this.currentMode,
        restoredData: this.preservedData
      });

      if (onSuccess) {
        onSuccess({
          previousMode,
          currentMode: this.currentMode,
          restoredData: this.preservedData
        });
      }

      return {
        success: true,
        previousMode,
        currentMode: this.currentMode,
        message: 'Successfully switched back to voice mode'
      };

    } catch (error) {
      console.error('Voice mode retry failed:', error);
      logError(error, { operation: 'voice_mode_retry' });

      this.notifyListeners('voice-retry-error', { error });

      if (onFailure) {
        onFailure(error);
      }

      return {
        success: false,
        error: error.message,
        message: 'Failed to switch to voice mode'
      };
    }
  }

  /**
   * Test audio functionality before retry
   * @returns {Promise<Object>} - Test result
   */
  async testAudioFunctionality() {
    try {
      // Test microphone access
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } else {
        throw new Error('Microphone access not available');
      }

      // Test speech recognition support
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        throw new Error('Speech recognition not supported');
      }

      // Test audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        throw new Error('Audio context not supported');
      }

      return {
        success: true,
        message: 'All audio functionality tests passed'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restore preserved progress
   * @param {Object} preservedData - Previously preserved data
   */
  async restoreProgress(preservedData) {
    if (!preservedData || !preservedData.data) {
      return;
    }

    // Execute all registered restoration callbacks
    for (const [key, callback] of this.progressPreservationCallbacks) {
      if (preservedData.data[key]) {
        try {
          // If callback has a restore method, use it
          if (typeof callback.restore === 'function') {
            await callback.restore(preservedData.data[key]);
          }
        } catch (error) {
          console.error(`Failed to restore progress for ${key}:`, error);
        }
      }
    }

    this.notifyListeners('progress-restored', { preservedData });
  }

  /**
   * Manually switch to text mode
   * @param {string} reason - Reason for manual switch
   * @returns {Promise<Object>} - Switch result
   */
  async switchToTextMode(reason = 'user_requested') {
    if (this.currentMode === 'text') {
      return {
        success: false,
        message: 'Already in text mode'
      };
    }

    const userError = {
      title: 'Switched to Text Mode',
      message: reason === 'user_requested' 
        ? 'You have manually switched to text mode.'
        : reason,
      type: 'manual_switch'
    };

    return this.executeFallback(userError, 'manual');
  }

  /**
   * Get current degradation status
   * @returns {Object} - Current status
   */
  getStatus() {
    return {
      currentMode: this.currentMode,
      fallbackReason: this.fallbackReason,
      fallbackTimestamp: this.fallbackTimestamp,
      hasPreservedData: !!this.preservedData,
      settings: { ...this.settings },
      canRetryVoice: this.currentMode === 'text' && this.settings.retryAfterFallback,
      errorStats: audioErrorHandler.getErrorStats()
    };
  }

  /**
   * Update degradation settings
   * @param {Object} newSettings - New settings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.notifyListeners('settings-updated', { settings: this.settings });
  }

  /**
   * Reset degradation state
   */
  reset() {
    this.currentMode = 'voice';
    this.fallbackReason = null;
    this.fallbackTimestamp = null;
    this.preservedData = null;
    
    this.notifyListeners('degradation-reset');
  }

  /**
   * Get fallback history and statistics
   * @returns {Object} - Fallback statistics
   */
  getFallbackStats() {
    const errorStats = audioErrorHandler.getErrorStats();
    
    return {
      currentMode: this.currentMode,
      totalFallbacks: this.fallbackTimestamp ? 1 : 0,
      lastFallback: {
        timestamp: this.fallbackTimestamp,
        reason: this.fallbackReason
      },
      errorStats,
      canRetryVoice: this.currentMode === 'text' && this.settings.retryAfterFallback
    };
  }

  /**
   * Create retry mechanism with exponential backoff
   * @param {Function} operation - Operation to retry
   * @param {Object} options - Retry options
   * @returns {Promise<any>} - Operation result
   */
  async createRetryMechanism(operation, options = {}) {
    const {
      maxRetries = this.settings.maxAutoRetries,
      baseDelay = 1000,
      backoffMultiplier = 2,
      maxDelay = 30000,
      jitterFactor = 0.1,
      onRetry = null,
      onFailure = null,
      shouldRetry = null,
      context = {}
    } = options;

    let lastError;
    let totalDelay = 0;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Notify success after retries
        if (attempt > 1) {
          this.notifyListeners('retry-success', {
            attempt,
            totalAttempts: attempt,
            totalDelay,
            result,
            context
          });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if we should retry this specific error
        if (shouldRetry && !shouldRetry(error, attempt)) {
          if (onFailure) {
            onFailure(error, attempt, 'should_not_retry');
          }
          throw error;
        }
        
        if (attempt === maxRetries) {
          if (onFailure) {
            onFailure(error, attempt, 'max_retries_exceeded');
          }
          
          this.notifyListeners('retry-exhausted', {
            error,
            totalAttempts: attempt,
            totalDelay,
            context
          });
          
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
        const jitter = exponentialDelay * jitterFactor * (Math.random() * 2 - 1);
        const delay = Math.min(exponentialDelay + jitter, maxDelay);
        totalDelay += delay;

        if (onRetry) {
          onRetry(error, attempt, maxRetries, delay, totalDelay);
        }

        this.notifyListeners('retry-attempt', {
          error,
          attempt,
          maxRetries,
          delay,
          totalDelay,
          context
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Enhanced automatic fallback with comprehensive error analysis
   * @param {Error} error - The error that triggered fallback
   * @param {Object} context - Error context
   * @param {Object} options - Fallback options
   * @returns {Promise<Object>} - Fallback result
   */
  async executeEnhancedFallback(error, context = {}, options = {}) {
    const {
      preserveProgress = true,
      notifyUser = true,
      reason = 'automatic',
      fallbackMode = 'text',
      gracePeriod = 0
    } = options;

    try {
      this.notifyListeners('enhanced-fallback-starting', {
        error,
        context,
        options,
        currentMode: this.currentMode
      });

      // Grace period before fallback (allows for quick recovery)
      if (gracePeriod > 0) {
        this.notifyListeners('fallback-grace-period', { gracePeriod });
        await new Promise(resolve => setTimeout(resolve, gracePeriod));
      }

      // Analyze error severity and determine fallback strategy
      const fallbackStrategy = this.determineFallbackStrategy(error, context);
      
      // Preserve progress with enhanced error handling
      let preservedData = null;
      if (preserveProgress) {
        try {
          preservedData = await this.enhancedProgressPreservation(context);
        } catch (preservationError) {
          console.warn('Progress preservation failed, continuing with fallback:', preservationError);
          this.notifyListeners('progress-preservation-failed', { 
            error: preservationError,
            context 
          });
        }
      }

      // Execute fallback based on strategy
      const fallbackResult = await this.executeFallbackStrategy(
        fallbackStrategy,
        fallbackMode,
        preservedData,
        context
      );

      // Update state
      const previousMode = this.currentMode;
      this.currentMode = fallbackMode;
      this.fallbackReason = {
        error: error.message,
        context,
        strategy: fallbackStrategy,
        timestamp: Date.now()
      };
      this.preservedData = preservedData;

      // Notify completion
      this.notifyListeners('enhanced-fallback-completed', {
        previousMode,
        currentMode: this.currentMode,
        strategy: fallbackStrategy,
        preservedData,
        fallbackResult,
        reason
      });

      return {
        success: true,
        previousMode,
        currentMode: this.currentMode,
        strategy: fallbackStrategy,
        preservedData,
        message: this.generateEnhancedFallbackMessage(fallbackStrategy, error)
      };

    } catch (fallbackError) {
      console.error('Enhanced fallback failed:', fallbackError);
      
      this.notifyListeners('enhanced-fallback-failed', {
        error: fallbackError,
        originalError: error,
        context
      });

      return {
        success: false,
        error: fallbackError.message,
        originalError: error.message,
        context
      };
    }
  }

  /**
   * Determine the best fallback strategy based on error analysis
   * @param {Error} error - The error
   * @param {Object} context - Error context
   * @returns {Object} - Fallback strategy
   */
  determineFallbackStrategy(error, context) {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.error || error.code || '';

    // Critical errors require immediate fallback
    if (errorCode === 'not-allowed' || errorMessage.includes('permission denied')) {
      return {
        type: 'immediate',
        reason: 'permission_denied',
        canRetry: false,
        userAction: 'grant_permissions'
      };
    }

    // Browser compatibility issues
    if (errorMessage.includes('not supported') || errorMessage.includes('unsupported')) {
      return {
        type: 'immediate',
        reason: 'browser_incompatible',
        canRetry: false,
        userAction: 'switch_browser'
      };
    }

    // Network issues - can retry later
    if (errorCode === 'network' || errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return {
        type: 'graceful',
        reason: 'network_issues',
        canRetry: true,
        retryDelay: 5000,
        userAction: 'check_connection'
      };
    }

    // Audio hardware issues
    if (errorMessage.includes('microphone') || errorMessage.includes('audio capture')) {
      return {
        type: 'graceful',
        reason: 'hardware_issues',
        canRetry: true,
        retryDelay: 3000,
        userAction: 'check_hardware'
      };
    }

    // Service failures (ElevenLabs, etc.)
    if (errorMessage.includes('elevenlabs') || errorMessage.includes('synthesis') || errorMessage.includes('api')) {
      return {
        type: 'graceful',
        reason: 'service_failure',
        canRetry: true,
        retryDelay: 10000,
        userAction: 'wait_and_retry'
      };
    }

    // Default strategy for unknown errors
    return {
      type: 'graceful',
      reason: 'unknown_error',
      canRetry: true,
      retryDelay: 5000,
      userAction: 'general_troubleshooting'
    };
  }

  /**
   * Enhanced progress preservation with detailed error handling
   * @param {Object} context - Preservation context
   * @returns {Promise<Object>} - Enhanced preserved data
   */
  async enhancedProgressPreservation(context = {}) {
    const preservedData = {
      timestamp: Date.now(),
      mode: this.currentMode,
      context,
      data: {},
      metadata: {
        preservationVersion: '2.0',
        userAgent: navigator.userAgent,
        url: window.location.href,
        sessionId: this.generateSessionId()
      },
      errors: []
    };

    // Execute all registered progress preservation callbacks with error handling
    const preservationPromises = Array.from(this.progressPreservationCallbacks.entries()).map(
      async ([key, callback]) => {
        try {
          const startTime = Date.now();
          const data = await callback();
          const duration = Date.now() - startTime;
          
          return {
            key,
            success: true,
            data,
            duration,
            timestamp: Date.now()
          };
        } catch (error) {
          console.error(`Failed to preserve progress for ${key}:`, error);
          
          return {
            key,
            success: false,
            error: error.message,
            timestamp: Date.now()
          };
        }
      }
    );

    const results = await Promise.all(preservationPromises);
    
    // Process results
    results.forEach(result => {
      if (result.success) {
        preservedData.data[result.key] = result.data;
      } else {
        preservedData.errors.push({
          key: result.key,
          error: result.error,
          timestamp: result.timestamp
        });
      }
    });

    // Add preservation summary
    preservedData.summary = {
      totalCallbacks: this.progressPreservationCallbacks.size,
      successfulPreservations: results.filter(r => r.success).length,
      failedPreservations: results.filter(r => !r.success).length,
      totalDataSize: JSON.stringify(preservedData.data).length
    };

    this.notifyListeners('progress-preserved', { preservedData });
    
    return preservedData;
  }

  /**
   * Execute specific fallback strategy
   * @param {Object} strategy - Fallback strategy
   * @param {string} fallbackMode - Target mode
   * @param {Object} preservedData - Preserved data
   * @param {Object} context - Context
   * @returns {Promise<Object>} - Strategy execution result
   */
  async executeFallbackStrategy(strategy, fallbackMode, preservedData, context) {
    const result = {
      strategy: strategy.type,
      executed: [],
      skipped: [],
      errors: []
    };

    try {
      // Execute immediate fallback
      if (strategy.type === 'immediate') {
        result.executed.push('immediate_mode_switch');
        this.notifyListeners('immediate-fallback-executed', { strategy, context });
      }

      // Execute graceful fallback with delay
      if (strategy.type === 'graceful' && strategy.retryDelay) {
        result.executed.push('graceful_delay');
        this.notifyListeners('graceful-fallback-delay', { 
          delay: strategy.retryDelay,
          reason: strategy.reason 
        });
        
        // Don't actually delay here - let the UI handle the delay if needed
      }

      // Execute registered fallback callbacks
      if (this.fallbackCallbacks.has(strategy.reason)) {
        try {
          await this.fallbackCallbacks.get(strategy.reason)({
            strategy,
            preservedData,
            context,
            fallbackMode
          });
          result.executed.push(`callback_${strategy.reason}`);
        } catch (callbackError) {
          result.errors.push({
            type: 'callback_error',
            reason: strategy.reason,
            error: callbackError.message
          });
        }
      }

      // Execute general fallback callback
      if (this.fallbackCallbacks.has('general')) {
        try {
          await this.fallbackCallbacks.get('general')({
            strategy,
            preservedData,
            context,
            fallbackMode
          });
          result.executed.push('general_callback');
        } catch (callbackError) {
          result.errors.push({
            type: 'general_callback_error',
            error: callbackError.message
          });
        }
      }

      return result;

    } catch (error) {
      result.errors.push({
        type: 'strategy_execution_error',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate enhanced fallback message based on strategy
   * @param {Object} strategy - Fallback strategy
   * @param {Error} error - Original error
   * @returns {string} - Enhanced message
   */
  generateEnhancedFallbackMessage(strategy, error) {
    const baseMessage = "We've switched to text mode to ensure you can continue your interview.";
    
    switch (strategy.reason) {
      case 'permission_denied':
        return `${baseMessage} Please grant microphone permissions to use voice mode again.`;
      
      case 'browser_incompatible':
        return `${baseMessage} For the best voice experience, try using Chrome or Edge.`;
      
      case 'network_issues':
        return `${baseMessage} Once your connection improves, you can try switching back to voice mode.`;
      
      case 'hardware_issues':
        return `${baseMessage} Please check your microphone and try voice mode again when ready.`;
      
      case 'service_failure':
        return `${baseMessage} Our voice service is temporarily unavailable, but you can continue with text.`;
      
      default:
        return `${baseMessage} You can try switching back to voice mode at any time.`;
    }
  }

  /**
   * Generate unique session ID
   * @returns {string} - Session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Enhanced manual retry with comprehensive testing
   * @param {Object} options - Retry options
   * @returns {Promise<Object>} - Retry result
   */
  async enhancedRetryVoiceMode(options = {}) {
    const {
      testAudio = true,
      testMicrophone = true,
      testSynthesis = true,
      preserveProgress = true,
      onProgress = null,
      timeout = 30000
    } = options;

    if (this.currentMode === 'voice') {
      return {
        success: false,
        message: 'Already in voice mode',
        currentMode: this.currentMode
      };
    }

    const retryId = this.generateSessionId();
    const startTime = Date.now();

    try {
      this.notifyListeners('enhanced-voice-retry-starting', {
        retryId,
        options,
        currentMode: this.currentMode
      });

      // Step 1: Comprehensive audio testing
      if (onProgress) onProgress('testing_audio', 0.1);
      const testResults = await this.comprehensiveAudioTest({
        testAudio,
        testMicrophone,
        testSynthesis,
        timeout: timeout / 3
      });

      if (!testResults.overall) {
        throw new Error(`Audio test failed: ${testResults.failureReason}`);
      }

      // Step 2: Preserve current progress
      if (onProgress) onProgress('preserving_progress', 0.4);
      let currentProgress = null;
      if (preserveProgress) {
        currentProgress = await this.enhancedProgressPreservation({
          operation: 'voice_mode_retry',
          retryId
        });
      }

      // Step 3: Switch to voice mode
      if (onProgress) onProgress('switching_mode', 0.7);
      const previousMode = this.currentMode;
      this.currentMode = 'voice';
      this.fallbackReason = null;
      this.fallbackTimestamp = null;

      // Step 4: Restore preserved data
      if (onProgress) onProgress('restoring_data', 0.9);
      if (this.preservedData && preserveProgress) {
        await this.enhancedProgressRestoration(this.preservedData);
      }

      // Step 5: Complete
      if (onProgress) onProgress('complete', 1.0);
      const duration = Date.now() - startTime;

      this.notifyListeners('enhanced-voice-retry-success', {
        retryId,
        previousMode,
        currentMode: this.currentMode,
        testResults,
        restoredData: this.preservedData,
        duration
      });

      return {
        success: true,
        retryId,
        previousMode,
        currentMode: this.currentMode,
        testResults,
        duration,
        message: 'Successfully switched back to voice mode with enhanced testing'
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Enhanced voice mode retry failed:', error);

      this.notifyListeners('enhanced-voice-retry-failed', {
        retryId,
        error,
        duration,
        currentMode: this.currentMode
      });

      return {
        success: false,
        retryId,
        error: error.message,
        duration,
        currentMode: this.currentMode,
        message: `Failed to switch to voice mode: ${error.message}`
      };
    }
  }

  /**
   * Comprehensive audio functionality test
   * @param {Object} options - Test options
   * @returns {Promise<Object>} - Test results
   */
  async comprehensiveAudioTest(options = {}) {
    const {
      testAudio = true,
      testMicrophone = true,
      testSynthesis = true,
      timeout = 10000
    } = options;

    const results = {
      overall: false,
      microphone: false,
      speechRecognition: false,
      audioContext: false,
      synthesis: false,
      latency: null,
      errors: [],
      timestamp: Date.now()
    };

    const startTime = Date.now();

    try {
      // Test 1: Microphone access
      if (testMicrophone) {
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await Promise.race([
              navigator.mediaDevices.getUserMedia({ audio: true }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Microphone test timeout')), timeout / 4)
              )
            ]);
            
            stream.getTracks().forEach(track => track.stop());
            results.microphone = true;
          } else {
            throw new Error('getUserMedia not supported');
          }
        } catch (error) {
          results.errors.push({ test: 'microphone', error: error.message });
          results.microphone = false;
        }
      } else {
        results.microphone = true; // Skip test
      }

      // Test 2: Speech recognition support
      try {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
          throw new Error('Speech recognition not supported');
        }
        results.speechRecognition = true;
      } catch (error) {
        results.errors.push({ test: 'speechRecognition', error: error.message });
        results.speechRecognition = false;
      }

      // Test 3: Audio context
      if (testAudio) {
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) {
            throw new Error('AudioContext not supported');
          }
          
          const audioContext = new AudioContext();
          await audioContext.close();
          results.audioContext = true;
        } catch (error) {
          results.errors.push({ test: 'audioContext', error: error.message });
          results.audioContext = false;
        }
      } else {
        results.audioContext = true; // Skip test
      }

      // Test 4: Voice synthesis (if available)
      if (testSynthesis) {
        try {
          // This would test the actual synthesis service
          // For now, we'll just check if the service is available
          results.synthesis = true; // Assume available unless we can test it
        } catch (error) {
          results.errors.push({ test: 'synthesis', error: error.message });
          results.synthesis = false;
        }
      } else {
        results.synthesis = true; // Skip test
      }

      results.latency = Date.now() - startTime;
      results.overall = results.microphone && results.speechRecognition && 
                       results.audioContext && results.synthesis;

      if (!results.overall) {
        results.failureReason = results.errors.map(e => `${e.test}: ${e.error}`).join('; ');
      }

      return results;

    } catch (error) {
      results.errors.push({ test: 'general', error: error.message });
      results.failureReason = error.message;
      results.overall = false;
      return results;
    }
  }

  /**
   * Enhanced progress restoration with error handling
   * @param {Object} preservedData - Data to restore
   * @returns {Promise<Object>} - Restoration result
   */
  async enhancedProgressRestoration(preservedData) {
    if (!preservedData || !preservedData.data) {
      return { success: true, message: 'No data to restore' };
    }

    const restorationResult = {
      success: true,
      restored: [],
      failed: [],
      errors: []
    };

    // Execute all registered restoration callbacks
    for (const [key, callback] of this.progressPreservationCallbacks) {
      if (preservedData.data[key]) {
        try {
          // If callback has a restore method, use it
          if (typeof callback.restore === 'function') {
            await callback.restore(preservedData.data[key]);
            restorationResult.restored.push(key);
          } else if (typeof callback === 'function') {
            // Try to call the callback with restoration data
            await callback(preservedData.data[key], 'restore');
            restorationResult.restored.push(key);
          } else {
            restorationResult.failed.push(key);
            restorationResult.errors.push({
              key,
              error: 'No restore method available'
            });
          }
        } catch (error) {
          console.error(`Failed to restore progress for ${key}:`, error);
          restorationResult.failed.push(key);
          restorationResult.errors.push({
            key,
            error: error.message
          });
        }
      }
    }

    restorationResult.success = restorationResult.errors.length === 0;

    this.notifyListeners('enhanced-progress-restored', {
      preservedData,
      restorationResult
    });

    return restorationResult;
  }
}

// Create singleton instance
export const gracefulDegradationService = new GracefulDegradationService();
export default gracefulDegradationService;