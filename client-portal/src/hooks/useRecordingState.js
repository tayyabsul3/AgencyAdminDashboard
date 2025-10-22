/**
 * useRecordingState Hook
 * React hook for managing recording state with the centralized RecordingStateManager
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { recordingStateManager } from '../services/RecordingStateManager';

/**
 * Custom hook for recording state management
 * @param {Object} options - Hook configuration options
 * @returns {Object} Recording state and actions
 */
export const useRecordingState = (options = {}) => {
  const {
    // Auto-initialize on mount
    autoInitialize = true,
    // Performance optimization options
    enablePerformanceTracking = true,
    // Debounce rapid state changes
    debounceMs = 0,
    // Enable batched updates for performance
    enableBatching = false,
    // Throttle re-renders for high-frequency updates
    throttleMs = 16 // ~60fps
  } = options;

  // Local state for React re-renders
  const [state, setState] = useState(() => recordingStateManager.getState());
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs for cleanup and performance optimizations
  const unsubscribeRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const throttleTimeoutRef = useRef(null);
  const mountedRef = useRef(true);
  const lastUpdateTimeRef = useRef(Date.now());

  // Optimized state update function with debouncing and throttling
  const updateState = useCallback((newState) => {
    if (!mountedRef.current) {
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

    const performUpdate = () => {
      if (mountedRef.current) {
        setState(newState);
        lastUpdateTimeRef.current = Date.now();
      }
    };

    if (debounceMs > 0) {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(performUpdate, debounceMs);
    } else if (throttleMs > 0 && timeSinceLastUpdate < throttleMs) {
      // Throttle rapid updates
      if (!throttleTimeoutRef.current) {
        throttleTimeoutRef.current = setTimeout(() => {
          throttleTimeoutRef.current = null;
          performUpdate();
        }, throttleMs - timeSinceLastUpdate);
      }
    } else {
      performUpdate();
    }
  }, [debounceMs, throttleMs]);

  // Event listener for state changes
  const handleStateChange = useCallback((event) => {
    if (!mountedRef.current) return;

    const newState = recordingStateManager.getState();
    updateState(newState);

    // Log performance metrics if enabled
    if (enablePerformanceTracking && event.type === 'state-changed') {
      const metrics = recordingStateManager.getPerformanceMetrics();
      if (metrics.lastTransitionTime > 100) {
        console.warn('Slow recording state transition:', {
          type: event.type,
          duration: metrics.lastTransitionTime,
          data: event.data
        });
      }
    }
  }, [updateState, enablePerformanceTracking]);

  // Initialize hook
  useEffect(() => {
    if (!autoInitialize) return;

    // Set mounted to true - THIS WAS MISSING!
    mountedRef.current = true;

    // Subscribe to state changes
    unsubscribeRef.current = recordingStateManager.addEventListener(handleStateChange);

    // Get initial state
    const initialState = recordingStateManager.getState();
    setState(initialState);
    setIsInitialized(true);

    return () => {
      mountedRef.current = false;

      // Clear all timeouts
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }

      // Flush any pending updates before cleanup
      recordingStateManager.flushPendingUpdates();

      // Unsubscribe from state changes
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [autoInitialize, handleStateChange]);

  // Action creators with error handling
  const actions = {
    /**
     * Start recording
     */
    startRecording: useCallback(async () => {
      try {
        const success = recordingStateManager.startRecording();
        if (!success) {
          throw new Error('Failed to start recording - invalid state transition');
        }
        return { success: true };
      } catch (error) {
        console.error('Error starting recording:', error);
        recordingStateManager.setError(error.message, true);
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Stop recording
     */
    stopRecording: useCallback(() => {
      try {
        const success = recordingStateManager.stopRecording();
        if (!success) {
          throw new Error('Failed to stop recording - invalid state transition');
        }
        return { success: true };
      } catch (error) {
        console.error('Error stopping recording:', error);
        recordingStateManager.setError(error.message, true);
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Set user speaking state with input level (optimized for rapid updates)
     */
    setUserSpeaking: useCallback((speaking, inputLevel = 0) => {
      try {
        const success = recordingStateManager.setUserSpeaking(speaking, inputLevel);
        return { success };
      } catch (error) {
        console.error('Error setting user speaking state:', error);
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Batch multiple state updates for performance
     */
    batchUpdate: useCallback((updates) => {
      try {
        recordingStateManager.updateState(updates, { batch: true });
        return { success: true };
      } catch (error) {
        console.error('Error in batch update:', error);
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Force flush of pending updates
     */
    flushUpdates: useCallback(() => {
      try {
        recordingStateManager.flushPendingUpdates();
        return { success: true };
      } catch (error) {
        console.error('Error flushing updates:', error);
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Configure retry behavior
     */
    configureRetry: useCallback((options) => {
      try {
        const config = recordingStateManager.configureRetry(options);
        return { success: true, config };
      } catch (error) {
        console.error('Error configuring retry:', error);
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Get retry status
     */
    getRetryStatus: useCallback(() => {
      try {
        const status = recordingStateManager.getRetryStatus();
        return { success: true, status };
      } catch (error) {
        console.error('Error getting retry status:', error);
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Set processing state
     */
    setProcessing: useCallback((processing) => {
      try {
        const success = recordingStateManager.setProcessing(processing);
        return { success };
      } catch (error) {
        console.error('Error setting processing state:', error);
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Set muted state
     */
    setMuted: useCallback((muted) => {
      try {
        const success = recordingStateManager.setMuted(muted);
        return { success };
      } catch (error) {
        console.error('Error setting muted state:', error);
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Set error state with optional auto-retry
     */
    setError: useCallback((error, canRetry = true, enableAutoRetry = false) => {
      try {
        recordingStateManager.setError(error, canRetry, enableAutoRetry);
        return { success: true };
      } catch (err) {
        console.error('Error setting error state:', err);
        return { success: false, error: err.message };
      }
    }, []),

    /**
     * Clear error state
     */
    clearError: useCallback(() => {
      try {
        const success = recordingStateManager.clearError();
        return { success };
      } catch (error) {
        console.error('Error clearing error state:', error);
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Set microphone access permission
     */
    setMicrophoneAccess: useCallback((access) => {
      try {
        const success = recordingStateManager.setMicrophoneAccess(access);
        return { success };
      } catch (error) {
        console.error('Error setting microphone access:', error);
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Set audio quality
     */
    setAudioQuality: useCallback((quality) => {
      try {
        recordingStateManager.setAudioQuality(quality);
        return { success: true };
      } catch (error) {
        console.error('Error setting audio quality:', error);
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Pause recording
     */
    pauseRecording: useCallback(() => {
      try {
        const success = recordingStateManager.pauseRecording();
        return { success };
      } catch (error) {
        console.error('Error pausing recording:', error);
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Resume recording
     */
    resumeRecording: useCallback(() => {
      try {
        const success = recordingStateManager.resumeRecording();
        return { success };
      } catch (error) {
        console.error('Error resuming recording:', error);
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Toggle recording (start/stop)
     */
    toggleRecording: useCallback(async () => {
      try {
        const currentState = recordingStateManager.getState();

        if (currentState.recordingState === 'recording') {
          const success = recordingStateManager.stopRecording();
          if (!success) {
            throw new Error('Failed to stop recording - invalid state transition');
          }
          return { success: true };
        } else if (currentState.recordingState === 'paused') {
          const success = recordingStateManager.resumeRecording();
          if (!success) {
            throw new Error('Failed to resume recording - invalid state transition');
          }
          return { success: true };
        } else {
          const success = recordingStateManager.startRecording();
          if (!success) {
            throw new Error('Failed to start recording - invalid state transition');
          }
          return { success: true };
        }
      } catch (error) {
        console.error('Error toggling recording:', error);
        recordingStateManager.setError(error.message, true);
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Reset state to initial values
     */
    reset: useCallback(() => {
      try {
        recordingStateManager.reset();
        return { success: true };
      } catch (error) {
        console.error('Error resetting recording state:', error);
        return { success: false, error: error.message };
      }
    }, [])
  };

  // Derived state for UI components
  const derived = {
    // Visual indicators
    shouldShowIcon: state.visualState?.microphoneIcon !== 'idle',
    shouldAnimateWaves: state.visualState?.waveAnimationActive || false,
    shouldShowPulse: state.visualState?.pulseAnimationActive || false,
    shouldShowRecordingRing: state.visualState?.showRecordingRing || false,
    shouldShowProcessingIndicator: state.visualState?.showProcessingIndicator || false,
    shouldShowErrorIndicator: state.visualState?.showErrorIndicator || false,
    shouldShowInputLevel: state.visualState?.showInputLevel || false,

    // Icon states
    iconState: state.visualState?.microphoneIcon || 'idle',
    buttonState: state.visualState?.buttonState || 'idle',

    // Status information
    statusText: state.visualState?.statusText || 'Ready to record',
    statusColor: state.visualState?.statusColor || 'neutral',
    buttonText: state.visualState?.buttonText || 'Start Recording',

    // Accessibility
    ariaLabel: state.visualState?.ariaLabel || 'Recording control',
    ariaLive: state.visualState?.ariaLive || 'off',

    // State checks
    isRecording: state.recordingState === 'recording',
    isProcessing: state.recordingState === 'processing',
    isPaused: state.recordingState === 'paused',
    hasError: state.recordingState === 'error',
    canRecord: state.microphoneAccess === 'granted' && state.recordingState !== 'error',
    canRetry: state.canRetry || false,

    // Audio information
    inputLevel: state.inputLevel || 0,
    audioQuality: state.audioQuality || 'good',
    isUserSpeaking: state.isUserSpeaking || false,
    isMuted: state.isMuted || false,

    // Performance information
    performanceMetrics: enablePerformanceTracking ? recordingStateManager.getPerformanceMetrics() : null,

    // Error recovery information
    retryStatus: recordingStateManager.getRetryStatus()
  };

  // Manual initialization function for cases where autoInitialize is false
  const initialize = useCallback(() => {
    if (isInitialized) return { success: true };

    try {
      unsubscribeRef.current = recordingStateManager.addEventListener(handleStateChange);
      const initialState = recordingStateManager.getState();
      setState(initialState);
      setIsInitialized(true);
      return { success: true };
    } catch (error) {
      console.error('Error initializing recording state hook:', error);
      return { success: false, error: error.message };
    }
  }, [isInitialized, handleStateChange]);

  // Cleanup function
  const cleanup = useCallback(() => {
    mountedRef.current = false;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    setIsInitialized(false);
  }, []);

  return {
    // Core state
    recordingState: state.recordingState,
    microphoneState: state.microphoneState,
    audioState: state.audioState,

    // Full state object
    state,

    // Visual state for UI components
    visualState: state.visualState,

    // Derived state for convenience
    derived,

    // Actions
    actions,

    // Utility functions
    initialize,
    cleanup,

    // Hook status
    isInitialized,

    // Performance metrics (if enabled)
    performanceMetrics: enablePerformanceTracking ? recordingStateManager.getPerformanceMetrics() : null
  };
};

export default useRecordingState;