/**
 * Production Monitoring and Error Logging
 * Handles error reporting, performance monitoring, and usage analytics
 */

import { ENV, FEATURES } from '../config/environment';

// Error severity levels
export const ERROR_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Performance metrics types
export const METRIC_TYPES = {
  API_RESPONSE_TIME: 'api_response_time',
  DATABASE_QUERY_TIME: 'database_query_time',
  PAGE_LOAD_TIME: 'page_load_time',
  USER_INTERACTION: 'user_interaction',
  ERROR_RATE: 'error_rate'
};

class MonitoringService {
  constructor() {
    this.isEnabled = FEATURES.enableErrorReporting;
    this.performanceEnabled = FEATURES.enablePerformanceMonitoring;
    this.sessionId = this.generateSessionId();
    this.errorQueue = [];
    this.metricsQueue = [];
    this.flushInterval = null;
    this.isClient = typeof window !== 'undefined';
    
    if (this.isEnabled && this.isClient) {
      this.initializeMonitoring();
    }
  }
  
  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  initializeMonitoring() {
    // Only initialize on client side
    if (!this.isClient) return;
    
    // Set up periodic flushing of queued data
    this.flushInterval = setInterval(() => {
      this.flushQueues();
    }, 30000); // Flush every 30 seconds
    
    // Set up global error handlers
    window.addEventListener('error', this.handleGlobalError.bind(this));
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    
    // Performance observer for Core Web Vitals
    if (this.performanceEnabled && 'PerformanceObserver' in window) {
      this.setupPerformanceObserver();
    }
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      this.flushQueues();
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
      }
    });
  }
  
  setupPerformanceObserver() {
    try {
      // Observe Core Web Vitals
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric(METRIC_TYPES.PAGE_LOAD_TIME, {
            name: entry.name,
            value: entry.value,
            rating: this.getWebVitalRating(entry.name, entry.value),
            timestamp: Date.now()
          });
        }
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
    } catch (error) {
      console.warn('Performance observer not supported:', error);
    }
  }
  
  getWebVitalRating(metric, value) {
    const thresholds = {
      'largest-contentful-paint': { good: 2500, poor: 4000 },
      'first-input': { good: 100, poor: 300 },
      'layout-shift': { good: 0.1, poor: 0.25 }
    };
    
    const threshold = thresholds[metric];
    if (!threshold) return 'unknown';
    
    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }
  
  // Error logging methods
  logError(error, context = {}, severity = ERROR_LEVELS.MEDIUM) {
    if (!this.isEnabled) return;
    
    const errorData = {
      message: error.message || 'Unknown error',
      stack: error.stack,
      name: error.name,
      severity,
      context,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      userId: context.userId || null
    };
    
    // Add to queue for batch processing
    this.errorQueue.push(errorData);
    
    // For critical errors, flush immediately
    if (severity === ERROR_LEVELS.CRITICAL) {
      this.flushQueues();
    }
    
    // Log to console in development
    if (ENV.NODE_ENV === 'development') {
      console.error('Monitored Error:', errorData);
    }
  }
  
  logApiError(endpoint, error, requestData = {}, responseTime = null) {
    this.logError(error, {
      type: 'api_error',
      endpoint,
      requestData: this.sanitizeData(requestData),
      responseTime,
      method: requestData.method || 'unknown'
    }, ERROR_LEVELS.HIGH);
  }
  
  logDatabaseError(operation, error, collection = null) {
    this.logError(error, {
      type: 'database_error',
      operation,
      collection
    }, ERROR_LEVELS.HIGH);
  }
  
  logAuthError(error, context = {}) {
    this.logError(error, {
      type: 'auth_error',
      ...context
    }, ERROR_LEVELS.HIGH);
  }
  
  // Performance monitoring methods
  recordMetric(type, data) {
    if (!this.performanceEnabled) return;
    
    const metricData = {
      type,
      ...data,
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    
    this.metricsQueue.push(metricData);
    
    // Log to console in development
    if (ENV.NODE_ENV === 'development') {
      console.log('Performance Metric:', metricData);
    }
  }
  
  recordApiResponseTime(endpoint, responseTime, success = true) {
    this.recordMetric(METRIC_TYPES.API_RESPONSE_TIME, {
      endpoint,
      responseTime,
      success,
      rating: this.getResponseTimeRating(responseTime)
    });
  }
  
  recordDatabaseQueryTime(operation, queryTime, collection = null) {
    this.recordMetric(METRIC_TYPES.DATABASE_QUERY_TIME, {
      operation,
      queryTime,
      collection,
      rating: this.getQueryTimeRating(queryTime)
    });
  }
  
  recordUserInteraction(action, element = null, duration = null) {
    this.recordMetric(METRIC_TYPES.USER_INTERACTION, {
      action,
      element,
      duration
    });
  }
  
  getResponseTimeRating(time) {
    if (time < 200) return 'excellent';
    if (time < 500) return 'good';
    if (time < 1000) return 'fair';
    return 'poor';
  }
  
  getQueryTimeRating(time) {
    if (time < 100) return 'excellent';
    if (time < 300) return 'good';
    if (time < 1000) return 'fair';
    return 'poor';
  }
  
  // Global error handlers
  handleGlobalError(event) {
    this.logError(new Error(event.message), {
      type: 'global_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    }, ERROR_LEVELS.HIGH);
  }
  
  handleUnhandledRejection(event) {
    this.logError(new Error(event.reason), {
      type: 'unhandled_rejection'
    }, ERROR_LEVELS.HIGH);
  }
  
  // Data sanitization
  sanitizeData(data) {
    if (!data || typeof data !== 'object') return data;
    
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'key'];
    const sanitized = { ...data };
    
    for (const key in sanitized) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  // Queue management
  async flushQueues() {
    if (this.errorQueue.length > 0) {
      await this.sendErrors([...this.errorQueue]);
      this.errorQueue = [];
    }
    
    if (this.metricsQueue.length > 0) {
      await this.sendMetrics([...this.metricsQueue]);
      this.metricsQueue = [];
    }
  }
  
  async sendErrors(errors) {
    // Only send from client side
    if (!this.isClient) return;
    
    try {
      // In production, send to your error reporting service
      // For now, we'll use a simple API endpoint
      await fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ errors })
      });
    } catch (error) {
      console.error('Failed to send error reports:', error);
    }
  }
  
  async sendMetrics(metrics) {
    // Only send from client side
    if (!this.isClient) return;
    
    try {
      // In production, send to your analytics service
      await fetch('/api/monitoring/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ metrics })
      });
    } catch (error) {
      console.error('Failed to send metrics:', error);
    }
  }
  
  // Utility methods
  startTimer(label) {
    const startTime = this.isClient ? performance.now() : Date.now();
    return {
      end: () => this.isClient ? performance.now() - startTime : Date.now() - startTime,
      label
    };
  }
  
  // Health check
  getHealthStatus() {
    return {
      monitoring: this.isEnabled,
      performance: this.performanceEnabled,
      sessionId: this.sessionId,
      queueSizes: {
        errors: this.errorQueue.length,
        metrics: this.metricsQueue.length
      }
    };
  }
}

// Create singleton instance
const monitoring = new MonitoringService();

// Export convenience methods
export const logError = (error, context, severity) => monitoring.logError(error, context, severity);
export const logApiError = (endpoint, error, requestData, responseTime) => monitoring.logApiError(endpoint, error, requestData, responseTime);
export const logDatabaseError = (operation, error, collection) => monitoring.logDatabaseError(operation, error, collection);
export const logAuthError = (error, context) => monitoring.logAuthError(error, context);
export const recordMetric = (type, data) => monitoring.recordMetric(type, data);
export const recordApiResponseTime = (endpoint, responseTime, success) => monitoring.recordApiResponseTime(endpoint, responseTime, success);
export const recordDatabaseQueryTime = (operation, queryTime, collection) => monitoring.recordDatabaseQueryTime(operation, queryTime, collection);
export const recordUserInteraction = (action, element, duration) => monitoring.recordUserInteraction(action, element, duration);
export const startTimer = (label) => monitoring.startTimer(label);
export const getHealthStatus = () => monitoring.getHealthStatus();

export default monitoring;