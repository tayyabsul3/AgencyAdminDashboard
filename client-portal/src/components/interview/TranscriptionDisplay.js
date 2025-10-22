'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import styles from './TranscriptionDisplay.module.css';

const TranscriptionDisplay = React.memo(({
  transcription = { current: '', final: '', interim: '', confidence: 0 },
  isListening = false,
  isUserSpeaking = false,
  saveStatus = 'idle', // idle | saving | saved | error
  lastSavedAt = null
}) => {

  const [showConfidenceDetails, setShowConfidenceDetails] = useState(false);
  const transcriptionRef = useRef(null);

  // Auto-scroll to bottom when new content is added
  useEffect(() => {
    if (transcriptionRef.current) {
      transcriptionRef.current.scrollTop = transcriptionRef.current.scrollHeight;
    }
  }, [transcription.current]);

  // Memoized confidence level info - only recalculates when confidence changes
  const confidenceInfo = useMemo(() => {
    const confidence = transcription.confidence || 0;

    if (confidence >= 0.8) {
      return {
        level: 'high',
        label: 'High Confidence',
        color: '#4ecdc4',
        icon: '🟢',
        description: 'Speech recognition is very confident about this transcription'
      };
    } else if (confidence >= 0.6) {
      return {
        level: 'medium',
        label: 'Medium Confidence',
        color: '#f39c12',
        icon: '🟡',
        description: 'Speech recognition is moderately confident - you may want to review'
      };
    } else if (confidence > 0) {
      return {
        level: 'low',
        label: 'Low Confidence',
        color: '#e74c3c',
        icon: '🔴',
        description: 'Speech recognition has low confidence - please review and edit'
      };
    } else {
      return {
        level: 'unknown',
        label: 'Unknown',
        color: '#95a5a6',
        icon: '⚪',
        description: 'Confidence level not available'
      };
    }
  }, [transcription.confidence]);

  // Memoized listening status info - only recalculates when listening state changes
  const listeningStatus = useMemo(() => {
    if (isUserSpeaking) {
      return {
        status: 'speaking',
        label: 'Speaking...',
        icon: '🎤',
        color: '#f093fb',
        description: 'Listening to your speech'
      };
    } else if (isListening) {
      return {
        status: 'listening',
        label: 'Listening...',
        icon: '👂',
        color: '#4ecdc4',
        description: 'Ready to capture your speech'
      };
    } else {
      return {
        status: 'idle',
        label: 'Not Listening',
        icon: '⏸️',
        color: '#95a5a6',
        description: 'Speech recognition is paused'
      };
    }
  }, [isListening, isUserSpeaking]);

  // Memoized last saved time formatting - only recalculates when timestamp changes
  const formattedLastSaved = useMemo(() => {
    if (!lastSavedAt) return '';
    try {
      const d = new Date(lastSavedAt);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, [lastSavedAt]);

  // Memoized transcription text formatting - only recalculates when transcription or listening state changes
  const displayText = useMemo(() => {
    const { current, final, interim } = transcription;

    if (!current && !final && !interim) {
      if (isListening) {
        return isUserSpeaking ? 'Listening to your speech...' : 'Start speaking to see transcription here...';
      } else {
        return 'Click "Start Speaking" to begin voice input...';
      }
    }

    return current || final || interim || '';
  }, [transcription, isListening, isUserSpeaking]);

  // Memoized derived state - only recalculates when transcription changes
  const hasContent = useMemo(() =>
    transcription.final || transcription.current || transcription.interim,
    [transcription.final, transcription.current, transcription.interim]
  );

  const showConfidence = useMemo(() =>
    hasContent && transcription.confidence > 0,
    [hasContent, transcription.confidence]
  );

  // Memoized event handlers to prevent unnecessary re-renders
  const handleToggleConfidenceDetails = useCallback(() => {
    setShowConfidenceDetails(!showConfidenceDetails);
  }, [showConfidenceDetails]);

  const handleHideConfidenceDetails = useCallback(() => {
    setShowConfidenceDetails(false);
  }, []);

  const handleCopyTranscription = useCallback(() => {
    navigator.clipboard.writeText(transcription.final || transcription.current);
  }, [transcription.final, transcription.current]);

  return (
    <div className={styles.transcriptionDisplay}>
      {/* Header */}
      <div className={styles.transcriptionHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.statusIndicator}>
            <span
              className={`${styles.statusIcon} ${styles[listeningStatus.status]}`}
              title={listeningStatus.description}
            >
              {listeningStatus.icon}
            </span>
            <span className={styles.statusLabel}>{listeningStatus.label}</span>
          </div>

          {showConfidence && (
            <div className={styles.confidenceIndicator}>
              <button
                className={`${styles.confidenceButton} ${styles[confidenceInfo.level]}`}
                onClick={handleToggleConfidenceDetails}
                title={confidenceInfo.description}
              >
                <span className={styles.confidenceIcon}>{confidenceInfo.icon}</span>
                <span className={styles.confidenceLabel}>
                  {Math.round(transcription.confidence * 100)}%
                </span>
              </button>

              {showConfidenceDetails && (
                <div className={styles.confidenceDetails}>
                  <div className={styles.confidenceHeader}>
                    <span className={styles.confidenceIcon}>{confidenceInfo.icon}</span>
                    <span className={styles.confidenceTitle}>{confidenceInfo.label}</span>
                  </div>
                  <div className={styles.confidenceDescription}>
                    {confidenceInfo.description}
                  </div>
                  <div className={styles.confidenceScore}>
                    Confidence Score: {Math.round(transcription.confidence * 100)}%
                  </div>
                  <button
                    onClick={handleHideConfidenceDetails}
                    className={styles.confidenceDismiss}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.headerRight}>
          {/* Save Status Indicator */}
          <div className={styles.saveStatusWrapper}>
            {saveStatus === 'saving' && (
              <div className={`${styles.saveStatus} ${styles.saving}`}>
                <span className={styles.saveDot}></span>
                <span>Saving…</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className={`${styles.saveStatus} ${styles.saved}`}>
                <span className={styles.saveIcon}>✓</span>
                <span>Saved{formattedLastSaved ? ` • ${formattedLastSaved}` : ''}</span>
              </div>
            )}
            {saveStatus === 'error' && (
              <div className={`${styles.saveStatus} ${styles.error}`}>
                <span className={styles.saveIcon}>⚠️</span>
                <span>Save failed</span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Transcription Content */}
      <div className={styles.transcriptionContent}>
        <div className={styles.displayMode}>
          <div
            ref={transcriptionRef}
            className={`${styles.transcriptionText} ${!hasContent ? styles.placeholder : ''}`}
          >
            {transcription.final && (
              <span className={styles.finalText}>{transcription.final}</span>
            )}
            {transcription.interim && (
              <span className={styles.interimText}>{transcription.interim}</span>
            )}
            {!hasContent && (
              <span className={styles.placeholderText}>{displayText}</span>
            )}
          </div>

          {isUserSpeaking && (
            <div className={styles.speakingIndicator}>
              <div className={styles.waveform}>
                <div className={styles.wave}></div>
                <div className={styles.wave}></div>
                <div className={styles.wave}></div>
                <div className={styles.wave}></div>
                <div className={styles.wave}></div>
              </div>
              <span className={styles.speakingText}>Listening...</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {hasContent && (
        <div className={styles.transcriptionFooter}>
          <div className={styles.footerStats}>
            <span className={styles.statItem}>
              <span className={styles.statIcon}>📝</span>
              <span className={styles.statText}>
                {transcription.final ? transcription.final.length : 0} characters
              </span>
            </span>
            <span className={styles.statItem}>
              <span className={styles.statIcon}>🔤</span>
              <span className={styles.statText}>
                {transcription.final ?
                  transcription.final.trim().split(/\s+/).filter(word => word.length > 0).length : 0
                } words
              </span>
            </span>
            {showConfidence && (
              <span className={styles.statItem}>
                <span className={styles.statIcon}>🎯</span>
                <span className={styles.statText}>
                  {Math.round(transcription.confidence * 100)}% confidence
                </span>
              </span>
            )}
          </div>

          <div className={styles.footerActions}>
            <button
              onClick={handleCopyTranscription}
              className={styles.copyButton}
              title="Copy transcription to clipboard"
            >
              <span className={styles.copyIcon}>📋</span>
              <span className={styles.copyLabel}>Copy</span>
            </button>
          </div>
        </div>
      )}

      {/* Help Text */}
      {!hasContent && !isListening && (
        <div className={styles.helpText}>
          <div className={styles.helpIcon}>💡</div>
          <div className={styles.helpContent}>
            <h4>Voice Input Tips:</h4>
            <ul>
              <li>Speak clearly and at a normal pace</li>
              <li>Pause briefly between sentences</li>
              <li>Use the confidence indicator to check accuracy</li>
              <li>Your responses are automatically saved</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
});

TranscriptionDisplay.displayName = 'TranscriptionDisplay';

export default TranscriptionDisplay;