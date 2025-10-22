/**
 * Performance Metrics API Endpoint
 * Receives and processes performance metrics from the frontend
 */

import { validateEnvironment } from '../../../config/environment';

// Validate environment on startup
validateEnvironment();

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }
  
  try {
    const { metrics } = req.body;
    
    // Validate request data
    if (!metrics || !Array.isArray(metrics)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid metrics data format'
      });
    }
    
    // Process metrics in batches
    await processMetrics(metrics);
    
    res.status(200).json({
      success: true,
      processed: metrics.length
    });
    
  } catch (error) {
    console.error('Error processing metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process metrics'
    });
  }
}

async function processMetrics(metrics) {
  try {
    // Group metrics by type for efficient processing
    const groupedMetrics = groupMetricsByType(metrics);
    
    // Process each metric type
    for (const [type, typeMetrics] of Object.entries(groupedMetrics)) {
      await processMetricType(type, typeMetrics);
    }
    
  } catch (error) {
    console.error('Failed to process metrics:', error);
  }
}

function groupMetricsByType(metrics) {
  return metrics.reduce((groups, metric) => {
    const type = metric.type || 'unknown';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(metric);
    return groups;
  }, {});
}

async function processMetricType(type, metrics) {
  try {
    switch (type) {
      case 'api_response_time':
        await processApiMetrics(metrics);
        break;
      case 'database_query_time':
        await processDatabaseMetrics(metrics);
        break;
      case 'page_load_time':
        await processPageLoadMetrics(metrics);
        break;
      case 'user_interaction':
        await processUserInteractionMetrics(metrics);
        break;
      default:
        await processGenericMetrics(type, metrics);
    }
  } catch (error) {
    console.error(`Failed to process ${type} metrics:`, error);
  }
}

async function processApiMetrics(metrics) {
  // Calculate API performance statistics
  const stats = calculateApiStats(metrics);
  
  console.log('API Performance Stats:', stats);
  
  // In production, send to analytics service
  // Example: Google Analytics, Mixpanel, custom analytics
  
  // Alert on poor performance
  if (stats.averageResponseTime > 2000) {
    console.warn('API Performance Alert: Average response time exceeds 2s', stats);
    // Send alert to monitoring service
  }
}

async function processDatabaseMetrics(metrics) {
  const stats = calculateDatabaseStats(metrics);
  
  console.log('Database Performance Stats:', stats);
  
  // Alert on slow queries
  if (stats.averageQueryTime > 1000) {
    console.warn('Database Performance Alert: Average query time exceeds 1s', stats);
  }
}

async function processPageLoadMetrics(metrics) {
  const webVitalStats = calculateWebVitalStats(metrics);
  
  console.log('Core Web Vitals Stats:', webVitalStats);
  
  // Alert on poor Core Web Vitals
  const poorMetrics = Object.entries(webVitalStats)
    .filter(([_, stats]) => stats.poorCount > stats.goodCount);
  
  if (poorMetrics.length > 0) {
    console.warn('Core Web Vitals Alert: Poor performance detected', poorMetrics);
  }
}

async function processUserInteractionMetrics(metrics) {
  const interactionStats = calculateInteractionStats(metrics);
  
  console.log('User Interaction Stats:', interactionStats);
  
  // Track user engagement patterns
  // In production, send to user analytics service
}

async function processGenericMetrics(type, metrics) {
  console.log(`Generic metrics for ${type}:`, {
    count: metrics.length,
    timeRange: {
      start: Math.min(...metrics.map(m => m.timestamp)),
      end: Math.max(...metrics.map(m => m.timestamp))
    }
  });
}

function calculateApiStats(metrics) {
  const responseTimes = metrics.map(m => m.responseTime).filter(Boolean);
  const successCount = metrics.filter(m => m.success).length;
  
  return {
    totalRequests: metrics.length,
    successRate: (successCount / metrics.length) * 100,
    averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
    minResponseTime: Math.min(...responseTimes),
    maxResponseTime: Math.max(...responseTimes),
    endpointBreakdown: groupBy(metrics, 'endpoint')
  };
}

function calculateDatabaseStats(metrics) {
  const queryTimes = metrics.map(m => m.queryTime).filter(Boolean);
  
  return {
    totalQueries: metrics.length,
    averageQueryTime: queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length,
    minQueryTime: Math.min(...queryTimes),
    maxQueryTime: Math.max(...queryTimes),
    operationBreakdown: groupBy(metrics, 'operation'),
    collectionBreakdown: groupBy(metrics, 'collection')
  };
}

function calculateWebVitalStats(metrics) {
  const grouped = groupBy(metrics, 'name');
  const stats = {};
  
  for (const [name, nameMetrics] of Object.entries(grouped)) {
    const ratings = groupBy(nameMetrics, 'rating');
    stats[name] = {
      total: nameMetrics.length,
      goodCount: (ratings.good || []).length,
      needsImprovementCount: (ratings['needs-improvement'] || []).length,
      poorCount: (ratings.poor || []).length,
      averageValue: nameMetrics.reduce((sum, m) => sum + m.value, 0) / nameMetrics.length
    };
  }
  
  return stats;
}

function calculateInteractionStats(metrics) {
  return {
    totalInteractions: metrics.length,
    actionBreakdown: groupBy(metrics, 'action'),
    averageDuration: metrics
      .filter(m => m.duration)
      .reduce((sum, m) => sum + m.duration, 0) / metrics.filter(m => m.duration).length
  };
}

function groupBy(array, key) {
  return array.reduce((groups, item) => {
    const value = item[key] || 'unknown';
    if (!groups[value]) {
      groups[value] = [];
    }
    groups[value].push(item);
    return groups;
  }, {});
}