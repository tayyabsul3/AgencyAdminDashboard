'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRecordingState } from '../../hooks/useRecordingState';
import { MdMic, MdMicOff, MdMoreVert, MdVisibility, MdTextFields } from 'react-icons/md';
import styles from './RecordingConsoleComponent.module.css';

const RecordingConsoleComponent = ({
  // Simplified control: use isRecording prop if provided
  isRecording,
  // Legacy props for backward compatibility
  recordingState: legacyRecordingState,
  inputLevel: legacyInputLevel,
  isUserSpeaking: legacyIsUserSpeaking,
  volume = 80,
  audioQuality: legacyAudioQuality,
  onToggleRecording,
  onVolumeChange,
  // Response panel props
  showResponsePanel = false,
  onToggleResponsePanel,
  // Mode switching prop
  onSwitchMode,
  // Disable microphone when AI preview is disabled
  disabled = false,
  // Hide recording button (when using external recording button)
  hideRecordingButton = false,
  className = '',
  ...props
}) => {
  // Use centralized recording state with throttling for performance
  const { state, visualState, derived, actions } = useRecordingState({
    enablePerformanceTracking: true,
    debounceMs: 0, // No debouncing to keep button responsiveness
    throttleMs: 100  // Throttle to ~10 updates/sec to reduce re-renders
  });

  // Performance tracking refs
  const lastStateChangeRef = useRef(Date.now());
  const performanceWarningShownRef = useRef(false);

  // Menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Prefer explicit isRecording prop for simplified UX; otherwise fall back to centralized/legacy
  const recordingState = (typeof isRecording === 'boolean')
    ? (isRecording ? 'recording' : 'idle')
    : ((legacyRecordingState && state.recordingState === 'idle')
      ? legacyRecordingState
      : (state.recordingState || legacyRecordingState || 'idle'));


  const inputLevel = (legacyInputLevel !== undefined && state.inputLevel === 0)
    ? legacyInputLevel
    : (state.inputLevel !== undefined ? state.inputLevel : (legacyInputLevel || 0));
  const isUserSpeaking = (legacyIsUserSpeaking !== undefined && state.isUserSpeaking === false)
    ? legacyIsUserSpeaking
    : (state.isUserSpeaking !== undefined ? state.isUserSpeaking : (legacyIsUserSpeaking || false));
  const audioQuality = (legacyAudioQuality && state.audioQuality === 'good')
    ? legacyAudioQuality
    : (state.audioQuality || legacyAudioQuality || 'good');
  const microphoneIconState = visualState?.microphoneIcon || 'idle';
  // Ensure the icon reflects recording immediately when state changes,
  // not only when speech activity is detected
  const effectiveMicIconState = recordingState === 'recording' ? 'recording' : microphoneIconState;

  // Use centralized visual state or compute from legacy props
  const shouldShowRecordingRing = visualState?.showRecordingRing ?? (recordingState === 'recording');
  const shouldAnimateWaves = visualState?.waveAnimationActive ??
    (recordingState === 'recording' && isUserSpeaking && effectiveMicIconState !== 'error');

  // Monitor performance to ensure 100ms requirement is met
  useEffect(() => {
    const currentTime = Date.now();
    const timeSinceLastChange = currentTime - lastStateChangeRef.current;

    // Track state change timing
    lastStateChangeRef.current = currentTime;

    // Log performance warning if state update takes too long
    if (timeSinceLastChange > 100 && !performanceWarningShownRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Recording state update exceeded 100ms requirement:', {
          duration: timeSinceLastChange,
          recordingState,
          microphoneIconState,
          timestamp: currentTime
        });
      }
      performanceWarningShownRef.current = true;

      // Reset warning flag after 5 seconds
      setTimeout(() => {
        performanceWarningShownRef.current = false;
      }, 5000);
    }
  }, [recordingState, microphoneIconState, shouldShowRecordingRing, shouldAnimateWaves]);

  const getRecordingButtonLabel = () => {
    // Simplified UX: Start/Stop Recording
    return recordingState === 'recording' ? 'Stop Recording' : 'Start Recording';
  };

  const getStatusText = () => {
    // Simplified UX: only two states
    return recordingState === 'recording' ? 'Recording active...' : 'Click to start recording';
  };

  const getAudioQualityColor = () => {
    switch (audioQuality) {
      case 'poor':
        return 'var(--audio-high)';
      case 'excellent':
        return 'var(--audio-optimal)';
      default:
        return 'var(--audio-medium)';
    }
  };

  const getInputLevelColor = () => {
    if (inputLevel < 0.3) return 'var(--audio-low)';
    if (inputLevel < 0.7) return 'var(--audio-optimal)';
    if (inputLevel < 0.9) return 'var(--audio-medium)';
    return 'var(--audio-high)';
  };

  return (
    <div className={`${styles.recordingConsole} ${className}`} {...props}>
      {/* Google Meet Style Control Bar */}
      <div className={styles.controlBar}>

        {/* Recording Button - Only show if not hidden */}
        {!hideRecordingButton && (
          <button
            className={`${styles.controlButton} ${styles.recordingButton} ${styles[recordingState]} ${styles[effectiveMicIconState]}`}
            onClick={async (e) => {
              e.preventDefault();
              try {
                if (onToggleRecording) {
                  await onToggleRecording();
                } else {
                  await actions.toggleRecording();
                }
              } catch (error) {
                console.error('Recording toggle error:', error);
                actions.setError(error.message || 'Recording failed', true);
              }
            }}
            disabled={disabled}
            aria-label={visualState?.ariaLabel || getRecordingButtonLabel()}
            aria-live={visualState?.ariaLive || 'off'}
            data-recording={recordingState === 'recording'}
            data-icon-state={microphoneIconState}
            data-testid="recording-button"
            title={disabled ? 'Microphone disabled - AI enhanced response is active' : getRecordingButtonLabel()}
          >
            <div className={styles.buttonContent}>
              {recordingState === 'recording' ?
                <MdMic className={styles.buttonIcon} /> :
                <MdMicOff className={styles.buttonIcon} />
              }
              <span className={styles.buttonText}>
                {recordingState === 'recording' ? 'Stop Recording' : 'Start Recording'}
              </span>
            </div>
          </button>
        )}

        {/* More Options Button */}
        <button
          className={`${styles.controlButton} ${styles.moreButton}`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="More options"
          title="More options"
        >
          <div className={styles.buttonContent}>
            <MdMoreVert className={styles.buttonIcon} />
            <span className={styles.buttonText}>More</span>
          </div>
        </button>
      </div>

      {/* More Options Menu */}
      {isMenuOpen && (
        <div className={styles.moreOptionsMenu}>
          <button
            className={styles.menuItem}
            onClick={() => {
              if (onToggleResponsePanel) onToggleResponsePanel();
              setIsMenuOpen(false);
            }}
            aria-label={showResponsePanel ? "Hide Response Panel" : "Show Response Panel"}
            title={showResponsePanel ? "Hide Response Panel" : "Show Response Panel"}
          >
            <MdVisibility className={styles.menuIcon} />
            <span>{showResponsePanel ? "Hide Response" : "Show Response"}</span>
          </button>
          {onSwitchMode && (
            <button
              className={styles.menuItem}
              onClick={() => {
                if (recordingState === 'recording') {
                  // Don't switch modes during recording
                  return;
                }
                onSwitchMode();
                setIsMenuOpen(false);
              }}
              disabled={recordingState === 'recording'}
              aria-label={recordingState === 'recording' ? "Stop recording first to switch modes" : "Switch to Text Mode"}
              title={recordingState === 'recording' ? "Stop recording first to switch modes" : "Switch to Text Mode"}
            >
              <MdTextFields className={styles.menuIcon} />
              <span>{recordingState === 'recording' ? 'Stop Recording First' : 'Text Mode'}</span>
            </button>
          )}
        </div>
      )}

      {/* Status Text (floating above controls) */}
      {recordingState === 'recording' && (
        <div className={styles.statusIndicator}>
          <span className={styles.statusText}>{getStatusText()}</span>
        </div>
      )}
    </div>
  );
};

export default React.memo(RecordingConsoleComponent);
