/**
 * Error and Loading State Management Hook
 * Comprehensive hook for managing loading states, errors, and user feedback
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { generateUserFriendlyError, logError } from '../utils/errorHandler';
import { useOnlineStatus } from './useOfflineQueue';

/**
 * Hook for managing error and loading states
 * @param {Object} options - Configuration options
 * @returns {Object} - State and methods for error/loading management
 */
export const useErrorAndLoading = (options = {}) => {
  const {
    defaultError = null,
    autoResetError = true,
    autoResetDelay = 5000,
    trackRetries = true,
    maxRetries = 3,
    onError = null,
    onRetry = null,
    onSuccess = null
  } = options;

  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(defaultError);
  const [retryCount, setRetryCount] = useState(0);
  const [lastOperation, setLastOperation] = useState(null);
  const [operationHistory, setOperationHistory] = useState([]);

  // Refs for cleanup and tracking
  const errorTimeoutRef = useRef(null);
  const operationRef = useRef(null);
  const isOnline = useOnlineStatus();

  // Auto-reset error after delay
  useEffect(() => {
    if (error && autoResetError && autoResetDelay > 0) {
      errorTimeoutRef.current = setTimeout(() => {
        setError(null);
      }, autoResetDelay);
    }

    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, [error, autoResetError, autoResetDelay]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
  }, []);

  /**
   * Set error with enhanced information
   */
  const setEnhancedError = useCallback((error, context = {}) => {
    const userFriendlyError = generateUserFriendlyError(error, context);
    
    // Log the error
    logError(error, context);
    
    // Set the enhanced error
    setError({
      ...userFriendlyError,
      timestamp: Date.now(),
      context,
      retryCount: retryCount
    });

    // Call error callback if provided
    if (onError) {
      onError(error, userFriendlyError, context);
    }

    return userFriendlyError;
  }, [retryCount, onError]);

  /**
   * Execute async operation with loading and error handling
   */
  const executeAsync = useCallback(async (
    operation, 
    operationName = 'operation',
    context = {}
  ) => {
    // Defensive check for operation
    if (!operation || typeof operation !== 'function') {
      throw new Error(`Invalid operation provided to executeAsync: ${typeof operation}`);
    }

    // Clear previous error
    clearError();
    
    // Set loading state
    setIsLoading(true);
    setLastOperation(operationName);
    
    // Store operation reference for potential cancellation
    operationRef.current = {
      name: operationName,
      startTime: Date.now(),
      context
    };

    try {
      const result = await operation();
      
      // Success - reset retry count and update history
      setRetryCount(0);
      setOperationHistory(prev => [
        ...prev.slice(-9), // Keep last 10 operations
        {
          name: operationName,
          success: true,
          timestamp: Date.now(),
          duration: operationRef.current?.startTime ? Date.now() - operationRef.current.startTime : 0,
          context
        }
      ]);

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(result, operationName, context);
      }

      return result;
    } catch (error) {
      // Handle error inline to avoid circular dependency
      const userFriendlyError = generateUserFriendlyError(error, {
        operation: operationName,
        ...context
      });
      
      // Log the error
      logError(error, { operation: operationName, ...context });
      
      // Set the enhanced error
      const enhancedError = {
        ...userFriendlyError,
        timestamp: Date.now(),
        context: { operation: operationName, ...context },
        retryCount: retryCount
      };
      
      setError(enhancedError);

      // Call error callback if provided
      if (onError) {
        onError(error, userFriendlyError, { operation: operationName, ...context });
      }

      // Update operation history
      setOperationHistory(prev => [
        ...prev.slice(-9),
        {
          name: operationName,
          success: false,
          error: error.message,
          timestamp: Date.now(),
          duration: operationRef.current?.startTime ? Date.now() - operationRef.current.startTime : 0,
          context
        }
      ]);

      throw enhancedError;
    } finally {
      setIsLoading(false);
      operationRef.current = null;
    }
  }, [clearError, retryCount, onError, onSuccess]);

  /**
   * Retry the last failed operation
   */
  const retry = useCallback(async () => {
    if (!error || !error.canRetry || retryCount >= maxRetries) {
      return;
    }

    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);

    // Call retry callback if provided
    if (onRetry) {
      onRetry(error, newRetryCount, maxRetries);
    }

    // Note: The actual retry logic should be implemented by the caller
    // This just manages the retry count and state
  }, [error, retryCount, maxRetries, onRetry]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setRetryCount(0);
    setLastOperation(null);
    clearError();
    
    if (operationRef.current) {
      operationRef.current = null;
    }
  }, [clearError]);

  /**
   * Get loading state for specific operation
   */
  const isLoadingOperation = useCallback((operationName) => {
    return isLoading && lastOperation === operationName;
  }, [isLoading, lastOperation]);

  /**
   * Get error state for specific operation
   */
  const getOperationError = useCallback((operationName) => {
    return error && error.context?.operation === operationName ? error : null;
  }, [error]);

  /**
   * Check if operation can be retried
   */
  const canRetry = useCallback(() => {
    return error && error.canRetry && retryCount < maxRetries && isOnline;
  }, [error, retryCount, maxRetries, isOnline]);

  /**
   * Get operation statistics
   */
  const getStats = useCallback(() => {
    const recentOperations = operationHistory.slice(-10);
    const successful = recentOperations.filter(op => op.success).length;
    const failed = recentOperations.filter(op => !op.success).length;
    
    return {
      totalOperations: recentOperations.length,
      successful,
      failed,
      successRate: recentOperations.length > 0 ? 
        (successful / recentOperations.length * 100).toFixed(1) + '%' : 
        'N/A',
      averageDuration: recentOperations.length > 0 ?
        Math.round(recentOperations.reduce((sum, op) => sum + op.duration, 0) / recentOperations.length) :
        0,
      lastOperation: recentOperations[recentOperations.length - 1] || null
    };
  }, [operationHistory]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    isLoading,
    error,
    retryCount,
    lastOperation,
    operationHistory,
    isOnline,
    
    // Methods
    executeAsync,
    retry,
    reset,
    clearError,
    setError: setEnhancedError,
    
    // Utilities
    isLoadingOperation,
    getOperationError,
    canRetry,
    getStats,
    
    // Computed properties
    hasError: !!error,
    canRetryOperation: canRetry(),
    isRetrying: isLoading && retryCount > 0,
    maxRetriesReached: retryCount >= maxRetries
  };
};

