/**
 * Usage Monitor for ElevenLabs API
 * Tracks usage statistics and provides monitoring data
 */

const { getFirestore } = require('./firebase-admin');

class UsageMonitor {
  constructor() {
    this.dailyUsage = new Map(); // date -> { requests, characters, errors }
    this.isEnabled = process.env.ELEVENLABS_USAGE_TRACKING_ENABLED === 'true';
  }

  /**
   * Record a successful API call
   */
  recordSuccess(userId, textLength, responseTime) {
    if (!this.isEnabled) return;

    const today = new Date().toISOString().split('T')[0];
    
    // Update daily usage
    if (!this.dailyUsage.has(today)) {
      this.dailyUsage.set(today, {
        requests: 0,
        characters: 0,
        errors: 0,
        totalResponseTime: 0,
        users: new Set()
      });
    }
    
    const dayUsage = this.dailyUsage.get(today);
    dayUsage.requests++;
    dayUsage.characters += textLength;
    dayUsage.totalResponseTime += responseTime;
    dayUsage.users.add(userId);

    // Log to Firebase Analytics (if available)
    this.logToFirestore({
      type: 'elevenlabs_success',
      userId,
      textLength,
      responseTime,
      timestamp: new Date()
    });
  }

  /**
   * Record an API error
   */
  recordError(userId, error, textLength = 0) {
    if (!this.isEnabled) return;

    const today = new Date().toISOString().split('T')[0];
    
    // Update daily usage
    if (!this.dailyUsage.has(today)) {
      this.dailyUsage.set(today, {
        requests: 0,
        characters: 0,
        errors: 0,
        totalResponseTime: 0,
        users: new Set()
      });
    }
    
    const dayUsage = this.dailyUsage.get(today);
    dayUsage.errors++;
    dayUsage.users.add(userId);

    // Log to Firebase Analytics
    this.logToFirestore({
      type: 'elevenlabs_error',
      userId,
      error: error.message || error,
      textLength,
      timestamp: new Date()
    });
  }

  /**
   * Get usage statistics
   */
  getUsageStats(days = 7) {
    const stats = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayUsage = this.dailyUsage.get(dateStr) || {
        requests: 0,
        characters: 0,
        errors: 0,
        totalResponseTime: 0,
        users: new Set()
      };
      
      stats.push({
        date: dateStr,
        requests: dayUsage.requests,
        characters: dayUsage.characters,
        errors: dayUsage.errors,
        averageResponseTime: dayUsage.requests > 0 ? dayUsage.totalResponseTime / dayUsage.requests : 0,
        uniqueUsers: dayUsage.users.size,
        errorRate: dayUsage.requests > 0 ? (dayUsage.errors / (dayUsage.requests + dayUsage.errors)) * 100 : 0
      });
    }
    
    return stats.reverse(); // Most recent first
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = this.dailyUsage.get(today) || {
      requests: 0,
      characters: 0,
      errors: 0,
      totalResponseTime: 0,
      users: new Set()
    };

    const totalRequests = todayUsage.requests + todayUsage.errors;
    const errorRate = totalRequests > 0 ? (todayUsage.errors / totalRequests) * 100 : 0;
    const avgResponseTime = todayUsage.requests > 0 ? todayUsage.totalResponseTime / todayUsage.requests : 0;

    // Determine health status
    let status = 'healthy';
    let issues = [];

    if (errorRate > 10) {
      status = 'degraded';
      issues.push(`High error rate: ${errorRate.toFixed(1)}%`);
    }

    if (avgResponseTime > 5000) {
      status = 'degraded';
      issues.push(`Slow response time: ${avgResponseTime.toFixed(0)}ms`);
    }

    if (errorRate > 25) {
      status = 'unhealthy';
    }

    return {
      status,
      issues,
      metrics: {
        todayRequests: todayUsage.requests,
        todayCharacters: todayUsage.characters,
        todayErrors: todayUsage.errors,
        errorRate: errorRate.toFixed(1),
        averageResponseTime: avgResponseTime.toFixed(0),
        uniqueUsers: todayUsage.users.size
      }
    };
  }

  /**
   * Log to Firestore for persistent tracking
   */
  async logToFirestore(data) {
    try {
      const db = getFirestore();
      await db.collection('elevenlabs_usage').add(data);
    } catch (error) {
      console.error('Failed to log usage to Firestore:', error);
    }
  }

  /**
   * Clean up old usage data
   */
  cleanup() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep 30 days
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    for (const [date] of this.dailyUsage.entries()) {
      if (date < cutoffStr) {
        this.dailyUsage.delete(date);
      }
    }
  }
}

// Singleton instance
const usageMonitor = new UsageMonitor();

// Cleanup old data daily
setInterval(() => usageMonitor.cleanup(), 24 * 60 * 60 * 1000);

module.exports = { usageMonitor };