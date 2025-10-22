const { generateContent, generateStructuredContent } = require('../lib/gemini');
const { validateMethod, validateRequiredFields, sanitizeInput, handleApiError, sendResponse } = require('../lib/api-utils');
const { handleGenerateInterviewArticleEnhanced } = require('./gemini-enhanced');
const { getFirestore, getAuth } = require('../lib/firebase-admin');

// Get Firestore instance using centralized initialization
const db = getFirestore();

/**
 * Get user's brand voice settings from Firestore
 * @param {string} userId - User's UID
 * @returns {Promise<Object|null>} Brand voice settings or null
 */
const getUserBrandVoiceSettings = async (userId) => {
  if (!userId) return null;
  
  try {
    const userRef = db.collection('email').doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData.brandVoiceSettings || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching brand voice settings:', error);
    return null;
  }
};

/**
 * Get user's subscription tier from Firestore
 * @param {string} userId - User's UID
 * @returns {Promise<string>} User's tier or 'free'
 */
const getUserTier = async (userId) => {
  if (!userId) return 'free';
  
  try {
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    const subscriptionDoc = await subscriptionRef.get();
    
    if (subscriptionDoc.exists) {
      const subscriptionData = subscriptionDoc.data();
      return subscriptionData.tier || 'free';
    }
    
    return 'free';
  } catch (error) {
    console.error('Error fetching user tier:', error);
    return 'free';
  }
};

/**
 * Extract user ID from Firebase Auth token
 * @param {Object} req - Express request object
 * @returns {Promise<string|null>} User ID or null
 */
const extractUserIdFromToken = async (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ AUTH: No Authorization header or invalid format');
      return null;
    }
    
    const token = authHeader.substring(7);
    console.log('🔍 AUTH: Attempting to verify token for user authentication');
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    console.log('✅ AUTH: Successfully authenticated user:', decodedToken.uid);
    return decodedToken.uid;
  } catch (error) {
    console.error('❌ AUTH: Error extracting user ID from token:', error.message);
    console.error('❌ AUTH: Full error:', error);
    return null;
  }
};

// Helper to strip grounding-style citation markers from text
// Removes trailing lists like " [5, 7, 21]" and inline single refs like "[3]"
const stripCitations = (text) => {
  if (typeof text !== 'string') return text;
  // Remove trailing multi-number bracket groups (e.g., " [5, 7, 21]")
  let cleaned = text.replace(/\s*\[(?:\d+[\s,]*)+\]\s*$/g, '');
  // Remove any remaining inline single-number brackets (e.g., "[3]")
  cleaned = cleaned.replace(/\[(\d+)\]/g, '');
  // Collapse extra whitespace
  return cleaned.replace(/\s{2,}/g, ' ').trim();
};

/**
 * Handle all Gemini API routes
 */
const handler = async (req, res) => {
  try {
    const path = req.path.replace('/gemini', '');

    switch (path) {
      case '/intro-questions':
        return await handleIntroQuestions(req, res);
      case '/article-questions':
        return await handleArticleQuestions(req, res);
      case '/generate-article':
        return await handleGenerateArticle(req, res);
      case '/generate-suggestions':
        return await handleGenerateSuggestions(req, res);
      case '/process-insights':
        return await handleProcessInsights(req, res);
      case '/generate-structured-article':
        return await handleGenerateStructuredArticle(req, res);
      case '/generate-interview-article':
        return await handleGenerateInterviewArticle(req, res);
      case '/generate-interview-article-enhanced':
        return await handleGenerateInterviewArticleEnhanced(req, res);
      case '/generate-replacement-question':
        return await handleGenerateReplacementQuestion(req, res);
      case '/faq-preview':
        return await handleFaqPreview(req, res);
      default:
        return sendResponse(res, 404, false, null, {
          code: 'NOT_FOUND',
          message: `Gemini route ${path} not found`
        });
    }
  } catch (error) {
    console.error('Gemini API handler error:', error);
    const errorResponse = handleApiError(error, 'Gemini API');
    return sendResponse(res, errorResponse.status, false, null, errorResponse.response.error);
  }
};

/**
 * Generate introduction questions based on topic
 * POST /api/gemini/intro-questions
 */
const handleIntroQuestions = async (req, res) => {
  try {
    validateMethod(req, ['POST']);

    const body = sanitizeInput(req.body);
    validateRequiredFields(body, ['topic']);

    const { topic } = body;

    const prompt = `Generate 1 SHORT, concise expert introduction question for someone writing about "${topic}".

Focus on:
- Background/experience in this field
- Qualifications/credentials that establish expertise
- Notable achievements, unique perspective, or passion for the topic

Requirements:
- IMPORTANT: Keep the question between 15-120 characters (short and punchy)
- Use simple, direct language - avoid long, complex sentences
- Make the question specific to ${topic} and avoid generic questions
- Question should be easy to answer in a voice interview

Examples of good SHORT intro questions:
- "What's your background in ${topic}?"
- "How did you become an expert in ${topic}?"
- "What makes you passionate about ${topic}?"

Return as JSON array with question text only.
Format: ["Question 1 text"]`;

    const response = await generateStructuredContent(prompt);

    // Validate response is an array of exactly 1 string with proper length
    if (!Array.isArray(response) || response.length !== 1) {
      throw new Error('Invalid response format from Gemini API');
    }

    // Validate the question length
    const validQuestions = response.filter(q => {
      if (typeof q !== 'string' || q.trim().length === 0) {
        return false;
      }
      const length = q.trim().length;
      if (length < 15 || length > 150) {
        console.warn(`Intro question length out of bounds: ${length} characters - "${q}"`);
        return false;
      }
      return true;
    });

    if (validQuestions.length !== 1) {
      throw new Error(`Invalid questions: expected 1 concise question (15-150 characters), got ${validQuestions.length} valid questions`);
    }

    return sendResponse(res, 200, true, { questions: validQuestions });

  } catch (error) {
    console.error('Intro questions error:', error);
    const errorResponse = handleApiError(error, 'intro-questions');
    return sendResponse(res, errorResponse.status, false, null, errorResponse.response.error);
  }
};

/**
 * Generate article questions based on topic and expert intro
 * POST /api/gemini/article-questions
 */
