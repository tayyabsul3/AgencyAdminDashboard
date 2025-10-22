/**
 * Enhanced Gemini Service with Error Handling and Fallback Support
 * Wraps the base Gemini service with comprehensive error handling, retry logic, and fallback content
 */

import * as baseGeminiService from './geminiService';
import { handleAsyncOperation, logError, ERROR_TYPES } from '../utils/errorHandler';

/**
 * Enhanced Gemini service wrapper with error handling
 */
class EnhancedGeminiService {
  constructor() {
    this.retryOptions = {
      maxRetries: 3,
      baseDelay: 2000, // Longer delay for AI API calls
      backoffMultiplier: 2,
      context: { component: 'GeminiService' }
    };
    
    this.fallbackEnabled = true;
    this.apiCallCount = 0;
    this.lastApiCall = null;
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
      component: 'GeminiService',
      operation: operationName,
      apiCallCount: ++this.apiCallCount,
      ...options.context
    };

    const enhancedOptions = {
      ...this.retryOptions,
      ...options,
      context,
      onError: (error, userError, attempt) => {
        logError(error, context);
        
        // Track API failures for monitoring
        this.trackApiFailure(operationName, error, attempt);
        
        if (options.onError) {
          options.onError(error, userError, attempt);
        }
      },
      onRetry: (error, attempt, maxRetries, delay) => {
        console.warn(`Retrying ${operationName} (${attempt}/${maxRetries}) in ${delay}ms`);
        if (options.onRetry) {
          options.onRetry(error, attempt, maxRetries, delay);
        }
      },
      shouldRetry: (error, attempt, maxRetries) => {
        // Custom retry logic for Gemini API
        if (attempt >= maxRetries) return false;
        
        const message = error.message?.toLowerCase() || '';
        
        // Don't retry quota exceeded errors immediately
        if (message.includes('quota') || message.includes('rate limit')) {
          return attempt < 2; // Only retry once for quota errors
        }
        
        // Don't retry authentication errors
        if (message.includes('authentication') || message.includes('api key')) {
          return false;
        }
        
        // Retry network and timeout errors
        return message.includes('network') || 
               message.includes('timeout') || 
               message.includes('fetch') ||
               message.includes('connection');
      }
    };

