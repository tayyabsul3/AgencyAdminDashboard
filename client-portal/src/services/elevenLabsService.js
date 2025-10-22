/**
 * ElevenLabs Integration Service
 * Handles voice synthesis using ElevenLabs API with performance optimizations
 */

import { audioErrorHandler, AUDIO_ERROR_TYPES } from './audioErrorHandler.js';
import { gracefulDegradationService } from './gracefulDegradationService.js';
import { audioCacheService } from './audioCacheService.js';

class ElevenLabsService {
  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    this.voiceId = process.env.NEXT_PUBLIC_CLIENT_VOICE_ID;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    this.currentAudio = null;
    this.isPlaying = false;
    this.volume = 0.8;
    this.isMuted = false;

    // Track user interaction for browser audio policy compliance
    this.hasUserInteracted = false;
    this.setupUserInteractionTracking();
  }

  /**
   * Setup user interaction tracking for browser audio policy compliance
   */
  setupUserInteractionTracking() {
    if (typeof window === 'undefined') return;

    // Mark as interacted on any user gesture
    const markInteracted = () => {
      this.hasUserInteracted = true;
      // Remove listeners after first interaction
      document.removeEventListener('click', markInteracted);
      document.removeEventListener('touchstart', markInteracted);
      document.removeEventListener('keydown', markInteracted);
    };

    // Listen for user interactions
    document.addEventListener('click', markInteracted, { once: true });
    document.addEventListener('touchstart', markInteracted, { once: true });
    document.addEventListener('keydown', markInteracted, { once: true });
  }

  /**
   * Check if ElevenLabs is properly configured
   * @returns {boolean} Whether the service is configured
   */
  isConfigured() {
    return !!(this.apiKey && this.voiceId);
  }

  /**
   * Synthesize speech from text using ElevenLabs API with caching
   * @param {string} text - Text to synthesize
   * @param {Object} options - Voice synthesis options
   * @returns {Promise<string>} Audio URL
   */
  async synthesizeSpeech(text, options = {}) {
    const startTime = Date.now();
    const context = {
      operation: 'voice_synthesis',
      component: 'elevenLabsService',
      textLength: text.length
    };

    // Check if service is configured
    if (!this.isConfigured()) {
      const error = new Error('ElevenLabs service is not properly configured. Please check your API key and voice ID.');
      error.code = 'ELEVENLABS_NOT_CONFIGURED';
      throw error;
    }

    try {
      // Check cache first for performance optimization
      const cachedAudio = await audioCacheService.getCachedAudio(text, options);
      if (cachedAudio) {
        console.log(`Using cached audio for: "${text.substring(0, 50)}..." (${Date.now() - startTime}ms)`);
        return cachedAudio;
      }

      // Check for preloaded responses
      const preloadedAudio = audioCacheService.getPreloadedResponse(text);
      if (preloadedAudio) {
        console.log(`Using preloaded audio for: "${text.substring(0, 50)}..."`);
        return preloadedAudio;
      }

      // Use retry mechanism for network requests
      const audioUrl = await gracefulDegradationService.createRetryMechanism(
        async () => {
          // Use Firebase Functions API endpoint
          const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://us-central1-lead-generation-6cf0f.cloudfunctions.net/api';
          const response = await fetch(`${apiBaseUrl}/elevenlabs/synthesize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text,
              voiceId: options.voiceId || this.voiceId,
              settings: {
                stability: options.stability || 0.75,
                similarity_boost: options.similarity_boost || 0.75,
                style: options.style || 0.5,
                use_speaker_boost: options.use_speaker_boost || true
              }
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            const error = new Error(errorData.error?.message || `API error: ${response.status} ${response.statusText}`);
            error.status = response.status;
            error.statusText = response.statusText;
            error.details = errorData.error?.details;
            throw error;
          }
          
          const audioBlob = await response.blob();
          const audioUrl = this.createAudioUrl(audioBlob);
          
          // Cache the audio for future use
          const generationTime = Date.now() - startTime;
          const arrayBuffer = await audioBlob.arrayBuffer();
          await audioCacheService.cacheAudio(text, options, arrayBuffer, generationTime);
          
          return audioUrl;
        },
        {
          maxRetries: 3,
          baseDelay: 1000,
          onRetry: (error, attempt, maxRetries, delay) => {
            console.log(`Retrying voice synthesis (attempt ${attempt}/${maxRetries}) in ${delay}ms:`, error.message);
          },
          onFailure: async (error, attempts) => {
            console.error(`Voice synthesis failed after ${attempts} attempts:`, error);
            
            // Handle synthesis failure with enhanced error handling
            await audioErrorHandler.handleAudioError(error, {
              ...context,
              attempts,
              status: error.status
            }, {
              onFallback: async (userError) => {
                // Don't automatically fallback for synthesis errors - let user decide
                console.log('Voice synthesis failed, but continuing with text display');
              },
              autoFallback: false, // Let the UI handle synthesis failures gracefully
              maxRetries: 0 // Already retried
            });
          }
        }
      );

      return audioUrl;

    } catch (error) {
      console.error('Speech synthesis error:', error);
      
      // Enhanced error handling for synthesis failures
      try {
        await audioErrorHandler.handleAudioError(error, context, {
          onFallback: async (userError) => {
            console.log('Voice synthesis failed, continuing with text-only mode');
          },
          autoFallback: false, // Don't auto-fallback for synthesis - just show text
          maxRetries: 0
        });
      } catch (handlingError) {
        console.error('Error handling synthesis failure:', handlingError);
      }
      
      throw error;
    }
  }

  /**
   * Create audio URL from blob
   * @param {Blob} audioBlob - Audio blob data
   * @returns {string} Audio URL
   */
  createAudioUrl(audioBlob) {
    return URL.createObjectURL(audioBlob);
  }

  /**
   * Play audio with controls and callbacks
   * @param {string} audioUrl - Audio URL to play
   * @param {Function} onStart - Callback when audio starts
   * @param {Function} onEnd - Callback when audio ends
   * @param {Function} onError - Callback on error
   * @returns {Promise<HTMLAudioElement>} Audio element
   */
  async playAudio(audioUrl, onStart, onEnd, onError) {
    const context = {
      operation: 'audio_playback',
      component: 'elevenLabsService'
    };

    try {
      // Stop any currently playing audio
      this.stopCurrentAudio();

      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      
      // Apply current volume settings
      audio.volume = this.isMuted ? 0 : this.volume;
      
      // Enhanced error handling for audio events
      audio.onloadstart = () => {
        this.isPlaying = true;
        if (onStart) onStart();
      };
      
      audio.onended = () => {
        this.isPlaying = false;
        this.currentAudio = null;
        if (onEnd) onEnd();
      };
      
      audio.onerror = async (event) => {
        this.isPlaying = false;
        this.currentAudio = null;
        
        const error = new Error(`Audio playback failed: ${event.target.error?.message || 'Unknown error'}`);
        error.code = event.target.error?.code;
        
        try {
          // Handle playback error with enhanced error handling
          await audioErrorHandler.handleAudioError(error, context, {
            onFallback: async (userError) => {
              console.log('Audio playback failed, continuing without audio');
            },
            autoFallback: false, // Don't auto-fallback for playback issues
            maxRetries: 1
          });
        } catch (handlingError) {
          console.error('Error handling playback failure:', handlingError);
        }
        
        if (onError) onError(error);
      };
      
      // Use retry mechanism for audio playback
      await gracefulDegradationService.createRetryMechanism(
        () => audio.play(),
        {
          maxRetries: 2,
          baseDelay: 500,
          onRetry: (error, attempt, maxRetries, delay) => {
            console.log(`Retrying audio playback (attempt ${attempt}/${maxRetries}) in ${delay}ms`);
          },
          onFailure: async (error, attempts) => {
            console.error(`Audio playback failed after ${attempts} attempts:`, error);
            
            await audioErrorHandler.handleAudioError(error, {
              ...context,
              attempts
            }, {
              onFallback: async (userError) => {
                console.log('Audio playback failed, continuing without audio');
              },
              autoFallback: false,
              maxRetries: 0
            });
          }
        }
      );

      return audio;

    } catch (error) {
      console.error('Audio playback error:', error);
      this.isPlaying = false;
      this.currentAudio = null;
      
      // Enhanced error handling
      try {
        await audioErrorHandler.handleAudioError(error, context, {
          onFallback: async (userError) => {
            console.log('Audio playback failed, continuing without audio');
          },
          autoFallback: false,
          maxRetries: 0
        });
      } catch (handlingError) {
        console.error('Error handling playback failure:', handlingError);
      }
      
      if (onError) onError(error);
      throw error;
    }
  }

  /**
   * Stop currently playing audio
   */
  stopCurrentAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
      this.isPlaying = false;
    }
  }

  /**
   * Set volume level (0-100)
   * @param {number} volume - Volume percentage
   */
  setVolume(volume) {
    this.volume = volume / 100; // Convert percentage to decimal
    if (this.currentAudio) {
      this.currentAudio.volume = this.isMuted ? 0 : this.volume;
    }
  }

  /**
   * Set muted state
   * @param {boolean} muted - Whether to mute audio
   */
  setMuted(muted) {
    this.isMuted = muted;
    if (this.currentAudio) {
      this.currentAudio.volume = muted ? 0 : this.volume;
    }
  }

  /**
   * Get available voices from ElevenLabs
   * @returns {Promise<Array>} Available voices
   */
  async getAvailableVoices() {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://us-central1-lead-generation-6cf0f.cloudfunctions.net/api';
      const response = await fetch(`${apiBaseUrl}/elevenlabs/voices`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to fetch voices: ${response.statusText}`);
      }
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching voices:', error);
      throw error;
    }
  }

  /**
   * Get current audio status
   * @returns {Object} Audio status information
   */
  getStatus() {
    return {
      isPlaying: this.isPlaying,
      volume: this.volume * 100,
      isMuted: this.isMuted,
      hasCurrentAudio: !!this.currentAudio,
      voiceId: this.voiceId,
      isConfigured: this.isConfigured(),
      hasApiKey: !!this.apiKey,
      hasVoiceId: !!this.voiceId,
      hasUserInteracted: this.hasUserInteracted
    };
  }

  /**
   * Speak text with automatic playback
   * @param {string} text - Text to speak
   * @param {Function} onStart - Callback when speaking starts
   * @param {Function} onEnd - Callback when speaking ends
   * @param {Function} onError - Callback on error
   * @returns {Promise<void>}
   */
  async speakText(text, onStart, onEnd, onError) {
    try {
      // Generate speech
      const audioUrl = await this.synthesizeSpeech(text);
      
      // Play audio
      await this.playAudio(audioUrl, onStart, onEnd, onError);
      
    } catch (error) {
      console.error('Error speaking text:', error);
      if (onError) onError(error);
      throw error;
    }
  }

  /**
   * Configure voice settings
   * @param {Object} settings - Voice configuration settings
   */
  configureVoice(settings) {
    if (settings.voiceId) {
      this.voiceId = settings.voiceId;
    }
    if (settings.volume !== undefined) {
      this.setVolume(settings.volume);
    }
    if (settings.muted !== undefined) {
      this.setMuted(settings.muted);
    }
  }
}

// Create singleton instance
export const elevenLabsService = new ElevenLabsService();
export default elevenLabsService;