/**
 * Audio Manager Service
 * Coordinates audio operations and manages audio state with performance optimizations
 */

import { elevenLabsService } from './elevenLabsService.js';
import { audioErrorHandler, AUDIO_ERROR_TYPES } from './audioErrorHandler.js';
import { gracefulDegradationService } from './gracefulDegradationService.js';
import { audioCacheService } from './audioCacheService.js';

class AudioManager {
  constructor() {
    this.currentAudio = null;
    this.isPlaying = false;
    this.volume = 80; // Percentage
    this.isMuted = false;
    this.audioQueue = [];
    this.isProcessingQueue = false;
    this.listeners = new Set();
    
    // Audio quality monitoring
    this.audioQuality = {
      status: 'unknown', // 'good', 'poor', 'failed', 'unknown'
      latency: 0,
      errorCount: 0,
      successCount: 0,
      lastError: null,
      lastSuccessTime: null
    };
    
    // Audio session management
    this.session = {
      id: null,
      startTime: null,
      endTime: null,
      isActive: false,
      totalPlayTime: 0,
      totalErrors: 0,
      settings: {
        volume: 80,
        muted: false,
        voiceId: null
      }
    };
    
    // Performance monitoring
    this.performance = {
      averageLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      totalRequests: 0,
      failedRequests: 0
    };
  }

  /**
   * Add event listener for audio state changes
   * @param {Function} listener - Callback function
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   * @param {Function} listener - Callback function to remove
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  notifyListeners(event, data = {}) {
    this.listeners.forEach(listener => {
      try {
        listener(event, { ...data, status: this.getStatus() });
      } catch (error) {
        console.error('Error in audio manager listener:', error);
      }
    });
  }

  /**
   * Speak text with automatic playback
   * @param {string} text - Text to speak
   * @param {Object} options - Speaking options
   * @returns {Promise<void>}
   */
  async speakText(text, options = {}) {
    const { priority = false, onStart, onEnd, onError } = options;
    const startTime = Date.now();
    
    const context = {
      operation: 'speak_text',
      component: 'audioManager',
      textLength: text.length,
      priority
    };
    
    try {
      // If priority, clear queue and stop current audio
      if (priority) {
        this.clearQueue();
        this.stopCurrentAudio();
      }
      
      // Add to queue if something is already playing
      if (this.isPlaying && !priority) {
        return this.queueSpeech(text, options);
      }
      
      this.notifyListeners('speaking-start', { text });
      this.updatePerformanceMetrics('request-start');
      
      // Generate and play speech with enhanced error handling
      await gracefulDegradationService.createRetryMechanism(
        () => elevenLabsService.speakText(
          text,
          () => {
            this.isPlaying = true;
            const latency = Date.now() - startTime;
            this.updateAudioQuality('success', latency);
            this.updatePerformanceMetrics('request-success', latency);
            this.notifyListeners('audio-start', { text, latency });
            if (onStart) onStart();
          },
          () => {
            this.isPlaying = false;
            this.updateSessionPlayTime(Date.now() - startTime);
            this.notifyListeners('audio-end', { text });
            if (onEnd) onEnd();
            
            // Process next item in queue
            this.processQueue();
          },
          async (error) => {
            this.isPlaying = false;
            this.updateAudioQuality('error', 0, error);
            this.updatePerformanceMetrics('request-failed');
            this.session.totalErrors++;
            
            // Enhanced error handling
            try {
              await audioErrorHandler.handleAudioError(error, context, {
                onFallback: async (userError) => {
                  this.notifyListeners('audio-fallback', { text, userError });
                },
                autoFallback: false, // Let the UI decide on fallback for speech
                maxRetries: 0 // Already being retried by outer mechanism
              });
            } catch (handlingError) {
              console.error('Error handling audio error:', handlingError);
            }
            
            this.notifyListeners('audio-error', { text, error });
            if (onError) onError(error);
            
            // Process next item in queue even on error
            this.processQueue();
          }
        ),
        {
          maxRetries: 2,
          baseDelay: 1000,
          onRetry: (error, attempt, maxRetries, delay) => {
            console.log(`Retrying speech (attempt ${attempt}/${maxRetries}) in ${delay}ms:`, error.message);
            this.notifyListeners('speech-retry', { text, attempt, maxRetries, delay, error });
          },
          onFailure: async (error, attempts) => {
            console.error(`Speech failed after ${attempts} attempts:`, error);
            
            // Handle final failure
            await audioErrorHandler.handleAudioError(error, {
              ...context,
              attempts,
              finalFailure: true
            }, {
              onFallback: async (userError) => {
                this.notifyListeners('speech-final-fallback', { text, userError, attempts });
              },
              autoFallback: false, // Let UI handle final fallback decision
              maxRetries: 0
            });
          }
        }
      );
      
    } catch (error) {
      console.error('Error speaking text:', error);
      this.updateAudioQuality('error', 0, error);
      this.updatePerformanceMetrics('request-failed');
      this.session.totalErrors++;
      
      // Enhanced error handling for final catch
      try {
        await audioErrorHandler.handleAudioError(error, context, {
          onFallback: async (userError) => {
            this.notifyListeners('speaking-fallback', { text, userError });
          },
          autoFallback: false,
          maxRetries: 0
        });
      } catch (handlingError) {
        console.error('Error handling speaking error:', handlingError);
      }
      
      this.notifyListeners('speaking-error', { text, error });
      if (options.onError) options.onError(error);
      throw error;
    }
  }

