/**
 * Debouncing utilities for performance optimization
 * Prevents excessive API calls and improves user experience
 */

/**
 * Basic debounce function
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @param {boolean} immediate - Execute immediately on first call
 * @returns {Function} Debounced function
 */
export function debounce(func, delay, immediate = false) {
  let timeoutId;
  let lastArgs;
  let lastThis;

  const debounced = function(...args) {
    lastArgs = args;
    lastThis = this;

    const callNow = immediate && !timeoutId;

    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (!immediate) {
        func.apply(lastThis, lastArgs);
      }
    }, delay);

    if (callNow) {
      func.apply(lastThis, lastArgs);
    }
  };

  // Add cancel method
  debounced.cancel = () => {
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  // Add flush method to execute immediately
  debounced.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      func.apply(lastThis, lastArgs);
    }
  };

  return debounced;
}

/**
 * Advanced debounce with leading and trailing options
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @param {Object} options - Configuration options
 * @returns {Function} Debounced function
 */
export function advancedDebounce(func, delay, options = {}) {
  const { leading = false, trailing = true, maxWait } = options;
  
  let timeoutId;
  let maxTimeoutId;
  let lastCallTime;
  let lastInvokeTime = 0;
  let lastArgs;
  let lastThis;
  let result;

  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;

    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    return result;
  }

  function leadingEdge(time) {
    lastInvokeTime = time;
    timeoutId = setTimeout(timerExpired, delay);
    return leading ? invokeFunc(time) : result;
  }

  function remainingWait(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = delay - timeSinceLastCall;

    return maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === undefined ||
      timeSinceLastCall >= delay ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timeoutId = setTimeout(timerExpired, remainingWait(time));
  }

  function trailingEdge(time) {
    timeoutId = undefined;

    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  }

  function cancel() {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    if (maxTimeoutId !== undefined) {
      clearTimeout(maxTimeoutId);
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timeoutId = maxTimeoutId = undefined;
  }

  function flush() {
    return timeoutId === undefined ? result : trailingEdge(Date.now());
  }

  function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timeoutId === undefined) {
        return leadingEdge(lastCallTime);
      }
      if (maxWait !== undefined) {
        timeoutId = setTimeout(timerExpired, delay);
        return invokeFunc(lastCallTime);
      }
    }
    if (timeoutId === undefined) {
      timeoutId = setTimeout(timerExpired, delay);
    }
    return result;
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  return debounced;
}

/**
 * Throttle function - limits execution to once per interval
 * @param {Function} func - Function to throttle
 * @param {number} delay - Minimum interval between calls
 * @param {Object} options - Configuration options
 * @returns {Function} Throttled function
 */
export function throttle(func, delay, options = {}) {
  const { leading = true, trailing = true } = options;
  return advancedDebounce(func, delay, {
    leading,
    trailing,
    maxWait: delay
  });
}

/**
 * Auto-save specific debouncer with smart batching
 */
export class AutoSaveDebouncer {
  constructor(saveFunction, options = {}) {
    this.saveFunction = saveFunction;
    this.delay = options.delay || 2000; // 2 seconds default
    this.maxWait = options.maxWait || 10000; // 10 seconds max wait
    this.batchSize = options.batchSize || 10;
    
    this.pendingChanges = new Map();
    this.isProcessing = false;
    
    this.debouncedSave = advancedDebounce(
      this.processPendingChanges.bind(this),
      this.delay,
      { 
        leading: false, 
        trailing: true, 
        maxWait: this.maxWait 
      }
    );
  }

  /**
   * Queue a change for auto-save
   * @param {string} key - Unique identifier for the change
   * @param {*} data - Data to save
   * @param {Object} metadata - Additional metadata
   */
  queueChange(key, data, metadata = {}) {
    this.pendingChanges.set(key, {
      data,
      metadata,
      timestamp: Date.now()
    });

    // Trigger debounced save
    this.debouncedSave();
  }

  /**
   * Process all pending changes
   */
  async processPendingChanges() {
    if (this.isProcessing || this.pendingChanges.size === 0) {
      return;
    }

    this.isProcessing = true;
    const changes = new Map(this.pendingChanges);
    this.pendingChanges.clear();

    try {
      // Process changes in batches
      const changeEntries = Array.from(changes.entries());
      const batches = this.createBatches(changeEntries, this.batchSize);

      for (const batch of batches) {
        await this.processBatch(batch);
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      // Re-queue failed changes
      for (const [key, change] of changes) {
        this.pendingChanges.set(key, change);
      }
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Create batches from changes
   */
  createBatches(changes, batchSize) {
    const batches = [];
    for (let i = 0; i < changes.length; i += batchSize) {
      batches.push(changes.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a single batch of changes
   */
  async processBatch(batch) {
    const promises = batch.map(([key, change]) => 
      this.saveFunction(key, change.data, change.metadata)
    );
    
    await Promise.all(promises);
  }

  /**
   * Force immediate save of all pending changes
   */
  async flush() {
    this.debouncedSave.cancel();
    await this.processPendingChanges();
  }

  /**
   * Cancel all pending saves
   */
  cancel() {
    this.debouncedSave.cancel();
    this.pendingChanges.clear();
  }

  /**
   * Get pending changes count
   */
  getPendingCount() {
    return this.pendingChanges.size;
  }

  /**
   * Check if currently processing
   */
  isCurrentlyProcessing() {
    return this.isProcessing;
  }
}

/**
 * Create a debounced version of an async function with error handling
 * @param {Function} asyncFunc - Async function to debounce
 * @param {number} delay - Debounce delay
 * @param {Object} options - Additional options
 * @returns {Function} Debounced async function
 */
export function debounceAsync(asyncFunc, delay, options = {}) {
  const { onError, onSuccess } = options;
  let currentPromise = null;

  const debouncedFunc = debounce(async (...args) => {
    try {
      const result = await asyncFunc(...args);
      if (onSuccess) onSuccess(result);
      return result;
    } catch (error) {
      if (onError) onError(error);
      throw error;
    }
  }, delay);

  return (...args) => {
    // Cancel previous promise if still pending
    if (currentPromise) {
      currentPromise.cancel?.();
    }

    currentPromise = debouncedFunc(...args);
    return currentPromise;
  };
}

const debounceUtils = {
  debounce,
  advancedDebounce,
  throttle,
  AutoSaveDebouncer,
  debounceAsync
};

export default debounceUtils;