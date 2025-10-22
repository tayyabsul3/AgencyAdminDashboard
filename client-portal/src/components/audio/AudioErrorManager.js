/**
 * Audio Error Manager Component
 * Manages audio errors and provides user interface for error handling
 */

import React, { useState, useEffect, useCallback } from 'react';
import AudioErrorNotification from './AudioErrorNotification';
import { audioErrorHandler } from '../../services/audioErrorHandler';
import { gracefulDegradationService } from '../../services/gracefulDegradationService';

const AudioErrorManager = ({
  onModeSwitch,
  onRetryAudio,
  onContactSupport,
  children
}) => {
  const [currentError, setCurrentError] = useState(null);
  const [errorHistory, setErrorHistory] = useState([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [degradationStatus, setDegradationStatus] = useState(null);

  // Initialize error handling listeners
  useEffect(() => {
    const handleAudioError = (event, data) => {
      switch (event) {
        case 'audio-error':
          handleNewError(data.userError, data.classification, data.context);
          break;
        case 'auto-fallback-triggered':
          handleAutoFallback(data.userError);
          break;
        case 'retry-scheduled':
          handleRetryScheduled(data);
          break;
        case 'retry-success':
          handleRetrySuccess(data);
          break;
        case 'retry-failed':
          handleRetryFailed(data);
          break;
        default:
          console.log('Audio error event:', event, data);
      }
    };

    const handleDegradationEvent = (event, data) => {
      switch (event) {
        case 'fallback-starting':
          handleFallbackStarting(data);
          break;
        case 'fallback-completed':
          handleFallbackCompleted(data);
          break;
        case 'fallback-failed':
          handleFallbackFailed(data);
          break;
        case 'voice-retry-starting':
          handleVoiceRetryStarting(data);
          break;
        case 'voice-retry-success':
          handleVoiceRetrySuccess(data);
          break;
        case 'voice-retry-failed':
          handleVoiceRetryFailed(data);
          break;
        // Enhanced degradation events
        case 'enhanced-fallback-starting':
          handleEnhancedFallbackStarting(data);
          break;
        case 'enhanced-fallback-completed':
          handleEnhancedFallbackCompleted(data);
          break;
        case 'enhanced-fallback-failed':
          handleEnhancedFallbackFailed(data);
          break;
        case 'enhanced-voice-retry-starting':
          handleEnhancedVoiceRetryStarting(data);
          break;
        case 'enhanced-voice-retry-success':
          handleEnhancedVoiceRetrySuccess(data);
          break;
        case 'enhanced-voice-retry-failed':
          handleEnhancedVoiceRetryFailed(data);
          break;
        case 'progress-preservation-failed':
          handleProgressPreservationFailed(data);
          break;
        case 'retry-attempt':
          handleRetryAttempt(data);
          break;
        case 'retry-exhausted':
          handleRetryExhausted(data);
          break;
        case 'fallback-grace-period':
          handleFallbackGracePeriod(data);
          break;
        default:
          console.log('Degradation event:', event, data);
      }
    };

    // Add listeners
    audioErrorHandler.addListener(handleAudioError);
    gracefulDegradationService.addListener(handleDegradationEvent);

    // Get initial status
    setDegradationStatus(gracefulDegradationService.getStatus());

    // Cleanup listeners on unmount
    return () => {
      audioErrorHandler.removeListener(handleAudioError);
      gracefulDegradationService.removeListener(handleDegradationEvent);
    };
  }, []);

  const handleNewError = useCallback((userError, classification, context) => {
    const errorWithId = {
      ...userError,
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      classification,
      context,
      dismissed: false
    };

    setCurrentError(errorWithId);
    setErrorHistory(prev => [errorWithId, ...prev.slice(0, 9)]); // Keep last 10 errors
  }, []);

  const handleAutoFallback = useCallback((userError) => {
    const fallbackError = {
      ...userError,
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      title: 'Switched to Text Mode',
      message: 'We\'ve automatically switched to text mode due to audio issues. Your progress has been saved.',
      severity: 'medium',
      canRetry: true,
      canSwitchToText: false, // Already switched
      autoFallback: true
    };

    setCurrentError(fallbackError);
  }, []);

  const handleRetryScheduled = useCallback((data) => {
    setIsRetrying(true);
    
    if (currentError) {
      setCurrentError(prev => ({
        ...prev,
        retrying: true,
        retryAttempt: data.attempt,
        retryDelay: data.delay
      }));
    }
  }, [currentError]);

  const handleRetrySuccess = useCallback((data) => {
    setIsRetrying(false);
    
    // Clear current error on successful retry
    setCurrentError(null);
    
    // Update error history
    setErrorHistory(prev => 
      prev.map(error => 
        error.id === currentError?.id 
          ? { ...error, resolved: true, resolvedAt: Date.now() }
          : error
      )
    );
  }, [currentError]);

  const handleRetryFailed = useCallback((data) => {
    setIsRetrying(false);
    
    if (currentError) {
      setCurrentError(prev => ({
        ...prev,
        retrying: false,
        retryFailed: true,
        retryAttempt: data.attempt,
        message: `${prev.message} (Retry ${data.attempt} failed)`
      }));
    }
  }, [currentError]);

  const handleFallbackStarting = useCallback((data) => {
    setDegradationStatus(prev => ({
      ...prev,
      fallbackInProgress: true,
      fallbackReason: data.userError
    }));
  }, []);

  const handleFallbackCompleted = useCallback((data) => {
    setDegradationStatus(gracefulDegradationService.getStatus());
    
    // Show success notification
    const successError = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      title: 'Successfully Switched to Text Mode',
      message: data.message || 'You can now continue the interview by typing your responses.',
      severity: 'low',
      canRetry: data.currentMode === 'text',
      canSwitchToText: false,
      type: 'fallback_success'
    };

    setCurrentError(successError);
  }, []);

  const handleFallbackFailed = useCallback((data) => {
    setDegradationStatus(prev => ({
      ...prev,
      fallbackInProgress: false,
      fallbackError: data.error
    }));

    const failureError = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      title: 'Fallback Failed',
      message: 'Unable to switch to text mode automatically. Please refresh the page.',
      severity: 'critical',
      canRetry: true,
      canSwitchToText: false,
      type: 'fallback_failure',
      instructions: [
        'Refresh the page to reset the interview',
        'Try using a different browser',
        'Contact support if the problem persists'
      ]
    };

    setCurrentError(failureError);
  }, []);

  const handleVoiceRetryStarting = useCallback((data) => {
    setIsRetrying(true);
    
    const retryError = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      title: 'Testing Voice Features',
      message: 'Testing audio functionality before switching back to voice mode...',
      severity: 'low',
      canRetry: false,
      canSwitchToText: false,
      type: 'voice_retry_testing'
    };

    setCurrentError(retryError);
  }, []);

  const handleVoiceRetrySuccess = useCallback((data) => {
    setIsRetrying(false);
    setDegradationStatus(gracefulDegradationService.getStatus());
    
    const successError = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      title: 'Voice Mode Restored',
      message: 'Successfully switched back to voice mode. You can now speak your responses.',
      severity: 'low',
      canRetry: false,
      canSwitchToText: true,
      type: 'voice_retry_success'
    };

    setCurrentError(successError);
  }, []);

  const handleVoiceRetryFailed = useCallback((data) => {
    setIsRetrying(false);
    
    const failureError = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      title: 'Voice Mode Unavailable',
      message: data.error?.message || 'Unable to switch back to voice mode. Continuing with text mode.',
      severity: 'medium',
      canRetry: true,
      canSwitchToText: false,
      type: 'voice_retry_failed',
      instructions: [
        'Check your microphone permissions',
        'Ensure your microphone is connected',
        'Try refreshing the page'
      ]
    };

    setCurrentError(failureError);
  }, []);

  // Enhanced degradation event handlers
  const handleEnhancedFallbackStarting = useCallback((data) => {
    setDegradationStatus(prev => ({
      ...prev,
      enhancedFallbackInProgress: true,
      fallbackStrategy: data.options?.strategy,
      fallbackReason: data.error
    }));

    const startingError = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      title: 'Switching to Text Mode',
      message: 'Analyzing the issue and preserving your progress...',
      severity: 'low',
      canRetry: false,
      canSwitchToText: false,
      type: 'enhanced_fallback_starting'
    };

    setCurrentError(startingError);
  }, []);

  const handleEnhancedFallbackCompleted = useCallback((data) => {
    setDegradationStatus(gracefulDegradationService.getStatus());
    
    const successError = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      title: 'Successfully Switched to Text Mode',
      message: data.message || 'Your progress has been preserved and you can continue with text input.',
      severity: 'low',
      canRetry: data.strategy?.canRetry || false,
      canSwitchToText: false,
      type: 'enhanced_fallback_success',
      metadata: {
        strategy: data.strategy,
        preservedData: !!data.preservedData,
        previousMode: data.previousMode
      }
    };

    setCurrentError(successError);
  }, []);

  const handleEnhancedFallbackFailed = useCallback((data) => {
    setDegradationStatus(prev => ({
      ...prev,
      enhancedFallbackInProgress: false,
      fallbackError: data.error
    }));

    const failureError = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      title: 'Enhanced Fallback Failed',
      message: `Unable to switch to text mode automatically: ${data.error}`,
      severity: 'critical',
      canRetry: true,
      canSwitchToText: false,
      type: 'enhanced_fallback_failure',
      instructions: [
        'Try refreshing the page to reset the system',
        'Clear your browser cache and cookies',
        'Try using a different browser',
        'Contact support if the problem persists'
      ],
      originalError: data.originalError
    };

    setCurrentError(failureError);
  }, []);

  const handleEnhancedVoiceRetryStarting = useCallback((data) => {
    setIsRetrying(true);
    
    const retryError = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      title: 'Testing Voice Features',
      message: 'Running comprehensive audio tests before switching to voice mode...',
      severity: 'low',
      canRetry: false,
      canSwitchToText: false,
      type: 'enhanced_voice_retry_testing',
      metadata: {
        retryId: data.retryId,
        options: data.options
      }
    };

    setCurrentError(retryError);
  }, []);

  const handleEnhancedVoiceRetrySuccess = useCallback((data) => {
    setIsRetrying(false);
    setDegradationStatus(gracefulDegradationService.getStatus());
    
    const successError = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      title: 'Voice Mode Restored',
      message: `Successfully switched back to voice mode after comprehensive testing (${data.duration}ms).`,
      severity: 'low',
      canRetry: false,
      canSwitchToText: true,
      type: 'enhanced_voice_retry_success',
      metadata: {
        retryId: data.retryId,
        testResults: data.testResults,
        duration: data.duration
      }
    };

    setCurrentError(successError);
  }, []);

  const handleEnhancedVoiceRetryFailed = useCallback((data) => {
    setIsRetrying(false);
    
    const failureError = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      title: 'Enhanced Voice Test Failed',
      message: `Unable to switch to voice mode: ${data.error}`,
      severity: 'medium',
      canRetry: true,
      canSwitchToText: false,
      type: 'enhanced_voice_retry_failed',
      instructions: [
        'Check your microphone permissions in browser settings',
        'Ensure your microphone is properly connected',
        'Try closing other applications that might be using your microphone',
        'Refresh the page and try again'
      ],
      metadata: {
        retryId: data.retryId,
        duration: data.duration
      }
    };

    setCurrentError(failureError);
  }, []);

  const handleProgressPreservationFailed = useCallback((data) => {
    console.warn('Progress preservation failed:', data);
    
    // Don't show error to user unless it's critical
    // Just log it for debugging purposes
  }, []);

  const handleRetryAttempt = useCallback((data) => {
    if (currentError) {
      setCurrentError(prev => ({
        ...prev,
        retryInProgress: true,
        retryAttempt: data.attempt,
        retryMaxAttempts: data.maxRetries,
        retryDelay: data.delay,
        message: `${prev.message} (Retry ${data.attempt}/${data.maxRetries} in ${Math.round(data.delay/1000)}s)`
      }));
    }
  }, [currentError]);

  const handleRetryExhausted = useCallback((data) => {
    if (currentError) {
      setCurrentError(prev => ({
        ...prev,
        retryInProgress: false,
        retryExhausted: true,
        canRetry: false,
        message: `${prev.message} (All retry attempts exhausted)`,
        instructions: [
          ...(prev.instructions || []),
          'All automatic retry attempts have failed',
          'Try refreshing the page to reset the system',
          'Consider switching to text mode for now'
        ]
      }));
    }
  }, [currentError]);

  const handleFallbackGracePeriod = useCallback((data) => {
    if (currentError) {
      setCurrentError(prev => ({
        ...prev,
        gracePeriod: data.gracePeriod,
        message: `${prev.message} (Waiting ${Math.round(data.gracePeriod/1000)}s before fallback)`
      }));
    }
  }, [currentError]);

  const handleRetry = useCallback(async () => {
    if (!currentError) return;

    setIsRetrying(true);

    try {
      if (currentError.type === 'voice_retry_failed' || degradationStatus?.currentMode === 'text') {
        // Enhanced retry switching to voice mode
        const result = await gracefulDegradationService.enhancedRetryVoiceMode({
          testAudio: true,
          testMicrophone: true,
          testSynthesis: true,
          preserveProgress: true,
          onProgress: (step, progress) => {
            setCurrentError(prev => ({
              ...prev,
              retryProgress: { step, progress },
              message: `Testing audio functionality... (${Math.round(progress * 100)}%)`
            }));
          },
          timeout: 30000
        });

        if (result.success) {
          if (onRetryAudio) {
            onRetryAudio('voice_mode_restored', result);
          }
        } else {
          throw new Error(result.error || 'Enhanced voice mode retry failed');
        }
      } else {
        // Enhanced general audio retry with exponential backoff
        await gracefulDegradationService.createRetryMechanism(
          async () => {
            if (onRetryAudio) {
              return await onRetryAudio('general_retry', { error: currentError });
            }
            throw new Error('No retry handler available');
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
            backoffMultiplier: 2,
            maxDelay: 10000,
            context: { errorType: currentError.type, component: 'AudioErrorManager' },
            onRetry: (error, attempt, maxRetries, delay) => {
              setCurrentError(prev => ({
                ...prev,
                retryAttempt: attempt,
                retryDelay: delay,
                message: `${prev.message} (Retrying in ${Math.round(delay/1000)}s... attempt ${attempt}/${maxRetries})`
              }));
            },
            shouldRetry: (error, attempt) => {
              // Don't retry permission errors
              return !error.message.toLowerCase().includes('permission') &&
                     !error.message.toLowerCase().includes('not allowed');
            }
          }
        );
      }
    } catch (error) {
      console.error('Enhanced retry failed:', error);
      
      // Update current error with enhanced retry failure information
      setCurrentError(prev => ({
        ...prev,
        retryFailed: true,
        retryError: error.message,
        message: `${prev.message} (Enhanced retry failed: ${error.message})`,
        canRetry: false, // Disable further retries after enhanced retry fails
        instructions: [
          ...(prev.instructions || []),
          'Try refreshing the page to reset the audio system',
          'Check your browser settings and permissions',
          'Consider switching to a different browser'
        ]
      }));
    } finally {
      setIsRetrying(false);
    }
  }, [currentError, degradationStatus, onRetryAudio]);

  const handleSwitchToText = useCallback(async () => {
    try {
      // Use enhanced fallback for better error handling and progress preservation
      const result = await gracefulDegradationService.executeEnhancedFallback(
        new Error(currentError?.message || 'User requested text mode'),
        { 
          operation: 'manual_switch',
          component: 'AudioErrorManager',
          userInitiated: true
        },
        {
          preserveProgress: true,
          notifyUser: true,
          reason: 'user_requested',
          fallbackMode: 'text',
          gracePeriod: 0 // No grace period for manual switch
        }
      );
      
      if (result.success && onModeSwitch) {
        onModeSwitch('text', result);
      } else if (!result.success) {
        // Handle fallback failure
        setCurrentError(prev => ({
          ...prev,
          fallbackFailed: true,
          message: `Failed to switch to text mode: ${result.error}`,
          instructions: [
            'Try refreshing the page',
            'Clear your browser cache',
            'Contact support if the problem persists'
          ]
        }));
      }
    } catch (error) {
      console.error('Enhanced switch to text mode failed:', error);
      
      // Fallback to basic switch if enhanced fails
      try {
        const basicResult = await gracefulDegradationService.switchToTextMode('user_requested_fallback');
        if (basicResult.success && onModeSwitch) {
          onModeSwitch('text', basicResult);
        }
      } catch (basicError) {
        console.error('Basic switch to text mode also failed:', basicError);
        setCurrentError(prev => ({
          ...prev,
          criticalFailure: true,
          severity: 'critical',
          message: 'Unable to switch to text mode. Please refresh the page.',
          instructions: [
            'Refresh the page immediately',
            'Clear browser cache and cookies',
            'Try using a different browser',
            'Contact support with error details'
          ]
        }));
      }
    }
  }, [onModeSwitch, currentError]);

  const handleDismiss = useCallback(() => {
    setCurrentError(null);
  }, []);

  const handleContactSupport = useCallback(() => {
    if (onContactSupport) {
      onContactSupport({
        error: currentError,
        errorHistory,
        degradationStatus,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      });
    }
  }, [currentError, errorHistory, degradationStatus, onContactSupport]);

  // Auto-hide success messages
  useEffect(() => {
    if (currentError && 
        (currentError.type === 'fallback_success' || currentError.type === 'voice_retry_success') &&
        currentError.severity === 'low') {
      const timer = setTimeout(() => {
        setCurrentError(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [currentError]);

  return (
    <>
      {children}
      
      {currentError && (
        <AudioErrorNotification
          error={currentError}
          onRetry={currentError.canRetry && !isRetrying ? handleRetry : null}
          onSwitchToText={currentError.canSwitchToText ? handleSwitchToText : null}
          onDismiss={handleDismiss}
          onContactSupport={currentError.severity === 'critical' ? handleContactSupport : null}
          autoHide={currentError.severity === 'low'}
          autoHideDelay={currentError.type?.includes('success') ? 5000 : 10000}
        />
      )}
      
      {isRetrying && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '20px',
          borderRadius: '8px',
          zIndex: 1001,
          textAlign: 'center'
        }}>
          <div>Retrying audio operation...</div>
          <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.8 }}>
            Please wait while we attempt to restore audio functionality
          </div>
        </div>
      )}
    </>
  );
};

export default AudioErrorManager;