    this.lastApiCall = Date.now();
    return handleAsyncOperation(operation, enhancedOptions);
  }

  /**
   * Track API failures for monitoring and rate limiting
   */
  trackApiFailure(operation, error, attempt) {
    const failureData = {
      operation,
      error: error.message,
      attempt,
      timestamp: Date.now(),
      apiCallCount: this.apiCallCount
    };
    
    // Store in session storage for debugging
    if (typeof window !== 'undefined') {
      const failures = JSON.parse(sessionStorage.getItem('gemini_failures') || '[]');
      failures.push(failureData);
      
      // Keep only last 10 failures
      if (failures.length > 10) {
        failures.splice(0, failures.length - 10);
      }
      
      sessionStorage.setItem('gemini_failures', JSON.stringify(failures));
    }
  }

  /**
   * Generate introduction questions with enhanced error handling
   */
  async generateIntroQuestions(topic, options = {}) {
    const { brandVoice, ...otherOptions } = options;
    const operation = () => baseGeminiService.generateIntroQuestions(topic, { brandVoice });

    try {
      return await this.executeWithErrorHandling(
        operation,
        'generateIntroQuestions',
        {
          ...otherOptions,
          context: {
            topic,
            topicLength: topic.length,
            hasBrandVoice: !!brandVoice
          }
        }
      );
    } catch (error) {
      // If all retries failed and fallback is enabled, return fallback questions
      if (this.fallbackEnabled) {
        console.warn('Using fallback intro questions due to API failure');
        return this.getFallbackIntroQuestions(topic);
      }
      throw error;
    }
  }

  /**
   * Generate a replacement question for a specific position
   */
  async generateReplacementQuestion(topic, currentQuestion, allQuestions = [], options = {}) {
    const { brandVoice, ...otherOptions } = options;
    const operation = () => baseGeminiService.generateReplacementQuestion(topic, currentQuestion, allQuestions, { brandVoice });

    try {
      return await this.executeWithErrorHandling(
        operation,
        'generateReplacementQuestion',
        {
          ...otherOptions,
          context: {
            topic,
            currentQuestion,
            totalQuestions: allQuestions.length,
            hasBrandVoice: !!brandVoice
          }
        }
      );
    } catch (error) {
      // If all retries failed and fallback is enabled, return fallback replacement
      if (this.fallbackEnabled) {
        console.warn('Using fallback replacement question due to API failure');
        return this.getFallbackReplacementQuestion(topic, currentQuestion, allQuestions);
      }
      throw error;
    }
  }

  /**
   * Generate article questions with enhanced error handling
   */
  async generateArticleQuestions(topic, questionCount, expertIntro, options = {}) {
    const { brandVoice, ...otherOptions } = options;
    const operation = () => baseGeminiService.generateArticleQuestions(topic, questionCount, expertIntro, { brandVoice });
    
    try {
      return await this.executeWithErrorHandling(
        operation,
        'generateArticleQuestions',
        {
          ...otherOptions,
          context: {
            topic,
            questionCount,
            introAnswersCount: Object.keys(expertIntro).length / 2,
            hasBrandVoice: !!brandVoice
          }
        }
      );
    } catch (error) {
      // If all retries failed and fallback is enabled, return fallback questions
      if (this.fallbackEnabled) {
        console.warn('Using fallback article questions due to API failure');
        return this.getFallbackArticleQuestions(topic, questionCount);
      }
      throw error;
    }
  }

  /**
   * Generate final article with enhanced error handling
   */
  async generateFinalArticle(articleData, options = {}) {
    const { brandVoice, ...otherOptions } = options;
    const operation = () => baseGeminiService.generateFinalArticle(articleData, { brandVoice });
    
    const answeredQuestions = articleData.questions?.filter(q => q.answered) || [];
    
    try {
      return await this.executeWithErrorHandling(
        operation,
        'generateFinalArticle',
        {
          maxRetries: 2, // Fewer retries for complex operations
          baseDelay: 3000, // Longer delay for article generation
          ...otherOptions,
          context: {
            topic: articleData.topic,
            questionsCount: articleData.questions?.length || 0,
            answeredCount: answeredQuestions.length,
            totalAnswerLength: answeredQuestions.reduce((sum, q) => sum + (q.answer?.length || 0), 0),
            hasBrandVoice: !!brandVoice
          }
        }
      );
    } catch (error) {
      // If all retries failed and fallback is enabled, return fallback article
      if (this.fallbackEnabled) {
        console.warn('Using fallback article generation due to API failure');
        return this.getFallbackArticle(articleData);
      }
      throw error;
    }
  }

  /**
   * Get fallback introduction questions
   */
  getFallbackIntroQuestions(topic) {
    return [
      `What is your background and experience in ${topic}? How did you get started?`,
      `What specific qualifications, certifications, or achievements make you an expert in ${topic}?`,
      `Can you share a notable success story or project that demonstrates your expertise in ${topic}?`,
      `What unique perspective or approach do you bring to ${topic} that sets you apart?`,
      `Why are you passionate about sharing your knowledge on ${topic} with others?`
    ];
  }

  /**
   * Get fallback replacement question
   */
  getFallbackReplacementQuestion(topic, currentQuestion, allQuestions) {
    const fallbackOptions = [
      `What are the most important skills or knowledge areas in ${topic}?`,
      `How has ${topic} evolved in recent years, and what trends should people watch?`,
      `What common challenges do people face when learning ${topic}, and how can they overcome them?`,
      `What resources or tools would you recommend for someone starting with ${topic}?`,
      `How do you stay updated and continue learning in the field of ${topic}?`,
      `What are some practical applications or real-world examples of ${topic}?`,
      `What advice would you give to someone who wants to become proficient in ${topic}?`,
      `What are the biggest mistakes people make when approaching ${topic}?`
    ];

    // Filter out questions that are too similar to existing ones
    const availableOptions = fallbackOptions.filter(option => {
      return !allQuestions.some(existing =>
        this.calculateSimilarity(option, existing) > 0.7
      );
    });

    // Return a random available option, or the first one if all are used
    return availableOptions.length > 0
      ? availableOptions[Math.floor(Math.random() * availableOptions.length)]
      : fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
  }

  /**
   * Simple similarity calculation for fallback question filtering
   */
  calculateSimilarity(str1, str2) {
    const words1 = str1.toLowerCase().split(' ');
    const words2 = str2.toLowerCase().split(' ');
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  /**
   * Get fallback article questions
   */
  getFallbackArticleQuestions(topic, questionCount) {
    const sections = [
      {
        title: "Foundation and Basics",
        questions: [
          `What are the fundamental concepts everyone should know about ${topic}?`,
          `How would you define ${topic} to someone completely new to the field?`,
          `What are the most common misconceptions about ${topic}?`,
          `What prerequisites or background knowledge is helpful for ${topic}?`
        ]
      },
      {
        title: "Strategy and Implementation",
        questions: [
          `What's your recommended step-by-step approach for getting started with ${topic}?`,
          `What are the key strategies that consistently work best in ${topic}?`,
          `How do you implement ${topic} effectively in real-world scenarios?`,
          `What tools, resources, or frameworks do you recommend for ${topic}?`,
          `How do you measure success and track progress in ${topic}?`
        ]
      },
      {
        title: "Advanced Techniques and Optimization",
        questions: [
          `What advanced techniques separate experts from beginners in ${topic}?`,
          `How do you optimize and continuously improve results in ${topic}?`,
          `What are some lesser-known strategies or secrets in ${topic}?`,
          `How do you stay current with the latest developments in ${topic}?`
        ]
      },
      {
        title: "Common Mistakes and Troubleshooting",
        questions: [
          `What are the most common mistakes people make when starting with ${topic}?`,
          `How do you troubleshoot problems and overcome obstacles in ${topic}?`,
          `What warning signs should people watch out for in ${topic}?`,
          `How do you recover from failures or setbacks in ${topic}?`
        ]
      },
      {
        title: "Future Trends and Predictions",
        questions: [
          `Where do you see ${topic} heading in the next 2-3 years?`,
          `What emerging trends should people be aware of in ${topic}?`,
          `How should professionals prepare for the future of ${topic}?`
        ]
      }
    ];

    // Distribute questions across sections
    const questionsPerSection = Math.ceil(questionCount / sections.length);
    let questionId = 1;
    
    const result = sections.map(section => ({
      title: section.title,
      questions: section.questions.slice(0, questionsPerSection).map(question => ({
        id: questionId++,
        question
      }))
    }));

    // Trim to exact count if needed
    const allQuestions = result.flatMap(section => section.questions);
    if (allQuestions.length > questionCount) {
      // Remove excess questions from the end
      const excess = allQuestions.length - questionCount;
      result[result.length - 1].questions.splice(-excess);
    }

    return { sections: result };
  }

  /**
   * Get fallback article
   */
  getFallbackArticle(articleData) {
    const answeredQuestions = articleData.questions.filter(q => q.answered && q.answer.trim().length > 0);
    const topic = articleData.topic;
    
    const sections = [
      {
        type: "heading",
        level: 2,
        content: "Introduction"
      },
      {
        type: "paragraph",
        content: `This comprehensive guide on ${topic} is based on expert insights and practical experience. The following information has been compiled to help you understand and master the key concepts, strategies, and best practices in ${topic}.`
      }
    ];

    // Group questions by section and add them to the article
    const questionsBySection = {};
    answeredQuestions.forEach(q => {
      if (!questionsBySection[q.sectionTitle]) {
        questionsBySection[q.sectionTitle] = [];
      }
      questionsBySection[q.sectionTitle].push(q);
    });

    // Add sections with questions and answers
    Object.entries(questionsBySection).forEach(([sectionTitle, questions]) => {
      sections.push({
        type: "heading",
        level: 2,
        content: sectionTitle
      });

      questions.forEach(q => {
        sections.push({
          type: "heading",
          level: 3,
          content: q.question
        });
        sections.push({
          type: "paragraph",
          content: q.answer
        });
      });
    });

    // Add key takeaways
    sections.push({
      type: "heading",
      level: 2,
      content: "Key Takeaways"
    });

    const keyTakeaways = [
      `Understanding ${topic} requires both theoretical knowledge and practical application`,
      `Success in ${topic} comes from consistent implementation of proven strategies`,
      `Avoiding common pitfalls is crucial for achieving optimal results in ${topic}`,
      `Staying updated with industry trends helps maintain expertise in ${topic}`,
      `Expert guidance can significantly accelerate your learning curve in ${topic}`
    ];

    sections.push({
      type: "list",
      content: keyTakeaways
    });

    // Add conclusion
    sections.push({
      type: "heading",
      level: 2,
      content: "Conclusion"
    });

    sections.push({
      type: "paragraph",
      content: `Mastering ${topic} is a journey that requires dedication, practice, and continuous learning. By following the strategies and insights shared in this guide, you'll be well-equipped to achieve success in ${topic}. Remember to start with the fundamentals, apply proven techniques, and learn from both successes and failures along the way.`
    });

    return {
      metadata: {
        title: `Expert Guide: ${topic}`,
        description: `Comprehensive guide on ${topic} based on expert insights and practical experience`,
        keywords: [topic, 'expert guide', 'best practices', 'strategies'],
        readingTime: Math.ceil(answeredQuestions.length * 1.5),
        wordCount: answeredQuestions.reduce((sum, q) => sum + q.answer.split(' ').length, 0) + 200
      },
      title: `🎯 The Complete Guide to ${topic}`,
      sections,
      keyTakeaways,
      authorBio: articleData.setup?.expertIntro?.answer1 || 
                `An experienced professional in ${topic} with extensive practical knowledge and proven results.`
    };
  }

  /**
   * Check if Gemini service is available
   */
  async isServiceAvailable() {
    try {
      return await baseGeminiService.isGeminiServiceAvailable();
    } catch (error) {
      logError(error, { component: 'GeminiService', operation: 'isServiceAvailable' });
      return false;
    }
  }

  /**
   * Get service status and statistics
   */
  getServiceStatus() {
    const baseStatus = baseGeminiService.getServiceStatus();
    
    return {
      ...baseStatus,
      fallbackEnabled: this.fallbackEnabled,
      apiCallCount: this.apiCallCount,
      lastApiCall: this.lastApiCall,
      failures: typeof window !== 'undefined' ? 
        JSON.parse(sessionStorage.getItem('gemini_failures') || '[]') : []
    };
  }

  /**
   * Enable or disable fallback content
   */
  setFallbackEnabled(enabled) {
    this.fallbackEnabled = enabled;
  }

  /**
   * Reset API call statistics
   */
  resetStats() {
    this.apiCallCount = 0;
    this.lastApiCall = null;
    
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('gemini_failures');
    }
  }

  /**
   * Get API usage statistics
   */
  getUsageStats() {
    const failures = typeof window !== 'undefined' ? 
      JSON.parse(sessionStorage.getItem('gemini_failures') || '[]') : [];
    
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    const recentFailures = failures.filter(f => f.timestamp > last24Hours);
    
    return {
      totalApiCalls: this.apiCallCount,
      totalFailures: failures.length,
      recentFailures: recentFailures.length,
      lastApiCall: this.lastApiCall,
      successRate: this.apiCallCount > 0 ? 
        ((this.apiCallCount - failures.length) / this.apiCallCount * 100).toFixed(2) + '%' : 
        'N/A'
    };
  }
}