const handleArticleQuestions = async (req, res) => {
  try {
    validateMethod(req, ['POST']);

    const body = sanitizeInput(req.body);
    validateRequiredFields(body, ['topic', 'questionCount', 'expertIntro']);

    const { topic, questionCount, expertIntro } = body;

    // Validate question count
    if (questionCount < 5 || questionCount > 40) {
      throw new Error('Question count must be between 5 and 40');
    }

    const prompt = `You are an expert content strategist. Based on this expert's background: ${JSON.stringify(expertIntro)}

🚨 CRITICAL REQUIREMENT: Generate EXACTLY ${questionCount} questions - NO MORE, NO LESS! 🚨

Count the questions carefully and ensure the total across ALL sections equals exactly ${questionCount}.

Generate POPULAR, HIGHLY-SEARCHED questions about "${topic}" that people actually ask online.

REQUIREMENTS:
- EXACTLY ${questionCount} questions total (count them!)
- Questions must be CONCISE (5-15 words max)
- Focus on REAL questions people type into search engines
- Avoid long, academic, or "fluffy" questions
- Prioritize questions with HIGH search volume and user interest
- Use natural language that real people use when searching

QUESTION TYPES TO PRIORITIZE:
- "How to..." questions
- "What is..." questions  
- "Why does..." questions
- "Best ways to..." questions
- Common problems and solutions
- Popular comparisons
- Trending topics and current issues

Structure as sections with 5-8 questions each:
- Foundation/Basics (20%): Most searched basic questions
- Strategy/Implementation (30%): Popular "how-to" and practical questions
- Advanced Techniques (25%): High-value optimization questions people search for
- Common Problems (15%): Most googled issues and troubleshooting
- Current Trends (10%): Trending and popular recent questions

EXAMPLES of GOOD questions:
- "How to start with ${topic}?"
- "What are the best ${topic} tools?"
- "Why does ${topic} fail?"
- "How much does ${topic} cost?"

EXAMPLES of BAD questions (avoid these):
- "Can you elaborate on the multifaceted implications of ${topic} in contemporary business environments?"
- "What are your thoughts on the evolving landscape of ${topic}?"

⚠️ REMINDER: The total number of questions across ALL sections must be EXACTLY ${questionCount}. Count them before responding!

Return as JSON with this exact structure:
{
  "sections": [
    {
      "title": "Section Name",
      "questions": [
        {
          "id": 1,
          "question": "Short, popular question here"
        }
      ]
    }
  ]
}`;

    let response = await generateStructuredContent(prompt);

    // Validate response structure
    if (!response.sections || !Array.isArray(response.sections)) {
      throw new Error('Invalid response structure from Gemini API');
    }

    // Count total questions and enforce exact count
    let totalQuestions = 0;
    response.sections.forEach(section => {
      if (section.questions && Array.isArray(section.questions)) {
        totalQuestions += section.questions.length;
      }
    });

    console.log(`Generated ${totalQuestions} questions, expected ${questionCount}`);

    // Enforce exact question count
    if (totalQuestions !== questionCount) {
      console.warn(`Question count mismatch: expected ${questionCount}, got ${totalQuestions}. Adjusting...`);
      
      let questionsToRemove = totalQuestions - questionCount;
      
      if (questionsToRemove > 0) {
        // Remove excess questions from the end
        for (let i = response.sections.length - 1; i >= 0 && questionsToRemove > 0; i--) {
          const section = response.sections[i];
          if (section.questions && section.questions.length > 0) {
            const toRemove = Math.min(questionsToRemove, section.questions.length);
            section.questions = section.questions.slice(0, section.questions.length - toRemove);
            questionsToRemove -= toRemove;
            
            // Remove empty sections
            if (section.questions.length === 0) {
              response.sections.splice(i, 1);
            }
          }
        }
      } else if (questionsToRemove < 0) {
        // Add questions if we have too few
        const questionsToAdd = Math.abs(questionsToRemove);
        const lastSection = response.sections[response.sections.length - 1];
        
        if (!lastSection.questions) {
          lastSection.questions = [];
        }
        
        for (let i = 0; i < questionsToAdd; i++) {
          lastSection.questions.push({
            id: totalQuestions + i + 1,
            question: `What else should people know about ${topic}?`
          });
        }
      }
      
      console.log(`✅ Adjusted to exactly ${questionCount} questions`);
    }

    // Sanitize questions: strip citation markers from question text
    try {
      response = {
        ...response,
        sections: response.sections.map(section => ({
          ...section,
          questions: (section.questions || []).map(q => ({
            ...q,
            question: stripCitations(typeof q === 'string' ? q : q.question)
          }))
        }))
      };
    } catch (sanitizeErr) {
      console.warn('Failed to sanitize citation markers:', sanitizeErr?.message);
    }

    return sendResponse(res, 200, true, response);

  } catch (error) {
    console.error('Article questions error:', error);
    const errorResponse = handleApiError(error, 'article-questions');
    return sendResponse(res, errorResponse.status, false, null, errorResponse.response.error);
  }
};

/**
 * Generate final article from interview data
 * POST /api/gemini/generate-article
 */
const handleGenerateArticle = async (req, res) => {
  try {
    validateMethod(req, ['POST']);

    const body = sanitizeInput(req.body);
    validateRequiredFields(body, ['topic', 'expertIntro', 'questionAnswers']);

    const { topic, expertIntro, questionAnswers } = body;

    // Debug logging to understand data structure
    console.log('Generate article data:', {
      topic: topic || 'missing',
      questionAnswersType: typeof questionAnswers,
      questionAnswersIsArray: Array.isArray(questionAnswers),
      questionAnswersLength: Array.isArray(questionAnswers) ? questionAnswers.length : 'not array',
      questionAnswersValue: questionAnswers,
      expertIntro: expertIntro ? 'present' : 'missing'
    });

    // Validate questionAnswers structure
    if (!Array.isArray(questionAnswers) || questionAnswers.length === 0) {
      throw new Error('questionAnswers must be a non-empty array');
    }

    // Extract user ID and fetch brand voice settings
    const userId = await extractUserIdFromToken(req);
    let brandVoiceSettings = null;

    if (userId) {
      try {
        brandVoiceSettings = await getUserBrandVoiceSettings(userId);
        if (brandVoiceSettings) {
          console.log('🎯 BRAND VOICE: Loaded settings for legacy article generation');
        }
      } catch (error) {
        console.error('Error fetching brand voice settings:', error);
      }
    }

    // Validate that each item has the expected structure
    questionAnswers.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        console.error(`Invalid question-answer item at index ${index}:`, item);
        throw new Error(`Question-answer item at index ${index} is invalid: ${typeof item}`);
      }
      if (!item.question || !item.answer) {
        console.error(`Missing required fields in item at index ${index}:`, item);
        throw new Error(`Question-answer item at index ${index} missing required fields`);
      }
    });

    console.log('Successfully validated question-answer pairs:', questionAnswers.length);

    const articleTemplate = {
      metadata: {
        title: "string",
        description: "string",
        keywords: ["string"],
        readingTime: "number",
        wordCount: "number"
      },
      title: "string",
      sections: [
        {
          type: "heading|paragraph|list|table|faq",
          level: "number (for headings)",
          content: "string or object"
        }
      ],
      keyTakeaways: ["string"],
      authorBio: "string"
    };

    const prompt = `Create a comprehensive expert article about "${topic}" using:

Expert Background: ${JSON.stringify(expertIntro)}
Q&A Content: ${JSON.stringify(questionAnswers)}

Generate in this exact JSON structure: ${JSON.stringify(articleTemplate)}

IMPORTANT: Answer Processing Instructions:
- For answers labeled "ai gen": Use the provided answer verbatim without modification - these are already well-formatted AI-enhanced responses
- For answers labeled "original": Refine and improve the content as needed for better readability and structure

Requirements:
- SEO-optimized title
- 5 key takeaways as bullet points
- Include 2-3 data tables with realistic statistics
- Add comparison tables where relevant
- Create actionable checklists (3-5 items each)
- Structure FAQ sections (5-8 Q&As)
- Include author bio based on expert intro
- Make content authoritative, data-driven, and actionable
- Use proper heading hierarchy (H2, H3, H4)
- Include internal linking suggestions`;

    const response = await generateStructuredContent(prompt, null, { 
      brandVoiceSettings: brandVoiceSettings 
    });

    // Validate response structure
    if (!response.title || !response.sections || !Array.isArray(response.sections)) {
      throw new Error('Invalid article structure from Gemini API');
    }

    return sendResponse(res, 200, true, response);

  } catch (error) {
    console.error('Generate article error:', error);
    const errorResponse = handleApiError(error, 'generate-article');
    return sendResponse(res, errorResponse.status, false, null, errorResponse.response.error);
  }
};

/**
 * Generate personalized conversation starters for a question
 * POST /api/gemini/generate-suggestions
 */
