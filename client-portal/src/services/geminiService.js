/**
 * Gemini Service for AI Content Generation
 * Handles all AI-powered content generation via Firebase Functions
 */

// Firebase Functions base URL - will be set based on environment
const getFunctionsBaseUrl = () => {
  // Use the configured API base URL from environment
  return process.env.NEXT_PUBLIC_API_BASE_URL || '/api';
};

/**
 * Make API call to Firebase Functions
 * @param {string} endpoint - The endpoint path
 * @param {Object} data - Request data
 * @returns {Promise<Object>} - API response
 */
const callFirebaseFunction = async (endpoint, data) => {
  const baseUrl = getFunctionsBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || 'API call failed');
    }

    // Return the data payload directly for convenience
    return result.data;
  } catch (error) {
    console.error(`Firebase Function call failed (${endpoint}):`, error);
    throw error;
  }
};

/**
 * Retry logic with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Result of the function
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on certain error types
      if (error.message.toLowerCase().includes('authentication') ||
        error.message.toLowerCase().includes('permission') ||
        error.message.toLowerCase().includes('quota exceeded')) {
        throw error;
      }

      // If this is the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Generate 1 introduction question based on a topic
 * @param {string} topic - The article topic
 * @param {Object} options - Generation options including brand voice
 * @returns {Promise<string[]>} - Array of introduction questions
 */
export const generateIntroQuestions = async (topic, options = {}) => {
  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    throw new Error('Topic is required and must be a non-empty string');
  }

  const cleanTopic = topic.trim();

  const prompt = `Generate 1 SHORT, concise expert introduction question for someone writing about "${cleanTopic}". 

Focus on:
- Background/experience in this field
- Qualifications/credentials that establish expertise
- Notable achievements or success stories or unique perspective/passion

Requirements:
- IMPORTANT: Keep the question between 15-120 characters (short and punchy)
- Use simple, direct language - avoid long, complex sentences
- Make the question specific to ${cleanTopic} and avoid generic questions
- Question should be easy to answer in a voice interview

Examples of good SHORT intro questions:
- "What's your background in ${cleanTopic}?"
- "How did you become an expert in ${cleanTopic}?"
- "What makes you passionate about ${cleanTopic}?"

Return as JSON array with question text only.
Format: ["Question 1 text"]`;

  const fallbackQuestions = [
    `What's your background in ${cleanTopic}?`
  ];

  try {
    return await retryWithBackoff(async () => {
      const response = await callFirebaseFunction('/gemini/intro-questions', {
        topic: cleanTopic,
        brandVoice: options.brandVoice
      });

      const questions = response.questions;

      // Validate response format
      if (!Array.isArray(questions) || questions.length !== 1) {
        throw new Error('Invalid response format: expected array of 1 question');
      }

      // Validate the question is a non-empty string with proper length
      const validQuestions = questions.filter(q => {
        if (typeof q !== 'string' || q.trim().length === 0) {
          return false;
        }
        // Check length bounds for concise intro questions
        const length = q.trim().length;
        if (length < 15 || length > 150) {
          console.warn(`Intro question length out of bounds: ${length} characters - "${q}"`);
          return false;
        }
        return true;
      });

      if (validQuestions.length !== 1) {
        console.warn(`Only ${validQuestions.length} valid questions out of 1 generated`);
        throw new Error(`Invalid questions: expected 1 concise question (15-150 characters), got ${validQuestions.length} valid questions`);
      }

      return validQuestions;
    });
  } catch (error) {
    console.error('Error generating intro questions:', error);

    // Re-throw authentication and permission errors
    if (error.message.toLowerCase().includes('authentication') ||
      error.message.toLowerCase().includes('permission') ||
      error.message.toLowerCase().includes('quota exceeded')) {
      throw error;
    }

    // Return fallback questions on other failures
    console.warn('Using fallback intro questions due to generation failure');
    return fallbackQuestions;
  }
};

/**
 * Generate structured interview questions based on topic, count, and expert intro
 * @param {string} topic - The article topic
 * @param {number} questionCount - Number of questions to generate (5-40)
 * @param {Object} expertIntro - Expert introduction Q&A pairs
 * @param {Object} options - Generation options including brand voice
 * @returns {Promise<Object>} - Structured questions with sections
 */
