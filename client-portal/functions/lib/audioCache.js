/**
 * Audio Cache for ElevenLabs API
 * Caches generated audio to reduce API calls and improve performance
 */

const crypto = require('crypto');

class AudioCache {
  constructor() {
    this.cache = new Map(); // hash -> { audio: Buffer, timestamp: number, hits: number }
    this.isEnabled = process.env.ELEVENLABS_CACHE_ENABLED === 'true';
    this.ttlSeconds = parseInt(process.env.ELEVENLABS_CACHE_TTL_SECONDS) || 3600; // 1 hour default
    this.maxCacheSize = 100; // Maximum number of cached items
    
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Generate cache key for text and settings
   */
  generateCacheKey(text, voiceId, settings) {
    const cacheData = {
      text: text.trim().toLowerCase(),
      voiceId,
      settings: {
        stability: settings?.stability || 0.75,
        similarity_boost: settings?.similarity_boost || 0.75,
        style: settings?.style || 0.5,
        use_speaker_boost: settings?.use_speaker_boost || true
      }
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(cacheData))
      .digest('hex');
  }

  /**
   * Get cached audio if available
   */
  get(text, voiceId, settings) {
    if (!this.isEnabled) return null;

    const key = this.generateCacheKey(text, voiceId, settings);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if expired
    const now = Date.now();
    if (now - cached.timestamp > this.ttlSeconds * 1000) {
      this.cache.delete(key);
      return null;
    }
    
    // Update hit count and return audio
    cached.hits++;
    cached.lastAccessed = now;
    
    return {
      audio: cached.audio,
      fromCache: true,
      hits: cached.hits
    };
  }

  /**
   * Store audio in cache
   */
  set(text, voiceId, settings, audioBuffer) {
    if (!this.isEnabled) return;

    const key = this.generateCacheKey(text, voiceId, settings);
    const now = Date.now();
    
    // Check cache size limit
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLeastUsed();
    }
    
    this.cache.set(key, {
      audio: audioBuffer,
      timestamp: now,
      lastAccessed: now,
      hits: 0,
      textLength: text.length
    });
  }

  /**
   * Evict least recently used items
   */
  evictLeastUsed() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      if (value.lastAccessed < oldestTime) {
        oldestTime = value.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.ttlSeconds * 1000) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.cache.delete(key));
    
    console.log(`Audio cache cleanup: removed ${expiredKeys.length} expired entries, ${this.cache.size} remaining`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let totalHits = 0;
    let totalSize = 0;
    let expiredCount = 0;
    
    for (const [key, value] of this.cache.entries()) {
      totalHits += value.hits;
      totalSize += value.audio.length;
      
      if (now - value.timestamp > this.ttlSeconds * 1000) {
        expiredCount++;
      }
    }
    
    return {
      enabled: this.isEnabled,
      totalEntries: this.cache.size,
      expiredEntries: expiredCount,
      totalHits,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      hitRate: this.cache.size > 0 ? (totalHits / this.cache.size).toFixed(2) : 0,
      ttlSeconds: this.ttlSeconds,
      maxCacheSize: this.maxCacheSize
    };
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Singleton instance
const audioCache = new AudioCache();

module.exports = { audioCache };