  /**
   * Queue speech for later playback
   * @param {string} text - Text to speak
   * @param {Object} options - Speaking options
   * @returns {Promise<void>}
   */
  async queueSpeech(text, options = {}) {
    return new Promise((resolve, reject) => {
      this.audioQueue.push({
        text,
        options: {
          ...options,
          onEnd: () => {
            if (options.onEnd) options.onEnd();
            resolve();
          },
          onError: (error) => {
            if (options.onError) options.onError(error);
            reject(error);
          }
        }
      });
      
      this.notifyListeners('audio-queued', { text, queueLength: this.audioQueue.length });
    });
  }

  /**
   * Process next item in audio queue
   */
  async processQueue() {
    if (this.isProcessingQueue || this.audioQueue.length === 0 || this.isPlaying) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      const nextItem = this.audioQueue.shift();
      if (nextItem) {
        await this.speakText(nextItem.text, nextItem.options);
      }
    } catch (error) {
      console.error('Error processing audio queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Stop currently playing audio
   */
  stopCurrentAudio() {
    elevenLabsService.stopCurrentAudio();
    this.isPlaying = false;
    this.notifyListeners('audio-stopped');
  }

  /**
   * Clear audio queue
   */
  clearQueue() {
    const queueLength = this.audioQueue.length;
    this.audioQueue = [];
    if (queueLength > 0) {
      this.notifyListeners('queue-cleared', { clearedItems: queueLength });
    }
  }

  /**
   * Set volume level (0-100)
   * @param {number} volume - Volume percentage
   */
  setVolume(volume) {
    const previousVolume = this.volume;
    this.volume = Math.max(0, Math.min(100, volume));
    
    // Update session settings
    if (this.session.isActive) {
      this.session.settings.volume = this.volume;
    }
    
    try {
      elevenLabsService.setVolume(this.volume);
      this.notifyListeners('volume-changed', { 
        volume: this.volume, 
        previousVolume,
        success: true 
      });
    } catch (error) {
      console.error('Error setting volume:', error);
      this.volume = previousVolume; // Revert on error
      this.notifyListeners('volume-error', { error, volume: this.volume });
    }
  }

  /**
   * Set muted state
   * @param {boolean} muted - Whether to mute audio
   */
  setMuted(muted) {
    const previousMuted = this.isMuted;
    this.isMuted = muted;
    
    // Update session settings
    if (this.session.isActive) {
      this.session.settings.muted = this.isMuted;
    }
    
    try {
      elevenLabsService.setMuted(muted);
      this.notifyListeners('mute-changed', { 
        isMuted: this.isMuted, 
        previousMuted,
        success: true 
      });
    } catch (error) {
      console.error('Error setting mute state:', error);
      this.isMuted = previousMuted; // Revert on error
      this.notifyListeners('mute-error', { error, isMuted: this.isMuted });
    }
  }

  /**
   * Toggle mute state
   */
  toggleMute() {
    this.setMuted(!this.isMuted);
  }

  /**
   * Adjust volume by delta
   * @param {number} delta - Volume change amount (-100 to 100)
   */
  adjustVolume(delta) {
    const newVolume = this.volume + delta;
    this.setVolume(newVolume);
  }

  /**
   * Set volume with fade effect
   * @param {number} targetVolume - Target volume level
   * @param {number} duration - Fade duration in ms
   */
  async fadeVolume(targetVolume, duration = 1000) {
    const startVolume = this.volume;
    const volumeDiff = targetVolume - startVolume;
    const steps = 20;
    const stepDuration = duration / steps;
    const stepSize = volumeDiff / steps;
    
    for (let i = 0; i < steps; i++) {
      const currentVolume = startVolume + (stepSize * (i + 1));
      this.setVolume(currentVolume);
      await new Promise(resolve => setTimeout(resolve, stepDuration));
    }
    
    // Ensure we end at exact target volume
    this.setVolume(targetVolume);
  }

  /**
   * Update audio quality metrics
   * @param {string} type - 'success' or 'error'
   * @param {number} latency - Request latency in ms
   * @param {Error} error - Error object if applicable
   */
  updateAudioQuality(type, latency = 0, error = null) {
    if (type === 'success') {
      this.audioQuality.successCount++;
      this.audioQuality.latency = latency;
      this.audioQuality.lastSuccessTime = Date.now();
      
      // Determine quality based on latency and error rate
      const errorRate = this.audioQuality.errorCount / (this.audioQuality.successCount + this.audioQuality.errorCount);
      
      if (latency < 2000 && errorRate < 0.1) {
        this.audioQuality.status = 'good';
      } else if (latency < 5000 && errorRate < 0.3) {
        this.audioQuality.status = 'poor';
      } else {
        this.audioQuality.status = 'failed';
      }
    } else if (type === 'error') {
      this.audioQuality.errorCount++;
      this.audioQuality.lastError = error;
      
      const errorRate = this.audioQuality.errorCount / (this.audioQuality.successCount + this.audioQuality.errorCount);
      
      if (errorRate > 0.5) {
        this.audioQuality.status = 'failed';
      } else if (errorRate > 0.2) {
        this.audioQuality.status = 'poor';
      }
    }
    
    this.notifyListeners('quality-updated', { quality: this.audioQuality });
  }

  /**
   * Update performance metrics
   * @param {string} type - Metric type
   * @param {number} latency - Latency value if applicable
   */
  updatePerformanceMetrics(type, latency = 0) {
    switch (type) {
      case 'request-start':
        this.performance.totalRequests++;
        break;
      case 'request-success':
        if (latency > 0) {
          this.performance.averageLatency = 
            (this.performance.averageLatency * (this.performance.totalRequests - 1) + latency) / this.performance.totalRequests;
          this.performance.maxLatency = Math.max(this.performance.maxLatency, latency);
          this.performance.minLatency = Math.min(this.performance.minLatency, latency);
        }
        break;
      case 'request-failed':
        this.performance.failedRequests++;
        break;
    }
  }

  /**
   * Update session play time
   * @param {number} duration - Duration in ms
   */
  updateSessionPlayTime(duration) {
    if (this.session.isActive) {
      this.session.totalPlayTime += duration;
    }
  }

  /**
   * Get audio quality status
   * @returns {Object} Audio quality information
   */
  getAudioQuality() {
    return {
      ...this.audioQuality,
      performance: this.performance
    };
  }

  /**
   * Get current audio status with performance metrics
   * @returns {Object} Audio status information
   */
  getStatus() {
    return {
      isPlaying: this.isPlaying,
      volume: this.volume,
      isMuted: this.isMuted,
      queueLength: this.audioQueue.length,
      isProcessingQueue: this.isProcessingQueue,
      audioQuality: this.audioQuality,
      session: this.session,
      performance: this.performance,
      elevenLabsStatus: elevenLabsService.getStatus(),
      cacheStatistics: audioCacheService.getStatistics(),
      cacheHealth: audioCacheService.getCacheHealth()
    };
  }

  /**
   * Get detailed performance analytics
   * @returns {Object} Comprehensive performance data
   */
  getPerformanceAnalytics() {
    return {
      audioManager: {
        performance: this.performance,
        audioQuality: this.audioQuality,
        session: this.session
      },
      cache: {
        statistics: audioCacheService.getStatistics(),
        health: audioCacheService.getCacheHealth()
      },
      elevenLabs: elevenLabsService.getStatus()
    };
  }

  /**
   * Optimize audio performance based on current metrics
   */
  optimizePerformance() {
    const analytics = this.getPerformanceAnalytics();
    const recommendations = [];
    
    // Check cache performance
    if (analytics.cache.statistics.hitRate < 30) {
      recommendations.push('Low cache hit rate - consider preloading more responses');
      // Trigger additional preloading
      this.preloadCommonResponses();
    }
    
    // Check audio quality
    if (analytics.audioManager.audioQuality.status === 'poor') {
      recommendations.push('Poor audio quality detected - check network connection');
    }
    
    // Check latency
    if (analytics.audioManager.performance.averageLatency > 3000) {
      recommendations.push('High latency detected - consider enabling compression');
    }
    
    // Optimize cache if needed
    if (analytics.cache.statistics.cacheSize > analytics.cache.statistics.maxCacheSize * 0.8) {
      audioCacheService.optimizeCache();
      recommendations.push('Cache optimized for better performance');
    }
    
    this.notifyListeners('performance-optimized', { recommendations });
    return { recommendations, analytics };
  }

  /**
   * Test audio functionality comprehensively
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test results
   */
  async testAudio(options = {}) {
    const testResults = {
      overall: false,
      synthesis: false,
      playback: false,
      volume: false,
      latency: null,
      error: null,
      timestamp: Date.now()
    };
    
    try {
      this.notifyListeners('audio-test-start');
      const startTime = Date.now();
      
      // Test 1: Basic synthesis
      this.notifyListeners('audio-test-step', { step: 'synthesis' });
      const testText = options.testText || 'Audio test in progress. Testing voice synthesis functionality.';
      
      await this.speakText(testText, {
        priority: true,
        onStart: () => {
          testResults.synthesis = true;
          testResults.latency = Date.now() - startTime;
          this.notifyListeners('audio-test-step', { step: 'playback' });
        },
        onEnd: () => {
          testResults.playback = true;
          this.notifyListeners('audio-test-step', { step: 'volume' });
        }
      });
      
      // Test 2: Volume control
      const originalVolume = this.volume;
      this.setVolume(50);
      this.setVolume(originalVolume);
      testResults.volume = true;
      
      // Test 3: Mute functionality
      const originalMuted = this.isMuted;
      this.setMuted(true);
      this.setMuted(originalMuted);
      
      testResults.overall = testResults.synthesis && testResults.playback && testResults.volume;
      
      if (testResults.overall) {
        this.notifyListeners('audio-test-success', { results: testResults });
      } else {
        this.notifyListeners('audio-test-partial', { results: testResults });
      }
      
      return testResults;
      
    } catch (error) {
      console.error('Audio test failed:', error);
      testResults.error = error.message;
      this.notifyListeners('audio-test-failed', { error, results: testResults });
      return testResults;
    }
  }

  /**
   * Test microphone functionality (for future speech recognition)
   * @returns {Promise<Object>} Microphone test results
   */
  async testMicrophone() {
    const testResults = {
      available: false,
      permission: false,
      error: null
    };
    
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access not supported in this browser');
      }
      
      testResults.available = true;
      
      // Test microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      testResults.permission = true;
      
      // Clean up stream
      stream.getTracks().forEach(track => track.stop());
      
      this.notifyListeners('microphone-test-success', { results: testResults });
      return testResults;
      
    } catch (error) {
      console.error('Microphone test failed:', error);
      testResults.error = error.message;
      this.notifyListeners('microphone-test-failed', { error, results: testResults });
      return testResults;
    }
  }

