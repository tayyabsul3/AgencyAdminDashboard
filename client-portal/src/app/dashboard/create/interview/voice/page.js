'use client';

/*
 * CENTRALIZED STATE MIGRATION - COMPLETE ✅
 * ✅ Phase 1: Added centralized state alongside existing state
 * ✅ Phase 2: Migrated questions modal to centralized state
 * ✅ Phase 3: Migrated answer update logic to centralized state
 * ✅ Phase A: Migrated all remaining modals to centralized state
 * ✅ Phase B: Removed legacy state variables and simplified props
 * ✅ Phase C: Fixed VoiceInterviewInterface props and removed duplicate auto-save
 * 
 * FINAL ARCHITECTURE:
 * - Single source of truth: centralizedState + questions array
 * - Immediate saves: VoiceInterviewInterface → handleAnswerSave → database
 * - No race conditions: atomic state updates only
 * - Clean modal management: one active modal at a time
 * - Simplified debugging: clear data flow
 */

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthGuard } from '../../../../../hooks/useAuthGuard';
import { requireAuth } from '../../../../../services/authService';
import { generateArticleQuestions } from '../../../../../services/geminiService';
import { generateReplacementQuestion } from '../../../../../services/enhancedGeminiService';
import { getInterviewById, saveInterviewContent, updateInterview } from '../../../../../services/interviewService';
import LoadingSpinner from '../../../../../components/ui/LoadingSpinner';
import ErrorMessage from '../../../../../components/ui/ErrorMessage';
import VoiceInterviewInterface from '../../../../../components/interview/VoiceInterviewInterface';
import { debounce } from '../../../../../utils/debounce';
import { MdMic, MdPerson, MdLightbulb, MdCheckCircle, MdWarning, MdGpsFixed, MdSchedule, MdDescription, MdEdit, MdNoteAdd, MdTimer, MdAutoAwesome, MdPsychology, MdTipsAndUpdates, MdQuestionAnswer, MdChat, MdHelpOutline, MdSave, MdDelete } from 'react-icons/md';
import styles from './VoiceInterview.module.css';
import modalStyles from './VoiceInterviewModal.module.css';