const handleGenerateSuggestions = async (req, res) => {
  try {
    validateMethod(req, ['POST']);

    const body = sanitizeInput(req.body);
    validateRequiredFields(body, ['question', 'expertIntro']);

    const { question, expertIntro, context = {} } = body;

    // Validate question length
    if (question.length > 500) {
      throw new Error('Question must be 500 characters or less');
    }

    // Extract user ID and fetch brand voice settings
    const userId = await extractUserIdFromToken(req);
    let brandVoiceSettings = null;

    if (userId) {
      try {
        brandVoiceSettings = await getUserBrandVoiceSettings(userId);
        if (brandVoiceSettings) {
          console.log('🎯 BRAND VOICE: Loaded settings for suggestions generation');
        }
      } catch (error) {
        console.error('Error fetching brand voice settings:', error);
      }
    }

    const prompt = `Based on this expert's background: ${JSON.stringify(expertIntro)}

Generate 3-4 conversation starter suggestions for this question: "${question}"

Context: ${JSON.stringify(context)}

Requirements:
- Make suggestions specific to their expertise and background
- Keep each suggestion to 8-12 words maximum
- Focus on different angles/aspects they could cover
- Make them conversation starters, not complete answers
- Personalize based on their experience and qualifications
- Use action-oriented language (Share, Discuss, Explain, Describe)

Examples of good suggestions:
- "Share a specific example from your experience..."
- "Discuss the biggest challenge you've encountered..."
- "Explain your unique approach to..."
- "Describe a success story that illustrates..."

Return as JSON with this exact structure:
{
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4"]
}

Make suggestions inspiring and help the expert think of concrete examples from their background.`;

    const response = await generateStructuredContent(prompt, null, { 
      brandVoiceSettings: brandVoiceSettings 
    });

    // Validate response structure
    if (!response.suggestions || !Array.isArray(response.suggestions)) {
      throw new Error('Invalid response structure from Gemini API');
    }

    // Validate suggestions
    const validSuggestions = response.suggestions.filter(s =>
      typeof s === 'string' &&
      s.trim().length > 0 &&
      s.length <= 100 &&
      s.split(' ').length <= 15
    );

    if (validSuggestions.length < 3) {
      throw new Error('Insufficient valid suggestions generated');
    }

    return sendResponse(res, 200, true, {
      suggestions: validSuggestions.slice(0, 4) // Limit to 4 suggestions
    });

  } catch (error) {
    console.error('Generate suggestions error:', error);
    const errorResponse = handleApiError(error, 'generate-suggestions');
    return sendResponse(res, errorResponse.status, false, null, errorResponse.response.error);
  }
};

/**
 * Generate conversational response for voice interview flow
 * POST /api/gemini/conversational-response
 */
const handleConversationalResponse = async (req, res) => {
  try {
    validateMethod(req, ['POST']);

    const body = sanitizeInput(req.body);
    validateRequiredFields(body, ['question', 'userResponse', 'context']);

    const { question, userResponse, context, needsFollowUp = false } = body;

    // Validate question length
    if (question.length > 500) {
      throw new Error('Question must be 500 characters or less');
    }

    // Validate user response length
    if (userResponse.length > 2000) {
      throw new Error('User response must be 2000 characters or less');
    }

    let prompt;

    if (needsFollowUp) {
      prompt = `As an expert interviewer, the user just answered: "${userResponse}" to the question: "${question}".

Context: ${JSON.stringify(context)}

Generate a natural follow-up response that either:
1. Asks for more detail if the answer was too brief (less than 50 words)
2. Asks a clarifying question if something was unclear or interesting
3. Acknowledges the answer and suggests they're ready for the next question

Guidelines:
- Be conversational, encouraging, and professional
- Keep response under 50 words
- Use natural language like a human interviewer would
- Show genuine interest in their expertise
- Don't repeat their answer back to them

Examples of good responses:
- "That's a great point about [specific detail]. Could you share a specific example of how you've applied this?"
- "Interesting approach! What challenges have you encountered when implementing this strategy?"
- "Perfect! That gives us great insight. Let's move on to explore another aspect."

Return JSON: { "response": "your response", "needsMoreDetail": boolean, "readyForNext": boolean, "conversationType": "followup" }

Set needsMoreDetail to true if the answer was too brief or vague.
Set readyForNext to true if the answer was comprehensive and complete.`;
    } else {
      prompt = `Generate a natural transition to ask this question: "${question}"

Context: This is question ${context.questionNumber || 1} of ${context.totalQuestions || 10} in the ${context.section || 'interview'} section.
Previous context: ${JSON.stringify(context)}

Create a conversational introduction that:
- Smoothly transitions to the new question
- Acknowledges the previous topic if relevant
- Sets context for why this question matters
- Maintains an encouraging, professional tone
- Keeps it under 30 words

Examples:
- "Great! Now let's dive into [topic area]. [Question]"
- "That foundation helps us understand your background. Next, I'd love to explore [topic]. [Question]"
- "Perfect. Building on that experience, [Question]"

Return JSON: { "response": "your response", "conversationType": "transition" }`;
    }

    const response = await generateStructuredContent(prompt);

    // Validate response structure
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response structure from Gemini API');
    }

    if (!response.response || typeof response.response !== 'string') {
      throw new Error('Invalid response format: missing or invalid response field');
    }

    // Validate response length
    if (response.response.length > 200) {
      console.warn('Generated response is too long, truncating');
      response.response = response.response.substring(0, 197) + '...';
    }

    // Ensure required fields exist
    const normalizedResponse = {
      response: response.response.trim(),
      needsMoreDetail: Boolean(response.needsMoreDetail),
      readyForNext: Boolean(response.readyForNext),
      conversationType: response.conversationType || (needsFollowUp ? 'followup' : 'transition')
    };

    return sendResponse(res, 200, true, normalizedResponse);

  } catch (error) {
    console.error('Conversational response error:', error);
    const errorResponse = handleApiError(error, 'conversational-response');
    return sendResponse(res, errorResponse.status, false, null, errorResponse.response.error);
  }
};

/**
 * Generate structured article from keyword
 * POST /api/gemini/generate-structured-article
 */

