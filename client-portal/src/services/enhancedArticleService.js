/**
 * Enhanced Article Service with Error Handling and Offline Support
 * Wraps the base article service with comprehensive error handling, retry logic, and offline queue
 */

import * as baseArticleService from './articleService';
import { handleAsyncOperation, logError } from '../utils/errorHandler';

/**
 * Enhanced service wrapper with error handling
 */
class EnhancedArticleService {
  constructor() {
    this.retryOptions = {
      maxRetries: 3,
      baseDelay: 1000,
      context: { component: 'ArticleService' }
    };
  }

  /**
   * Execute operation with enhanced error handling
   * @param {Function} operation - The operation to execute
   * @param {string} operationName - Name of the operation for context
   * @param {Object} options - Additional options
   * @returns {Promise} - Operation result
   */
  async executeWithErrorHandling(operation, operationName, options = {}) {
    const context = {
      component: 'ArticleService',
      operation: operationName,
      ...options.context
    };

    const enhancedOptions = {
      ...this.retryOptions,
      ...options,
      context,
      onError: (error, userError, attempt) => {
        logError(error, context);
        if (options.onError) {
          options.onError(error, userError, attempt);
        }
      },
      onRetry: (error, attempt, maxRetries, delay) => {
        console.warn(`Retrying ${operationName} (${attempt}/${maxRetries}) in ${delay}ms`);
        if (options.onRetry) {
          options.onRetry(error, attempt, maxRetries, delay);
        }
      }
    };

    return handleAsyncOperation(operation, enhancedOptions);
  }

  /**
   * Execute operation with offline queue support
   * @param {Function} operation - The operation to execute
   * @param {string} operationName - Name of the operation
   * @param {Object} queueOptions - Queue-specific options
   * @returns {Promise} - Operation result or queue info
   */
  async executeWithQueue(operation, operationName, queueOptions = {}) {
    if (!this.offlineQueue) {
      // Fallback to regular execution if queue not initialized
      return this.executeWithErrorHandling(operation, operationName);
    }

    const metadata = {
      operation: operationName,
      timestamp: Date.now(),
      ...queueOptions.metadata
    };

    return this.offlineQueue.executeWithQueue(
      () => this.executeWithErrorHandling(operation, operationName),
      { ...queueOptions, metadata }
    );
  }

  /**
   * Create a new article with enhanced error handling
   */
  async createArticle(userId, setupData, options = {}) {
    const operation = () => baseArticleService.createArticle(userId, setupData);
    
    return this.executeWithQueue(
      operation,
      'createArticle',
      {
        ...options,
        metadata: {
          userId,
          topic: setupData.topic,
          questionCount: setupData.questionCount,
          hasBrandVoice: !!setupData.brandVoice
        }
      }
    );
  }

  /**
   * Save introduction data with enhanced error handling
   */
  async saveIntroData(userId, articleId, introData, options = {}) {
    const operation = () => baseArticleService.saveIntroData(userId, articleId, introData);
    
    return this.executeWithQueue(
      operation,
      'saveIntroData',
      {
        ...options,
        metadata: {
          userId,
          articleId,
          questionsCount: Object.keys(introData).length / 2
        }
      }
    );
  }

  /**
   * Save questions with enhanced error handling
   */
  async saveQuestions(userId, articleId, questions, options = {}) {
    const operation = () => baseArticleService.saveQuestions(userId, articleId, questions);
    
    return this.executeWithQueue(
      operation,
      'saveQuestions',
      {
        ...options,
        metadata: {
          userId,
          articleId,
          questionsCount: questions.length
        }
      }
    );
  }

  /**
   * Save answer with enhanced error handling and optimistic updates
   */
  async saveAnswer(userId, articleId, questionId, answer, options = {}) {
    const operation = () => baseArticleService.saveAnswer(userId, articleId, questionId, answer);
    
    // For auto-save operations, use more aggressive retry and queue settings
    const autoSaveOptions = {
      maxRetries: 5,
      baseDelay: 500,
      ...options,
      metadata: {
        userId,
        articleId,
        questionId,
        answerLength: answer.length,
        isAutoSave: true
      }
    };
    
    return this.executeWithQueue(
      operation,
      'saveAnswer',
      autoSaveOptions
    );
  }

  /**
   * Batch save answers with enhanced error handling
   */
  async batchSaveAnswers(userId, articleId, answers, options = {}) {
    const operation = () => baseArticleService.batchSaveAnswers(userId, articleId, answers);
    
    return this.executeWithQueue(
      operation,
      'batchSaveAnswers',
      {
        ...options,
        metadata: {
          userId,
          articleId,
          answersCount: answers.length
        }
      }
    );
  }

