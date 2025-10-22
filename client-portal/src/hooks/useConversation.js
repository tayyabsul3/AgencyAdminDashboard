/**
 * React Hook for Voice Interview Conversation Management
 * Integrates conversation service with React components
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import conversationManager from '../services/conversationService';

/**
 * Custom hook for managing voice interview conversations
 * @param {Array} questions - Array of interview questions
 * @param {Function} onQuestionComplete - Callback when a question is completed
 * @param {Function} onInterviewComplete - Callback when interview is completed
 * @returns {Object} - Conversation management functions and state
 */
export const useConversation = (questions = [], onQuestionComplete, onInterviewComplete) => {
  const [conversationState, setConversationState] = useState({
    currentQuestion: 0,
    isWaitingForResponse: false,
    lastAIResponse: '',
    conversationType: 'transition',
    canFollowUp: true,
    responseAnalysis: null,
    isComplete: false
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const initialized = useRef(false);

  // Initialize conversation when questions are available
  useEffect(() => {
    if (questions.length > 0 && !initialized.current) {
      conversationManager.initializeConversation(questions);
      initialized.current = true;
      
      setConversationState(prev => ({
        ...prev,
        currentQuestion: 0,
        isComplete: false
      }));
    }
  }, [questions]);

  /**
   * Process user response and generate AI conversation response
   * @param {string} userResponse - User's spoken/typed response
   * @param {Object} additionalContext - Additional context for the conversation
   * @returns {Promise<Object>} - AI response object
   */
  const processUserResponse = useCallback(async (userResponse, additionalContext = {}) => {
    if (!userResponse || !userResponse.trim()) {
      throw new Error('User response is required');
    }

    if (conversationState.currentQuestion >= questions.length) {
      throw new Error('Interview is already complete');
    }

    setIsProcessing(true);
    setError(null);

    try {
      const currentQuestion = questions[conversationState.currentQuestion];
      
      // Generate conversational response
      const aiResponse = await conversationManager.generateResponse(
        currentQuestion.question,
        userResponse.trim(),
        additionalContext
      );

      // Update local state
      setConversationState(prev => ({
        ...prev,
        lastAIResponse: aiResponse.response,
        conversationType: aiResponse.conversationType,
        canFollowUp: aiResponse.conversationState.canFollowUp,
        responseAnalysis: aiResponse.conversationState.responseAnalysis,
        isWaitingForResponse: aiResponse.needsMoreDetail
      }));

      // If this is a follow-up, don't move to next question yet
      if (aiResponse.needsMoreDetail) {
        return {
          ...aiResponse,
          shouldContinueWithSameQuestion: true,
          currentQuestion: currentQuestion
        };
      }

      // If ready for next question, save the current answer and move on
      if (aiResponse.readyForNext) {
        // Call the completion callback for this question
        if (onQuestionComplete) {
          onQuestionComplete(conversationState.currentQuestion, {
            question: currentQuestion.question,
            answer: userResponse,
            voiceResponse: {
              transcription: userResponse,
              confidence: additionalContext.confidence || 0.8,
              timestamp: new Date().toISOString()
            }
          });
        }

        // Move to next question
        const nextQuestionInfo = conversationManager.moveToNextQuestion(questions);
        
        if (nextQuestionInfo.isComplete) {
          setConversationState(prev => ({
            ...prev,
            isComplete: true,
            lastAIResponse: nextQuestionInfo.message
          }));

          if (onInterviewComplete) {
            onInterviewComplete();
          }

          return {
            ...aiResponse,
            isComplete: true,
            completionMessage: nextQuestionInfo.message
          };
        }

        // Generate transition to next question
        const transitionResponse = await conversationManager.generateQuestionTransition(
          nextQuestionInfo,
          additionalContext
        );

        setConversationState(prev => ({
          ...prev,
          currentQuestion: prev.currentQuestion + 1,
          lastAIResponse: transitionResponse.response,
          conversationType: transitionResponse.conversationType,
          canFollowUp: true,
          responseAnalysis: null,
          isWaitingForResponse: false
        }));

        return {
          ...transitionResponse,
          shouldMoveToNextQuestion: true,
          nextQuestion: nextQuestionInfo.question,
          questionNumber: nextQuestionInfo.questionNumber
        };
      }

      return aiResponse;

    } catch (err) {
      console.error('Error processing user response:', err);
      setError(err.message);
      
      // Return fallback response
      return {
        response: "I apologize, but I'm having trouble processing that. Could you try rephrasing your response?",
        conversationType: 'error',
        needsMoreDetail: false,
        readyForNext: false,
        error: err.message
      };
    } finally {
      setIsProcessing(false);
    }
  }, [conversationState.currentQuestion, questions, onQuestionComplete, onInterviewComplete]);

  /**
   * Generate initial question introduction
   * @param {number} questionIndex - Index of the question to introduce
   * @param {Object} additionalContext - Additional context
   * @returns {Promise<Object>} - Question introduction response
   */
  const introduceQuestion = useCallback(async (questionIndex = 0, additionalContext = {}) => {
    if (questionIndex >= questions.length) {
      return {
        response: "All questions have been completed!",
        conversationType: 'completion',
        isComplete: true
      };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const question = questions[questionIndex];
      const nextQuestionInfo = {
        isComplete: false,
        question: question,
        questionNumber: questionIndex + 1,
        totalQuestions: questions.length,
        section: question.sectionTitle || 'Interview'
      };

      const transitionResponse = await conversationManager.generateQuestionTransition(
        nextQuestionInfo,
        additionalContext
      );

      setConversationState(prev => ({
        ...prev,
        currentQuestion: questionIndex,
        lastAIResponse: transitionResponse.response,
        conversationType: transitionResponse.conversationType,
        canFollowUp: true,
        responseAnalysis: null,
        isWaitingForResponse: false
      }));

      return transitionResponse;

    } catch (err) {
      console.error('Error introducing question:', err);
      setError(err.message);
      
      const question = questions[questionIndex];
      return {
        response: `Let's start with question ${questionIndex + 1}: ${question.question}`,
        conversationType: 'fallback',
        question: question,
        questionNumber: questionIndex + 1,
        error: err.message
      };
    } finally {
      setIsProcessing(false);
    }
  }, [questions]);

  /**
   * Handle user confusion and rephrase current question
   * @param {string} userFeedback - User's feedback about confusion
   * @returns {Object} - Rephrased question response
   */
  const rephraseCurrentQuestion = useCallback((userFeedback = '') => {
    if (conversationState.currentQuestion >= questions.length) {
      return {
        response: "The interview is already complete.",
        conversationType: 'completion'
      };
    }

    const currentQuestion = questions[conversationState.currentQuestion];
    const rephrasedResponse = conversationManager.handleQuestionRephrasing(
      currentQuestion.question,
      userFeedback
    );

    setConversationState(prev => ({
      ...prev,
      lastAIResponse: rephrasedResponse.response,
      conversationType: rephrasedResponse.conversationType
    }));

    return {
      ...rephrasedResponse,
      currentQuestion: currentQuestion
    };
  }, [conversationState.currentQuestion, questions]);

  /**
   * Skip to a specific question
   * @param {number} questionIndex - Index of question to skip to
   * @returns {Promise<Object>} - Question introduction response
   */
  const skipToQuestion = useCallback(async (questionIndex) => {
    if (questionIndex < 0 || questionIndex >= questions.length) {
      throw new Error('Invalid question index');
    }

    // Update conversation manager state
    conversationManager.conversationState.currentQuestion = questionIndex;
    conversationManager.conversationState.followUpCount = 0;

    return await introduceQuestion(questionIndex);
  }, [questions, introduceQuestion]);

  /**
   * Get current conversation statistics
   * @returns {Object} - Conversation statistics
   */
  const getConversationStats = useCallback(() => {
    const managerStats = conversationManager.getConversationStats();
    
    return {
      ...managerStats,
      currentQuestion: conversationState.currentQuestion + 1,
      isProcessing,
      error,
      isComplete: conversationState.isComplete,
      canFollowUp: conversationState.canFollowUp,
      lastResponseAnalysis: conversationState.responseAnalysis
    };
  }, [conversationState, isProcessing, error]);

  /**
   * Reset conversation to beginning
   */
  const resetConversation = useCallback(() => {
    conversationManager.reset();
    initialized.current = false;
    
    setConversationState({
      currentQuestion: 0,
      isWaitingForResponse: false,
      lastAIResponse: '',
      conversationType: 'transition',
      canFollowUp: true,
      responseAnalysis: null,
      isComplete: false
    });
    
    setIsProcessing(false);
    setError(null);
  }, []);

  /**
   * Get current question object
   * @returns {Object|null} - Current question or null if complete
   */
  const getCurrentQuestion = useCallback(() => {
    if (conversationState.currentQuestion >= questions.length) {
      return null;
    }
    return questions[conversationState.currentQuestion];
  }, [conversationState.currentQuestion, questions]);

  return {
    // State
    conversationState,
    isProcessing,
    error,
    
    // Actions
    processUserResponse,
    introduceQuestion,
    rephraseCurrentQuestion,
    skipToQuestion,
    resetConversation,
    
    // Getters
    getCurrentQuestion,
    getConversationStats,
    
    // Computed values
    currentQuestion: getCurrentQuestion(),
    progress: questions.length > 0 ? ((conversationState.currentQuestion + 1) / questions.length) * 100 : 0,
    isComplete: conversationState.isComplete || conversationState.currentQuestion >= questions.length
  };
};