export const generateArticleQuestions = async (topic, questionCount, expertIntro, options = {}) => {
  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    throw new Error('Topic is required and must be a non-empty string');
  }

  if (!questionCount || questionCount < 5 || questionCount > 40) {
    throw new Error('Question count must be between 5 and 40');
  }

  if (!expertIntro || typeof expertIntro !== 'object') {
    throw new Error('Expert intro is required and must be an object');
  }

  const cleanTopic = topic.trim();

  const prompt = `Based on this expert's background: ${JSON.stringify(expertIntro)}

Generate ${questionCount} detailed questions about "${cleanTopic}" that would create a comprehensive expert article.

Structure as sections with 5-8 questions each:
- Foundation/Basics (20% of questions): Core concepts, definitions, fundamentals
- Strategy/Implementation (30% of questions): Practical application, methodologies
- Advanced Techniques (25% of questions): Expert-level strategies, optimization
- Common Mistakes/Troubleshooting (15% of questions): Pitfalls, solutions, debugging
- Future Trends/Predictions (10% of questions): Industry outlook, emerging trends

Return as JSON with this exact structure:
{
  "sections": [
    {
      "title": "Section Name",
      "questions": [
        {
          "id": 1,
          "question": "Question text here"
        }
      ]
    }
  ]
}

Make questions specific to ${cleanTopic} and build on the expert's background. Ensure questions are detailed and would generate comprehensive answers.`;

  const fallbackSections = generateFallbackQuestions(cleanTopic, questionCount);

  try {
    return await retryWithBackoff(async () => {
      const response = await callFirebaseFunction('/gemini/article-questions', {
        topic: cleanTopic,
        questionCount: questionCount,
        expertIntro: expertIntro,
        brandVoice: options.brandVoice
      });

      const sections = response.sections;

      // Validate response structure
      if (!sections || !Array.isArray(sections)) {
        throw new Error('Invalid response format: expected sections array');
      }

      // Validate and normalize questions
      let totalQuestions = 0;
      const normalizedSections = sections.map((section, sectionIndex) => {
        if (!section.title || !section.questions || !Array.isArray(section.questions)) {
          throw new Error(`Invalid section format at index ${sectionIndex}`);
        }

        const normalizedQuestions = section.questions.map((q, qIndex) => {
          totalQuestions++;
          return {
            id: totalQuestions,
            question: q.question || q,
            sectionTitle: section.title
          };
        });

        return {
          title: section.title,
          questions: normalizedQuestions
        };
      });

      // Enforce exact question count by trimming excess questions
      if (totalQuestions !== questionCount) {
        console.warn(`Question count mismatch: expected ${questionCount}, got ${totalQuestions}. Trimming to exact count.`);
        
        // Trim questions to match the exact requested count
        let questionsToRemove = totalQuestions - questionCount;
        
        if (questionsToRemove > 0) {
          // Remove questions from the end of sections, starting with the last section
          for (let i = normalizedSections.length - 1; i >= 0 && questionsToRemove > 0; i--) {
            const section = normalizedSections[i];
            const questionsToRemoveFromSection = Math.min(questionsToRemove, section.questions.length);
            section.questions = section.questions.slice(0, section.questions.length - questionsToRemoveFromSection);
            questionsToRemove -= questionsToRemoveFromSection;
            
            // Remove empty sections
            if (section.questions.length === 0) {
              normalizedSections.splice(i, 1);
            }
          }
        } else if (questionsToRemove < 0) {
          // If we have fewer questions than requested, add generic ones to the last section
          const questionsToAdd = Math.abs(questionsToRemove);
          const lastSection = normalizedSections[normalizedSections.length - 1];
          
          for (let i = 0; i < questionsToAdd; i++) {
            totalQuestions++;
            lastSection.questions.push({
              id: totalQuestions,
              question: `What additional insights can you share about ${topic}?`,
              sectionTitle: lastSection.title
            });
          }
        }
        
        console.log(`✅ Adjusted to exactly ${questionCount} questions`);
      }

      return { sections: normalizedSections };
    });
  } catch (error) {
    console.error('Error generating article questions:', error);

    // Re-throw authentication and permission errors
    if (error.message.toLowerCase().includes('authentication') ||
      error.message.toLowerCase().includes('permission') ||
      error.message.toLowerCase().includes('quota exceeded')) {
      throw error;
    }

    // Return fallback questions on other failures
    console.warn('Using fallback article questions due to generation failure');
    return { sections: fallbackSections };
  }
};

