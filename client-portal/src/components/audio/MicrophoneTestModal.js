/**
 * Microphone Test Modal Component
 * Responsive modal for testing microphone functionality across devices
 */

import React, { useState, useEffect, useRef } from 'react';
import { speechService } from '../../services/speechService.js';
import { audioManager } from '../../services/audioManager.js';
import styles from './MicrophoneTestModal.module.css';

const MicrophoneTestModal = ({ 
  isOpen, 
  onClose, 
  onTestComplete 
}) => {
  const [testStage, setTestStage] = useState('permission'); // permission, recording, playback, complete
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [testResults, setTestResults] = useState({
    permission: false,
    recording: false,
    playback: false,
    quality: 'unknown'
  });
  const [error, setError] = useState(null);
  
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const recordingTimeoutRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      startTest();
    } else {
      cleanup();
    }

    return cleanup;
  }, [isOpen]);

  const cleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsRecording(false);
    setAudioLevel(0);
  };

  const startTest = async () => {
    setTestStage('permission');
    setError(null);
    
    try {
      // Test 1: Check microphone permission
      await testMicrophonePermission();
      
      // Test 2: Test recording
      await testRecording();
      
      // Test 3: Test playback (if we have recorded audio)
      if (recordedAudio) {
        await testPlayback();
      }
      
      setTestStage('complete');
      
    } catch (error) {
      console.error('Microphone test failed:', error);
      setError(error.message);
      setTestResults(prev => ({
        ...prev,
        quality: 'failed'
      }));
    }
  };

  const testMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      mediaStreamRef.current = stream;
      setPermissionStatus('granted');
      setTestResults(prev => ({ ...prev, permission: true }));
      
      // Set up audio analysis
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      startAudioLevelMonitoring();
      
    } catch (error) {
      setPermissionStatus('denied');
      setTestResults(prev => ({ ...prev, permission: false }));
      throw new Error('Microphone permission denied or not available');
    }
  };

  const startAudioLevelMonitoring = () => {
    if (!analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const updateAudioLevel = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average amplitude
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      const normalizedLevel = (average / 255) * 100;
      
      setAudioLevel(normalizedLevel);
      
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };
    
    updateAudioLevel();
  };

  const testRecording = async () => {
    setTestStage('recording');
    setIsRecording(true);
    
    try {
      // Start speech recognition test
      const speechInitialized = await speechService.initialize();
      if (!speechInitialized) {
        throw new Error('Speech recognition not supported');
      }
      
      let transcriptionReceived = false;
      
      const testPromise = new Promise((resolve, reject) => {
        speechService.startListening({
          onTranscription: (data) => {
            if (data.final && data.final.trim().length > 0) {
              transcriptionReceived = true;
              setRecordedAudio(data.final);
              resolve();
            }
          },
          onError: (error) => {
            reject(new Error(`Speech recognition error: ${error.message}`));
          }
        });
        
        // Auto-complete after 10 seconds
        recordingTimeoutRef.current = setTimeout(() => {
          speechService.stopListening();
          if (transcriptionReceived) {
            resolve();
          } else {
            reject(new Error('No speech detected during test'));
          }
        }, 10000);
      });
      
      await testPromise;
      
      speechService.stopListening();
      setIsRecording(false);
      setTestResults(prev => ({ ...prev, recording: true }));
      
    } catch (error) {
      setIsRecording(false);
      setTestResults(prev => ({ ...prev, recording: false }));
      throw error;
    }
  };

  const testPlayback = async () => {
    setTestStage('playback');
    
    try {
      const testText = recordedAudio || 'Audio playback test successful';
      
      await audioManager.speakText(testText, {
        priority: true,
        onStart: () => {
          console.log('Playback test started');
        },
        onEnd: () => {
          setTestResults(prev => ({ 
            ...prev, 
            playback: true,
            quality: 'good'
          }));
        },
        onError: (error) => {
          setTestResults(prev => ({ 
            ...prev, 
            playback: false,
            quality: 'failed'
          }));
          throw new Error(`Audio playback failed: ${error.message}`);
        }
      });
      
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        playback: false,
        quality: 'failed'
      }));
      throw error;
    }
  };

  const handleRetry = () => {
    cleanup();
    setTestResults({
      permission: false,
      recording: false,
      playback: false,
      quality: 'unknown'
    });
    setError(null);
    startTest();
  };

  const handleComplete = () => {
    const overallSuccess = testResults.permission && testResults.recording;
    onTestComplete({
      success: overallSuccess,
      results: testResults,
      error: error
    });
    onClose();
  };

  const getStageIcon = (stage) => {
    switch (stage) {
      case 'permission':
        return '🔐';
      case 'recording':
        return '🎤';
      case 'playback':
        return '🔊';
      case 'complete':
        return '✅';
      default:
        return '⚪';
    }
  };

  const getStageTitle = (stage) => {
    switch (stage) {
      case 'permission':
        return 'Requesting Microphone Access';
      case 'recording':
        return 'Testing Recording';
      case 'playback':
        return 'Testing Playback';
      case 'complete':
        return 'Test Complete';
      default:
        return 'Preparing Test';
    }
  };

  const getAudioLevelColor = () => {
    if (audioLevel < 10) return '#666';
    if (audioLevel < 30) return '#ff9800';
    if (audioLevel < 70) return '#4caf50';
    return '#f44336';
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Microphone Test</h2>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {/* Current Stage */}
          <div className={styles.currentStage}>
            <div className={styles.stageIcon}>
              {getStageIcon(testStage)}
            </div>
            <h3>{getStageTitle(testStage)}</h3>
          </div>

          {/* Audio Level Indicator */}
          {(testStage === 'recording' || testStage === 'permission') && (
            <div className={styles.audioLevelContainer}>
              <div className={styles.audioLevelLabel}>
                Microphone Level: {Math.round(audioLevel)}%
              </div>
              <div className={styles.audioLevelBar}>
                <div 
                  className={styles.audioLevelFill}
                  style={{ 
                    width: `${audioLevel}%`,
                    backgroundColor: getAudioLevelColor()
                  }}
                />
              </div>
              <div className={styles.audioLevelHint}>
                {audioLevel < 10 && 'Speak louder or move closer to microphone'}
                {audioLevel >= 10 && audioLevel < 30 && 'Good - keep speaking'}
                {audioLevel >= 30 && audioLevel < 70 && 'Perfect level'}
                {audioLevel >= 70 && 'Too loud - speak softer or move away'}
              </div>
            </div>
          )}

          {/* Recording Instructions */}
          {testStage === 'recording' && (
            <div className={styles.instructions}>
              <p>Please say something like:</p>
              <div className={styles.samplePhrases}>
                <div className={styles.phrase}>&quot;Hello, this is a microphone test&quot;</div>
                <div className={styles.phrase}>&quot;Testing one two three&quot;</div>
                <div className={styles.phrase}>&quot;My name is [your name]&quot;</div>
              </div>
              <div className={styles.recordingIndicator}>
                <div className={styles.recordingDot} />
                Recording... ({isRecording ? '10' : '0'}s remaining)
              </div>
            </div>
          )}

          {/* Playback Stage */}
          {testStage === 'playback' && recordedAudio && (
            <div className={styles.playbackInfo}>
              <p>We recorded:</p>
              <div className={styles.recordedText}>&quot;{recordedAudio}&quot;</div>
              <p>Now testing audio playback...</p>
            </div>
          )}

          {/* Test Results */}
          {testStage === 'complete' && (
            <div className={styles.results}>
              <div className={styles.resultItem}>
                <span className={styles.resultIcon}>
                  {testResults.permission ? '✅' : '❌'}
                </span>
                <span className={styles.resultLabel}>Microphone Permission</span>
                <span className={styles.resultStatus}>
                  {testResults.permission ? 'Granted' : 'Denied'}
                </span>
              </div>

              <div className={styles.resultItem}>
                <span className={styles.resultIcon}>
                  {testResults.recording ? '✅' : '❌'}
                </span>
                <span className={styles.resultLabel}>Speech Recognition</span>
                <span className={styles.resultStatus}>
                  {testResults.recording ? 'Working' : 'Failed'}
                </span>
              </div>

              <div className={styles.resultItem}>
                <span className={styles.resultIcon}>
                  {testResults.playback ? '✅' : '❌'}
                </span>
                <span className={styles.resultLabel}>Audio Playback</span>
                <span className={styles.resultStatus}>
                  {testResults.playback ? 'Working' : 'Failed'}
                </span>
              </div>

              <div className={styles.overallResult}>
                <div className={styles.overallIcon}>
                  {testResults.permission && testResults.recording ? '🎉' : '⚠️'}
                </div>
                <div className={styles.overallText}>
                  {testResults.permission && testResults.recording 
                    ? 'Voice interview is ready!' 
                    : 'Some issues detected. You may want to use text mode.'}
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className={styles.error}>
              <div className={styles.errorIcon}>⚠️</div>
              <div className={styles.errorText}>{error}</div>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          {testStage === 'complete' ? (
            <>
              <button 
                className={styles.retryButton}
                onClick={handleRetry}
              >
                Test Again
              </button>
              <button 
                className={styles.completeButton}
                onClick={handleComplete}
              >
                Continue
              </button>
            </>
          ) : error ? (
            <>
              <button 
                className={styles.retryButton}
                onClick={handleRetry}
              >
                Retry Test
              </button>
              <button 
                className={styles.cancelButton}
                onClick={onClose}
              >
                Cancel
              </button>
            </>
          ) : (
            <button 
              className={styles.cancelButton}
              onClick={onClose}
            >
              Cancel Test
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MicrophoneTestModal;