/**
 * Performance configuration for the interview backend integration
 * Centralizes all performance-related settings and optimizations
 */

import { compressionManager, timeoutManager, requestInterceptor } from '../utils/compression';
import { defaultPool, geminiClient } from '../utils/connectionPool';
import { questionCache, articleCache, generalCache } from '../utils/cache';
import { batchMonitor } from '../utils/batchOperations';
import { debounce, AutoSaveDebouncer } from '../utils/debounce';

/**
 * Performance configuration object
 */
export const performanceConfig = {
  // Cache settings
  cache: {
    enabled: true,
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    maxMemoryItems: 100,
    
    // Specific cache TTLs
    questions: {
      intro: 30 * 60 * 1000,    // 30 minutes
      article: 30 * 60 * 1000   // 30 minutes
    },
    
    articles: {
      generated: 60 * 60 * 1000, // 1 hour
      userList: 10 * 60 * 1000   // 10 minutes
    }
  },

  // Debouncing settings
  debounce: {
    autoSave: {
      delay: 2000,        // 2 seconds
      maxWait: 10000,     // 10 seconds max
      batchSize: 10       // Max items per batch
    },
    
    search: {
      delay: 300          // 300ms for search inputs
    },
    
    validation: {
      delay: 500          // 500ms for form validation
    }
  },

  // Connection pool settings
  connectionPool: {
    maxConnections: 10,
    maxRequestsPerConnection: 100,
    connectionTimeout: 30000,
    idleTimeout: 60000,
    retryAttempts: 3,
    retryDelay: 1000
  },

  // Compression settings
  compression: {
    enabled: true,
    threshold: 1024,    // 1KB minimum for compression
    format: 'gzip'
  },

  // Timeout settings
  timeouts: {
    geminiGenerate: 60000,    // 1 minute for AI generation
    firestoreRead: 10000,     // 10 seconds for reads
    firestoreWrite: 15000,    // 15 seconds for writes
    authOperation: 10000,     // 10 seconds for auth
    fileUpload: 30000,        // 30 seconds for uploads
    apiRequest: 15000         // 15 seconds for general API
  },

  // Batch operation settings
  batch: {
    maxBatchSize: 500,        // Firestore limit
    autoCommitThreshold: 100, // Auto-commit when batch reaches this size
    monitoringEnabled: true
  },

  // Performance monitoring
  monitoring: {
    enabled: true,
    metricsRetention: 100,    // Keep last 100 measurements
    alertThresholds: {
      responseTime: 5000,     // Alert if response > 5s
      errorRate: 0.1,         // Alert if error rate > 10%
      cacheHitRate: 0.5       // Alert if cache hit rate < 50%
    }
  }
};

/**
 * Performance optimization manager
 */
export class PerformanceOptimizer {
  constructor(config = performanceConfig) {
    this.config = config;
    this.metrics = {
      requests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      compressionSavings: 0,
      averageResponseTime: 0,
      errors: 0
    };
    
    this.initialize();
  }

  /**
   * Initialize performance optimizations
   */
  initialize() {
    // Configure caches
    this.configureCaches();
    
    // Configure connection pools
    this.configureConnectionPools();
    
    // Configure timeouts
    this.configureTimeouts();
    
    // Configure compression
    this.configureCompression();
    
    // Start monitoring
    if (this.config.monitoring.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Configure cache settings
   */
  configureCaches() {
    if (!this.config.cache.enabled) return;

    // Configure question cache
    questionCache.defaultTTL = this.config.cache.questions.intro;
    questionCache.maxMemoryItems = this.config.cache.maxMemoryItems;

    // Configure article cache
    articleCache.defaultTTL = this.config.cache.articles.generated;
    articleCache.maxMemoryItems = this.config.cache.maxMemoryItems;

    // Configure general cache
    generalCache.defaultTTL = this.config.cache.defaultTTL;
    generalCache.maxMemoryItems = this.config.cache.maxMemoryItems;
  }

  /**
   * Configure connection pools
   */
  configureConnectionPools() {
    const poolConfig = this.config.connectionPool;
    
    // Update default pool settings
    defaultPool.maxConnections = poolConfig.maxConnections;
    defaultPool.maxRequestsPerConnection = poolConfig.maxRequestsPerConnection;
    defaultPool.connectionTimeout = poolConfig.connectionTimeout;
    defaultPool.idleTimeout = poolConfig.idleTimeout;
    defaultPool.retryAttempts = poolConfig.retryAttempts;
    defaultPool.retryDelay = poolConfig.retryDelay;
  }

  /**
   * Configure timeout settings
   */
  configureTimeouts() {
    const timeouts = this.config.timeouts;
    
    for (const [operation, timeout] of Object.entries(timeouts)) {
      timeoutManager.setTimeout(operation, timeout);
    }
  }

  /**
   * Configure compression settings
   */
  configureCompression() {
    const compressionConfig = this.config.compression;
    
    requestInterceptor.enableCompression = compressionConfig.enabled;
    requestInterceptor.compressionThreshold = compressionConfig.threshold;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    // Monitor every 30 seconds
    setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
    }, 30000);
  }

  /**
   * Collect performance metrics
   */
  collectMetrics() {
    // Cache metrics
    const cacheStats = {
      question: questionCache.getStats(),
      article: articleCache.getStats(),
      general: generalCache.getStats()
    };

    // Connection pool metrics
    const poolStats = defaultPool.getStats();

    // Batch operation metrics
    const batchStats = batchMonitor.getMetrics();

    // Request interceptor metrics
    const requestStats = requestInterceptor.getPerformanceStats();

    // Update internal metrics
    this.updateMetrics({
      cache: cacheStats,
      pool: poolStats,
      batch: batchStats,
      requests: requestStats
    });
  }

  /**
   * Update internal metrics
   */
  updateMetrics(stats) {
    // Calculate cache hit rate
    const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? this.metrics.cacheHits / totalCacheRequests : 0;

    // Update metrics object
    this.metrics = {
      ...this.metrics,
      cacheHitRate,
      poolStats: stats.pool,
      batchStats: stats.batch,
      requestStats: stats.requests,
      lastUpdated: Date.now()
    };
  }

  /**
   * Check performance alerts
   */
  checkAlerts() {
    const thresholds = this.config.monitoring.alertThresholds;
    const alerts = [];

    // Check response time
    if (this.metrics.averageResponseTime > thresholds.responseTime) {
      alerts.push({
        type: 'response_time',
        message: `Average response time (${this.metrics.averageResponseTime}ms) exceeds threshold (${thresholds.responseTime}ms)`,
        severity: 'warning'
      });
    }

    // Check error rate
    const errorRate = this.metrics.requests > 0 ? this.metrics.errors / this.metrics.requests : 0;
    if (errorRate > thresholds.errorRate) {
      alerts.push({
        type: 'error_rate',
        message: `Error rate (${(errorRate * 100).toFixed(1)}%) exceeds threshold (${(thresholds.errorRate * 100).toFixed(1)}%)`,
        severity: 'error'
      });
    }

    // Check cache hit rate
    if (this.metrics.cacheHitRate < thresholds.cacheHitRate) {
      alerts.push({
        type: 'cache_hit_rate',
        message: `Cache hit rate (${(this.metrics.cacheHitRate * 100).toFixed(1)}%) below threshold (${(thresholds.cacheHitRate * 100).toFixed(1)}%)`,
        severity: 'info'
      });
    }

    // Log alerts
    alerts.forEach(alert => {
      console.warn(`Performance Alert [${alert.type}]:`, alert.message);
    });

    return alerts;
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      config: this.config,
      timestamp: Date.now()
    };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics() {
    this.metrics = {
      requests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      compressionSavings: 0,
      averageResponseTime: 0,
      errors: 0
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.initialize(); // Re-initialize with new config
  }
}

/**
 * Create auto-save debouncer for interview data
 */
export function createInterviewAutoSaver(saveFunction) {
  const config = performanceConfig.debounce.autoSave;
  
  return new AutoSaveDebouncer(saveFunction, {
    delay: config.delay,
    maxWait: config.maxWait,
    batchSize: config.batchSize
  });
}

/**
 * Create debounced search function
 */
export function createDebouncedSearch(searchFunction) {
  const delay = performanceConfig.debounce.search.delay;
  return debounce(searchFunction, delay);
}

/**
 * Create debounced validation function
 */
export function createDebouncedValidation(validationFunction) {
  const delay = performanceConfig.debounce.validation.delay;
  return debounce(validationFunction, delay);
}

/**
 * Performance-optimized fetch wrapper
 */
export async function optimizedFetch(url, options = {}) {
  const startTime = Date.now();
  
  try {
    // Use request interceptor for compression and timeout
    const response = await requestInterceptor.interceptRequest(url, options);
    
    // Update metrics
    performanceOptimizer.metrics.requests++;
    const responseTime = Date.now() - startTime;
    performanceOptimizer.updateResponseTime(responseTime);
    
    return response;
  } catch (error) {
    performanceOptimizer.metrics.errors++;
    throw error;
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();

// Initialize performance optimizations
performanceOptimizer.initialize();

export default {
  performanceConfig,
  PerformanceOptimizer,
  performanceOptimizer,
  createInterviewAutoSaver,
  createDebouncedSearch,
  createDebouncedValidation,
  optimizedFetch
};