/**
 * Generate fallback questions when AI generation fails
 * @param {string} topic - The article topic
 * @param {number} questionCount - Number of questions to generate
 * @returns {Array} - Fallback sections with questions
 */
const generateFallbackQuestions = (topic, questionCount) => {
  const sections = [
    {
      title: "Foundation and Basics",
      questions: [
        `What are the fundamental concepts everyone should know about ${topic}?`,
        `How would you define ${topic} to someone completely new to the field?`,
        `What are the most common misconceptions about ${topic}?`
      ]
    },
    {
      title: "Strategy and Implementation",
      questions: [
        `What's your recommended approach for getting started with ${topic}?`,
        `What are the key strategies that work best in ${topic}?`,
        `How do you implement ${topic} effectively in real-world scenarios?`,
        `What tools and resources do you recommend for ${topic}?`
      ]
    },
    {
      title: "Advanced Techniques",
      questions: [
        `What advanced techniques separate experts from beginners in ${topic}?`,
        `How do you optimize and improve results in ${topic}?`,
        `What are some lesser-known strategies in ${topic}?`
      ]
    },
    {
      title: "Common Mistakes and Troubleshooting",
      questions: [
        `What are the most common mistakes people make with ${topic}?`,
        `How do you troubleshoot problems in ${topic}?`,
        `What warning signs should people watch out for in ${topic}?`
      ]
    },
    {
      title: "Future Trends and Predictions",
      questions: [
        `Where do you see ${topic} heading in the next few years?`,
        `What emerging trends should people be aware of in ${topic}?`
      ]
    }
  ];

  // Flatten questions and assign IDs
  let questionId = 1;
  return sections.map(section => ({
    title: section.title,
    questions: section.questions.slice(0, Math.ceil(questionCount / sections.length)).map(question => ({
      id: questionId++,
      question,
      sectionTitle: section.title
    }))
  }));
};

/**
 * Generate final article from interview data
 * @param {Object} articleData - Complete article data with Q&As
 * @param {Object} options - Generation options including brand voice
 * @returns {Promise<Object>} - Generated article in structured format
 */
