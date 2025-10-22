/**
 * Conversation Utilities for Voice Interview
 * Helper functions for conversation flow management
 */

/**
 * Analyze speech patterns to detect user intent and conversation cues
 * @param {string} userResponse - User's response text
 * @returns {Object} - Analysis of speech patterns and intent
 */
export const analyzeSpeechPatterns = (userResponse) => {
  const text = userResponse.toLowerCase().trim();
  
  const patterns = {
    // Confusion indicators
    confusion: [
      /i don't understand/,
      /what do you mean/,
      /can you repeat/,
      /i'm not sure/,
      /confused/,
      /unclear/,
      /what/
    ],
    
    // Completion indicators
    completion: [
      /that's all/,
      /that's it/,
      /nothing else/,
      /i'm done/,
      /finished/,
      /complete/,
      /next question/
    ],
    
    // Elaboration requests
    elaborationRequest: [
      /tell me more/,
      /can you elaborate/,
      /more details/,
      /explain further/,
      /go deeper/
    ],
    
    // Positive engagement
    engagement: [
      /interesting/,
      /great question/,
      /good point/,
      /exactly/,
      /absolutely/,
      /definitely/
    ],
    
    // Hesitation markers
    hesitation: [
      /um+/,
      /uh+/,
      /well+/,
      /let me think/,
      /hmm+/,
      /you know/
    ],
    
    // Technical difficulty
    technicalDifficulty: [
      /microphone/,
      /audio/,
      /can't hear/,
      /sound/,
      /volume/,
      /connection/
    ]
  };
  
  const analysis = {
    hasConfusion: false,
    indicatesCompletion: false,
    requestsElaboration: false,
    showsEngagement: false,
    hasHesitation: false,
    hasTechnicalIssues: false,
    confidence: 1.0,
    intent: 'response'
  };
  
  // Check each pattern category
  for (const [category, regexList] of Object.entries(patterns)) {
    const matches = regexList.some(regex => regex.test(text));
    
    switch (category) {
      case 'confusion':
        analysis.hasConfusion = matches;
        if (matches) analysis.intent = 'clarification_needed';
        break;
      case 'completion':
        analysis.indicatesCompletion = matches;
        if (matches) analysis.intent = 'completion';
        break;
      case 'elaborationRequest':
        analysis.requestsElaboration = matches;
        if (matches) analysis.intent = 'elaboration_request';
        break;
      case 'engagement':
        analysis.showsEngagement = matches;
        break;
      case 'hesitation':
        analysis.hasHesitation = matches;
        if (matches) analysis.confidence *= 0.8;
        break;
      case 'technicalDifficulty':
        analysis.hasTechnicalIssues = matches;
        if (matches) analysis.intent = 'technical_issue';
        break;
    }
  }
  
  return analysis;
};

/**
 * Determine conversation flow based on response analysis
 * @param {Object} responseAnalysis - Analysis from conversation service
 * @param {Object} speechPatterns - Analysis from speech patterns
 * @param {Object} context - Current conversation context
 * @returns {Object} - Recommended conversation flow
 */
