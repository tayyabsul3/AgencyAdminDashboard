/**
 * React hook for performance optimizations
 * Provides easy access to caching, debouncing, and performance monitoring
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  optimizedGeminiService, 
  optimizedArticleService, 
  optimizedInterviewService,
  performanceMonitoringService 
} from '../services/performanceOptimizedServices';
import { createDebouncedSearch, createDebouncedValidation } from '../config/performance';
import { questionCache, articleCache } from '../utils/cache';

/**
 * Main performance optimizations hook
 */
export function usePerformanceOptimizations() {
  const [metrics, setMetrics] = useState(null);
  const [isOptimized, setIsOptimized] = useState(true);

  useEffect(() => {
    // Update metrics every 30 seconds
    const interval = setInterval(() => {
      const currentMetrics = performanceMonitoringService.getMetrics();
      setMetrics(currentMetrics);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const clearAllCaches = useCallback(() => {
    questionCache.clear();
    articleCache.clear();
    performanceMonitoringService.resetMetrics();
    setMetrics(performanceMonitoringService.getMetrics());
  }, []);

  const toggleOptimizations = useCallback(() => {
    setIsOptimized(prev => !prev);
  }, []);

  return {
    metrics,
    isOptimized,
    clearAllCaches,
    toggleOptimizations
  };
}

/**
 * Hook for cached Gemini operations
 */
export function useCachedGemini() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cache, setCache] = useState({
    hits: 0,
    misses: 0
  });

  const generateIntroQuestions = useCallback(async (topic) => {
    setLoading(true);
    setError(null);

    try {
      // Check if cached
      const cached = questionCache.getIntroQuestions(topic);
      if (cached) {
        setCache(prev => ({ ...prev, hits: prev.hits + 1 }));
        return cached;
      }

      setCache(prev => ({ ...prev, misses: prev.misses + 1 }));
      const questions = await optimizedGeminiService.generateIntroQuestions(topic);
      return questions;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateArticleQuestions = useCallback(async (topic, questionCount, expertIntro) => {
    setLoading(true);
    setError(null);

    try {
      // Check if cached
      const cached = questionCache.getArticleQuestions(topic, questionCount, expertIntro);
      if (cached) {
        setCache(prev => ({ ...prev, hits: prev.hits + 1 }));
        return cached;
      }

      setCache(prev => ({ ...prev, misses: prev.misses + 1 }));
      const questions = await optimizedGeminiService.generateArticleQuestions(topic, questionCount, expertIntro);
      return questions;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateArticle = useCallback(async (articleData) => {
    setLoading(true);
    setError(null);

    try {
      // Check if cached
      const cached = articleCache.getGeneratedArticle(articleData);
      if (cached) {
        setCache(prev => ({ ...prev, hits: prev.hits + 1 }));
        return cached;
      }

      setCache(prev => ({ ...prev, misses: prev.misses + 1 }));
      const article = await optimizedGeminiService.generateArticle(articleData);
      return article;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    cache,
    generateIntroQuestions,
    generateArticleQuestions,
    generateArticle
  };
}

/**
 * Hook for auto-save functionality
 */
export function useAutoSave(saveFunction, options = {}) {
  const { delay = 2000, maxWait = 10000 } = options;
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  
  const autoSaverRef = useRef(null);

  useEffect(() => {
    // Initialize auto-saver
    const { AutoSaveDebouncer } = require('../utils/debounce');
    
    autoSaverRef.current = new AutoSaveDebouncer(async (key, data, metadata) => {
      setIsSaving(true);
      try {
        await saveFunction(key, data, metadata);
        setLastSaved(new Date());
      } finally {
        setIsSaving(false);
      }
    }, { delay, maxWait });

    return () => {
      if (autoSaverRef.current) {
        autoSaverRef.current.cancel();
      }
    };
  }, [saveFunction, delay, maxWait]);

  const queueSave = useCallback((key, data, metadata) => {
    if (autoSaverRef.current) {
      autoSaverRef.current.queueChange(key, data, metadata);
      setPendingChanges(autoSaverRef.current.getPendingCount());
    }
  }, []);

  const flushSaves = useCallback(async () => {
    if (autoSaverRef.current) {
      await autoSaverRef.current.flush();
      setPendingChanges(0);
    }
  }, []);

  const cancelSaves = useCallback(() => {
    if (autoSaverRef.current) {
      autoSaverRef.current.cancel();
      setPendingChanges(0);
    }
  }, []);

  return {
    isSaving,
    lastSaved,
    pendingChanges,
    queueSave,
    flushSaves,
    cancelSaves
  };
}

/**
 * Hook for debounced search
 */
export function useDebouncedSearch(searchFunction, delay = 300) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const debouncedSearchRef = useRef(null);

  useEffect(() => {
    debouncedSearchRef.current = createDebouncedSearch(async (term) => {
      if (!term.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const searchResults = await searchFunction(term);
        setResults(searchResults);
      } catch (err) {
        setError(err.message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      if (debouncedSearchRef.current) {
        debouncedSearchRef.current.cancel();
      }
    };
  }, [searchFunction]);

  const search = useCallback((term) => {
    setSearchTerm(term);
    if (debouncedSearchRef.current) {
      debouncedSearchRef.current(term);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setResults([]);
    setError(null);
    if (debouncedSearchRef.current) {
      debouncedSearchRef.current.cancel();
    }
  }, []);

  return {
    searchTerm,
    results,
    loading,
    error,
    search,
    clearSearch
  };
}

/**
 * Hook for debounced validation
 */
export function useDebouncedValidation(validationFunction, delay = 500) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState(null);

  const debouncedValidateRef = useRef(null);

  useEffect(() => {
    debouncedValidateRef.current = createDebouncedValidation(async (value) => {
      setIsValidating(true);
      setError(null);

      try {
        const result = await validationFunction(value);
        setValidationResult(result);
      } catch (err) {
        setError(err.message);
        setValidationResult(null);
      } finally {
        setIsValidating(false);
      }
    });

    return () => {
      if (debouncedValidateRef.current) {
        debouncedValidateRef.current.cancel();
      }
    };
  }, [validationFunction]);

  const validate = useCallback((value) => {
    if (debouncedValidateRef.current) {
      debouncedValidateRef.current(value);
    }
  }, []);

  const clearValidation = useCallback(() => {
    setValidationResult(null);
    setError(null);
    if (debouncedValidateRef.current) {
      debouncedValidateRef.current.cancel();
    }
  }, []);

  return {
    isValidating,
    validationResult,
    error,
    validate,
    clearValidation
  };
}

/**
 * Hook for batch operations
 */
export function useBatchOperations() {
  const [batchQueue, setBatchQueue] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchStats, setBatchStats] = useState({
    totalBatches: 0,
    totalOperations: 0,
    errors: 0
  });

  const addToBatch = useCallback((operation) => {
    setBatchQueue(prev => [...prev, operation]);
  }, []);

  const processBatch = useCallback(async () => {
    if (batchQueue.length === 0 || isProcessing) return;

    setIsProcessing(true);

    try {
      const { batchWriteDocuments } = await import('../utils/batchOperations');
      const result = await batchWriteDocuments(batchQueue);
      
      setBatchStats(prev => ({
        totalBatches: prev.totalBatches + result.batches,
        totalOperations: prev.totalOperations + result.totalOperations,
        errors: prev.errors
      }));

      setBatchQueue([]);
      return result;
    } catch (error) {
      setBatchStats(prev => ({
        ...prev,
        errors: prev.errors + 1
      }));
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [batchQueue, isProcessing]);

  const clearBatch = useCallback(() => {
    setBatchQueue([]);
  }, []);

  return {
    batchQueue,
    queueSize: batchQueue.length,
    isProcessing,
    batchStats,
    addToBatch,
    processBatch,
    clearBatch
  };
}

/**
 * Hook for performance monitoring
 */
export function usePerformanceMonitoring() {
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const updateMetrics = () => {
      const currentMetrics = performanceMonitoringService.getMetrics();
      setMetrics(currentMetrics);

      // Check for performance alerts
      const newAlerts = [];
      
      if (currentMetrics.cacheHitRate < 50) {
        newAlerts.push({
          type: 'cache',
          message: `Low cache hit rate: ${currentMetrics.cacheHitRate}`,
          severity: 'warning'
        });
      }

      setAlerts(newAlerts);
    };

    // Update immediately
    updateMetrics();

    // Update every 30 seconds
    const interval = setInterval(updateMetrics, 30000);

    return () => clearInterval(interval);
  }, []);

  const resetMetrics = useCallback(() => {
    performanceMonitoringService.resetMetrics();
    setMetrics(performanceMonitoringService.getMetrics());
    setAlerts([]);
  }, []);

  return {
    metrics,
    alerts,
    resetMetrics
  };
}

export default {
  usePerformanceOptimizations,
  useCachedGemini,
  useAutoSave,
  useDebouncedSearch,
  useDebouncedValidation,
  useBatchOperations,
  usePerformanceMonitoring
};