export const generateFinalArticle = async (articleData, options = {}) => {
  if (!articleData || typeof articleData !== 'object') {
    throw new Error('Article data is required and must be an object');
  }

  if (!articleData.topic || !articleData.setup || !articleData.questions) {
    throw new Error('Article data must include topic, setup, and questions');
  }

  // Prepare Q&A content for the prompt
  // Enhanced to handle both text and voice responses, with AI vs original labeling
  const questionAnswers = articleData.questions
    .filter(q => {
      // Check if question is answered via text or voice
      const hasTextAnswer = q.answered && q.answer && q.answer.trim().length > 0;
      const hasVoiceAnswer = q.voiceResponse && q.voiceResponse.transcription &&
        q.voiceResponse.transcription.trim().length > 0;
      return hasTextAnswer || hasVoiceAnswer;
    })
    .map(q => {
      // Use voice transcription if available, otherwise use text answer
      const answer = (q.voiceResponse && q.voiceResponse.transcription &&
        q.voiceResponse.transcription.trim().length > 0)
        ? q.voiceResponse.transcription
        : q.answer;

      // Determine if this is an AI-enhanced answer
      const isAiEnhanced = q.voiceResponse?.source === 'ai_enhanced';

      return {
        section: q.sectionTitle,
        question: q.question,
        answer: answer,
        // Include metadata about response type for quality assessment
        responseType: (q.voiceResponse && q.voiceResponse.transcription &&
          q.voiceResponse.transcription.trim().length > 0) ? 'voice' : 'text',
        confidence: q.voiceResponse?.confidence || 1.0,
        // Add label for article generation
        answerLabel: isAiEnhanced ? 'ai gen' : 'original'
      };
    });

  if (questionAnswers.length === 0) {
    throw new Error('No answered questions found in article data');
  }

  const articleTemplate = {
    metadata: {
      title: "",
      description: "",
      keywords: [],
      readingTime: 0,
      wordCount: 0
    },
    title: "",
    sections: [],
    keyTakeaways: [],
    authorBio: ""
  };

  const prompt = `Create a comprehensive expert article about "${articleData.topic}" using:

Expert Background: ${JSON.stringify(articleData.setup.expertIntro)}
Q&A Content: ${JSON.stringify(questionAnswers)}

Generate in this exact JSON structure: ${JSON.stringify(articleTemplate)}

IMPORTANT: Answer Processing Instructions:
- For answers labeled "ai gen": Use the provided answer verbatim without modification - these are already well-formatted AI-enhanced responses
- For answers labeled "original": Refine and improve the content as needed for better readability and structure

Requirements:
- SEO-optimized title with relevant emoji
- 5 key takeaways as bullet points
- Include 2-3 data tables with realistic statistics
- Add comparison tables where relevant
- Create actionable checklists (3-5 items each)
- Structure FAQ sections (5-8 Q&As)
- Include author bio based on expert intro
- Make content authoritative, data-driven, and actionable
- Use proper heading hierarchy (H2, H3, H4)
- Include internal linking suggestions
- Estimate reading time and word count

Structure sections as:
- Introduction
- Key concepts and foundations
- Practical strategies and implementation
- Advanced techniques and optimization
- Common mistakes and how to avoid them
- Future trends and predictions
- Conclusion with key takeaways
- FAQ section
- Author bio

Each section should be an object with:
{
  "type": "heading" | "paragraph" | "list" | "table" | "faq",
  "level": 2 | 3 | 4, // for headings
  "content": "text content or structured data"
}`;

  const fallbackArticle = generateFallbackArticle(articleData);

  try {
    return await retryWithBackoff(async () => {
      const response = await callFirebaseFunction('/gemini/generate-article', {
        topic: articleData.topic,
        expertIntro: articleData.setup.expertIntro,
        questions: articleData.questions,
        answers: questionAnswers,
        brandVoice: options.brandVoice
      });

      const article = response;

      // Validate response structure
      if (!article.title || !Array.isArray(article.sections) || !Array.isArray(article.keyTakeaways)) {
        throw new Error('Invalid article format: missing required fields');
      }

      // Ensure metadata exists
      if (!article.metadata) {
        article.metadata = {
          title: article.title,
          description: `Expert guide on ${articleData.topic}`,
          keywords: [articleData.topic],
          readingTime: Math.ceil(article.sections.length * 2), // Rough estimate
          wordCount: article.sections.length * 200 // Rough estimate
        };
      }

      // Validate sections structure
      article.sections.forEach((section, index) => {
        if (!section.type || !section.content) {
          throw new Error(`Invalid section format at index ${index}`);
        }
      });

      return article;
    }, 2); // Reduce retries for article generation due to complexity
  } catch (error) {
    console.error('Error generating final article:', error);

    // Re-throw authentication and permission errors
    if (error.message.toLowerCase().includes('authentication') ||
      error.message.toLowerCase().includes('permission') ||
      error.message.toLowerCase().includes('quota exceeded')) {
      throw error;
    }

    // Return fallback article on other failures
    console.warn('Using fallback article due to generation failure');
    return fallbackArticle;
  }
};

/**
 * Generate fallback article when AI generation fails
 * @param {Object} articleData - Article data
 * @returns {Object} - Fallback article structure
 */
const generateFallbackArticle = (articleData) => {
  const answeredQuestions = articleData.questions.filter(q => q.answered && q.answer.trim().length > 0);

  return {
    metadata: {
      title: `Expert Guide: ${articleData.topic}`,
      description: `Comprehensive guide on ${articleData.topic} based on expert insights`,
      keywords: [articleData.topic, 'expert guide', 'comprehensive'],
      readingTime: Math.ceil(answeredQuestions.length * 1.5),
      wordCount: answeredQuestions.length * 150
    },
    title: `🎯 Expert Guide: ${articleData.topic}`,
    sections: [
      {
        type: "heading",
        level: 2,
        content: "Introduction"
      },
      {
        type: "paragraph",
        content: `This comprehensive guide on ${articleData.topic} is based on expert insights and practical experience.`
      },
      ...answeredQuestions.map(q => [
        {
          type: "heading",
          level: 3,
          content: q.question
        },
        {
          type: "paragraph",
          content: q.answer
        }
      ]).flat(),
      {
        type: "heading",
        level: 2,
        content: "Key Takeaways"
      },
      {
        type: "list",
        content: [
          `Understanding ${articleData.topic} requires both theoretical knowledge and practical experience`,
          `Success in ${articleData.topic} depends on consistent application of proven strategies`,
          `Avoiding common mistakes is crucial for achieving results in ${articleData.topic}`,
          `Staying updated with trends helps maintain expertise in ${articleData.topic}`,
          `Expert guidance can significantly accelerate learning in ${articleData.topic}`
        ]
      }
    ],
    keyTakeaways: [
      `Master the fundamentals of ${articleData.topic}`,
      `Apply proven strategies consistently`,
      `Learn from common mistakes`,
      `Stay updated with industry trends`,
      `Seek expert guidance when needed`
    ],
    authorBio: articleData.setup.expertIntro?.answer1 || `Expert in ${articleData.topic} with extensive practical experience.`
  };
};

/**
 * Validate article data structure
 * @param {Object} data - Data to validate
 * @returns {boolean} - Whether data is valid
 */
const validateArticleData = (data) => {
  if (!data || typeof data !== 'object') return false;
  if (!data.topic || typeof data.topic !== 'string') return false;
  if (!data.setup || typeof data.setup !== 'object') return false;
  if (!data.questions || !Array.isArray(data.questions)) return false;

  return true;
};

/**
 * Generate personalized conversation starters for a question
 * @param {string} question - The interview question
 * @param {Object} expertIntro - Expert introduction Q&A pairs
 * @param {Object} context - Additional context (optional)
 * @returns {Promise<Object>} - Object with suggestions array
 */
