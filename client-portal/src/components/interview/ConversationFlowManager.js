/**
 * Conversation Flow Manager Component
 * Manages the AI conversation flow for voice interviews
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useConversation } from '../../hooks/useConversation';
import { analyzeSpeechPatterns, determineConversationFlow, generateTransitionContext } from '../../utils/conversationUtils';

const ConversationFlowManager = ({ 
  questions = [], 
  onQuestionComplete, 
  onInterviewComplete,
  onAIResponse,
  onFlowChange,
  isListening = false,
  currentTranscription = '',
  children 
}) => {
  const {
    conversationState,
    isProcessing,
    error,
    processUserResponse,
    introduceQuestion,
    rephraseCurrentQuestion,
    getCurrentQuestion,
    getConversationStats,
    currentQuestion,
    progress,
    isComplete
  } = useConversation(questions, onQuestionComplete, onInterviewComplete);

  const [flowState, setFlowState] = useState({
    currentFlow: 'waiting', // waiting, processing, responding, transitioning
    lastAction: null,
    pendingResponse: null,
    conversationContext: {}
  });

  const [debugMode, setDebugMode] = useState(false);

  // Handle user response processing
  const handleUserResponse = useCallback(async (userResponse, confidence = 0.8) => {
    if (!userResponse || !userResponse.trim()) {
      return;
    }

    setFlowState(prev => ({ ...prev, currentFlow: 'processing' }));

    try {
      // Analyze speech patterns
      const speechPatterns = analyzeSpeechPatterns(userResponse);
      
      // Process the response through conversation manager
      const aiResponse = await processUserResponse(userResponse, { 
        confidence,
        speechPatterns 
      });

      // Determine conversation flow
      const flowDecision = determineConversationFlow(
        aiResponse.conversationState?.responseAnalysis,
        speechPatterns,
        {
          currentQuestion: conversationState.currentQuestion,
          followUpCount: conversationState.canFollowUp ? 0 : 2 // Simplified
        }
      );

      // Update flow state
      setFlowState(prev => ({
        ...prev,
        currentFlow: 'responding',
        lastAction: flowDecision.action,
        pendingResponse: aiResponse,
        conversationContext: {
          speechPatterns,
          flowDecision,
          aiResponse
        }
      }));

      // Notify parent components
      if (onAIResponse) {
        onAIResponse(aiResponse);
      }

      if (onFlowChange) {
        onFlowChange({
          action: flowDecision.action,
          reason: flowDecision.reason,
          confidence: flowDecision.confidence,
          aiResponse
        });
      }

      return aiResponse;

    } catch (err) {
      console.error('Error in conversation flow:', err);
      
      setFlowState(prev => ({
        ...prev,
        currentFlow: 'error',
        lastAction: 'error',
        pendingResponse: {
          response: "I'm having trouble processing that. Could you try again?",
          conversationType: 'error',
          error: err.message
        }
      }));

      if (onAIResponse) {
        onAIResponse({
          response: "I'm having trouble processing that. Could you try again?",
          conversationType: 'error',
          error: err.message
        });
      }
    }
  }, [processUserResponse, conversationState.currentQuestion, onAIResponse, onFlowChange]);

  // Handle question introduction
  const handleQuestionIntroduction = useCallback(async (questionIndex = null) => {
    const targetIndex = questionIndex !== null ? questionIndex : conversationState.currentQuestion;
    
    setFlowState(prev => ({ ...prev, currentFlow: 'transitioning' }));

    try {
      const response = await introduceQuestion(targetIndex);
      
      setFlowState(prev => ({
        ...prev,
        currentFlow: 'waiting',
        lastAction: 'introduce_question',
        pendingResponse: response,
        conversationContext: { questionIntroduction: true }
      }));

      if (onAIResponse) {
        onAIResponse(response);
      }

      return response;

    } catch (err) {
      console.error('Error introducing question:', err);
      setFlowState(prev => ({ ...prev, currentFlow: 'error' }));
    }
  }, [conversationState.currentQuestion, introduceQuestion, onAIResponse]);

  // Handle question rephrasing
  const handleQuestionRephrase = useCallback((userFeedback = '') => {
    const response = rephraseCurrentQuestion(userFeedback);
    
    setFlowState(prev => ({
      ...prev,
      currentFlow: 'waiting',
      lastAction: 'rephrase_question',
      pendingResponse: response,
      conversationContext: { rephrased: true, userFeedback }
    }));

    if (onAIResponse) {
      onAIResponse(response);
    }

    return response;
  }, [rephraseCurrentQuestion, onAIResponse]);

  // Auto-introduce first question when questions are loaded
  useEffect(() => {
    if (questions.length > 0 && conversationState.currentQuestion === 0 && flowState.currentFlow === 'waiting' && !flowState.lastAction) {
      handleQuestionIntroduction(0);
    }
  }, [questions.length, conversationState.currentQuestion, flowState.currentFlow, flowState.lastAction, handleQuestionIntroduction]);

  // Generate transition context for current state
  const getTransitionContext = useCallback(() => {
    if (!currentQuestion) return null;

    const prevQuestion = conversationState.currentQuestion > 0 ? 
      questions[conversationState.currentQuestion - 1] : null;
    
    return generateTransitionContext(
      prevQuestion?.sectionTitle || '',
      currentQuestion.sectionTitle || '',
      conversationState.currentQuestion + 1,
      questions.length
    );
  }, [currentQuestion, conversationState.currentQuestion, questions]);

  // Get conversation statistics
  const stats = getConversationStats();

  // Debug information
  const debugInfo = debugMode ? {
    conversationState,
    flowState,
    stats,
    currentQuestion,
    transitionContext: getTransitionContext(),
    isProcessing,
    error
  } : null;

  // Render function for children with conversation context
  const renderChildren = () => {
    if (typeof children === 'function') {
      return children({
        // State
        conversationState,
        flowState,
        currentQuestion,
        stats,
        progress,
        isComplete,
        isProcessing,
        error,
        
        // Actions
        handleUserResponse,
        handleQuestionIntroduction,
        handleQuestionRephrase,
        
        // Utilities
        getTransitionContext,
        debugInfo,
        setDebugMode
      });
    }
    
    return children;
  };

  return (
    <div className="conversation-flow-manager">
      {renderChildren()}
      
      {/* Debug Panel */}
      {debugMode && debugInfo && (
        <div className="conversation-debug-panel" style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          width: '300px',
          maxHeight: '400px',
          overflow: 'auto',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '10px',
          borderRadius: '8px',
          fontSize: '12px',
          zIndex: 9999
        }}>
          <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
            Conversation Debug
            <button 
              onClick={() => setDebugMode(false)}
              style={{ float: 'right', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <strong>Flow:</strong> {flowState.currentFlow}
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <strong>Action:</strong> {flowState.lastAction || 'none'}
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <strong>Question:</strong> {conversationState.currentQuestion + 1}/{questions.length}
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <strong>Progress:</strong> {Math.round(progress)}%
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <strong>Follow-ups:</strong> {stats.followUpCount || 0}
          </div>
          
          {error && (
            <div style={{ marginBottom: '8px', color: '#ff6b6b' }}>
              <strong>Error:</strong> {error}
            </div>
          )}
          
          {flowState.conversationContext.speechPatterns && (
            <div style={{ marginBottom: '8px' }}>
              <strong>Speech Analysis:</strong>
              <div style={{ fontSize: '10px', marginLeft: '10px' }}>
                Confusion: {flowState.conversationContext.speechPatterns.hasConfusion ? 'Yes' : 'No'}<br/>
                Engagement: {flowState.conversationContext.speechPatterns.showsEngagement ? 'Yes' : 'No'}<br/>
                Intent: {flowState.conversationContext.speechPatterns.intent}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConversationFlowManager;