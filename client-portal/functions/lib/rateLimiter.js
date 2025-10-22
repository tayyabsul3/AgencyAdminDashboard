/**
 * Rate Limiter for ElevenLabs API
 * Implements sliding window rate limiting with usage tracking
 */

class RateLimiter {
  constructor() {
    this.requestCounts = new Map(); // userId -> { requests: [], characters: [] }
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }

  /**
   * Check if request is within rate limits
   */
  checkRateLimit(userId, textLength = 0) {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    
    // Get or create user tracking
    if (!this.requestCounts.has(userId)) {
      this.requestCounts.set(userId, { requests: [], characters: [] });
    }
    
    const userLimits = this.requestCounts.get(userId);
    
    // Remove old entries outside the window
    userLimits.requests = userLimits.requests.filter(timestamp => now - timestamp < windowMs);
    userLimits.characters = userLimits.characters.filter(entry => now - entry.timestamp < windowMs);
    
    // Get rate limits from environment
    const maxRequestsPerMinute = parseInt(process.env.ELEVENLABS_RATE_LIMIT_REQUESTS_PER_MINUTE) || 120;
    const maxCharactersPerMinute = parseInt(process.env.ELEVENLABS_RATE_LIMIT_CHARACTERS_PER_MINUTE) || 5000;
    
    // Check request count limit
    if (userLimits.requests.length >= maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: 'REQUEST_LIMIT_EXCEEDED',
        resetTime: Math.min(...userLimits.requests) + windowMs,
        limits: {
          requests: { current: userLimits.requests.length, max: maxRequestsPerMinute },
          characters: { 
            current: userLimits.characters.reduce((sum, entry) => sum + entry.count, 0), 
            max: maxCharactersPerMinute 
          }
        }
      };
    }
    
    // Check character count limit
    const currentCharacters = userLimits.characters.reduce((sum, entry) => sum + entry.count, 0);
    if (currentCharacters + textLength > maxCharactersPerMinute) {
      return {
        allowed: false,
        reason: 'CHARACTER_LIMIT_EXCEEDED',
        resetTime: Math.min(...userLimits.characters.map(e => e.timestamp)) + windowMs,
        limits: {
          requests: { current: userLimits.requests.length, max: maxRequestsPerMinute },
          characters: { current: currentCharacters, max: maxCharactersPerMinute }
        }
      };
    }
    
    // Record the request
    userLimits.requests.push(now);
    if (textLength > 0) {
      userLimits.characters.push({ timestamp: now, count: textLength });
    }
    
    return {
      allowed: true,
      limits: {
        requests: { current: userLimits.requests.length, max: maxRequestsPerMinute },
        characters: { current: currentCharacters + textLength, max: maxCharactersPerMinute }
      }
    };
  }

  /**
   * Get current usage for a user
   */
  getUsage(userId) {
    if (!this.requestCounts.has(userId)) {
      return { requests: 0, characters: 0 };
    }
    
    const now = Date.now();
    const windowMs = 60 * 1000;
    const userLimits = this.requestCounts.get(userId);
    
    // Filter to current window
    const recentRequests = userLimits.requests.filter(timestamp => now - timestamp < windowMs);
    const recentCharacters = userLimits.characters
      .filter(entry => now - entry.timestamp < windowMs)
      .reduce((sum, entry) => sum + entry.count, 0);
    
    return {
      requests: recentRequests.length,
      characters: recentCharacters
    };
  }

  /**
   * Clean up old entries
   */
  cleanup() {
    const now = Date.now();
    const windowMs = 60 * 1000;
    
    for (const [userId, limits] of this.requestCounts.entries()) {
      limits.requests = limits.requests.filter(timestamp => now - timestamp < windowMs);
      limits.characters = limits.characters.filter(entry => now - entry.timestamp < windowMs);
      
      // Remove empty entries
      if (limits.requests.length === 0 && limits.characters.length === 0) {
        this.requestCounts.delete(userId);
      }
    }
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

module.exports = { rateLimiter };