export const generateQuestionSuggestions = async (question, expertIntro, context = {}) => {
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    throw new Error('Question is required and must be a non-empty string');
  }

  if (!expertIntro || typeof expertIntro !== 'object') {
    throw new Error('Expert intro is required and must be an object');
  }

  const cleanQuestion = question.trim();

  const prompt = `Based on this expert's background: ${JSON.stringify(expertIntro)}

Generate 3-4 conversation starter suggestions for this question: "${cleanQuestion}"

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

  const fallbackSuggestions = generateFallbackSuggestions(cleanQuestion, expertIntro);

  try {
    return await retryWithBackoff(async () => {
      const response = await callFirebaseFunction('/gemini/generate-suggestions', {
        question: cleanQuestion,
        expertIntro: expertIntro,
        context: context
      });

      const suggestions = response.suggestions;

      // Validate response format
      if (!Array.isArray(suggestions) || suggestions.length < 3) {
        throw new Error('Invalid response format: expected array of at least 3 suggestions');
      }

      // Validate each suggestion
      const validSuggestions = suggestions.filter(s =>
        typeof s === 'string' &&
        s.trim().length > 0 &&
        s.length <= 100 &&
        s.split(' ').length <= 15 // Reasonable word limit
      );

      if (validSuggestions.length < 3) {
        throw new Error('Insufficient valid suggestions generated');
      }

      return { suggestions: validSuggestions.slice(0, 4) }; // Limit to 4 suggestions
    });
  } catch (error) {
    console.error('Error generating question suggestions:', error);

    // Re-throw authentication and permission errors
    if (error.message.toLowerCase().includes('authentication') ||
      error.message.toLowerCase().includes('permission') ||
      error.message.toLowerCase().includes('quota exceeded')) {
      throw error;
    }

    // Return fallback suggestions on other failures
    console.warn('Using fallback suggestions due to generation failure');
    return { suggestions: fallbackSuggestions };
  }
};

export const generateFaqPreview = async ({ prompt, schema, timeoutMs = 60000 } = {}) => {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Prompt is required and must be a non-empty string');
  }

  const effectiveSchema = schema || {
    required: ['question', 'answer_md', 'real_results', 'takeaway']
  };

  const timeout = Math.max(1000, timeoutMs);
  const timeoutError = new Error('Gemini FAQ preview generation timed out');

  let timer;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(timeoutError), timeout);
    });

    const result = await Promise.race([
      retryWithBackoff(async () => {
        const { generateStructuredContent } = await import('../lib/gemini.js');
        return await generateStructuredContent(prompt, effectiveSchema);
      }, 2, 1200),
      timeoutPromise
    ]);

    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response format from Gemini FAQ preview generation');
    }

    return result;
  } catch (error) {
    console.error('Error generating FAQ preview:', error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Generate fallback suggestions when AI generation fails
 * @param {string} question - The interview question
 * @param {Object} expertIntro - Expert introduction data
 * @returns {Array} - Fallback suggestions
 */
const generateFallbackSuggestions = (question, expertIntro) => {
  // Extract key topics from expert intro
  const introText = Object.values(expertIntro).join(' ').toLowerCase();

  // Generic conversation starters that work for most questions
  const genericSuggestions = [
    "Share a specific example from your experience",
    "Discuss the most important aspect to consider",
    "Explain your proven approach to this",
    "Describe a common mistake to avoid"
  ];

  // Try to personalize based on intro content
  const personalizedSuggestions = [];

  if (introText.includes('business') || introText.includes('company')) {
    personalizedSuggestions.push("Share a business example that illustrates this");
  }

  if (introText.includes('client') || introText.includes('customer')) {
    personalizedSuggestions.push("Discuss a client situation that demonstrates this");
  }

  if (introText.includes('team') || introText.includes('manage')) {
    personalizedSuggestions.push("Explain how you've handled this with teams");
  }

  if (introText.includes('challenge') || introText.includes('problem')) {
    personalizedSuggestions.push("Describe how you've overcome this challenge");
  }

  // Combine personalized and generic suggestions
  const allSuggestions = [...personalizedSuggestions, ...genericSuggestions];

  // Return 4 unique suggestions
  return [...new Set(allSuggestions)].slice(0, 4);
};

/**
 * Generate conversational response for voice interview flow
 * @param {string} question - The interview question
 * @param {string} userResponse - User's response to the question
 * @param {Object} context - Conversation context
 * @param {boolean} needsFollowUp - Whether this is a follow-up request
 * @returns {Promise<Object>} - Conversational response object
 */
export const generateConversationalResponse = async (question, userResponse, context, needsFollowUp = false) => {
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    throw new Error('Question is required and must be a non-empty string');
  }

  if (!userResponse || typeof userResponse !== 'string' || userResponse.trim().length === 0) {
    throw new Error('User response is required and must be a non-empty string');
  }

  if (!context || typeof context !== 'object') {
    throw new Error('Context is required and must be an object');
  }

  const cleanQuestion = question.trim();
  const cleanUserResponse = userResponse.trim();

  let prompt;

  if (needsFollowUp) {
    prompt = `As an expert interviewer, the user just answered: "${cleanUserResponse}" to the question: "${cleanQuestion}".

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
    prompt = `Generate a natural transition to ask this question: "${cleanQuestion}"

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

  const fallbackResponse = generateFallbackConversationalResponse(cleanQuestion, cleanUserResponse, context, needsFollowUp);

  try {
    return await retryWithBackoff(async () => {
      const response = await callFirebaseFunction('/gemini/conversational-response', {
        question: cleanQuestion,
        userResponse: cleanUserResponse,
        context: context,
        needsFollowUp: needsFollowUp
      });

      // Validate response structure
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response format: expected object');
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

      return normalizedResponse;
    });
  } catch (error) {
    console.error('Error generating conversational response:', error);

    // Re-throw authentication and permission errors
    if (error.message.toLowerCase().includes('authentication') ||
      error.message.toLowerCase().includes('permission') ||
      error.message.toLowerCase().includes('quota exceeded')) {
      throw error;
    }

    // Return fallback response on other failures
    console.warn('Using fallback conversational response due to generation failure');
    return fallbackResponse;
  }
};

/**
 * Generate fallback conversational response when AI generation fails
 * @param {string} question - The interview question
 * @param {string} userResponse - User's response
 * @param {Object} context - Conversation context
 * @param {boolean} needsFollowUp - Whether this is a follow-up
 * @returns {Object} - Fallback conversational response
 */
const generateFallbackConversationalResponse = (question, userResponse, context, needsFollowUp) => {
  if (needsFollowUp) {
    // Analyze response length to determine if more detail is needed
    const wordCount = userResponse.split(' ').length;
    const needsMore = wordCount < 20; // Less than 20 words is considered brief

    if (needsMore) {
      return {
        response: "That's a great start! Could you share a specific example or go into more detail?",
        needsMoreDetail: true,
        readyForNext: false,
        conversationType: 'followup'
      };
    } else {
      return {
        response: "Excellent insight! That gives us a comprehensive understanding. Ready for the next question?",
        needsMoreDetail: false,
        readyForNext: true,
        conversationType: 'followup'
      };
    }
  } else {
    // Generate transition to new question
    const questionNumber = context.questionNumber || 1;
    const section = context.section || 'interview';

    if (questionNumber === 1) {
      return {
        response: `Great! Let's begin with our first question about ${section.toLowerCase()}.`,
        conversationType: 'transition'
      };
    } else {
      return {
        response: `Perfect! Now let's explore the next aspect of ${section.toLowerCase()}.`,
        conversationType: 'transition'
      };
    }
  }
};

