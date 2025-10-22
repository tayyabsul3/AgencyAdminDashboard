/**
 * Audio Performance Monitor Component
 * Displays real-time audio performance metrics and optimization status
 */

import React, { useState, useEffect, useRef } from 'react';
import { audioManager } from '../../services/audioManager.js';
import { audioCacheService } from '../../services/audioCacheService.js';
import { speechOptimizationService } from '../../services/speechOptimizationService.js';
import styles from './AudioPerformanceMonitor.module.css';

const AudioPerformanceMonitor = ({ 
  isVisible = false, 
  onClose,
  showDetailedMetrics = false 
}) => {
  const [metrics, setMetrics] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isVisible) {
      // Start monitoring
      updateMetrics();
      intervalRef.current = setInterval(updateMetrics, 2000); // Update every 2 seconds
    } else {
      // Stop monitoring
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isVisible]);

  const updateMetrics = () => {
    try {
      const analytics = audioManager.getPerformanceAnalytics();
      const speechStats = speechOptimizationService.getPerformanceStats();
      
      setMetrics({
        ...analytics,
        speechOptimization: speechStats
      });
    } catch (error) {
      console.error('Error updating performance metrics:', error);
    }
  };

  const handleOptimizePerformance = async () => {
    setIsOptimizing(true);
    try {
      const result = audioManager.optimizePerformance();
      setRecommendations(result.recommendations);
      updateMetrics(); // Refresh metrics after optimization
    } catch (error) {
      console.error('Error optimizing performance:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleClearCache = () => {
    audioCacheService.clearCache();
    updateMetrics();
  };

  const handleResetMetrics = () => {
    speechOptimizationService.resetMetrics();
    updateMetrics();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'good':
      case 'healthy':
        return '#4CAF50';
      case 'poor':
      case 'warning':
        return '#FF9800';
      case 'failed':
      case 'critical':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (!isVisible || !metrics) {
    return null;
  }

  return (
    <div className={styles.performanceMonitor}>
      <div className={styles.header}>
        <h3>Audio Performance Monitor</h3>
        <button className={styles.closeButton} onClick={onClose}>×</button>
      </div>

      <div className={styles.content}>
        {/* Overall Status */}
        <div className={styles.section}>
          <h4>Overall Status</h4>
          <div className={styles.statusGrid}>
            <div className={styles.statusItem}>
              <span className={styles.label}>Audio Quality:</span>
              <span 
                className={styles.status}
                style={{ color: getStatusColor(metrics.audioManager.audioQuality.status) }}
              >
                {metrics.audioManager.audioQuality.status}
              </span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.label}>Cache Health:</span>
              <span 
                className={styles.status}
                style={{ color: getStatusColor(metrics.cache.health.status) }}
              >
                {metrics.cache.health.status}
              </span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.label}>Speech Recognition:</span>
              <span 
                className={styles.status}
                style={{ color: metrics.speechOptimization.isOptimized ? '#4CAF50' : '#FF9800' }}
              >
                {metrics.speechOptimization.isOptimized ? 'Optimized' : 'Basic'}
              </span>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className={styles.section}>
          <h4>Performance Metrics</h4>
          <div className={styles.metricsGrid}>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Average Latency</span>
              <span className={styles.metricValue}>
                {formatTime(metrics.audioManager.performance.averageLatency)}
              </span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Cache Hit Rate</span>
              <span className={styles.metricValue}>
                {metrics.cache.statistics.hitRate.toFixed(1)}%
              </span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Speech Success Rate</span>
              <span className={styles.metricValue}>
                {metrics.speechOptimization.successRate.toFixed(1)}%
              </span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Total Requests</span>
              <span className={styles.metricValue}>
                {metrics.audioManager.performance.totalRequests}
              </span>
            </div>
          </div>
        </div>

        {/* Cache Statistics */}
        <div className={styles.section}>
          <h4>Cache Statistics</h4>
          <div className={styles.cacheStats}>
            <div className={styles.statRow}>
              <span>Cache Size:</span>
              <span>{metrics.cache.statistics.cacheSize} / {metrics.cache.statistics.maxCacheSize}</span>
            </div>
            <div className={styles.statRow}>
              <span>Cache Hits:</span>
              <span>{metrics.cache.statistics.cacheHits}</span>
            </div>
            <div className={styles.statRow}>
              <span>Cache Misses:</span>
              <span>{metrics.cache.statistics.cacheMisses}</span>
            </div>
            <div className={styles.statRow}>
              <span>Preloaded Responses:</span>
              <span>{metrics.cache.statistics.preloadedResponses}</span>
            </div>
            <div className={styles.statRow}>
              <span>Compression Savings:</span>
              <span>{formatBytes(metrics.cache.statistics.compressionSavings * 1024)}</span>
            </div>
          </div>
        </div>

        {showDetailedMetrics && (
          <>
            {/* Speech Optimization */}
            <div className={styles.section}>
              <h4>Speech Optimization</h4>
              <div className={styles.speechStats}>
                <div className={styles.statRow}>
                  <span>Optimization Level:</span>
                  <span>{metrics.speechOptimization.optimizationLevel}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Average Response Time:</span>
                  <span>{formatTime(metrics.speechOptimization.averageResponseTime)}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Average Confidence:</span>
                  <span>{(metrics.speechOptimization.averageConfidence * 100).toFixed(1)}%</span>
                </div>
                <div className={styles.statRow}>
                  <span>Total Recognitions:</span>
                  <span>{metrics.speechOptimization.totalRecognitions}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Noise Reduction Savings:</span>
                  <span>{metrics.speechOptimization.noiseReductionSavings}</span>
                </div>
              </div>
            </div>

            {/* Audio Quality Details */}
            <div className={styles.section}>
              <h4>Audio Quality Details</h4>
              <div className={styles.qualityDetails}>
                <div className={styles.statRow}>
                  <span>Input Level:</span>
                  <span>{metrics.speechOptimization.audioQuality.inputLevel.toFixed(0)}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Signal-to-Noise Ratio:</span>
                  <span>{metrics.speechOptimization.audioQuality.signalToNoiseRatio.toFixed(1)}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Is Optimal:</span>
                  <span style={{ color: metrics.speechOptimization.audioQuality.isOptimal ? '#4CAF50' : '#FF9800' }}>
                    {metrics.speechOptimization.audioQuality.isOptimal ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className={styles.section}>
            <h4>Recommendations</h4>
            <ul className={styles.recommendations}>
              {recommendations.map((recommendation, index) => (
                <li key={index} className={styles.recommendation}>
                  {recommendation}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <button 
            className={styles.optimizeButton}
            onClick={handleOptimizePerformance}
            disabled={isOptimizing}
          >
            {isOptimizing ? 'Optimizing...' : 'Optimize Performance'}
          </button>
          <button 
            className={styles.clearCacheButton}
            onClick={handleClearCache}
          >
            Clear Cache
          </button>
          <button 
            className={styles.resetButton}
            onClick={handleResetMetrics}
          >
            Reset Metrics
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioPerformanceMonitor;