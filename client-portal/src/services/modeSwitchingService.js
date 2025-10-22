/**
 * Mode Switching Service
 * Handles seamless transitions between text and voice interview modes
 * Preserves all answered questions and progress when switching modes
 */

import { getArticle, saveAnswer, updateArticleStatus } from './articleService';

/**
 * Switch from voice mode to text mode
 * Preserves all answered questions and progress
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @param {Object} currentState - Current voice interview state
 * @param {number} currentState.currentQuestionIndex - Current question index
 * @param {Object} currentState.transcription - Current transcription data
 * @param {Array} currentState.questions - Current questions array
 * @returns {Promise<Object>} - Migration result with preserved data
 */
export const switchToTextMode = async (userId, articleId, currentState = {}) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  try {
    // Get current article data from database
    const articleData = await getArticle(userId, articleId);
    if (!articleData) {
      throw new Error('Article not found');
    }

    // Save any pending transcription as a text answer
    if (currentState.transcription && currentState.transcription.final && 
        currentState.currentQuestionIndex !== undefined) {
      
      const currentQuestion = articleData.questions[currentState.currentQuestionIndex];
      if (currentQuestion && currentState.transcription.final.trim().length > 0) {
        await saveAnswer(
          userId, 
          articleId, 
          currentQuestion.id, 
          currentState.transcription.final,
          {
            transcription: currentState.transcription.final,
            confidence: currentState.transcription.confidence || 0,
            audioUrl: null,
            suggestions: []
          }
        );
      }
    }

    // Get updated article data after saving pending answer
    const updatedArticleData = await getArticle(userId, articleId);

    // Prepare migration result
    const migrationResult = {
      success: true,
      mode: 'text',
      preservedData: {
        questions: updatedArticleData.questions,
        answeredCount: updatedArticleData.questions.filter(q => q.answered).length,
        totalQuestions: updatedArticleData.questions.length,
        progress: updatedArticleData.progress,
        currentQuestionIndex: currentState.currentQuestionIndex || 0
      },
      voiceDataPreserved: {
        hasVoiceResponses: updatedArticleData.hasVoiceResponses,
        voiceResponseCount: updatedArticleData.voiceResponseCount,
        transcriptionsPreserved: updatedArticleData.questions.filter(q => 
          q.voiceResponse && q.voiceResponse.transcription
        ).length
      },
      resumeUrl: `/dashboard/create/interview/questions?slug=${articleId}&topic=${encodeURIComponent(updatedArticleData.topic)}`
    };

    return migrationResult;

  } catch (error) {
    console.error('Error switching to text mode:', error);
    throw new Error(`Failed to switch to text mode: ${error.message}`);
  }
};

/**
 * Switch from text mode to voice mode
 * Preserves all answered questions and progress
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @param {Object} currentState - Current text interview state
 * @param {number} currentState.currentQuestionIndex - Current question index
 * @param {Object} currentState.answers - Current answers object
 * @param {Array} currentState.questions - Current questions array
 * @returns {Promise<Object>} - Migration result with preserved data
 */
export const switchToVoiceMode = async (userId, articleId, currentState = {}) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  try {
    // Get current article data from database
    const articleData = await getArticle(userId, articleId);
    if (!articleData) {
      throw new Error('Article not found');
    }

    // Save any pending text answers
    if (currentState.answers && Object.keys(currentState.answers).length > 0) {
      const savePromises = Object.entries(currentState.answers).map(([questionId, answer]) => {
        if (answer && answer.trim().length > 0) {
          return saveAnswer(userId, articleId, questionId, answer);
        }
        return Promise.resolve();
      });

      await Promise.all(savePromises);
    }

    // Get updated article data after saving pending answers
    const updatedArticleData = await getArticle(userId, articleId);

    // Check voice support
    const voiceSupported = checkVoiceSupport();

    // Prepare migration result
    const migrationResult = {
      success: true,
      mode: 'voice',
      voiceSupported,
      preservedData: {
        questions: updatedArticleData.questions,
        answeredCount: updatedArticleData.questions.filter(q => q.answered).length,
        totalQuestions: updatedArticleData.questions.length,
        progress: updatedArticleData.progress,
        currentQuestionIndex: currentState.currentQuestionIndex || 0
      },
      textDataPreserved: {
        textAnswersCount: updatedArticleData.questions.filter(q => 
          q.answered && (!q.voiceResponse || !q.voiceResponse.transcription)
        ).length,
        allAnswersPreserved: true
      },
      resumeUrl: `/dashboard/create/interview/voice?slug=${articleId}&topic=${encodeURIComponent(updatedArticleData.topic)}`,
      fallbackUrl: `/dashboard/create/interview/questions?slug=${articleId}&topic=${encodeURIComponent(updatedArticleData.topic)}`
    };

    // If voice is not supported, provide fallback information
    if (!voiceSupported) {
      migrationResult.success = false;
      migrationResult.error = 'Voice features not supported in this browser';
      migrationResult.fallbackRequired = true;
    }

    return migrationResult;

  } catch (error) {
    console.error('Error switching to voice mode:', error);
    throw new Error(`Failed to switch to voice mode: ${error.message}`);
  }
};

/**
 * Check if voice features are supported in the current browser
 * @returns {boolean} - Whether voice features are supported
 */
export const checkVoiceSupport = () => {
  if (typeof window === 'undefined') {
    return false; // Server-side rendering
  }

  const hasWebSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  const hasAudioContext = 'AudioContext' in window || 'webkitAudioContext' in window;
  
  return hasWebSpeech && hasAudioContext;
};

/**
 * Get resume information for an article
 * Determines the best mode and position to resume from
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @returns {Promise<Object>} - Resume information
 */
export const getResumeInfo = async (userId, articleId) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  try {
    const articleData = await getArticle(userId, articleId);
    if (!articleData) {
      throw new Error('Article not found');
    }

    const answeredQuestions = articleData.questions.filter(q => q.answered);
    const unansweredQuestions = articleData.questions.filter(q => !q.answered);
    
    // Find the first unanswered question
    const nextQuestionIndex = articleData.questions.findIndex(q => !q.answered);
    
    // Determine suggested mode based on previous responses
    const hasVoiceResponses = articleData.hasVoiceResponses;
    const hasTextResponses = answeredQuestions.some(q => 
      q.answered && (!q.voiceResponse || !q.voiceResponse.transcription)
    );

    let suggestedMode = 'text'; // Default to text mode
    if (hasVoiceResponses && !hasTextResponses) {
      suggestedMode = 'voice';
    } else if (hasVoiceResponses && hasTextResponses) {
      // Mixed mode - suggest the mode used for the most recent answer
      const lastAnsweredQuestion = answeredQuestions
        .filter(q => q.timestamp)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      
      if (lastAnsweredQuestion && lastAnsweredQuestion.voiceResponse && 
          lastAnsweredQuestion.voiceResponse.transcription) {
        suggestedMode = 'voice';
      }
    }

    const voiceSupported = checkVoiceSupport();

    return {
      canResume: unansweredQuestions.length > 0,
      progress: {
        answered: answeredQuestions.length,
        total: articleData.questions.length,
        percentage: articleData.progress
      },
      nextQuestionIndex: nextQuestionIndex >= 0 ? nextQuestionIndex : 0,
      suggestedMode: voiceSupported ? suggestedMode : 'text',
      availableModes: {
        text: true,
        voice: voiceSupported
      },
      responseHistory: {
        hasVoiceResponses,
        hasTextResponses,
        voiceResponseCount: articleData.voiceResponseCount,
        textResponseCount: answeredQuestions.length - articleData.voiceResponseCount
      },
      urls: {
        textMode: `/dashboard/create/interview/questions?slug=${articleId}&topic=${encodeURIComponent(articleData.topic)}`,
        voiceMode: voiceSupported ? 
          `/dashboard/create/interview/voice?slug=${articleId}&topic=${encodeURIComponent(articleData.topic)}` : 
          null
      }
    };

  } catch (error) {
    console.error('Error getting resume info:', error);
    throw new Error(`Failed to get resume info: ${error.message}`);
  }
};