const handleGenerateStructuredArticle = async (req, res) => {
  try {
    validateMethod(req, ['POST']);

    const body = sanitizeInput(req.body);
    validateRequiredFields(body, ['keyword']);

    const { 
      keyword, 
      questionCount = 15, 
      subscriptionTier = 'free', 
      referenceLink = '', 
      linkDescription = '', 
      linkFrequency = 2, 
      brandVoiceEnabled = null,
      prompt: customPrompt 
    } = body;

    // Validate keyword
    if (typeof keyword !== 'string' || keyword.trim().length < 2) {
      throw new Error('Keyword must be at least 2 characters long');
    }

    if (keyword.length > 100) {
      throw new Error('Keyword must be less than 100 characters');
    }

    // Validate questionCount
    if (typeof questionCount !== 'number' || questionCount < 5 || questionCount > 40) {
      throw new Error('Question count must be between 5 and 40');
    }

    // Extract user ID and fetch brand voice settings
    const userId = await extractUserIdFromToken(req);
    let brandVoiceSettings = null;
    let userTier = subscriptionTier;

    if (userId) {
      try {
        // Fetch user's actual tier from database
        userTier = await getUserTier(userId);
        
        // Fetch brand voice settings
        brandVoiceSettings = await getUserBrandVoiceSettings(userId);
        
        if (brandVoiceSettings) {
          console.log('🎯 BRAND VOICE: Loaded settings for user', userId);
          console.log('📋 BRAND VOICE: Settings enabled:', brandVoiceSettings.enabled);
          console.log('📋 BRAND VOICE: Frontend toggle:', brandVoiceEnabled);
          
          // Respect frontend toggle - if explicitly disabled, override Firestore setting
          if (brandVoiceEnabled === false) {
            brandVoiceSettings = { ...brandVoiceSettings, enabled: false };
            console.log('🎯 BRAND VOICE: Disabled by frontend toggle');
          } else if (brandVoiceEnabled === true) {
            brandVoiceSettings = { ...brandVoiceSettings, enabled: true };
            console.log('🎯 BRAND VOICE: Enabled by frontend toggle');
          }
          // If brandVoiceEnabled is null, use Firestore setting as-is
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        // Continue without brand voice if there's an error
      }
    }

    // Validate reference link parameters if provided
    if (referenceLink && referenceLink.trim()) {
      if (typeof referenceLink !== 'string' || referenceLink.length > 500) {
        throw new Error('Reference link must be a valid URL string under 500 characters');
      }
      
      // Basic URL validation
      try {
        new URL(referenceLink.trim());
      } catch (urlError) {
        throw new Error('Reference link must be a valid URL');
      }

      // Validate link description is provided when link is provided
      if (!linkDescription || !linkDescription.trim()) {
        throw new Error('Link description is required when reference link is provided');
      }

      if (typeof linkDescription !== 'string' || linkDescription.trim().length < 10 || linkDescription.length > 200) {
        throw new Error('Link description must be between 10 and 200 characters');
      }

      // Validate link frequency
      if (typeof linkFrequency !== 'number' || linkFrequency < 2 || linkFrequency > 5) {
        throw new Error('Link frequency must be between 2 and 5');
      }
    }

    console.log(`Validated parameters - keyword: "${keyword}", questionCount: ${questionCount}, subscriptionTier: ${subscriptionTier}, referenceLink: ${referenceLink ? 'provided' : 'none'}, linkFrequency: ${linkFrequency}`);

    // Calculate dynamic content counts based on questionCount
    const baseFaqCount = Math.floor(questionCount * 2.5); // Scale FAQs with question count
    const tableCount = 2; // Fixed at 2 tables for all plans
    const checklistItems = 4; // Capped at 4 items for all plans
    const targetWordCount = Math.floor(questionCount * 400);

    // Build reference link instructions if provided
    const referenceLinkInstructions = referenceLink && referenceLink.trim() ? `

REFERENCE LINK INTEGRATION RULES:
- Link to include: ${referenceLink.trim()}
- What this link offers: ${linkDescription.trim()}

PLACEMENT STRATEGY:
1. INTRODUCTION SECTION: Include the link EXACTLY ONCE in the intro_md section
   - Integrate naturally within one of the introduction paragraphs
   - Should feel like a natural part of the introduction flow
   - Example: "Understanding ${keyword} requires the right approach and tools, and for ${linkDescription.toLowerCase()}, <a href="${referenceLink.trim()}">this platform</a> provides comprehensive solutions that many professionals rely on."

2. FAQ ANSWERS: Include the link exactly ${linkFrequency} times across different FAQ questions
   - Distribution: Use ${linkFrequency} different FAQ questions
   - Context: Each mention must be relevant to that specific FAQ topic AND relate to what the link offers
   - Integration Strategy: Only mention the link in FAQs where "${linkDescription.trim()}" would genuinely help answer the question

INTEGRATION GUIDELINES FOR BOTH SECTIONS:
- HYPERLINK INTEGRATION: Weave links naturally INTO the paragraph flow, not as separate sentences
- SEAMLESS INTEGRATION EXAMPLES (embed within the content naturally):
  * "The best approach is to start with basic strategies, and for ${linkDescription.toLowerCase()}, <a href="${referenceLink.trim()}">leading platforms</a> offer excellent beginner-friendly features."
  * "Many professionals recommend using automated tools, with <a href="${referenceLink.trim()}">specialized software</a> being particularly effective for ${linkDescription.toLowerCase()}."
  * "You can achieve better results by combining manual techniques with <a href="${referenceLink.trim()}">dedicated solutions</a>, which excel in ${linkDescription.toLowerCase()}."
  * "The most efficient method involves using <a href="${referenceLink.trim()}">industry-standard tools</a> for ${linkDescription.toLowerCase()}."
  * "Consider implementing <a href="${referenceLink.trim()}">proven systems</a> alongside your existing workflow for ${linkDescription.toLowerCase()}."
  * "Successful businesses often leverage <a href="${referenceLink.trim()}">comprehensive platforms</a> that provide ${linkDescription.toLowerCase()}."
  * "For optimal results, many experts recommend <a href="${referenceLink.trim()}">advanced solutions</a> designed for ${linkDescription.toLowerCase()}."
  * "The key is utilizing <a href="${referenceLink.trim()}">professional-grade tools</a> that streamline ${linkDescription.toLowerCase()}."
- CRITICAL RULE: Links must be PART OF the content's natural flow, not separate recommendation sentences
- ENHANCED ANCHOR TEXT VARIETY: Use contextually appropriate phrases that feel natural:
  * PROFESSIONAL: "leading platforms", "industry-standard tools", "professional-grade solutions", "enterprise systems"
  * DESCRIPTIVE: "specialized software", "dedicated solutions", "comprehensive platforms", "advanced tools"
  * AUTHORITATIVE: "proven systems", "trusted resources", "established platforms", "reliable solutions"
  * CONTEXTUAL: "cutting-edge technology", "innovative approaches", "streamlined processes", "integrated systems"
  * QUALITY-FOCUSED: "premium tools", "top-tier platforms", "high-performance solutions", "robust systems"
- ANCHOR TEXT SELECTION RULES:
  * Match the tone and context of the surrounding content
  * Use 2-4 words that sound natural and descriptive
  * Avoid repetition - each link should use different anchor text
  * Choose phrases that align with the link description and content topic
- NEVER show raw URLs - always use HTML anchor tags with descriptive text
- NATURAL FLOW REQUIREMENT: The link should feel like part of the advice, not an advertisement
- Integration must be so natural that readers don't notice it's promotional content
- Relevance: Only include where the content topic directly relates to "${linkDescription.trim()}"
- FORBIDDEN: Separate sentences like "For more information, visit..." or "You can also check out..."
- REQUIRED: Links embedded within the natural advice and explanation flow
- The link should enhance the content's value, not interrupt it

TOTAL LINK COUNT: ${parseInt(linkFrequency) + 1} (1 in introduction + ${linkFrequency} in FAQs)
` : '';

    // Use custom prompt if provided, otherwise use default
    const prompt = customPrompt || `You are a structured content generator. You are an expert content strategist. Your task is to create a long-form, AIO-optimized authority article that is BOTH: Structured for AI Overviews (AIO): Includes summaries, tables, stats, comparisons, FAQs, and scannable takeaways. Humanized, engaging, and authority-driven: Use anecdotes, lived-experience examples, opinionated insights, and metaphors to avoid AI-flatness. Educational, not salesy: Teach and guide. All "next step" CTAs must use the phrase "Click here" pointing to the homepage (no gated content or product push). Output ONLY a single JSON object that matches the exact schema below. Do not include prose outside JSON. Escape all internal quotes. STRICT ADHERENCE REQUIRED: All numerical counts, lengths, and structural relationships specified below MUST be followed precisely. NO DEVIATIONS from specified numbers or ranges are acceptable.

TOPIC: "${keyword}"${referenceLinkInstructions}

Schema (v1.0.0):
{
  "title": "string",
  "subtitle": "string",
  "key_takeaways": ["string", "..."],
  "tables": [
    {
      "title": "string",
      "headers": ["string", "..."],
      "rows": [["string", "..."], ["string", "..."]]
    }
  ],
  "checklists": {
    "launch": ["string", "..."],
    "post_contest": ["string", "..."]
  },
  "intro_md": "string (GitHub-flavored Markdown)",
  "toc": [
    {
      "section_title": "string",
      "questions": ["string", "..."]
    }
  ],
  "faqs": [
    {
      "section_title": "string (must equal one of toc.section_title)",
      "question": "string",
      "answer_md": "string (MUST START with single best summary sentence, then supporting details in Markdown, 4–8 sentences total)",
      "real_results": "string (1–2 sentence concrete example with numbers if possible)",
      "takeaway": "string (single actionable sentence)"
    }
  ],
  "metadata": {
    "topic": "string",
    "audience": "General audience",
    "tags": ["string", "..."],
    "version": "v1.0.0",
    "meta_description": "string (120-158 characters, AIO-optimized for search engines and AI Overviews)"
  },
  "cta": {
    "text": "string",
    "url": "https://..."
  },
  "author": {
    "name": "string",
    "bio": "string"
  }
}

Content requirements (apply to the TOPIC above):
- Produce exactly 5 key_takeaways relevant to the TOPIC.
- Provide 2 tables. All tables must be directly relevant to the TOPIC, reflecting real metrics, comparisons, or features specific to it.
- Each table must have exactly 4 rows and exactly 4 columns and headers that match the content.
- Provide both checklists of topic with topic name:
  - launch: EXACTLY 4 items.
  - post_contest: EXACTLY 4 items (post_contest is just the name, content will be post launch "${keyword}").
- intro_md: 2–4 short paragraphs tailored to the TOPIC.
- toc: Generate sections that total EXACTLY ${questionCount} questions across all sections combined.
- faqs: The number of items in 'faqs' MUST exactly match the total number of questions generated in the 'toc' (${questionCount} total). Every single question from the 'toc' MUST be answered. Each FAQ.section_title must match a toc.section_title.
- meta_description: EXACTLY 120-158 characters, AIO-optimized with primary keyword, compelling hook, and clear value proposition for search engines and AI Overviews.

CRITICAL FAQ FORMAT REQUIREMENT:
Each FAQ answer_md MUST follow this exact structure:
- First sentence: The single best, AIO answer most comprehensive answer that fully addresses the question
- Remaining sentences: Supporting details, explanations, and additional context
- Total: EXACTLY 4–5 sentences including the summary sentence

Example FAQ format:
"Mobile gaming dominates the industry with over 50% of global gaming revenue in 2024, driven by accessibility and massive player bases. This growth stems from smartphones becoming more powerful while remaining affordable globally. Key revenue drivers include in-app purchases, advertising, and subscription models that have proven more profitable than traditional one-time purchases. The trend shows no signs of slowing as 5G networks enable more sophisticated mobile gaming experiences."

Style & constraints:
Expert, practical, actionable. U.S. English. Specific, no fluff.
FAQ answers must be immediately valuable - readers should get the core answer in the first sentence.

Hard limits:
- title/subtitle should be between 50 to 70 chars
- key_takeaway item ≤ 220 chars
- table cell ≤ 80 chars
- checklist item ≤ 120 chars
- answer_md ≤ 400 chars
- real_results ≤ 220 chars
- takeaway ≤ 140 chars
- meta_description: EXACTLY 120-158 characters

If unknown, use "N/A" conservatively.
Output MUST be valid JSON per schema. No markdown fences, no extra text.`;

    console.log(`Generating structured article for keyword: "${keyword}" with questionCount: ${questionCount}, subscriptionTier: ${subscriptionTier}`);

    // Call generateStructuredContent with brand voice settings
    const startTime = Date.now();
    const response = await generateStructuredContent(prompt, null, { 
      brandVoiceSettings: brandVoiceSettings 
    });
    const generationTime = Date.now() - startTime;

    // Add detailed logging to debug the response
    console.log('=== GEMINI RAW RESPONSE DEBUG ===');
    console.log('Response type:', typeof response);
    console.log('Response is array:', Array.isArray(response));
    console.log('Response keys:', response ? Object.keys(response) : 'null/undefined');
    console.log('Raw response (first 500 chars):', JSON.stringify(response).substring(0, 500));
    console.log(`Generation took: ${generationTime}ms`);
    console.log('=== END DEBUG ===');

    // Validate response structure
    if (!response || typeof response !== 'object') {
      console.error('Invalid response from Gemini:', response);
      throw new Error('Invalid response structure from Gemini API');
    }

    // Validate required fields
    const requiredFields = ['title'];
    for (const field of requiredFields) {
      if (!response[field]) {
        console.warn(`Missing required field: ${field}`);
      }
    }

    // Sanitize response to remove citation markers
    const sanitizedResponse = sanitizeArticleResponse(response);

    // Log the actual generated content counts for debugging
    const faqCount = sanitizedResponse.faqs ? sanitizedResponse.faqs.length : 0;
    const tocQuestionCount = sanitizedResponse.toc ? sanitizedResponse.toc.reduce((total, section) => total + (section.questions ? section.questions.length : 0), 0) : 0;
    const checklistLaunchCount = sanitizedResponse.checklists?.launch ? sanitizedResponse.checklists.launch.length : 0;
    const checklistPostCount = sanitizedResponse.checklists?.post_contest ? sanitizedResponse.checklists.post_contest.length : 0;
    const actualTableCount = sanitizedResponse.tables ? sanitizedResponse.tables.length : 0;

    console.log(`✅ Generated article: "${sanitizedResponse.title}"`);
    console.log(`📊 Content counts - Requested: ${questionCount} questions, Generated: ${faqCount} FAQs, ${tocQuestionCount} TOC questions, ${actualTableCount} tables (fixed at 2), ${checklistLaunchCount}/${checklistPostCount} checklist items (capped at 4)`);

    return sendResponse(res, 200, true, { data: sanitizedResponse });

  } catch (error) {
    console.error('=== GENERATE STRUCTURED ARTICLE ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', error);
    console.error('=== END ERROR DEBUG ===');

    const errorResponse = handleApiError(error, 'generate-structured-article');
    return sendResponse(res, errorResponse.status, false, null, errorResponse.response.error);
  }
};

/**
 * Generate structured article from interview data
 * POST /api/gemini/generate-interview-article
 */
const handleGenerateInterviewArticle = async (req, res) => {
  try {
    validateMethod(req, ['POST']);

    const body = sanitizeInput(req.body);
    validateRequiredFields(body, ['topic', 'expertIntro', 'questions']);

    const { 
      topic, 
      expertIntro, 
      questions, 
      introQaPairs = [],
      // Add promotional link parameters
      referenceLink = '',
      linkDescription = '',
      linkFrequency = 2
    } = body;

    // Validate questions array
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Questions must be a non-empty array');
    }

    // Validate reference link parameters if provided
    if (referenceLink && referenceLink.trim()) {
      if (!linkDescription || !linkDescription.trim()) {
        throw new Error('Link description is required when reference link is provided');
      }
      
      if (linkFrequency < 2 || linkFrequency > 5) {
        throw new Error('Link frequency must be between 2 and 5');
      }
      
      try {
        new URL(referenceLink.trim());
      } catch {
        throw new Error('Invalid reference link URL format');
      }
    }

    // Normalize intro Q&A pairs coming from client
    const answeredIntroPairs = Array.isArray(introQaPairs)
      ? introQaPairs.filter(pair =>
          pair &&
          typeof pair.question === 'string' &&
          pair.question.trim().length > 0 &&
          typeof pair.answer === 'string' &&
          pair.answer.trim().length > 0
        ).map(pair => ({
          question: pair.question.trim(),
          answer: pair.answer.trim()
        }))
      : [];

    // Create expert background text
    let expertBackgroundText = '';
    if (answeredIntroPairs.length > 0) {
      expertBackgroundText = answeredIntroPairs
        .map(({ question, answer }) => `Q: ${question}\nA: ${answer}`)
        .join('\n\n');
    } else if (expertIntro && typeof expertIntro === 'object') {
      const introEntries = [];
      for (let i = 1; i <= 1; i++) {
        const questionKey = `question${i}`;
        const answerKey = `answer${i}`;
        if (expertIntro[questionKey] && expertIntro[answerKey]) {
          introEntries.push(`Q: ${expertIntro[questionKey]}\nA: ${expertIntro[answerKey]}`);
        }
      }
      expertBackgroundText = introEntries.join('\n\n');
    }

    // Create questions and answers text
    const introQuestionsText = answeredIntroPairs.length > 0
      ? answeredIntroPairs
          .map(({ question, answer }) => `Q: ${question}\nA: ${answer}`)
          .join('\n\n')
      : '';

    const rawTopicQuestions = Array.isArray(questions) ? questions : [];
    const topicQuestionEntries = rawTopicQuestions
      .filter(q => {
        if (!q || typeof q !== 'object') return false;
        const section = (q.sectionTitle || q.section || '').toLowerCase();
        const idString = String(q.id ?? '').toLowerCase();
        const looksIntro = section.includes('intro') || section.includes('expert intro') || idString.startsWith('intro-');
        return !looksIntro;
      })
      .map((q, index) => {
        const questionText = q.question || q.text || (typeof q === 'string' ? q : 'Unknown question');
        const answerText = q.answer || 'No answer provided';
        return {
          index: index + 1,
          id: q.id ?? index,
          questionText,
          answerText
        };
      });

    const topicQuestionsText = topicQuestionEntries
      .map(entry => `Question ${entry.index}: ${entry.questionText}\nAnswer: ${entry.answerText}`)
      .join('\n\n');

    const topicQuestionListText = topicQuestionEntries
      .map(entry => `${entry.index}. ${entry.questionText}`)
      .join('\n');

    const topicQuestionCount = topicQuestionEntries.length;

    const questionsAndAnswersSections = [];
    if (introQuestionsText) {
      questionsAndAnswersSections.push(`Intro Responses:\n${introQuestionsText}`);
    }
    if (topicQuestionsText) {
      questionsAndAnswersSections.push(`Topic Responses:\n${topicQuestionsText}`);
    }
    const questionsAndAnswersText = questionsAndAnswersSections.join('\n\n') || 'No interview responses were provided.';

    // Build reference link instructions if provided
    const referenceLinkInstructions = referenceLink && referenceLink.trim() ? `

REFERENCE LINK INTEGRATION RULES:
- Link to include: ${referenceLink.trim()}
- What this link offers: ${linkDescription.trim()}

PLACEMENT STRATEGY:
1. INTRODUCTION SECTION: Include the link EXACTLY ONCE in the intro_md section
   - Integrate naturally within one of the introduction paragraphs
   - Should feel like a natural part of the introduction flow

2. FAQ ANSWERS: Include the link exactly ${linkFrequency} times across different FAQ questions
   - Distribution: Use ${linkFrequency} different FAQ questions
   - Context: Each mention must be relevant to that specific FAQ topic AND relate to what the link offers
   - Integration Strategy: Only mention the link in FAQs where "${linkDescription.trim()}" would genuinely help answer the question

INTEGRATION GUIDELINES FOR BOTH SECTIONS:
- HYPERLINK INTEGRATION: Weave links naturally INTO the paragraph flow, not as separate sentences
- ENHANCED ANCHOR TEXT VARIETY: Use contextually appropriate phrases that feel natural:
  * PROFESSIONAL: "leading platforms", "industry-standard tools", "professional-grade solutions", "enterprise systems"
  * DESCRIPTIVE: "specialized software", "dedicated solutions", "comprehensive platforms", "advanced tools"
  * AUTHORITATIVE: "proven systems", "trusted resources", "established platforms", "reliable solutions"
  * CONTEXTUAL: "cutting-edge technology", "innovative approaches", "streamlined processes", "integrated systems"
  * QUALITY-FOCUSED: "premium tools", "top-tier platforms", "high-performance solutions", "robust systems"
- ANCHOR TEXT SELECTION RULES:
  * Match the tone and context of the surrounding content
  * Use 2-4 words that sound natural and descriptive
  * Avoid repetition - each link should use different anchor text
  * Choose phrases that align with the link description and content topic
- CRITICAL RULE: Links must be PART OF the content's natural flow, not separate recommendation sentences
- NEVER show raw URLs - always use HTML anchor tags with descriptive text
- NATURAL FLOW REQUIREMENT: The link should feel like part of the advice, not an advertisement
- Integration must be so natural that readers don't notice it's promotional content
- Relevance: Only include where the content topic directly relates to "${linkDescription.trim()}"
- FORBIDDEN: Separate sentences like "For more information, visit..." or "You can also check out..."
- REQUIRED: Links embedded within the natural advice and explanation flow
- The link should enhance the content's value, not interrupt it

TOTAL LINK COUNT: ${parseInt(linkFrequency) + 1} (1 in introduction + ${linkFrequency} in FAQs)
` : '';

    const prompt = `Transform this expert interview into a comprehensive, SEO-optimized article using AIO (Artificial Intelligence Optimization) principles.

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations. Start with { and end with }.${referenceLinkInstructions}

IMPORTANT OUTPUT POLICY:
- Do NOT copy or reuse any phrases or sentences from the interview answers verbatim. Use them strictly as context and inspiration.
- You MUST write entirely new, original prose that reflects the expert's ideas, not their wording.
- The ONLY text you may copy verbatim is the list of TOPIC interview questions (for TOC and FAQ question fields).
- CRITICAL: Do NOT use asterisks (*) anywhere in the output for formatting, emphasis, or any other purpose. Use plain text only.

Persona & Voice:
- Write in the expert's first-person voice throughout narrative fields (use "I", "my", "we" if referring to the expert's team).
- Do NOT refer to the expert in third person (avoid phrases like "the expert", "they", "the user").
- Do NOT mention the interview, prompts, or that this content was generated (no meta commentary such as "in this interview", "the following Q&A").

Interview Topic: "${topic}"

Expert Background (Q/A style):
${expertBackgroundText || 'None provided.'}

Intro Interview Responses (use ONLY for the introduction and author bio):
${introQuestionsText || 'No intro responses were provided.'}

Topic Interview Responses (use these for the main body content):
${topicQuestionsText || 'No topic responses were captured.'}

Topic Question List (copy verbatim into TOC/FAQ):
${topicQuestionListText || 'No topic questions available.'}

Topic Question Count: ${topicQuestionCount}

Grounding & Citations:
- If you add facts, statistics, or claims not explicitly present in the interview, they must be grounded in credible sources.
- Include source URLs in a "citations" array for each FAQ item where external facts are used.
- If no reliable source is found, omit the claim. Never fabricate data.

JSON Output Requirements:
- Output MUST be a single valid JSON object only. No code fences, no extra text, no comments.
- Use double quotes for all keys and string values. Properly escape special characters.
- Do NOT add fields beyond those specified. Respect length limits to ensure parseability.

Create the article with the EXACT structure below. Except for the topic question text (which must be copied verbatim), all other text must be original, synthesized, and enhanced:
{
  "title": "One engaging title, max 120 chars",
  "subtitle": "Compelling subtitle summarizing insights, max 160 chars",
  "key_takeaways": ["3–5 concise, original takeaways, each ≤ 100 chars"],
  "intro_md": "2–3 short paragraphs written in first-person expert voice (max 700 chars total). Use plain text only - NO asterisks (*), NO markdown formatting, NO bold, NO italic, NO bullet lists, NO links.",
  "toc": [
    {
      "section_title": "Interview Questions",
      "questions": ${topicQuestionCount > 0 ? '["Use ONLY the topic question list above in the same order."]' : '[]'}
    }
  ],
  "faqs": [
    ${
      topicQuestionCount > 0
        ? `{
      "section_title": "Frequently Asked Questions",
      "question": "Pick one topic question from the list above (minor grammar fixes permitted, meaning must stay intact).",
      "answer_md": "Original, comprehensive answer grounded in the interview; enhance with context while keeping a first-person expert voice. Max 900 chars. Use plain text only - NO asterisks (*), NO markdown formatting, NO bold, NO italic, NO lists, NO links.",
      "real_results": "Concrete results present in the interview; if none, use \\"None\\".",
      "takeaway": "Actionable takeaway (≤ 140 chars).",
      "citations": ["URLs for any added facts/statistics; empty array if none."]
    }`
        : ''
    }
  ],
  "tables": [
    {
      "title": "Professional title (≤ 80 chars)",
      "headers": ["2–5 concise headers"],
      "rows": [["Up to 5 rows, 2–5 columns; values must be grounded in the interview or omitted"]]
    }
  ],
  "checklists": {
    "launch": ["3–7 actionable steps, each ≤ 100 chars, grounded in interview"],
    "post_contest": ["3–7 steps, each ≤ 100 chars, grounded in interview"]
  },
  "author": {
    "name": "Expert name if available; else \"Unknown\"",
    "bio": "1–2 original sentences derived from Expert Background; do not copy exact wording"
  },
  "cta": {
    "text": "Create call to action based on topic (≤ 80 chars)",
    "url": "#"
  },
  "metadata": {
    "meta_description": "120–158 chars SEO-friendly, original description that reflects the article"
  }
}

ABSOLUTE REQUIREMENTS:
- ORIGINALITY: Do not repeat any answer wording. Paraphrase and synthesize into fresh prose everywhere except the topic question text.
- INTRO VS TOPIC: Use intro responses ONLY for the intro and author bio. Use topic responses for TOC/FAQ/body content. Intro questions must NEVER appear in TOC or FAQ.
- QUESTIONS: Copy the topic question list verbatim for TOC and FAQ question fields (minor grammar/punctuation fixes allowed). If no topic questions exist, set toc.questions to [] and faqs to [].
- FAQ COUNT: ${topicQuestionCount > 0 ? `Produce exactly ${topicQuestionCount} FAQ item${topicQuestionCount === 1 ? '' : 's'}, each tied to a corresponding topic question, in the same order.` : 'If no topic questions exist, leave the faqs array empty.'}
- ENHANCEMENT: Expand thin content with grounded, authoritative info. Include citations when external facts are added; omit unverified claims.
- STRUCTURE: Follow the exact JSON structure. No extra keys. Respect length limits.
- META: Generate meta_description within 120–158 characters.
- PERSONA: Use first-person expert voice in all narrative fields; avoid third-person references to the expert and any mention of interviews/prompts.`;

    console.log(`Generating interview article for topic: "${topic}" with ${questions.length} questions`);

    // Log final prompt preview
    console.log('=== FINAL PROMPT PREVIEW ===');
    console.log('Prompt length:', prompt.length);
    console.log('Prompt first 300 chars:', prompt.substring(0, 300));
    console.log('=== END PROMPT PREVIEW ===');

    // Debug: Log the received data
    console.log('=== API RECEIVED DATA DEBUG ===');
    console.log('Topic:', topic);
    console.log('Questions count:', questions.length);
    console.log('Questions sample:', questions.slice(0, 2).map(q => ({ question: q.question, hasAnswer: !!q.answer })));
    console.log('Expert Intro keys:', Object.keys(expertIntro || {}));
    console.log('=== END API RECEIVED DATA DEBUG ===');

    // Debug: Log the constructed Q&A text
    console.log('=== QUESTIONS AND ANSWERS TEXT DEBUG ===');
    console.log('Total questions received:', questions.length);
    console.log('Full Q&A text being sent to Gemini:');
    console.log(questionsAndAnswersText);
    console.log('Individual question objects:');
    questions.forEach((q, i) => {
      console.log(`Question ${i+1}:`, {
        id: q.id,
        question: q.question,
        answerLength: (q.answer || '').length,
        hasAnswer: !!(q.answer && q.answer.trim().length > 0),
        answerPreview: (q.answer || '').substring(0, 50) + '...'
      });
    });
    console.log('=== END Q&A TEXT DEBUG ===');

    const startTime = Date.now();
    const response = await generateStructuredContent(prompt);
    const generationTime = Date.now() - startTime;

    // Add detailed logging to debug the response
    console.log('=== GEMINI INTERVIEW ARTICLE RESPONSE DEBUG ===');
    console.log('Response type:', typeof response);
    console.log('Response is array:', Array.isArray(response));
    console.log('Response keys:', response ? Object.keys(response) : 'null/undefined');
    console.log('Raw response (first 500 chars):', JSON.stringify(response).substring(0, 500));
    console.log(`Generation took: ${generationTime}ms`);
    console.log('=== END DEBUG ===');

    // Validate response structure
    if (!response || typeof response !== 'object') {
      console.error('Invalid response from Gemini:', response);
      throw new Error('Invalid response structure from Gemini API');
    }

    // Validate required fields
    const requiredFields = ['title'];
    for (const field of requiredFields) {
      if (!response[field]) {
        console.warn(`Missing required field: ${field}`);
      }
    }

    // Sanitize response to remove citation markers
    const sanitizedResponse = sanitizeArticleResponse(response);

    console.log(`Successfully generated interview article: "${sanitizedResponse.title}"`);

    return sendResponse(res, 200, true, { data: sanitizedResponse });

  } catch (error) {
    console.error('=== GENERATE INTERVIEW ARTICLE ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', error);
    console.error('=== END ERROR DEBUG ===');

    const errorResponse = handleApiError(error, 'generate-interview-article');
    return sendResponse(res, errorResponse.status, false, null, errorResponse.response.error);
  }
};

