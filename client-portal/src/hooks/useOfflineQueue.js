/**
 * Offline Queue Hook
 * Manages offline detection and queues operations for retry when connection returns
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for managing offline operations queue
 * @param {Object} options - Configuration options
 * @returns {Object} - Queue management functions and state
 */
export const useOfflineQueue = (options = {}) => {
  const {
    maxQueueSize = 50,
    retryInterval = 5000,
    maxRetries = 3,
    onOnline = null,
    onOffline = null,
    onQueueUpdate = null
  } = options;

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [queue, setQueue] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const queueRef = useRef([]);
  const retryTimeoutRef = useRef(null);
  const processingRef = useRef(false);

  // Update refs when state changes
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    processingRef.current = isProcessing;
  }, [isProcessing]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Connection restored, processing queued operations');
      setIsOnline(true);
      
      if (onOnline) {
        onOnline();
      }
      
      // Process queue when coming back online
      processQueue();
    };

    const handleOffline = () => {
      console.log('Connection lost, operations will be queued');
      setIsOnline(false);
      
      if (onOffline) {
        onOffline();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [onOnline, onOffline]);

  /**
   * Add operation to queue
   * @param {Function} operation - The operation to queue
   * @param {Object} metadata - Operation metadata
   * @returns {string} - Operation ID
   */
  const addToQueue = useCallback((operation, metadata = {}) => {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queueItem = {
      id: operationId,
      operation,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        retries: 0
      },
      status: 'pending'
    };

    setQueue(prevQueue => {
      const newQueue = [...prevQueue, queueItem];
      
      // Limit queue size
      if (newQueue.length > maxQueueSize) {
        console.warn(`Queue size exceeded ${maxQueueSize}, removing oldest items`);
        return newQueue.slice(-maxQueueSize);
      }
      
      return newQueue;
    });

    if (onQueueUpdate) {
      onQueueUpdate(queueRef.current.length + 1, 'added');
    }

    // Try to process immediately if online
    if (isOnline && !processingRef.current) {
      processQueue();
    }

    return operationId;
  }, [isOnline, maxQueueSize, onQueueUpdate]);

  /**
   * Process queued operations
   */
  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0 || !isOnline) {
      return;
    }

    setIsProcessing(true);
    console.log(`Processing ${queueRef.current.length} queued operations`);

    const currentQueue = [...queueRef.current];
    const processedIds = [];
    const failedItems = [];

    for (const item of currentQueue) {
      if (item.status !== 'pending') continue;

      try {
        console.log(`Processing queued operation: ${item.id}`);
        await item.operation();
        
        processedIds.push(item.id);
        console.log(`Successfully processed operation: ${item.id}`);
        
      } catch (error) {
        console.error(`Failed to process queued operation ${item.id}:`, error);
        
        const updatedItem = {
          ...item,
          metadata: {
            ...item.metadata,
            retries: item.metadata.retries + 1,
            lastError: error.message
          }
        };

        if (updatedItem.metadata.retries >= maxRetries) {
          console.error(`Max retries reached for operation ${item.id}, removing from queue`);
          processedIds.push(item.id);
        } else {
          failedItems.push(updatedItem);
        }
      }
    }

    // Update queue by removing processed items and updating failed items
    setQueue(prevQueue => {
      const filteredQueue = prevQueue.filter(item => !processedIds.includes(item.id));
      const updatedQueue = filteredQueue.map(item => {
        const failedItem = failedItems.find(failed => failed.id === item.id);
        return failedItem || item;
      });
      
      if (onQueueUpdate) {
        onQueueUpdate(updatedQueue.length, 'processed');
      }
      
      return updatedQueue;
    });

    setIsProcessing(false);

    // Schedule retry for remaining items if any failed
    if (failedItems.length > 0 && isOnline) {
      console.log(`Scheduling retry for ${failedItems.length} failed operations in ${retryInterval}ms`);
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      
      retryTimeoutRef.current = setTimeout(() => {
        processQueue();
      }, retryInterval);
    }
  }, [isOnline, maxRetries, retryInterval, onQueueUpdate]);

  /**
   * Execute operation with offline queue support
   * @param {Function} operation - The operation to execute
   * @param {Object} options - Execution options
   * @returns {Promise} - Operation result or queue ID
   */
  const executeWithQueue = useCallback(async (operation, options = {}) => {
    const { 
      forceQueue = false, 
      metadata = {},
      fallback = null 
    } = options;

    // If offline or forced to queue, add to queue
    if (!isOnline || forceQueue) {
      const queueId = addToQueue(operation, metadata);
      
      if (fallback) {
        return fallback();
      }
      
      return { queued: true, queueId };
    }

    // Try to execute immediately
    try {
      return await operation();
    } catch (error) {
      // If execution fails and we're online, queue for retry
      console.warn('Operation failed, adding to queue for retry:', error.message);
      const queueId = addToQueue(operation, { ...metadata, failedExecution: true });
      
      if (fallback) {
        return fallback();
      }
      
      throw error;
    }
  }, [isOnline, addToQueue]);

  /**
   * Remove operation from queue
   * @param {string} operationId - ID of operation to remove
   */
  const removeFromQueue = useCallback((operationId) => {
    setQueue(prevQueue => {
      const newQueue = prevQueue.filter(item => item.id !== operationId);
      
      if (onQueueUpdate) {
        onQueueUpdate(newQueue.length, 'removed');
      }
      
      return newQueue;
    });
  }, [onQueueUpdate]);

  /**
   * Clear all queued operations
   */
  const clearQueue = useCallback(() => {
    setQueue([]);
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    if (onQueueUpdate) {
      onQueueUpdate(0, 'cleared');
    }
  }, [onQueueUpdate]);

  /**
   * Get queue statistics
   */
  const getQueueStats = useCallback(() => {
    const pending = queue.filter(item => item.status === 'pending').length;
    const failed = queue.filter(item => item.metadata.retries > 0).length;
    
    return {
      total: queue.length,
      pending,
      failed,
      processing: isProcessing
    };
  }, [queue, isProcessing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    isOnline,
    queue,
    isProcessing,
    queueSize: queue.length,
    addToQueue,
    executeWithQueue,
    removeFromQueue,
    clearQueue,
    processQueue,
    getQueueStats
  };
};

/**
 * Hook for simple offline detection
 * @returns {boolean} - Whether the browser is online
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  return isOnline;
};