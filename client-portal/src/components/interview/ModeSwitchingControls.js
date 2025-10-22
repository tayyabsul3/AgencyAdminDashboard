/**
 * Mode Switching Controls Component
 * Provides UI controls for switching between text and voice interview modes
 * Handles data preservation and user confirmation
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  switchToTextMode, 
  switchToVoiceMode, 
  checkVoiceSupport,
  createModeSwitchingSession,
  completeModeSwitchingSession
} from '../../services/modeSwitchingService';
import styles from './ModeSwitchingControls.module.css';

const ModeSwitchingControls = ({ 
  userId, 
  articleId, 
  currentMode, 
  currentState, 
  onSwitchStart,
  onSwitchComplete,
  onSwitchError,
  className = ''
}) => {
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [targetMode, setTargetMode] = useState(null);
  const [switchError, setSwitchError] = useState(null);

  const voiceSupported = checkVoiceSupport();

  const handleSwitchRequest = (mode) => {
    if (mode === currentMode) return;
    
    setTargetMode(mode);
    setShowConfirmModal(true);
    setSwitchError(null);
  };

  const handleConfirmSwitch = async () => {
    if (!targetMode || !userId || !articleId) return;

    setIsSwitching(true);
    setShowConfirmModal(false);
    
    try {
      // Notify parent component that switch is starting
      if (onSwitchStart) {
        onSwitchStart(targetMode);
      }

      // Create switching session for error recovery
      const session = createModeSwitchingSession(
        userId, 
        articleId, 
        currentMode, 
        targetMode, 
        currentState
      );

      let switchResult;

      // Perform the mode switch
      if (targetMode === 'text') {
        switchResult = await switchToTextMode(userId, articleId, currentState);
      } else if (targetMode === 'voice') {
        switchResult = await switchToVoiceMode(userId, articleId, currentState);
      }

      if (switchResult.success) {
        // Complete the session
        completeModeSwitchingSession(session.id);

        // Notify parent component
        if (onSwitchComplete) {
          onSwitchComplete(switchResult);
        }

        // Navigate to the new mode
        router.push(switchResult.resumeUrl);
      } else {
        throw new Error(switchResult.error || 'Mode switch failed');
      }

    } catch (error) {
      console.error('Mode switching error:', error);
      setSwitchError(error.message);
      
      if (onSwitchError) {
        onSwitchError(error);
      }
    } finally {
      setIsSwitching(false);
      setTargetMode(null);
    }
  };

  const handleCancelSwitch = () => {
    setShowConfirmModal(false);
    setTargetMode(null);
    setSwitchError(null);
  };

  const getTargetModeInfo = () => {
    if (targetMode === 'text') {
      return {
        name: 'Text Interview',
        icon: '📝',
        description: 'Type your responses at your own pace',
        benefits: [
          'Easy to edit and refine answers',
          'Perfect for detailed responses',
          'No audio equipment needed'
        ]
      };
    } else if (targetMode === 'voice') {
      return {
        name: 'Voice Interview',
        icon: '🎙️',
        description: 'Have a natural conversation with AI',
        benefits: [
          'Natural, conversational experience',
          'Faster than typing',
          'AI follow-up questions',
          'Zoom-like interface'
        ]
      };
    }
    return null;
  };

  const getCurrentModeInfo = () => {
    if (currentMode === 'text') {
      return {
        name: 'Text Interview',
        icon: '📝'
      };
    } else if (currentMode === 'voice') {
      return {
        name: 'Voice Interview',
        icon: '🎙️'
      };
    }
    return { name: 'Interview', icon: '📋' };
  };

  const currentModeInfo = getCurrentModeInfo();
  const targetModeInfo = getTargetModeInfo();

  return (
    <>
      <div className={`${styles.modeSwitchingControls} ${className}`}>
        {/* Current Mode Indicator */}
        <div className={styles.currentMode}>
          <span className={styles.currentModeIcon}>{currentModeInfo.icon}</span>
          <span className={styles.currentModeText}>{currentModeInfo.name}</span>
        </div>

        {/* Switch Buttons */}
        <div className={styles.switchButtons}>
          {currentMode !== 'text' && (
            <button
              className={styles.switchButton}
              onClick={() => handleSwitchRequest('text')}
              disabled={isSwitching}
              title="Switch to text interview mode"
            >
              <span className={styles.switchIcon}>📝</span>
              <span className={styles.switchText}>Switch to Text</span>
            </button>
          )}

          {currentMode !== 'voice' && voiceSupported && (
            <button
              className={styles.switchButton}
              onClick={() => handleSwitchRequest('voice')}
              disabled={isSwitching}
              title="Switch to voice interview mode"
            >
              <span className={styles.switchIcon}>🎙️</span>
              <span className={styles.switchText}>Switch to Voice</span>
            </button>
          )}

          {currentMode !== 'voice' && !voiceSupported && (
            <button
              className={`${styles.switchButton} ${styles.disabled}`}
              disabled={true}
              title="Voice mode not supported in this browser"
            >
              <span className={styles.switchIcon}>🎙️</span>
              <span className={styles.switchText}>Voice Not Supported</span>
            </button>
          )}
        </div>

        {/* Switching Status */}
        {isSwitching && (
          <div className={styles.switchingStatus}>
            <div className={styles.switchingSpinner}></div>
            <span>Switching modes...</span>
          </div>
        )}

        {/* Error Display */}
        {switchError && (
          <div className={styles.switchError}>
            <span className={styles.errorIcon}>⚠️</span>
            <span className={styles.errorText}>{switchError}</span>
            <button 
              className={styles.errorDismiss}
              onClick={() => setSwitchError(null)}
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && targetModeInfo && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>
                <span className={styles.modalIcon}>{targetModeInfo.icon}</span>
                Switch to {targetModeInfo.name}?
              </h3>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalDescription}>
                {targetModeInfo.description}
              </p>

              <div className={styles.modalBenefits}>
                <h4>Benefits:</h4>
                <ul>
                  {targetModeInfo.benefits.map((benefit, index) => (
                    <li key={index}>{benefit}</li>
                  ))}
                </ul>
              </div>

              <div className={styles.modalWarning}>
                <div className={styles.warningIcon}>💾</div>
                <div className={styles.warningContent}>
                  <strong>Your progress will be preserved</strong>
                  <p>All answered questions and current progress will be saved before switching modes.</p>
                </div>
              </div>

              {currentState && currentState.pendingData && 
               Object.keys(currentState.pendingData).length > 0 && (
                <div className={styles.modalAlert}>
                  <div className={styles.alertIcon}>⚠️</div>
                  <div className={styles.alertContent}>
                    <strong>Unsaved changes detected</strong>
                    <p>Your current answer will be saved before switching modes.</p>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.cancelButton}
                onClick={handleCancelSwitch}
                disabled={isSwitching}
              >
                Cancel
              </button>
              <button
                className={styles.confirmButton}
                onClick={handleConfirmSwitch}
                disabled={isSwitching}
              >
                {isSwitching ? (
                  <>
                    <div className={styles.buttonSpinner}></div>
                    Switching...
                  </>
                ) : (
                  <>
                    Switch to {targetModeInfo.name}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ModeSwitchingControls;