/**
 * Hook for managing multiple async operations
 * @param {Object} options - Configuration options
 * @returns {Object} - State and methods for managing multiple operations
 */
export const useMultipleOperations = (options = {}) => {
  const {
    maxConcurrent = 3,
    onAllComplete = null,
    onAnyError = null
  } = options;

  const [operations, setOperations] = useState({});
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState(null);

  /**
   * Add or update operation state
   */
  const updateOperation = useCallback((id, state) => {
    setOperations(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...state,
        lastUpdated: Date.now()
      }
    }));
  }, []);

  /**
   * Execute operation with tracking
   */
  const executeOperation = useCallback(async (
    id,
    operation,
    context = {}
  ) => {
    // Check concurrent limit
    const activeOperations = Object.values(operations).filter(op => op.isLoading).length;
    if (activeOperations >= maxConcurrent) {
      throw new Error(`Maximum concurrent operations (${maxConcurrent}) reached`);
    }

    // Initialize operation state
    updateOperation(id, {
      isLoading: true,
      error: null,
      startTime: Date.now(),
      context
    });

    try {
      const result = await operation();
      
      updateOperation(id, {
        isLoading: false,
        success: true,
        result,
        endTime: Date.now()
      });

      // Check if all operations are complete
      const allOps = Object.values(operations);
      const allComplete = allOps.length > 0 && allOps.every(op => !op.isLoading);
      
      if (allComplete && onAllComplete) {
        onAllComplete(operations);
      }

      return result;
    } catch (error) {
      const userFriendlyError = generateUserFriendlyError(error, context);
      
      updateOperation(id, {
        isLoading: false,
        success: false,
        error: userFriendlyError,
        endTime: Date.now()
      });

      if (onAnyError) {
        onAnyError(error, userFriendlyError, id);
      }

      throw userFriendlyError;
    }
  }, [operations, maxConcurrent, updateOperation, onAllComplete, onAnyError]);

  /**
   * Remove operation from tracking
   */
  const removeOperation = useCallback((id) => {
    setOperations(prev => {
      const { [id]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  /**
   * Clear all operations
   */
  const clearAll = useCallback(() => {
    setOperations({});
    setGlobalLoading(false);
    setGlobalError(null);
  }, []);

  /**
   * Get operation statistics
   */
  const getOperationStats = useCallback(() => {
    const ops = Object.values(operations);
    const loading = ops.filter(op => op.isLoading).length;
    const successful = ops.filter(op => op.success).length;
    const failed = ops.filter(op => op.error).length;
    
    return {
      total: ops.length,
      loading,
      successful,
      failed,
      completed: successful + failed,
      progress: ops.length > 0 ? ((successful + failed) / ops.length * 100) : 0
    };
  }, [operations]);

  // Update global loading state
  useEffect(() => {
    const hasLoading = Object.values(operations).some(op => op.isLoading);
    setGlobalLoading(hasLoading);
  }, [operations]);

  return {
    operations,
    globalLoading,
    globalError,
    executeOperation,
    updateOperation,
    removeOperation,
    clearAll,
    getOperationStats,
    stats: getOperationStats()
  };
};

/**
 * Hook for managing form validation errors
 * @param {Object} initialErrors - Initial error state
 * @returns {Object} - Form error management utilities
 */
export const useFormErrors = (initialErrors = {}) => {
  const [errors, setErrors] = useState(initialErrors);

  const setFieldError = useCallback((field, error) => {
    setErrors(prev => ({
      ...prev,
      [field]: error
    }));
  }, []);

  const clearFieldError = useCallback((field) => {
    setErrors(prev => {
      const { [field]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const hasErrors = Object.keys(errors).length > 0;
  const getFieldError = useCallback((field) => errors[field], [errors]);

  return {
    errors,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    hasErrors,
    getFieldError,
    errorCount: Object.keys(errors).length
  };
};