  /**
   * Configure audio settings
   * @param {Object} settings - Audio configuration
   */
  configure(settings) {
    if (settings.volume !== undefined) {
      this.setVolume(settings.volume);
    }
    if (settings.muted !== undefined) {
      this.setMuted(settings.muted);
    }
    if (settings.voiceSettings) {
      elevenLabsService.configureVoice(settings.voiceSettings);
    }
    
    this.notifyListeners('audio-configured', { settings });
  }

  /**
   * Get available voices
   * @returns {Promise<Array>} Available voices
   */
  async getAvailableVoices() {
    try {
      return await elevenLabsService.getAvailableVoices();
    } catch (error) {
      console.error('Error getting available voices:', error);
      this.notifyListeners('voices-error', { error });
      throw error;
    }
  }

  /**
   * Start audio session with performance optimizations
   * @param {Object} options - Session options
   * @returns {string} Session ID
   */
  startSession(options = {}) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.session = {
      id: sessionId,
      startTime: Date.now(),
      endTime: null,
      isActive: true,
      totalPlayTime: 0,
      totalErrors: 0,
      settings: {
        volume: options.volume || this.volume,
        muted: options.muted || this.isMuted,
        voiceId: options.voiceId || null
      }
    };
    
    // Reset quality metrics for new session
    this.audioQuality = {
      status: 'unknown',
      latency: 0,
      errorCount: 0,
      successCount: 0,
      lastError: null,
      lastSuccessTime: null
    };
    