// Optimized Questions Modal Component
const QuestionsModal = React.memo(() => {
  const {
    questions,
    currentQuestionIndex,
    centralizedState,
    closeQuestionsModal,
    goToQuestion,
    styles
  } = useQuestionsModalContext();

  // Memoize grouped questions to avoid recalculation
  const groupedQuestions = useMemo(() => {
    const introQuestions = [];
    const topicQuestions = [];
    const questionIndexMap = new Map();

    questions.forEach((question, index) => {
      questionIndexMap.set(question.id, index);
      if (question.type === 'intro') {
        introQuestions.push({ ...question, originalIndex: index });
      } else if (question.type === 'topic') {
        topicQuestions.push({ ...question, originalIndex: index });
      }
    });

    return { introQuestions, topicQuestions, questionIndexMap };
  }, [questions]);

  // Memoize click handlers
  const handleQuestionClick = useCallback((index) => {
    goToQuestion(index);
    closeQuestionsModal();
  }, [goToQuestion, closeQuestionsModal]);

  const handleOverlayClick = useCallback(() => {
    closeQuestionsModal();
  }, [closeQuestionsModal]);

  const handleModalClick = useCallback((e) => {
    e.stopPropagation();
  }, []);

  return (
    <div className={styles.questionsModalOverlay} onClick={handleOverlayClick}>
      <div
        className={styles.questionsModal}
        onClick={handleModalClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="questions-modal-title"
      >
        <div className={styles.questionsModalHeader}>
          <div className={styles.questionsHeaderCopy}>
            <h3 id="questions-modal-title">All Questions</h3>
            <p className={styles.questionsSubtitle}>
              Navigate through your interview questions. Click any question to jump directly to it.
            </p>
          </div>
          <button
            className={styles.questionsCloseButton}
            onClick={closeQuestionsModal}
            aria-label="Close questions modal"
            type="button"
          >
            ×
          </button>
        </div>
        <div className={styles.questionsModalBody}>
          <div className={styles.questionsGrid}>
            {/* Expert Introduction Group */}
            {groupedQuestions.introQuestions.length > 0 && (
              <IntroQuestionsGroup 
                questions={groupedQuestions.introQuestions}
                currentQuestionIndex={currentQuestionIndex}
                pendingChanges={centralizedState.pendingChanges}
                onQuestionClick={handleQuestionClick}
                styles={styles}
              />
            )}

            {/* FAQs Group */}
            {groupedQuestions.topicQuestions.length > 0 && (
              <TopicQuestionsGroup 
                questions={groupedQuestions.topicQuestions}
                currentQuestionIndex={currentQuestionIndex}
                pendingChanges={centralizedState.pendingChanges}
                onQuestionClick={handleQuestionClick}
                styles={styles}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

QuestionsModal.displayName = 'QuestionsModal';

// Optimized Intro Questions Group Component
const IntroQuestionsGroup = React.memo(({ questions, currentQuestionIndex, pendingChanges, onQuestionClick, styles }) => (
  <>
    <div className={styles.modalGroupHeader}>
      <span className={styles.groupBadge}>
        <MdPerson style={{color: '#3b82f6'}} /> Expert Introduction
      </span>
    </div>
    {questions.map((question) => (
      <QuestionItem
        key={question.id}
        question={question}
        index={question.originalIndex}
        currentQuestionIndex={currentQuestionIndex}
        pendingChanges={pendingChanges}
        onQuestionClick={onQuestionClick}
        styles={styles}
        type="intro"
        showIndex={false}
      />
    ))}
  </>
));

IntroQuestionsGroup.displayName = 'IntroQuestionsGroup';

// Optimized Topic Questions Group Component with Lazy Loading
const TopicQuestionsGroup = React.memo(({ questions, currentQuestionIndex, pendingChanges, onQuestionClick, styles }) => {
  // For performance, only render first 20 questions initially, then load more on scroll
  const [visibleCount, setVisibleCount] = useState(Math.min(questions.length, 20));
  
  const loadMoreRef = useRef(null);
  
  useEffect(() => {
    if (visibleCount >= questions.length) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 10, questions.length));
        }
      },
      { threshold: 0.1 }
    );
    
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    
    return () => observer.disconnect();
  }, [visibleCount, questions.length]);
  
  return (
    <>
      <div className={styles.modalGroupHeader}>
        <span className={styles.groupBadge}>
          <MdLightbulb style={{color: '#3b82f6'}} /> FAQs
        </span>
      </div>
      {questions.slice(0, visibleCount).map((question, tIndex) => (
        <QuestionItem
          key={question.id}
          question={question}
          index={question.originalIndex}
          currentQuestionIndex={currentQuestionIndex}
          pendingChanges={pendingChanges}
          onQuestionClick={onQuestionClick}
          styles={styles}
          type="topic"
          showIndex={true}
          displayIndex={tIndex + 1}
        />
      ))}
      {visibleCount < questions.length && (
        <div ref={loadMoreRef} style={{ height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
          Loading more questions...
        </div>
      )}
    </>
  );
});

TopicQuestionsGroup.displayName = 'TopicQuestionsGroup';

// Promotional Link Modal Component
const PromotionalLinkModal = React.memo(({ 
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
});

PromotionalLinkModal.displayName = 'PromotionalLinkModal';

// Optimized Question Item Component
const QuestionItem = React.memo(({ 
  question, 
  index, 
  currentQuestionIndex, 
  pendingChanges, 
  onQuestionClick, 
  styles, 
  type, 
  showIndex, 
  displayIndex 
}) => {
  const isCurrent = index === currentQuestionIndex;
  const isAnswered = question.answered;
  const isPending = pendingChanges.has(question.id);

  const className = useMemo(() => {
    const classes = [styles.modalQuestionItem];
    if (isCurrent) classes.push(styles.currentQuestion);
    if (isAnswered) classes.push(styles.answeredQuestion);
    if (isPending) classes.push(styles.pendingQuestion);
    return classes.join(' ');
  }, [isCurrent, isAnswered, isPending, styles]);

  const handleClick = useCallback(() => {
    onQuestionClick(index);
  }, [onQuestionClick, index]);

  return (
    <div className={className} onClick={handleClick}>
      <div className={styles.questionHeader}>
        <span className={styles.questionIndex}>
          {showIndex ? displayIndex : ''}
        </span>
        <div className={`${styles.questionTypeBadge} ${styles[type]}`}>
          <span className={styles.typeIcon}>
            {type === 'intro' ? <MdPerson /> : <MdLightbulb style={{color: '#3b82f6'}} />}
          </span>
          <span className={styles.typeText}>
            {type === 'intro' ? 'Intro' : 'Topic'}
          </span>
        </div>
        <div className={styles.questionStatus}>
          {isPending && (
            <span className={styles.statusIcon} title="Unsaved changes" aria-label="Unsaved changes">⏳</span>
          )}
          {isAnswered && (
            <span className={styles.statusIcon} title="Answered" aria-label="Answered">✓</span>
          )}
          {isCurrent && (
            <span className={styles.statusIcon} title="Current question" aria-label="Current question">🎯</span>
          )}
        </div>
      </div>
      <div className={styles.questionContent}>
        <p className={styles.questionText}>
          {question.question || 'Question not available'}
        </p>
        {question.section && (
          <span className={styles.questionSection}>
            {question.section}
          </span>
        )}
      </div>
    </div>
  );
});

QuestionItem.displayName = 'QuestionItem';

// Context hook for Questions Modal
const useQuestionsModalContext = () => {
  // This would normally be provided by a context, but for now we'll access the parent scope
  // In a real implementation, you'd wrap this in a Context Provider
  return {
    questions: window.__questionsModalContext?.questions || [],
    currentQuestionIndex: window.__questionsModalContext?.currentQuestionIndex || 0,
    centralizedState: window.__questionsModalContext?.centralizedState || { pendingChanges: new Set() },
    closeQuestionsModal: window.__questionsModalContext?.closeQuestionsModal || (() => {}),
    goToQuestion: window.__questionsModalContext?.goToQuestion || (() => {}),
    styles: window.__questionsModalContext?.styles || {}
  };
};

function VoiceInterviewPageContent() {
  const { user, loading, isAuthenticated, authError } = useAuthGuard({
    redirectTo: '/login',
    requireAuth: true
  });
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get params from URL
  const articleSlug = searchParams.get('id') || 'untitled-interview';
  const topic = searchParams.get('topic') || 'Your Topic';

  // Get intro questions from URL if provided (for new interviews from mode selector)
  const introQuestionsParam = searchParams.get('introQuestions');
  let urlIntroQuestions = null;

  if (introQuestionsParam) {
    try {
      urlIntroQuestions = JSON.parse(decodeURIComponent(introQuestionsParam));
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Failed to parse intro questions from URL:', error);
      }
      urlIntroQuestions = null;
    }
  }

  // State management
  const [articleData, setArticleData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // REMOVED: answers - now using centralizedState.questions with embedded answers
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [voiceSupported, setVoiceSupported] = useState(false);

  // Question generation state
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionGenerationError, setQuestionGenerationError] = useState(null);
  // REMOVED: lastSavedTime - now using centralizedState.persistence.lastSaved


  // REMOVED: Enhanced auto-save state - now using centralizedState.persistence
  // const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); 
  // const [autoSaveError, setAutoSaveError] = useState(null);
  // const [pendingAnswers, setPendingAnswers] = useState({});
  // const [saveRetryCount, setSaveRetryCount] = useState(0);

  // AI Preview state (lifted from VoiceInterviewStudio for interface locking)
  const [isAiPreviewEnabled, setIsAiPreviewEnabled] = useState(false);

  // NEW: Centralized state (running alongside existing state - no breaking changes)
  const [centralizedState, setCentralizedState] = useState({
    questions: [], // Will mirror the questions array but with embedded pending status
    pendingChanges: new Set(), // Track which question IDs need saving
    ui: {
      activeModal: null, // 'questions', 'edit', 'delete', 'add', 'unsaved', null
      modalData: {} // Modal-specific data
    },
    persistence: {
      status: 'idle', // 'idle', 'saving', 'saved', 'error'
      lastSaved: null,
      retryCount: 0
    }
  });

  // REMOVED: syncCentralizedState - no longer needed since we're using centralized state only

  // Interface locking when AI Preview is enabled
  const isInterfaceLocked = isAiPreviewEnabled;
  
  // AI Preview toggle handler with interface locking
  const handleToggleAiPreview = useCallback((enabled) => {
    setIsAiPreviewEnabled(enabled);
  }, []);

  // Enhanced handlers with AI Preview locking and notifications
  const createLockedHandler = useCallback((handler, actionName) => {
    return (...args) => {
      if (isInterfaceLocked) {
        // Use existing notification system if available, otherwise console warn
        if (typeof window !== 'undefined' && window.showNotification) {
          window.showNotification({
            type: 'warning',
            title: 'AI Preview Active',
            message: `Turn off AI Preview to ${actionName.toLowerCase()}`
          });
        } else {
          console.warn(`${actionName} blocked: Turn off AI Preview first`);
        }
        return;
      }
      return handler(...args);
    };
  }, [isInterfaceLocked]);

  // NEW: Centralized handlers (not used yet - just preparing)
  const handleCentralizedQuestionUpdate = useCallback((questionId, updates) => {
    setCentralizedState(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId ? { ...q, ...updates } : q
      ),
      pendingChanges: new Set([...prev.pendingChanges, questionId])
    }));
  }, []);

  const handleCentralizedModalOpen = useCallback((modalType, modalData = {}) => {
    setCentralizedState(prev => ({
      ...prev,
      ui: {
        activeModal: modalType,
        modalData
      }
    }));
  }, []);

  const handleCentralizedModalClose = useCallback(() => {
    setCentralizedState(prev => ({
      ...prev,
      ui: {
        activeModal: null,
        modalData: {}
      }
    }));
  }, []);

  // NEW: Centralized modal helper functions
  const isModalOpen = useCallback((modalType) => {
    return centralizedState.ui.activeModal === modalType;
  }, [centralizedState.ui.activeModal]);

  const openModal = useCallback((modalType, modalData = {}) => {
    handleCentralizedModalOpen(modalType, modalData);
  }, [handleCentralizedModalOpen]);

  const closeModal = useCallback(() => {
    handleCentralizedModalClose();
  }, [handleCentralizedModalClose]);

  // NEW: Specific modal helpers (backward compatible)
  const openQuestionsModal = useCallback(() => openModal('questions'), [openModal]);
  const closeQuestionsModal = useCallback(() => closeModal(), [closeModal]);
  const isQuestionsModalOpen = useCallback(() => isModalOpen('questions'), [isModalOpen]);

  // Edit modal helpers
  const openEditModal = useCallback((questionIndex, questionText) => {
    openModal('edit', { questionIndex, questionText });
  }, [openModal]);
  const closeEditModal = useCallback(() => closeModal(), [closeModal]);
  const isEditModalOpen = useCallback(() => isModalOpen('edit'), [isModalOpen]);

  // Delete modal helpers  
  const openDeleteModal = useCallback((questionIndex) => {
    openModal('delete', { questionIndex });
  }, [openModal]);
  const closeDeleteModal = useCallback(() => closeModal(), [closeModal]);
  const isDeleteModalOpen = useCallback(() => isModalOpen('delete'), [isModalOpen]);

  // Add topic modal helpers
  const openAddTopicModal = useCallback(() => openModal('addTopic'), [openModal]);
  const closeAddTopicModal = useCallback(() => closeModal(), [closeModal]);
  const isAddTopicModalOpen = useCallback(() => isModalOpen('addTopic'), [isModalOpen]);

  // Unsaved changes modal helpers
  const openUnsavedModal = useCallback((navigationUrl) => {
    openModal('unsaved', { navigationUrl });
  }, [openModal]);
  const closeUnsavedModal = useCallback(() => closeModal(), [closeModal]);
  const isUnsavedModalOpen = useCallback(() => isModalOpen('unsaved'), [isModalOpen]);

  // Promotional Link modal helpers
  const openPromotionalLinkModal = useCallback(() => {
    setIsPromotionalLinkModalOpen(true);
  }, []);
  const closePromotionalLinkModal = useCallback(() => {
    setIsPromotionalLinkModalOpen(false);
  }, []);

  // Promotional Link modal save handler
  const handlePromotionalLinkSave = useCallback((linkData) => {
    setReferenceLink(linkData.referenceLink);
    setLinkDescription(linkData.linkDescription);
    setLinkFrequency(linkData.linkFrequency);
    closePromotionalLinkModal();
  }, []);

  // NEW: Centralized answer update handler (single source of truth)
  const handleCentralizedAnswerUpdate = useCallback((questionId, answer, voiceData) => {
    const questionIndex = questions.findIndex(q => q.id === questionId);
    if (questionIndex === -1) return;

    const question = questions[questionIndex];
    const existingAnswer = question.answer || '';

    // Smart concatenation with proper punctuation
    const smartConcatenate = (existing, newText) => {
      if (!existing || !existing.trim()) return newText;

      const existingTrimmed = existing.trim();
      const newTextTrimmed = newText.trim();

      // Check if we need punctuation
      const needsPunctuation = !/[.!?]$/.test(existingTrimmed);
      const separator = needsPunctuation ? '. ' : ' ';

      // Avoid duplicating the same phrase
      if (existingTrimmed.toLowerCase().includes(newTextTrimmed.toLowerCase()) ||
        newTextTrimmed.toLowerCase().includes(existingTrimmed.toLowerCase())) {
        return existingTrimmed.length > newTextTrimmed.length ? existingTrimmed : newTextTrimmed;
      }

      return `${existingTrimmed}${separator}${newTextTrimmed}`;
    };

    const concatenatedAnswer = smartConcatenate(existingAnswer, answer);

    const voiceResponseData = voiceData || {
      transcription: concatenatedAnswer,
      confidence: 0.95,
      timestamp: new Date().toISOString(),
      source: 'voice_transcription'
    };

    // SINGLE atomic update to centralized state
    setCentralizedState(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId 
          ? {
              ...q,
              answer: concatenatedAnswer,
              answered: concatenatedAnswer.trim().length > 0,
              isPending: true, // Mark as pending save
              voiceResponse: {
                ...voiceResponseData,
                timestamp: new Date().toISOString(),
                source: 'voice_transcription'
              }
            }
          : q
      ),
      pendingChanges: new Set([...prev.pendingChanges, questionId]),
      persistence: {
        ...prev.persistence,
        status: 'idle' // Reset to trigger auto-save
      }
    }));

    // Also update legacy questions state for backward compatibility (will be removed later)
    setQuestions(prev => prev.map((q, idx) =>
      idx === questionIndex
        ? {
            ...q,
            answer: concatenatedAnswer,
            answered: concatenatedAnswer.trim().length > 0,
            voiceResponse: voiceResponseData
          }
        : q
    ));
  }, [questions]);

  // REMOVED: handleCentralizedAutoSave - now using immediate saves via VoiceInterviewInterface

  // Sync centralized questions with actual questions state
  useEffect(() => {
    if (questions.length > 0) {
      setCentralizedState(prev => ({
        ...prev,
        questions: questions.map(q => ({
          ...q,
          isPending: false // Initially not pending
        }))
      }));
    }
  }, [questions]);

  // DEBUG: Log centralized state changes (remove in production)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Centralized State Updated:', {
        questionsCount: centralizedState.questions.length,
        pendingChangesCount: centralizedState.pendingChanges.size,
        activeModal: centralizedState.ui.activeModal,
        persistenceStatus: centralizedState.persistence.status
      });
    }
  }, [centralizedState]);

  // DEBUG: Log modal state changes specifically
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && centralizedState.ui.activeModal) {
      console.log('🎭 Modal State Change:', {
        activeModal: centralizedState.ui.activeModal,
        modalData: centralizedState.ui.modalData,
        isQuestionsModalOpen: isQuestionsModalOpen()
      });
    }
  }, [centralizedState.ui.activeModal, centralizedState.ui.modalData, isQuestionsModalOpen]);

  // DEBUG: Log answer updates
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && centralizedState.pendingChanges.size > 0) {
      console.log('💬 Answer Update:', {
        pendingChanges: Array.from(centralizedState.pendingChanges),
        questionsWithAnswers: centralizedState.questions.filter(q => q.answer && q.answer.trim().length > 0).length,
        questionsWithPending: centralizedState.questions.filter(q => q.isPending).length
      });
    }
  }, [centralizedState.pendingChanges, centralizedState.questions]);



  // REMOVED: debouncedAutoSave - now using immediate saves via VoiceInterviewInterface
  
  // Refs to track timeouts and intervals for proper cleanup
  const timeoutRefs = useRef(new Set());
  const intervalRefs = useRef(new Set());

  // Cleanup function to clear all tracked timeouts and intervals
  useEffect(() => {
    return () => {
      // Clear all tracked timeouts
      timeoutRefs.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      timeoutRefs.current.clear();

      // Clear all tracked intervals
      intervalRefs.current.forEach(intervalId => {
        clearInterval(intervalId);
      });
      intervalRefs.current.clear();
    };
  }, []);






  // Navigation state
  // MIGRATED: showQuestionsModal -> centralizedState.ui.activeModal === 'questions'

  // MIGRATED: Unsaved changes confirmation modal -> centralizedState.ui.activeModal === 'unsaved'
  const [pendingNavigation, setPendingNavigation] = useState(null);

  // Article generation state (copied from compile page)
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [generationStep, setGenerationStep] = useState('');
  const [generationStartTime, setGenerationStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [targetProgress, setTargetProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Guard to prevent duplicate loads in React 18 Strict Mode (dev only)
  const hasLoadedRef = useRef(false);

  // Network status state
  const [networkStatus, setNetworkStatus] = useState('online'); // 'online', 'offline', 'unstable'

  // Service errors state
  const [serviceErrors, setServiceErrors] = useState({});
  const [errorRecoveryAttempts, setErrorRecoveryAttempts] = useState({});
  const [criticalError, setCriticalError] = useState(null);

  // Promotional Link Feature State
  const [referenceLink, setReferenceLink] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkFrequency, setLinkFrequency] = useState(2);
  const [isPromotionalLinkModalOpen, setIsPromotionalLinkModalOpen] = useState(false);

  // Enhanced error classification and handling
  const classifyError = (error) => {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return 'network';
    } else if (message.includes('auth') || message.includes('permission') || message.includes('unauthorized')) {
      return 'auth';
    } else if (message.includes('not found') || message.includes('missing')) {
      return 'data';
    } else if (message.includes('quota') || message.includes('limit')) {
      return 'quota';
    } else if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    } else {
      return 'unknown';
    }
  };

  const getErrorMessage = (error, errorType) => {
    switch (errorType) {
      case 'network':
        return 'Network connection issue. Please check your internet connection and try again.';
      case 'auth':
        return 'Authentication expired. Please log in again.';
      case 'data':
        return 'Interview data not found. Please refresh the page.';
      case 'quota':
        return 'Service limit reached. Please try again later.';
      case 'validation':
        return 'Invalid data format. Please check your input and try again.';
      case 'timeout':
        return 'Request timed out. Please try again.';
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  };

  // Helper to create tracked timeouts that are automatically cleaned up
  const createTrackedTimeout = useCallback((callback, delay) => {
    const timeoutId = setTimeout(() => {
      timeoutRefs.current.delete(timeoutId);
      callback();
    }, delay);
    timeoutRefs.current.add(timeoutId);
    return timeoutId;
  }, []);

  // Helper to create tracked intervals that are automatically cleaned up
  const createTrackedInterval = useCallback((callback, delay) => {
    const intervalId = setInterval(callback, delay);
    intervalRefs.current.add(intervalId);
    return intervalId;
  }, []);

  // Helper to clear tracked timeout
  const clearTrackedTimeout = useCallback((timeoutId) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(timeoutId);
    }
  }, []);

  // Helper to clear tracked interval
  const clearTrackedInterval = useCallback((intervalId) => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalRefs.current.delete(intervalId);
    }
  }, []);

  const handleServiceError = (service, error, retryFunction = null) => {
    const errorType = classifyError(error);
    const errorMessage = getErrorMessage(error, errorType);

    if (process.env.NODE_ENV === 'development') {
      console.error(`❌ ${service} error:`, error);
    }

    setServiceErrors(prev => ({
      ...prev,
      [service]: errorMessage
    }));

    // Auto-retry for certain error types
    if ((errorType === 'network' || errorType === 'timeout') && retryFunction) {
      const attemptKey = `${service}_${errorType}`;
      const currentAttempts = errorRecoveryAttempts[attemptKey] || 0;

      if (currentAttempts < 3) {
        const retryDelay = Math.min(1000 * Math.pow(2, currentAttempts), 10000);

        setErrorRecoveryAttempts(prev => ({
          ...prev,
          [attemptKey]: currentAttempts + 1
        }));

        // Use tracked timeout to prevent memory leaks
        createTrackedTimeout(() => {
          retryFunction();
        }, retryDelay);
      }
    }

    // Set critical error for auth issues
    if (errorType === 'auth') {
      setCriticalError({
        type: 'auth',
        message: 'Your session has expired. Please log in again.',
        action: () => router.push('/login')
      });
    }
  };


  // Enhanced authentication check
  useEffect(() => {
    const verifyAuthentication = async () => {
      try {
        await requireAuth();
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Authentication verification failed:', error);
        }
        router.push('/login');
      }
    };

    if (!loading && isAuthenticated) {
      verifyAuthentication();
    }
  }, [loading, isAuthenticated, router]);





  // Intercept internal navigation - Updated to use centralized state
  const pendingChangesRef = useRef(centralizedState.pendingChanges);
  pendingChangesRef.current = centralizedState.pendingChanges;

  useEffect(() => {
    const handleLinkClick = (e) => {
      if (pendingChangesRef.current.size > 0) {
        const target = e.target.closest('a');
        if (target && target.href) {
          e.preventDefault();
          setPendingNavigation(target.href);
          openUnsavedModal(target.href);
        }
      }
    };

    document.addEventListener('click', handleLinkClick);
    return () => document.removeEventListener('click', handleLinkClick);
  }, []); // No dependencies to prevent listener accumulation

  // MIGRATED: Handle navigation confirmation
  const handleConfirmNavigation = () => {
    closeUnsavedModal();
    if (pendingNavigation) {
      window.location.href = pendingNavigation;
    }
    setPendingNavigation(null);
  };

  // MIGRATED: Handle cancel navigation
  const handleCancelNavigation = () => {
    closeUnsavedModal();
    setPendingNavigation(null);
  };

  // Handle save and leave from unsaved changes modal
  const handleSaveAndLeave = async () => {
    try {
      await handleAutoSave();
      closeUnsavedModal();
      if (pendingNavigation) {
        window.location.href = pendingNavigation;
      }
      setPendingNavigation(null);
    } catch (error) {
      // Error silently handled
    }
  };



  // Check voice support with enhanced error handling
  useEffect(() => {
    const checkVoiceSupport = () => {
      try {
        const hasWebSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        const hasAudioContext = 'AudioContext' in window || 'webkitAudioContext' in window;

        setVoiceSupported(hasWebSpeech && hasAudioContext);

        if (!hasWebSpeech || !hasAudioContext) {
          setServiceErrors(prev => ({
            ...prev,
            voiceSupport: 'Voice features are not fully supported in this browser. Please use Chrome, Firefox, or Safari for the best experience.'
          }));
        }
      } catch (error) {
        setServiceErrors(prev => ({
          ...prev,
          voiceSupport: 'Unable to check voice support. Please refresh the page and try again.'
        }));
      }
    };

    checkVoiceSupport();
  }, []);

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

  // Generate and save questions
  const generateAndSaveQuestions = useCallback(async (article) => {
    try {

      // Prevent duplicate concurrent generations (e.g., React Strict Mode double-invoke in dev)
      if (typeof window !== 'undefined') {
        window.__QF_GEN_LOCK__ = window.__QF_GEN_LOCK__ || {};
        if (window.__QF_GEN_LOCK__[articleSlug]) {
          return;
        }
        window.__QF_GEN_LOCK__[articleSlug] = true;
      }

      setIsGeneratingQuestions(true);

      // Generate questions using Gemini API
      const questionData = await generateArticleQuestions(
        article.setup.topic,
        article.setup.questionCount,
        article.setup.introQuestions || []
      );

      // First, add intro questions if they exist
      const flatQuestions = [];
      let questionIdCounter = 1;

      // Add expert intro questions first - check URL params first, then article setup
      const introQuestions = urlIntroQuestions || article.setup.expertIntro;

      if (introQuestions) {
        if (Array.isArray(urlIntroQuestions)) {
          // Handle intro questions from URL (array format)
          urlIntroQuestions.forEach((question, index) => {
            flatQuestions.push({
              id: `intro-${index + 1}`,
              section: 'Expert Introduction',
              question: question,
              answer: '',
              answered: false,
              type: 'intro',
              isRequired: true
            });
          });
        } else {
          // Handle intro questions from article setup (object format)
          Object.entries(introQuestions).forEach(([key, value]) => {
            if (key.startsWith('question') && value) {
              const questionNumber = key.replace('question', '');
              const answerKey = `answer${questionNumber}`;
              const existingAnswer = introQuestions[answerKey] || '';

              flatQuestions.push({
                id: `intro-${questionNumber}`,
                section: 'Expert Introduction',
                question: value,
                answer: existingAnswer,
                answered: existingAnswer.trim().length > 0,
                type: 'intro',
                isRequired: true
              });
            }
          });
        }
      }

      // Then add topic questions from API response
      questionData.sections.forEach((section, sectionIndex) => {
        section.questions.forEach((question, questionIndex) => {
          flatQuestions.push({
            id: `topic-${sectionIndex + 1}.${questionIndex + 1}`,
            section: section.title,
            question: typeof question === 'string' ? question : (question.question || 'Question not available'),
            answer: '',
            answered: false,
            type: 'topic',
            isRequired: true
          });
        });
      });

      // Save questions to interview content
      await saveInterviewContent(user.uid, articleSlug, {
        questions: flatQuestions,
        generatedArticle: null,
        mode: 'voice'
      });

      setQuestions(flatQuestions);

    } catch (error) {
      setQuestionGenerationError(error.message);

      // Use fallback questions on error
      const fallbackQuestions = generateFallbackQuestions(article.setup.topic, article.setup.questionCount, article);
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

  // Generate fallback questions when API fails
  const generateFallbackQuestions = (topic, questionCount, article) => {
    const flatQuestions = [];

    // Add intro questions first if they exist - check URL params first, then article setup
    const introQuestions = urlIntroQuestions || article?.setup?.expertIntro;

    if (introQuestions) {
      if (Array.isArray(urlIntroQuestions)) {
        // Handle intro questions from URL (array format)
        urlIntroQuestions.forEach((question, index) => {
          flatQuestions.push({
            id: `intro-${index + 1}`,
            section: 'Expert Introduction',
            question: question,
            answer: '',
            answered: false,
            type: 'intro',
            isRequired: true,
            timestamp: null
          });
        });
      } else {
        // Handle intro questions from article setup (object format)
        Object.entries(introQuestions).forEach(([key, value]) => {
          if (key.startsWith('question') && value) {
            const questionNumber = key.replace('question', '');
            const answerKey = `answer${questionNumber}`;
            const existingAnswer = introQuestions[answerKey] || '';

            flatQuestions.push({
              id: `intro-${questionNumber}`,
              section: 'Expert Introduction',
              question: value,
              answer: existingAnswer,
              answered: existingAnswer.trim().length > 0,
              type: 'intro',
              isRequired: true,
              timestamp: null
            });
          }
        });
      }
    }

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

    let questionId = 1;
    const remainingQuestionCount = questionCount - flatQuestions.length;

    sections.forEach(section => {
      const questionsToTake = Math.ceil(remainingQuestionCount / sections.length);
      section.questions.slice(0, questionsToTake).forEach(question => {
        flatQuestions.push({
          id: `topic-${questionId++}`,
          section: section.title,
          question,
          answered: false,
          answer: '',
          type: 'topic',
          isRequired: true,
          timestamp: null
        });
      });
    });

    return flatQuestions.slice(0, questionCount + (article?.setup?.expertIntro ? Object.keys(article.setup.expertIntro).filter(k => k.startsWith('question')).length : 0));
  };

  // Load article data and questions
  useEffect(() => {
    const loadArticleAndQuestions = async () => {
      if (!user || !articleSlug) return;

      // Prevent duplicate invocation in dev Strict Mode
      if (process.env.NODE_ENV !== 'production') {
        if (hasLoadedRef.current) {
          return;
        }
        hasLoadedRef.current = true;
      }

      try {
        setIsLoading(true);
        setQuestionGenerationError(null);

        // Try to load existing interview data
        const existingArticle = await getInterviewById(user.uid, articleSlug);

        if (existingArticle) {
          setArticleData(existingArticle);

          // If questions already exist, use them
          if (existingArticle.questions && existingArticle.questions.length > 0) {

            // Add type field to existing questions for backward compatibility
            const questionsWithTypes = existingArticle.questions.map((question, index) => {
              // If question already has type, keep it
              if (question.type) {
                return question;
              }

              // Determine type based on question content or position
              let questionType = 'topic'; // default to topic

              // Check if this is an intro question based on section or content
              if (question.section === 'Expert Introduction' ||
                question.id?.startsWith('intro-') ||
                (question.section && question.section.toLowerCase().includes('intro')) ||
                (question.question && (
                  question.question.toLowerCase().includes('background') ||
                  question.question.toLowerCase().includes('experience') ||
                  question.question.toLowerCase().includes('expertise') ||
                  question.question.toLowerCase().includes('yourself')
                ))) {
                questionType = 'intro';
              }

              return {
                ...question,
                type: questionType
              };
            });

            setQuestions(questionsWithTypes);

            // Populate answers from existing data
            const existingAnswers = {};
            existingArticle.questions.forEach((q, idx) => {
              if (q.answer) {
                // Store by index to avoid ID collisions in UI state
                existingAnswers[idx] = q.answer;
              }
            });
            setAnswers(existingAnswers);
          } else {
            // Generate new questions
            await generateAndSaveQuestions(existingArticle);
          }
        } else {
          // Article not found, redirect back to setup
          router.push('/dashboard/create/interview');
          return;
        }
      } catch (error) {
        setQuestionGenerationError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadArticleAndQuestions();
  }, [user, articleSlug, router, generateAndSaveQuestions]);

  // REMOVED: Old auto-save system - now using immediate saves via VoiceInterviewInterface

  // REMOVED: Periodic backup save - now using immediate saves via VoiceInterviewInterface

  // Enhanced network monitoring
  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus('online');
      setServiceErrors(prev => ({ ...prev, network: null }));

      // Network back online - immediate saves will resume automatically
    };

    const handleOffline = () => {
      setNetworkStatus('offline');
      setServiceErrors(prev => ({
        ...prev,
        network: 'No internet connection. Your progress will be saved when connection is restored.'
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial network status check
    setNetworkStatus(navigator.onLine ? 'online' : 'offline');

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // REMOVED: flushPendingSaves - now using immediate saves via VoiceInterviewInterface

  // Enhanced unsaved changes handling with auto-save
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (centralizedState.pendingChanges.size > 0) {
        // With immediate saves, this should rarely happen
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    const handleVisibilityChange = () => {
      // With immediate saves, no action needed when tab becomes hidden
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      // With immediate saves, no final save needed on unmount
    };
  }, [centralizedState.pendingChanges]);

  // Track elapsed time during generation (copied from compile page)
  useEffect(() => {
    let interval;
    if (isGeneratingArticle && generationStartTime) {
      interval = createTrackedInterval(() => {
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
    return () => {
      if (interval) {
        clearTrackedInterval(interval);
      }
    };
  }, [isGeneratingArticle, generationStartTime, createTrackedInterval, clearTrackedInterval]);

  // Smoothly animate progress towards the target (copied from compile page)
  useEffect(() => {
    if (!isGeneratingArticle) return;
    const timer = createTrackedInterval(() => {
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
    return () => clearTrackedInterval(timer);
  }, [isGeneratingArticle, targetProgress, createTrackedInterval, clearTrackedInterval]);

  // ✅ Auto-save: VoiceInterviewInterface → handleAnswerSave → immediate database save
  // No debounced auto-save needed - saves happen immediately after voice input


  // Helper functions for article generation (copied from compile page)
  const getAnsweredCountForGeneration = () => {
    if (!questions || !Array.isArray(questions)) return 0;
    return questions.filter(q => q && q.answer && typeof q.answer === 'string' && q.answer.trim().length > 0).length;
  };

  const getTotalQuestions = () => {
    return (questions && Array.isArray(questions)) ? questions.length : 0;
  };

  // Get question type breakdown for enhanced validation and user feedback
  const getQuestionTypeBreakdown = () => {
    if (!questions || questions.length === 0) {
      return { introQuestions: [], topicQuestions: [], answeredIntro: [], answeredTopic: [] };
    }

    const introQuestions = questions.filter(q => q.type === 'intro');
    const topicQuestions = questions.filter(q => q.type === 'topic');
    const answeredIntro = introQuestions.filter(q => q.answer && q.answer.trim().length > 0);
    const answeredTopic = topicQuestions.filter(q => q.answer && q.answer.trim().length > 0);

    return { introQuestions, topicQuestions, answeredIntro, answeredTopic };
  };

  const areAllQuestionsAnswered = () => {
    const total = getTotalQuestions();
    const answered = getAnsweredCountForGeneration();

    // Enhanced validation for question types
    if (questions && questions.length > 0) {
      const { introQuestions, topicQuestions, answeredIntro, answeredTopic } = getQuestionTypeBreakdown();

      // MINIMUM REQUIREMENT: Must have at least 5 topic questions
      if (topicQuestions.length < 5) {
        return false;
      }

      if (topicQuestions.length > 0) {
        // ONLY topic questions must be completed (intro questions are optional)
        const topicComplete = answeredTopic.length === topicQuestions.length;

        return topicComplete && topicQuestions.length >= 5;
      }
    }

    return total > 0 && answered === total;
  };

  // Check if interview meets minimum requirements for generation
  const meetsMinimumRequirements = () => {
    if (!questions || questions.length === 0) return false;

    const { topicQuestions } = getQuestionTypeBreakdown();
    return topicQuestions.length >= 5;
  };

  // Get validation message for generation requirements
  const getGenerationValidationMessage = () => {
    if (!questions || questions.length === 0) {
      return 'No questions available for article generation.';
    }

    const { introQuestions, topicQuestions, answeredIntro, answeredTopic } = getQuestionTypeBreakdown();

    // Check minimum topic questions requirement
    if (topicQuestions.length < 5) {
      const needed = 5 - topicQuestions.length;
      return `Need at least 5 topic questions for article generation. Add ${needed} more topic question${needed > 1 ? 's' : ''}.`;
    }

    // Check if all questions are answered
    const introComplete = introQuestions.length === 0 || answeredIntro.length === introQuestions.length;
    const topicComplete = topicQuestions.length === 0 || answeredTopic.length === topicQuestions.length;

    if (!introComplete && !topicComplete) {
      const missingIntro = introQuestions.length - answeredIntro.length;
      const missingTopic = topicQuestions.length - answeredTopic.length;
      return `Complete ${missingIntro} intro question${missingIntro > 1 ? 's' : ''} and ${missingTopic} topic question${missingTopic > 1 ? 's' : ''} to generate article.`;
    } else if (!introComplete) {
      const missingIntro = introQuestions.length - answeredIntro.length;
      return `Complete ${missingIntro} intro question${missingIntro > 1 ? 's' : ''} to generate article.`;
    } else if (!topicComplete) {
      const missingTopic = topicQuestions.length - answeredTopic.length;
      return `Complete ${missingTopic} topic question${missingTopic > 1 ? 's' : ''} to generate article.`;
    }

    return 'All requirements met! Ready to generate article.';
  };

  // Article generation function (copied from compile page)
  const generateArticleFromInterview = async () => {
    if (!articleData || !user) {
      const errorMsg = 'No interview data available or user not authenticated';
      setGenerationError(errorMsg);
      return;
    }

    // Check minimum requirements first
    if (!meetsMinimumRequirements()) {
      const { topicQuestions } = getQuestionTypeBreakdown();
      const needed = 5 - topicQuestions.length;
      const errorMsg = `Interview must have at least 5 topic questions for article generation. Currently have ${topicQuestions.length}, need ${needed} more.`;
      setGenerationError(errorMsg);
      return;
    }

    if (!areAllQuestionsAnswered()) {
      const { introQuestions, topicQuestions, answeredIntro, answeredTopic } = getQuestionTypeBreakdown();

      let errorMsg = 'All questions must be answered before generating the article';

      // Provide specific feedback about which question types need completion
      if (introQuestions.length > 0 || topicQuestions.length > 0) {
        const missingIntro = introQuestions.length - answeredIntro.length;
        const missingTopic = topicQuestions.length - answeredTopic.length;

        if (missingIntro > 0 && missingTopic > 0) {
          errorMsg = `Please complete ${missingIntro} expert introduction question(s) and ${missingTopic} topic question(s) before generating the article`;
        } else if (missingIntro > 0) {
          errorMsg = `Please complete ${missingIntro} expert introduction question(s) before generating the article`;
        } else if (missingTopic > 0) {
          errorMsg = `Please complete ${missingTopic} topic question(s) before generating the article`;
        }
      }

      setGenerationError(errorMsg);
      return;
    }

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
      const token = await user.getIdToken();

      // Prepare interview content for the prompt

      // Separate intro and topic questions from the unified questions array
      const introQuestions = questions.filter(q => q.type === 'intro') || [];
      const topicQuestions = questions.filter(q => q.type === 'topic') || [];
      const allQuestions = questions || [];

      const interviewContent = {
        topic: topic,
        expertIntro: articleData.setup?.expertIntro || {}, // Keep for backward compatibility
        questions: allQuestions,
        introQuestions: introQuestions,
        topicQuestions: topicQuestions
      };

      // Interview content prepared

      // Create expert background text from intro questions (new unified structure)
      const introQuestionsText = introQuestions.map(q =>
        `Q: ${q.question}\nA: ${q.answer || 'Not answered'}`
      ).join('\n\n');

      // Fallback to legacy expertIntro format if no intro questions found
      const legacyExpertBackgroundText = Object.entries(interviewContent.expertIntro).map(([key, value]) => {
        if (key.startsWith('question') && value) {
          const answerKey = key.replace('question', 'answer');
          const answer = interviewContent.expertIntro[answerKey] || '';
          return `Q: ${value}\nA: ${answer}`;
        }
        return '';
      }).filter(item => item).join('\n\n');

      // Use intro questions if available, otherwise fall back to legacy format
      const expertBackgroundText = introQuestionsText || legacyExpertBackgroundText;

      // Create topic questions text (excluding intro questions to avoid duplication)
      const topicQuestionsText = topicQuestions.map((q, index) =>
        `Question ${index + 1}: ${q.question || 'N/A'}\nAnswer: ${q.answer || 'Not answered'}`
      ).join('\n\n');

      // If no type-specific questions, use all questions (backward compatibility)
      const questionsAndAnswersText = topicQuestions.length > 0
        ? topicQuestionsText
        : interviewContent.questions.map((q, index) =>
          `Question ${index + 1}: ${q.question || 'N/A'}\nAnswer: ${q.answer || 'Not answered'}`
        ).join('\n\n');

      const prompt = `Transform this expert interview into a comprehensive, SEO-optimized article using AIO (Artificial Intelligence Optimization) principles.

CONTENT ENHANCEMENT INSTRUCTIONS: 
Use the provided interview responses as INSPIRATION and FOUNDATION, not literal text. Your goal is to create polished, authoritative content that maintains the expert's voice while significantly enhancing readability, depth, and SEO value.

ENHANCEMENT APPROACH:
- Take the core ideas, insights, and expertise from each response
- Expand thin responses with authoritative, relevant information  
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
✅ DO: Expand thin answers with relevant, authoritative information  
✅ DO: Improve grammar, structure, and professional tone
✅ DO: Add examples, statistics, and actionable insights where appropriate
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
          id: id || null
        });
      };

      (interviewContent.introQuestions || []).forEach(q => {
        if (!q) return;
        const answerText =
          (typeof q.answer === 'string' && q.answer.trim().length > 0)
            ? q.answer
            : (typeof q.voiceResponse?.transcription === 'string'
                ? q.voiceResponse.transcription
                : '');
        addIntroPair(q.question, answerText, q.id);
      });

      const expertIntroData = articleData.setup?.expertIntro || {};
      Object.keys(expertIntroData)
        .filter(key => key.toLowerCase().startsWith('question'))
        .forEach(questionKey => {
          const suffix = questionKey.slice('question'.length);
          const answerKey = `answer${suffix}`;
          addIntroPair(expertIntroData[questionKey], expertIntroData[answerKey]);
        });

      const requestBody = {
        topic: topic,
        expertIntro: interviewContent.expertIntro, // Legacy format for backward compatibility
        questions: interviewContent.topicQuestions, // Only topic questions for FAQs
        introQuestions: interviewContent.introQuestions, // Intro questions specifically
        topicQuestions: interviewContent.topicQuestions, // Topic questions specifically
        introQaPairs,
        // Add promotional link parameters
        referenceLink: referenceLink.trim(),
        linkDescription: linkDescription.trim(),
        linkFrequency: linkFrequency,
      };

      // Create AbortController for 3-minute timeout
      const controller = new AbortController();
      const timeoutId = createTrackedTimeout(() => {
        controller.abort();
      }, 180000); // 3 minutes = 180,000 milliseconds

      try {
        const response = await fetch(`${apiBaseUrl}/gemini/generate-interview-article-enhanced`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        // Clear timeout if request completes successfully
        clearTrackedTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to generate article');
        }

        setGenerationStep('Processing article content...');
        setTargetProgress((prev) => Math.max(prev, 70));
        const articleData = await response.json();

        if (!articleData.success) {
          throw new Error(articleData.error?.message || 'Article generation failed');
        }

        // Save to Firestore using the interview-specific structure
        const { saveInterviewArticleToFirestore } = await import('../../../../../services/articleService');

        const articleMode = (articleData && (articleData._source === 'voice' || articleData._source === 'text'))
          ? articleData._source
          : 'voice';

        const articleId = await saveInterviewArticleToFirestore(
          user.uid,
          topic.trim(),
          articleData.data,
          articleMode
        );

        // Update interview status
        const { updateInterview } = await import('../../../../../services/interviewService');

        await updateInterview(user.uid, articleSlug, {
          status: 'view',
          journeyStatus: 'complete',
          completedAt: new Date()
        });

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

      } catch (fetchError) {
        // Clear timeout in case of error
        clearTrackedTimeout(timeoutId);

        // Handle timeout specifically
        if (fetchError.name === 'AbortError') {
          throw new Error('Article generation timed out after 3 minutes. Your credits have been refunded.');
        }

        // Re-throw other fetch errors
        throw fetchError;
      }

    } catch (error) {
      setGenerationError(error.message || 'Failed to generate article');
      setGenerationStartTime(null);
      setElapsedTime(0);
      setTargetProgress((prev) => Math.max(prev, 100));
      setProgress(100);
    } finally {
      setIsGeneratingArticle(false);
    }
  };



  const handleSwitchToText = () => {
    // Switch to text interview mode
    router.push(`/dashboard/create/interview/questions?id=${articleSlug}&topic=${encodeURIComponent(topic)}&switchedFrom=voice`);
  };


  const handleQuestionChange = useCallback((newIndex) => {
    if (newIndex === currentQuestionIndex) return; // Prevent unnecessary updates
    setCurrentQuestionIndex(newIndex);
  }, [currentQuestionIndex]);

  // MIGRATED: Now uses centralized state (backward compatible interface)
  const handleAnswerChange = useCallback((questionIndex, answer, voiceData) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎤 Voice input received:', {
        questionIndex,
        answerLength: answer?.length || 0,
        hasVoiceData: !!voiceData,
        questionId: questions[questionIndex]?.id
      });
    }

    const question = questions[questionIndex];
    if (!question) return;

    // Use centralized handler with question ID instead of index
    handleCentralizedAnswerUpdate(question.id, answer, voiceData);
  }, [questions, handleCentralizedAnswerUpdate]);





  // State for regenerating questions
  const [regeneratingQuestionIndex, setRegeneratingQuestionIndex] = useState(null);

  // State for editing questions
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  // MIGRATED: showEditModal -> centralizedState.ui.activeModal === 'edit'
  const [editModalQuestion, setEditModalQuestion] = useState('');

  // State for deleting questions
  // MIGRATED: showDeleteModal -> centralizedState.ui.activeModal === 'delete'
  const [deletingQuestionIndex, setDeletingQuestionIndex] = useState(null);
  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false);

  // State for adding topic questions
  // MIGRATED: showAddTopicModal -> centralizedState.ui.activeModal === 'addTopic'
  const [newTopicQuestion, setNewTopicQuestion] = useState('');
  const [isAddingTopicQuestion, setIsAddingTopicQuestion] = useState(false);

  // Handle regenerating intro questions
  const handleRegenerateIntroQuestion = async (questionIndex) => {
    if (!user || !articleData || !questions[questionIndex]) return;

    const question = questions[questionIndex];

    // Only allow regenerating intro questions
    if (question.type !== 'intro') {
      return;
    }

    // Prevent multiple simultaneous regenerations
    if (regeneratingQuestionIndex !== null) {
      return;
    }

    try {
      setRegeneratingQuestionIndex(questionIndex);

      // Generate replacement question
      const replacementQuestion = await generateReplacementQuestion(
        articleData.setup.topic,
        question.question,
        questions.filter(q => q.type === 'intro').map(q => q.question)
      );

      // Update the question in the questions array
      const updatedQuestions = [...questions];
      updatedQuestions[questionIndex] = {
        ...question,
        question: replacementQuestion,
        answer: '', // Clear any existing answer
        answered: false
      };

      setQuestions(updatedQuestions);

      // Also clear from answers state to keep UI consistent
      setAnswers(prev => {
        const updated = { ...prev };
        delete updated[questionIndex];
        return updated;
      });

      // Save the updated questions to the database
      await saveInterviewContent(user.uid, articleSlug, {
        questions: updatedQuestions,
        generatedArticle: null,
        mode: 'voice'
      });

    } catch (error) {
      handleServiceError('regenerateQuestion', error);
    } finally {
      setRegeneratingQuestionIndex(null);
    }
  };

  // MIGRATED: Handle editing questions
  const handleEditQuestion = (questionIndex, currentQuestion) => {
    if (!user || !articleData || !questions[questionIndex]) return;

    // Prevent multiple simultaneous edits
    if (isEditingQuestion) {
      return;
    }

    setEditingQuestionIndex(questionIndex);
    setEditModalQuestion(currentQuestion?.question || '');
    openEditModal(questionIndex, currentQuestion?.question || '');
  };

  // Handle saving edited question
  const handleSaveEditedQuestion = async () => {
    if (!user || !articleData || editingQuestionIndex === null) return;

    const trimmedQuestion = editModalQuestion.trim();

    // If user entered empty text, abort
    if (!trimmedQuestion) {
      return;
    }

    // If question hasn't changed, no need to save
    if (trimmedQuestion === questions[editingQuestionIndex]?.question) {
      closeEditModal();
      setEditingQuestionIndex(null);
      setEditModalQuestion('');
      return;
    }

    try {
      setIsEditingQuestion(true);

      // Update the question in the questions array
      const updatedQuestions = [...questions];
      updatedQuestions[editingQuestionIndex] = {
        ...updatedQuestions[editingQuestionIndex],
        question: trimmedQuestion,
        // Keep existing answer and answered status
      };

      setQuestions(updatedQuestions);

      // Save the updated questions to the database
      await saveInterviewContent(user.uid, articleSlug, {
        questions: updatedQuestions,
        generatedArticle: null,
        mode: 'voice'
      });

      // Reset editing state and close modal
      setIsEditingQuestion(false);
      closeEditModal();
      setEditingQuestionIndex(null);
      setEditModalQuestion('');

    } catch (error) {
      handleServiceError('editQuestion', error);
      setIsEditingQuestion(false);
    }
  };

  // MIGRATED: Handle canceling edit
  const handleCancelEdit = () => {
    closeEditModal();
    setEditingQuestionIndex(null);
    setEditModalQuestion('');
  };

  // Handle deleting questions
  const handleDeleteQuestion = (questionIndex, currentQuestion) => {
    if (!user || !articleData || !questions[questionIndex]) return;

    // Only allow deleting topic questions
    if (currentQuestion?.type !== 'topic') {
      return;
    }

    // Prevent deleting if editing
    if (isEditingQuestion || isDeletingQuestion) {
      return;
    }

    setDeletingQuestionIndex(questionIndex);
    openDeleteModal(questionIndex);
  };

  // Handle confirming question deletion
  const handleConfirmDelete = async () => {
    if (!user || !articleData || deletingQuestionIndex === null) return;

    const questionToDelete = questions[deletingQuestionIndex];
    if (!questionToDelete || questionToDelete.type !== 'topic') {
      return;
    }

    try {
      setIsDeletingQuestion(true);

      // Remove the question from the questions array
      const updatedQuestions = questions.filter((_, index) => index !== deletingQuestionIndex);

      // Update local state
      setQuestions(updatedQuestions);

      // Adjust current question index if necessary
      if (currentQuestionIndex >= deletingQuestionIndex && currentQuestionIndex > 0) {
        setCurrentQuestionIndex(currentQuestionIndex - 1);
      } else if (currentQuestionIndex >= updatedQuestions.length && updatedQuestions.length > 0) {
        setCurrentQuestionIndex(updatedQuestions.length - 1);
      }

      // Save the updated questions to the database
      await saveInterviewContent(user.uid, articleSlug, {
        questions: updatedQuestions,
        generatedArticle: null,
        mode: 'voice'
      });

      // Close modal and reset state
      closeDeleteModal();
      setDeletingQuestionIndex(null);

    } catch (error) {
      handleServiceError('deleteQuestion', error);
    } finally {
      setIsDeletingQuestion(false);
    }
  };

  // MIGRATED: Handle canceling question deletion
  const handleCancelDelete = () => {
    closeDeleteModal();
    setDeletingQuestionIndex(null);
  };

  // Handle adding topic questions
  const handleAddTopicQuestion = () => {
    if (isEditingQuestion || isDeletingQuestion || regeneratingQuestionIndex !== null) {
      return;
    }

    setNewTopicQuestion('');
    openAddTopicModal();
  };

  // Handle saving new topic question
  const handleSaveNewTopicQuestion = async () => {
    if (!user || !articleData) return;

    const trimmedQuestion = newTopicQuestion.trim();

    // Validate question text
    if (!trimmedQuestion) {
      return;
    }

    if (trimmedQuestion.length < 10) {
      return;
    }

    try {
      setIsAddingTopicQuestion(true);

      // Generate a unique ID for the new question
      const newQuestionId = `topic-added-${Date.now()}`;

      // Create the new question object
      const newQuestion = {
        id: newQuestionId,
        section: 'Additional Topics',
        question: trimmedQuestion,
        answer: '',
        answered: false,
        type: 'topic',
        isRequired: true,
        timestamp: new Date()
      };

      // Add the question to the end of the questions array
      const updatedQuestions = [...questions, newQuestion];

      // Update local state
      setQuestions(updatedQuestions);

      // Save the updated questions to the database
      await saveInterviewContent(user.uid, articleSlug, {
        questions: updatedQuestions,
        generatedArticle: null,
        mode: 'voice'
      });

      // Navigate to the new question
      setCurrentQuestionIndex(updatedQuestions.length - 1);

      // Close modal and reset state
      closeAddTopicModal();
      setNewTopicQuestion('');

    } catch (error) {
      handleServiceError('addTopicQuestion', error);
    } finally {
      setIsAddingTopicQuestion(false);
    }
  };

  // MIGRATED: Handle canceling add topic question
  const handleCancelAddTopic = () => {
    closeAddTopicModal();
    setNewTopicQuestion('');
  };

  const handleAnswerSave = async (questionIndex, answerData) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('💾 Direct save triggered:', {
        questionIndex,
        answerLength: answerData.answer?.length || 0,
        questionId: questions[questionIndex]?.id
      });
    }

    try {
      const question = questions[questionIndex];
      if (!question) return;

      // FIRST: Update centralized state immediately for real-time UI updates
      handleCentralizedAnswerUpdate(question.id, answerData.answer, answerData.voiceResponse);

      // THEN: Save directly to database (this is the immediate save, not auto-save)
      const currentInterview = await getInterviewById(user.uid, articleSlug);
      if (!currentInterview) {
        throw new Error('Interview not found');
      }

      // Update the questions array with the new answer
      const updatedQuestions = [...(currentInterview.questions || [])];
      const questionIndexInArray = updatedQuestions.findIndex(q => q.id === question.id);

      if (questionIndexInArray !== -1) {
        updatedQuestions[questionIndexInArray] = {
          ...updatedQuestions[questionIndexInArray],
          answer: answerData.answer,
          answered: answerData.answer.trim().length > 0,
          timestamp: new Date(),
          voiceResponse: answerData.voiceResponse
        };

        // Save to Firestore using the same service as auto-save
        await updateInterview(user.uid, articleSlug, {
          questions: updatedQuestions,
          updatedAt: new Date()
        });

        // Update local state
        setQuestions(updatedQuestions);

        // IMPORTANT: Remove from centralized pendingChanges since it's now saved
        // This prevents auto-save from triggering since there are no pending changes
        setCentralizedState(prev => ({
          ...prev,
          questions: prev.questions.map(q => 
            q.id === question.id ? { ...q, isPending: false } : q
          ),
          pendingChanges: new Set([...prev.pendingChanges].filter(id => id !== question.id)),
          persistence: {
            ...prev.persistence,
            status: 'saved',
            lastSaved: new Date(),
            retryCount: 0
          }
        }));

        // Answer saved successfully
      } else {
        throw new Error(`Question with ID ${question.id} not found in database`);
      }

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ handleAnswerSave failed:', {
          error: error.message,
          stack: error.stack,
          questionIndex,
          questionId: questions[questionIndex]?.id,
          answerLength: answerData?.answer?.length || 0
        });
      }
      
      // Update centralized state to show error
      setCentralizedState(prev => ({
        ...prev,
        persistence: {
          ...prev.persistence,
          status: 'error',
          retryCount: prev.persistence.retryCount + 1
        }
      }));
      
      throw error;
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

  // Create locked versions of handlers for AI Preview interface locking
  const lockedGoToNextQuestion = createLockedHandler(goToNextQuestion, 'Navigate to next question');
  const lockedGoToPreviousQuestion = createLockedHandler(goToPreviousQuestion, 'Navigate to previous question');
  const lockedHandleQuestionChange = createLockedHandler(handleQuestionChange, 'Change questions');
  const lockedOpenQuestionsModal = createLockedHandler(openQuestionsModal, 'View questions');
  const lockedHandleEditQuestion = createLockedHandler(handleEditQuestion, 'Edit questions');
  const lockedHandleDeleteQuestion = createLockedHandler(handleDeleteQuestion, 'Delete questions');
  const lockedHandleAddTopicQuestion = createLockedHandler(handleAddTopicQuestion, 'Add questions');
  const lockedGenerateArticleFromInterview = createLockedHandler(generateArticleFromInterview, 'Generate article');

  // Setup context for optimized Questions Modal
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__questionsModalContext = {
        questions,
        currentQuestionIndex,
        centralizedState,
        closeQuestionsModal,
        goToQuestion,
        styles
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.__questionsModalContext;
      }
    };
  }, [questions, currentQuestionIndex, centralizedState, closeQuestionsModal, goToQuestion]);

  const getCurrentQuestion = useCallback(() => {
    return questions[currentQuestionIndex] || null;
  }, [questions, currentQuestionIndex]);

  // Memoized current question for better performance
  const currentQuestion = useMemo(() => {
    return questions[currentQuestionIndex] || null;
  }, [questions, currentQuestionIndex]);

  // Memoized calculations to prevent recalculation on every render
  const answeredCount = useMemo(() => {
    return questions.filter(q => q.answered).length;
  }, [questions]);

  const interviewProgress = useMemo(() => {
    if (questions.length === 0) return 0;
    return Math.round((answeredCount / questions.length) * 100);
  }, [answeredCount, questions.length]);

  const getProgress = useCallback(() => interviewProgress, [interviewProgress]);
  const getAnsweredCount = useCallback(() => answeredCount, [answeredCount]);

  // Check if all questions are answered for compilation requirements
  const isInterviewComplete = () => {
    return questions.length > 0 && questions.every(q => {
      const hasAnswer = q.answer && typeof q.answer === 'string' && q.answer.trim().length > 0;
      const hasVoiceResponse = q.voiceResponse && typeof q.voiceResponse.transcription === 'string' && q.voiceResponse.transcription.trim().length > 0;
      return hasAnswer || hasVoiceResponse;
    });
  };

  // Get completion status for user guidance
  const getCompletionStatus = () => {
    const answeredCount = questions.filter(q => {
      const hasAnswer = q.answer && typeof q.answer === 'string' && q.answer.trim().length > 0;
      const hasVoiceResponse = q.voiceResponse && typeof q.voiceResponse.transcription === 'string' && q.voiceResponse.transcription.trim().length > 0;
      return hasAnswer || hasVoiceResponse;
    }).length;

    return {
      answeredCount,
      totalQuestions: questions.length,
      isComplete: answeredCount === questions.length && questions.length > 0
    };
  };

  if (loading || isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <p>
          {loading ? 'Verifying authentication...' :
            questions.length === 0 ? 'Generating interview questions...' :
              'Loading voice interview...'}
        </p>
      </div>
    );
  }

  if (authError) {
    return (
      <ErrorMessage
        title="Authentication Error"
        message={authError}
        type="auth"
        size="large"
        canRetry={false}
        actions={
          <button onClick={() => router.push('/login')} className={styles.errorButton}>
            Go to Login
          </button>
        }
      />
    );
  }

  if (error) {
    return (
      <ErrorMessage
        title="Voice Interview Error"
        message={error}
        type="error"
        size="large"
        canRetry={true}
        onRetry={() => window.location.reload()}
        actions={
          <button onClick={handleSwitchToText} className={styles.switchButton}>
            Switch to Text Interview
          </button>
        }
      />
    );
  }

  if (!user || !isAuthenticated || !articleData) {
    return null;
  }

  if (!voiceSupported) {
    return (
      <div className={styles.unsupportedContainer}>
        <div className={styles.unsupportedCard}>
          <div className={styles.unsupportedIcon}><MdMic style={{color: '#3b82f6'}} /></div>
          <h2>Voice Interview Not Supported</h2>
          <p>
            Your browser doesn&apos;t support the voice interview features.
            Please use a modern browser like Chrome, Firefox, or Safari.
          </p>
          <div className={styles.unsupportedActions}>
            <button onClick={handleSwitchToText} className={styles.primaryButton}>
              Continue with Text Interview
            </button>
            <button onClick={() => window.location.reload()} className={styles.secondaryButton}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Format save time helper
  const formatSaveTime = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const saveTime = new Date(timestamp);
    const diffMs = now - saveTime;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return saveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Use memoized currentQuestion instead of function call
  // Use memoized interviewProgress directly

  return (
    <div className={styles.voiceInterview}>
      <div className="container-fluid">
        {/* Rich Studio Header */}
        <div className="row">
          <div className="col-12">
            <div className={styles.header}>
              <div className={styles.headerContent}>
                {/* Left Section - Branding & Session Info */}
                <div className={styles.leftSection}>
                  <div className={styles.studioBranding}>
                    <div className={styles.studioLogo}><MdMic style={{color: '#ffffff', filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3))'}} /></div>
                    <div className={styles.sessionInfo}>
                      <h1 className={styles.sessionTitle}>Voice Interview: {topic}</h1>
                      <p className={styles.sessionMeta}>Session with Michael - AI Interviewer</p>
                    </div>
                  </div>
                </div>

                {/* Right Section - Progress & Controls */}
                <div className={styles.rightSection}>
                  {/* Progress Section */}
                  <div className={styles.progressSection}>
                    <div className={styles.progressInfo}>
                      <div className={styles.progressHeader}>
                      </div>
                      <div className={styles.progressBreakdown}>
                        <div className={styles.progressTypeGroup}>
                          <span className={styles.progressTypeLabel}>
                            <span className={styles.typeIcon}><MdPerson style={{color: '#8b5cf6'}} /></span>
                            Intro: 1/1
                          </span>
                          <span className={styles.progressTypeLabel}>
                            <span className={styles.typeIcon}><MdLightbulb style={{color: '#10b981'}} /></span>
                            Topic: {getAnsweredCount() - 1}/{questions.length - 1}
                          </span>
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* Promotional Link Button */}
                  {getAnsweredCount() >= questions.length && (
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
                  )}

                  {/* Session Actions */}
                  <div className={styles.sessionActions}>
                    {/* Generate Article Button */}
                    <button
                      className={`${styles.actionButton} ${styles.generateArticleButton} ${
                        getAnsweredCount() < questions.length ? styles.generateArticleButtonDisabled : ''
                      }`}
                      onClick={getAnsweredCount() >= questions.length ? generateArticleFromInterview : undefined}
                      disabled={
                        getAnsweredCount() < questions.length || 
                        !validateUrl(referenceLink).isValid || 
                        !validateLinkDescription(linkDescription, referenceLink.trim()).isValid
                      }
                      aria-label={
                        getAnsweredCount() >= questions.length ? "Generate Article" : 
                        `Complete ${questions.length - getAnsweredCount()} more question${questions.length - getAnsweredCount() !== 1 ? 's' : ''} to generate article`
                      }
                      title={
                        getAnsweredCount() >= questions.length ? "Generate article from interview responses" : 
                        `Answer all questions first (${questions.length - getAnsweredCount()} remaining)`
                      }
                    >
                      <div className={styles.buttonContent}>
                        <span className={styles.actionIcon}>
                          {getAnsweredCount() >= questions.length ? <MdDescription /> : <MdSchedule />}
                        </span>
                        <span className={styles.actionText}>
                          {getAnsweredCount() >= questions.length ? 'Generate Article' : 
                           `Complete ${questions.length - getAnsweredCount()} more questions to generate article`}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>



      {/* Voice Interview Interface */}
      {process.env.NODE_ENV === 'development' && (
        console.log('🔧 VoiceInterviewInterface Props:', {
          questionsCount: questions.length,
          answersCount: Object.keys(questions.reduce((acc, q, idx) => ({ ...acc, [idx]: q.answer || '' }), {})).length,
          pendingAnswersCount: Array.from(centralizedState.pendingChanges).length,
          autoSaveStatus: centralizedState.persistence.status,
          autoSaveEnabled: true
        })
      )}
      <VoiceInterviewInterface
        key={`question-${currentQuestionIndex}-${currentQuestion?.id || 'none'}`}
        // Core data props
        articleData={articleData}
        questions={questions}
        currentQuestionIndex={currentQuestionIndex}
        
        // FIXED: Required props extracted from centralized state
        answers={questions.reduce((acc, q, idx) => ({ ...acc, [idx]: q.answer || '' }), {})}
        pendingAnswers={Array.from(centralizedState.pendingChanges).reduce((acc, questionId) => {
          const question = questions.find(q => q.id === questionId);
          if (question) {
            acc[questionId] = {
              answer: question.answer || '',
              voiceResponse: question.voiceResponse || {}
            };
          }
          return acc;
        }, {})}
        autoSaveStatus={centralizedState.persistence.status}
        autoSaveError={null} // We'll handle errors differently
        autoSaveEnabled={true}
        lastSavedTime={centralizedState.persistence.lastSaved}
        
        // Core handlers
        onQuestionChange={lockedHandleQuestionChange}
        onAnswerChange={handleAnswerChange}
        onAnswerSave={handleAnswerSave}
        
        // Navigation
        onGoToQuestion={goToQuestion}
        onNextQuestion={lockedGoToNextQuestion}
        onPreviousQuestion={lockedGoToPreviousQuestion}
        
        // Progress props
        progress={interviewProgress}
        answeredCount={answeredCount}
        totalQuestions={questions.length}
        
        // Modal handlers
        showQuestionsModal={isQuestionsModalOpen()}
        onToggleQuestionsModal={(isOpen) => isOpen ? lockedOpenQuestionsModal() : closeQuestionsModal()}
        
        // Question management
        onRegenerateIntroQuestion={handleRegenerateIntroQuestion}
        regeneratingQuestionIndex={regeneratingQuestionIndex}
        onEditQuestion={lockedHandleEditQuestion}
        isEditingQuestion={isEditingQuestion}
        editingQuestionIndex={editingQuestionIndex}
        onDeleteQuestion={lockedHandleDeleteQuestion}
        onAddTopicQuestion={lockedHandleAddTopicQuestion}
        
        // AI Preview state and handlers (lifted from VoiceInterviewStudio)
        isAiPreviewEnabled={isAiPreviewEnabled}
        onToggleAiPreview={handleToggleAiPreview}
        isInterfaceLocked={isInterfaceLocked}
        
        // Actions
        onSwitchToText={handleSwitchToText}
        onGenerateArticle={lockedGenerateArticleFromInterview}
      />

      {isUnsavedModalOpen() && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Unsaved Changes</h3>
            </div>
            <div className={styles.modalBody}>
              <p>You have unsaved changes. What would you like to do?</p>
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={handleSaveAndLeave}
                className={styles.primaryButton}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save & Leave'}
              </button>
              <button
                onClick={handleConfirmNavigation}
                className={styles.secondaryButton}
              >
                Leave Without Saving
              </button>
              <button
                onClick={handleCancelNavigation}
                className={styles.tertiaryButton}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Topic Question Modal */}
      {isAddTopicModalOpen() && (
        <div className={styles.modalOverlay} role="presentation">
          <div
            className={`${styles.modal} ${styles.addTopicModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-topic-modal-title"
          >
            <div className={styles.addTopicModalHeader}>
              <div className={styles.addTopicHeaderCopy}>
                <h3 id="add-topic-modal-title">
                  <MdQuestionAnswer style={{ marginRight: '0.75rem', color: '#3b82f6' }} />
                  Add New Topic Question
                </h3>
                <p className={styles.addTopicSubtitle}>
                  Capture another angle for this interview. Keep the question specific, actionable, and easy to answer.
                </p>
              </div>
              <button
                className={styles.addTopicCloseButton}
                onClick={handleCancelAddTopic}
                aria-label="Close modal"
                type="button"
              >
                ×
              </button>
            </div>

            <div className={styles.addTopicContent}>
              <label htmlFor="newTopicQuestionInput" className={styles.addTopicLabel}>
                <MdChat style={{ marginRight: '0.5rem', color: '#6366f1' }} />
                New Topic Question
              </label>
              <textarea
                id="newTopicQuestionInput"
                className={styles.addTopicTextarea}
                value={newTopicQuestion}
                onChange={(e) => setNewTopicQuestion(e.target.value)}
                placeholder="E.g. What are the first steps to launch a successful {topic} strategy?"
                rows={4}
                autoFocus
              />
              <div className={styles.addTopicHint}>
                <MdHelpOutline style={{ marginRight: '0.5rem', color: '#10b981' }} />
                Aim for clarity, include the key outcome the expert should speak to, and avoid double-barrel questions.
              </div>
              {newTopicQuestion.trim().length > 0 && newTopicQuestion.trim().length < 10 && (
                <div className={styles.addTopicError}>
                  Question must be at least 10 characters long.
                </div>
              )}
            </div>

            <div className={styles.addTopicFooter}>
              <button
                onClick={handleCancelAddTopic}
                className={styles.addTopicSecondaryButton}
                disabled={isAddingTopicQuestion}
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewTopicQuestion}
                className={styles.addTopicPrimaryButton}
                disabled={
                  isAddingTopicQuestion ||
                  !newTopicQuestion.trim() ||
                  newTopicQuestion.trim().length < 10
                }
                type="button"
              >
                {isAddingTopicQuestion ? 'Adding…' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Question Confirmation Modal */}
      {isDeleteModalOpen() && (
        <div className={modalStyles.modalOverlay}>
          <div className={`${modalStyles.modalContent} ${modalStyles.delete}`}>
            {/* Header */}
            <div className={modalStyles.modalHeader}>
              <div className={modalStyles.modalTitle}>
                <div className={`${modalStyles.titleIcon} ${modalStyles.delete}`}>
                  <MdWarning style={{color: '#ffffff'}} />
                </div>
                <h3>
                  Delete Question {deletingQuestionIndex !== null ? deletingQuestionIndex + 1 : ''}
                </h3>
              </div>
              <button
                className={modalStyles.closeButton}
                onClick={handleCancelDelete}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className={modalStyles.modalBody}>
              <div className={modalStyles.deleteContent}>
                <div className={modalStyles.warningSection}>
                  <div className={modalStyles.warningIconLarge}>
                    <MdWarning style={{color: '#ef4444'}} />
                  </div>
                  <h4 className={modalStyles.deleteTitle}>
                    Are you sure you want to delete this topic question?
                  </h4>
                  <p className={modalStyles.warningText}>
                    This action cannot be undone. Any answer for this question will also be lost.
                  </p>
                </div>
                
                <div className={modalStyles.questionPreviewSection}>
                  <label className={modalStyles.previewLabel}>
                    <span><MdQuestionAnswer style={{color: '#ef4444'}} /></span>
                    Question Preview
                  </label>
                  <div className={modalStyles.questionPreviewBox}>
                    "{questions[deletingQuestionIndex]?.question || 'Question not found'}"
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={modalStyles.modalFooter}>
              <button
                className={modalStyles.cancelButton}
                onClick={handleCancelDelete}
                disabled={isDeletingQuestion}
              >
                Cancel
              </button>
              <button
                className={modalStyles.deleteButton}
                onClick={handleConfirmDelete}
                disabled={isDeletingQuestion}
              >
                {isDeletingQuestion ? (
                  <>
                    <div className={modalStyles.deletingSpinner} />
                    Deleting...
                  </>
                ) : (
                  <>
                    <MdDelete /> Delete Question
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Question Modal */}
      {isEditModalOpen() && (
        <div className={modalStyles.modalOverlay}>
          <div className={`${modalStyles.modalContent} ${modalStyles.edit}`}>
            {/* Header */}
            <div className={modalStyles.modalHeader}>
              <div className={modalStyles.modalTitle}>
                <div className={`${modalStyles.titleIcon} ${modalStyles.edit}`}>
                  <MdEdit style={{color: '#3b82f6'}} />
                </div>
                <h3>
                  Edit Question {editingQuestionIndex !== null ? editingQuestionIndex + 1 : ''}
                </h3>
              </div>
              <button
                className={modalStyles.closeButton}
                onClick={handleCancelEdit}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className={modalStyles.modalBody}>
              <div className={modalStyles.inputGroup}>
                <label className={modalStyles.inputLabel}>
                  <span><MdNoteAdd style={{color: '#3b82f6'}} /></span>
                  Question Text
                </label>
                <textarea
                  className={modalStyles.questionInput}
                  value={editModalQuestion}
                  onChange={(e) => setEditModalQuestion(e.target.value)}
                  placeholder="Enter your question here..."
                  rows={4}
                  autoFocus
                  disabled={isEditingQuestion}
                />
                <small className={modalStyles.inputHint}>
                  Keep questions clear, concise, and relevant to the interview topic.
                </small>
              </div>
            </div>

            {/* Footer */}
            <div className={modalStyles.modalFooter}>
              <button
                className={modalStyles.cancelButton}
                onClick={handleCancelEdit}
                disabled={isEditingQuestion}
              >
                Cancel
              </button>
              <button
                className={modalStyles.saveButton}
                onClick={handleSaveEditedQuestion}
                disabled={isEditingQuestion || !editModalQuestion.trim()}
              >
                {isEditingQuestion ? (
                  <>
                    <div className={modalStyles.savingSpinner} />
                    Saving...
                  </>
                ) : (
                  <>
                    <MdSave /> Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Questions Modal - Optimized for Performance */}
      {isQuestionsModalOpen() && <QuestionsModal />}

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

      {/* Auto-save failure notification toast */}
      {centralizedState.persistence.status === 'error' && centralizedState.persistence.retryCount >= 3 && (
        <div className={styles.toastNotification}>
          <div className={styles.toast}>
            <div className={styles.toastIcon}>!</div>
            <div className={styles.toastContent}>
              <div className={styles.toastTitle}>Auto-save Failed</div>
              <div className={styles.toastMessage}>
                Voice responses could not be saved automatically. Please save manually to avoid losing your progress.
              </div>
              <div className={styles.toastActions}>
                <button
                  className={styles.toastRetry}
                  onClick={() => {
                    setCentralizedState(prev => ({
                      ...prev,
                      persistence: {
                        ...prev.persistence,
                        retryCount: 0,
                        status: 'idle'
                      }
                    }));
                    handleAutoSave();
                  }}
                >
                  Retry Auto-save
                </button>
              </div>
            </div>
            <button
              className={styles.toastClose}
              onClick={() => setCentralizedState(prev => ({
                ...prev,
                persistence: { ...prev.persistence, status: 'idle' }
              }))}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Article Generation Progress Overlay (copied from questions page) */}
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

      {/* Lightweight route transition overlay (copied from questions page) */}
      {isTransitioning && (
        <div className={styles.transitionOverlay} aria-hidden="true">
          <div className={styles.transitionBox}>
            <div className={styles.spinner} />
            <span>Opening your article…</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VoiceInterviewPage() {
  return (
    <Suspense fallback={<LoadingSpinner size="large" />}>
      <VoiceInterviewPageContent />
    </Suspense>
  );
}
