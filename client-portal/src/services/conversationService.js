/**
 * Conversation Service for Voice Interview Flow
 * Manages conversation state, follow-up detection, and smooth transitions
 */

import { generateConversationalResponse } from './geminiService';

/**
 * Conversation state management class
 */
class ConversationManager {
  constructor() {
    this.conversationState = {
      currentQuestion: 0,
      totalQuestions: 0,
      currentSection: '',
      followUpCount: 0,
      maxFollowUps: 2, // Maximum follow-ups per question
      lastAIResponse: '',
      conversationHistory: [],
      userResponseAnalysis: {
        averageLength: 0,
        totalResponses: 0,
        needsEncouragement: false
      }
    };
  }

  /**
   * Initialize conversation with question data
   * @param {Array} questions - Array of interview questions
   */
  initializeConversation(questions) {
    this.conversationState.totalQuestions = questions.length;
    this.conversationState.currentQuestion = 0;
    this.conversationState.followUpCount = 0;
    this.conversationState.conversationHistory = [];
    
    if (questions.length > 0) {
      this.conversationState.currentSection = questions[0].sectionTitle || 'Interview';
    }
    
    console.log('Conversation initialized with', questions.length, 'questions');
  }

  /**
   * Analyze user response to determine if follow-up is needed
   * @param {string} userResponse - User's response to analyze
   * @param {string} question - The question that was asked
   * @returns {Object} - Analysis result with follow-up recommendation
   */
  analyzeUserResponse(userResponse, question) {
    const analysis = {
      wordCount: userResponse.trim().split(/\s+/).length,
      characterCount: userResponse.length,
      needsFollowUp: false,
      followUpReason: '',
      responseQuality: 'good',
      confidence: 0.8
    };

    // Update user response statistics
    this.conversationState.userResponseAnalysis.totalResponses++;
    const totalLength = this.conversationState.userResponseAnalysis.averageLength * 
                       (this.conversationState.userResponseAnalysis.totalResponses - 1) + 
                       analysis.wordCount;
    this.conversationState.userResponseAnalysis.averageLength = 
      totalLength / this.conversationState.userResponseAnalysis.totalResponses;

    // Check if response is too brief
    if (analysis.wordCount < 15) {
      analysis.needsFollowUp = true;
      analysis.followUpReason = 'response_too_brief';
      analysis.responseQuality = 'brief';
      analysis.confidence = 0.9;
    }
    // Check if response is very brief but not empty
    else if (analysis.wordCount < 25) {
      analysis.needsFollowUp = true;
      analysis.followUpReason = 'could_use_more_detail';
      analysis.responseQuality = 'adequate';
      analysis.confidence = 0.7;
    }
    // Check if response seems incomplete (ends abruptly)
    else if (this.seemsIncomplete(userResponse)) {
      analysis.needsFollowUp = true;
      analysis.followUpReason = 'seems_incomplete';
      analysis.responseQuality = 'incomplete';
      analysis.confidence = 0.6;
    }
    // Check if response mentions something interesting that could be explored
    else if (this.hasInterestingPoints(userResponse)) {
      analysis.needsFollowUp = true;
      analysis.followUpReason = 'interesting_points_to_explore';
      analysis.responseQuality = 'good';
      analysis.confidence = 0.5;
    }

    // Don't follow up if we've already done too many follow-ups for this question
    if (this.conversationState.followUpCount >= this.conversationState.maxFollowUps) {
      analysis.needsFollowUp = false;
      analysis.followUpReason = 'max_followups_reached';
    }

    // Don't follow up if response is comprehensive (over 100 words)
    if (analysis.wordCount > 100) {
      analysis.needsFollowUp = false;
      analysis.responseQuality = 'comprehensive';
    }

    console.log('Response analysis:', {
      wordCount: analysis.wordCount,
      needsFollowUp: analysis.needsFollowUp,
      reason: analysis.followUpReason,
      quality: analysis.responseQuality
    });

    return analysis;
  }

  /**
   * Check if response seems incomplete
   * @param {string} response - User response to check
   * @returns {boolean} - Whether response seems incomplete
   */
  seemsIncomplete(response) {
    const trimmed = response.trim();
    
    // Check for incomplete sentences
    const endsWithIncompleteMarkers = /\b(and|but|so|because|however|although|while|when|if|since)\s*\.?\s*$/i.test(trimmed);
    
    // Check if it ends mid-sentence
    const endsAbruptly = !trimmed.match(/[.!?]$/) && trimmed.length > 20;
    
    // Check for trailing conjunctions or prepositions
    const trailingWords = /\b(with|for|to|in|on|at|by|from|of|about|through|during|before|after)\s*$/i.test(trimmed);
    
    return endsWithIncompleteMarkers || endsAbruptly || trailingWords;
  }

  /**
   * Check if response has interesting points that could be explored further
   * @param {string} response - User response to check
   * @returns {boolean} - Whether response has interesting exploration points
   */
  hasInterestingPoints(response) {
    const interestingMarkers = [
      /\b(challenge|problem|issue|difficulty)\b/i,
      /\b(success|achievement|breakthrough|innovation)\b/i,
      /\b(learned|discovered|realized|found out)\b/i,
      /\b(unique|different|special|unusual)\b/i,
      /\b(strategy|approach|method|technique)\b/i,
      /\b(example|instance|case|situation)\b/i,
      /\b(result|outcome|impact|effect)\b/i
    ];

    return interestingMarkers.some(pattern => pattern.test(response));
  }

  /**
   * Generate conversational response based on user input
   * @param {string} question - The current question
   * @param {string} userResponse - User's response
   * @param {Object} additionalContext - Additional context for the conversation
   * @returns {Promise<Object>} - Conversational response object
   */
  async generateResponse(question, userResponse, additionalContext = {}) {
    try {
      // Analyze the user response
      const analysis = this.analyzeUserResponse(userResponse, question);
      
      // Prepare context for AI generation
      const context = {
        questionNumber: this.conversationState.currentQuestion + 1,
        totalQuestions: this.conversationState.totalQuestions,
        section: this.conversationState.currentSection,
        followUpCount: this.conversationState.followUpCount,
        maxFollowUps: this.conversationState.maxFollowUps,
        averageResponseLength: this.conversationState.userResponseAnalysis.averageLength,
        responseAnalysis: analysis,
        brandVoice: additionalContext.brandVoice, // Pass brand voice settings
        ...additionalContext
      };

      // Determine if we need a follow-up
      const needsFollowUp = analysis.needsFollowUp && 
                           this.conversationState.followUpCount < this.conversationState.maxFollowUps;

      // Generate AI response
      const aiResponse = await generateConversationalResponse(
        question,
        userResponse,
        context,
        needsFollowUp
      );

      // Update conversation state
      if (needsFollowUp) {
        this.conversationState.followUpCount++;
      } else {
        this.conversationState.followUpCount = 0; // Reset for next question
      }

      this.conversationState.lastAIResponse = aiResponse.response;
      
      // Add to conversation history
      this.conversationState.conversationHistory.push({
        question,
        userResponse,
        aiResponse: aiResponse.response,
        analysis,
        timestamp: new Date().toISOString(),
        needsFollowUp,
        followUpCount: this.conversationState.followUpCount
      });

      // Enhanced response with conversation management data
      const enhancedResponse = {
        ...aiResponse,
        conversationState: {
          currentQuestion: this.conversationState.currentQuestion,
          totalQuestions: this.conversationState.totalQuestions,
          followUpCount: this.conversationState.followUpCount,
          canFollowUp: this.conversationState.followUpCount < this.conversationState.maxFollowUps,
          responseAnalysis: analysis
        }
      };

      console.log('Generated conversational response:', {
        type: aiResponse.conversationType,
        needsFollowUp,
        followUpCount: this.conversationState.followUpCount,
        responseLength: aiResponse.response.length
      });

      return enhancedResponse;

    } catch (error) {
      console.error('Error generating conversational response:', error);
      
      // Return fallback response
      return this.generateFallbackResponse(question, userResponse, additionalContext);
    }
  }