    // Reset performance metrics
    this.performance = {
      averageLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      totalRequests: 0,
      failedRequests: 0
    };
    
    // Start preloading common responses for better performance
    if (options.enablePreloading !== false) {
      this.preloadCommonResponses(options);
    }
    
    this.notifyListeners('session-started', { sessionId, session: this.session });
    return sessionId;
  }

  /**
   * Preload common AI responses for better performance
   * @param {Object} options - Preloading options
   */
  async preloadCommonResponses(options = {}) {
    try {
      console.log('Starting preload of common AI responses...');
      this.notifyListeners('preload-started');
      
      // Use a simple synthesis function for preloading
      const synthesizeFunction = async (text, voiceOptions) => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://us-central1-lead-generation-6cf0f.cloudfunctions.net/api'}/elevenlabs/synthesize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voiceId: voiceOptions.voiceId || elevenLabsService.voiceId,
            settings: {
              stability: voiceOptions.stability || 0.75,
              similarity_boost: voiceOptions.similarity_boost || 0.75,
              style: voiceOptions.style || 0.5,
              use_speaker_boost: voiceOptions.use_speaker_boost || true
            }
          })
        });
        
        if (!response.ok) {
          throw new Error(`Preload synthesis failed: ${response.statusText}`);
        }
        
        return await response.blob();
      };
      
      await audioCacheService.preloadCommonResponses(synthesizeFunction, {
        voiceId: options.voiceId || elevenLabsService.voiceId,
        ...options.voiceSettings
      });
      
      this.notifyListeners('preload-completed', { 
        preloadedCount: audioCacheService.preloadedResponses.size 
      });
      
    } catch (error) {
      console.error('Failed to preload common responses:', error);
      this.notifyListeners('preload-failed', { error });
    }
  }

  /**
   * End current audio session
   * @returns {Object} Session summary
   */
  endSession() {
    if (!this.session.isActive) {
      return null;
    }
    
    this.session.endTime = Date.now();
    this.session.isActive = false;
    
    const sessionSummary = {
      ...this.session,
      duration: this.session.endTime - this.session.startTime,
      audioQuality: { ...this.audioQuality },
      performance: { ...this.performance }
    };
    
    this.notifyListeners('session-ended', { sessionSummary });
    return sessionSummary;
  }

  /**
   * Pause current session
   */
  pauseSession() {
    if (this.session.isActive) {
      this.stopCurrentAudio();
      this.clearQueue();
      this.notifyListeners('session-paused', { sessionId: this.session.id });
    }
  }

  /**
   * Resume current session
   */
  resumeSession() {
    if (this.session.id && !this.session.isActive) {
      this.session.isActive = true;
      this.notifyListeners('session-resumed', { sessionId: this.session.id });
    }
  }

  /**
   * Get current session info
   * @returns {Object} Session information
   */
  getSessionInfo() {
    return {
      ...this.session,
      currentDuration: this.session.isActive ? Date.now() - this.session.startTime : 0
    };
  }

  /**
   * Monitor audio health and suggest actions
   * @returns {Object} Health status and recommendations
   */
  monitorAudioHealth() {
    const health = {
      status: 'healthy',
      issues: [],
      recommendations: []
    };
    
    // Check error rate
    const totalAttempts = this.audioQuality.successCount + this.audioQuality.errorCount;
    const errorRate = totalAttempts > 0 ? this.audioQuality.errorCount / totalAttempts : 0;
    
    if (errorRate > 0.5) {
      health.status = 'critical';
      health.issues.push('High error rate detected');
      health.recommendations.push('Consider switching to text mode');
    } else if (errorRate > 0.2) {
      health.status = 'warning';
      health.issues.push('Moderate error rate detected');
      health.recommendations.push('Check network connection');
    }
    
    // Check latency
    if (this.performance.averageLatency > 5000) {
      health.status = health.status === 'critical' ? 'critical' : 'warning';
      health.issues.push('High audio latency detected');
      health.recommendations.push('Check network speed');
    }
    
    // Check if no successful requests recently
    const timeSinceLastSuccess = this.audioQuality.lastSuccessTime 
      ? Date.now() - this.audioQuality.lastSuccessTime 
      : Infinity;
    
    if (timeSinceLastSuccess > 30000) { // 30 seconds
      health.status = 'critical';
      health.issues.push('No successful audio requests recently');
      health.recommendations.push('Test audio functionality');
    }
    
    return health;
  }

  /**
   * Reset audio quality metrics
   */
  resetQualityMetrics() {
    this.audioQuality = {
      status: 'unknown',
      latency: 0,
      errorCount: 0,
      successCount: 0,
      lastError: null,
      lastSuccessTime: null
    };
    
    this.performance = {
      averageLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      totalRequests: 0,
      failedRequests: 0
    };
    
    this.notifyListeners('metrics-reset');
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.endSession();
    this.stopCurrentAudio();
    this.clearQueue();
    this.listeners.clear();
  }
}

// Create singleton instance
export const audioManager = new AudioManager();
export default audioManager;