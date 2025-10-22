/**
 * Speech Recognition Service
 * Handles speech-to-text conversion using Web Speech API with optimizations
 */

import { audioErrorHandler, AUDIO_ERROR_TYPES } from './audioErrorHandler.js';
import { gracefulDegradationService } from './gracefulDegradationService.js';
import { speechOptimizationService } from './speechOptimizationService.js';

class SpeechService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isInitialized = false;
    this.currentTranscript = '';
    this.finalTranscript = '';
    
    // Event callbacks
    this.onTranscription = null;
    this.onError = null;
    this.onStart = null;
    this.onEnd = null;
    this.onSpeechStart = null;
    this.onSpeechEnd = null;
    
    // Configuration
    this.config = {
      continuous: true,
      interimResults: true,
      language: 'en-US',
      maxAlternatives: 1
    };
    
    // State tracking
    this.lastSpeechTime = null;
    this.silenceTimeout = null;
    this.restartTimeout = null;
    this.speechStarted = false;
  }

  /**
   * Initialize the speech recognition service with optimizations
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize() {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        return false;
      }

      // Check browser support
      if (!this.isSupported()) {
        throw new Error('Speech recognition not supported in this browser');
      }

      // Initialize speech optimization service
      await speechOptimizationService.initialize();

      // Get the speech recognition constructor
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();

      // Apply optimizations to recognition instance
      this.recognition = speechOptimizationService.optimizeSpeechRecognition(this.recognition);

      // Configure recognition settings
      this.recognition.continuous = this.config.continuous;
      this.recognition.interimResults = this.config.interimResults;
      this.recognition.lang = this.config.language;
      this.recognition.maxAlternatives = this.config.maxAlternatives;

      // Set up event handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      console.log('Speech recognition service initialized successfully with optimizations');
      return true;

    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Check if speech recognition is supported
   * @returns {boolean} - Whether speech recognition is supported
   */
  isSupported() {
    if (typeof window === 'undefined') {
      return false;
    }
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  /**
   * Get browser compatibility information
   * @returns {Object} - Compatibility details
   */
  getCompatibilityInfo() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        supported: false,
        webSpeechAPI: false,
        audioContext: false,
        mediaDevices: false,
        browser: { name: 'Unknown', userAgent: 'Server-side' }
      };
    }

    const hasWebSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    const hasAudioContext = 'AudioContext' in window || 'webkitAudioContext' in window;
    const hasMediaDevices = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
    
    return {
      supported: hasWebSpeech && hasAudioContext && hasMediaDevices,
      webSpeechAPI: hasWebSpeech,
      audioContext: hasAudioContext,
      mediaDevices: hasMediaDevices,
      browser: this.getBrowserInfo()
    };
  }

  /**
   * Get browser information
   * @returns {Object} - Browser details
   */
  getBrowserInfo() {
    if (typeof navigator === 'undefined') {
      return {
        name: 'Unknown',
        userAgent: 'Server-side'
      };
    }

    const userAgent = navigator.userAgent;
    let browser = 'Unknown';
    
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';
    
    return {
      name: browser,
      userAgent: userAgent,
      language: navigator.language
    };
  }

  /**
   * Set up event handlers for speech recognition
   */
  setupEventHandlers() {
    if (!this.recognition) return;

    // Speech recognition starts
    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isListening = true;
      this.speechStarted = false;
      this.currentTranscript = '';
      this.finalTranscript = '';
      
      if (this.onStart) {
        this.onStart();
      }
    };

    // Speech recognition ends
    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      this.isListening = false;
      this.speechStarted = false;
      
      // Clear timeouts
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }
      
      if (this.onEnd) {
        this.onEnd();
      }
    };

    // Speech recognition results
    this.recognition.onresult = (event) => {
      this.handleSpeechResult(event);
    };

    // Speech recognition errors
    this.recognition.onerror = (event) => {
      this.handleSpeechError(event);
    };

    // Speech starts (user begins speaking)
    this.recognition.onspeechstart = () => {
      console.log('User started speaking');
      this.speechStarted = true;
      this.lastSpeechTime = Date.now();
      
      // Clear silence timeout
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }
      
      if (this.onSpeechStart) {
        this.onSpeechStart();
      }
    };

    // Speech ends (user stops speaking)
    this.recognition.onspeechend = () => {
      console.log('User stopped speaking');
      this.speechStarted = false;
      this.lastSpeechTime = Date.now();
      
      // Start silence detection
      this.startSilenceDetection();
      
      if (this.onSpeechEnd) {
        this.onSpeechEnd();
      }
    };

    // No speech detected
    this.recognition.onnomatch = () => {
      console.log('No speech was detected');
    };

    // Audio starts
    this.recognition.onaudiostart = () => {
      console.log('Audio capturing started');
    };

    // Audio ends
    this.recognition.onaudioend = () => {
      console.log('Audio capturing ended');
    };
  }

  /**
   * Handle speech recognition results with optimization processing
   * @param {SpeechRecognitionEvent} event - The speech recognition event
   */
  handleSpeechResult(event) {
    // Use optimization service to process results for better accuracy
    const processedResults = speechOptimizationService.processSpeechResults(event);
    
    // Update stored transcripts with processed results
    // Accumulate finalized chunks so pauses don't erase earlier speech
    const newFinal = (processedResults.final || '').trim();
    const interim = (processedResults.interim || '').trim();

    if (newFinal) {
      // Append with a space if needed
      this.finalTranscript = this.finalTranscript
        ? `${this.finalTranscript} ${newFinal}`
        : newFinal;
    }

    // Current transcript is accumulated final + latest interim
    this.currentTranscript = interim
      ? `${this.finalTranscript}${this.finalTranscript ? ' ' : ''}${interim}`
      : this.finalTranscript;

    // Call transcription callback with enhanced results
    if (this.onTranscription) {
      this.onTranscription({
        final: this.finalTranscript,
        interim: interim,
        current: this.currentTranscript,
        confidence: processedResults.confidence,
        originalConfidence: processedResults.originalConfidence,
        meetsThreshold: processedResults.meetsThreshold,
        qualityScore: processedResults.qualityScore,
        timestamp: processedResults.timestamp
      });
    }

    // Update last speech time
    this.lastSpeechTime = Date.now();
    
    // Log enhanced results
    if (newFinal) {
      console.log('Final transcript (optimized):', this.finalTranscript, 
                  'Confidence:', processedResults.confidence, 
                  'Quality:', processedResults.qualityScore);
    }
  }

  /**
   * Handle speech recognition errors with enhanced audio-capture handling
   * @param {SpeechRecognitionErrorEvent} event - The error event
   */
  async handleSpeechError(event) {
    // Suppress "no-speech" errors in console - they're normal browser timeouts
    if (event.error === 'no-speech') {
      console.log('ℹ️ Browser timeout: No speech detected for ~10 seconds (this is normal, recording continues)');
    } else {
      console.error('Speech recognition error:', event.error, event.message);
    }
    
    // Create error object for enhanced handling
    const error = new Error(event.message || this.getErrorMessage(event.error));
    error.error = event.error;
    error.code = event.error;
    
    const context = {
      operation: 'speech_recognition',
      component: 'speechService',
      errorCode: event.error
    };

    // Handle specific errors with enhanced recovery
    switch (event.error) {
      case 'not-allowed':
        console.error('Microphone access denied - triggering fallback');
        this.handlePermissionError();
        break;
      case 'no-speech':
        // Normal browser timeout - recording continues
        this.handleNoSpeechError();
        break;
      case 'audio-capture':
        console.error('Audio capture failed - attempting recovery');
        await this.handleAudioCaptureError();
        break;
      case 'network':
        console.error('Network error during speech recognition');
        this.handleNetworkError();
        break;
      case 'aborted':
        console.log('Speech recognition aborted');
        break;
      case 'service-not-allowed':
        console.error('Speech recognition service not allowed');
        this.handleServiceNotAllowedError();
        break;
      default:
        console.error('Unknown speech recognition error:', event.error);
    }

    try {
      // Use enhanced error handling
      const result = await audioErrorHandler.handleAudioError(error, context, {
        onFallback: async (userError) => {
          // Trigger graceful degradation
          await gracefulDegradationService.executeFallback(userError, 'automatic', event.error);
        },
        onRetry: async (error, attempt) => {
          console.log(`Retrying speech recognition (attempt ${attempt})`);
          return await this.handleErrorRetry(event.error, attempt);
        },
        autoFallback: event.error === 'not-allowed' || event.error === 'service-not-allowed',
        maxRetries: this.getMaxRetriesForError(event.error)
      });

      // Call original error callback with enhanced info
      if (this.onError) {
        this.onError({
          error: event.error,
          message: event.message || this.getErrorMessage(event.error),
          timestamp: Date.now(),
          canRetry: this.canRetryAfterError(event.error),
          enhancedResult: result,
          recoveryAction: this.getRecoveryAction(event.error)
        });
      }

    } catch (enhancedError) {
      console.error('Enhanced error handling failed:', enhancedError);
      
      // Fallback to original error handling
      const errorInfo = {
        error: event.error,
        message: event.message || this.getErrorMessage(event.error),
        timestamp: Date.now(),
        canRetry: this.canRetryAfterError(event.error),
        recoveryAction: this.getRecoveryAction(event.error)
      };

      if (this.onError) {
        this.onError(errorInfo);
      }
    }
  }

  /**
   * Handle audio-capture specific errors with device diagnostics
   */
  async handleAudioCaptureError() {
    console.log('🎤 Diagnosing audio capture issue...');
    
    try {
      // Check if microphone is available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      
      if (audioInputs.length === 0) {
        console.error('No audio input devices found');
        throw new Error('No microphone detected. Please connect a microphone and try again.');
      }

      // Test microphone access
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        
        // Stop the test stream immediately
        stream.getTracks().forEach(track => track.stop());
        
        console.log('✅ Microphone access test successful');
        
        // DO NOT auto-restart - user must manually restart recording
        console.log('ℹ️ Microphone is accessible. User must click "Start Recording" to continue.');
        
      } catch (micError) {
        console.error('Microphone access test failed:', micError);
        
        if (micError.name === 'NotAllowedError') {
          throw new Error('Microphone access denied. Please allow microphone access in your browser settings.');
        } else if (micError.name === 'NotFoundError') {
          throw new Error('No microphone found. Please connect a microphone and refresh the page.');
        } else if (micError.name === 'NotReadableError') {
          throw new Error('Microphone is being used by another application. Please close other applications using the microphone.');
        } else {
          throw new Error(`Microphone error: ${micError.message}`);
        }
      }
      
    } catch (diagnosticError) {
      console.error('Audio capture diagnostic failed:', diagnosticError);
      
      // Provide specific error message based on the diagnostic
      if (this.onError) {
        this.onError({
          error: 'audio-capture-diagnostic',
          message: diagnosticError.message,
          timestamp: Date.now(),
          canRetry: false,
          recoveryAction: 'switch_to_text'
        });
      }
    }
  }

  /**
   * Handle permission errors
   */
  handlePermissionError() {
    console.log('🔒 Handling microphone permission error');
    
    // Provide guidance for enabling microphone access
    if (this.onError) {
      this.onError({
        error: 'permission-denied',
        message: 'Microphone access is required for voice input. Please click the microphone icon in your browser\'s address bar and allow access.',
        timestamp: Date.now(),
        canRetry: false,
        recoveryAction: 'enable_permissions'
      });
    }
  }

  /**
   * Handle network errors with retry logic
   */
  handleNetworkError() {
    console.log('🌐 Handling network error during speech recognition');
    
    // Check network status
    if (!navigator.onLine) {
      if (this.onError) {
        this.onError({
          error: 'network-offline',
          message: 'No internet connection. Voice recognition requires an active internet connection.',
          timestamp: Date.now(),
          canRetry: true,
          recoveryAction: 'wait_for_network'
        });
      }
    } else {
      // Network is online but speech service failed
      // DO NOT auto-restart - user must manually restart recording
      console.log('ℹ️ Network error occurred. User must click "Start Recording" to retry.');
    }
  }

  /**
   * Handle service not allowed errors
   */
  handleServiceNotAllowedError() {
    console.log('🚫 Speech recognition service not allowed');
    
    if (this.onError) {
      this.onError({
        error: 'service-not-allowed',
        message: 'Speech recognition service is not available. This may be due to browser restrictions or privacy settings.',
        timestamp: Date.now(),
        canRetry: false,
        recoveryAction: 'switch_to_text'
      });
    }
  }

  /**
   * Handle error-specific retry logic
   */
  async handleErrorRetry(errorCode, attempt) {
    switch (errorCode) {
      case 'no-speech':
        this.handleNoSpeechError();
        return { retried: true, attempt };
        
      case 'audio-capture':
        // Wait longer between audio-capture retries
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
        return { retried: true, attempt };
        
      case 'network':
        // Wait for network and retry
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        return { retried: true, attempt };
        
      default:
        return { retried: true, attempt };
    }
  }

  /**
   * Get maximum retries for specific error types
   */
  getMaxRetriesForError(errorCode) {
    switch (errorCode) {
      case 'audio-capture':
        return 2; // Limited retries for hardware issues
      case 'network':
        return 5; // More retries for network issues
      case 'no-speech':
        return 3; // Moderate retries for no speech
      case 'not-allowed':
      case 'service-not-allowed':
        return 0; // No retries for permission issues
      default:
        return 3;
    }
  }

  /**
   * Get recovery action for specific errors
   */
  getRecoveryAction(errorCode) {
    switch (errorCode) {
      case 'not-allowed':
        return 'enable_permissions';
      case 'audio-capture':
        return 'check_microphone';
      case 'network':
        return 'check_connection';
      case 'service-not-allowed':
        return 'switch_to_text';
      case 'no-speech':
        return 'speak_louder';
      default:
        return 'retry';
    }
  }

  /**
   * Get user-friendly error message with enhanced descriptions
   * @param {string} errorCode - The error code
   * @returns {string} - User-friendly error message
   */
  getErrorMessage(errorCode) {
    const errorMessages = {
      'not-allowed': 'Microphone access denied. Please click the microphone icon in your browser\'s address bar and allow access, then try again.',
      'no-speech': 'No speech detected. Please speak clearly into your microphone and ensure it\'s not muted.',
      'audio-capture': 'Audio capture failed. Your microphone may be in use by another application or disconnected. Please check your microphone and try again.',
      'network': 'Network error occurred during speech recognition. Please check your internet connection and try again.',
      'service-not-allowed': 'Speech recognition service is not available in this browser or due to privacy settings.',
      'bad-grammar': 'Speech recognition grammar error occurred.',
      'language-not-supported': 'The selected language is not supported for speech recognition.',
      'aborted': 'Speech recognition was stopped or interrupted.',
      'permission-denied': 'Microphone permission is required for voice input. Please enable microphone access in your browser settings.',
      'audio-capture-diagnostic': 'Microphone diagnostic failed. Please check your audio device settings.',
      'network-offline': 'No internet connection detected. Voice recognition requires an active internet connection.',
      'service-not-allowed': 'Speech recognition service is restricted in this environment.'
    };

    return errorMessages[errorCode] || `Speech recognition error: ${errorCode}. Please try again or switch to text input.`;
  }

  /**
   * Check if we can retry after an error with enhanced logic
   * @param {string} errorCode - The error code
   * @returns {boolean} - Whether retry is possible
   */
  canRetryAfterError(errorCode) {
    const retryableErrors = ['no-speech', 'audio-capture', 'network', 'aborted'];
    const nonRetryableErrors = ['not-allowed', 'service-not-allowed', 'permission-denied'];
    
    // Explicitly non-retryable errors
    if (nonRetryableErrors.includes(errorCode)) {
      return false;
    }
    
    // Explicitly retryable errors
    if (retryableErrors.includes(errorCode)) {
      return true;
    }
    
    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Handle no-speech error - DO NOT auto-restart (user controls recording)
   */
  handleNoSpeechError() {
    console.log('No speech detected - browser timeout occurred (user must manually restart)');
    // DO NOT auto-restart - let user control when to start/stop recording
    // The browser's Web Speech API may auto-restart internally if still in continuous mode
  }

  /**
   * Start silence detection
   */
  startSilenceDetection() {
    // Disable automatic stop due to silence; clear any previous timer
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    // No new timeout set to avoid auto-stopping recognition on silence
  }

  /**
   * Start listening for speech
   * @param {Object} callbacks - Event callbacks
   * @returns {Promise<boolean>} - Whether listening started successfully
   */
  async startListening(callbacks = {}) {
    try {
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          const error = new Error('Failed to initialize speech recognition');
          
          // Handle initialization failure with enhanced error handling
          await audioErrorHandler.handleAudioError(error, {
            operation: 'speech_recognition_init',
            component: 'speechService'
          }, {
            onFallback: async (userError) => {
              await gracefulDegradationService.executeFallback(userError, 'automatic', 'initialization_failed');
            },
            autoFallback: true
          });
          
          throw error;
        }
      }

      if (this.isListening) {
        console.warn('Speech recognition is already listening - restarting');
        // Attempt a quick restart to recover from half-closed states
        this.restart();
        return true;
      }

      // Set callbacks
      if (callbacks.onTranscription) this.onTranscription = callbacks.onTranscription;
      if (callbacks.onError) this.onError = callbacks.onError;
      if (callbacks.onStart) this.onStart = callbacks.onStart;
      if (callbacks.onEnd) this.onEnd = callbacks.onEnd;
      if (callbacks.onSpeechStart) this.onSpeechStart = callbacks.onSpeechStart;
      if (callbacks.onSpeechEnd) this.onSpeechEnd = callbacks.onSpeechEnd;

      // Reset state
      this.currentTranscript = '';
      this.finalTranscript = '';
      this.speechStarted = false;
      this.lastSpeechTime = null;

      // Start recognition with error handling
      await gracefulDegradationService.createRetryMechanism(
        () => {
          this.recognition.start();
          return Promise.resolve();
        },
        {
          maxRetries: 2,
          baseDelay: 1000,
          onRetry: (error, attempt, maxRetries, delay) => {
            console.log(`Retrying speech recognition start (attempt ${attempt}/${maxRetries}) in ${delay}ms`);
          },
          onFailure: async (error, attempts) => {
            console.error(`Failed to start speech recognition after ${attempts} attempts`);
            
            await audioErrorHandler.handleAudioError(error, {
              operation: 'speech_recognition_start',
              component: 'speechService',
              attempts
            }, {
              onFallback: async (userError) => {
                await gracefulDegradationService.executeFallback(userError, 'automatic', 'start_failed');
              },
              autoFallback: true
            });
          }
        }
      );

      console.log('Started speech recognition');
      return true;

    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      
      // Enhanced error callback
      if (this.onError) {
        this.onError({
          error: 'start-failed',
          message: error.message,
          timestamp: Date.now(),
          canRetry: true,
          enhancedHandling: true
        });
      }
      return false;
    }
  }

  /**
   * Stop listening for speech
   */
  stopListening() {
    try {
      // Return a promise that resolves when onend fires to allow callers to await clean shutdowns
      return new Promise((resolve) => {
        const wasListening = this.isListening;

        // Clear timeouts
        if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
          this.silenceTimeout = null;
        }
        if (this.restartTimeout) {
          clearTimeout(this.restartTimeout);
          this.restartTimeout = null;
        }

        if (!this.recognition) {
          this.isListening = false;
          return resolve();
        }

        // Temporarily wrap onend to resolve once
        const originalOnEnd = this.recognition.onend;
        let resolved = false;
        this.recognition.onend = () => {
          try {
            if (originalOnEnd) originalOnEnd();
          } finally {
            if (!resolved) {
              resolved = true;
              resolve();
            }
            // Restore handler to avoid growth
            this.recognition.onend = originalOnEnd;
          }
        };

        try {
          // If already not listening, just resolve
          if (!wasListening) {
            this.isListening = false;
            return resolve();
          }
          // Stop recognition (graceful). If it hangs, abort after a short timeout
          this.recognition.stop();
          console.log('Stopped speech recognition (requested)');

          // Failsafe abort if onend doesn't arrive in time
          setTimeout(() => {
            if (!resolved && this.recognition) {
              try {
                console.warn('Stop timeout exceeded; aborting recognition');
                if (typeof this.recognition.abort === 'function') {
                  this.recognition.abort();
                }
              } catch (_) {}
            }
          }, 1200);
        } catch (err) {
          console.error('Failed to stop speech recognition:', err);
          // Ensure promise resolves to avoid deadlocks
          if (!resolved) resolve();
        }
      });
    } catch (error) {
      console.error('Failed to stop speech recognition (wrapper):', error);
      return Promise.resolve();
    }
  }

  /**
   * Restart speech recognition
   */
  restart() {
    console.log('Restarting speech recognition');
    this.stopListening();
    
    // Wait a moment before restarting
    this.restartTimeout = setTimeout(() => {
      this.startListening();
    }, 500);
  }

  /**
   * Get current status
   * @returns {Object} - Current status information
   */
  getStatus() {
    return {
      isSupported: this.isSupported(),
      isInitialized: this.isInitialized,
      isListening: this.isListening,
      speechStarted: this.speechStarted,
      currentTranscript: this.currentTranscript,
      finalTranscript: this.finalTranscript,
      lastSpeechTime: this.lastSpeechTime,
      compatibility: this.getCompatibilityInfo()
    };
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    if (this.recognition) {
      this.recognition.continuous = this.config.continuous;
      this.recognition.interimResults = this.config.interimResults;
      this.recognition.lang = this.config.language;
      this.recognition.maxAlternatives = this.config.maxAlternatives;
    }
  }

  /**
   * Clear all transcripts
   */
  clearTranscripts() {
    this.currentTranscript = '';
    this.finalTranscript = '';
  }

  /**
   * Destroy the service and clean up resources
   */
  destroy() {
    this.stopListening();
    
    // Clear timeouts
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    // Clear callbacks
    this.onTranscription = null;
    this.onError = null;
    this.onStart = null;
    this.onEnd = null;
    this.onSpeechStart = null;
    this.onSpeechEnd = null;

    // Reset state
    this.recognition = null;
    this.isInitialized = false;
    this.isListening = false;
    
    console.log('Speech recognition service destroyed');
  }
}

// Create and export singleton instance
export const speechService = new SpeechService();
export default speechService;