  /**
   * Generate fallback response when AI generation fails
   * @param {string} question - The current question
   * @param {string} userResponse - User's response
   * @param {Object} additionalContext - Additional context
   * @returns {Object} - Fallback conversational response
   */
  generateFallbackResponse(question, userResponse, additionalContext = {}) {
    const analysis = this.analyzeUserResponse(userResponse, question);
    const needsFollowUp = analysis.needsFollowUp && 
                         this.conversationState.followUpCount < this.conversationState.maxFollowUps;

    let response;
    
    if (needsFollowUp) {
      if (analysis.followUpReason === 'response_too_brief') {
        response = "That's a great start! Could you share a specific example or go into more detail?";
      } else if (analysis.followUpReason === 'could_use_more_detail') {
        response = "Interesting! Can you elaborate on that point a bit more?";
      } else if (analysis.followUpReason === 'seems_incomplete') {
        response = "I'd love to hear more about that. Could you continue your thought?";
      } else {
        response = "That's fascinating! Could you share a specific example of how that worked?";
      }
    } else {
      response = "Excellent insight! That gives us great understanding. Ready for the next question?";
    }

    // Update state for fallback
    if (needsFollowUp) {
      this.conversationState.followUpCount++;
    } else {
      this.conversationState.followUpCount = 0;
    }

    return {
      response,
      needsMoreDetail: needsFollowUp,
      readyForNext: !needsFollowUp,
      conversationType: needsFollowUp ? 'followup' : 'acknowledgment',
      conversationState: {
        currentQuestion: this.conversationState.currentQuestion,
        totalQuestions: this.conversationState.totalQuestions,
        followUpCount: this.conversationState.followUpCount,
        canFollowUp: this.conversationState.followUpCount < this.conversationState.maxFollowUps,
        responseAnalysis: analysis
      }
    };
  }

  /**
   * Move to the next question
   * @param {Array} questions - Array of all questions
   * @returns {Object} - Next question info or completion status
   */
  moveToNextQuestion(questions) {
    this.conversationState.followUpCount = 0; // Reset follow-up count
    this.conversationState.currentQuestion++;

    if (this.conversationState.currentQuestion >= questions.length) {
      return {
        isComplete: true,
        message: "Congratulations! You've completed the interview. Let's generate your article."
      };
    }

    const nextQuestion = questions[this.conversationState.currentQuestion];
    this.conversationState.currentSection = nextQuestion.sectionTitle || this.conversationState.currentSection;

    return {
      isComplete: false,
      question: nextQuestion,
      questionNumber: this.conversationState.currentQuestion + 1,
      totalQuestions: this.conversationState.totalQuestions,
      section: this.conversationState.currentSection
    };
  }

