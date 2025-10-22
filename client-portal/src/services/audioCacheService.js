/**
 * Audio Cache Service
 * Handles caching of audio generation for repeated phrases and performance optimization
 */

class AudioCacheService {
  constructor() {
    this.cache = new Map();
    this.compressionCache = new Map();
    this.preloadedResponses = new Map();
    this.maxCacheSize = 50; // Maximum number of cached audio items
    this.maxCacheAge = 30 * 60 * 1000; // 30 minutes in milliseconds
    this.compressionLevel = 0.8; // Audio compression quality (0.1 to 1.0)
    
    // Common AI responses for preloading
    this.commonResponses = [
      "Great! Let's move on to the next question.",
      "That's an excellent point. Can you tell me more about that?",
      "Thank you for sharing that. Let me ask you this:",
      "I understand. Could you elaborate on that?",
      "That's very interesting. What would you say is the most important aspect?",
      "Perfect. Now, let's talk about...",
      "I see. How did that experience shape your approach?",
      "That makes sense. What advice would you give to others?",
      "Excellent. Can you walk me through your process?",
      "Thank you. One more question about this topic:"
    ];
    
    // Performance metrics
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      averageGenerationTime: 0,
      averageCacheRetrievalTime: 0,
      compressionSavings: 0
    };
    
    // Initialize cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Generate cache key for audio content
   * @param {string} text - Text content
   * @param {Object} options - Voice synthesis options
   * @returns {string} Cache key
   */
  generateCacheKey(text, options = {}) {
    const normalizedText = text.trim().toLowerCase();
    const optionsKey = JSON.stringify({
      voiceId: options.voiceId || 'default',
      stability: options.stability || 0.75,
      similarity_boost: options.similarity_boost || 0.75,
      style: options.style || 0.5
    });
    
    return `${normalizedText}:${optionsKey}`;
  }