/**
 * Generate a replacement question for a specific position
 * POST /api/gemini/generate-replacement-question
 */
const handleGenerateReplacementQuestion = async (req, res) => {
  try {
    validateMethod(req, ['POST']);

    const body = sanitizeInput(req.body);
    validateRequiredFields(body, ['topic', 'currentQuestion']);

    const { topic, currentQuestion, allQuestions = [] } = body;

    // Validate inputs
    if (typeof topic !== 'string' || topic.trim().length === 0) {
      throw new Error('Topic must be a non-empty string');
    }

    if (typeof currentQuestion !== 'string' || currentQuestion.trim().length === 0) {
      throw new Error('Current question must be a non-empty string');
    }

    if (!Array.isArray(allQuestions)) {
      throw new Error('All questions must be an array');
    }

    const cleanTopic = topic.trim();
    const cleanCurrentQuestion = currentQuestion.trim();

    const prompt = `Generate 1 replacement question for the topic "${cleanTopic}".

Current question being replaced: "${cleanCurrentQuestion}"

Existing questions to avoid duplicating: ${JSON.stringify(allQuestions)}

Requirements:
- Create a SHORT, concise question about ${cleanTopic} for expert introduction
- Focus on background, experience, qualifications, achievements, or unique perspective
- Make it different from the current question and existing questions
- Keep it professional and engaging for an expert interview
- IMPORTANT: Keep the question between 15-120 characters (short and punchy)
- Use simple, direct language - avoid long, complex sentences
- Return only the question text, no additional formatting

Examples of good SHORT replacement questions:
- "What inspired you to specialize in ${cleanTopic}?"
- "How did you become an expert in ${cleanTopic}?"
- "What's your background in ${cleanTopic}?"
- "Why did you choose ${cleanTopic}?"
- "What makes you passionate about ${cleanTopic}?"

Return as JSON: { "question": "your replacement question here" }`;

    const response = await generateStructuredContent(prompt);

    // Validate response structure
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response structure from Gemini API');
    }

    if (!response.question || typeof response.question !== 'string') {
      throw new Error('Invalid response format: missing or invalid question field');
    }

    // Validate question length (concise intro questions)
    if (response.question.length < 15 || response.question.length > 150) {
      console.warn(`Generated question length: ${response.question.length} characters`);
      throw new Error(`Generated question length is outside acceptable bounds (${response.question.length} characters). Expected 15-150 characters for concise intro questions.`);
    }

    return sendResponse(res, 200, true, {
      question: stripCitations(response.question.trim())
    });

  } catch (error) {
    console.error('Generate replacement question error:', error);
    const errorResponse = handleApiError(error, 'generate-replacement-question');
    return sendResponse(res, errorResponse.status, false, null, errorResponse.response.error);
  }
};