  /**
   * Generate smooth transition to next question
   * @param {Object} nextQuestionInfo - Information about the next question
   * @param {Object} additionalContext - Additional context including brand voice
   * @returns {Promise<Object>} - Transition response
   */
  async generateQuestionTransition(nextQuestionInfo, additionalContext = {}) {
    if (nextQuestionInfo.isComplete) {
      return {
        response: nextQuestionInfo.message,
        conversationType: 'completion',
        readyForNext: false,
        isComplete: true
      };
    }

    try {
      const context = {
        questionNumber: nextQuestionInfo.questionNumber,
        totalQuestions: nextQuestionInfo.totalQuestions,
        section: nextQuestionInfo.section,
        previousSection: this.conversationState.currentSection,
        sectionChange: nextQuestionInfo.section !== this.conversationState.currentSection,
        brandVoice: additionalContext.brandVoice, // Pass brand voice settings
        ...additionalContext
      };

      const response = await generateConversationalResponse(
        nextQuestionInfo.question.question,
        '', // No user response for transitions
        context,
        false // This is a transition, not a follow-up
      );

      return {
        ...response,
        question: nextQuestionInfo.question,
        questionNumber: nextQuestionInfo.questionNumber,
        section: nextQuestionInfo.section
      };

    } catch (error) {
      console.error('Error generating question transition:', error);
      
      // Fallback transition
      const sectionChange = nextQuestionInfo.section !== this.conversationState.currentSection;
      let transitionText;
      
      if (sectionChange) {
        transitionText = `Great! Now let's move on to ${nextQuestionInfo.section.toLowerCase()}. `;
      } else if (nextQuestionInfo.questionNumber === 1) {
        transitionText = "Let's begin with our first question. ";
      } else {
        transitionText = "Perfect! Let's continue. ";
      }

      return {
        response: transitionText,
        conversationType: 'transition',
        question: nextQuestionInfo.question,
        questionNumber: nextQuestionInfo.questionNumber,
        section: nextQuestionInfo.section
      };
    }
  }

  /**
   * Handle user confusion or request for question rephrasing
   * @param {string} currentQuestion - The current question
   * @param {string} userFeedback - User's confusion or feedback
   * @returns {Object} - Rephrased question response
   */
  handleQuestionRephrasing(currentQuestion, userFeedback = '') {
    // Simple rephrasing strategies
    const rephrasingStrategies = [
      {
        trigger: /don't understand|confused|unclear/i,
        response: "Let me rephrase that in simpler terms: "
      },
      {
        trigger: /too broad|too general/i,
        response: "Let me make that more specific: "
      },
      {
        trigger: /example|specific/i,
        response: "Here's a more concrete way to think about it: "
      }
    ];

    let rephraseIntro = "Let me ask that differently: ";
    
    for (const strategy of rephrasingStrategies) {
      if (strategy.trigger.test(userFeedback)) {
        rephraseIntro = strategy.response;
        break;
      }
    }

    // Simple question rephrasing (this could be enhanced with AI)
    let rephrasedQuestion = currentQuestion;
    
    // Make question more conversational
    rephrasedQuestion = rephrasedQuestion
      .replace(/^What are/, 'Can you tell me about')
      .replace(/^How do/, 'How would')
      .replace(/^Why is/, 'Why do you think')
      .replace(/^Describe/, 'Can you describe');

    return {
      response: rephraseIntro + rephrasedQuestion,
      conversationType: 'clarification',
      needsMoreDetail: false,
      readyForNext: false,
      isRephrased: true
    };
  }

  /**
   * Get current conversation statistics
   * @returns {Object} - Conversation statistics
   */
  getConversationStats() {
    return {
      currentQuestion: this.conversationState.currentQuestion + 1,
      totalQuestions: this.conversationState.totalQuestions,
      progress: ((this.conversationState.currentQuestion + 1) / this.conversationState.totalQuestions) * 100,
      followUpCount: this.conversationState.followUpCount,
      totalResponses: this.conversationState.userResponseAnalysis.totalResponses,
      averageResponseLength: Math.round(this.conversationState.userResponseAnalysis.averageLength),
      conversationHistory: this.conversationState.conversationHistory.length,
      currentSection: this.conversationState.currentSection
    };
  }

  /**
   * Reset conversation state
   */
  reset() {
    this.conversationState = {
      currentQuestion: 0,
      totalQuestions: 0,
      currentSection: '',
      followUpCount: 0,
      maxFollowUps: 2,
      lastAIResponse: '',
      conversationHistory: [],
      userResponseAnalysis: {
        averageLength: 0,
        totalResponses: 0,
        needsEncouragement: false
      }
    };
  }
}

// Create singleton instance
const conversationManager = new ConversationManager();

export default conversationManager;
export { ConversationManager };