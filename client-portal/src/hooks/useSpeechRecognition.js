/**
 * React Hook for Speech Recognition
 * Provides easy integration with the speech recognition service
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import speechService from '../services/speechService';

export const useSpeechRecognition = (options = {}) => {
  // State
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Refs for stable callbacks
  const optionsRef = useRef(options);
  const callbacksRef = useRef({});

  // Update refs when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Initialize speech service
  useEffect(() => {
    const initializeSpeech = async () => {
      const supported = speechService.isSupported();
      setIsSupported(supported);

      if (supported) {
        const initialized = await speechService.initialize();
        setIsInitialized(initialized);
      }
    };

    initializeSpeech();

    // Cleanup on unmount
    return () => {
      if (isListening) {
        speechService.stopListening();
      }
    };
  }, []);

  // Set up callbacks
  useEffect(() => {
    callbacksRef.current = {
      onTranscription: (data) => {
        setTranscript(data.current);
        setFinalTranscript(data.final);
        setInterimTranscript(data.interim);
        setConfidence(data.confidence);
        
        // Call user callback if provided
        if (optionsRef.current.onTranscription) {
          optionsRef.current.onTranscription(data);
        }
      },

      onError: (errorInfo) => {
        setError(errorInfo);
        setIsListening(false);
        
        // Call user callback if provided
        if (optionsRef.current.onError) {
          optionsRef.current.onError(errorInfo);
        }
      },

      onStart: () => {
        setIsListening(true);
        setError(null);
        
        // Call user callback if provided
        if (optionsRef.current.onStart) {
          optionsRef.current.onStart();
        }
      },

      onEnd: () => {
        setIsListening(false);
        
        // Call user callback if provided
        if (optionsRef.current.onEnd) {
          optionsRef.current.onEnd();
        }
      },

      onSpeechStart: () => {
        setIsSpeaking(true);
        
        // Call user callback if provided
        if (optionsRef.current.onSpeechStart) {
          optionsRef.current.onSpeechStart();
        }
      },

      onSpeechEnd: () => {
        setIsSpeaking(false);
        
        // Call user callback if provided
        if (optionsRef.current.onSpeechEnd) {
          optionsRef.current.onSpeechEnd();
        }
      }
    };
  }, []);

  // Start listening function
  const startListening = useCallback(async () => {
    if (!isSupported || !isInitialized) {
      setError({
        error: 'not-supported',
        message: 'Speech recognition is not supported or not initialized',
        timestamp: Date.now(),
        canRetry: false
      });
      return false;
    }

    if (isListening) {
      console.warn('Already listening');
      return true;
    }

    // Clear previous state
    setError(null);
    setTranscript('');
    setFinalTranscript('');
    setInterimTranscript('');
    setConfidence(0);

    // Start listening with callbacks
    const success = await speechService.startListening(callbacksRef.current);
    return success;
  }, [isSupported, isInitialized, isListening]);

  // Stop listening function
  const stopListening = useCallback(() => {
    if (!isListening) {
      console.warn('Not currently listening');
      return;
    }

    speechService.stopListening();
  }, [isListening]);

  // Restart listening function
  const restartListening = useCallback(() => {
    speechService.restart();
  }, []);

  // Clear transcripts function
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setFinalTranscript('');
    setInterimTranscript('');
    setConfidence(0);
    speechService.clearTranscripts();
  }, []);

  // Clear error function
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Get compatibility info
  const getCompatibilityInfo = useCallback(() => {
    return speechService.getCompatibilityInfo();
  }, []);

  // Get status
  const getStatus = useCallback(() => {
    return {
      isSupported,
      isInitialized,
      isListening,
      isSpeaking,
      transcript,
      finalTranscript,
      interimTranscript,
      confidence,
      error,
      compatibility: speechService.getCompatibilityInfo()
    };
  }, [
    isSupported,
    isInitialized,
    isListening,
    isSpeaking,
    transcript,
    finalTranscript,
    interimTranscript,
    confidence,
    error
  ]);

  return {
    // State
    isSupported,
    isInitialized,
    isListening,
    isSpeaking,
    transcript,
    finalTranscript,
    interimTranscript,
    confidence,
    error,

    // Actions
    startListening,
    stopListening,
    restartListening,
    clearTranscript,
    clearError,

    // Utilities
    getCompatibilityInfo,
    getStatus
  };
};

export default useSpeechRecognition;