/**
 * Sanitize article response by removing citation markers
 */
const sanitizeArticleResponse = (article) => {
  if (!article || typeof article !== 'object') return article;

  const sanitized = { ...article };

  // Sanitize title and subtitle
  if (sanitized.title) sanitized.title = stripCitations(sanitized.title);
  if (sanitized.subtitle) sanitized.subtitle = stripCitations(sanitized.subtitle);

  // Sanitize key takeaways
  if (Array.isArray(sanitized.key_takeaways)) {
    sanitized.key_takeaways = sanitized.key_takeaways.map(takeaway => stripCitations(takeaway));
  }

  // Sanitize intro
  if (sanitized.intro_md) sanitized.intro_md = stripCitations(sanitized.intro_md);

  // Sanitize FAQs
  if (Array.isArray(sanitized.faqs)) {
    sanitized.faqs = sanitized.faqs.map(faq => ({
      ...faq,
      question: stripCitations(faq.question || ''),
      answer_md: stripCitations(faq.answer_md || ''),
      real_results: stripCitations(faq.real_results || ''),
      takeaway: stripCitations(faq.takeaway || ''),
      section_title: stripCitations(faq.section_title || '')
    }));
  }

  // Sanitize tables
  if (Array.isArray(sanitized.tables)) {
    sanitized.tables = sanitized.tables.map(table => ({
      ...table,
      title: stripCitations(table.title || ''),
      headers: Array.isArray(table.headers) ? table.headers.map(h => stripCitations(h)) : [],
      rows: Array.isArray(table.rows) ? table.rows.map(row =>
        Array.isArray(row) ? row.map(cell => stripCitations(cell)) : row
      ) : []
    }));
  }

  // Sanitize checklists
  if (sanitized.checklists && typeof sanitized.checklists === 'object') {
    Object.keys(sanitized.checklists).forEach(key => {
      if (Array.isArray(sanitized.checklists[key])) {
        sanitized.checklists[key] = sanitized.checklists[key].map(item => stripCitations(item));
      }
    });
  }

  // Sanitize author
  if (sanitized.author && typeof sanitized.author === 'object') {
    if (sanitized.author.name) sanitized.author.name = stripCitations(sanitized.author.name);
    if (sanitized.author.bio) sanitized.author.bio = stripCitations(sanitized.author.bio);
  }

  // Sanitize CTA
  if (sanitized.cta && typeof sanitized.cta === 'object') {
    if (sanitized.cta.text) sanitized.cta.text = stripCitations(sanitized.cta.text);
  }

  // Sanitize metadata
  if (sanitized.metadata && typeof sanitized.metadata === 'object') {
    if (sanitized.metadata.meta_description) sanitized.metadata.meta_description = stripCitations(sanitized.metadata.meta_description);
  }

  return sanitized;
};