// Create singleton instance
const enhancedGeminiService = new EnhancedGeminiService();

// Export individual methods for backward compatibility
export const generateIntroQuestions = (topic, options = {}) =>
  enhancedGeminiService.generateIntroQuestions(topic, options);

export const generateReplacementQuestion = (topic, currentQuestion, allQuestions = [], options = {}) =>
  enhancedGeminiService.generateReplacementQuestion(topic, currentQuestion, allQuestions, options);

export const generateArticleQuestions = (topic, questionCount, expertIntro, options = {}) =>
  enhancedGeminiService.generateArticleQuestions(topic, questionCount, expertIntro, options);

export const generateFinalArticle = (articleData, options = {}) =>
  enhancedGeminiService.generateFinalArticle(articleData, options);

export const isGeminiServiceAvailable = () => 
  enhancedGeminiService.isServiceAvailable();

// Export service instance and utility methods
export const geminiServiceInstance = enhancedGeminiService;
export const getServiceStatus = () => enhancedGeminiService.getServiceStatus();
export const getUsageStats = () => enhancedGeminiService.getUsageStats();
export const setFallbackEnabled = (enabled) => enhancedGeminiService.setFallbackEnabled(enabled);
export const resetStats = () => enhancedGeminiService.resetStats();

export default enhancedGeminiService;