  /**
   * Check if audio is cached
   * @param {string} text - Text content
   * @param {Object} options - Voice synthesis options
   * @returns {boolean} Whether audio is cached
   */
  isCached(text, options = {}) {
    const key = this.generateCacheKey(text, options);
    const cached = this.cache.get(key);
    
    if (!cached) {
      return false;
    }
    
    // Check if cache entry is still valid
    const isExpired = Date.now() - cached.timestamp > this.maxCacheAge;
    if (isExpired) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Get cached audio
   * @param {string} text - Text content
   * @param {Object} options - Voice synthesis options
   * @returns {Promise<string|null>} Cached audio URL or null
   */
  async getCachedAudio(text, options = {}) {
    const startTime = Date.now();
    const key = this.generateCacheKey(text, options);
    const cached = this.cache.get(key);
    
    this.metrics.totalRequests++;
    
    if (!cached) {
      this.metrics.cacheMisses++;
      return null;
    }
    
    // Check if cache entry is still valid
    const isExpired = Date.now() - cached.timestamp > this.maxCacheAge;
    if (isExpired) {
      this.cache.delete(key);
      this.metrics.cacheMisses++;
      return null;
    }
    
    // Update cache hit metrics
    this.metrics.cacheHits++;
    const retrievalTime = Date.now() - startTime;
    this.updateAverageRetrievalTime(retrievalTime);
    
    // Create new blob URL from cached data
    const audioBlob = new Blob([cached.audioData], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    console.log(`Cache hit for "${text.substring(0, 50)}..." (${retrievalTime}ms)`);
    return audioUrl;
  }

  /**
   * Cache audio data
   * @param {string} text - Text content
   * @param {Object} options - Voice synthesis options
   * @param {ArrayBuffer} audioData - Audio data to cache
   * @param {number} generationTime - Time taken to generate audio
   */
  async cacheAudio(text, options = {}, audioData, generationTime = 0) {
    const key = this.generateCacheKey(text, options);
    
    // Compress audio data if needed
    const compressedData = await this.compressAudioData(audioData);
    const compressionSavings = audioData.byteLength - compressedData.byteLength;
    
    // Update compression savings metric
    this.metrics.compressionSavings += compressionSavings;
    
    // Create cache entry
    const cacheEntry = {
      text: text.substring(0, 100), // Store first 100 chars for debugging
      audioData: compressedData,
      originalSize: audioData.byteLength,
      compressedSize: compressedData.byteLength,
      timestamp: Date.now(),
      generationTime,
      accessCount: 0
    };
    
    // Ensure cache doesn't exceed max size
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestEntry();
    }
    
    this.cache.set(key, cacheEntry);
    this.updateAverageGenerationTime(generationTime);
    
    console.log(`Cached audio for "${text.substring(0, 50)}..." (${compressedData.byteLength} bytes, ${compressionSavings} bytes saved)`);
  }

  /**
   * Compress audio data for storage efficiency
   * @param {ArrayBuffer} audioData - Original audio data
   * @returns {Promise<ArrayBuffer>} Compressed audio data
   */
  async compressAudioData(audioData) {
    try {
      // For now, we'll use a simple approach - in a real implementation,
      // you might want to use Web Audio API for actual audio compression
      
      // Check if we already have this data compressed
      const dataHash = await this.hashArrayBuffer(audioData);
      const cached = this.compressionCache.get(dataHash);
      
      if (cached) {
        return cached;
      }
      
      // Simple compression simulation - in reality, you'd use proper audio compression
      // For now, we'll just return the original data
      const compressedData = audioData;
      
      // Cache the compression result
      this.compressionCache.set(dataHash, compressedData);
      
      return compressedData;
    } catch (error) {
      console.warn('Audio compression failed, using original data:', error);
      return audioData;
    }
  }

  /**
   * Generate hash for array buffer (for compression caching)
   * @param {ArrayBuffer} buffer - Buffer to hash
   * @returns {Promise<string>} Hash string
   */
  async hashArrayBuffer(buffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Preload common AI responses
   * @param {Function} synthesizeFunction - Function to synthesize speech
   * @param {Object} options - Voice synthesis options
   * @returns {Promise<void>}
   */
  async preloadCommonResponses(synthesizeFunction, options = {}) {
    console.log('Preloading common AI responses...');
    
    const preloadPromises = this.commonResponses.map(async (response, index) => {
      try {
        // Add small delay between requests to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, index * 200));
        
        // Check if already cached
        if (this.isCached(response, options)) {
          console.log(`Response already cached: "${response.substring(0, 30)}..."`);
          return;
        }
        
        // Generate and cache the response
        const startTime = Date.now();
        const audioBlob = await synthesizeFunction(response, options);
        const generationTime = Date.now() - startTime;
        
        // Convert blob to array buffer for caching
        const arrayBuffer = await audioBlob.arrayBuffer();
        await this.cacheAudio(response, options, arrayBuffer, generationTime);
        
        // Store in preloaded responses for quick access
        const audioUrl = URL.createObjectURL(audioBlob);
        this.preloadedResponses.set(response, audioUrl);
        
        console.log(`Preloaded: "${response.substring(0, 30)}..." (${generationTime}ms)`);
        
      } catch (error) {
        console.warn(`Failed to preload response: "${response.substring(0, 30)}..."`, error);
      }
    });
    
    try {
      await Promise.allSettled(preloadPromises);
      console.log(`Preloading completed. ${this.preloadedResponses.size} responses ready.`);
    } catch (error) {
      console.error('Error during preloading:', error);
    }
  }

  /**
   * Get preloaded response if available
   * @param {string} text - Text to look for
   * @returns {string|null} Preloaded audio URL or null
   */
  getPreloadedResponse(text) {
    const normalizedText = text.trim();
    
    // Check for exact match first
    if (this.preloadedResponses.has(normalizedText)) {
      return this.preloadedResponses.get(normalizedText);
    }
    
    // Check for partial matches with common responses
    for (const [preloadedText, audioUrl] of this.preloadedResponses) {
      if (normalizedText.includes(preloadedText) || preloadedText.includes(normalizedText)) {
        return audioUrl;
      }
    }
    
    return null;
  }

  /**
   * Evict oldest cache entry to make room for new ones
   */
  evictOldestEntry() {
    let oldestKey = null;
    let oldestTimestamp = Date.now();
    
    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      const evicted = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
      console.log(`Evicted cache entry: "${evicted.text}..." (age: ${Date.now() - evicted.timestamp}ms)`);
    }
  }

  /**
   * Update average generation time metric
   * @param {number} generationTime - Time taken to generate audio
   */
  updateAverageGenerationTime(generationTime) {
    const totalGenerations = this.metrics.cacheMisses;
    this.metrics.averageGenerationTime = 
      (this.metrics.averageGenerationTime * (totalGenerations - 1) + generationTime) / totalGenerations;
  }

  /**
   * Update average cache retrieval time metric
   * @param {number} retrievalTime - Time taken to retrieve from cache
   */
  updateAverageRetrievalTime(retrievalTime) {
    const totalHits = this.metrics.cacheHits;
    this.metrics.averageCacheRetrievalTime = 
      (this.metrics.averageCacheRetrievalTime * (totalHits - 1) + retrievalTime) / totalHits;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache performance metrics
   */
  getStatistics() {
    const hitRate = this.metrics.totalRequests > 0 
      ? (this.metrics.cacheHits / this.metrics.totalRequests) * 100 
      : 0;
    
    const totalCacheSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.compressedSize, 0);
    
    const totalOriginalSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.originalSize, 0);
    
    const compressionRatio = totalOriginalSize > 0 
      ? ((totalOriginalSize - totalCacheSize) / totalOriginalSize) * 100 
      : 0;
    
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      hitRate: Math.round(hitRate * 100) / 100,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      totalRequests: this.metrics.totalRequests,
      averageGenerationTime: Math.round(this.metrics.averageGenerationTime),
      averageCacheRetrievalTime: Math.round(this.metrics.averageCacheRetrievalTime),
      totalCacheSize: Math.round(totalCacheSize / 1024), // KB
      totalOriginalSize: Math.round(totalOriginalSize / 1024), // KB
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      compressionSavings: Math.round(this.metrics.compressionSavings / 1024), // KB
      preloadedResponses: this.preloadedResponses.size,
      cacheAge: this.maxCacheAge / 1000 / 60 // minutes
    };
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    const previousSize = this.cache.size;
    const previousPreloaded = this.preloadedResponses.size;
    
