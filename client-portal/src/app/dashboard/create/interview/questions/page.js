'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../../contexts/AuthContext';
import { useAuthGuard } from '../../../../../hooks/useAuthGuard';
import { requireAuth } from '../../../../../services/authService';
import { generateArticleQuestions } from '../../../../../services/geminiService';
import { getInterviewById, saveInterviewContent, updateInterview } from '../../../../../services/interviewService';
import { generateIntroQuestions, generateReplacementQuestion } from '../../../../../services/enhancedGeminiService';
import ModeSwitchingControls from '../../../../../components/interview/ModeSwitchingControls';
import styles from './InterviewQuestions.module.css';

// Promotional Link Modal Component
const PromotionalLinkModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData = {}, 
  isGeneratingArticle = false 
}) => {
  const [referenceLink, setReferenceLink] = useState(initialData.referenceLink || '');
  const [linkDescription, setLinkDescription] = useState(initialData.linkDescription || '');
  const [linkFrequency, setLinkFrequency] = useState(initialData.linkFrequency || 2);
  const [validationErrors, setValidationErrors] = useState({});

  // URL validation function
  const validateUrl = (url) => {
    const trimmed = url.trim();
    if (!trimmed) return { isValid: true, error: null };
    
    try {
      new URL(trimmed);
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return { isValid: false, error: 'URL must start with http:// or https://' };
      }
      return { isValid: true, error: null };
    } catch {
      return { isValid: false, error: 'Please enter a valid URL' };
    }
  };

  // Link description validation
  const validateLinkDescription = (description, hasLink) => {
    if (!hasLink) return { isValid: true, error: null };
    
    const trimmed = description.trim();
    if (!trimmed) {
      return { isValid: false, error: 'Link description is required when reference link is provided' };
    }
    if (trimmed.length < 10) {
      return { isValid: false, error: 'Link description must be at least 10 characters' };
    }
    return { isValid: true, error: null };
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    const urlValidation = validateUrl(referenceLink);
    const descValidation = validateLinkDescription(linkDescription, referenceLink.trim());

    if (!urlValidation.isValid) {
      errors.referenceLink = urlValidation.error;
    }
    if (!descValidation.isValid) {
      errors.linkDescription = descValidation.error;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (validateForm()) {
      onSave({
        referenceLink: referenceLink.trim(),
        linkDescription: linkDescription.trim(),
        linkFrequency
      });
    }
  };

  // Handle clear
  const handleClear = () => {
    setReferenceLink('');
    setLinkDescription('');
    setLinkFrequency(2);
    setValidationErrors({});
  };

  // Handle overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Clear validation errors when inputs change
  const handleReferenceLinkChange = (e) => {
    setReferenceLink(e.target.value);
    if (validationErrors.referenceLink) {
      setValidationErrors(prev => ({ ...prev, referenceLink: null }));
    }
  };

  const handleLinkDescriptionChange = (e) => {
    setLinkDescription(e.target.value);
    if (validationErrors.linkDescription) {
      setValidationErrors(prev => ({ ...prev, linkDescription: null }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.promotionalLinkModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Promotional Link Settings</h3>
          <p className={styles.modalSubtitle}>
            Add a link to naturally promote your content or resources in the generated article
          </p>
          <button
            className={styles.modalCloseButton}
            onClick={onClose}
            aria-label="Close promotional link modal"
            type="button"
          >
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Reference Link Input */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Reference Link (Optional)
            </label>
            <input
              type="url"
              value={referenceLink}
              onChange={handleReferenceLinkChange}
              placeholder="https://example.com/your-resource"
              maxLength={500}
              className={`${styles.input} ${validationErrors.referenceLink ? styles.inputError : ''}`}
              aria-label="Reference Link"
              disabled={isGeneratingArticle}
            />
            <div className={styles.inputHelp}>
              <div className={styles.helpText}>
                {referenceLink ? 'Link will be naturally integrated into introduction and FAQ answers' : 'Add a link to promote your content or resources'}
              </div>
              <div className={`${styles.charCount} ${referenceLink.length > 400 ? styles.charCountError : referenceLink.length > 300 ? styles.charCountWarning : ''}`}>
                {referenceLink.length}/500
              </div>
            </div>
            {validationErrors.referenceLink && (
              <div className={styles.errorMessage}>{validationErrors.referenceLink}</div>
            )}
          </div>

          {/* Link Description - Only show when link is provided */}
          {referenceLink.trim() && (
            <div className={styles.formGroup}>
              <label className={styles.label}>
                What does your link offer?
                <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                value={linkDescription}
                onChange={handleLinkDescriptionChange}
                placeholder="e.g., A comprehensive SEO tool with keyword research and rank tracking"
                maxLength={200}
                className={`${styles.input} ${validationErrors.linkDescription ? styles.inputError : ''}`}
                aria-label="Link Description"
                disabled={isGeneratingArticle}
              />
              <div className={styles.inputHelp}>
                <div className={styles.helpText}>
                  Help AI understand your link to integrate it naturally and contextually
                </div>
                <div className={`${styles.charCount} ${linkDescription.length > 160 ? styles.charCountError : linkDescription.length > 120 ? styles.charCountWarning : ''}`}>
                  {linkDescription.length}/200
                </div>
              </div>
              {validationErrors.linkDescription && (
                <div className={styles.errorMessage}>{validationErrors.linkDescription}</div>
              )}
            </div>
          )}

          {/* Link Frequency Selector - Only show when link is provided */}
          {referenceLink.trim() && (
            <div className={styles.formGroup}>
              <div className={styles.linkFrequencyHeader}>
                <label className={styles.label}>
                  Link Frequency
                  <div className={styles.frequencyDisplay}>
                    <span className={styles.frequencyNumber}>{linkFrequency}</span>
                    <span className={styles.frequencyUnit}>mentions</span>
                  </div>
                </label>
              </div>
              <select
                value={`${linkFrequency} times`}
                onChange={(e) => setLinkFrequency(parseInt(e.target.value.split(' ')[0]))}
                className={styles.frequencySelector}
                disabled={isGeneratingArticle}
              >
                <option value="2 times">2 times</option>
                <option value="3 times">3 times</option>
                <option value="4 times">4 times</option>
                <option value="5 times">5 times</option>
              </select>
              <div className={styles.frequencyInfo}>
                Link will appear {parseInt(linkFrequency) + 1} times total (1 in introduction + {linkFrequency} in FAQ answers)
              </div>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleClear}
            disabled={isGeneratingArticle}
          >
            Clear All
          </button>
          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isGeneratingArticle}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleSave}
              disabled={isGeneratingArticle}
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Dummy data for development
const DUMMY_QUESTIONS = [
  {
    id: 1,
    sectionTitle: "Understanding the Basics",
    question: "What is contest marketing and how does it differ from traditional advertising?",
    answered: false,
    answer: ""
  },
  {
    id: 2,
    sectionTitle: "Understanding the Basics",
    question: "What are the key psychological principles that make contests effective for audience engagement?",
    answered: false,
    answer: ""
  },
  {
    id: 3,
    sectionTitle: "Understanding the Basics",
    question: "How do you determine if contest marketing is the right strategy for a particular business or industry?",
    answered: false,
    answer: ""
  },
  {
    id: 4,
    sectionTitle: "Strategy & Planning",
    question: "What are the essential elements that every successful contest must have?",
    answered: false,
    answer: ""
  },
  {
    id: 5,
    sectionTitle: "Strategy & Planning",
    question: "How do you choose the right prize that will attract your target audience without breaking the budget?",
    answered: false,
    answer: ""
  },
  {
    id: 6,
    sectionTitle: "Strategy & Planning",
    question: "What's the optimal duration for running a contest, and how does timing affect results?",
    answered: false,
    answer: ""
  },
  {
    id: 7,
    sectionTitle: "Implementation & Execution",
    question: "What platforms and tools do you recommend for running contests, and why?",
    answered: false,
    answer: ""
  },
  {
    id: 8,
    sectionTitle: "Implementation & Execution",
    question: "How do you create contest rules that protect your business while encouraging participation?",
    answered: false,
    answer: ""
  },
  {
    id: 9,
    sectionTitle: "Measuring Success",
    question: "What metrics should businesses track to measure the success of their contest campaigns?",
    answered: false,
    answer: ""
  },
  {
    id: 10,
    sectionTitle: "Measuring Success",
    question: "How do you calculate the ROI of a contest marketing campaign?",
    answered: false,
    answer: ""
  },
  {
    id: 11,
    sectionTitle: "Common Mistakes & Solutions",
    question: "What are the most common mistakes businesses make when running contests?",
    answered: false,
    answer: ""
  },
  {
    id: 12,
    sectionTitle: "Common Mistakes & Solutions",
    question: "How do you handle low participation rates or engagement during a contest?",
    answered: false,
    answer: ""
  },
  {
    id: 13,
    sectionTitle: "Advanced Strategies",
    question: "How can businesses use contests to build long-term customer relationships beyond the initial campaign?",
    answered: false,
    answer: ""
  },
  {
    id: 14,
    sectionTitle: "Advanced Strategies",
    question: "What role does social media play in amplifying contest reach and engagement?",
    answered: false,
    answer: ""
  },
  {
    id: 15,
    sectionTitle: "Future Trends",
    question: "What emerging trends do you see in contest marketing, and how should businesses prepare?",
    answered: false,
    answer: ""
  }
];

// Static intro question used to mirror sample and ensure immediate guidance
const STATIC_INTRO_QUESTION = `To kick things off, tell us about your background and experience with this topic.
In other words: why should AI trust you as the go-to expert here? This is your chance to share your perspective, insights, and even brag a little. We want to highlight what makes your knowledge unique.
Aim to speak for at least a minute so we have plenty to work with.`;

function InterviewQuestionsPageContent() {
  const { user, loading, isAuthenticated, authError } = useAuthGuard({
    redirectTo: '/login',
    requireAuth: true
  });
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get params from URL
  const articleSlug = searchParams.get('id') || 'untitled-interview';
  const topic = searchParams.get('topic') || 'Your Topic';
  const switchedFrom = searchParams.get('switchedFrom'); // 'voice' if switching from voice mode

  // State management
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Article and generation state
  const [articleData, setArticleData] = useState(null);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionGenerationError, setQuestionGenerationError] = useState(null);
  const [lastSavedTime, setLastSavedTime] = useState(null);

  // Enhanced auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
  const [autoSaveError, setAutoSaveError] = useState(null);
  const [pendingAnswers, setPendingAnswers] = useState({});
  const [saveRetryCount, setSaveRetryCount] = useState(0);

  // Article generation state (copied from compile page)
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [generationStep, setGenerationStep] = useState('');
  const [generationStartTime, setGenerationStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [targetProgress, setTargetProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Manual save state
  const [manualSaveStatus, setManualSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
  const [manualSaveError, setManualSaveError] = useState(null);
  const [lastManualSaveTime, setLastManualSaveTime] = useState(null);

  // Auto-save preference state
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    // Load preference from localStorage, default to true
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('interviewAutoSaveEnabled');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });

  const [introQuestions, setIntroQuestions] = useState([]);
  const [introAnswers, setIntroAnswers] = useState({});
  const [showIntroQuestions, setShowIntroQuestions] = useState(false);
  const [isIntroComplete, setIsIntroComplete] = useState(false);

  // Intro question save state
  const [introSaveStatus, setIntroSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
  const [lastIntroSaveTime, setLastIntroSaveTime] = useState(null);
  const [introSaveError, setIntroSaveError] = useState(null);

  // Flow control state
  const [currentFlowStep, setCurrentFlowStep] = useState('intro'); // 'intro' | 'questions'

  // Unsaved changes confirmation modal
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  // Promotional Link Feature State
  const [referenceLink, setReferenceLink] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkFrequency, setLinkFrequency] = useState(2);
  const [isPromotionalLinkModalOpen, setIsPromotionalLinkModalOpen] = useState(false);
  // Unsaved changes warning for browser-level navigation
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (Object.keys(pendingAnswers).length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingAnswers]);

  // Intercept internal navigation
  useEffect(() => {
    const handleLinkClick = (e) => {
      if (Object.keys(pendingAnswers).length > 0) {
        const target = e.target.closest('a');
        if (target && target.href) {
          e.preventDefault();
          setPendingNavigation(target.href);
          setShowUnsavedModal(true);
        }
      }
    };

    document.addEventListener('click', handleLinkClick);
    return () => document.removeEventListener('click', handleLinkClick);
  }, [pendingAnswers]);

  // Handle navigation confirmation
  const handleConfirmNavigation = () => {
    setShowUnsavedModal(false);
    if (pendingNavigation) {
      window.location.href = pendingNavigation;
    }
    setPendingNavigation(null);
  };

  const handleCancelNavigation = () => {
    setShowUnsavedModal(false);
    setPendingNavigation(null);
  };

  // Handle save and leave from unsaved changes modal
  const handleSaveAndLeave = async () => {
    try {
      await handleManualSaveAll();
      setShowUnsavedModal(false);
      if (pendingNavigation) {
        window.location.href = pendingNavigation;
      }
      setPendingNavigation(null);
    } catch (error) {
      console.error('Failed to save and leave:', error);
    }
  };
  // Guard to prevent duplicate loads in React 18 Strict Mode (dev only)
  const hasLoadedRef = useRef(false);

  // Enhanced authentication check
  useEffect(() => {
    const verifyAuthentication = async () => {
      try {
        await requireAuth();
      } catch (error) {
        console.error('Authentication verification failed:', error);
        router.push('/login');
      }
    };

    if (!loading && isAuthenticated) {
      verifyAuthentication();
    }
  }, [loading, isAuthenticated, router]);

  // Save auto-save preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('interviewAutoSaveEnabled', JSON.stringify(autoSaveEnabled));
    }
  }, [autoSaveEnabled]);

  // Track elapsed time during generation (copied from compile page)
  useEffect(() => {
    let interval;
    if (isGeneratingArticle && generationStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - generationStartTime) / 1000);
        setElapsedTime(elapsed);

        // Update generation step and target progress based on elapsed time
        if (elapsed > 150) { // 2.5 minutes - show timeout warning
          setGenerationStep('⚠️ Taking longer than expected... Article generation will timeout in 30 seconds. Your credits will be refunded if it times out.');
          setTargetProgress((prev) => Math.max(prev, 95));
        } else if (elapsed > 120) { // 2 minutes - show extended time warning
          setGenerationStep('⏰ Still working... Quality content takes time. Will timeout in 1 minute if not complete.');
          setTargetProgress((prev) => Math.max(prev, 90));
        } else if (elapsed > 45) {
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
  }, [isGeneratingArticle, generationStartTime]);

  // Smoothly animate progress towards the target (copied from compile page)
  useEffect(() => {
    if (!isGeneratingArticle) return;
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
  }, [isGeneratingArticle, targetProgress]);

  // Generate and save questions
  const generateAndSaveQuestions = useCallback(async (article) => {
    try {
      console.log('🚀 STARTING QUESTION GENERATION PROCESS');
      console.log('📋 Article topic:', article.setup.topic);
      console.log('🔢 Question count:', article.setup.questionCount);
      console.log('👤 Expert intro:', article.setup.introQuestions?.length || 0, 'intro questions');

      // Prevent duplicate concurrent generations (e.g., React Strict Mode double-invoke in dev)
      if (typeof window !== 'undefined') {
        window.__QF_GEN_LOCK__ = window.__QF_GEN_LOCK__ || {};
        if (window.__QF_GEN_LOCK__[articleSlug]) {
          console.log('⏩ Skipping duplicate question generation for', articleSlug);
          return;
        }
        window.__QF_GEN_LOCK__[articleSlug] = true;
      }

      setIsGeneratingQuestions(true);

      // Generate questions using Gemini API
      console.log('🔍 Calling Gemini API for question generation...');
      const questionData = await generateArticleQuestions(
        article.setup.topic,
        article.setup.questionCount,
        article.setup.introQuestions || []
      );

      console.log('✅ Received question data from Gemini API');
      console.log('📊 Question data structure:', {
        sectionsCount: questionData.sections?.length || 0,
        totalQuestions: questionData.sections?.reduce((total, section) => total + (section.questions?.length || 0), 0) || 0
      });

      // Transform the structured response into flat questions
      const flatQuestions = [];
      questionData.sections.forEach((section, sectionIndex) => {
        console.log(`📝 Processing section ${sectionIndex + 1}: "${section.title}" (${section.questions?.length || 0} questions)`);
        section.questions.forEach((question, questionIndex) => {
          flatQuestions.push({
            id: `${sectionIndex + 1}.${questionIndex + 1}`,
            section: section.title,
            question: typeof question === 'string' ? question : (question.question || 'Question not available'),
            answer: '',
            isRequired: true
          });
        });
      });

      console.log('🔄 Transformed to flat questions:', flatQuestions.length, 'total questions');

      // Save questions to interview content
      console.log('💾 Saving questions to interview...');
      await saveInterviewContent(user.uid, articleSlug, {
        questions: flatQuestions,
        generatedArticle: null,
        mode: 'text'
      });

      console.log('✅ QUESTION GENERATION COMPLETE - Generated', flatQuestions.length, 'questions');
      setQuestions(flatQuestions);

    } catch (error) {
      console.error('❌ ERROR IN QUESTION GENERATION:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      setQuestionGenerationError(error.message);

      // Use fallback questions on error
      console.log('🔄 Using fallback questions due to error');
      const fallbackQuestions = generateFallbackQuestions(article.setup.topic, article.setup.questionCount);
      setQuestions(fallbackQuestions);
    } finally {
      setIsGeneratingQuestions(false);
      try {
        if (typeof window !== 'undefined' && window.__QF_GEN_LOCK__) {
          delete window.__QF_GEN_LOCK__[articleSlug];
        }
      } catch (_) { }
    }
  }, [user, articleSlug]);

  // Load article data and generate questions if needed
  useEffect(() => {
    const loadArticleAndQuestions = async () => {
      if (!user || !articleSlug) return;

      // Prevent duplicate invocation in dev Strict Mode
      if (process.env.NODE_ENV !== 'production') {
        if (hasLoadedRef.current) {
          console.log('⏩ Skipping duplicate load in Strict Mode');
          return;
        }
        hasLoadedRef.current = true;
      }

      try {
        console.log('📖 LOADING ARTICLE AND QUESTIONS');
        console.log('👤 User ID:', user.uid);
        console.log('📄 Article slug:', articleSlug);

        setIsLoading(true);
        setQuestionGenerationError(null);

        // Try to load existing interview data
        console.log('🔍 Checking for existing interview...');
        const existingArticle = await getInterviewById(user.uid, articleSlug);

        if (existingArticle) {
          console.log('✅ Article found in Firestore');
          console.log('📊 Full interview data:', existingArticle);

          setArticleData(existingArticle);

          // Load existing intro questions if available
          if (existingArticle.setup?.expertIntro) {
            const expertIntro = existingArticle.setup.expertIntro;
            const questions = [];
            const answers = {};

            // Extract questions and answers from expertIntro
            for (let i = 1; i <= 5; i++) {
              const questionKey = `question${i}`;
              const answerKey = `answer${i}`;

              if (expertIntro[questionKey]) {
                questions.push(expertIntro[questionKey]);
                if (expertIntro[answerKey]) {
                  answers[i - 1] = expertIntro[answerKey];
                }
              }
            }

            // Check if intro questions have voice answers (from voice mode)
            // Check both expertIntro answers and questions array for voice responses
            const hasVoiceAnswers = Object.values(answers).some(answer =>
              answer && typeof answer === 'object' && answer.voiceResponse
            ) || existingArticle.questions?.some(q =>
              q.type === 'intro' && q.voiceResponse
            );

            // Skip intro if switching from voice mode OR if voice answers exist
            const shouldSkipIntro = switchedFrom === 'voice' || hasVoiceAnswers;

            if (questions.length > 0 && !shouldSkipIntro) {
              // Only load intro questions if not switching from voice and no voice answers
              setIntroQuestions(questions);
              setIntroAnswers(answers);
              setShowIntroQuestions(true);
              console.log('✅ Loaded existing intro questions:', questions.length);
            } else if (shouldSkipIntro) {
              // Skip intro entirely when switching from voice or voice answers exist
              setCurrentFlowStep('questions');
              console.log('⏭️ Skipping intro section entirely - switching from voice mode or voice answers exist');
            }
          }

          // If questions already exist, use them
          if (existingArticle.questions && existingArticle.questions.length > 0) {
            console.log('✅ Questions already exist - loading from Firestore:', existingArticle.questions.length, 'questions');
            console.log('📋 Questions data:', existingArticle.questions);
            setQuestions(existingArticle.questions);

            // Populate answers from existing data
            const existingAnswers = {};
            existingArticle.questions.forEach((q, idx) => {
              console.log(`🔍 Question ${idx}: ID=${q.id}, Answer=${q.answer ? 'Yes' : 'No'}`);
              if (q.answer) {
                // Store by index to avoid ID collisions in UI state
                existingAnswers[idx] = q.answer;
              }
            });
            console.log('📝 Loaded existing answers:', Object.keys(existingAnswers).length, 'answered questions');
            console.log('📝 Answers data:', existingAnswers);
            setAnswers(existingAnswers);
          } else {
            // Generate new questions
            console.log('🔄 No existing questions found - generating new questions');
            await generateAndSaveQuestions(existingArticle);
          }
        } else {

          // Article not found, redirect back to setup
          console.error('❌ Article not found:', articleSlug);
          router.push('/dashboard/create/interview');
          return;
        }
      } catch (error) {
        console.error('❌ Error loading article:', error);
        setQuestionGenerationError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadArticleAndQuestions();
  }, [user, articleSlug, router]);

  // Generate fallback questions when API fails
  const generateFallbackQuestions = (topic, questionCount) => {
    const sections = [
      {
        title: "Understanding the Basics",
        questions: [
          `What is ${topic} and how does it work?`,
          `What are the key principles of ${topic}?`,
          `How do you get started with ${topic}?`
        ]
      },
      {
        title: "Strategy & Planning",
        questions: [
          `What strategies work best for ${topic}?`,
          `How do you plan a successful ${topic} approach?`,
          `What should beginners focus on first in ${topic}?`
        ]
      },
      {
        title: "Implementation & Execution",
        questions: [
          `What tools do you recommend for ${topic}?`,
          `How do you implement ${topic} effectively?`,
          `What are the best practices for ${topic}?`
        ]
      },
      {
        title: "Common Mistakes & Solutions",
        questions: [
          `What mistakes should people avoid in ${topic}?`,
          `How do you troubleshoot problems with ${topic}?`,
          `What warning signs should people watch for?`
        ]
      },
      {
        title: "Advanced Strategies",
        questions: [
          `What advanced techniques work well in ${topic}?`,
          `How do you optimize results in ${topic}?`,
          `What separates experts from beginners in ${topic}?`
        ]
      }
    ];

    const flatQuestions = [];
    let questionId = 1;

    sections.forEach(section => {
      const questionsToTake = Math.ceil(questionCount / sections.length);
      section.questions.slice(0, questionsToTake).forEach(question => {
        flatQuestions.push({
          id: questionId++,
          sectionTitle: section.title,
          question,
          answered: false,
          answer: '',
          timestamp: null
        });
      });
    });

    return flatQuestions.slice(0, questionCount);
  };

  // Intro question generation logic
  const handleManualQuestionGeneration = async () => {
    if (!topic.trim() || topic.trim().length < 3) {
      return;
    }

    const staticQuestion = `To kick things off, tell us about your background and experience with this topic.
In other words: why should AI trust you as the go-to expert here? This is your chance to share your perspective, insights, and even brag a little. We want to highlight what makes your knowledge unique.
Aim to speak for at least a minute so we have plenty to work with.`;

    try {
      const aiQuestions = await generateIntroQuestions(topic.trim());

      if (Array.isArray(aiQuestions) && aiQuestions.length > 0) {
        const normalized = aiQuestions
          .slice(0, 5)
          .map((q) => (typeof q === 'string' ? q : (q?.question ?? String(q))));
        setIntroQuestions(normalized);
        setShowIntroQuestions(true);
        return;
      }
    } catch (err) {
      console.error('Error generating intro questions, falling back to static:', err);
    }

    // Fallback to a single static question
    setIntroQuestions([staticQuestion]);
    setShowIntroQuestions(true);
  };

  // Check if we can generate intro questions
  const canGenerateIntroQuestions = () => {
    return topic.trim().length >= 3;
  };

  // Handle regenerating questions
  const handleRegenerateQuestions = async () => {
    setIntroQuestions([]);
    setIntroAnswers({});
    await handleManualQuestionGeneration();
  };

  // Handle replacing individual question
  const handleReplaceQuestion = async (questionIndex) => {
    if (!topic.trim()) return;

    try {
      const replacementQuestion = await generateReplacementQuestion(topic.trim(), introQuestions[questionIndex]);

      // Update only the specific question
      const updatedQuestions = [...introQuestions];
      updatedQuestions[questionIndex] = replacementQuestion;
      setIntroQuestions(updatedQuestions);

      // Optionally clear the answer for this question to encourage re-answering
      const updatedAnswers = { ...introAnswers };
      if (updatedAnswers[questionIndex]) {
        delete updatedAnswers[questionIndex];
        setIntroAnswers(updatedAnswers);
      }

    } catch (error) {
      console.error('Error replacing question:', error);
    }
  };

  const handleIntroAnswerChange = (questionIndex, answer) => {
    setIntroAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));

    // Reset intro save status when user starts typing
    if (introSaveStatus === 'saved' || introSaveStatus === 'error') {
      setIntroSaveStatus('idle');
    }
  };

  // Save intro questions and answers to database
  const saveIntroQuestions = useCallback(async () => {
    if (!user || !articleSlug || introQuestions.length === 0) return;

    setIntroSaveStatus('saving');
    setIntroSaveError(null);

    try {
      console.log('💾 Saving intro questions and answers...');

      // Get current interview data
      const currentInterview = await getInterviewById(user.uid, articleSlug);
      if (!currentInterview) {
        throw new Error('Interview not found');
      }

      // Prepare intro data for saving
      const introData = {};
      introQuestions.forEach((question, index) => {
        introData[`question${index + 1}`] = question;
        introData[`answer${index + 1}`] = introAnswers[index] || '';
      });

      // Update interview with intro data
      await updateInterview(user.uid, articleSlug, {
        setup: {
          ...currentInterview.setup,
          expertIntro: introData
        },
        updatedAt: new Date()
      });

      console.log('✅ Intro questions saved successfully');
      setLastIntroSaveTime(new Date());
      setIntroSaveStatus('saved');

      // Reset to idle after showing saved status for 3 seconds
      setTimeout(() => {
        setIntroSaveStatus('idle');
      }, 3000);

    } catch (error) {
      console.error('❌ Error saving intro questions:', error);
      setIntroSaveStatus('error');
      setIntroSaveError(error.message);
    }
  }, [user, articleSlug, introQuestions, introAnswers]);

  // Enhanced auto-save functionality with debouncing and retry logic
  useEffect(() => {
    if (autoSaveEnabled && Object.keys(pendingAnswers).length > 0 && user && articleSlug) {
      const saveTimeout = setTimeout(() => {
        handleAutoSave();
      }, 2000); // 2 second debounce

      return () => clearTimeout(saveTimeout);
    }
  }, [pendingAnswers, user, articleSlug, autoSaveEnabled]);

  // Auto-generate intro question when topic is available
  useEffect(() => {
    if (topic.trim().length >= 3 && introQuestions.length === 0 && !showIntroQuestions) {
      setIntroQuestions([STATIC_INTRO_QUESTION]);
      setShowIntroQuestions(true);
    }
  }, [topic, introQuestions.length, showIntroQuestions]);

  // Update intro completion status
  useEffect(() => {
    const completed = isIntroQuestionComplete();
    setIsIntroComplete(completed);
  }, [introAnswers, introQuestions]);

  // Auto-save intro questions when they change (debounced)
  useEffect(() => {
    if (autoSaveEnabled && Object.keys(introAnswers).length > 0 && user && articleSlug && introQuestions.length > 0) {
      const saveTimeout = setTimeout(() => {
        saveIntroQuestions();
      }, 2000); // 2 second debounce

      return () => clearTimeout(saveTimeout);
    }
  }, [introAnswers, user, articleSlug, autoSaveEnabled, introQuestions.length, saveIntroQuestions]);

  // Save intro questions when proceeding to main questions
  useEffect(() => {
    if (currentFlowStep === 'questions' && introQuestions.length > 0) {
      saveIntroQuestions();
    }
  }, [currentFlowStep, introQuestions.length, saveIntroQuestions]);

  const handleAutoSave = useCallback(async () => {
    if (!user || !articleSlug || Object.keys(pendingAnswers).length === 0) return;

    setAutoSaveStatus('saving');
    setIsSaving(true);
    setAutoSaveError(null);

    try {
      console.log('🔄 Starting auto-save process...');
      console.log('📝 Pending answers to save:', pendingAnswers);
      console.log('📊 Questions array:', questions);

      // Get the current interview data first to ensure we have the latest
      const currentInterview = await getInterviewById(user.uid, articleSlug);
      if (!currentInterview) {
        throw new Error('Interview not found');
      }

      console.log('📋 Current interview data:', currentInterview);

      // Update the questions array with new answers
      const updatedQuestions = [...(currentInterview.questions || [])];

      // Process each pending answer
      Object.entries(pendingAnswers).forEach(([questionId, answer]) => {
        console.log(`🔍 Processing answer for question ID: ${questionId}`);

        // Find the question by ID in the questions array
        const questionIndex = updatedQuestions.findIndex(q => q.id === questionId);

        if (questionIndex !== -1) {
          console.log(`✅ Found question at index ${questionIndex}, updating answer`);
          updatedQuestions[questionIndex] = {
            ...updatedQuestions[questionIndex],
            answer: answer,
            answered: answer.trim().length > 0,
            timestamp: new Date()
          };
        } else {
          console.log(`❌ Question with ID ${questionId} not found in questions array`);
        }
      });

      console.log('📤 Saving updated questions:', updatedQuestions);

      // Save the entire updated questions array
      await updateInterview(user.uid, articleSlug, {
        questions: updatedQuestions,
        updatedAt: new Date()
      });

      console.log('✅ Auto-save completed successfully');

      // Clear pending answers after successful save (only if auto-save is enabled)
      if (autoSaveEnabled) {
        setPendingAnswers({});
      }
      setLastSavedTime(new Date());
      setAutoSaveStatus('saved');
      setSaveRetryCount(0);

      // Reset to idle after showing saved status for 3 seconds
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 3000);

    } catch (error) {
      console.error('❌ Auto-save failed:', error);
      console.error('Error details:', error.message);
      setAutoSaveStatus('error');
      setAutoSaveError(error.message);

      // Implement retry logic with exponential backoff
      const retryDelay = Math.min(1000 * Math.pow(2, saveRetryCount), 30000); // Max 30 seconds

      if (saveRetryCount < 3) {
        setTimeout(() => {
          setSaveRetryCount(prev => prev + 1);
          handleAutoSave();
        }, retryDelay);
      }
    } finally {
      setIsSaving(false);
    }
  }, [user, articleSlug, pendingAnswers, saveRetryCount, questions]);

  const handleAnswerChange = (questionIndex, answer) => {
    const question = questions[questionIndex];
    if (!question) return;

    const questionId = question.id;

    console.log('Answer change:', {
      questionIndex,
      questionId,
      answerLength: answer.length,
      answerPreview: answer.substring(0, 50) + (answer.length > 50 ? '...' : ''),
      autoSaveEnabled
    });

    // Update answers state using index as key to avoid duplicates
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));

    // Always track pending answers for navigation warnings (independent of auto-save)
    setPendingAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));

    // Update questions array with answered status using index
    setQuestions(prev => prev.map((q, idx) =>
      idx === questionIndex
        ? { ...q, answer, answered: answer.trim().length > 0 }
        : q
    ));

    // Reset auto-save status when user starts typing (only if auto-save is enabled)
    if (autoSaveEnabled && (autoSaveStatus === 'saved' || autoSaveStatus === 'error')) {
      setAutoSaveStatus('idle');
    }
  };

  const goToQuestion = (index) => {
    setCurrentQuestionIndex(index);
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };


  const getProgress = () => {
    const answeredCount = questions.filter(q => q.answered).length;
    return Math.round((answeredCount / questions.length) * 100);
  };

  const getAnsweredCount = () => {
    return questions.filter(q => q.answered).length;
  };



  // Manual retry function for failed auto-saves
  const handleManualRetry = useCallback(() => {
    setSaveRetryCount(0);
    setAutoSaveError(null);
    handleAutoSave();
  }, [handleAutoSave]);

  // Manual save functions - optimized to minimize API calls
  const handleManualSaveCurrent = useCallback(async () => {
    console.log('🔄 handleManualSaveCurrent called');

    if (!user || !articleSlug) {
      console.error('❌ Missing user or articleSlug:', { user: !!user, articleSlug });
      return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) {
      console.error('❌ No current question found at index:', currentQuestionIndex);
      return;
    }

    const currentAnswer = answers[currentQuestionIndex] || '';
    const questionId = currentQuestion.id;

    console.log('📝 Manual save current details:', {
      questionId,
      questionIndex: currentQuestionIndex,
      currentAnswer: currentAnswer.substring(0, 50) + (currentAnswer.length > 50 ? '...' : ''),
      storedAnswer: (currentQuestion.answer || '').substring(0, 50) + (currentQuestion.answer?.length > 50 ? '...' : ''),
      hasChanges: currentAnswer.trim() !== (currentQuestion.answer || '').trim(),
      userId: user.uid,
      articleSlug
    });

    setManualSaveStatus('saving');
    setManualSaveError(null);

    try {
      console.log('🔍 Fetching current interview data...');
      // Get current interview data
      const currentInterview = await getInterviewById(user.uid, articleSlug);
      if (!currentInterview) {
        throw new Error('Interview not found');
      }

      console.log('✅ Interview data retrieved:', {
        hasQuestions: !!currentInterview.questions,
        questionCount: currentInterview.questions?.length || 0
      });

      // Update only the current question
      const updatedQuestions = [...(currentInterview.questions || [])];
      const questionIndex = updatedQuestions.findIndex(q => q.id === questionId);

      console.log('🔍 Question lookup result:', {
        questionId,
        foundAtIndex: questionIndex,
        totalQuestions: updatedQuestions.length
      });

      if (questionIndex !== -1) {
        console.log('📝 Updating question data...');
        updatedQuestions[questionIndex] = {
          ...updatedQuestions[questionIndex],
          answer: currentAnswer,
          answered: currentAnswer.trim().length > 0,
          timestamp: new Date()
        };

        console.log('💾 Saving to Firestore...');
        // Save to Firestore
        await updateInterview(user.uid, articleSlug, {
          questions: updatedQuestions,
          updatedAt: new Date()
        });

        console.log('✅ Save successful, updating local state...');
        // Update local state
        setQuestions(updatedQuestions);
        setLastManualSaveTime(new Date());
        setManualSaveStatus('saved');

        // Always clear from pending answers after manual save (for navigation warnings)
        setPendingAnswers(prev => {
          const updated = { ...prev };
          delete updated[questionId];
          return updated;
        });

        // Reset after 2 seconds
        setTimeout(() => setManualSaveStatus('idle'), 2000);
      } else {
        throw new Error(`Question with ID ${questionId} not found in database`);
      }
    } catch (error) {
      console.error('❌ Manual save failed:', error);
      setManualSaveStatus('error');
      setManualSaveError(error.message);
    }
  }, [user, articleSlug, questions, currentQuestionIndex, answers]);

  const handleManualSaveAll = useCallback(async () => {
    console.log('🔄 handleManualSaveAll called');

    if (!user || !articleSlug) {
      console.error('❌ Missing user or articleSlug:', { user: !!user, articleSlug });
      return;
    }

    console.log('📊 Manual save all details:', {
      userId: user.uid,
      articleSlug,
      totalQuestions: questions.length,
      totalAnswers: Object.keys(answers).length,
      pendingAnswers: Object.keys(pendingAnswers).length
    });

    setManualSaveStatus('saving');
    setManualSaveError(null);

    try {
      console.log('🔍 Fetching current interview data...');
      // Get current interview data
      const currentInterview = await getInterviewById(user.uid, articleSlug);
      if (!currentInterview) throw new Error('Interview not found');

      console.log('✅ Interview data retrieved:', {
        hasQuestions: !!currentInterview.questions,
        questionCount: currentInterview.questions?.length || 0
      });

      // Update all questions with current local answers
      const updatedQuestions = [...(currentInterview.questions || [])];

      console.log('🔄 Updating all questions...');
      questions.forEach((question, idx) => {
        const localAnswer = answers[idx] || '';
        const questionIndex = updatedQuestions.findIndex(q => q.id === question.id);

        if (questionIndex !== -1) {
          console.log(`📝 Updating question ${question.id}: "${localAnswer.substring(0, 30)}..."`);
          updatedQuestions[questionIndex] = {
            ...updatedQuestions[questionIndex],
            answer: localAnswer,
            answered: localAnswer.trim().length > 0,
            timestamp: new Date()
          };
        } else {
          console.warn(`⚠️ Question ${question.id} not found in database`);
        }
      });

      console.log('💾 Saving to Firestore...');
      // Save to Firestore
      await updateInterview(user.uid, articleSlug, {
        questions: updatedQuestions,
        updatedAt: new Date()
      });

      console.log('✅ Save successful, updating local state...');
      // Update local state
      setQuestions(updatedQuestions);
      setLastManualSaveTime(new Date());
      setManualSaveStatus('saved');

      // Always clear pending answers after manual save all (for navigation warnings)
      setPendingAnswers({});

      // Reset after 2 seconds
      setTimeout(() => setManualSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('❌ Manual save all failed:', error);
      setManualSaveStatus('error');
      setManualSaveError(error.message);
    }
  }, [user, articleSlug, questions, answers, pendingAnswers]);

  // Helper functions for article generation (copied from compile page)
  const getAnsweredCountForGeneration = () => {
    if (!questions || !Array.isArray(questions)) return 0;
    return questions.filter(q => q && q.answer && typeof q.answer === 'string' && q.answer.trim().length > 0).length;
  };

  const getTotalQuestions = () => {
    return (questions && Array.isArray(questions)) ? questions.length : 0;
  };

  const areAllQuestionsAnswered = () => {
    const total = getTotalQuestions();
    const answered = getAnsweredCountForGeneration();
    return total > 0 && answered === total;
  };

  // Intro question validation
  const isIntroQuestionComplete = () => {
    if (introQuestions.length === 0) return false;
    const MIN_ANSWER_LENGTH = 100;
    const hasSufficient = Object.values(introAnswers).some(answer =>
      answer && answer.trim().length >= MIN_ANSWER_LENGTH
    );
    return hasSufficient;
  };

  const canProceedToQuestions = () => {
    return isIntroQuestionComplete() && topic.trim().length >= 3;
  };

  const handleProceedToQuestions = () => {
    if (canProceedToQuestions()) {
      setCurrentFlowStep('questions');
    }
  };

  // URL validation function for reference link
  const validateUrl = (url) => {
    const trimmed = url.trim();
    if (!trimmed) return { isValid: true, error: null };
    
    try {
      new URL(trimmed);
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return { isValid: false, error: 'URL must start with http:// or https://' };
      }
      return { isValid: true, error: null };
    } catch {
      return { isValid: false, error: 'Please enter a valid URL' };
    }
  };

  // Link description validation
  const validateLinkDescription = (description, hasLink) => {
    if (!hasLink) return { isValid: true, error: null };
    
    const trimmed = description.trim();
    if (!trimmed) {
      return { isValid: false, error: 'Link description is required when reference link is provided' };
    }
    if (trimmed.length < 10) {
      return { isValid: false, error: 'Link description must be at least 10 characters' };
    }
    return { isValid: true, error: null };
  };

  // Promotional Link modal handlers
  const openPromotionalLinkModal = () => {
    setIsPromotionalLinkModalOpen(true);
  };

  const closePromotionalLinkModal = () => {
    setIsPromotionalLinkModalOpen(false);
  };

  const handlePromotionalLinkSave = (linkData) => {
    setReferenceLink(linkData.referenceLink);
    setLinkDescription(linkData.linkDescription);
    setLinkFrequency(linkData.linkFrequency);
    closePromotionalLinkModal();
  };

  // Article generation function (copied from compile page)
  const generateArticleFromInterview = async () => {
    console.log('🚀 STARTING ARTICLE GENERATION FROM INTERVIEW DATA');

    if (!articleData || !user) {
      const errorMsg = 'No interview data available or user not authenticated';
      console.error('❌ Generation failed:', errorMsg);
      setGenerationError(errorMsg);
      return;
    }

    if (!isIntroQuestionComplete()) {
      const errorMsg = 'Please complete the expert introduction questions first';
      console.error('❌ Generation failed:', errorMsg);
      setGenerationError(errorMsg);
      return;
    }

    if (!areAllQuestionsAnswered()) {
      const errorMsg = 'All questions must be answered before generating the article';
      console.error('❌ Generation failed:', errorMsg);
      setGenerationError(errorMsg);
      return;
    }

    console.log('✅ User authenticated:', user.uid);
    console.log('📊 Interview data available:', !!articleData);
    console.log('📝 Topic:', topic);

    setIsGeneratingArticle(true);
    setGenerationError(null);
    setGenerationStartTime(Date.now());
    setElapsedTime(0);
    setProgress(0);
    setTargetProgress((prev) => Math.max(prev, 10));

    try {
      setGenerationStep('Initializing AI content generation...');
      setTargetProgress((prev) => Math.max(prev, 15));

      // Get user's Firebase Auth token
      console.log('🔑 Getting Firebase Auth token...');
      const token = await user.getIdToken();
      console.log('✅ Auth token obtained');

      // Prepare interview content for the prompt
      console.log('📋 Preparing interview content for prompt...');
      const interviewContent = {
        topic: topic,
        expertIntro: articleData.setup?.expertIntro || {},
        introQuestions: introQuestions,
        introAnswers: introAnswers,
        questions: questions || []
      };

      console.log('📊 Interview content prepared:', {
        topic: interviewContent.topic,
        expertIntroKeys: Object.keys(interviewContent.expertIntro),
        questionsCount: interviewContent.questions.length
      });

      // Create the prompt
      const expertBackgroundText = Object.entries(interviewContent.expertIntro).map(([key, value]) => {
        if (key.startsWith('question') && value) {
          const answerKey = key.replace('question', 'answer');
          const answer = interviewContent.expertIntro[answerKey] || '';
          return `Q: ${value}\nA: ${answer}`;
        }
        return '';
      }).filter(item => item).join('\n\n');

      const questionsAndAnswersText = interviewContent.questions.map((q, index) =>
        `Question ${index + 1}: ${q.question || 'N/A'}\nAnswer: ${q.answer || 'Not answered'}`
      ).join('\n\n');

      const prompt = `Transform this expert interview into a comprehensive, SEO-optimized article using AIO (Artificial Intelligence Optimization) principles.

CONTENT ENHANCEMENT INSTRUCTIONS: 
Use the provided interview responses as INSPIRATION and FOUNDATION, not literal text. Your goal is to create polished, authoritative content that maintains the expert's voice while significantly enhancing readability, depth, and SEO value.

ENHANCEMENT APPROACH:
- Take the core ideas, insights, and expertise from each response
- Expand brief responses with authoritative, relevant information  
- Improve grammar, flow, and professional tone
- Add substance that creates engaging, comprehensive answers
- Maintain the expert's authentic voice and perspective
- Write as if a professional content writer interviewed the expert

Interview Topic: "${topic}"

Expert Background Information (use as inspiration for bio/intro):
${expertBackgroundText}

Interview Responses (use as foundation, enhance significantly):
${questionsAndAnswersText}

CONTENT CREATION GUIDELINES:
✅ DO: Use responses as inspiration to create comprehensive, AIO-optimized content
✅ DO: Expand brief answers with relevant, authoritative information  
✅ DO: Improve grammar, structure, and professional tone
✅ DO: Add examples, case studies, and actionable insights where appropriate
✅ DO: Create engaging, human-like writing that sounds natural
✅ DO: Maintain the expert's perspective and voice throughout
✅ DO: Keep all original questions exactly as provided

❌ DON'T: Copy responses word-for-word without enhancement
❌ DON'T: Create content unrelated to the expert's responses
❌ DON'T: Change the expert's core message or expertise area
❌ DON'T: Modify or create new questions - use exact questions provided

Generate a detailed JSON article with the following EXACT structure:

{
 "title": "Engaging title with emoji based on the interview topic",
 "subtitle": "Compelling subtitle summarizing the expert's insights",
 "key_takeaways": ["Create 3-5 key takeaways inspired by the interview responses - enhance and expand the core insights professionally"],
 "intro_md": "Write compelling introduction (2-3 paragraphs) using the expert background as foundation - enhance with professional tone and additional context that supports their expertise",
 "toc": [
   {
     "section_title": "Interview Questions",
     "questions": ["LIST ALL THE EXACT QUESTIONS FROM THE INTERVIEW ABOVE - COPY THEM WORD-FOR-WORD, DO NOT MODIFY OR CREATE NEW ONES"]
   }
 ],
 "faqs": [
   {
     "section_title": "Frequently Asked Questions",
     "question": "COPY ONE OF THE EXACT QUESTIONS FROM THE INTERVIEW ABOVE WORD-FOR-WORD - USE THE SAME QUESTIONS AS IN TOC - INCLUDE ALL QUESTIONS FROM TOC IN FAQ SECTION",
     "answer_md": "Use the interview response as foundation and create comprehensive, AIO-optimized answer - enhance with professional tone, additional context, examples, and actionable insights while maintaining the expert's voice",
     "real_results": "Include concrete data/results from the interview response and enhance with relevant statistics, case studies, or examples that support the expert's points",
     "takeaway": "Create actionable takeaway inspired by the expert's response - enhance with specific steps, best practices, or key insights"
   }
 ],
 "tables": [
   {
     "title": "Table title inspired by interview content - create professional, descriptive title",
     "headers": ["Column headers based on interview themes - enhance for clarity and professionalism"],
     "rows": [["Create data points inspired by interview responses - enhance with relevant information that supports the expert's insights"]]
   }
 ],
 "checklists": {
   "launch": ["Create actionable checklist items inspired by the interview responses - enhance with specific, professional steps"],
   "post_contest": ["Create additional checklist items based on interview themes - enhance with comprehensive, actionable guidance"]
 },
 "author": {
   "name": "Create professional author name based on interview context and expertise area",
   "bio": "Write compelling bio using the expert background as foundation - enhance with professional tone and additional context that supports their credibility"
 },
 "cta": {
   "text": "Create call to action based on interview topic",
   "url": "#"
 },
 "metadata": {
   "meta_description": "Create compelling meta description inspired by interview content (120-158 characters) - enhance for SEO while maintaining expert's core message"
 }
}

ABSOLUTE REQUIREMENTS:
- QUESTIONS: Use the exact questions provided - do not modify or create new questions
- For TOC questions array: Copy ALL the exact questions from the interview word-for-word
- For FAQ section: Generate the SAME NUMBER of FAQ entries as there are questions in TOC - use ALL questions from TOC
- For FAQ questions: Use the exact questions from TOC - do not modify or create new ones
- CONTENT ENHANCEMENT: Use interview responses as foundation and enhance significantly with professional, AIO-optimized content
- VOICE: Maintain the expert's authentic perspective and expertise area while enhancing tone and substance
- STRUCTURE: Follow the exact JSON structure provided - do not modify field names or structure
- META: Generate meta_description EXACTLY 120-158 characters with enhanced, SEO-optimized content`;

      // Use environment variable for API base URL
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ||
        (process.env.NODE_ENV === 'production'
          ? 'https://us-central1-queryfuel-f830f.cloudfunctions.net/api'
          : 'http://127.0.0.1:5002/lead-generation-6cf0f/us-central1/api');

      // Contacting backend
      setGenerationStep('Contacting AI...');
      setTargetProgress((prev) => Math.max(prev, 35));

      const introQaPairs = [];
      const seenIntroQuestions = new Set();

      const addIntroPair = (question, answer, id = null) => {
        const questionText = typeof question === 'string' ? question.trim() : '';
        const answerText = typeof answer === 'string' ? answer.trim() : '';
        if (!questionText || !answerText) {
          return;
        }
        const key = questionText.toLowerCase();
        if (seenIntroQuestions.has(key)) {
          return;
        }
        seenIntroQuestions.add(key);
        introQaPairs.push({
          question: questionText,
          answer: answerText,
          id
        });
      };

      const expertIntroData = articleData.setup?.expertIntro || {};
      Object.keys(expertIntroData)
        .filter(key => key.toLowerCase().startsWith('question'))
        .forEach(questionKey => {
          const suffix = questionKey.slice('question'.length);
          const answerKey = `answer${suffix}`;
          addIntroPair(expertIntroData[questionKey], expertIntroData[answerKey]);
        });

      interviewContent.questions.forEach((q, index) => {
        if (!q) return;
        const sectionLabel = (q.sectionTitle || q.section || '').toLowerCase();
        const idString = typeof q.id === 'string' ? q.id.toLowerCase() : '';
        const looksLikeIntro =
          sectionLabel.includes('intro') ||
          sectionLabel.includes('expert') ||
          idString.startsWith('intro-') ||
          idString.includes('intro');
        if (!looksLikeIntro) return;

        const answerText = typeof q.answer === 'string' ? q.answer : '';
        addIntroPair(
          typeof q.question === 'string' ? q.question : q.question?.question,
          answerText,
          q.id ?? index
        );
      });

      const requestBody = {
        topic: topic,
        expertIntro: interviewContent.expertIntro,
        introQuestions: interviewContent.introQuestions,
        introAnswers: interviewContent.introAnswers,
        questions: interviewContent.questions,
        introQaPairs,
        // Add promotional link parameters
        referenceLink: referenceLink.trim(),
        linkDescription: linkDescription.trim(),
        linkFrequency: linkFrequency,
      };

      // Create AbortController for 3-minute timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 180000); // 3 minutes = 180,000 milliseconds

      try {
        const response = await fetch(`${apiBaseUrl}/gemini/generate-interview-article`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        // Clear timeout if request completes successfully
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('❌ API Error Response:', errorData);
          throw new Error(errorData.error?.message || 'Failed to generate article');
        }

        setGenerationStep('Processing article content...');
        setTargetProgress((prev) => Math.max(prev, 70));
        const articleData = await response.json();

        if (!articleData.success) {
          console.error('❌ API returned success=false:', articleData.error);
          throw new Error(articleData.error?.message || 'Article generation failed');
        }

        console.log('✅ Article data received successfully');

        // Save to Firestore using the interview-specific structure
        console.log('💾 Saving interview article to Firestore...');
        const { saveInterviewArticleToFirestore } = await import('../../../../../services/articleService');

        const articleMode = (articleData && (articleData._source === 'voice' || articleData._source === 'text'))
          ? articleData._source
          : 'text';

        const articleId = await saveInterviewArticleToFirestore(
          user.uid,
          topic.trim(),
          articleData.data,
          articleMode
        );

        console.log('✅ Interview article saved to Firestore with ID:', articleId);

        // Update interview status
        console.log('📝 Updating original interview record status to view...');
        const { updateInterview } = await import('../../../../../services/interviewService');

        await updateInterview(user.uid, articleSlug, {
          status: 'view',
          journeyStatus: 'complete',
          completedAt: new Date()
        });
        console.log('✅ Original interview record status updated to view');

        // Navigate to article view
        setGenerationStep('Opening your article...');
        setTargetProgress((prev) => Math.max(prev, 100));
        setIsTransitioning(true);

        // Allow the overlay to paint, then navigate
        requestAnimationFrame(() => {
          setTimeout(() => {
            router.push(`/dashboard/articles/view?id=${articleId}&source=interview&keywordId=${encodeURIComponent(topic.trim())}`);
          }, 160);
        });

        console.log('🎉 Interview article generation and saving completed successfully!');

      } catch (fetchError) {
        // Clear timeout in case of error
        clearTimeout(timeoutId);

        // Handle timeout specifically
        if (fetchError.name === 'AbortError') {
          console.error('⏰ Article generation timed out after 3 minutes');
          throw new Error('Article generation timed out after 3 minutes. Your credits have been refunded.');
        }

        // Re-throw other fetch errors
        throw fetchError;
      }

    } catch (error) {
      console.error('❌ Article generation error:', error);
      setGenerationError(error.message || 'Failed to generate article');
      setGenerationStartTime(null);
      setElapsedTime(0);
      setTargetProgress((prev) => Math.max(prev, 100));
      setProgress(100);
    } finally {
      console.log('🏁 Article generation process completed');
      setIsGeneratingArticle(false);
    }
  };

  // Mode switching handlers
  const handleSwitchToVoice = () => {
    // Switch to voice interview mode
    router.push(`/dashboard/create/interview/voice?id=${articleSlug}&topic=${encodeURIComponent(topic)}`);
  };

  const handleModeSwitchStart = (targetMode) => {
    console.log(`Starting switch to ${targetMode} mode`);
  };

  const handleModeSwitchComplete = (result) => {
    console.log('Mode switch completed:', result);
  };

  const handleModeSwitchError = (error) => {
    console.error('Mode switch error:', error);
    setQuestionGenerationError(`Failed to switch modes: ${error.message}`);
  };

  const getCurrentState = () => ({
    currentQuestionIndex,
    answers,
    questions,
    pendingData: pendingAnswers
  });

  const getCurrentQuestion = () => {
    const question = questions[currentQuestionIndex];
    if (!question) return null;

    // Normalize the current question to ensure consistent structure
    return {
      id: question.id || currentQuestionIndex + 1,
      question: typeof question.question === 'string' ? question.question :
        (question.question?.question || question || 'Question not available'),
      sectionTitle: question.sectionTitle || question.section || 'General Questions',
      answered: question.answered || false,
      // Prefer in-memory edited answer by index; fallback to persisted value
      answer: answers[currentQuestionIndex] ?? question.answer ?? ''
    };
  };

  const groupQuestionsBySection = () => {
    const grouped = {};
    questions.forEach((question, index) => {
      // Normalize question data to ensure consistent structure
      const normalizedQuestion = {
        id: question.id || `question-${index}`, // Ensure unique ID using index as fallback
        question: typeof question.question === 'string' ? question.question :
          (question.question?.question || question || 'Question not available'),
        sectionTitle: question.sectionTitle || question.section || 'General Questions',
        answered: question.answered || false,
        answer: question.answer || '',
        index
      };

      const sectionTitle = normalizedQuestion.sectionTitle;
      if (!grouped[sectionTitle]) {
        grouped[sectionTitle] = [];
      }
      grouped[sectionTitle].push(normalizedQuestion);
    });
    return grouped;
  };

  const formatSaveTime = (time) => {
    const now = new Date();
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;

    return time.toLocaleDateString();
  };

  if (loading || isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>
          {isGeneratingQuestions
            ? 'Generating your personalized interview questions...'
            : 'Loading your interview questions...'
          }
        </p>
        {isGeneratingQuestions && (
          <div className={styles.generationProgress}>
            <p className={styles.generationNote}>
              This may take a moment as we create questions tailored to your expertise
            </p>
          </div>
        )}
      </div>
    );
  }

  if (authError || questionGenerationError) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>
          <h3>{authError ? 'Authentication Error' : 'Question Generation Error'}</h3>
          <p>{authError || questionGenerationError}</p>
          {authError ? (
            <button onClick={() => router.push('/login')} className={styles.errorButton}>
              Go to Login
            </button>
          ) : (
            <div className={styles.errorActions}>
              <button
                onClick={() => window.location.reload()}
                className={styles.errorButton}
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/dashboard/create/interview')}
                className={styles.errorButtonSecondary}
              >
                Back to Setup
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user || !isAuthenticated) {
    return null;
  }

  // Show loading while questions are being generated
  if (isLoading || isGeneratingQuestions) {
    return null;
  }

  // If we don't have questions yet but intro is complete, show loading
  if (currentFlowStep === 'questions' && questions.length === 0) {
    return null;
  }

  const currentQuestion = getCurrentQuestion();
  const questionProgress = getProgress();
  const answeredCount = getAnsweredCount();
  const groupedQuestions = groupQuestionsBySection();
  const safeQuestionProgress = Number.isFinite(questionProgress) ? questionProgress : 0;
  const totalQuestions = questions.length;
  const currentQuestionNumber = totalQuestions > 0 ? Math.min(currentQuestionIndex + 1, totalQuestions) : 0;
  const pendingCount = Object.keys(pendingAnswers).length;
  const interviewLevelLabel = 'Expert Level Interview';
  return (
    <div className={styles.interviewPage}>
      <div className="container-fluid">
        {/* Header */}
        <div className="row">
          <div className="col-12">
            <nav
              className="navbar navbar-expand-sm navbar-light bg-white rounded-4 shadow-sm px-3 px-md-4 py-2 mb-2 mx-auto"
              style={{ maxWidth: '1450px', minHeight: '60px', padding: '0.75rem 2rem' }}
            >
              <div className="container-fluid d-flex align-items-center justify-content-between px-0">
                <div className="d-flex align-items-center gap-2" style={{ marginLeft: '-0.5rem' }}>
                  <span aria-hidden="true" className="d-inline-flex align-items-center justify-content-center" style={{ background: '#dbeafe', color: '#3b82f6', border: '1px solid #bfdbfe', width: 32, height: 32, borderRadius: 10, fontSize: 14, fontWeight: 700 }}>{topic.charAt(0).toUpperCase()}</span>
                  <h5 className="mb-0 fw-semibold" style={{ color: '#2563eb' }}>Expert Interview: {topic}</h5>
                </div>
                <div className="d-none d-sm-flex align-items-center gap-2">
                  {autoSaveEnabled && (
                    <span className="badge rounded-pill bg-light text-secondary border" title="Auto-save is on">
                      <span className="me-1">🕒</span>Auto-saving
                    </span>
                  )}
                  <span className="badge rounded-pill bg-light text-success border" title="Connection status">
                    <span className="me-1" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, background: '#22c55e' }} />
                    Online
                  </span>
                </div>
              </div>
            </nav>
          </div>
        </div>
        <div className={styles.mainLayout}>
          <div className={styles.leftPanel}>
            <div className={styles.leftDrawer}>
              {/* Question Navigation - At Top */}
              {currentFlowStep !== 'intro' && questions.length > 0 && (
                <div className={styles.drawerSection}>
                  <div className="card border-0 shadow-sm rounded-4" style={{ background: '#ffffff', maxHeight: '280px', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '1rem' }}>
                    <div className="card-header bg-white d-flex align-items-center gap-2 py-3 px-3" style={{ borderBottom: '2px solid #d1d5db', flexShrink: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
                      <span className="badge rounded d-flex align-items-center gap-2" style={{ backgroundColor: '#16a34a', color: '#ffffff', fontSize: '0.9rem', fontWeight: '700', padding: '0.5rem 1rem' }}>
                        <i className="bi bi-file-text" style={{ fontSize: '1rem' }}></i>
                        Questions
                      </span>
                    </div>
                    <div className="card-body p-0" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                      <div className={styles.questionsList}>
{questions.map((question, index) => {
                        const sectionTitle = question.sectionTitle || question.section || 'General';
                        const getCategoryColors = (section) => {
                          const lowerSection = section.toLowerCase();
                          if (lowerSection.includes('basic') || lowerSection.includes('foundation') || lowerSection.includes('understanding')) return { bg: '#dcfce7', text: '#166534' };
                          if (lowerSection.includes('advanced') || lowerSection.includes('expert') || lowerSection.includes('future')) return { bg: '#fef3c7', text: '#92400e' };
                          if (lowerSection.includes('strategy') || lowerSection.includes('planning')) return { bg: '#dbeafe', text: '#1e40af' };
                          if (lowerSection.includes('implementation') || lowerSection.includes('execution')) return { bg: '#e9d5ff', text: '#6b21a8' };
                          if (lowerSection.includes('measuring') || lowerSection.includes('success') || lowerSection.includes('metrics')) return { bg: '#fce7f3', text: '#9f1239' };
                          if (lowerSection.includes('mistake') || lowerSection.includes('solution') || lowerSection.includes('common')) return { bg: '#fed7aa', text: '#9a3412' };
                          return { bg: '#e5e7eb', text: '#374151' };
                        };
                        const colors = getCategoryColors(sectionTitle);
                        return (
                          <div key={question.id || index} className={`${styles.questionItem} ${index === currentQuestionIndex ? styles.questionItemActive : ''}`} onClick={() => goToQuestion(index)}>
                            <div className={styles.questionItemHeader}>
                              <div className={styles.questionItemRadio}>
                                <input type="radio" name="questionRadio" checked={index === currentQuestionIndex} onChange={() => {}} style={{ cursor: 'pointer' }} />
                              </div>
                              <div className={styles.questionItemContent}>
                                <div className={styles.questionItemMeta}>
                                  <span className={styles.questionBadge} style={{ backgroundColor: colors.bg, color: colors.text }}>{sectionTitle}</span>
                                  {question.answered && (<i className="bi bi-check-circle-fill" style={{ color: '#22c55e', fontSize: '0.9rem' }} title="Answered"></i>)}
                                  {autoSaveEnabled && pendingAnswers[question.id] !== undefined && (<i className="bi bi-clock-fill" style={{ color: '#f59e0b', fontSize: '0.9rem' }} title="Unsaved changes"></i>)}
                                </div>
                                <div className={styles.questionItemTextRow}>
                                  <div className={styles.questionItemNumber}>Q{index + 1}:</div>
                                  <div className={styles.questionItemText}>{question.question || question || 'Question not available'}</div>
                                </div>
                              </div>
                              <div className={styles.questionItemArrows}>
                                <i className="bi bi-chevron-up" style={{ fontSize: '0.75rem', color: '#9ca3af' }}></i>
                                <i className="bi bi-chevron-down" style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '-0.25rem' }}></i>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {currentFlowStep !== 'intro' && (
                <div className={`${styles.drawerSection} ${styles.progressCardSection}`}>
                  <div
                    className="card border-0 shadow-sm rounded-4"
                    style={{
                      background: '#ffffff',
                      border: '1px solid rgba(148, 163, 184, 0.18)',
                      boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)'
                    }}
                  >
                    <div className="card-body px-3 py-3">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <span className="badge rounded d-flex align-items-center gap-2" style={{ backgroundColor: '#3b82f6', color: '#ffffff', fontSize: '0.9rem', fontWeight: '700', padding: '0.5rem 1rem' }}>
                            <i className="bi bi-graph-up" style={{ fontSize: '1rem' }}></i>
                            Progress
                          </span>
                          <div className="text-muted small mt-1">
                            Question {currentQuestionNumber} of {totalQuestions || 0}
                          </div>
                        </div>
                        <div className="text-end ms-3">
                          <div
                            className="fw-bold"
                            style={{ color: '#6366f1', fontSize: '1.5rem', lineHeight: 1 }}
                          >
                            {safeQuestionProgress}%
                          </div>
                          <div className="text-muted small">{answeredCount} answered</div>
                          {autoSaveEnabled && pendingCount > 0 && (
                            <span className="badge rounded-pill bg-warning text-dark mt-2">
                              {pendingCount} unsaved
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className="progress rounded-pill mt-2"
                        style={{ height: '5px', backgroundColor: '#e5e7eb' }}
                      >
                        <div
                          className="progress-bar rounded-pill"
                          role="progressbar"
                          style={{
                            width: `${Math.min(Math.max(safeQuestionProgress, 0), 100)}%`,
                            background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)'
                          }}
                          aria-valuenow={safeQuestionProgress}
                          aria-valuemin="0"
                          aria-valuemax="100"
                        />
                      </div>

                      <div className="d-flex align-items-center text-muted small mt-2">
                        <span
                          className="me-2"
                          aria-hidden="true"
                          style={{ color: '#6366f1', fontSize: '1.1rem' }}
                        >
                          👤
                        </span>
                        <span className="fw-medium" style={{ color: '#475569' }}>
                          {interviewLevelLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Settings + Status Card (Bootstrap) */}
              <div className={`card shadow-sm rounded-4 mb-2 ${styles.settingsCard}`} style={{ minHeight: currentFlowStep === 'intro' ? '80vh' : undefined }}>
                <div className={`card-body ${styles.settingsCardBody}`}>
                  {currentFlowStep === 'intro' && (
                    <div className="alert mt-2 mb-3" style={{ background:'#eaf2ff', border:'1px solid #c9dcff', color:'#0f172a' }}>
                      <div className="d-flex align-items-start">
                        <div className="me-2" style={{ width:8, height:8, background:'#60a5fa',marginTop:6, borderRadius:999 }} />
                        <div>
                          <div className="fw-semibold">Session Settings</div>
                          <div className="small text-muted">Tune autosave and mode before you start</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Settings header with switch */}
                  <div className={styles.settingsHeader}>
                    <div className={styles.settingsTitle}>
                      <span className="badge rounded d-flex align-items-center gap-2" style={{ backgroundColor: '#ca8a04', color: '#ffffff', fontSize: '0.9rem', fontWeight: '700', padding: '0.5rem 1rem' }}>
                        <i className="bi bi-gear-fill" style={{ fontSize: '1rem' }}></i>
                        Settings
                      </span>
                    </div>
                    <div className="form-check form-switch m-0">
                      <input
                        className={`form-check-input ${styles.settingsToggle}`}
                        type="checkbox"
                        id="autoSaveSwitch"
                        checked={autoSaveEnabled}
                        onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                      />
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className={styles.settingsSectionLabel}>Auto-Save</div>
                    <div className={styles.settingsSubtitle}>
                      {autoSaveEnabled ? 'Every 2 seconds' : 'Use manual save buttons to save your answers'}
                    </div>
                  </div>

                  <div className={styles.settingsDivider} />

                  {/* Interview Mode */}
                  <div className={styles.settingsSectionLabel}>Interview Mode</div>
                  <button
                    className={`btn w-100 ${styles.voiceModeButton}`}
                    onClick={handleSwitchToVoice}
                    aria-label="Switch to Voice Mode"
                    title="Switch to Voice Mode"
                  >
                    <span>🎙️</span>
                    <span>Voice Mode</span>
                  </button>
                  <div className={`${styles.settingsSubtitle} mt-2`}>
                    Switch to voice-based interview with speech recognition
                  </div>

                  <div className={`${styles.settingsDivider} mt-4`} />

                  {/* Status (kept, redesigned container) */}
                  <div className={styles.settingsSectionLabel}>Status</div>
                  <div className="vstack gap-2">
                    {/* Auto-save indicator */}
                    {autoSaveEnabled && (
                      <div>
                        {autoSaveStatus === 'saving' ? (
                          <div className="d-flex align-items-center text-secondary small">
                            <div className="spinner-border spinner-border-sm me-2" role="status" />
                            Auto-saving answers...
                          </div>
                        ) : autoSaveStatus === 'saved' && lastSavedTime ? (
                          <div className="text-success small d-flex align-items-center">
                            <span className="me-2">✓</span>
                            Auto-saved {formatSaveTime(lastSavedTime)}
                          </div>
                        ) : autoSaveStatus === 'error' ? (
                          <div className="small">
                            <span className="text-warning me-2">⚠️</span>
                            <span className="text-danger">Auto-save failed: {autoSaveError}</span>
                            <button
                              className="btn btn-sm btn-outline-secondary ms-2"
                              onClick={handleManualRetry}
                              disabled={isSaving}
                            >
                              {isSaving ? 'Retrying...' : 'Retry'}
                            </button>
                          </div>
                        ) : Object.keys(pendingAnswers).length > 0 ? (
                          <div className="text-secondary small">
                            ● Unsaved changes ({Object.keys(pendingAnswers).length})
                          </div>
                        ) : lastSavedTime ? (
                          <div className="text-success small d-flex align-items-center">
                            <span className="me-2">✓</span>
                            Auto-saved {formatSaveTime(lastSavedTime)}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Manual save status indicator */}
                    {manualSaveStatus !== 'idle' && (
                      <div>
                        {manualSaveStatus === 'saving' ? (
                          <div className="d-flex align-items-center text-secondary small">
                            <div className="spinner-border spinner-border-sm me-2" role="status" />
                            Manual saving...
                          </div>
                        ) : manualSaveStatus === 'saved' && lastManualSaveTime ? (
                          <div className="text-success small d-flex align-items-center">
                            <span className="me-2">💾</span>
                            Manually saved {formatSaveTime(lastManualSaveTime)}
                          </div>
                        ) : manualSaveStatus === 'error' ? (
                          <div className="small">
                            <span className="text-warning me-2">⚠️</span>
                            <span className="text-danger">Manual save failed: {manualSaveError}</span>
                            <button
                              className="btn btn-sm btn-outline-secondary ms-2"
                              onClick={() => { setManualSaveError(null); handleManualSaveAll(); }}
                              disabled={manualSaveStatus === 'saving'}
                            >
                              {manualSaveStatus === 'saving' ? 'Retrying...' : 'Retry'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Intro save status indicator */}
                    {introQuestions.length > 0 && introSaveStatus !== 'idle' && (
                      <div>
                        {introSaveStatus === 'saving' ? (
                          <div className="d-flex align-items-center text-secondary small">
                            <div className="spinner-border spinner-border-sm me-2" role="status" />
                            Saving intro questions...
                          </div>
                        ) : introSaveStatus === 'saved' && lastIntroSaveTime ? (
                          <div className="text-success small d-flex align-items-center">
                            <span className="me-2">✓</span>
                            Intro saved {formatSaveTime(lastIntroSaveTime)}
                          </div>
                        ) : introSaveStatus === 'error' ? (
                          <div className="small">
                            <span className="text-warning me-2">⚠️</span>
                            <span className="text-danger">Intro save failed: {introSaveError}</span>
                            <button
                              className="btn btn-sm btn-outline-secondary ms-2"
                              onClick={saveIntroQuestions}
                              disabled={introSaveStatus === 'saving'}
                            >
                              {introSaveStatus === 'saving' ? 'Retrying...' : 'Retry'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mode Switching Controls - Commented out for now */}
              {/*
              <div className={styles.drawerSection}>
                <h3 className={styles.drawerSectionTitle}>Mode</h3>
                <div className={styles.modeSwitchingContainer}>
                  <ModeSwitchingControls
                    userId={user?.uid}
                    articleId={articleSlug}
                    currentMode="text"
                    currentState={getCurrentState()}
                    onSwitchStart={handleModeSwitchStart}
                    onSwitchComplete={handleModeSwitchComplete}
                    onSwitchError={handleModeSwitchError}
                  />
                </div>
              </div>
              */}

              {/* Status block removed; now included in the card above */}

              {/* Question Navigation */}
              {/* OLD Questions section removed - now at top */}
              <div style={{ display: 'none' }}>
                <div className="card border-0 shadow-sm rounded-3" style={{ background: '#ffffff' }}>
                  <div className="card-header bg-white border-0 d-flex align-items-center gap-2 py-3 px-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <i className="bi bi-file-text" style={{ fontSize: '1.1rem', color: '#6366f1' }}></i>
                    <h6 className="mb-0 fw-semibold" style={{ color: '#0f172a', fontSize: '0.95rem' }}>Questions</h6>
                  </div>
                  <div className="card-body p-0" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    <div className={styles.questionsList}>
                    {questions.map((question, index) => {
                      const sectionTitle = question.sectionTitle || question.section || 'General';
                      
                      // Assign colors based on section category
                      const getCategoryColors = (section) => {
                        const lowerSection = section.toLowerCase();
                        
                        // Basic/Foundation categories
                        if (lowerSection.includes('basic') || lowerSection.includes('foundation') || lowerSection.includes('understanding')) {
                          return { bg: '#dcfce7', text: '#166534' };
                        }
                        // Advanced categories
                        if (lowerSection.includes('advanced') || lowerSection.includes('expert') || lowerSection.includes('future')) {
                          return { bg: '#fef3c7', text: '#92400e' };
                        }
                        // Strategy/Planning categories
                        if (lowerSection.includes('strategy') || lowerSection.includes('planning')) {
                          return { bg: '#dbeafe', text: '#1e40af' };
                        }
                        // Implementation/Execution categories
                        if (lowerSection.includes('implementation') || lowerSection.includes('execution')) {
                          return { bg: '#e9d5ff', text: '#6b21a8' };
                        }
                        // Measuring/Analytics categories
                        if (lowerSection.includes('measuring') || lowerSection.includes('success') || lowerSection.includes('metrics')) {
                          return { bg: '#fce7f3', text: '#9f1239' };
                        }
                        // Mistakes/Problems categories
                        if (lowerSection.includes('mistake') || lowerSection.includes('solution') || lowerSection.includes('common')) {
                          return { bg: '#fed7aa', text: '#9a3412' };
                        }
                        // Default
                        return { bg: '#e5e7eb', text: '#374151' };
                      };
                      
                      const colors = getCategoryColors(sectionTitle);
                      
                      return (
                        <div
                          key={question.id || index}
                          className={`${styles.questionItem} ${
                            index === currentQuestionIndex ? styles.questionItemActive : ''
                          }`}
                          onClick={() => goToQuestion(index)}
                        >
                          <div className={styles.questionItemHeader}>
                            <div className={styles.questionItemRadio}>
                              <input
                                type="radio"
                                name="questionRadio"
                                checked={index === currentQuestionIndex}
                                onChange={() => {}}
                                style={{ cursor: 'pointer' }}
                              />
                            </div>
                            <div className={styles.questionItemContent}>
                              <div className={styles.questionItemMeta}>
                                <span className={styles.questionBadge} style={{ 
                                  backgroundColor: colors.bg,
                                  color: colors.text
                                }}>
                                  {sectionTitle}
                                </span>
                                {question.answered && (
                                  <i className="bi bi-check-circle-fill" style={{ color: '#22c55e', fontSize: '0.9rem' }} title="Answered"></i>
                                )}
                                {autoSaveEnabled && pendingAnswers[question.id] !== undefined && (
                                  <i className="bi bi-clock-fill" style={{ color: '#f59e0b', fontSize: '0.9rem' }} title="Unsaved changes"></i>
                                )}
                              </div>
                              <div className={styles.questionItemNumber}>
                                Q{index + 1}
                              </div>
                              <div className={styles.questionItemText}>
                                {question.question || question || 'Question not available'}
                              </div>
                            </div>
                            <div className={styles.questionItemArrows}>
                              <i className="bi bi-chevron-up" style={{ fontSize: '0.75rem', color: '#9ca3af' }}></i>
                              <i className="bi bi-chevron-down" style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '-0.25rem' }}></i>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                </div>

                {/* Unsaved Questions Indicator */}
                {Object.keys(pendingAnswers).length > 0 && (
                  <div className={styles.unsavedIndicator} style={{ marginTop: '1rem' }}>
                    <div className={styles.unsavedHeader}>
                      <span className={styles.unsavedIcon}>⚠️</span>
                      <span className={styles.unsavedTitle}>Unsaved Changes</span>
                    </div>
                    <div className={styles.unsavedContent}>
                      <p className={styles.unsavedText}>
                        {Object.keys(pendingAnswers).length} question{Object.keys(pendingAnswers).length > 1 ? 's' : ''} with unsaved changes
                      </p>
                      <div className={styles.unsavedActions}>
                        <button
                          className={styles.saveAllButton}
                          onClick={() => handleManualSaveAll()}
                          disabled={manualSaveStatus === 'saving'}
                        >
                          {manualSaveStatus === 'saving' ? 'Saving...' : 'Save All'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {questionGenerationError && questions.length > 0 && (
                <div className={styles.drawerSection}>
                  <div className={styles.errorAlert}>
                    <div className={styles.errorIcon}>⚠️</div>
                    <div className={styles.errorContent}>
                      <p>{questionGenerationError}</p>
                      <p className={styles.fallbackNote}>Using fallback questions for now.</p>
                    </div>
                    <button
                      className={styles.retryButton}
                      onClick={() => generateAndSaveQuestions(articleData)}
                      disabled={isGeneratingQuestions}
                    >
                      {isGeneratingQuestions ? 'Retrying...' : 'Retry Generation'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className={styles.rightPanel} style={{ marginRight: '-2rem' }}>
            {currentFlowStep === 'intro' ? (
              <div className={`${styles.introCard} card shadow-sm border-0 rounded-4 p-4`} style={{ width: '100%',maxWidth: '1017px', minHeight: '80vh' }}>
                <div className="mb-3">
                  <h2 className={styles.introTitle}>Expert Introduction</h2>
                  <p className={styles.introSubtitle}>
                    {topic.trim().length >= 3
                      ? "Tell us about your expertise to continue"
                      : "Enter a topic to get started"
                    }
                  </p>
                </div>

                <div>
                  {topic.trim().length >= 3 && !showIntroQuestions && (
                    <button
                      className={`${styles.generateButton} btn btn-primary`}
                      onClick={handleManualQuestionGeneration}
                      disabled={!canGenerateIntroQuestions()}
                    >
                      Generate Introduction Questions
                    </button>
                  )}

                  {showIntroQuestions && introQuestions.slice(0, 1).map((question, index) => (
                    <div key={index} className="mb-3">
                      <div className="alert mb-3" style={{ background:'#eaf2ff', border:'1px solid #c9dcff', color:'#0f172a' }}>
                        {question}
                      </div>
                      <textarea
                        className={`${styles.introTextarea} form-control`}
                        placeholder="Share your expertise..."
                        value={introAnswers[index] || ''}
                        onChange={(e) => handleIntroAnswerChange(index, e.target.value)}
                        rows={6}
                      />
                      <div className="d-flex justify-content-between mt-2">
                        <span className={styles.characterCount}>
                          {(introAnswers[index] || '').length}/1000 characters
                        </span>
                        {index === 0 && (
                          (introAnswers[0] || '').trim().length >= 100 ? (
                            <div className="text-success">✓ Excellent! This looks comprehensive</div>
                          ) : (
                            <div className="text-warning">
                              Need {Math.max(0, 100 - (introAnswers[0] || '').length)} more characters
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ))}

                  {introQuestions.length > 0 && (
                    <div className="d-flex justify-content-center">
                      <button
                        className={`${styles.saveIntroButton} btn btn-success px-4`}
                        onClick={saveIntroQuestions}
                        disabled={introSaveStatus === 'saving'}
                        title="Save intro questions and answers"
                        style={{
                          background: introSaveStatus === 'saved' ? 'rgba(34, 197, 94, 0.2)' : undefined,
                          borderColor: introSaveStatus === 'saved' ? 'rgba(34, 197, 94, 0.5)' : undefined
                        }}
                      >
                        {introSaveStatus === 'saving' ? 'Saving...' : '💾 Save Introduction'}
                      </button>
                    </div>
                  )}

                  {isIntroComplete && (
                    <div className="d-flex justify-content-end">
                      <button
                        className={`${styles.proceedButton} mt-4`}
                        onClick={handleProceedToQuestions}
                      >
                        Proceed to Interview Questions →
                      </button>
                    </div>
                  )}

                </div>
              </div>
            ) : currentFlowStep === 'questions' ? (
              <div className="card border-0 shadow-sm rounded-4" style={{ background: '#ffffff', width: '100%', maxWidth: '1017px', minHeight: '85vh', borderRadius: '1rem' }}>
                <div className="card-body p-4">
                  {/* Question Header - Badge and Question Number */}
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <span className="badge rounded-pill" style={{ 
                      backgroundColor: '#6366f1', 
                      color: '#ffffff', 
                      fontSize: '0.75rem', 
                      fontWeight: '600', 
                      padding: '0.4rem 0.85rem' 
                    }}>
                      {currentQuestion.sectionTitle}
                    </span>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Question {currentQuestionIndex + 1}
                    </span>
                  </div>

                  {/* Question Title */}
                  <h2 className="mb-4" style={{ 
                    fontSize: '1.75rem', 
                    fontWeight: '700', 
                    color: '#0f172a', 
                    lineHeight: '1.3',
                    marginBottom: '1.5rem'
                  }}>
                    {currentQuestion.question || 'Question not available'}
                  </h2>

                  {/* Your Answer Section Header */}
                  <div className="mb-3">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1' }}></span>
                        <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#374151' }}>Your Answer</span>
                        <span style={{ color: '#d1d5db', fontSize: '1rem', margin: '0 0.25rem' }}>|</span>
                        <span style={{ fontSize: '0.95rem', color: '#9ca3af' }}>Expert Level Response Expected</span>
                      </div>
                      <div className="d-flex align-items-center gap-1" style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                        <i className="bi bi-clock"></i>
                        <span>Est. 3-5 min</span>
                      </div>
                    </div>
                    <textarea
                      className="form-control"
                      placeholder="Share your expert insights and detailed answer here..."
                      value={answers[currentQuestionIndex] || ''}
                      onChange={(e) => handleAnswerChange(currentQuestionIndex, e.target.value)}
                      rows={8}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                        padding: '1rem',
                        resize: 'vertical',
                        minHeight: '200px'
                      }}
                    />
                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                          {(answers[currentQuestionIndex] || '').length} / 2000+ chars
                        </span>
                        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                          <i className="bi bi-save"></i> Keep writing...
                        </span>
                      </div>
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                        💡 Aim for detailed, actionable answers (200+ characters)
                      </span>
                    </div>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mt-4 pt-3" style={{ borderTop: '1px solid #f3f4f6' }}>
                    <button
                      className="btn btn-outline-secondary d-flex align-items-center gap-2"
                      onClick={goToPreviousQuestion}
                      disabled={currentQuestionIndex === 0}
                      style={{
                        borderRadius: '8px',
                        padding: '0.5rem 1rem',
                        fontSize: '0.9rem'
                      }}
                    >
                      <i className="bi bi-chevron-left"></i>
                      Previous
                    </button>

                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-outline-dark d-flex align-items-center gap-2"
                        onClick={() => {
                          console.log('Save Question clicked');
                          handleManualSaveCurrent();
                        }}
                        disabled={manualSaveStatus === 'saving'}
                        title="Save this question only"
                        style={{
                          borderRadius: '8px',
                          padding: '0.5rem 1rem',
                          fontSize: '0.9rem',
                          background: manualSaveStatus === 'saved' ? 'rgba(34, 197, 94, 0.1)' : undefined,
                          borderColor: manualSaveStatus === 'saved' ? 'rgba(34, 197, 94, 0.5)' : undefined
                        }}
                      >
                        <i className="bi bi-save"></i>
                        {manualSaveStatus === 'saving' ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        className="btn btn-primary d-flex align-items-center gap-2"
                        onClick={() => {
                          console.log('Save All clicked');
                          handleManualSaveAll();
                        }}
                        disabled={manualSaveStatus === 'saving'}
                        title="Save all unsaved answers"
                        style={{
                          borderRadius: '8px',
                          padding: '0.5rem 1.25rem',
                          fontSize: '0.9rem',
                          background: '#6366f1',
                          border: 'none'
                        }}
                      >
                        <i className="bi bi-save-fill"></i>
                        {manualSaveStatus === 'saving' ? 'Saving...' : 'Save All'}
                      </button>
                      <button
                        className="btn btn-outline-secondary d-flex align-items-center gap-2"
                        onClick={goToNextQuestion}
                        disabled={currentQuestionIndex === questions.length - 1}
                        style={{
                          borderRadius: '8px',
                          padding: '0.5rem 1rem',
                          fontSize: '0.9rem'
                        }}
                      >
                        <i className="bi bi-skip-forward"></i>
                        Skip
                      </button>
                    </div>

                    <button
                      className="btn btn-primary d-flex align-items-center gap-2"
                      onClick={goToNextQuestion}
                      disabled={currentQuestionIndex === questions.length - 1}
                      style={{
                        borderRadius: '8px',
                        padding: '0.5rem 1rem',
                        fontSize: '0.9rem',
                        background: '#6366f1',
                        border: 'none'
                      }}
                    >
                      Next
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </div>

                  {/* Generate Article Button - Shows when all questions are answered */}
                  {areAllQuestionsAnswered() && (
                    <div className="mt-4 pt-4" style={{ borderTop: '2px solid #e5e7eb' }}>
                      <div className="alert alert-success d-flex align-items-center gap-2 mb-3" style={{ borderRadius: '8px' }}>
                        <i className="bi bi-check-circle-fill" style={{ fontSize: '1.25rem' }}></i>
                        <div>
                          <strong>All questions answered!</strong>
                          <div className="small">You're ready to generate your expert article.</div>
                        </div>
                      </div>

                      {/* Promotional Link Button */}
                      <div className={styles.promotionalLinkButtonSection}>
                        <button
                          type="button"
                          className={`${styles.promotionalLinkButton} ${referenceLink.trim() ? styles.hasLink : ''}`}
                          onClick={openPromotionalLinkModal}
                          disabled={isGeneratingArticle}
                          aria-label="Configure promotional link settings"
                        >
                          <div className={styles.buttonIcon}>
                            🔗
                          </div>
                          <div className={styles.buttonContent}>
                            <div className={styles.buttonTitle}>
                              {referenceLink.trim() ? 'Edit Promotional Link' : 'Add Promotional Link'}
                            </div>
                            <div className={styles.buttonSubtitle}>
                              {referenceLink.trim() 
                                ? `${linkFrequency + 1} mentions • ${new URL(referenceLink).hostname}`
                                : 'Promote your content naturally in the article'
                              }
                            </div>
                          </div>
                          <div className={styles.buttonArrow}>
                            →
                          </div>
                        </button>
                      </div>
                      <button
                        className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2"
                        onClick={generateArticleFromInterview}
                        disabled={
                          isGeneratingArticle || 
                          !areAllQuestionsAnswered() || 
                          !validateUrl(referenceLink).isValid || 
                          !validateLinkDescription(linkDescription, referenceLink.trim()).isValid
                        }
                        style={{
                          borderRadius: '8px',
                          padding: '0.75rem 1.5rem',
                          fontSize: '1rem',
                          fontWeight: '600',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          border: 'none',
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                        }}
                      >
                        <i className="bi bi-magic" style={{ fontSize: '1.1rem' }}></i>
                        {isGeneratingArticle ? 'Generating Article...' : 'Generate Article'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.introCompleteCard}>
                <div className={styles.introCompleteContent}>
                  <div className={styles.introCompleteIcon}>✓</div>
                  <h3 className={styles.introCompleteTitle}>Expert Introduction Complete!</h3>
                  <p className={styles.introCompleteText}>
                    Great! You've successfully completed your expert introduction. Click the button below to proceed to the main interview questions.
                  </p>
                  <button
                    className={styles.proceedButton}
                    onClick={handleProceedToQuestions}
                  >
                    Start Interview Questions →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Auto-save failure notification toast */}
      {autoSaveStatus === 'error' && saveRetryCount >= 3 && (
        <div className={styles.toastNotification}>
          <div className={styles.toast}>
            <div className={styles.toastIcon}>⚠️</div>
            <div className={styles.toastContent}>
              <div className={styles.toastTitle}>Auto-save Failed</div>
              <div className={styles.toastMessage}>
                Your answers couldn't be saved automatically. Please check your connection and try again.
              </div>
            </div>
            <button
              className={styles.toastRetry}
              onClick={handleManualRetry}
              disabled={isSaving}
            >
              {isSaving ? 'Retrying...' : 'Retry Now'}
            </button>
            <button
              className={styles.toastClose}
              onClick={() => setAutoSaveStatus('idle')}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div className={styles.unsavedModalOverlay} onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleCancelNavigation();
          }
        }}>
          <div className={styles.unsavedModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.unsavedModalHeader}>
              <h3 className={styles.unsavedModalTitle}>Unsaved Changes</h3>
            </div>
            <div className={styles.unsavedModalBody}>
              <p className={styles.unsavedModalText}>
                You have <strong>{Object.keys(pendingAnswers).length}</strong> unsaved answer{Object.keys(pendingAnswers).length > 1 ? 's' : ''}.
                If you leave now, your changes will be lost.
              </p>
              <div className={styles.unsavedModalActions}>
                <button
                  className={styles.saveAndLeaveButton}
                  onClick={handleSaveAndLeave}
                  disabled={manualSaveStatus === 'saving'}
                >
                  {manualSaveStatus === 'saving' ? 'Saving...' : '💾 Save & Leave'}
                </button>
                <button
                  className={styles.discardButton}
                  onClick={handleConfirmNavigation}
                >
                  Discard Changes
                </button>
                <button
                  className={styles.cancelButton}
                  onClick={handleCancelNavigation}
                >
                  Stay Here
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Article Generation Progress Overlay (copied from compile page) */}
      {isGeneratingArticle && (
        <div className={styles.generationOverlay}>
          <div className={styles.generationModal}>
            <div className={styles.generationSpinner} />
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
            {elapsedTime > 120 && (
              <div className={styles.timeoutWarning}>
                ⏰ <strong>Timeout Warning:</strong> Article generation will be cancelled in {Math.max(0, 180 - elapsedTime)} seconds. Your credits will be automatically refunded.
              </div>
            )}
            {elapsedTime > 60 && elapsedTime <= 120 && (
              <div className={styles.waitMessage}>
                Typical process time is 1-3 minutes
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightweight route transition overlay (copied from compile page) */}
      {isTransitioning && (
        <div className={styles.transitionOverlay} aria-hidden="true">
          <div className={styles.transitionBox}>
            <div className={styles.spinner} />
            <span>Opening your article…</span>
          </div>
        </div>
      )}

      {/* Promotional Link Modal */}
      <PromotionalLinkModal
        isOpen={isPromotionalLinkModalOpen}
        onClose={closePromotionalLinkModal}
        onSave={handlePromotionalLinkSave}
        initialData={{
          referenceLink,
          linkDescription,
          linkFrequency
        }}
        isGeneratingArticle={isGeneratingArticle}
      />
    </div>
  );
}

export default function InterviewQuestionsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InterviewQuestionsPageContent />
    </Suspense>
  );
}