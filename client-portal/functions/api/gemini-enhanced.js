const { generateStructuredContent } = require('../lib/gemini');
const { validateMethod, validateRequiredFields, sanitizeInput, handleApiError, sendResponse } = require('../lib/api-utils');
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
 * Extract user ID from Firebase Auth token
 * @param {Object} req - Express request object
 * @returns {Promise<string|null>} User ID or null
 */
const extractUserIdFromToken = async (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('Error extracting user ID from token:', error);
    return null;
  }
};

// Helper to strip grounding-style citation markers from text
const stripCitations = (text) => {
  if (typeof text !== 'string') return text;
  let cleaned = text.replace(/\s*\[(?:\d+[\s,]*)+\]\s*$/g, '');
  cleaned = cleaned.replace(/\[(\d+)\]/g, '');
  return cleaned.replace(/\s{2,}/g, ' ').trim();
};

// Sanitize article response to remove citation markers
const sanitizeArticleResponse = (response) => {
  if (!response || typeof response !== 'object') return response;

  const sanitized = { ...response };

  if (sanitized.intro_md) {
    sanitized.intro_md = stripCitations(sanitized.intro_md);
  }

  if (Array.isArray(sanitized.faqs)) {
    sanitized.faqs = sanitized.faqs.map(faq => ({
      ...faq,
      answer_md: stripCitations(faq.answer_md || ''),
      real_results: stripCitations(faq.real_results || ''),
      takeaway: stripCitations(faq.takeaway || '')
    }));
  }

  return sanitized;
};

/**
 * Generate structured article from interview data with AI enhancement differentiation
 * POST /api/gemini/generate-interview-article-enhanced
 * 
 * This endpoint differentiates between AI-enhanced answers and original answers,
 * applying appropriate processing strategies to each type.
 */
