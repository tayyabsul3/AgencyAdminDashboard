'use client';

/**
 * Notification System Component
 * Manages toast notifications, alerts, and user feedback messages
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ErrorToast } from './ErrorMessage';
import styles from './NotificationSystem.module.css';

// Notification types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  LOADING: 'loading'
};

// Notification context
const NotificationContext = createContext(null);

/**
 * Notification Provider Component
 */
export const NotificationProvider = ({ children, maxNotifications = 5 }) => {
  const [notifications, setNotifications] = useState([]);

  /**
   * Add a new notification
   */
  const addNotification = useCallback((notification) => {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newNotification = {
      id,
      timestamp: Date.now(),
      duration: 5000,
      position: 'top-right',
      dismissible: true,
      ...notification
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      
      // Limit number of notifications
      if (updated.length > maxNotifications) {
        return updated.slice(0, maxNotifications);
      }
      
      return updated;
    });

    return id;
  }, [maxNotifications]);

  /**
   * Remove notification by ID
   */
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  /**
   * Clear all notifications
   */
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  /**
   * Update existing notification
   */
  const updateNotification = useCallback((id, updates) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, ...updates } : n
    ));
  }, []);

  // Convenience methods for different notification types
  const showSuccess = useCallback((message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.SUCCESS,
      title: 'Success',
      message,
      ...options
    });
  }, [addNotification]);

  const showError = useCallback((message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.ERROR,
      title: 'Error',
      message,
      duration: 8000, // Longer duration for errors
      ...options
    });
  }, [addNotification]);

  const showWarning = useCallback((message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.WARNING,
      title: 'Warning',
      message,
      ...options
    });
  }, [addNotification]);

  const showInfo = useCallback((message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.INFO,
      title: 'Info',
      message,
      ...options
    });
  }, [addNotification]);

  const showLoading = useCallback((message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.LOADING,
      title: 'Loading',
      message,
      duration: 0, // Don't auto-dismiss loading notifications
      dismissible: false,
      ...options
    });
  }, [addNotification]);

  const value = {
    notifications,
    addNotification,
    removeNotification,
    updateNotification,
    clearAll,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

/**
 * Hook to use notifications
 */
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    // Always provide a safe fallback to prevent crashes in any environment
    console.warn('useNotifications called outside of NotificationProvider, using fallback');
    return {
      notifications: [],
      addNotification: () => {},
      removeNotification: () => {},
      updateNotification: () => {},
      clearAll: () => {},
      showSuccess: () => {},
      showError: () => {},
      showWarning: () => {},
      showInfo: () => {},
      showLoading: () => {}
    };
  }
  return context;
};

/**
 * Notification Container Component
 */
const NotificationContainer = () => {
  const context = useContext(NotificationContext);
  
  // Don't render if context is not available
  if (!context) {
    return null;
  }
  
  const { notifications, removeNotification } = context;

  // Group notifications by position
  const notificationsByPosition = notifications.reduce((acc, notification) => {
    const position = notification.position || 'top-right';
    if (!acc[position]) {
      acc[position] = [];
    }
    acc[position].push(notification);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(notificationsByPosition).map(([position, positionNotifications]) => (
        <div key={position} className={`${styles.container} ${styles[position]}`}>
          {positionNotifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onDismiss={() => removeNotification(notification.id)}
            />
          ))}
        </div>
      ))}
    </>
  );
};

/**
 * Individual Notification Item Component
 */
const NotificationItem = ({ notification, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    if (notification.duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, notification.duration);
      return () => clearTimeout(timer);
    }
  }, [notification.duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss();
    }, 300); // Wait for exit animation
  };

  const getIcon = () => {
    switch (notification.type) {
      case NOTIFICATION_TYPES.SUCCESS:
        return '✅';
      case NOTIFICATION_TYPES.ERROR:
        return '❌';
      case NOTIFICATION_TYPES.WARNING:
        return '⚠️';
      case NOTIFICATION_TYPES.INFO:
        return 'ℹ️';
      case NOTIFICATION_TYPES.LOADING:
        return '⏳';
      default:
        return 'ℹ️';
    }
  };

  const notificationClasses = [
    styles.notification,
    styles[notification.type],
    isVisible ? styles.visible : styles.hidden,
    isExiting ? styles.exiting : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={notificationClasses}>
      <div className={styles.content}>
        <div className={styles.icon}>
          {notification.type === NOTIFICATION_TYPES.LOADING ? (
            <div className={styles.spinner}></div>
          ) : (
            getIcon()
          )}
        </div>
        
        <div className={styles.text}>
          {notification.title && (
            <div className={styles.title}>{notification.title}</div>
          )}
          <div className={styles.message}>{notification.message}</div>
        </div>
        
        {notification.dismissible && (
          <button 
            className={styles.dismissButton}
            onClick={handleDismiss}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        )}
      </div>
      
      {notification.actions && (
        <div className={styles.actions}>
          {notification.actions.map((action, index) => (
            <button
              key={index}
              className={`${styles.actionButton} ${styles[action.style || 'primary']}`}
              onClick={() => {
                action.onClick();
                if (action.dismissOnClick !== false) {
                  handleDismiss();
                }
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      
      {notification.duration > 0 && (
        <div 
          className={styles.progressBar}
          style={{ 
            animationDuration: `${notification.duration}ms`,
            animationPlayState: isExiting ? 'paused' : 'running'
          }}
        />
      )}
    </div>
  );
};

/**
 * Hook for operation notifications
 * Automatically shows loading, success, and error notifications for async operations
 */
export const useOperationNotifications = () => {
  const notifications = useNotifications();

  const executeWithNotifications = useCallback(async (
    operation,
    options = {}
  ) => {
    const {
      loadingMessage = 'Processing...',
      successMessage = 'Operation completed successfully',
      errorMessage = 'Operation failed',
      showLoading = true,
      showSuccess = true,
      showError = true,
      operationName = 'operation'
    } = options;

    let loadingId = null;

    try {
      // Show loading notification
      if (showLoading) {
        loadingId = notifications.showLoading(loadingMessage, {
          title: `${operationName}...`
        });
      }

      // Execute operation
      const result = await operation();

      // Remove loading notification
      if (loadingId) {
        notifications.removeNotification(loadingId);
      }

      // Show success notification
      if (showSuccess) {
        notifications.showSuccess(successMessage, {
          title: `${operationName} Complete`
        });
      }

      return result;
    } catch (error) {
      // Remove loading notification
      if (loadingId) {
        notifications.removeNotification(loadingId);
      }

      // Show error notification
      if (showError) {
        const message = error.userFriendly?.message || error.message || errorMessage;
        notifications.showError(message, {
          title: `${operationName} Failed`,
          actions: error.userFriendly?.canRetry ? [
            {
              label: 'Retry',
              onClick: () => executeWithNotifications(operation, options),
              style: 'primary'
            }
          ] : undefined
        });
      }

      throw error;
    }
  }, [notifications]);

  return {
    executeWithNotifications,
    ...notifications
  };
};

export default NotificationProvider;