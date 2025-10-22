'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MdArticle, MdHourglassEmpty, MdMic, MdPerson, MdLightbulb, MdCheckCircle } from 'react-icons/md';
import styles from './StudioHeaderComponent.module.css';
import { useNotifications } from '../ui/NotificationSystem';

const StudioHeaderComponent = ({
  sessionTitle = "Expert Interview Studio",
  clientName = "AI Expert",
  // sessionDuration removed
  onSettingsClick,
  // Navigation props from footer
  currentQuestion = 0,
  totalQuestions = 0,
  answeredCount = 0,
  progress = 0,
  canGoBack = false,
  canGoForward = true,
  isLastQuestion = false,
  onPrevious,
  onNext,
  onShowQuestions,
  onAddTopicQuestion,
  onGenerateArticle,
  saveStatus = 'idle',
  // Question type breakdown props
  questions = [],
  // Intro questions lock - disable navigation until intro questions are completed
  isShowingIntroQuestions = false,
  // Recording state for navigation blocking
  isRecording = false,
  className = '',
  ...props
}) => {
  const notifications = useNotifications();
  const wasGenerateEnabledRef = useRef(false);
  const unlockNotificationIdRef = useRef(null);
  const strictModeCleanupGuardRef = useRef(false);

  // Session timer removed as requested



  // Progress calculations with question type breakdown
  const progressPercentage = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
  const currentProgressPercentage = totalQuestions > 0 ? ((currentQuestion + 1) / totalQuestions) * 100 : 0;

  // Calculate intro vs topic question progress
  const introQuestions = questions.filter(q => q.type === 'intro');
  const topicQuestions = questions.filter(q => q.type === 'topic');
  const answeredIntroQuestions = introQuestions.filter(q => q.answered || (q.answer && q.answer.trim().length > 0));
  const answeredTopicQuestions = topicQuestions.filter(q => q.answered || (q.answer && q.answer.trim().length > 0));

  const hasQuestionTypes = introQuestions.length > 0 || topicQuestions.length > 0;

  // Generate Article button state
  const allQuestionsAnswered = answeredCount === totalQuestions && totalQuestions > 0;
  const canGenerateArticle = allQuestionsAnswered;
  const remainingQuestions = totalQuestions - answeredCount;

  useEffect(() => {
    if (canGenerateArticle) {
      if (!wasGenerateEnabledRef.current) {
        const id = notifications.showSuccess?.('All requirements met — you can generate the article now!', {
          title: 'Article Generation Ready',
          duration: 0,
          dismissible: false
        });
        unlockNotificationIdRef.current = id || unlockNotificationIdRef.current;
      }
    } else if (unlockNotificationIdRef.current) {
      notifications.removeNotification?.(unlockNotificationIdRef.current);
      unlockNotificationIdRef.current = null;
    }

    wasGenerateEnabledRef.current = canGenerateArticle;
  }, [canGenerateArticle, notifications]);

  useEffect(() => () => {
    if (!strictModeCleanupGuardRef.current) {
      strictModeCleanupGuardRef.current = true;
      return;
    }

    if (unlockNotificationIdRef.current) {
      notifications.removeNotification?.(unlockNotificationIdRef.current);
      unlockNotificationIdRef.current = null;
    }
  }, [notifications]);


  return (
    <div className={`${styles.studioHeader} ${className}`} {...props}>
      {/* Left Section - Branding & Session Info */}
      <div className={styles.leftSection}>
        <div className={styles.studioBranding}>
          <div className={styles.studioLogo}><MdMic /></div>
          <div className={styles.sessionInfo}>
            <h1 className={styles.sessionTitle}>{sessionTitle}</h1>
            <p className={styles.sessionMeta}>Session with {clientName}</p>
          </div>
        </div>
      </div>

      {/* Center Section - Session Timer removed as requested */}

      {/* Right Section - Navigation & Controls */}
      <div className={styles.rightSection}>
        {/* Progress Section */}
        <div className={styles.progressSection}>
          <div className={styles.progressInfo}>
            <div className={styles.progressHeader}>
            </div>
            {hasQuestionTypes && (
              <div className={styles.progressBreakdown}>
                <div className={styles.progressTypeGroup}>
                  <span className={styles.progressTypeLabel}>
                    <span className={styles.typeIcon}><MdPerson /></span>
                    Intro: {answeredIntroQuestions.length}/{introQuestions.length}
                  </span>
                  <span className={styles.progressTypeLabel}>
                    <span className={styles.typeIcon}><MdLightbulb /></span>
                    Topic: {answeredTopicQuestions.length}/{topicQuestions.length}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${currentProgressPercentage}%` }}
            />
            <div
              className={styles.progressCompleted}
              style={{ width: `${progressPercentage}%` }}
            />
            {hasQuestionTypes && (
              <>
                <div
                  className={styles.progressIntro}
                  style={{ 
                    width: `${introQuestions.length > 0 ? (answeredIntroQuestions.length / totalQuestions) * 100 : 0}%` 
                  }}
                />
                <div
                  className={styles.progressTopic}
                  style={{ 
                    width: `${topicQuestions.length > 0 ? (answeredTopicQuestions.length / totalQuestions) * 100 : 0}%`,
                    left: `${introQuestions.length > 0 ? (introQuestions.length / totalQuestions) * 100 : 0}%`
                  }}
                />
              </>
            )}
          </div>
        </div>



        {/* Session Actions */}
        <div className={styles.sessionActions}>
          {/* Generate Article Button */}
          <button
            className={`${styles.actionButton} ${styles.generateArticleButton} ${
              !canGenerateArticle || isRecording ? styles.generateArticleButtonDisabled : ''
            } ${!canGenerateArticle || isRecording ? styles.generateArticleButtonWithSubtext : ''}`}
            onClick={canGenerateArticle && !isRecording ? (onGenerateArticle || (() => {
              if (process.env.NODE_ENV === 'development') {
                console.log('Generate Article clicked');
              }
            })) : undefined}
            disabled={!canGenerateArticle || isRecording}
            aria-label={
              isRecording ? "Stop recording first to generate article" :
              canGenerateArticle ? "Generate Article" : 
              `Complete ${remainingQuestions} more question${remainingQuestions !== 1 ? 's' : ''} to generate article`
            }
            title={
              isRecording ? "Stop recording first to generate article" :
              canGenerateArticle ? "Generate article from interview responses" : 
              `Answer all questions first (${remainingQuestions} remaining)`
            }
          >
            <div className={styles.buttonContent}>
              <span className={styles.actionIcon}>
                {canGenerateArticle ? <MdArticle /> : <MdHourglassEmpty />}
              </span>
              <span className={styles.actionText}>
                {isRecording ? 'Stop Recording' : 
                 canGenerateArticle ? 'Generate Article' : 
                 `${remainingQuestions} More`}
              </span>
            </div>
            {(!canGenerateArticle || isRecording) && (
              <span className={styles.actionSubtext}>
                {isRecording ? 'Stop recording first' : 'Answer all questions'}
              </span>
            )}
          </button>


        </div>
      </div>
    </div>
  );
};

export default React.memo(StudioHeaderComponent);
