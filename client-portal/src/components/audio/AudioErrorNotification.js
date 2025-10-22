/**
 * Audio Error Notification Component
 * Displays user-friendly error messages with recovery options
 */

import React, { useState, useEffect } from 'react';
import styles from './AudioErrorNotification.module.css';

const AudioErrorNotification = ({
  error,
  onRetry,
  onSwitchToText,
  onDismiss,
  onContactSupport,
  autoHide = false,
  autoHideDelay = 10000
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    if (autoHide && autoHideDelay > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoHideDelay);

      // Show countdown for last 5 seconds
      if (autoHideDelay > 5000) {
        const countdownTimer = setTimeout(() => {
          setCountdown(5);
          const countdownInterval = setInterval(() => {
            setCountdown(prev => {
              if (prev <= 1) {
                clearInterval(countdownInterval);
                return null;
              }
              return prev - 1;
            });
          }, 1000);
        }, autoHideDelay - 5000);

        return () => {
          clearTimeout(timer);
          clearTimeout(countdownTimer);
        };
      }

      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
    handleDismiss();
  };

  const handleSwitchToText = () => {
    if (onSwitchToText) {
      onSwitchToText();
    }
    handleDismiss();
  };

  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport();
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'high':
        return '⚠️';
      case 'medium':
        return '⚡';
      case 'low':
        return 'ℹ️';
      default:
        return '⚠️';
    }
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'critical':
        return styles.critical;
      case 'high':
        return styles.high;
      case 'medium':
        return styles.medium;
      case 'low':
        return styles.low;
      default:
        return styles.medium;
    }
  };

  if (!isVisible || !error) {
    return null;
  }

  return (
    <div className={`${styles.notification} ${getSeverityClass(error.severity)}`}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <span className={styles.icon}>
            {getSeverityIcon(error.severity)}
          </span>
          <h3 className={styles.title}>{error.title}</h3>
        </div>
        
        <div className={styles.headerActions}>
          {countdown && (
            <span className={styles.countdown}>
              Auto-dismiss in {countdown}s
            </span>
          )}
          <button
            className={styles.expandButton}
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          <button
            className={styles.closeButton}
            onClick={handleDismiss}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <p className={styles.message}>{error.message}</p>

        {isExpanded && error.instructions && error.instructions.length > 0 && (
          <div className={styles.instructions}>
            <h4>How to fix this:</h4>
            <ol>
              {error.instructions.map((instruction, index) => (
                <li key={index}>{instruction}</li>
              ))}
            </ol>
          </div>
        )}

        <div className={styles.actions}>
          {error.canRetry && onRetry && (
            <button
              className={`${styles.actionButton} ${styles.primary}`}
              onClick={handleRetry}
            >
              {error.actionText || 'Try Again'}
            </button>
          )}

          {error.canSwitchToText && onSwitchToText && (
            <button
              className={`${styles.actionButton} ${styles.secondary}`}
              onClick={handleSwitchToText}
            >
              {error.secondaryActionText || 'Switch to Text Mode'}
            </button>
          )}

          {error.severity === 'critical' && onContactSupport && (
            <button
              className={`${styles.actionButton} ${styles.support}`}
              onClick={handleContactSupport}
            >
              Contact Support
            </button>
          )}
        </div>

        {isExpanded && error.originalError && (
          <details className={styles.technicalDetails}>
            <summary>Technical Details</summary>
            <div className={styles.errorDetails}>
              <p><strong>Error Type:</strong> {error.type}</p>
              <p><strong>Severity:</strong> {error.severity}</p>
              {error.originalError.message && (
                <p><strong>Message:</strong> {error.originalError.message}</p>
              )}
              {error.originalError.stack && (
                <pre className={styles.stackTrace}>
                  {error.originalError.stack}
                </pre>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

export default AudioErrorNotification;