/**
 * Process answered questions into insight blocks
 * POST /api/gemini/process-insights
 */
const handleProcessInsights = async (req, res) => {
  try {
    validateMethod(req, ['POST']);

    const body = sanitizeInput(req.body);
    validateRequiredFields(body, ['topic', 'expertIntro', 'items']);

    const { topic, expertIntro, items, formatSpec = {} } = body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('items must be a non-empty array');
    }

    // Validate each item
    items.forEach((it, idx) => {
      if (!it || typeof it !== 'object' || !('id' in it) || !('question' in it) || !('answer' in it)) {
        throw new Error(`Invalid item at index ${idx}`);
      }
    });

    const prompt = `You are an expert editor. Convert each user-provided answer into a concise, high-clarity \"insight block\" using this exact format:

<paragraph summarizing/explaining their point in plain language>
Real Results: <one sentence concrete result or data point>
Takeaway: <one sentence actionable takeaway>

Rules:
- Keep paragraphs 2-4 sentences.
- CRITICAL: You MUST generate a Takeaway. If the user's answer is brief, infer a logical and actionable takeaway based on their expertise and the topic. Do not use "N/A" for the Takeaway unless the answer is completely empty or irrelevant.
- For "Real Results", if no specific data point is given, rephrase a key outcome or benefit the user described. Use "N/A" only if no result or outcome is mentioned at all.
- Do NOT invent facts. Only rephrase based on the user's answer.
- Maintain the user's voice where reasonable.
- Do not include citation markers like [1], [2].

Context:
Topic: ${topic}
Expert Intro: ${JSON.stringify(expertIntro)}

Produce STRICT JSON with this schema:
{
  "insights": [
    { "id": "string", "text": "string" }
  ]
}

Where id matches the input item's id exactly. For text, follow the format exactly with the labels "Real Results:" and "Takeaway:".`;

    const modelInput = {
      items: items.map(it => ({ id: String(it.id), question: it.question, answer: it.answer }))
    };

    const response = await generateStructuredContent(
      `${prompt}\n\nInput: ${JSON.stringify(modelInput)}`
    );

    // Validate response
    if (!response || !Array.isArray(response.insights)) {
      throw new Error('Invalid response structure from Gemini API');
    }

    // Sanitize and normalize
    const insights = response.insights.map((entry) => ({
      id: String(entry.id),
      text: stripCitations(typeof entry.text === 'string' ? entry.text.trim() : '') || 'N/A'
    }));

    // Ensure all ids present; fill missing as N/A
    const byId = Object.fromEntries(insights.map(x => [String(x.id), x.text]));
    const normalized = items.map(it => ({
      id: String(it.id),
      text: byId[String(it.id)] || 'N/A'
    }));

    return sendResponse(res, 200, true, { insights: normalized });
  } catch (error) {
    console.error('Process insights error:', error);
    const errorResponse = handleApiError(error, 'process-insights');
    return sendResponse(res, errorResponse.status, false, null, errorResponse.response.error);
  }
};