const handleGenerateInterviewArticleEnhanced = async (req, res) => {
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

    // Extract user ID and fetch brand voice settings
    const userId = await extractUserIdFromToken(req);
    let brandVoiceSettings = null;

    if (userId) {
      try {
        brandVoiceSettings = await getUserBrandVoiceSettings(userId);
        if (brandVoiceSettings) {
          console.log('🎯 BRAND VOICE: Loaded settings for enhanced interview generation');
        }
      } catch (error) {
        console.error('Error fetching brand voice settings:', error);
      }
    }

    // Normalize intro Q&A pairs
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

        // Determine if this is an AI-enhanced answer - CRITICAL LOGIC
        const isAiEnhanced = q.voiceResponse?.source === 'ai_enhanced' ||
          q.source === 'ai_enhanced' ||
          q.aiEnhanced === true;

        // Extract AI preview data if available (includes separate takeaway, real_results, etc.)
        const aiPreviewData = q.voiceResponse?.aiPreviewData || null;

        return {
          index: index + 1,
          id: q.id ?? index,
          questionText,
          answerText,
          answerLabel: isAiEnhanced ? 'ai gen' : 'original',
          // Include structured AI data for proper FAQ generation
          aiTakeaway: aiPreviewData?.takeaway || null,
          aiRealResults: aiPreviewData?.real_results || null
        };
      });

    const topicQuestionsText = topicQuestionEntries
      .map(entry => {
        let text = `Question ${entry.index}: ${entry.questionText}\nAnswer [${entry.answerLabel}]: ${entry.answerText}`;

        // Add structured AI data if available
        if (entry.answerLabel === 'ai gen' && (entry.aiTakeaway || entry.aiRealResults)) {
          if (entry.aiRealResults) {
            text += `\nReal Results: ${entry.aiRealResults}`;
          }
          if (entry.aiTakeaway) {
            text += `\nTakeaway: ${entry.aiTakeaway}`;
          }
        }

        return text;
      })
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

    const prompt = `Transform this expert interview into a comprehensive, SEO-optimized article using AIO principles.

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations. Start with { and end with }.${referenceLinkInstructions}

IMPORTANT OUTPUT POLICY:
- Do NOT copy interview answers verbatim. Use them as context and inspiration.
- Write entirely new, original prose reflecting the expert's ideas, not their wording.
- The ONLY text to copy verbatim: TOPIC interview questions (for TOC and FAQ question fields).
- CRITICAL: Do NOT use asterisks (*) anywhere in output. Use plain text only.

🚨 CRITICAL: AI Enhancement Differentiation 🚨
Answers are labeled [ai gen] or [original]:
- [ai gen]: ALREADY well-formatted, professional AI-enhanced responses. Use with MINIMAL modification - they have good structure, grammar, tone. Only adjust if necessary for flow.
  - IMPORTANT: If [ai gen] answers include "Real Results:" and "Takeaway:" fields, use them DIRECTLY in the FAQ output. Do NOT merge them into answer_md.
  - Keep Real Results → real_results field
  - Keep Takeaway → takeaway field
  - Keep Answer → answer_md field
- [original]: Raw voice/text responses. Apply FULL enhancement - improve grammar, structure, tone, add examples, expand content.

Persona & Voice:
- Write in expert's first-person voice (use "I", "my", "we").
- Do NOT use third person ("the expert", "they", "the user").
- Do NOT mention interviews, prompts, or content generation.

Interview Topic: "${topic}"

Expert Background:
${expertBackgroundText || 'None provided.'}

Intro Responses (for introduction and author bio only):
${introQuestionsText || 'No intro responses.'}

Topic Responses (labeled for enhancement guidance):
${topicQuestionsText || 'No topic responses.'}

Topic Question List (copy verbatim to TOC/FAQ):
${topicQuestionListText || 'No questions.'}

Topic Question Count: ${topicQuestionCount}

Enhancement Strategy:
- [ai gen]: Minimal changes - preserve structure and insights
- [original]: Full enhancement - grammar, tone, depth, examples

Grounding & Citations:
- Add facts/statistics only from credible sources.
- Include source URLs in "citations" array for each FAQ.
- Omit claims without reliable sources. Never fabricate data.

JSON Output Requirements:
- Single valid JSON object only. No code fences, no extra text.
- Double quotes for keys and strings. Escape special characters.
- Do NOT add fields beyond specification.

{
  "title": "Engaging title, max 120 chars",
  "subtitle": "Compelling subtitle, max 160 chars",
  "key_takeaways": ["3-5 takeaways, each ≤100 chars"],
  "intro_md": "2-3 paragraphs, first-person voice, max 700 chars. Plain text - NO asterisks, NO markdown, NO bold, NO italic.",
  "toc": [{"section_title": "Interview Questions", "questions": ${topicQuestionCount > 0 ? '["Topic questions in order"]' : '[]'}}],
  "faqs": [${topicQuestionCount > 0 ? '{"section_title": "Frequently Asked Questions", "question": "Topic question", "answer_md": "Enhanced based on label - minimal for [ai gen], full for [original]. Max 900 chars. Plain text only.", "real_results": "Concrete results or None", "takeaway": "≤140 chars", "citations": ["URLs for added facts"]}' : ''}],
  "tables": [{"title": "≤80 chars", "headers": ["2-5 headers"], "rows": [["5 rows max, grounded data"]]}],
  "checklists": {"launch": ["3-7 steps, ≤100 chars each"], "post_contest": ["3-7 steps"]},
  "author": {"name": "Expert name or Unknown", "bio": "1-2 original sentences from background"},
  "cta": {"text": "≤80 chars", "url": "#"},
  "metadata": {"meta_description": "120-158 chars SEO description"}
}

REQUIREMENTS:
- ORIGINALITY: Paraphrase everywhere except topic questions.
- AI DIFFERENTIATION: Respect [ai gen] vs [original] labels - this is CRITICAL.
- INTRO VS TOPIC: Intro for intro/bio only. Topic for TOC/FAQ/body.
- QUESTIONS: Copy topic question list verbatim for TOC and FAQ question fields.
- FAQ COUNT: ${topicQuestionCount > 0 ? `Exactly ${topicQuestionCount} FAQ item${topicQuestionCount === 1 ? '' : 's'} in same order` : 'Empty array if no questions'}.
- ENHANCEMENT: Full for [original], minimal for [ai gen]. This preserves quality of AI-enhanced answers.`;

    console.log(`[ENHANCED] Generating for: "${topic}" (${questions.length} questions)`);
    console.log(`[ENHANCED] AI-enhanced answers: ${topicQuestionEntries.filter(e => e.answerLabel === 'ai gen').length}`);
    console.log(`[ENHANCED] Original answers: ${topicQuestionEntries.filter(e => e.answerLabel === 'original').length}`);

    const startTime = Date.now();
    const response = await generateStructuredContent(prompt, null, {
      brandVoiceSettings: brandVoiceSettings
    });
    const generationTime = Date.now() - startTime;

    console.log(`[ENHANCED] Generated in ${generationTime}ms`);

    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response structure from Gemini API');
    }

    const requiredFields = ['title'];
    for (const field of requiredFields) {
      if (!response[field]) {
        console.warn(`Missing required field: ${field}`);
      }
    }

    const sanitizedResponse = sanitizeArticleResponse(response);
    console.log(`[ENHANCED] Success: "${sanitizedResponse.title}"`);

    return sendResponse(res, 200, true, { data: sanitizedResponse });

  } catch (error) {
    console.error('[ENHANCED] Error:', error.message);
    console.error('[ENHANCED] Stack:', error.stack);
    const errorResponse = handleApiError(error, 'generate-interview-article-enhanced');
    return sendResponse(res, errorResponse.status, false, null, errorResponse.response.error);
  }
};

module.exports = {
  handleGenerateInterviewArticleEnhanced
};