/**
 * Check if Gemini service is available
 * @returns {Promise<boolean>} - Whether service is available
 */
export const isGeminiServiceAvailable = async () => {
  try {
    // Try a simple generation to test availability
    const result = await retryWithBackoff(async () => {
      return await callFirebaseFunction('/gemini/intro-questions', {
        topic: 'test'
      });
    }, 1); // Only try once for availability check

    // 'result' is the data payload
    return Array.isArray(result.questions);
  } catch (error) {
    console.error('Gemini service availability check failed:', error);
    return false;
  }
};

/**
 * Get service status and configuration
 * @returns {Object} - Service status information
 */
export const getServiceStatus = () => {
  return {
    configured: !!process.env.GEMINI_API_KEY,
    hasApiKey: !!process.env.GEMINI_API_KEY,
    retryEnabled: true,
    fallbackEnabled: true
  };
};

/**
 * Generate a replacement question for a specific position in the intro questions
 * @param {string} topic - The article topic
 * @param {string} currentQuestion - The question being replaced
 * @param {Array} allQuestions - Array of all current questions to avoid duplicates
 * @returns {Promise<string>} - A new replacement question
 */
export const generateReplacementQuestion = async (topic, currentQuestion, allQuestions = []) => {
  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    throw new Error('Topic is required and must be a non-empty string');
  }

  if (!currentQuestion || typeof currentQuestion !== 'string' || currentQuestion.trim().length === 0) {
    throw new Error('Current question is required and must be a non-empty string');
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

  const fallbackQuestion = generateFallbackReplacementQuestion(cleanTopic, allQuestions);

  try {
    return await retryWithBackoff(async () => {
      const response = await callFirebaseFunction('/gemini/generate-replacement-question', {
        topic: cleanTopic,
        currentQuestion: cleanCurrentQuestion,
        allQuestions: allQuestions
      });

      const question = response.question;

      console.log('🔍 Generated replacement question:', question);
      console.log('📏 Question length:', question?.length, 'characters');

      // Validate response format
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        throw new Error('Invalid response format: expected non-empty question string');
      }

      // Validate question length (concise intro questions)
      if (question.length < 15 || question.length > 150) {
        console.warn(`Generated question length: ${question.length} characters`);
        console.warn(`Question content: "${question}"`);
        throw new Error(`Generated question length is outside acceptable bounds (${question.length} characters). Expected 15-150 characters for concise intro questions.`);
      }

      return question.trim();
    });
  } catch (error) {
    console.error('Error generating replacement question:', error);

    // Re-throw authentication and permission errors
    if (error.message.toLowerCase().includes('authentication') ||
      error.message.toLowerCase().includes('permission') ||
      error.message.toLowerCase().includes('quota exceeded')) {
      throw error;
    }

    // Return fallback question on other failures
    console.warn('Using fallback replacement question due to generation failure');
    return fallbackQuestion;
  }
};

/**
 * Generate fallback replacement question when AI generation fails
 * @param {string} topic - The article topic
 * @param {Array} allQuestions - Array of existing questions to avoid
 * @returns {string} - Fallback replacement question
 */
