/**
 * Performance-optimized services that integrate all performance enhancements
 * Wraps existing services with caching, debouncing, batching, and compression
 */

import { questionCache, articleCache } from '../utils/cache';
import { batchWriteDocuments, batchSaveInterviewQuestions } from '../utils/batchOperations';
import { createInterviewAutoSaver, optimizedFetch } from '../config/performance';
import { geminiClient } from '../utils/connectionPool';

/**
 * Performance-optimized Gemini service
 */
export class OptimizedGeminiService {
  constructor() {
    this.client = geminiClient;
    this.requestCache = new Map();
    this.rateLimitDelay = 1000; // 1 second between requests
    this.lastRequestTime = 0;
  }

  /**
   * Generate intro questions with caching
   */
  async generateIntroQuestions(topic) {
    // Check cache first
    const cached = questionCache.getIntroQuestions(topic);
    if (cached) {
      console.log('Cache hit: intro questions for', topic);
      return cached;
    }

    // Rate limiting
    await this.enforceRateLimit();

    try {
      const prompt = `Generate 5 introductory interview questions for the topic: ${topic}. 
        Return as JSON array with objects containing 'id' and 'question' fields.`;

      const response = await this.client.generateContent('gemini-pro', prompt, {
        timeout: 60000 // 1 minute timeout for AI generation
      });

      const questions = this.parseGeminiResponse(response);
      
      // Cache the result
      questionCache.cacheIntroQuestions(topic, questions);
      
      return questions;
    } catch (error) {
      console.error('Failed to generate intro questions:', error);
      throw error;
    }
  }

  /**
   * Generate article questions with caching
   */
  async generateArticleQuestions(topic, questionCount, expertIntro) {
    // Check cache first
    const cached = questionCache.getArticleQuestions(topic, questionCount, expertIntro);
    if (cached) {
      console.log('Cache hit: article questions for', topic);
      return cached;
    }

    // Rate limiting
    await this.enforceRateLimit();

    try {
      const prompt = `Based on this expert introduction: "${JSON.stringify(expertIntro)}"
        Generate ${questionCount} follow-up interview questions about ${topic}.
        Return as JSON array with objects containing 'id' and 'question' fields.`;

      const response = await this.client.generateContent('gemini-pro', prompt, {
        timeout: 60000
      });

      const questions = this.parseGeminiResponse(response);
      
      // Cache the result
      questionCache.cacheArticleQuestions(topic, questionCount, expertIntro, questions);
      
      return questions;
    } catch (error) {
      console.error('Failed to generate article questions:', error);
      throw error;
    }
  }

  /**
   * Generate article with caching
   */
  async generateArticle(articleData) {
    // Check cache first
    const cached = articleCache.getGeneratedArticle(articleData);
    if (cached) {
      console.log('Cache hit: generated article');
      return cached;
    }

    // Rate limiting
    await this.enforceRateLimit();

    try {
      const prompt = `Create an article about ${articleData.topic} based on these interview responses:
        ${JSON.stringify(articleData.questions)}
        
        Format as a well-structured article with introduction, main content, and conclusion.`;

      const response = await this.client.generateContent('gemini-pro', prompt, {
        timeout: 90000 // 1.5 minutes for article generation
      });

      const article = this.parseGeminiResponse(response);
      
      // Cache the result
      articleCache.cacheGeneratedArticle(articleData, article);
      
      return article;
    } catch (error) {
      console.error('Failed to generate article:', error);
      throw error;
    }
  }

  /**
   * Enforce rate limiting
   */
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Parse Gemini API response
   */
  parseGeminiResponse(response) {
    try {
      // Extract text from Gemini response structure
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || response;
      
      // Try to parse as JSON first
      if (typeof text === 'string' && (text.trim().startsWith('[') || text.trim().startsWith('{'))) {
        return JSON.parse(text);
      }
      
      return text;
    } catch (error) {
      console.warn('Failed to parse Gemini response as JSON:', error);
      return response;
    }
  }
}

/**
 * Performance-optimized Article service
 */
export class OptimizedArticleService {
  constructor() {
    this.autoSaver = createInterviewAutoSaver(this.batchSaveArticles.bind(this));
  }

  /**
   * Get user articles with caching
   */
  async getUserArticles(userId) {
    // Check cache first
    const cached = articleCache.getUserArticles(userId);
    if (cached) {
      console.log('Cache hit: user articles for', userId);
      return cached;
    }

    try {
      const response = await optimizedFetch(`/api/articles?userId=${userId}`, {
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch articles: ${response.statusText}`);
      }

      const articles = await response.json();
      
      // Cache the result
      articleCache.cacheUserArticles(userId, articles);
      
      return articles;
    } catch (error) {
      console.error('Failed to get user articles:', error);
      throw error;
    }
  }

  /**
   * Save article with auto-save debouncing
   */
  async saveArticle(articleId, articleData, userId) {
    // Queue for auto-save (debounced)
    this.autoSaver.queueChange(articleId, {
      ...articleData,
      userId,
      updatedAt: new Date()
    });

    // Return immediately for better UX
    return { success: true, queued: true };
  }

  /**
   * Force save all pending articles
   */
  async flushPendingArticles() {
    await this.autoSaver.flush();
  }

  /**
   * Batch save articles (called by auto-saver)
   */
  async batchSaveArticles(articleId, articleData, metadata) {
    const operations = [{
      type: 'set',
      collection: 'articles',
      docId: articleId,
      data: articleData,
      options: { merge: true }
    }];

    return await batchWriteDocuments(operations);
  }

  /**
   * Delete article with cache invalidation
   */
  async deleteArticle(articleId, userId) {
    try {
      const response = await optimizedFetch(`/api/articles/${articleId}`, {
        method: 'DELETE',
        timeout: 15000
      });

      if (!response.ok) {
        throw new Error(`Failed to delete article: ${response.statusText}`);
      }

      // Invalidate cache
      articleCache.remove(`user-articles:${JSON.stringify({ userId })}`);
      
      return { success: true };
    } catch (error) {
      console.error('Failed to delete article:', error);
      throw error;
    }
  }
}

/**
 * Performance-optimized Interview service
 */
export class OptimizedInterviewService {
  constructor() {
    this.autoSaver = createInterviewAutoSaver(this.batchSaveInterviewData.bind(this));
    this.geminiService = new OptimizedGeminiService();
  }

  /**
   * Save interview questions with batching
   */
  async saveInterviewQuestions(interviewId, questions, metadata = {}) {
    try {
      return await batchSaveInterviewQuestions(interviewId, questions, metadata);
    } catch (error) {
      console.error('Failed to save interview questions:', error);
      throw error;
    }
  }

  /**
   * Auto-save interview progress
   */
  async autoSaveProgress(interviewId, progressData) {
    // Queue for auto-save (debounced)
    this.autoSaver.queueChange(interviewId, {
      ...progressData,
      lastSaved: new Date()
    });

    return { success: true, queued: true };
  }

  /**
   * Generate questions with caching
   */
  async generateQuestions(type, params) {
    switch (type) {
      case 'intro':
        return await this.geminiService.generateIntroQuestions(params.topic);
      case 'article':
        return await this.geminiService.generateArticleQuestions(
          params.topic,
          params.questionCount,
          params.expertIntro
        );
      default:
        throw new Error(`Unknown question type: ${type}`);
    }
  }

  /**
   * Generate article with caching
   */
  async generateArticle(articleData) {
    return await this.geminiService.generateArticle(articleData);
  }

  /**
   * Batch save interview data (called by auto-saver)
   */
  async batchSaveInterviewData(interviewId, interviewData, metadata) {
    const operations = [{
      type: 'set',
      collection: 'interviews',
      docId: interviewId,
      data: interviewData,
      options: { merge: true }
    }];

    return await batchWriteDocuments(operations);
  }

  /**
   * Get interview with caching
   */
  async getInterview(interviewId) {
    try {
      const response = await optimizedFetch(`/api/interviews/${interviewId}`, {
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch interview: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get interview:', error);
      throw error;
    }
  }

  /**
   * Flush all pending saves
   */
  async flushPendingSaves() {
    await this.autoSaver.flush();
  }

  /**
   * Get pending save count
   */
  getPendingSaveCount() {
    return this.autoSaver.getPendingCount();
  }
}

/**
 * Performance monitoring service
 */
export class PerformanceMonitoringService {
  constructor() {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      apiRequests: 0,
      batchOperations: 0,
      compressionSavings: 0
    };
  }

  /**
   * Record cache hit
   */
  recordCacheHit(cacheType) {
    this.metrics.cacheHits++;
    console.log(`Cache hit: ${cacheType}`);
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(cacheType) {
    this.metrics.cacheMisses++;
    console.log(`Cache miss: ${cacheType}`);
  }

  /**
   * Record API request
   */
  recordApiRequest(endpoint, responseTime) {
    this.metrics.apiRequests++;
    console.log(`API request: ${endpoint} (${responseTime}ms)`);
  }

  /**
   * Record batch operation
   */
  recordBatchOperation(operationCount) {
    this.metrics.batchOperations++;
    console.log(`Batch operation: ${operationCount} operations`);
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? this.metrics.cacheHits / totalCacheRequests : 0;

    return {
      ...this.metrics,
      cacheHitRate: (cacheHitRate * 100).toFixed(1) + '%',
      totalCacheRequests
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      apiRequests: 0,
      batchOperations: 0,
      compressionSavings: 0
    };
  }
}

// Export singleton instances
export const optimizedGeminiService = new OptimizedGeminiService();
export const optimizedArticleService = new OptimizedArticleService();
export const optimizedInterviewService = new OptimizedInterviewService();
export const performanceMonitoringService = new PerformanceMonitoringService();

const performanceOptimizedServices = {
  OptimizedGeminiService,
  OptimizedArticleService,
  OptimizedInterviewService,
  PerformanceMonitoringService,
  optimizedGeminiService,
  optimizedArticleService,
  optimizedInterviewService,
  performanceMonitoringService
};

export default performanceOptimizedServices;