  /**
   * Save final article with enhanced error handling
   */
  async saveFinalArticle(userId, articleId, articleData, options = {}) {
    const operation = () => baseArticleService.saveFinalArticle(userId, articleId, articleData);
    
    return this.executeWithQueue(
      operation,
      'saveFinalArticle',
      {
        ...options,
        metadata: {
          userId,
          articleId,
          sectionsCount: articleData.sections?.length || 0,
          wordCount: articleData.metadata?.wordCount || 0,
          hasBrandVoice: !!articleData.brandVoice
        }
      }
    );
  }

  /**
   * Get article with enhanced error handling
   */
  async getArticle(userId, articleId, options = {}) {
    const operation = () => baseArticleService.getArticle(userId, articleId);
    
    // Read operations typically don't need queue support
    return this.executeWithErrorHandling(
      operation,
      'getArticle',
      {
        maxRetries: 2, // Fewer retries for read operations
        ...options,
        context: {
          userId,
          articleId
        }
      }
    );
  }

  /**
   * Get user articles with enhanced error handling
   */
  async getUserArticles(userId, options = {}) {
    const operation = () => baseArticleService.getUserArticles(userId);
    
    return this.executeWithErrorHandling(
      operation,
      'getUserArticles',
      {
        maxRetries: 2,
        ...options,
        context: {
          userId
        }
      }
    );
  }

  /**
   * Delete article with enhanced error handling
   */
  async deleteArticle(userId, articleId, options = {}) {
    const operation = () => baseArticleService.deleteArticle(userId, articleId);
    
    return this.executeWithQueue(
      operation,
      'deleteArticle',
      {
        ...options,
        metadata: {
          userId,
          articleId,
          isDelete: true
        }
      }
    );
  }

  /**
   * Get service health status
   */
  getServiceStatus() {
    return {
      available: true,
      offlineQueueEnabled: !!this.offlineQueue,
      queueSize: this.offlineQueue?.queueSize || 0,
      isOnline: this.offlineQueue?.isOnline ?? true,
      isProcessing: this.offlineQueue?.isProcessing || false
    };
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return this.offlineQueue?.getQueueStats() || {
      total: 0,
      pending: 0,
      failed: 0,
      processing: false
    };
  }

  /**
   * Clear offline queue
   */
  clearQueue() {
    if (this.offlineQueue) {
      this.offlineQueue.clearQueue();
    }
  }

  /**
   * Process pending queue items
   */
  processQueue() {
    if (this.offlineQueue) {
      return this.offlineQueue.processQueue();
    }
  }
}

// Create singleton instance
const enhancedArticleService = new EnhancedArticleService();

// Export individual methods for backward compatibility
export const createArticle = (userId, setupData, options) => 
  enhancedArticleService.createArticle(userId, setupData, options);

export const saveIntroData = (userId, articleId, introData, options) => 
  enhancedArticleService.saveIntroData(userId, articleId, introData, options);

export const saveQuestions = (userId, articleId, questions, options) => 
  enhancedArticleService.saveQuestions(userId, articleId, questions, options);

export const saveAnswer = (userId, articleId, questionId, answer, options) => 
  enhancedArticleService.saveAnswer(userId, articleId, questionId, answer, options);

export const batchSaveAnswers = (userId, articleId, answers, options) => 
  enhancedArticleService.batchSaveAnswers(userId, articleId, answers, options);

export const saveFinalArticle = (userId, articleId, articleData, options) => 
  enhancedArticleService.saveFinalArticle(userId, articleId, articleData, options);

export const getArticle = (userId, articleId, options) => 
  enhancedArticleService.getArticle(userId, articleId, options);

export const getUserArticles = (userId, options) => 
  enhancedArticleService.getUserArticles(userId, options);

export const deleteArticle = (userId, articleId, options) => 
  enhancedArticleService.deleteArticle(userId, articleId, options);

export const validateAndMigrateArticleData = baseArticleService.validateAndMigrateArticleData;

// Export service instance and utility methods
export const articleServiceInstance = enhancedArticleService;
export const initializeOfflineSupport = (options) => 
  enhancedArticleService.initializeOfflineSupport(options);
export const getServiceStatus = () => enhancedArticleService.getServiceStatus();
export const getQueueStats = () => enhancedArticleService.getQueueStats();
export const clearQueue = () => enhancedArticleService.clearQueue();
export const processQueue = () => enhancedArticleService.processQueue();

export default enhancedArticleService;