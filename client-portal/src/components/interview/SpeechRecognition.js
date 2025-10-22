'use client';

import { useState, useEffect } from 'react';
import useSpeechRecognition from '../../hooks/useSpeechRecognition';
import styles from './SpeechRecognition.module.css';

const SpeechRecognition = ({
  onTranscription,
  onError,
  onStart,
  onEnd,
  onSpeechStart,
  onSpeechEnd,
  autoStart = false,
  showControls = true,
  showTranscript = true,
  showStatus = true,
  className = ''
}) => {
  const [hasStarted, setHasStarted] = useState(false);

  const {
    isSupported,
    isInitialized,
    isListening,
    isSpeaking,
    transcript,
    finalTranscript,
    interimTranscript,
    confidence,
    error,
    startListening,
    stopListening,
    restartListening,
    clearTranscript,
    clearError,
    getCompatibilityInfo
  } = useSpeechRecognition({
    onTranscription,
    onError,
    onStart,
    onEnd,
    onSpeechStart,
    onSpeechEnd
  });

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && isInitialized && !hasStarted) {
      setHasStarted(true);
      startListening();
    }
  }, [autoStart, isInitialized, hasStarted, startListening]);

  const handleStartListening = async () => {
    const success = await startListening();
    if (success) {
      setHasStarted(true);
    }
  };

  const handleStopListening = () => {
    stopListening();
  };

  const handleRestartListening = () => {
    restartListening();
  };

  const handleClearTranscript = () => {
    clearTranscript();
  };

  const handleClearError = () => {
    clearError();
  };

  const getStatusColor = () => {
    if (error) return 'error';
    if (isSpeaking) return 'speaking';
    if (isListening) return 'listening';
    return 'idle';
  };

  const getStatusText = () => {
    if (error) return 'Error';
    if (isSpeaking) return 'Speaking...';
    if (isListening) return 'Listening...';
    if (isInitialized) return 'Ready';
    return 'Initializing...';
  };

  const getConfidenceLevel = () => {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    if (confidence >= 0.4) return 'low';
    return 'very-low';
  };

  if (!isSupported) {
    const compatInfo = getCompatibilityInfo();
    
    return (
      <div className={`${styles.speechRecognition} ${styles.unsupported} ${className}`}>
        <div className={styles.unsupportedContent}>
          <div className={styles.unsupportedIcon}>🎙️</div>
          <h3>Speech Recognition Not Supported</h3>
          <p>Your browser doesn&apos;t support speech recognition features.</p>
          
          <div className={styles.compatibilityInfo}>
            <h4>Compatibility Check:</h4>
            <ul>
              <li className={compatInfo.webSpeechAPI ? styles.supported : styles.notSupported}>
                Web Speech API: {compatInfo.webSpeechAPI ? '✅' : '❌'}
              </li>
              <li className={compatInfo.audioContext ? styles.supported : styles.notSupported}>
                Audio Context: {compatInfo.audioContext ? '✅' : '❌'}
              </li>
              <li className={compatInfo.mediaDevices ? styles.supported : styles.notSupported}>
                Media Devices: {compatInfo.mediaDevices ? '✅' : '❌'}
              </li>
            </ul>
            <p className={styles.browserInfo}>
              Browser: {compatInfo.browser.name}
            </p>
          </div>

          <div className={styles.recommendations}>
            <h4>Recommended Browsers:</h4>
            <ul>
              <li>Google Chrome (recommended)</li>
              <li>Microsoft Edge</li>
              <li>Safari (iOS/macOS)</li>
              <li>Firefox (limited support)</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.speechRecognition} ${className}`}>
      {/* Status Indicator */}
      {showStatus && (
        <div className={`${styles.statusIndicator} ${styles[getStatusColor()]}`}>
          <div className={styles.statusIcon}>
            {error && '⚠️'}
            {isSpeaking && '🗣️'}
            {isListening && !isSpeaking && '👂'}
            {!isListening && !error && '🎙️'}
          </div>
          <div className={styles.statusText}>
            {getStatusText()}
          </div>
          {confidence > 0 && (
            <div className={`${styles.confidenceIndicator} ${styles[getConfidenceLevel()]}`}>
              Confidence: {Math.round(confidence * 100)}%
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className={styles.errorDisplay}>
          <div className={styles.errorHeader}>
            <span className={styles.errorIcon}>⚠️</span>
            <span className={styles.errorTitle}>Speech Recognition Error</span>
            <button 
              className={styles.clearErrorButton}
              onClick={handleClearError}
              title="Clear error"
            >
              ✕
            </button>
          </div>
          <div className={styles.errorMessage}>
            {error.message}
          </div>
          {error.canRetry && (
            <button 
              className={styles.retryButton}
              onClick={handleRestartListening}
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <div className={styles.controls}>
          {!isListening ? (
            <button
              className={`${styles.controlButton} ${styles.startButton}`}
              onClick={handleStartListening}
              disabled={!isInitialized || !!error}
            >
              <span className={styles.buttonIcon}>🎙️</span>
              Start Listening
            </button>
          ) : (
            <button
              className={`${styles.controlButton} ${styles.stopButton}`}
              onClick={handleStopListening}
            >
              <span className={styles.buttonIcon}>⏹️</span>
              Stop Listening
            </button>
          )}

          <button
            className={`${styles.controlButton} ${styles.restartButton}`}
            onClick={handleRestartListening}
            disabled={!isInitialized}
          >
            <span className={styles.buttonIcon}>🔄</span>
            Restart
          </button>

          <button
            className={`${styles.controlButton} ${styles.clearButton}`}
            onClick={handleClearTranscript}
            disabled={!transcript}
          >
            <span className={styles.buttonIcon}>🗑️</span>
            Clear
          </button>
        </div>
      )}

      {/* Transcript Display */}
      {showTranscript && (
        <div className={styles.transcriptDisplay}>
          <div className={styles.transcriptHeader}>
            <h4>Transcript</h4>
            {transcript && (
              <span className={styles.transcriptLength}>
                {transcript.length} characters
              </span>
            )}
          </div>

          <div className={styles.transcriptContent}>
            {finalTranscript && (
              <span className={styles.finalTranscript}>
                {finalTranscript}
              </span>
            )}
            {interimTranscript && (
              <span className={styles.interimTranscript}>
                {interimTranscript}
              </span>
            )}
            {!transcript && (
              <span className={styles.transcriptPlaceholder}>
                {isListening 
                  ? 'Listening for speech...' 
                  : 'Click "Start Listening" to begin speech recognition'
                }
              </span>
            )}
          </div>

          {/* Live Waveform Indicator */}
          {isListening && (
            <div className={styles.waveformContainer}>
              <div className={`${styles.waveform} ${isSpeaking ? styles.active : ''}`}>
                <div className={styles.waveBar}></div>
                <div className={styles.waveBar}></div>
                <div className={styles.waveBar}></div>
                <div className={styles.waveBar}></div>
                <div className={styles.waveBar}></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Debug Info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className={styles.debugInfo}>
          <details>
            <summary>Debug Information</summary>
            <div className={styles.debugContent}>
              <p><strong>Supported:</strong> {isSupported ? 'Yes' : 'No'}</p>
              <p><strong>Initialized:</strong> {isInitialized ? 'Yes' : 'No'}</p>
              <p><strong>Listening:</strong> {isListening ? 'Yes' : 'No'}</p>
              <p><strong>Speaking:</strong> {isSpeaking ? 'Yes' : 'No'}</p>
              <p><strong>Final Length:</strong> {finalTranscript.length}</p>
              <p><strong>Interim Length:</strong> {interimTranscript.length}</p>
              <p><strong>Confidence:</strong> {confidence}</p>
              {error && (
                <p><strong>Error:</strong> {error.error} - {error.message}</p>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default SpeechRecognition;