/**
 * Generate FAQ preview for a single question and answer
 * POST /api/gemini/faq-preview
 */
const handleFaqPreview = async (req, res) => {
  try {
    validateMethod(req, ['POST']);

    const body = sanitizeInput(req.body);
    validateRequiredFields(body, ['question', 'answer', 'topic']);

    const { question, answer, topic, expertIntro = {} } = body;

    // Validate inputs
    if (typeof question !== 'string' || question.trim().length === 0) {
      throw new Error('Question must be a non-empty string');
    }

    if (typeof answer !== 'string' || answer.trim().length === 0) {
      throw new Error('Answer must be a non-empty string');
    }

    if (typeof topic !== 'string' || topic.trim().length === 0) {
      throw new Error('Topic must be a non-empty string');
    }

    // Validate lengths
    if (question.length > 500) {
      throw new Error('Question must be 500 characters or less');
    }

    if (answer.length > 2000) {
      throw new Error('Answer must be 2000 characters or less');
    }

    const prompt = `Transform this single interview Q&A into a polished FAQ entry that would appear in a comprehensive article about "${topic}".

IMPORTANT: Use the provided answer as FOUNDATION and INSPIRATION, not literal text. Create enhanced, professional content that maintains the expert's voice while significantly improving clarity, depth, and SEO value.

Expert Background Context: ${JSON.stringify(expertIntro)}

Question: "${question}"
Answer: "${answer}"

Create a comprehensive FAQ entry with this EXACT structure:
{
  "question": "COPY THE EXACT QUESTION TEXT PROVIDED ABOVE - DO NOT MODIFY",
  "answer_md": "Write a comprehensive, AIO-optimized answer (4-6 sentences) that enhances the original response with professional tone, additional context, examples, and actionable insights while maintaining the expert's authentic voice. Start with the single best summary sentence, then supporting details.",
  "real_results": "Include concrete data/results from the answer and enhance with relevant statistics, case studies, or examples that support the expert's points. If no specific results mentioned, use 'None specified'.",
  "takeaway": "Create an actionable takeaway inspired by the expert's response - enhance with specific steps, best practices, or key insights (1 sentence, max 140 characters)."
}

REQUIREMENTS:
- QUESTION: Use the exact question text provided - do not modify or rephrase
- ANSWER: Enhance significantly while maintaining expert's voice and perspective
- REAL RESULTS: Extract or enhance concrete outcomes/data from the answer
- TAKEAWAY: Make it actionable and specific
- LENGTH: answer_md should be 4-6 sentences total
- STYLE: Professional, authoritative, and engaging
- ORIGINALITY: Do not copy answer wording verbatim - synthesize and enhance
- FORMATTING: DO NOT use asterisks (*) for emphasis, bold, or italic formatting. Use plain text only.

Return ONLY the JSON object with the exact structure above.`;

    const response = await generateStructuredContent(prompt);

    // Validate response structure
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response structure from Gemini API');
    }

    if (!response.question || !response.answer_md || !response.real_results || !response.takeaway) {
      throw new Error('Invalid response format: missing required fields');
    }

    // Sanitize citation markers
    const sanitizedResponse = {
      question: stripCitations(response.question),
      answer_md: stripCitations(response.answer_md),
      real_results: stripCitations(response.real_results),
      takeaway: stripCitations(response.takeaway)
    };

    return sendResponse(res, 200, true, sanitizedResponse);

  } catch (error) {
    console.error('FAQ preview error:', error);
    const errorResponse = handleApiError(error, 'faq-preview');
    return sendResponse(res, errorResponse.status, false, null, errorResponse.response.error);
  }
};

module.exports = {
  handler,
  handleIntroQuestions,
  handleArticleQuestions,
  handleGenerateArticle,
  handleGenerateSuggestions,
  handleConversationalResponse,
  handleProcessInsights,
  handleGenerateStructuredArticle,
  handleGenerateInterviewArticle,
  handleGenerateReplacementQuestion,
  handleFaqPreview
};