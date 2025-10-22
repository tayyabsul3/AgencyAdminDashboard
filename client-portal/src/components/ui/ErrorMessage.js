/**
 * Error Message Component
 * Displays user-friendly error messages with retry options
 */

import React from 'react';
import styles from './ErrorMessage.module.css';

const ErrorMessage = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  type = 'error',
  size = 'medium',
  showIcon = true,
  showDetails = false,
  details = null,
  canRetry = true,
  retryText = 'Try Again',
  onRetry = null,
  onDismiss = null,
  actions = null,
  className = ''
}) => {
  const containerClasses = [
    styles.container,
    styles[type],
    styles[size],
    className
  ].filter(Boolean).join(' ');

  const getIcon = () => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'network':
        return '🌐';
      case 'auth':
        return '🔒';
      case 'permission':
        return '🚫';
      case 'timeout':
        return '⏱️';
      case 'quota':
        return '📊';
      default:
        return '❌';
    }
  };

  return (
    <div className={containerClasses} role="alert">
      <div className={styles.content}>
        {showIcon && (
          <div className={styles.icon}>
            {getIcon()}
          </div>
        )}
        
        <div className={styles.text}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.message}>{message}</p>
          
          {showDetails && details && (
            <details className={styles.details}>
              <summary className={styles.detailsSummary}>
                Show technical details
              </summary>
              <div className={styles.detailsContent}>
                {typeof details === 'string' ? (
                  <pre className={styles.detailsText}>{details}</pre>
                ) : (
                  <pre className={styles.detailsText}>
                    {JSON.stringify(details, null, 2)}
                  </pre>
                )}
              </div>
            </details>
          )}
        </div>
        
        {onDismiss && (
          <button 
            className={styles.dismissButton}
            onClick={onDismiss}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        )}
      </div>
      
      {(canRetry || actions) && (
        <div className={styles.actions}>
          {canRetry && onRetry && (
            <button 
              className={styles.retryButton}
              onClick={onRetry}
            >
              {retryText}
            </button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
};

/**
 * Inline Error Message
 * Smaller error message for form fields and inline use
 */
export const InlineError = ({
  message,
  className = ''
}) => {
  if (!message) return null;

  return (
    <div className={`${styles.inlineError} ${className}`} role="alert">
      <span className={styles.inlineIcon}>⚠️</span>
      <span className={styles.inlineMessage}>{message}</span>
    </div>
  );
};

/**
 * Error Toast
 * Floating error message that can be dismissed
 */
export const ErrorToast = ({
  title,
  message,
  type = 'error',
  duration = 5000,
  onDismiss,
  position = 'top-right',
  className = ''
}) => {
  const [isVisible, setIsVisible] = React.useState(true);
  const timeoutRef = React.useRef();

  React.useEffect(() => {
    if (duration > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
        if (onDismiss) {
          setTimeout(onDismiss, 300); // Wait for animation
        }
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [duration, onDismiss]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      setTimeout(onDismiss, 300); // Wait for animation
    }
  };

  if (!isVisible) return null;

  const toastClasses = [
    styles.toast,
    styles[type],
    styles[position],
    isVisible ? styles.toastVisible : styles.toastHidden,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={toastClasses}>
      <ErrorMessage
        title={title}
        message={message}
        type={type}
        size="small"
        showIcon={true}
        canRetry={false}
        onDismiss={handleDismiss}
      />
    </div>
  );
};

/**
 * Error List
 * Display multiple errors in a list format
 */
export const ErrorList = ({
  errors = [],
  title = 'Multiple errors occurred',
  onRetryAll = null,
  onDismissAll = null,
  className = ''
}) => {
  if (!errors.length) return null;

  return (
    <div className={`${styles.errorList} ${className}`}>
      <div className={styles.errorListHeader}>
        <h3 className={styles.errorListTitle}>{title}</h3>
        {onDismissAll && (
          <button 
            className={styles.dismissButton}
            onClick={onDismissAll}
            aria-label="Dismiss all errors"
          >
            ✕
          </button>
        )}
      </div>
      
      <div className={styles.errorListContent}>
        {errors.map((error, index) => (
          <div key={index} className={styles.errorListItem}>
            <InlineError message={error.message || error} />
          </div>
        ))}
      </div>
      
      {onRetryAll && (
        <div className={styles.errorListActions}>
          <button 
            className={styles.retryButton}
            onClick={onRetryAll}
          >
            Retry All
          </button>
        </div>
      )}
    </div>
  );
};

export default ErrorMessage;