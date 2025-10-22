'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
// import { deductCreditsAtomic, refundCredits } from '@/services/creditService';
import styles from './KeywordCreate.module.css';
import SectionOrderConfig from '@/components/SectionOrderConfig/SectionOrderConfig';
import { convertJsonToGutenbergHtml, getDefaultSectionOrder } from '@/utils/articleConverter';


// Map low-level/network errors to friendly messages for users
function mapToFriendlyError(error, context = 'action') {
  const raw = (error?.message || '').toString();

  // Common network/cors/browser fetch errors
  const isFetchFailure = /failed to fetch|networkerror|load failed|network request failed/i.test(raw);
  const isTimeout = /timeout|timed out|exceeded/i.test(raw);

  if (isFetchFailure) {
    return 'We’re having trouble reaching the server right now. It’s likely a temporary hiccup. Please try again in a minute.';
  }
  if (isTimeout) {
    return 'This is taking longer than expected. Please try again shortly.';
  }

  // Generic friendly fallback per context
  if (context === 'generate') {
    return 'Something went wrong while generating your article. Please try again in a minute.';
  }
  if (context === 'docs') {
    return 'Couldn’t create the Google Doc right now. Please try again in a minute.';
  }

  return 'Something went wrong. Please try again in a minute.';
}

export default function CreateFromKeywordPage() {
  const [keyword, setKeyword] = useState('');
  const [referenceLink, setReferenceLink] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkFrequency, setLinkFrequency] = useState(2);
  const [jsonUploadError, setJsonUploadError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [generationStep, setGenerationStep] = useState('');
  const [generatedArticle, setGeneratedArticle] = useState(null);
  const [isConvertingToDocs, setIsConvertingToDocs] = useState(false);
  const [googleDocUrl, setGoogleDocUrl] = useState(null);
  const [generationStartTime, setGenerationStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [targetProgress, setTargetProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // const [showCreditConfirmation, setShowCreditConfirmation] = useState(false);
  const [generationLock, setGenerationLock] = useState(false);

  const fileInputRef = useRef(null);
  const { user, brandVoiceSettings, brandVoiceLoading } = useAuth();
  const { subscriptionTier } = useAuth();
  // const { credits, creditsUsed, creditsRemaining, refetch: refetchSubscription } = useSubscription(user?.uid);
  const router = useRouter();

  // Brand voice state
  const [brandModeEnabled, setBrandModeEnabled] = useState(false);

  // Section order configuration
  const [showSectionOrderModal, setShowSectionOrderModal] = useState(false);
  const [sectionOrder, setSectionOrder] = useState(() => {
    // Always use default order on initial render for SSR consistency
    return getDefaultSectionOrder();
  });

  // Load and migrate section order from localStorage after mount
  useEffect(() => {
    // Clean up old CTA toggle setting (no longer used)
    localStorage.removeItem('queryfuel_show_cta');
    
    const saved = localStorage.getItem('queryfuel_section_order');
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const defaultOrder = getDefaultSectionOrder();
        
        // Migrate old saved order to include any new sections
        const defaultIds = defaultOrder.map(s => s.id);
        const savedIds = parsed.map(s => s.id);
        
        // Remove sections that no longer exist (including author_cta)
        const validSections = parsed.filter(s => defaultIds.includes(s.id) && s.id !== 'author_cta');
        
        // Add new sections that weren't in the saved order
        const newSections = defaultOrder.filter(s => !savedIds.includes(s.id));
        
        // If migration is needed, merge and auto-save
        if (validSections.length !== parsed.length || newSections.length > 0) {
          const migratedOrder = [...validSections, ...newSections];
          localStorage.setItem('queryfuel_section_order', JSON.stringify(migratedOrder));
          console.log('✨ Migrated section order (removed author_cta)');
          setSectionOrder(migratedOrder);
        } else {
          setSectionOrder(validSections);
        }
      } catch (e) {
        setSectionOrder(getDefaultSectionOrder());
      }
    }
  }, []);

  // Tier-based question count limits
  const getQuestionCountLimits = (tier) => {
    if (!tier) return { min: 5, max: 5, isFixed: true }; // Free tier default

    const tierLower = tier.toLowerCase();
    if (tierLower === 'starter' || tierLower === 'free') {
      return { min: 5, max: 5, isFixed: true };
    } else if (tierLower === 'growth') {
      return { min: 5, max: 15, isFixed: false };
    } else if (tierLower === 'client') {
      // Client tier gets same limits as Growth (agency controls via credits)
      return { min: 5, max: 15, isFixed: false };
    } else {
      // Scale, Agency, or any other tier gets full range
      return { min: 5, max: 40, isFixed: false };
    }
  };

  const questionLimits = getQuestionCountLimits(subscriptionTier);

  // Question count state with tier-based default
  const [questionCount, setQuestionCount] = useState(
    Math.min(Math.max(15, questionLimits.min), questionLimits.max)
  );

  // Validation function to ensure question count stays within tier limits
  const handleQuestionCountChange = (newValue) => {
    const clampedValue = Math.min(Math.max(newValue, questionLimits.min), questionLimits.max);
    setQuestionCount(clampedValue);
  };




  // Track elapsed time during generation
  useEffect(() => {
    let interval;
    if (isGenerating && generationStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - generationStartTime) / 1000);
        setElapsedTime(elapsed);

        // Update generation step and target progress based on elapsed time
        // if (elapsed > 150) { // 2.5 minutes - show timeout warning
        //   setGenerationStep('⚠️ Taking longer than expected... Article generation will timeout in 30 seconds.');
        //   setTargetProgress((prev) => Math.max(prev, 95));
        // } else if (elapsed > 120) { // 2 minutes - show extended time warning
        //   setGenerationStep('⏰ Still working... Quality content takes time. Will timeout in 1 minute if not complete.');
        //   setTargetProgress((prev) => Math.max(prev, 90));
        // } else
        if (elapsed > 45) {
          setGenerationStep('Still working... AI is crafting a comprehensive article. This may take up to 2 minutes for quality content...');
          setTargetProgress((prev) => Math.max(prev, 85));
        } else if (elapsed > 30) {
          setGenerationStep('Optimizing content structure... Almost there...');
          setTargetProgress((prev) => Math.max(prev, 80));
        } else if (elapsed > 20) {
          setGenerationStep('Generating detailed sections and FAQs...');
          setTargetProgress((prev) => Math.max(prev, 65));
        } else if (elapsed > 10) {
          setGenerationStep('Creating tables and checklists...');
          setTargetProgress((prev) => Math.max(prev, 50));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGenerating, generationStartTime]);

  // Prevent navigation during generation
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isGenerating) {
        // Modern browsers require both preventDefault and returnValue
        e.preventDefault();
        e.returnValue = ''; // Some browsers show a generic message
        return ''; // Return empty string for generic dialog
      }
    };

    // Also try to intercept popstate (back/forward buttons)
    const handlePopState = (e) => {
      if (isGenerating) {
        const confirmLeave = window.confirm(
          'Article generation is in progress. Going back will cancel the generation. Are you sure you want to continue?'
        );
        if (!confirmLeave) {
          // Push the current state back to prevent navigation
          window.history.pushState(null, '', window.location.href);
        }
      }
    };

    if (isGenerating) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('popstate', handlePopState);

      // Push a state to enable popstate detection
      window.history.pushState(null, '', window.location.href);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isGenerating]);

  // Smoothly animate progress towards the target
  useEffect(() => {
    if (!isGenerating) return;
    const timer = setInterval(() => {
      setProgress((prev) => {
        const cappedTarget = Math.min(targetProgress, 99); // avoid hitting 100 before completion
        if (prev >= cappedTarget) return prev;
        const diff = cappedTarget - prev;

        // More gradual easing: smaller increments, especially at the end
        let increment;
        if (diff > 20) {
          // Large jumps at the beginning - but slower
          increment = Math.max(0.8, diff * 0.08);
        } else if (diff > 10) {
          // Medium jumps in the middle
          increment = Math.max(0.6, diff * 0.12);
        } else {
          // Small, consistent increments at the end to avoid stalling
          increment = Math.max(0.3, diff * 0.15);
        }

        return Math.min(prev + increment, cappedTarget);
      });
    }, 500); // Slower interval for smoother animation
    return () => clearInterval(timer);
  }, [isGenerating, targetProgress]);


  // Handle section order changes
  const handleSectionOrderChange = (newOrder) => {
    setSectionOrder(newOrder);
    localStorage.setItem('queryfuel_section_order', JSON.stringify(newOrder));
    console.log('✅ Section order updated:', newOrder.map(s => s.label).join(' → '));
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleJsonFileChange = async (e) => {
    try {
      setJsonUploadError(null);
      const file = e.target.files?.[0];
      if (!file) return;
      if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
        throw new Error('Please select a .json file');
      }
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Convert to Gutenberg HTML and trigger an HTML download
      const html = convertJsonToGutenbergHtml(parsed, sectionOrder);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const baseName = (file.name.replace(/\.json$/i, '') || 'article').trim();
      a.href = url;
      a.download = `${baseName}-gutenberg.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      e.target.value = '';
    } catch (err) {
      console.error(err);
      setJsonUploadError(err?.message || 'Invalid JSON file');
    }
  };

  // Enhanced keyword validation function
  const validateKeyword = (keyword) => {
    const trimmed = keyword.trim();

    // Check if empty
    if (!trimmed) {
      return { isValid: false, error: 'Please enter a keyword' };
    }

    // Check minimum length
    if (trimmed.length < 2) {
      return { isValid: false, error: 'Keyword must be at least 2 characters long' };
    }

    // Check maximum length
    if (trimmed.length > 100) {
      return { isValid: false, error: 'Keyword must be less than 100 characters' };
    }

    // Check for invalid characters (allow letters, numbers, spaces, hyphens, apostrophes)
    const validPattern = /^[a-zA-Z0-9\s\-'&.,!?()]+$/;
    if (!validPattern.test(trimmed)) {
      return { isValid: false, error: 'Keyword contains invalid characters. Use only letters, numbers, spaces, and basic punctuation.' };
    }

    // Check if it's not just spaces or special characters
    const hasAlphanumeric = /[a-zA-Z0-9]/.test(trimmed);
    if (!hasAlphanumeric) {
      return { isValid: false, error: 'Keyword must contain at least one letter or number' };
    }

    return { isValid: true, error: null };
  };

  // URL validation function for reference link
  const validateUrl = (url) => {
    const trimmed = url.trim();
    
    // Empty URL is valid (optional field)
    if (!trimmed) {
      return { isValid: true, error: null };
    }

    // Check minimum length
    if (trimmed.length < 8) {
      return { isValid: false, error: 'URL must be at least 8 characters long' };
    }

    // Check maximum length
    if (trimmed.length > 500) {
      return { isValid: false, error: 'URL must be less than 500 characters' };
    }

    // Basic URL format validation
    try {
      const urlObj = new URL(trimmed);
      
      // Must be http or https
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { isValid: false, error: 'URL must start with http:// or https://' };
      }

      // Must have a valid domain
      if (!urlObj.hostname || urlObj.hostname.length < 3) {
        return { isValid: false, error: 'URL must have a valid domain name' };
      }

      return { isValid: true, error: null };
    } catch (error) {
      return { isValid: false, error: 'Please enter a valid URL (e.g., https://example.com)' };
    }
  };

  // Link description validation function
  const validateLinkDescription = (description, hasLink) => {
    const trimmed = description.trim();
    
    // If no link is provided, description is not required
    if (!hasLink) {
      return { isValid: true, error: null };
    }

    // If link is provided but no description, it's invalid
    if (hasLink && !trimmed) {
      return { isValid: false, error: 'Please describe what your link offers (required when link is provided)' };
    }

    // Check minimum length
    if (trimmed.length < 10) {
      return { isValid: false, error: 'Description must be at least 10 characters long' };
    }

    // Check maximum length
    if (trimmed.length > 200) {
      return { isValid: false, error: 'Description must be less than 200 characters' };
    }

    return { isValid: true, error: null };
  };

  // Handle Google Docs conversion via Firebase Function (bypasses CORS)
  const handleGoogleDocsConversion = async () => {
    if (!generatedArticle || !user) {
      alert('No article data available or user not authenticated');
      return;
    }

    setIsConvertingToDocs(true);

    try {
      console.log('🔄 Starting Google Docs conversion via Firebase Function');

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:5002/lead-generation-6cf0f/us-central1/api';

      const response = await fetch(`${apiBaseUrl}/word-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          articleData: generatedArticle.data || generatedArticle,
          userId: user.uid,
          articleId: generatedArticle.id,
          keywordId: keyword.trim()
        })
      });

      if (!response.ok) {
        let serverMessage = '';
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errorData = await response.json();
            serverMessage = errorData.error?.message || errorData.message || '';
          } else {
            serverMessage = await response.text();
          }
        } catch (_) {
          // ignore parse errors
        }
        throw new Error(serverMessage || 'Failed to convert to Google Docs');
      }

      const result = await response.json();

      if (result.success && result.data.documentUrl) {
        setGoogleDocUrl(result.data.documentUrl);

        // Save Google Docs data to Firestore
        try {
          const { saveGoogleDocsData, createSafeKeywordId } = await import('@/services/articleService');
          const keywordId = createSafeKeywordId(keyword.trim());
          
          await saveGoogleDocsData(user.uid, keywordId, generatedArticle.id, {
            documentUrl: result.data.documentUrl,
            documentTitle: result.data.documentTitle,
            documentId: result.data.documentId
          });
          
          console.log('✅ Google Docs data saved to Firestore');
        } catch (firestoreError) {
          console.error('⚠️ Failed to save Google Docs data to Firestore:', firestoreError);
          // Don't throw here - we still want to show success to user even if Firestore save fails
        }

        // Show success message and open document
        alert(`✅ Google Doc created successfully!\n\nDocument: ${result.data.documentTitle}\nOpening in new tab...`);

        // Open the Google Doc in a new tab
        window.open(result.data.documentUrl, '_blank');

        console.log('✅ Google Docs conversion completed:', result.data.documentUrl);
      } else {
        throw new Error('Invalid response from word document service');
      }

    } catch (error) {
      console.error('❌ Google Docs conversion failed:', error);
      alert(mapToFriendlyError(error, 'docs'));
    } finally {
      setIsConvertingToDocs(false);
    }
  };

  const generateArticleFromKeyword = async () => {
    // Enhanced validation
    const keywordValidation = validateKeyword(keyword);
    if (!keywordValidation.isValid) {
      setGenerationError(keywordValidation.error);
      return;
    }

    const urlValidation = validateUrl(referenceLink);
    if (!urlValidation.isValid) {
      setGenerationError(urlValidation.error);
      return;
    }

    const linkDescriptionValidation = validateLinkDescription(linkDescription, referenceLink.trim());
    if (!linkDescriptionValidation.isValid) {
      setGenerationError(linkDescriptionValidation.error);
      return;
    }

    if (!user) {
      setGenerationError('Please log in to generate articles');
      return;
    }

    // Prevent multiple simultaneous generations
    if (generationLock) {
      setGenerationError('Article generation already in progress. Please wait.');
      return;
    }

    setGenerationLock(true);
    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedArticle(null);
    setGenerationStartTime(Date.now());
    setElapsedTime(0);
    setProgress(0);
    setTargetProgress(10);

    // let creditsDeducted = false;

    try {
      setGenerationStep('Initializing AI content generation...');
      setTargetProgress(15);

      // 🔒 ATOMIC CREDIT DEDUCTION - PREVENTS RACE CONDITIONS
      // console.log('🔒 Attempting atomic credit deduction...');
      // const creditResult = await deductCreditsAtomic(user.uid, 1);

      // if (!creditResult.success) {
      //   throw new Error(creditResult.error || 'Failed to deduct credits');
      // }

      // creditsDeducted = true;
      // console.log('✅ Credits deducted successfully, proceeding with generation...');

      // Refresh subscription data to update UI immediately
      // refetchSubscription();

      // Get user's Firebase Auth token
      const token = await user.getIdToken();

      // Create dynamic prompt based on tier and question count
      const getDynamicPrompt = (keyword, questionCount, tier, referenceLink, linkFrequency, linkDescription) => {
        const baseFaqCount = Math.floor(questionCount * 2.5); // Scale FAQs with question count
        const tableCount = questionCount <= 5 ? 1 : questionCount <= 15 ? 2 : 3;
        const checklistItems = Math.floor(questionCount * 1.5);
        const targetWordCount = Math.floor(questionCount * 400);

        // Reference link instructions (only if link is provided)
        const referenceLinkInstructions = referenceLink ? `

REFERENCE LINK INTEGRATION RULES:
- Link to include: ${referenceLink}
- What this link offers: ${linkDescription}

PLACEMENT STRATEGY:
1. INTRODUCTION SECTION: Include the link EXACTLY ONCE in the introduction
   - Integrate naturally within one of the introduction paragraphs
   - Should feel like a natural part of the introduction flow

2. FAQ ANSWERS: Include the link exactly ${linkFrequency} times across different FAQ questions
   - Distribution: Use ${linkFrequency} different FAQ questions
   - Context: Each mention must be relevant to that specific FAQ topic AND relate to what the link offers
   - Integration Strategy: Only mention the link in FAQs where "${linkDescription}" would genuinely help answer the question

INTEGRATION GUIDELINES FOR BOTH SECTIONS:
- Enhanced natural phrasing with varied anchor text:
  * "For ${linkDescription.toLowerCase()}, <a href="${referenceLink}">leading platforms</a> offer excellent solutions"
  * "Many professionals rely on <a href="${referenceLink}">specialized software</a> for ${linkDescription.toLowerCase()}"
  * "Consider implementing <a href="${referenceLink}">proven systems</a> that excel in ${linkDescription.toLowerCase()}"
  * "Successful businesses often leverage <a href="${referenceLink}">comprehensive platforms</a> for ${linkDescription.toLowerCase()}"
  * "The key is utilizing <a href="${referenceLink}">professional-grade tools</a> designed for ${linkDescription.toLowerCase()}"
- ENHANCED ANCHOR TEXT VARIETY: Use contextually appropriate phrases:
  * PROFESSIONAL: "leading platforms", "industry-standard tools", "professional-grade solutions"
  * DESCRIPTIVE: "specialized software", "dedicated solutions", "comprehensive platforms"
  * AUTHORITATIVE: "proven systems", "trusted resources", "established platforms"
  * QUALITY-FOCUSED: "premium tools", "top-tier platforms", "high-performance solutions"
- Quality: Each integration should add genuine value to the content and feel organic
- Relevance: Only include the link where the content topic directly relates to "${linkDescription}"
- Spacing: Distribute the ${linkFrequency} mentions across different FAQ sections when possible

TOTAL LINK COUNT: ${parseInt(linkFrequency) + 1} (1 in introduction + ${linkFrequency} in FAQs)
` : '';

        return `You are an expert content writer. Create a comprehensive, SEO-optimized article about "${keyword}".

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations. Start with { and end with }.${referenceLinkInstructions}

JSON Structure (EXACT format required):
{
  "title": "string - engaging title with relevant emoji",
  "subtitle": "string - compelling subtitle that hooks readers",
  "key_takeaways": [
    "string - key takeaway 1",
    "string - key takeaway 2",
    "string - key takeaway 3",
    "string - key takeaway 4",
    "string - key takeaway 5"
  ],
  "intro_md": "string - engaging 2-3 paragraph introduction with hook and overview",
  "toc": [
    {
      "section_title": "string - section name",
      "questions": [
        "string - question 1",
        "string - question 2",
        "string - question 3"
      ]
    }
  ],
  "faqs": [
    {
      "section_title": "string - FAQ category name",
      "question": "string - specific question people ask",
      "answer_md": "string - detailed 2-3 paragraph answer",
      "real_results": "string - concrete data or statistic",
      "takeaway": "string - actionable insight"
    }
  ],
  "tables": [
    {
      "title": "string - descriptive table title",
      "headers": ["string", "string", "string"],
      "rows": [
        ["string", "string", "string"],
        ["string", "string", "string"]
      ]
    }
  ],
  "checklists": {
    "launch": [
      "string - checklist item 1",
      "string - checklist item 2",
      "string - checklist item 3"
    ],
    "post_contest": [
      "string - advanced checklist item 1",
      "string - advanced checklist item 2",
      "string - advanced checklist item 3"
    ]
  },
  "author": {
    "name": "string - expert author name",
    "bio": "string - brief bio establishing expertise"
  },
  "cta": {
    "text": "string - compelling call to action",
    "url": "#"
  },
  "metadata": {
    "meta_description": "string - exactly 120-158 characters, include primary keyword, compelling hook, clear value proposition"
  }
}

DYNAMIC REQUIREMENTS BASED ON SUBSCRIPTION TIER:
- Generate ${baseFaqCount}-${baseFaqCount + 3} FAQs across ${Math.ceil(baseFaqCount / 4)} section categories
- Include ${tableCount} data tables with realistic statistics
- Create checklists with ${checklistItems}+ items each
- Ensure ${targetWordCount}+ words when rendered
- Scale content depth based on ${questionCount} question limit

VALIDATION CHECKLIST:
✓ Valid JSON syntax (no syntax errors)
✓ All required fields present
✓ All values are strings or arrays as specified
✓ No missing commas or brackets
✓ Proper quote escaping
✓ Meta description character count correct
✓ Content depth matches subscription tier limits`;
      };

      // Call your Gemini API to generate article
      const prompt = getDynamicPrompt(keyword, questionCount, subscriptionTier, referenceLink, linkFrequency, linkDescription);

      // Use environment variable for API base URL
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ||
        (process.env.NODE_ENV === 'production'
          ? 'https://us-central1-queryfuel-f830f.cloudfunctions.net/api'
          : 'http://127.0.0.1:5002/lead-generation-6cf0f/us-central1/api');

      // Contacting backend
      setGenerationStep('Contacting AI...');
      setTargetProgress(35);

      try {
        const response = await fetch(`${apiBaseUrl}/gemini/generate-structured-article`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            keyword: keyword.trim(),
            questionCount: questionCount,
            subscriptionTier: subscriptionTier,
            referenceLink: referenceLink.trim(),
            linkDescription: linkDescription.trim(),
            linkFrequency: linkFrequency,
            brandVoiceEnabled: brandModeEnabled && brandVoiceSettings?.enabled
          })
        });

        if (!response.ok) {
          let serverMessage = '';
          try {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const errorData = await response.json();
              serverMessage = errorData.error?.message || errorData.message || '';
            } else {
              serverMessage = await response.text();
            }
          } catch (_) {
            // ignore parse errors
          }
          throw new Error(serverMessage || 'Failed to generate article');
        }

        setGenerationStep('Processing article content...');
        setTargetProgress(70);
        const articleData = await response.json();

        if (!articleData.success) {
          throw new Error(articleData.error?.message || 'Article generation failed');
        }

        // Extract metadata if available
        const metadata = articleData.data?._metadata;
        let successMessage = 'Article saved successfully!';

        if (metadata?.jsonParseAttempts) {
          if (metadata.jsonParseAttempts > 1) {
            successMessage += ` (AI needed ${metadata.jsonParseAttempts} attempts to generate valid content)`;
          }
          // Remove metadata from the article data before saving
          delete articleData.data._metadata;
        }

        setGenerationStep('Saving to your library...');
        setTargetProgress(90);

        // Import the new article service function
        const { saveArticleToFirestore } = await import('@/services/articleService');

        // Save to Firestore using new keyword-organized structure
        const articleId = await saveArticleToFirestore(
          user.uid,
          keyword.trim(),
          articleData.data
        );

        // Smooth transition: show a lightweight fade overlay, then navigate
        try {
          const { createSafeKeywordId } = await import('@/services/articleService');
          const keywordId = createSafeKeywordId(keyword.trim());
          setGenerationStep('Opening your article...');
          setTargetProgress(100);
          setIsTransitioning(true);

          // Allow the overlay to paint, then navigate
          requestAnimationFrame(() => {
            setTimeout(() => {
              router.push(`/dashboard/articles/view?id=${encodeURIComponent(articleId)}&source=keyword&keywordId=${encodeURIComponent(keywordId)}`);
            }, 160);
          });
        } catch (navErr) {
          console.warn('Navigation to article failed, falling back to success card:', navErr);
          let wordDocLink = null;
          setGeneratedArticle({ id: articleId, wordDocLink, ...articleData.data });
          setGenerationStep(successMessage);
          setIsTransitioning(false);
        }

        // Reset timing after successful generation
        setTimeout(() => {
          setGenerationStartTime(null);
          setElapsedTime(0);
          setProgress(100);
          setTimeout(() => {
            setProgress(0);
            setTargetProgress(0);
          }, 1200);
        }, 3000);

      } catch (fetchError) {
        throw fetchError;
      }

    } catch (error) {
      console.error('Article generation error:', error);

      // 🔄 REFUND CREDITS if they were deducted but generation failed
      // if (creditsDeducted) {
      //   console.log('🔄 Generation failed, attempting to refund credits...');
      //   try {
      //     const refundResult = await refundCredits(user.uid, 1);
      //     if (refundResult.success) {
      //       console.log('✅ Credits refunded successfully');
      //       // Refresh subscription data to show refunded credits
      //       refetchSubscription();
      //     } else {
      //       console.error('❌ Failed to refund credits:', refundResult.error);
      //     }
      //   } catch (refundError) {
      //     console.error('❌ Critical error during credit refund:', refundError);
      //   }
      // }

      setGenerationError(mapToFriendlyError(error, 'generate'));
      setGenerationStartTime(null);
      setElapsedTime(0);
      setTargetProgress(100);
      setProgress(100);
    } finally {
      setIsGenerating(false);
      setGenerationLock(false); // Release the generation lock
    }
  };

  return (
    <div className={styles.pageContainer}>
      {/* Header - outside the main card */}
      <div className={styles.pageHeader}>
        <div className={styles.iconBox}>
          <svg className={styles.iconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/>
          </svg>
        </div>
        <h1 className={styles.pageTitle}>AI Content Generator</h1>
        <p className={styles.pageSubtitle}>Create stunning, SEO-optimized articles in minutes with our advanced AI technology</p>
      </div>

      <div className={styles.contentWrapper}>
        {/* Main Form Card - Left Side */}
        <div className={styles.mainFormCard}>

          {/* Article Topic Card */}
          <div className={styles.formSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <div className={styles.sectionHeaderText}>
                <h3 className={styles.sectionTitle}>Article Topic</h3>
                <p className={styles.sectionDescription}>What do you want to write about?</p>
              </div>
            </div>

            <textarea
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                if (generationError) {
                  setGenerationError(null);
                }
              }}
              placeholder="E.g., The Future of Artificial Intelligence in Healthcare, Best Digital Marketing Strategies for 2024..."
              disabled={isGenerating}
              maxLength={400}
              className={`${styles.textareaInput} ${generationError && generationError.includes('Keyword') ? styles.inputError : ''}`}
              aria-label="Article Topic"
              aria-describedby="keyword-help"
              rows="3"
            />

            <div className={styles.inputFooter}>
              <div id="keyword-help" className={styles.inputNote}>
                <span className={styles.noteIcon}>●</span> AI-powered suggestions enabled
              </div>
              <div className={`${styles.charCount} ${keyword.length > 320 ? styles.charCountError : keyword.length > 240 ? styles.charCountWarning : ''}`}>
                {keyword.length}/400
              </div>
            </div>
          </div>

          {/* Article Depth Card */}
          <div className={styles.formSection}>
            <div className={styles.sectionHeaderInline}>
              <div className={styles.sectionHeaderLeft}>
                <label className={styles.sectionTitleSmall}>ARTICLE DEPTH</label>
                {questionLimits.isFixed && (
                  <span className={styles.freePlanBadge}>FREE PLAN</span>
                )}
              </div>
              <div className={styles.questionCountDisplay}>
                <span className={styles.questionCountText}>{questionCount} questions</span>
              </div>
            </div>

            <div className={styles.sliderWrapper}>
              <div className={styles.sliderTrack}>
                <span className={styles.sliderLabel}>5 (Fixed)</span>
                <input
                  type="range"
                  min={questionLimits.min}
                  max={questionLimits.max}
                  value={questionCount}
                  onChange={(e) => handleQuestionCountChange(parseInt(e.target.value))}
                  className={styles.rangeSlider}
                  disabled={questionLimits.isFixed || isGenerating}
                />
                <span className={styles.sliderLabelCenter}>Fixed</span>
                <span className={styles.sliderLabel}>5</span>
              </div>
            </div>
          </div>

          {/* Reference Link Card */}
          <div className={styles.formSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                </svg>
              </div>
              <div className={styles.sectionHeaderText}>
                <h3 className={styles.sectionTitle}>Reference Link</h3>
                <p className={styles.sectionDescription}>Promote your content naturally</p>
              </div>
              <span className={styles.optionalBadge}>OPTIONAL</span>
            </div>

            <input
              type="url"
              value={referenceLink}
              onChange={(e) => {
                setReferenceLink(e.target.value);
                if (generationError && (generationError.includes('URL') || generationError.includes('valid'))) {
                  setGenerationError(null);
                }
              }}
              placeholder="https://your-website.com/your-resource"
              disabled={isGenerating}
              maxLength={500}
              className={`${styles.urlInput} ${generationError && generationError.includes('URL') ? styles.inputError : ''}`}
              aria-label="Reference Link"
              aria-describedby="reference-link-help"
            />

            <div className={styles.inputFooter}>
              <div id="reference-link-help" className={styles.inputNote}>
                Add a URL to include in your article
              </div>
              <div className={`${styles.charCount} ${referenceLink.length > 400 ? styles.charCountError : referenceLink.length > 300 ? styles.charCountWarning : ''}`}>
                {referenceLink.length}/500
              </div>
            </div>

            {/* Conditionally show Link Description and Link Frequency when link is entered */}
            {referenceLink.trim() && (
              <>
                {/* Link Description */}
                <div className={styles.linkDescriptionSection}>
                  <label className={styles.linkDescriptionLabel}>
                    WHAT DOES YOUR LINK OFFER? <span className={styles.requiredLabel}>*</span>
                  </label>
                  <textarea
                    value={linkDescription}
                    onChange={(e) => {
                      setLinkDescription(e.target.value);
                      if (generationError && generationError.includes('description')) {
                        setGenerationError(null);
                      }
                    }}
                    placeholder="E.g., A comprehensive SEO tool with keyword research and rank tracking"
                    disabled={isGenerating}
                    maxLength={200}
                    rows={3}
                    className={`${styles.linkDescriptionInput} ${generationError && generationError.includes('description') ? styles.inputError : ''}`}
                    aria-label="Link Description"
                  />
                  <div className={styles.inputFooter}>
                    <div className={styles.inputNote} style={{ color: '#22c55e' }}>
                      Help the AI understand your link to integrate it naturally and contextually
                    </div>
                    <div className={`${styles.charCount} ${linkDescription.length > 160 ? styles.charCountError : linkDescription.length > 120 ? styles.charCountWarning : ''}`}>
                      {linkDescription.length}/200
                    </div>
                  </div>
                </div>

                {/* Link Frequency */}
                <div className={styles.linkFrequencySection}>
                  <div className={styles.linkFrequencyHeader}>
                    <label className={styles.linkFrequencyLabel}>LINK FREQUENCY</label>
                    <span className={styles.linkFrequencyDisplay}>
                      <span className={styles.linkFrequencyValue}>{linkFrequency}</span>
                      <span className={styles.linkFrequencySuffix}> questions</span>
                    </span>
                  </div>
                  <div className={styles.frequencyContainer}>
                    <select
                      value={linkFrequency}
                      onChange={(e) => setLinkFrequency(parseInt(e.target.value))}
                      disabled={isGenerating}
                      className={styles.frequencySelect}
                      aria-label="Link Frequency"
                    >
                      <option value={1}>1 time</option>
                      <option value={2}>2 times</option>
                      <option value={3}>3 times</option>
                      <option value={4}>4 times</option>
                      <option value={5}>5 times</option>
                    </select>
                  </div>
                  <div className={styles.frequencyInfo}>
                    Link will appear {linkFrequency} {linkFrequency === 1 ? 'time' : 'times'} in the article. {linkFrequency} in introduction + {linkFrequency - 1} in Q&A answers
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Section Order Customization - Keep as is */}
          <div className={styles.sectionOrderControl}>
            <button
              type="button"
              onClick={() => setShowSectionOrderModal(true)}
              className={styles.sectionOrderButton}
              disabled={isGenerating}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '20px', height: '20px', marginRight: '8px'}}>
                <path d="M3 6h18M3 12h18M3 18h18"/>
              </svg>
              Customize Section Order
            </button>
            <span className={styles.sectionOrderHint}>
              Choose how sections appear in your article
            </span>
          </div>

          {/* Generate Button - Hidden, using sidebar button instead */}
          {/* 
          <button
            onClick={() => {
              if (generationLock) {
                setGenerationError('Article generation already in progress. Please wait.');
                return;
              }
              generateArticleFromKeyword();
            }}
            disabled={isGenerating || generationLock || !validateKeyword(keyword).isValid || !validateUrl(referenceLink).isValid || !validateLinkDescription(linkDescription, referenceLink.trim()).isValid}
            className={styles.generateButton}
          >
            {isGenerating ? (
              <>
                <div className={styles.spinner} />
                <span>Generating Article...</span>
              </>
            ) : (
              <>
                <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/>
                </svg>
                <span>Generate Article</span>
              </>
            )}
          </button>
          */}
        </div>

        {/* Sidebar - Right Side */}
        <div className={styles.sidebarCard}>
          {/* Brand Voice Card */}
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarHeader}>
              <div className={styles.sidebarIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                </svg>
              </div>
              <div className={styles.sidebarHeaderText}>
                <h3 className={styles.sidebarTitle}>Brand Voice</h3>
                <p className={styles.sidebarDescription}>Customize tone</p>
              </div>
            </div>

            <div className={styles.brandToggleWrapper}>
              <label className={styles.brandToggleLabel}>
                Enable Brand Mode
                <div className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    checked={brandModeEnabled && brandVoiceSettings?.enabled}
                    onChange={(e) => setBrandModeEnabled(e.target.checked)}
                    disabled={!brandVoiceSettings?.enabled || isGenerating}
                    className={styles.toggleCheckbox}
                  />
                  <span className={styles.toggleSlider}></span>
                </div>
              </label>
            </div>

            <div className={styles.brandConfigContainer}>
              {brandVoiceLoading ? (
                <div className={styles.brandStatusMessage}>
                  Loading brand voice settings...
                </div>
              ) : brandVoiceSettings?.enabled ? (
                <>
                  <div className={styles.brandConfiguredMessage}>
                    ✓ Brand voice configured
                  </div>
                  
                  <div className={styles.brandDetailsGrid}>
                    {brandVoiceSettings.industry && brandVoiceSettings.industry !== 'general' && (
                      <div className={styles.brandDetailItem}>
                        <span className={styles.brandDetailLabel}>Industry</span>
                        <span className={styles.brandDetailValue}>
                          {brandVoiceSettings.industry.charAt(0).toUpperCase() + brandVoiceSettings.industry.slice(1)}
                        </span>
                      </div>
                    )}
                    
                    {brandVoiceSettings.preferredTerms && brandVoiceSettings.preferredTerms.length > 0 && (
                      <div className={styles.brandDetailItem}>
                        <span className={styles.brandDetailLabel}>Preferred Terms</span>
                        <span className={styles.brandDetailValue}>
                          {brandVoiceSettings.preferredTerms.length} term{brandVoiceSettings.preferredTerms.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    
                    {brandVoiceSettings.bannedPhrases && brandVoiceSettings.bannedPhrases.length > 0 && (
                      <div className={styles.brandDetailItem}>
                        <span className={styles.brandDetailLabel}>Banned Phrases</span>
                        <span className={styles.brandDetailValue}>
                          {brandVoiceSettings.bannedPhrases.length} phrase{brandVoiceSettings.bannedPhrases.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    
                    {brandVoiceSettings.defaultDisclaimer && (
                      <div className={styles.brandDetailItem}>
                        <span className={styles.brandDetailLabel}>Disclaimer</span>
                        <span className={styles.brandDetailValue}>✓ Set</span>
                      </div>
                    )}
                    
                    {brandVoiceSettings.customInstructions && (
                      <div className={styles.brandDetailItem}>
                        <span className={styles.brandDetailLabel}>Custom Instructions</span>
                        <span className={styles.brandDetailValue}>✓ Set</span>
                      </div>
                    )}
                  </div>

                  <Link href="/dashboard/profile?tab=brandvoice" className={styles.editVoiceButton}>
                    Edit Voice Settings
                  </Link>
                </>
              ) : (
                <>
                  <div className={styles.brandStatusMessage}>
                    Brand voice not configured
                  </div>

                  <Link href="/dashboard/profile?tab=brandvoice" className={styles.configureVoiceButton}>
                    Configure Voice
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Quick Stats Card */}
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarHeader}>
              <h3 className={styles.sidebarTitleLarge}>Quick Stats</h3>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>Est. Word Count</div>
                <div className={styles.statValue}>{Math.floor(questionCount * 240)}-{Math.floor(questionCount * 360)}</div>
              </div>

              <div className={styles.statItem}>
                <div className={styles.statLabel}>Est. Time</div>
                <div className={styles.statValue}>6-9 min</div>
              </div>

              <div className={styles.statItem}>
                <div className={styles.statLabel}>SEO Score</div>
                <div className={styles.statValueOptimized}>Optimized</div>
              </div>
            </div>

            <button
              onClick={() => {
                if (generationLock) {
                  setGenerationError('Article generation already in progress. Please wait.');
                  return;
                }
                generateArticleFromKeyword();
              }}
              disabled={isGenerating || generationLock || !validateKeyword(keyword).isValid || !validateUrl(referenceLink).isValid || !validateLinkDescription(linkDescription, referenceLink.trim()).isValid}
              className={styles.generateButtonSidebar}
            >
              {isGenerating ? (
                <>
                  <div className={styles.spinner} />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 22.5l-.394-1.933a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/>
                  </svg>
                  <span>Generate Article</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Generation Status Modal Popup */}
      {isGenerating && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Generating Your Article</h3>
              </div>
              
              <div className={styles.modalBody}>
                <div className={styles.statusText}>
                  {generationStep}
                </div>
                
                {elapsedTime > 0 && (
                  <div className={styles.elapsedTime}>
                    ⏱️ Time elapsed: {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                  </div>
                )}
                
                <div
                  className={styles.progressBar}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(Math.min(progress, 100))}
                  aria-label="Generation progress"
                >
                  <div
                    className={styles.progressFill}
                    style={{ width: `${Math.round(Math.min(progress, 100))}%` }}
                  />
                </div>
                
                <div className={styles.progressPercent}>
                  Progress: {Math.round(Math.min(progress, 100))}%
                </div>
                
                {elapsedTime > 60 && elapsedTime <= 120 && (
                  <div className={styles.waitMessage}>
                    Typical process time is 1-3 minutes
                  </div>
                )}
              </div>
            </div>
        </div>
      )}

      {/* Error Display - Show as toast/alert */}
      {generationError && !isGenerating && (
        <div className={styles.errorToast}>
          <svg className={styles.errorIcon} width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span className={styles.errorText}>
            {generationError}
          </span>
          <button 
            onClick={() => setGenerationError(null)}
            className={styles.closeErrorButton}
          >
            ×
          </button>
        </div>
      )}

      {/* Lightweight route transition overlay */}
      {isTransitioning && (
        <div className={styles.transitionOverlay} aria-hidden="true">
          <div className={styles.transitionBox}>
            <div className={styles.spinner} />
            <span>Opening your article…</span>
          </div>
        </div>
      )}

        {/* Credit Confirmation Dialog - Commented out for free generation */}
        {/*
        {showCreditConfirmation && (
          <div className={styles.confirmationCard}>
            <div className={styles.confirmationContent}>
              <div className={styles.confirmationIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
              </div>
              <h3 className={styles.confirmationTitle}>Confirm Article Generation</h3>
              <p className={styles.confirmationMessage}>
                Creating an article will consume <strong>1 credit</strong> from your account.
              </p>
              <div className={styles.confirmationDetails}>
                <div className={styles.detailItem}>
                  <span>Current credits:</span>
                  <span className={styles.creditsValue}>{creditsRemaining || 0}</span>
                </div>
                <div className={styles.detailItem}>
                  <span>Credits after generation:</span>
                  <span className={styles.creditsValue}>{(creditsRemaining || 0) - 1}</span>
                </div>
              </div>
              <div className={styles.confirmationButtons}>
                <button
                  onClick={() => setShowCreditConfirmation(false)}
                  className={`${styles.confirmationButton} ${styles.cancelButton}`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowCreditConfirmation(false);
                    generateArticleFromKeyword();
                  }}
                  className={`${styles.confirmationButton} ${styles.confirmButton}`}
                >
                  Generate Article
                </button>
              </div>
            </div>
          </div>
        )}
        */}

      {/* Section Order Configuration Modal */}
      {showSectionOrderModal && (
        <SectionOrderConfig
          initialOrder={sectionOrder}
          onOrderChange={handleSectionOrderChange}
          onClose={() => setShowSectionOrderModal(false)}
        />
      )}
    </div>
  );
}