export const determineConversationFlow = (responseAnalysis, speechPatterns, context = {}) => {
  const flow = {
    action: 'continue', // continue, followup, next_question, clarify, technical_help
    reason: '',
    confidence: 0.8,
    suggestedResponse: '',
    shouldWaitForUser: false
  };
  
  // Handle technical issues first
  if (speechPatterns.hasTechnicalIssues) {
    flow.action = 'technical_help';
    flow.reason = 'User indicated technical difficulties';
    flow.suggestedResponse = "I notice you might be having audio issues. Would you like to switch to text mode or try adjusting your microphone?";
    return flow;
  }
  
  // Handle confusion
  if (speechPatterns.hasConfusion) {
    flow.action = 'clarify';
    flow.reason = 'User expressed confusion';
    flow.suggestedResponse = "Let me rephrase that question in a different way.";
    return flow;
  }
  
  // Handle completion signals
  if (speechPatterns.indicatesCompletion) {
    flow.action = 'next_question';
    flow.reason = 'User indicated they are finished with current question';
    flow.suggestedResponse = "Perfect! Let's move on to the next question.";
    return flow;
  }
  
  // Handle elaboration requests
  if (speechPatterns.requestsElaboration) {
    flow.action = 'followup';
    flow.reason = 'User requested more elaboration';
    flow.suggestedResponse = "I'd love to hear more details about that specific aspect.";
    return flow;
  }
  
  // Use response analysis for follow-up decisions
  if (responseAnalysis) {
    if (responseAnalysis.needsFollowUp) {
      flow.action = 'followup';
      flow.reason = responseAnalysis.followUpReason;
      flow.confidence = responseAnalysis.confidence;
      
      switch (responseAnalysis.followUpReason) {
        case 'response_too_brief':
          flow.suggestedResponse = "That's a great start! Could you share a specific example or go into more detail?";
          break;
        case 'could_use_more_detail':
          flow.suggestedResponse = "Interesting! Can you elaborate on that point a bit more?";
          break;
        case 'seems_incomplete':
          flow.suggestedResponse = "I'd love to hear more about that. Could you continue your thought?";
          break;
        case 'interesting_points_to_explore':
          flow.suggestedResponse = "That's fascinating! Could you share a specific example of how that worked?";
          break;
        default:
          flow.suggestedResponse = "Could you tell me more about that?";
      }
    } else if (responseAnalysis.responseQuality === 'comprehensive') {
      flow.action = 'next_question';
      flow.reason = 'Response was comprehensive and complete';
      flow.suggestedResponse = "Excellent insight! That gives us great understanding.";
    }
  }
  
  // Adjust confidence based on hesitation
  if (speechPatterns.hasHesitation) {
    flow.confidence *= 0.9;
  }
  
  // Boost confidence for engaged responses
  if (speechPatterns.showsEngagement) {
    flow.confidence = Math.min(1.0, flow.confidence * 1.1);
  }
  
  return flow;
};

/**
 * Generate contextual prompts for conversation transitions
 * @param {string} fromSection - Previous section name
 * @param {string} toSection - Next section name
 * @param {number} questionNumber - Current question number
 * @param {number} totalQuestions - Total number of questions
 * @returns {Object} - Transition prompts and context
 */
export const generateTransitionContext = (fromSection, toSection, questionNumber, totalQuestions) => {
  const isNewSection = fromSection !== toSection;
  const progress = Math.round((questionNumber / totalQuestions) * 100);
  
  const context = {
    isNewSection,
    progress,
    transitionType: 'continue',
    suggestedIntro: '',
    contextualInfo: ''
  };
  
  if (questionNumber === 1) {
    context.transitionType = 'start';
    context.suggestedIntro = "Let's begin with our first question.";
    context.contextualInfo = "Starting the interview";
  } else if (questionNumber === totalQuestions) {
    context.transitionType = 'final';
    context.suggestedIntro = "Here's our final question.";
    context.contextualInfo = "This is the last question";
  } else if (isNewSection) {
    context.transitionType = 'section_change';
    context.suggestedIntro = `Great! Now let's move on to ${toSection.toLowerCase()}.`;
    context.contextualInfo = `Transitioning from ${fromSection} to ${toSection}`;
  } else if (progress >= 75) {
    context.transitionType = 'near_end';
    context.suggestedIntro = "We're almost done! Let's continue.";
    context.contextualInfo = "Approaching the end of the interview";
  } else if (progress >= 50) {
    context.transitionType = 'midpoint';
    context.suggestedIntro = "Perfect! We're making great progress.";
    context.contextualInfo = "Past the midpoint of the interview";
  } else {
    context.transitionType = 'continue';
    context.suggestedIntro = "Excellent! Let's continue.";
    context.contextualInfo = "Continuing with the interview";
  }
  
  return context;
};

