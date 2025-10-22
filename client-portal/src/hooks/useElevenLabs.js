'use client';

/**
 * ElevenLabs Voice Synthesis Hook
 * Provides voice synthesis functionality using ElevenLabs API
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export const useElevenLabs = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const audioRef = useRef(null);
  const currentAudioRef = useRef(null);

  // Initialize audio context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio();
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
      });
      audioRef.current.addEventListener('error', (e) => {
        setError(new Error('Audio playback failed'));
        setIsPlaying(false);
        setIsLoading(false);
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Update volume when changed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  /**
   * Synthesize and play speech using ElevenLabs API
   * @param {string} text - Text to synthesize
   * @param {Object} options - Synthesis options
   */
  const speak = useCallback(async (text, options = {}) => {
    if (!text || typeof text !== 'string') {
      setError(new Error('Text is required for speech synthesis'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Stop any currently playing audio
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const response = await fetch('/api/elevenlabs/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          voice_id: options.voiceId || process.env.NEXT_PUBLIC_CLIENT_VOICE_ID,
          model_id: options.modelId || 'eleven_monolingual_v1',
          voice_settings: {
            stability: options.stability || 0.5,
            similarity_boost: options.similarityBoost || 0.5,
            style: options.style || 0.0,
            use_speaker_boost: options.useSpeakerBoost || true
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Get audio blob from response
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Play the audio
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.volume = isMuted ? 0 : volume / 100;

        await audioRef.current.play();
        setIsPlaying(true);
        currentAudioRef.current = audioUrl;
      }

    } catch (err) {
      console.error('ElevenLabs synthesis error:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [volume, isMuted]);

  /**
   * Stop current audio playback
   */
  const stop = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }

    // Clean up object URL
    if (currentAudioRef.current) {
      URL.revokeObjectURL(currentAudioRef.current);
      currentAudioRef.current = null;
    }
  }, []);

  /**
   * Toggle mute state
   */
  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  /**
   * Set volume level
   * @param {number} newVolume - Volume level (0-100)
   */
  const setVolumeLevel = useCallback((newVolume) => {
    const clampedVolume = Math.max(0, Math.min(100, newVolume));
    setVolume(clampedVolume);
  }, []);

  /**
   * Test audio functionality
   */
  const testAudio = useCallback(async () => {
    try {
      setError(null);
      await speak('This is a test of the ElevenLabs voice synthesis system. If you can hear this, the integration is working correctly.');
    } catch (err) {
      setError(err);
    }
  }, [speak]);

  /**
   * Get available voices from ElevenLabs
   */
  const getVoices = useCallback(async () => {
    try {
      const response = await fetch('/api/elevenlabs/voices');

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (err) {
      console.error('Error fetching voices:', err);
      setError(err);
      return [];
    }
  }, []);

  /**
   * Check if ElevenLabs service is available
   */
  const checkServiceAvailability = useCallback(async () => {
    try {
      const response = await fetch('/api/elevenlabs/voices', { method: 'HEAD' });
      return response.ok;
    } catch (err) {
      return false;
    }
  }, []);

  return {
    // State
    isPlaying,
    volume,
    isMuted,
    error,
    isLoading,

    // Actions
    speak,
    stop,
    setVolume: setVolumeLevel,
    toggleMute,
    testAudio,
    getVoices,
    checkServiceAvailability,

    // Computed values
    isReady: !isLoading && !error,
    canSpeak: !isLoading && !isPlaying
  };
};