    // Revoke all preloaded URLs to prevent memory leaks
    for (const audioUrl of this.preloadedResponses.values()) {
      URL.revokeObjectURL(audioUrl);
    }
    
    this.cache.clear();
    this.compressionCache.clear();
    this.preloadedResponses.clear();
    
    // Reset metrics
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      averageGenerationTime: 0,
      averageCacheRetrievalTime: 0,
      compressionSavings: 0
    };
    
    console.log(`Cache cleared: ${previousSize} cached items, ${previousPreloaded} preloaded responses`);
  }

  /**
   * Start periodic cleanup of expired cache entries
   */
  startCleanupInterval() {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredEntries() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.maxCacheAge) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    // Clean up compression cache as well
    if (this.compressionCache.size > 100) {
      this.compressionCache.clear();
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Optimize cache for better performance
   */
  optimizeCache() {
    // Sort cache entries by access count and keep most accessed ones
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => b[1].accessCount - a[1].accessCount);
    
    // Keep only the most accessed entries if cache is full
    if (entries.length > this.maxCacheSize * 0.8) {
      const keepCount = Math.floor(this.maxCacheSize * 0.6);
      const toKeep = entries.slice(0, keepCount);
      
      this.cache.clear();
      toKeep.forEach(([key, entry]) => {
        this.cache.set(key, entry);
      });
      
      console.log(`Cache optimized: kept ${keepCount} most accessed entries`);
    }
  }

  /**
   * Export cache data for persistence
   * @returns {Object} Serializable cache data
   */
  exportCache() {
    const cacheData = {
      version: '1.0',
      timestamp: Date.now(),
      entries: [],
      metrics: this.metrics
    };
    
    for (const [key, entry] of this.cache) {
      cacheData.entries.push({
        key,
        text: entry.text,
        timestamp: entry.timestamp,
        generationTime: entry.generationTime,
        originalSize: entry.originalSize,
        compressedSize: entry.compressedSize,
        accessCount: entry.accessCount
        // Note: audioData is not exported due to size constraints
      });
    }
    
    return cacheData;
  }

  /**
   * Get cache health status
   * @returns {Object} Cache health information
   */
  getCacheHealth() {
    const stats = this.getStatistics();
    const health = {
      status: 'healthy',
      issues: [],
      recommendations: []
    };
    
    // Check hit rate
    if (stats.hitRate < 20) {
      health.status = 'warning';
      health.issues.push('Low cache hit rate');
      health.recommendations.push('Consider preloading more common responses');
    }
    
    // Check cache utilization
    const utilization = (stats.cacheSize / stats.maxCacheSize) * 100;
    if (utilization > 90) {
      health.status = 'warning';
      health.issues.push('Cache nearly full');
      health.recommendations.push('Consider increasing cache size or optimizing cache');
    }
    
    // Check average generation time
    if (stats.averageGenerationTime > 3000) {
      health.status = 'warning';
      health.issues.push('Slow audio generation');
      health.recommendations.push('Check network connection and API performance');
    }
    
    return {
      ...health,
      utilization: Math.round(utilization),
      stats
    };
  }
}

// Create singleton instance
export const audioCacheService = new AudioCacheService();
export default audioCacheService;