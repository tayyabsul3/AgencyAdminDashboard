'use client';

import { useState, useEffect } from 'react';
import styles from './AudioControls.module.css';

const AudioControls = ({ 
  volume = 80, 
  isMuted = false, 
  audioQuality = 'unknown',
  onVolumeChange,
  onMute,
  onSwitchToText,
  onMicrophoneTest
}) => {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isTestingMicrophone, setIsTestingMicrophone] = useState(false);
  const [microphoneTestResult, setMicrophoneTestResult] = useState(null);
  const [showQualityDetails, setShowQualityDetails] = useState(false);

  // Handle volume change
  const handleVolumeChange = (event) => {
    const newVolume = parseInt(event.target.value);
    onVolumeChange(newVolume);
  };

  // Handle mute toggle
  const handleMuteToggle = () => {
    onMute(!isMuted);
  };

  // Handle microphone test
  const handleMicrophoneTest = async () => {
    if (isTestingMicrophone) return;
    
    setIsTestingMicrophone(true);
    setMicrophoneTestResult(null);
    
    try {
      if (onMicrophoneTest) {
        await onMicrophoneTest();
        setMicrophoneTestResult({
          success: true,
          message: 'Microphone test successful!'
        });
      }
    } catch (error) {
      console.error('Microphone test failed:', error);
      setMicrophoneTestResult({
        success: false,
        message: 'Microphone test failed. Please check your microphone settings.'
      });
    } finally {
      setIsTestingMicrophone(false);
      
      // Clear test result after 3 seconds
      setTimeout(() => {
        setMicrophoneTestResult(null);
      }, 3000);
    }
  };

  // Get audio quality status info
  const getQualityInfo = () => {
    switch (audioQuality) {
      case 'good':
        return {
          icon: '🟢',
          label: 'Excellent',
          description: 'Audio quality is excellent',
          color: '#4ecdc4'
        };
      case 'poor':
        return {
          icon: '🟡',
          label: 'Fair',
          description: 'Audio quality is fair - some delays may occur',
          color: '#f39c12'
        };
      case 'failed':
        return {
          icon: '🔴',
          label: 'Poor',
          description: 'Audio quality is poor - consider switching to text mode',
          color: '#e74c3c'
        };
      default:
        return {
          icon: '⚪',
          label: 'Unknown',
          description: 'Audio quality is being assessed',
          color: '#95a5a6'
        };
    }
  };

  const qualityInfo = getQualityInfo();

  // Get volume icon based on level and mute state
  const getVolumeIcon = () => {
    if (isMuted) return '🔇';
    if (volume === 0) return '🔇';
    if (volume < 30) return '🔈';
    if (volume < 70) return '🔉';
    return '🔊';
  };

  // Get microphone icon based on test state
  const getMicrophoneIcon = () => {
    if (isTestingMicrophone) return '🎙️';
    if (microphoneTestResult?.success) return '✅';
    if (microphoneTestResult?.success === false) return '❌';
    return '🎤';
  };

  return (
    <div className={styles.audioControls}>
      {/* Volume Control */}
      <div className={styles.volumeControl}>
        <button
          className={`${styles.volumeButton} ${isMuted ? styles.muted : ''}`}
          onClick={handleMuteToggle}
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          <span className={styles.volumeIcon}>{getVolumeIcon()}</span>
          <span className={styles.volumeLabel}>
            {isMuted ? 'Muted' : `${volume}%`}
          </span>
        </button>
        
        {showVolumeSlider && (
          <div 
            className={styles.volumeSliderContainer}
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <div className={styles.volumeSlider}>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
                className={styles.volumeRange}
                disabled={isMuted}
              />
              <div className={styles.volumeMarkers}>
                <span className={styles.volumeMarker}>0</span>
                <span className={styles.volumeMarker}>50</span>
                <span className={styles.volumeMarker}>100</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Audio Quality Indicator */}
      <div className={styles.audioQuality}>
        <button
          className={`${styles.qualityButton} ${styles[audioQuality]}`}
          onClick={() => setShowQualityDetails(!showQualityDetails)}
          title="Audio Quality Status"
        >
          <span className={styles.qualityIcon}>{qualityInfo.icon}</span>
          <span className={styles.qualityLabel}>{qualityInfo.label}</span>
        </button>
        
        {showQualityDetails && (
          <div className={styles.qualityDetails}>
            <div className={styles.qualityHeader}>
              <span className={styles.qualityIcon}>{qualityInfo.icon}</span>
              <span className={styles.qualityTitle}>Audio Quality</span>
            </div>
            <div className={styles.qualityDescription}>
              {qualityInfo.description}
            </div>
            <div className={styles.qualityActions}>
              <button
                onClick={() => setShowQualityDetails(false)}
                className={styles.qualityDismiss}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Microphone Test */}
      <div className={styles.microphoneTest}>
        <button
          className={`${styles.micButton} ${isTestingMicrophone ? styles.testing : ''}`}
          onClick={handleMicrophoneTest}
          disabled={isTestingMicrophone}
          title="Test Microphone"
        >
          <span className={styles.micIcon}>{getMicrophoneIcon()}</span>
          <span className={styles.micLabel}>
            {isTestingMicrophone ? 'Testing...' : 'Test Mic'}
          </span>
        </button>
        
        {microphoneTestResult && (
          <div className={`${styles.testResult} ${microphoneTestResult.success ? styles.success : styles.error}`}>
            <span className={styles.testResultIcon}>
              {microphoneTestResult.success ? '✅' : '❌'}
            </span>
            <span className={styles.testResultText}>
              {microphoneTestResult.message}
            </span>
          </div>
        )}
      </div>

      {/* Switch to Text Mode */}
      <div className={styles.switchMode}>
        <button
          className={styles.switchButton}
          onClick={onSwitchToText}
          title="Switch to Text Interview"
        >
          <span className={styles.switchIcon}>📝</span>
          <span className={styles.switchLabel}>Switch to Text</span>
        </button>
      </div>

      {/* Additional Controls */}
      <div className={styles.additionalControls}>
        {/* Audio Settings Dropdown */}
        <div className={styles.settingsDropdown}>
          <button className={styles.settingsButton} title="Audio Settings">
            <span className={styles.settingsIcon}>⚙️</span>
          </button>
          
          <div className={styles.settingsMenu}>
            <div className={styles.settingsHeader}>Audio Settings</div>
            
            <div className={styles.settingItem}>
              <label className={styles.settingLabel}>
                <input
                  type="checkbox"
                  checked={!isMuted}
                  onChange={handleMuteToggle}
                  className={styles.settingCheckbox}
                />
                Enable Audio Output
              </label>
            </div>
            
            <div className={styles.settingItem}>
              <label className={styles.settingLabel}>Volume</label>
              <div className={styles.settingVolumeControl}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleVolumeChange}
                  className={styles.settingVolumeSlider}
                  disabled={isMuted}
                />
                <span className={styles.settingVolumeValue}>{volume}%</span>
              </div>
            </div>
            
            <div className={styles.settingItem}>
              <button 
                onClick={handleMicrophoneTest}
                className={styles.settingAction}
                disabled={isTestingMicrophone}
              >
                {isTestingMicrophone ? 'Testing Microphone...' : 'Test Microphone'}
              </button>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioControls;