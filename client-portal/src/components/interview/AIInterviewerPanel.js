'use client';

import React from 'react';
import {
  MdAutoAwesome,
  MdMic,
  MdHearing,
  MdPsychology,
  MdLightbulb,
  MdPerson,
  MdEdit,
  MdSave,
  MdDelete,
  MdSkipNext,
  MdVolumeUp,
  MdVolumeOff,
  MdArrowBack,
  MdArrowForward,
  MdAdd
} from 'react-icons/md';
import { useNotifications } from '../ui/NotificationSystem';
import styles from './AIInterviewerPanel.module.css';

const AIInterviewerPanel = ({
  clientName = "AI Expert",
  clientAvatar = "/images/default-avatar.png",
  currentQuestion = null,
  questionIndex = 0,
  totalQuestions = 0,
  isAISpeaking = false,
  speakingStatus = 'idle', // 'idle', 'speaking', 'listening', 'processing'
  onSkipQuestion,
  onRegenerateIntroQuestion,
  // Navigation props
  onPrevious,
  onNext,
  onShowQuestions,
  canGoBack = false,
  canGoForward = false,
  answeredCount = 0,
  onEditQuestion,
  onDeleteQuestion,
  onAddTopicQuestion,
  regeneratingQuestionIndex,
  isEditingQuestion = false,
  editingQuestionIndex = null,
  className = '',
  isLocked = false,
  canStartFAQs = false,
  onProceedToTopics,

  // New props for intro/FAQ presentation
  displayCounter = true,
  badgeLabel,
  badgeVariant,
  topicIndex = null,
  topicTotal = 0,
  // Recording state for action blocking
  isRecording = false,
  onToggleRecording,
  isAnswerAiEnhanced = false,

  // TTS Mute functionality
  isTTSMuted = false,
  onTTSMuteToggle,

  ...props
}) => {
  const notifications = useNotifications();

  const getStatusText = () => {
    // Show generating status when regenerating current question
    if (regeneratingQuestionIndex === questionIndex) {
      return 'Generating new question...';
    }

    switch (speakingStatus) {
      case 'speaking':
        return 'Speaking...';
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing your answer';
      default:
        return '';
    }
  };

  const getStatusIcon = () => {
    // Show generating icon when regenerating current question
    if (regeneratingQuestionIndex === questionIndex) {
      return <MdAutoAwesome />;
    }

    switch (speakingStatus) {
      case 'speaking':
        return <MdMic />;
      case 'listening':
        return <MdHearing />;
      case 'processing':
        return <MdPsychology />;
      default:
        return null;
    }
  };

  return (
    <div className={`${styles.interviewerPanel} ${className}`} {...props}>
      {/* AI Avatar Section */}
      <div className={styles.avatarSection}>
        <div className={`${styles.avatarContainer} ${isAISpeaking ? styles.speaking : ''} ${regeneratingQuestionIndex === questionIndex ? styles.generating : ''} ${isTTSMuted ? styles.muted : ''}`}>
          <img
            src={clientAvatar}
            alt={`${clientName} - AI Interviewer`}
            className={styles.avatarImage}
          />

          {/* Speaking Indicator */}
          <div className={`${styles.speakingIndicator} ${isAISpeaking ? styles.active : ''}`}>
            <div className={styles.waveform}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={styles.waveBar}
                  style={{ animationDelay: `${i * 0.1}s` }}
                ></div>
              ))}
            </div>
          </div>

          {/* Status Ring */}
          <div className={`${styles.statusRing} ${styles[speakingStatus]}`}></div>
        </div>

        {/* Interviewer Info */}
        <div className={styles.interviewerInfo}>
          <h3 className={styles.interviewerName}>{clientName}</h3>
          <p className={styles.interviewerRole}>AI Interview Expert</p>
          
          {/* TTS Mute Button */}
          {onTTSMuteToggle && (
            <button
              className={`${styles.muteButton} ${isTTSMuted ? styles.muted : ''}`}
              onClick={onTTSMuteToggle}
              aria-label={isTTSMuted ? "Unmute AI voice" : "Mute AI voice"}
              title={isTTSMuted ? "Unmute AI voice" : "Mute AI voice"}
              type="button"
            >
              {isTTSMuted ? <MdVolumeOff /> : <MdVolumeUp />}
              <span className={styles.muteText}>
                {isTTSMuted ? 'AI Unmute' : 'AI Mute'}
              </span>
            </button>
          )}

          {/* Status Display */}
          {(getStatusText() || getStatusIcon()) && (
            <div className={`${styles.statusDisplay} ${isTTSMuted ? styles.muted : ''}`}>
              {getStatusIcon() && (
                <span className={styles.statusIcon}>
                  {getStatusIcon()}
                </span>
              )}
              {getStatusText() && (
                <span className={styles.statusText}>
                  {getStatusText()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Question Section */}
      <div className={styles.questionSection}>
        <div className={styles.questionHeader}>
          <div className={styles.questionMeta}>
            {displayCounter && (
              <>
                {typeof topicIndex === 'number' && topicTotal > 0 ? (
                  <>
                    <span className={styles.questionNumber}>
                      FAQ {topicIndex + 1}
                    </span>
                    <span className={styles.questionProgress}>
                      of {topicTotal}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={styles.questionNumber}>
                      Question {questionIndex + 1}
                    </span>
                    <span className={styles.questionProgress}>
                      of {totalQuestions}
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          {/* Question Type Indicator - Clickable */}
          {(badgeVariant || currentQuestion?.type) && (
            <button
              className={`${styles.questionTypeBadge} ${styles[badgeVariant || currentQuestion?.type]} ${styles.clickableBadge}`}
              onClick={() => {
                if (isRecording) {
                  notifications.showWarning("Stop recording first");
                  return;
                }
                onShowQuestions && onShowQuestions();
              }}
              disabled={isLocked}
              aria-label="Show All Questions"
              title={`Show all questions (${answeredCount || 0}/${totalQuestions || 0})`}
            >
              {((badgeVariant || currentQuestion?.type) === 'intro') ? (
                <>
                  <span className={styles.typeIcon}><MdPerson style={{color: '#8b5cf6', filter: 'drop-shadow(0 1px 2px rgba(139, 92, 246, 0.3))'}} /></span>
                  <span className={styles.typeText}>{badgeLabel || 'Expert Introduction'}</span>
                </>
              ) : (
                <>
                  <span className={styles.typeIcon}><MdLightbulb style={{color: '#10b981', filter: 'drop-shadow(0 1px 2px rgba(16, 185, 129, 0.3))'}} /></span>
                  <span className={styles.typeText}>{badgeLabel || 'FAQ'}</span>
                </>
              )}
            </button>
          )}

          {currentQuestion?.sectionTitle && (
            <div className={styles.sectionBadge}>
              {currentQuestion.sectionTitle}
            </div>
          )}
        </div>

        <div className={styles.questionContent}>
          {regeneratingQuestionIndex === questionIndex ? (
            // Show prominent loading state when regenerating
            <div className={styles.questionGenerating}>
              <div className={styles.generatingAnimation}>
                <div className={styles.loadingDots}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <h4 className={styles.generatingTitle}>Generating New Question</h4>
              <p className={styles.generatingSubtext}>
                Creating a fresh intro question for you...
              </p>
            </div>
          ) : (
            // Show normal question with inline actions
            <div className={styles.questionWithActions}>
              <p className={styles.questionText}>
                {currentQuestion?.question || 'Loading question...'}
              </p>

              {/* Inline Action Icons - show for topic questions only */}
              {currentQuestion?.type !== 'intro' && (
                <div className={styles.inlineActions}>
                  {/* Edit icon */}
                  {onEditQuestion && (
                    <button
                      className={`${styles.inlineActionButton} ${styles.editIcon}`}
                      onClick={() => onEditQuestion(questionIndex, currentQuestion)}
                      disabled={!currentQuestion || speakingStatus === 'speaking' || regeneratingQuestionIndex === questionIndex || isEditingQuestion || isLocked}
                      aria-label="Edit Question"
                      title="Edit this question"
                    >
                      {isEditingQuestion && editingQuestionIndex === questionIndex ? <MdSave /> : <MdEdit />}
                    </button>
                  )}

                  {/* Delete icon - only show for topic questions when count > 5 */}
                  {currentQuestion?.type === 'topic' && onDeleteQuestion && topicTotal > 5 ? (
                    <button
                      className={`${styles.inlineActionButton} ${styles.deleteIcon}`}
                      onClick={() => onDeleteQuestion(questionIndex, currentQuestion)}
                      disabled={!currentQuestion || speakingStatus === 'speaking' || regeneratingQuestionIndex === questionIndex || isEditingQuestion || isLocked}
                      aria-label="Delete Question"
                      title="Delete this topic question"
                    >
                      <MdDelete />
                    </button>
                  ) : (
                    /* Show clickable delete icon with notification when topic questions <= 5 */
                    currentQuestion?.type === 'topic' && (
                      <button
                        className={`${styles.inlineActionButton} ${styles.deleteIcon} ${styles.deleteIconDisabled}`}
                        onClick={() => {
                          notifications.showWarning(
                            "You need at least 5 topic questions. Add more questions first, then you can delete this one.", 
                            { title: "Cannot Delete Question" }
                          );
                        }}
                        aria-label="Delete Question (Disabled)"
                        title="Cannot delete - minimum 5 questions required"
                      >
                        <MdDelete />
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recording Button - Show below question */}
        {(
          <div className={styles.recordingSection}>
            <button
              className={`${styles.recordingButton} ${isRecording ? styles.recording : ''}`}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  // Check microphone permission first
                  if (!isRecording && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                      stream.getTracks().forEach(track => track.stop()); // Clean up test stream
                    } catch (permissionError) {
                      notifications.showWarning("Microphone access denied. Please allow microphone access and try again.");
                      return;
                    }
                  }
                  
                  if (onToggleRecording) {
                    await onToggleRecording();
                  }
                } catch (error) {
                  console.error('Recording toggle error:', error);
                  notifications.showWarning("Recording failed. Please check your microphone permissions.");
                }
              }}
              disabled={typeof regeneratingQuestionIndex === 'number' && regeneratingQuestionIndex !== null}
              aria-label={isRecording ? "Stop voice recording" : "Start voice recording"}
              title={isRecording ? "Stop voice recording" : "Start voice recording"}
            >
              <MdMic />
              <span className={styles.recordingText}>
                {isRecording ? 'Stop Recording' : 'Start voice recording'}
              </span>
            </button>
          </div>
        )}

        {/* Progress Bar - Show for all question types */}
        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span className={styles.progressText}>
              Progress {answeredCount || 0} / {totalQuestions || 0}
            </span>
            <span className={styles.progressPercentage}>
              {totalQuestions > 0 ? Math.round(((answeredCount || 0) / totalQuestions) * 100) : 0}%
            </span>
          </div>
          <div className={styles.progressBarContainer}>
            <div 
              className={styles.progressBarFill}
              style={{
                width: totalQuestions > 0 ? `${((answeredCount || 0) / totalQuestions) * 100}%` : '0%'
              }}
            ></div>
          </div>
        </div>

        {/* Navigation Controls - Hidden for intro questions */}
        {currentQuestion?.type !== 'intro' && (
          <div className={styles.navigationControls}>
          <button
            className={`${styles.navButton} ${styles.previousButton}`}
            onClick={() => {
              if (isRecording) {
                notifications.showWarning("Stop recording first");
                return;
              }
              onPrevious && onPrevious();
            }}
            disabled={!canGoBack || isLocked}
            aria-label="Previous Question"
            title="Previous Question"
          >
            <MdArrowBack />
            <span className={styles.navText}>Previous Question</span>
          </button>

          <button
            className={`${styles.navButton} ${styles.addQuestionButton}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isRecording) {
                notifications.showWarning("Stop recording first");
                return;
              }
              // Use requestAnimationFrame for better performance
              requestAnimationFrame(() => {
                onAddTopicQuestion && onAddTopicQuestion();
              });
            }}
            disabled={isLocked}
            aria-label="Add Question"
            title="Add a new question to the interview"
          >
            <MdAdd />
            <span className={styles.navText}>Add Question</span>
          </button>

          <button
            className={`${styles.navButton} ${styles.nextButton}`}
            onClick={() => {
              if (isRecording) {
                notifications.showWarning("Stop recording first");
                return;
              }
              onNext && onNext();
            }}
            disabled={!canGoForward || isLocked}
            aria-label="Next Question"
            title="Next Question"
          >
            <span className={styles.navText}>Next Question</span>
            <MdArrowForward />
          </button>
        </div>
        )}

        {/* Secondary Action Row - Only Proceed button */}
        <div className={styles.secondaryActions}>
            {currentQuestion?.type === 'intro' && typeof onProceedToTopics === 'function' && (
              <button
                type="button"
                className={`${styles.actionButton} ${styles.proceedButton}`}
                onClick={() => {
                  if (isRecording) {
                    notifications.showWarning("Stop recording first");
                    return;
                  }
                  onProceedToTopics();
                }}
                disabled={isLocked || !currentQuestion?.answered}
                aria-label="Proceed to Topic Questions"
                title="Proceed to topic questions"
              >
                <span className={styles.actionIcon}><MdSkipNext /></span>
                <span className={styles.actionText}>Proceed to Topic Questions</span>
              </button>
            )}
        </div>
      </div>

      {/* Ambient Background Effect */}
      <div className={styles.ambientBackground}>
        <div className={styles.ambientCircle}></div>
        <div className={styles.ambientCircle}></div>
        <div className={styles.ambientCircle}></div>
      </div>
    </div>
  );
};

export default AIInterviewerPanel;