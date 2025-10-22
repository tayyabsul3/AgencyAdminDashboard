/**
 * Mobile Audio Controls Component
 * Touch-friendly audio controls optimized for mobile devices
 */

import React, { useState, useEffect, useRef } from 'react';
import { audioManager } from '../../services/audioManager.js';
import styles from './MobileAudioControls.module.css';

const MobileAudioControls = ({
  volume = 80,
  isMuted = false,
  audioQuality = 'unknown',
  onVolumeChange,
  onMute,
  onSwitchToText,
  onMicrophoneTest,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [microphonePermission, setMicrophonePermission] = useState('unknown');
  const [audioStatus, setAudioStatus] = useState(null);
  const [isTestingMicrophone, setIsTestingMicrophone] = useState(false);
  const volumeTimeoutRef = useRef(null);

  useEffect(() => {
    // Check microphone permission on mount
    checkMicrophonePermission();
    
    // Listen to audio manager events
    audioManager.addListener(handleAudioEvent);
    
    return () => {
      audioManager.removeListener(handleAudioEvent);
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current);
      }
    };
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicrophonePermission('unsupported');
        return;
      }

      // Check permission without requesting access
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
      setMicrophonePermission(permissionStatus.state);
      
      permissionStatus.onchange = () => {
        setMicrophonePermission(permissionStatus.state);
      };
    } catch (error) {
      console.warn('Could not check microphone permission:', error);
      setMicrophonePermission('unknown');
    }
  };

  const handleAudioEvent = (event, data) => {
    switch (event) {
      case 'audio-start':
      case 'audio-end':
      case 'audio-error':
      case 'quality-updated':
        setAudioStatus(data);
        break;
    }
  };

  const handleVolumeChange = (newVolume) => {
    onVolumeChange(newVolume);
    
    // Auto-hide volume slider after 3 seconds of inactivity
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current);
    }
    
    volumeTimeoutRef.current = setTimeout(() => {
      setShowVolumeSlider(false);
    }, 3000);
  };

  const handleMicrophoneTest = async () => {
    setIsTestingMicrophone(true);
    try {
      await onMicrophoneTest();
    } catch (error) {
      console.error('Microphone test failed:', error);
    } finally {
      setIsTestingMicrophone(false);
    }
  };

  const getQualityIcon = () => {
    switch (audioQuality) {
      case 'good':
        return '🟢';
      case 'poor':
        return '🟡';
      case 'failed':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const getQualityText = () => {
    switch (audioQuality) {
      case 'good':
        return 'Excellent';
      case 'poor':
        return 'Poor';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const getMicrophoneIcon = () => {
    switch (microphonePermission) {
      case 'granted':
        return '🎤';
      case 'denied':
        return '🚫';
      case 'prompt':
        return '❓';
      case 'unsupported':
        return '❌';
      default:
        return '🎙️';
    }
  };

  const getMicrophoneText = () => {
    switch (microphonePermission) {
      case 'granted':
        return 'Microphone Ready';
      case 'denied':
        return 'Microphone Blocked';
      case 'prompt':
        return 'Microphone Permission Needed';
      case 'unsupported':
        return 'Microphone Not Supported';
      default:
        return 'Checking Microphone...';
    }
  };

  return (
    <div className={`${styles.mobileAudioControls} ${className}`}>
      {/* Main Control Button */}
      <button
        className={styles.mainControlButton}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label="Audio Controls"
      >
        <span className={styles.controlIcon}>🎛️</span>
        <span className={styles.qualityIndicator}>
          {getQualityIcon()}
        </span>
      </button>

      {/* Expanded Controls */}
      {isExpanded && (
        <div className={styles.expandedControls}>
          {/* Audio Quality Status */}
          <div className={styles.statusSection}>
            <div className={styles.statusItem}>
              <span className={styles.statusIcon}>{getQualityIcon()}</span>
              <div className={styles.statusInfo}>
                <span className={styles.statusLabel}>Audio Quality</span>
                <span className={styles.statusValue}>{getQualityText()}</span>
              </div>
            </div>

            <div className={styles.statusItem}>
              <span className={styles.statusIcon}>{getMicrophoneIcon()}</span>
              <div className={styles.statusInfo}>
                <span className={styles.statusLabel}>Microphone</span>
                <span className={styles.statusValue}>{getMicrophoneText()}</span>
              </div>
            </div>
          </div>

          {/* Volume Control */}
          <div className={styles.controlSection}>
            <div className={styles.controlHeader}>
              <span className={styles.controlLabel}>Volume</span>
              <button
                className={`${styles.muteButton} ${isMuted ? styles.muted : ''}`}
                onClick={() => onMute(!isMuted)}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
            </div>
            
            <div className={styles.volumeControl}>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                className={styles.volumeSlider}
                disabled={isMuted}
              />
              <span className={styles.volumeValue}>{volume}%</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.actionSection}>
            <button
              className={styles.actionButton}
              onClick={handleMicrophoneTest}
              disabled={isTestingMicrophone || microphonePermission === 'denied'}
            >
              <span className={styles.actionIcon}>🧪</span>
              <span className={styles.actionText}>
                {isTestingMicrophone ? 'Testing...' : 'Test Microphone'}
              </span>
            </button>

            <button
              className={`${styles.actionButton} ${styles.switchButton}`}
              onClick={onSwitchToText}
            >
              <span className={styles.actionIcon}>📝</span>
              <span className={styles.actionText}>Switch to Text</span>
            </button>
          </div>

          {/* Quick Actions */}
          <div className={styles.quickActions}>
            <button
              className={styles.quickAction}
              onClick={() => handleVolumeChange(100)}
              disabled={isMuted}
            >
              Max Volume
            </button>
            <button
              className={styles.quickAction}
              onClick={() => handleVolumeChange(50)}
              disabled={isMuted}
            >
              50%
            </button>
            <button
              className={styles.quickAction}
              onClick={() => handleVolumeChange(25)}
              disabled={isMuted}
            >
              25%
            </button>
          </div>

          {/* Close Button */}
          <button
            className={styles.closeButton}
            onClick={() => setIsExpanded(false)}
            aria-label="Close Controls"
          >
            ✕
          </button>
        </div>
      )}

      {/* Overlay */}
      {isExpanded && (
        <div
          className={styles.overlay}
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
};

export default MobileAudioControls;