const generateFallbackReplacementQuestion = (topic, allQuestions = []) => {
  const fallbackOptions = [
    `What inspired you to specialize in ${topic}?`,
    `How did you become an expert in ${topic}?`,
    `What's your background in ${topic}?`,
    `Why did you choose ${topic}?`,
    `What makes you passionate about ${topic}?`,
    `How long have you worked in ${topic}?`,
    `What's unique about your ${topic} approach?`,
    `What drives your interest in ${topic}?`
  ];

  // Filter out questions that are too similar to existing ones
  const availableOptions = fallbackOptions.filter(option => {
    return !allQuestions.some(existing => {
      if (typeof existing !== 'string') return false;
      const similarity = calculateQuestionSimilarity(option, existing);
      return similarity > 0.6; // 60% similarity threshold
    });
  });

  // Return a random available option, or the first one if all are used
  return availableOptions.length > 0
    ? availableOptions[Math.floor(Math.random() * availableOptions.length)]
    : fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
};

/**
 * Simple similarity calculation for question filtering
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score between 0 and 1
 */
const calculateQuestionSimilarity = (str1, str2) => {
  const words1 = str1.toLowerCase().split(' ');
  const words2 = str2.toLowerCase().split(' ');
  const commonWords = words1.filter(word => words2.includes(word));
  return commonWords.length / Math.max(words1.length, words2.length);
};

/**
 * Process answered questions into insight blocks (exclude intro)
 * Each block format example:
 *   Paragraph explaining the concept
 *   Real Results: <one-liner or N/A>
 *   Takeaway: <one-liner or N/A>
 * @param {Object} articleData - Article data with questions
 * @returns {Promise<Object>} - Map of questionId (string) -> processedInsight (string)
 */
export const processAnswersIntoInsights = async (articleData) => {
  if (!articleData || !Array.isArray(articleData.questions)) {
    throw new Error('Invalid article data for processing insights');
  }

  // Filter answered, non-intro questions
  const answered = articleData.questions.filter(q => {
    const hasText = (q.answered && typeof q.answer === 'string' && q.answer.trim().length > 0);
    const hasVoice = (q.voiceResponse && typeof q.voiceResponse.transcription === 'string' && q.voiceResponse.transcription.trim().length > 0);
    const sectionName = (q.sectionTitle || q.section || '').trim().toLowerCase();
    // Only exclude true expert intro sections/questions
    const isIntro = Boolean(q.isIntro) || sectionName === 'introduction' || sectionName.startsWith('intro ') || sectionName.includes('expert intro');
    return (hasText || hasVoice) && !isIntro;
  });

  if (answered.length === 0) {
    return {};
  }

  const items = answered.map(q => ({
    id: String(q.id),
    section: q.sectionTitle || q.section || 'General',
    question: q.question,
    answer: (q.voiceResponse && q.voiceResponse.transcription && q.voiceResponse.transcription.trim().length > 0)
      ? q.voiceResponse.transcription
      : q.answer
  }));

  // Early guard: if no items, skip API
  if (!Array.isArray(items) || items.length === 0) {
    return {};
  }

  // Lightweight debug to aid diagnostics
  try { console.debug('processAnswersIntoInsights items:', { count: items.length, ids: items.slice(0, 10).map(it => it.id) }); } catch { }

  const fallbackMap = Object.fromEntries(items.map(it => [it.id, 'N/A']));

  try {
    const result = await retryWithBackoff(async () => {
      return await callFirebaseFunction('/gemini/process-insights', {
        topic: articleData.topic,
        expertIntro: articleData.setup?.expertIntro || {},
        items,
        // Provide strict instructions to the function/model for formatting
        formatSpec: {
          requireSections: ['paragraph', 'real_results', 'takeaway'],
          labels: { realResults: 'Real Results:', takeaway: 'Takeaway:' },
          naFallback: 'N/A'
        }
      });
    }, 3, 1200);

    // Expecting { insights: [{ id, text }] }
    const insights = Array.isArray(result?.insights) ? result.insights : [];

    const map = {};
    for (const it of items) {
      const found = insights.find(x => String(x.id) === String(it.id));
      const text = typeof found?.text === 'string' && found.text.trim().length > 0 ? found.text.trim() : null;
      map[String(it.id)] = text || `N/A`;
    }
    return map;
  } catch (error) {
    console.error('Error processing insights, returning fallbacks:', error);
    return fallbackMap; // On failure, return N/A for all
  }
};