/**
 * useUnifiedTimer Hook
 * Unified timer system to replace multiple conflicting timeouts
 * Prevents race conditions and simplifies timeout management
 */

import { useRef, useCallback, useEffect } from 'react';

// Action priorities (higher number = higher priority)
const PRIORITIES = {
  AUTO_SAVE: 10,        // Highest - data integrity critical
  ERROR_RECOVERY: 8,    // High - user experience critical
  ERROR_CLEAR: 5,       // Medium - user feedback
  UI_FEEDBACK: 3,       // Low - visual polish
  SUGGESTIONS: 1        // Lowest - nice to have
};

// Action types
const ACTION_TYPES = {
  AUTO_SAVE: 'AUTO_SAVE',
  ERROR_CLEAR: 'ERROR_CLEAR',
  HIDE_CAPTION: 'HIDE_CAPTION',
  SHOW_SUGGESTIONS: 'SHOW_SUGGESTIONS',
  STATE_UPDATE: 'STATE_UPDATE',
  RETRY_OPERATION: 'RETRY_OPERATION'
};

export const useUnifiedTimer = (options = {}) => {
  const {
    enableLogging = false,
    maxQueueSize = 10
  } = options;

  // Single timer reference
  const timerRef = useRef(null);
  
  // Action queue with metadata
  const queueRef = useRef([]);
  
  // Mounted state to prevent memory leaks
  const mountedRef = useRef(true);
  
  // Performance tracking
  const metricsRef = useRef({
    actionsExecuted: 0,
    actionsCancelled: 0,
    averageDelay: 0
  });

  // Execute the next action in queue
  const executeAction = useCallback((action) => {
    if (!mountedRef.current) return;

    if (enableLogging) {
      console.log('🕐 Executing timer action:', action.type, action.data);
    }

    try {
      // Execute the action callback
      if (action.callback && typeof action.callback === 'function') {
        action.callback(action.data);
      }

      // Update metrics
      metricsRef.current.actionsExecuted++;
      
      // Process next action in queue
      processQueue();
      
    } catch (error) {
      console.error('Timer action execution failed:', error);
      // Continue processing queue even if one action fails
      processQueue();
    }
  }, [enableLogging]);

  // Process the action queue
  const processQueue = useCallback(() => {
    if (!mountedRef.current || queueRef.current.length === 0) {
      timerRef.current = null;
      return;
    }

    // Sort queue by execution time, then by priority
    queueRef.current.sort((a, b) => {
      const timeDiff = a.executeAt - b.executeAt;
      if (timeDiff !== 0) return timeDiff;
      return b.priority - a.priority; // Higher priority first
    });

    const nextAction = queueRef.current.shift();
    const now = Date.now();
    const delay = Math.max(0, nextAction.executeAt - now);

    if (enableLogging) {
      console.log('🕐 Scheduling next action:', nextAction.type, `in ${delay}ms`);
    }

    timerRef.current = setTimeout(() => executeAction(nextAction), delay);
  }, [executeAction, enableLogging]);

  // Schedule a new action
  const schedule = useCallback((actionType, delay, callback, data = null, priority = null) => {
    if (!mountedRef.current) return;

    // Validate inputs
    if (!actionType || typeof delay !== 'number' || delay < 0) {
      console.error('Invalid timer schedule parameters:', { actionType, delay });
      return;
    }

    if (typeof callback !== 'function') {
      console.error('Timer callback must be a function');
      return;
    }

    // Determine priority
    const actionPriority = priority !== null ? priority : (PRIORITIES[actionType] || PRIORITIES.UI_FEEDBACK);
    
    const executeAt = Date.now() + delay;
    const actionId = `${actionType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newAction = {
      id: actionId,
      type: actionType,
      callback,
      data,
      priority: actionPriority,
      executeAt,
      scheduledAt: Date.now()
    };

    // Handle action conflicts based on type
    switch (actionType) {
      case ACTION_TYPES.AUTO_SAVE:
        // Cancel any existing auto-save actions (only one auto-save should be pending)
        queueRef.current = queueRef.current.filter(action => {
          if (action.type === ACTION_TYPES.AUTO_SAVE) {
            metricsRef.current.actionsCancelled++;
            if (enableLogging) {
              console.log('🕐 Cancelled existing auto-save action');
            }
            return false;
          }
          return true;
        });
        break;

      case ACTION_TYPES.SHOW_SUGGESTIONS:
        // Don't show suggestions if auto-save is pending
        const hasAutoSave = queueRef.current.some(action => action.type === ACTION_TYPES.AUTO_SAVE);
        if (hasAutoSave) {
          if (enableLogging) {
            console.log('🕐 Skipping suggestions - auto-save pending');
          }
          return;
        }
        break;

      case ACTION_TYPES.ERROR_CLEAR:
        // Cancel existing error clear actions for the same error type
        queueRef.current = queueRef.current.filter(action => {
          if (action.type === ACTION_TYPES.ERROR_CLEAR && action.data?.errorType === data?.errorType) {
            metricsRef.current.actionsCancelled++;
            return false;
          }
          return true;
        });
        break;
    }

    // Add to queue
    queueRef.current.push(newAction);

    // Enforce max queue size
    if (queueRef.current.length > maxQueueSize) {
      const removed = queueRef.current.shift();
      metricsRef.current.actionsCancelled++;
      if (enableLogging) {
        console.warn('🕐 Queue overflow, removed oldest action:', removed.type);
      }
    }

    // Clear existing timer and process queue
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    processQueue();

    return actionId;
  }, [processQueue, enableLogging, maxQueueSize]);

  // Cancel specific action by ID
  const cancel = useCallback((actionId) => {
    if (!actionId) return false;

    const initialLength = queueRef.current.length;
    queueRef.current = queueRef.current.filter(action => action.id !== actionId);
    
    const cancelled = queueRef.current.length < initialLength;
    if (cancelled) {
      metricsRef.current.actionsCancelled++;
      if (enableLogging) {
        console.log('🕐 Cancelled action:', actionId);
      }
    }

    return cancelled;
  }, [enableLogging]);

  // Cancel actions by type
  const cancelByType = useCallback((actionType) => {
    const initialLength = queueRef.current.length;
    queueRef.current = queueRef.current.filter(action => action.type !== actionType);
    
    const cancelledCount = initialLength - queueRef.current.length;
    metricsRef.current.actionsCancelled += cancelledCount;
    
    if (enableLogging && cancelledCount > 0) {
      console.log('🕐 Cancelled actions by type:', actionType, `(${cancelledCount} actions)`);
    }

    return cancelledCount;
  }, [enableLogging]);

  // Clear all pending actions
  const clear = useCallback(() => {
    const cancelledCount = queueRef.current.length;
    queueRef.current = [];
    metricsRef.current.actionsCancelled += cancelledCount;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (enableLogging && cancelledCount > 0) {
      console.log('🕐 Cleared all timer actions:', `(${cancelledCount} actions)`);
    }

    return cancelledCount;
  }, [enableLogging]);

  // Get current queue status
  const getStatus = useCallback(() => {
    return {
      queueLength: queueRef.current.length,
      isActive: timerRef.current !== null,
      nextAction: queueRef.current.length > 0 ? {
        type: queueRef.current[0]?.type,
        executeIn: Math.max(0, queueRef.current[0]?.executeAt - Date.now())
      } : null,
      metrics: { ...metricsRef.current }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      queueRef.current = [];
    };
  }, []);

  // Return the timer interface
  return {
    // Core functions
    schedule,
    cancel,
    cancelByType,
    clear,
    
    // Status and debugging
    getStatus,
    
    // Action types and priorities for convenience
    ACTION_TYPES,
    PRIORITIES
  };
};

// Export action types and priorities for use in components
export { ACTION_TYPES, PRIORITIES };