/**
 * Validate conversation state for consistency
 * @param {Object} conversationState - Current conversation state
 * @param {Array} questions - Array of questions
 * @returns {Object} - Validation result with any issues found
 */
export const validateConversationState = (conversationState, questions) => {
  const validation = {
    isValid: true,
    issues: [],
    warnings: []
  };
  
  // Check question index bounds
  if (conversationState.currentQuestion < 0) {
    validation.isValid = false;
    validation.issues.push('Current question index is negative');
  }
  
  if (conversationState.currentQuestion >= questions.length && !conversationState.isComplete) {
    validation.isValid = false;
    validation.issues.push('Current question index exceeds available questions');
  }
  
  // Check follow-up count
  if (conversationState.followUpCount < 0) {
    validation.isValid = false;
    validation.issues.push('Follow-up count is negative');
  }
  
  if (conversationState.followUpCount > conversationState.maxFollowUps) {
    validation.warnings.push('Follow-up count exceeds maximum allowed');
  }
  
  // Check for required fields
  if (!conversationState.hasOwnProperty('totalQuestions')) {
    validation.warnings.push('Total questions count is missing');
  }
  
  if (!conversationState.currentSection) {
    validation.warnings.push('Current section is not set');
  }
  
  return validation;
};

/**
 * Calculate conversation metrics for analytics
 * @param {Object} conversationHistory - Array of conversation history items
 * @returns {Object} - Conversation metrics
 */
export const calculateConversationMetrics = (conversationHistory) => {
  if (!Array.isArray(conversationHistory) || conversationHistory.length === 0) {
    return {
      totalInteractions: 0,
      averageResponseLength: 0,
      followUpRate: 0,
      completionRate: 0,
      engagementScore: 0
    };
  }
  
  const metrics = {
    totalInteractions: conversationHistory.length,
    totalFollowUps: 0,
    totalWords: 0,
    engagementIndicators: 0,
    completedQuestions: 0
  };
  
  conversationHistory.forEach(interaction => {
    // Count words in user responses
    if (interaction.userResponse) {
      const wordCount = interaction.userResponse.trim().split(/\s+/).length;
      metrics.totalWords += wordCount;
    }
    
    // Count follow-ups
    if (interaction.needsFollowUp) {
      metrics.totalFollowUps++;
    }
    
    // Count engagement indicators
    if (interaction.analysis && interaction.analysis.responseQuality === 'good') {
      metrics.engagementIndicators++;
    }
    
    // Count completed questions (no follow-up needed)
    if (!interaction.needsFollowUp) {
      metrics.completedQuestions++;
    }
  });
  
  return {
    totalInteractions: metrics.totalInteractions,
    averageResponseLength: Math.round(metrics.totalWords / metrics.totalInteractions),
    followUpRate: Math.round((metrics.totalFollowUps / metrics.totalInteractions) * 100),
    completionRate: Math.round((metrics.completedQuestions / metrics.totalInteractions) * 100),
    engagementScore: Math.round((metrics.engagementIndicators / metrics.totalInteractions) * 100)
  };
};

/**
 * Generate conversation summary for debugging or analytics
 * @param {Object} conversationState - Current conversation state
 * @param {Array} conversationHistory - Conversation history
 * @returns {Object} - Conversation summary
 */
export const generateConversationSummary = (conversationState, conversationHistory) => {
  const metrics = calculateConversationMetrics(conversationHistory);
  const validation = validateConversationState(conversationState, []);
  
  return {
    state: {
      currentQuestion: conversationState.currentQuestion + 1,
      totalQuestions: conversationState.totalQuestions,
      progress: Math.round(((conversationState.currentQuestion + 1) / conversationState.totalQuestions) * 100),
      currentSection: conversationState.currentSection,
      followUpCount: conversationState.followUpCount,
      isComplete: conversationState.isComplete
    },
    metrics,
    validation,
    lastInteraction: conversationHistory.length > 0 ? conversationHistory[conversationHistory.length - 1] : null,
    timestamp: new Date().toISOString()
  };
};