/**
 * Validate mode switching compatibility
 * Ensures data integrity when switching between modes
 * @param {Object} articleData - Article data to validate
 * @param {string} targetMode - Target mode ('text' or 'voice')
 * @returns {Object} - Validation result
 */
export const validateModeSwitching = (articleData, targetMode) => {
  if (!articleData || !targetMode) {
    return {
      valid: false,
      error: 'Article data and target mode are required'
    };
  }

  if (!['text', 'voice'].includes(targetMode)) {
    return {
      valid: false,
      error: 'Target mode must be "text" or "voice"'
    };
  }

  // Check if questions exist
  if (!articleData.questions || articleData.questions.length === 0) {
    return {
      valid: false,
      error: 'No questions found in article'
    };
  }

  // Check voice support if switching to voice mode
  if (targetMode === 'voice' && !checkVoiceSupport()) {
    return {
      valid: false,
      error: 'Voice features not supported in this browser',
      fallbackAvailable: true
    };
  }

  // Validate question structure for compatibility
  const invalidQuestions = articleData.questions.filter(q => 
    !q.id || !q.question || typeof q.question !== 'string'
  );

  if (invalidQuestions.length > 0) {
    return {
      valid: false,
      error: `${invalidQuestions.length} questions have invalid structure`,
      details: invalidQuestions.map(q => q.id || 'unknown')
    };
  }

  return {
    valid: true,
    preservedAnswers: articleData.questions.filter(q => q.answered).length,
    totalQuestions: articleData.questions.length,
    dataIntegrityCheck: 'passed'
  };
};

/**
 * Create a mode switching session
 * Tracks the switching process for error recovery
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @param {string} fromMode - Source mode
 * @param {string} toMode - Target mode
 * @param {Object} currentState - Current interview state
 * @returns {Object} - Session information
 */
export const createModeSwitchingSession = (userId, articleId, fromMode, toMode, currentState) => {
  const sessionId = `${userId}-${articleId}-${Date.now()}`;
  
  const session = {
    id: sessionId,
    userId,
    articleId,
    fromMode,
    toMode,
    timestamp: new Date(),
    currentState: {
      currentQuestionIndex: currentState.currentQuestionIndex || 0,
      pendingData: currentState.pendingData || {},
      progress: currentState.progress || 0
    },
    status: 'initiated'
  };

  // Store session in sessionStorage for recovery
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`mode-switch-${sessionId}`, JSON.stringify(session));
    } catch (error) {
      console.warn('Could not store mode switching session:', error);
    }
  }

  return session;
};

/**
 * Complete a mode switching session
 * Cleans up session data after successful switch
 * @param {string} sessionId - Session ID
 * @returns {void}
 */
export const completeModeSwitchingSession = (sessionId) => {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(`mode-switch-${sessionId}`);
    } catch (error) {
      console.warn('Could not remove mode switching session:', error);
    }
  }
};

/**
 * Recover from a failed mode switch
 * Attempts to restore previous state
 * @param {string} sessionId - Session ID
 * @returns {Object|null} - Recovered session data or null
 */
export const recoverModeSwitchingSession = (sessionId) => {
  if (typeof window !== 'undefined') {
    try {
      const sessionData = sessionStorage.getItem(`mode-switch-${sessionId}`);
      if (sessionData) {
        return JSON.parse(sessionData);
      }
    } catch (error) {
      console.warn('Could not recover mode switching session:', error);
    }
  }
  return null;
};