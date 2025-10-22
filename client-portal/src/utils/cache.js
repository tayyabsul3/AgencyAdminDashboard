/**
 * Client-side caching utility for performance optimization
 * Provides memory and localStorage caching with TTL support
 */

class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    this.maxMemoryItems = 100;
  }

  /**
   * Generate cache key from parameters
   */
  generateKey(prefix, params) {
    const paramString = typeof params === 'object' 
      ? JSON.stringify(params, Object.keys(params).sort())
      : String(params);
    return `${prefix}:${paramString}`;
  }

  /**
   * Set item in memory cache with TTL
   */
  setMemory(key, data, ttl = this.defaultTTL) {
    // Clean up expired items if cache is getting full
    if (this.memoryCache.size >= this.maxMemoryItems) {
      this.cleanupExpired();
    }

    const item = {
      data,
      timestamp: Date.now(),
      ttl
    };

    this.memoryCache.set(key, item);
  }

  /**
   * Get item from memory cache
   */
  getMemory(key) {
    const item = this.memoryCache.get(key);
    
    if (!item) return null;
    
    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return item.data;
  }

  /**
   * Set item in localStorage with TTL
   */
  setStorage(key, data, ttl = this.defaultTTL) {
    try {
      const item = {
        data,
        timestamp: Date.now(),
        ttl
      };
      
      localStorage.setItem(`cache:${key}`, JSON.stringify(item));
    } catch (error) {
      console.warn('Failed to set localStorage cache:', error);
    }
  }

  /**
   * Get item from localStorage
   */
  getStorage(key) {
    try {
      const itemStr = localStorage.getItem(`cache:${key}`);
      if (!itemStr) return null;
      
      const item = JSON.parse(itemStr);
      
      // Check if expired
      if (Date.now() - item.timestamp > item.ttl) {
        localStorage.removeItem(`cache:${key}`);
        return null;
      }
      
      return item.data;
    } catch (error) {
      console.warn('Failed to get localStorage cache:', error);
      return null;
    }
  }

  /**
   * Get cached data with fallback chain: memory -> localStorage -> null
   */
  get(key) {
    // Try memory cache first
    let data = this.getMemory(key);
    if (data) return data;
    
    // Try localStorage
    data = this.getStorage(key);
    if (data) {
      // Promote to memory cache
      this.setMemory(key, data);
      return data;
    }
    
    return null;
  }

  /**
   * Set cached data in both memory and localStorage
   */
  set(key, data, ttl = this.defaultTTL) {
    this.setMemory(key, data, ttl);
    this.setStorage(key, data, ttl);
  }

  /**
   * Remove item from all caches
   */
  remove(key) {
    this.memoryCache.delete(key);
    try {
      localStorage.removeItem(`cache:${key}`);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  }

  /**
   * Clear all cached items
   */
  clear() {
    this.memoryCache.clear();
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('cache:')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear localStorage cache:', error);
    }
  }

  /**
   * Clean up expired items from memory cache
   */
  cleanupExpired() {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      memoryItems: this.memoryCache.size,
      maxMemoryItems: this.maxMemoryItems
    };
  }
}

// Specialized cache instances for different data types
class QuestionCache extends CacheManager {
  constructor() {
    super();
    this.defaultTTL = 30 * 60 * 1000; // 30 minutes for questions
  }

  cacheIntroQuestions(topic, questions) {
    const key = this.generateKey('intro-questions', { topic });
    this.set(key, questions);
  }

  getIntroQuestions(topic) {
    const key = this.generateKey('intro-questions', { topic });
    return this.get(key);
  }

  cacheArticleQuestions(topic, questionCount, expertIntro, questions) {
    const key = this.generateKey('article-questions', { 
      topic, 
      questionCount, 
      expertIntro: JSON.stringify(expertIntro) 
    });
    this.set(key, questions);
  }

  getArticleQuestions(topic, questionCount, expertIntro) {
    const key = this.generateKey('article-questions', { 
      topic, 
      questionCount, 
      expertIntro: JSON.stringify(expertIntro) 
    });
    return this.get(key);
  }
}

class ArticleCache extends CacheManager {
  constructor() {
    super();
    this.defaultTTL = 60 * 60 * 1000; // 1 hour for articles
  }

  cacheGeneratedArticle(articleData, generatedArticle) {
    const key = this.generateKey('generated-article', {
      topic: articleData.topic,
      questionsHash: this.hashQuestions(articleData.questions)
    });
    this.set(key, generatedArticle);
  }

  getGeneratedArticle(articleData) {
    const key = this.generateKey('generated-article', {
      topic: articleData.topic,
      questionsHash: this.hashQuestions(articleData.questions)
    });
    return this.get(key);
  }

  cacheUserArticles(userId, articles) {
    const key = this.generateKey('user-articles', { userId });
    this.set(key, articles, 10 * 60 * 1000); // 10 minutes for article lists
  }

  getUserArticles(userId) {
    const key = this.generateKey('user-articles', { userId });
    return this.get(key);
  }

  hashQuestions(questions) {
    // Simple hash of questions for cache key
    return questions
      .map(q => `${q.id}:${q.question}:${q.answer || ''}`)
      .join('|')
      .split('')
      .reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) & 0xffffffff, 0)
      .toString(36);
  }
}

// Export singleton instances
export const questionCache = new QuestionCache();
export const articleCache = new ArticleCache();
export const generalCache = new CacheManager();

export default CacheManager;