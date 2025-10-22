'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Profiler } from 'react';
import { MdWarning } from 'react-icons/md';
import StudioLayout from './StudioLayout';
import AIInterviewerPanel from './AIInterviewerPanel';
import RecordingConsoleComponent from './RecordingConsoleComponent';
import ResponsePanelComponent from './ResponsePanelComponent';
import FloatingSuggestions from './FloatingSuggestions';
import { useRecordingState } from '../../hooks/useRecordingState';
import styles from './VoiceInterviewStudio.module.css';
import layoutStyles from './StudioLayout.module.css';
import { useRenderLogger, profilerOnRender, isDebugEnabled } from '../../utils/debugRender';

// Import the studio theme CSS
import '../../styles/studio-theme.css';

const VoiceInterviewStudio = ({
  // Article and question data
  articleData,
  questions = [],
  currentQuestionIndex = 0,

  // Navigation handlers
  onQuestionChange,
  onNextQuestion,
  onPreviousQuestion,

  // Answer management
  onAnswerSave,
  onAnswerChange, // Needed for fallback when primary save fails
  answers = {},
  pendingAnswers = {},
  aiPreviewContext = null,

  // Audio state
  isAISpeaking = false,
  isUserSpeaking = false,
  audioEnabled = true,
  volume = 80,

  // Recording state
  isListening = false,
  transcription = {
    current: '',
    final: '',
    interim: '',
    confidence: 0
  },

  // Save status
  autoSaveStatus = 'idle',
  autoSaveError = null,
  saveStatus = 'idle',
  lastSavedAt = null,
  lastSavedTime = null,

  // Progress tracking
  answeredCount = 0,
  totalQuestions = 0,
  progress = 0,

  // Mode switching
  onSwitchToText,

  // Modal state
  showQuestionsModal = false,
  onToggleQuestionsModal,

  // Error handling
  error = null,
  isInitialized = true,

  // Handler functions
  onStartListening,
  onStopListening,
  onRepeatQuestion,
  onVolumeChange,

  // Manual save functions
  onManualSave,
  onManualSaveAll,
  manualSaveStatus = 'idle',
  manualSaveError = null,

  // Floating suggestions
  showFloatingSuggestions = false,
  floatingSuggestions = [],
  onFloatingSuggestionClick,
  onFloatingSuggestionsDismiss,

  // Live caption props
  captionText = '',
  isCaptionVisible = false,

  // Regenerate question prop
  onRegenerateIntroQuestion,
  regeneratingQuestionIndex,

  // Edit question prop
  onEditQuestion,
  isEditingQuestion = false,
  editingQuestionIndex = null,

  // Delete question prop
  onDeleteQuestion,

  // Add topic question prop
  onAddTopicQuestion,

  // Intro/FAQ separation props
  introQuestions = [],
  topicQuestions = [],
  introComplete = false,
  showIntroSection = true,
  onStartFAQs,
  onToggleIntroVisibility,
  answeredTopicCount = 0,
  totalTopicQuestions = 0,
  currentTopicPosition = null,
  canStartFAQs = false,

  // Generate article prop
  onGenerateArticle,

  // TTS Mute functionality
  isTTSMuted = false,
  onTTSMuteToggle,

  // Additional props
  className = ''
}) => {
  // Render logger for props
  useRenderLogger('VoiceInterviewStudio', {
    currentQuestionIndex,
    questionsLen: questions?.length,
    isListening,
    autoSaveStatus,
    saveStatus,
  });

  // Use centralized recording state management with throttling for performance
  const { state, visualState, derived, actions } = useRecordingState({
    enablePerformanceTracking: true,
    debounceMs: 0, // No debouncing to keep button responsiveness
    throttleMs: 100  // Throttle to ~10 updates/sec to reduce re-renders
  });

  // Local state for studio-specific features (non-recording related)
  const [sessionDuration, setSessionDuration] = useState(0);
  const [showResponsePanel, setShowResponsePanel] = useState(true);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);


  // AI Preview state and hooks (moved to top to avoid conditional hook calls)
  const [isAiPreviewEnabled, setIsAiPreviewEnabled] = useState(false);
  const [aiPreviewLoading, setAiPreviewLoading] = useState(false);
  const [aiPreviewError, setAiPreviewError] = useState(null);
  const [aiPreviewData, setAiPreviewData] = useState(null);
  const previewCacheRef = useRef(new Map());
  const loadingKeysRef = useRef(new Set());

  const currentPreviewKey = useMemo(() => {
    if (!aiPreviewContext?.answerSignature) return null;
    return `${aiPreviewContext.answerSignature}`;
  }, [aiPreviewContext?.answerSignature]);

  const resetPreviewState = useCallback(() => {
    setAiPreviewLoading(false);
    setAiPreviewError(null);
    setAiPreviewData(null);
    loadingKeysRef.current.clear();
  }, []);

  useEffect(() => {
    if (!currentPreviewKey) {
      resetPreviewState();
      setIsAiPreviewEnabled(false);
      return;
    }

    const cached = previewCacheRef.current.get(currentPreviewKey);
    if (cached) {
      setAiPreviewData(cached);
      setAiPreviewError(null);
      setAiPreviewLoading(false);
    } else {
      resetPreviewState();
    }
  }, [currentPreviewKey, resetPreviewState]);

  useEffect(() => {
    if (questions[currentQuestionIndex]?.type === 'intro') {
      setIsAiPreviewEnabled(false);
      resetPreviewState();
    }
  }, [questions, currentQuestionIndex, resetPreviewState]);

  const fetchAiPreview = useCallback(async () => {
    if (!aiPreviewContext || !currentPreviewKey) {
      return;
    }

    if (previewCacheRef.current.has(currentPreviewKey)) {
      setAiPreviewData(previewCacheRef.current.get(currentPreviewKey));
      setAiPreviewLoading(false);
      setAiPreviewError(null);
      return;
    }

    // Prevent concurrent requests for the same key
    if (loadingKeysRef.current.has(currentPreviewKey)) {
      return;
    }

    loadingKeysRef.current.add(currentPreviewKey);
    setAiPreviewLoading(true);
    setAiPreviewError(null);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ||
        (process.env.NODE_ENV === 'production'
          ? 'https://us-central1-queryfuel-f830f.cloudfunctions.net/api'
          : 'http://127.0.0.0:5002/lead-generation-6cf0f/us-central1/api');

      const response = await fetch(`${apiBaseUrl}/gemini/faq-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic: aiPreviewContext.topic || '',
          question: aiPreviewContext.question || '',
          answer: aiPreviewContext.answer || '',
          expertBackground: aiPreviewContext.expertBackground || ''
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = errorBody?.error?.message || `Failed to fetch preview (${response.status})`;
        throw new Error(message);
      }

      const payload = await response.json();
      const previewPayload = payload?.data || null;

      if (!previewPayload) {
        throw new Error('Preview payload missing');
      }

      // Limit cache size to prevent memory leaks
      if (previewCacheRef.current.size >= 10) {
        const firstKey = previewCacheRef.current.keys().next().value;
        previewCacheRef.current.delete(firstKey);
      }

      previewCacheRef.current.set(currentPreviewKey, previewPayload);
      setAiPreviewData(previewPayload);
      setAiPreviewError(null);
    } catch (error) {
      setAiPreviewError(error?.message || 'Unable to load AI preview.');
      setAiPreviewData(null);
    } finally {
      loadingKeysRef.current.delete(currentPreviewKey);
      setAiPreviewLoading(false);
    }
  }, [aiPreviewContext, currentPreviewKey]);

  const handleToggleAiPreview = useCallback(
    (enabled) => {
      if (!aiPreviewContext?.isAnswerEligible) {
        setIsAiPreviewEnabled(false);
        return;
      }

      setIsAiPreviewEnabled(enabled);

      if (enabled) {
        fetchAiPreview();
      } else {
        setAiPreviewLoading(false);
      }
    },
    [aiPreviewContext?.isAnswerEligible, fetchAiPreview]
  );

  useEffect(() => {
    if (!aiPreviewContext?.isAnswerEligible) {
      setIsAiPreviewEnabled(false);
    }
  }, [aiPreviewContext?.isAnswerEligible]);

  useEffect(() => {
    if (isAiPreviewEnabled) {
      fetchAiPreview();
    }
  }, [isAiPreviewEnabled, fetchAiPreview]);

  const aiPreviewDisabledReason = useMemo(() => {
    if (!aiPreviewContext) {
      return 'AI preview is unavailable for this question.';
    }

    if (!aiPreviewContext.answerLength) {
      return 'Provide an answer to view the AI preview.';
    }

    if (!aiPreviewContext.isAnswerEligible) {
      const minLen = aiPreviewContext.minimumAnswerLength || 0;
      return `Answer must be at least ${minLen} characters to enable AI preview.`;
    }

    return null;
  }, [aiPreviewContext]);

  // Initialize microphone access as granted (assuming we have permission)
  useEffect(() => {
    if (state.microphoneAccess === 'pending') {
      actions.setMicrophoneAccess('granted');
    }
  }, [state.microphoneAccess, actions]);

  // Get current question
  const currentQuestion = questions[currentQuestionIndex] || null;
  const isIntroQuestion = currentQuestion?.type === 'intro';
  const isAnswerAiEnhanced = currentQuestion?.voiceResponse?.source === 'ai_enhanced';
  const isAnswerManuallyEdited = currentQuestion?.voiceResponse?.source === 'manual_edit';
  const clientName = articleData?.expertIntro?.name || 'Michael - AI Interviewer';
  const clientAvatar = articleData?.expertIntro?.avatar || '/images/default-avatar.png';

  // Lock UI interactions while a question is regenerating OR while actively recording
  const isLocked = (typeof regeneratingQuestionIndex === 'number' && regeneratingQuestionIndex !== null) || isListening;

  // Session timer - disabled to prevent re-renders every second
  // If you need the timer, extract it to a separate memoized component
  useEffect(() => {
    // Timer disabled for performance - was causing re-renders every second
    // const timer = setInterval(() => {
    //   setSessionDuration(prev => prev + 1);
    // }, 1000);
    // return () => clearInterval(timer);
  }, []);



  // Sync external props with centralized state
  useEffect(() => {
    // Update centralized state when external props change
    if (isUserSpeaking !== state.isUserSpeaking) {
      actions.setUserSpeaking(isUserSpeaking, Math.random() * 0.8 + 0.2);
    }
  }, [isUserSpeaking, state.isUserSpeaking, state.isMuted, actions]);

  // Cleanup refs on unmount
  useEffect(() => {
    return () => {
      previewCacheRef.current.clear();
      loadingKeysRef.current.clear();
    };
  }, []);

  // Sync effect removed to prevent race conditions - we handle state directly in button handlers

  // Disable mapping auto-save/manually saving states to recording "processing" UI
  // Previously: when autoSaveStatus or manualSaveStatus was 'saving', the button showed a processing state.
  // Now: we keep the recording control UI stable and independent of save operations.
  useEffect(() => {
    if (state.isProcessing) {
      actions.setProcessing(false);
    }
  }, [state.isProcessing, actions]);

  // Handle error states
  useEffect(() => {
    // Only surface critical errors to the recording state manager.
    // Ignore transient speech errors like "no speech" or auto-retry messages
    const msg = typeof error === 'string' ? error.toLowerCase() : '';
    const isTransientSpeechError = msg.includes('no speech') || msg.includes('retry');

    if (error && !state.error && !isTransientSpeechError) {
      actions.setError(error, true);
    } else if ((!error || isTransientSpeechError) && state.error) {
      actions.clearError();
    }
  }, [error, state.error, actions]);

  // Handle save errors
  useEffect(() => {
    if (autoSaveError && !state.error) {
      actions.setError(`Save failed: ${autoSaveError}`, true);
    }
    if (manualSaveError && !state.error) {
      actions.setError(`Manual save failed: ${manualSaveError}`, true);
    }
  }, [autoSaveError, manualSaveError, state.error, actions]);

  // Note: Suggestions are now handled by floating suggestions system
  // No need to generate them here as they're contextually shown when user is silent

  // Determine recording state from centralized state
  const getRecordingState = () => {
    if (isAISpeaking) return 'idle'; // Can't record while AI is speaking
    return state.recordingState;
  };

  // Determine speaking status for AI
  const getSpeakingStatus = () => {
    if (isAISpeaking) return 'speaking';
    if (state.recordingState === 'recording') return 'listening';
    if (state.recordingState === 'processing') return 'processing';
    return 'idle';
  };

  // Handle recording toggle with centralized state
  const handleToggleRecording = async () => {
    try {
      if (state.recordingState === 'recording') {
        // Stop recording immediately
        await actions.stopRecording();
        if (onStopListening) onStopListening();
      } else {
        // Start recording immediately
        await actions.startRecording();
        if (onStartListening) onStartListening();
      }
    } catch (error) {
      actions.setError(error.message || 'Recording toggle failed', true);
    }
  };

  // Handle volume change
  const handleVolumeChange = (newVolume) => {
    if (onVolumeChange) {
      onVolumeChange(newVolume);
    }
  };




  // Handle transcription save
  const handleTranscriptionSave = () => {
    const textToSave = transcription.final || transcription.current || '';
    if (textToSave.trim() && onAnswerSave) {
      onAnswerSave(textToSave);
    }
  };

  // Handle transcript editing
  const handleStartEditingTranscript = () => {
    setIsEditingTranscript(true);
  };

  const handleSaveEditedTranscript = (editedText) => {
    if (editedText.trim() && onAnswerSave) {
      // Preserve AI status if the answer was originally AI-enhanced
      const currentSource = currentQuestion?.voiceResponse?.source;
      const wasAiEnhanced = currentSource === 'ai_enhanced';
      const newSource = wasAiEnhanced ? 'ai_enhanced' : 'manual_edit';

      onAnswerSave(currentQuestionIndex, {
        answer: editedText,
        voiceResponse: {
          transcription: editedText,
          confidence: transcription.confidence || 1,
          timestamp: Date.now(),
          source: newSource
        }
      });
    }
    setIsEditingTranscript(false);
  };

  const handleCancelEditingTranscript = () => {
    setIsEditingTranscript(false);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    // This would typically set the suggestion as the current transcription
  };



  // Handle skip question
  const handleSkipQuestion = () => {
    if (onNextQuestion) {
      onNextQuestion();
    }
  };

  // Handle settings click
  const handleSettingsClick = () => {
    // Settings functionality would go here
  };


  // Navigation helpers
  const canGoBack = currentQuestionIndex > 0;
  const canGoForward = currentQuestionIndex < questions.length - 1;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  // Topic-centric header metrics
  const hasTopics = (totalTopicQuestions || (topicQuestions?.length || 0)) > 0;
  const headerTotal = hasTopics ? (totalTopicQuestions || topicQuestions.length) : questions.length;
  const headerAnswered = hasTopics ? (answeredTopicCount || 0) : answeredCount;
  const headerCurrent = hasTopics && (typeof currentTopicPosition === 'number') ? currentTopicPosition : currentQuestionIndex;
  const headerProgress = headerTotal > 0 ? Math.round((headerAnswered / headerTotal) * 100) : 0;


  // Loading state
  if (!isInitialized) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}>Initializing Voice Interview Studio...</p>
      </div>
    );
  }

  // Error state
  if (error && !audioEnabled) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>
          <div className={styles.errorIcon}>
            <MdWarning />
            <span className={styles.iconText}>Warning</span>
          </div>
          <h3>Voice Interview Unavailable</h3>
          <p>{error}</p>
          <div className={styles.errorActions}>
            <button onClick={onSwitchToText} className="btn-primary">
              Continue with Text Interview
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary"
            >
              Retry Voice Setup
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <StudioLayout className={`${styles.voiceInterviewStudio} ${className}`}>




      {/* Main Studio Area */}
      <StudioLayout.Main>
        <StudioLayout.Panels className={layoutStyles.twoColumnPanels}>
          {/* AI Interviewer Panel */}
          <StudioLayout.InterviewerPanel>
            <AIInterviewerPanel
              clientName={clientName}
              clientAvatar={clientAvatar}
              currentQuestion={currentQuestion}
              questionIndex={currentQuestionIndex}
              totalQuestions={questions.length}
              isAISpeaking={isAISpeaking}
              speakingStatus={getSpeakingStatus()}
              onSkipQuestion={isLocked ? undefined : handleSkipQuestion}
              onRegenerateIntroQuestion={isLocked ? undefined : onRegenerateIntroQuestion}
              onEditQuestion={isLocked ? undefined : onEditQuestion}
              onDeleteQuestion={isLocked ? undefined : onDeleteQuestion}
              regeneratingQuestionIndex={regeneratingQuestionIndex}
              isEditingQuestion={isEditingQuestion}
              editingQuestionIndex={editingQuestionIndex}
              isLocked={isLocked}
              // Intro/FAQ display props
              displayCounter={!(currentQuestion?.type === 'intro')}
              badgeLabel={currentQuestion?.type === 'intro' ? 'Expert Introduction' : 'FAQ'}
              badgeVariant={currentQuestion?.type || 'topic'}
              topicIndex={typeof currentTopicPosition === 'number' ? currentTopicPosition : null}
              topicTotal={totalTopicQuestions || (topicQuestions?.length || 0)}
              // Proceed to topics action (intro only)
              canStartFAQs={canStartFAQs}
              onProceedToTopics={() => onStartFAQs && onStartFAQs()}
              // Recording state for action blocking
              isRecording={state.recordingState === 'recording'}
              onToggleRecording={handleToggleRecording}
              isAnswerAiEnhanced={isAnswerAiEnhanced}
              // Navigation props
              onPrevious={() => { if (!isLocked) onPreviousQuestion && onPreviousQuestion(); }}
              onNext={() => { if (!isLocked) onNextQuestion && onNextQuestion(); }}
              onShowQuestions={() => { if (!isLocked && onToggleQuestionsModal) onToggleQuestionsModal(true); }}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
              answeredCount={answeredCount}
              // Add topic question
              onAddTopicQuestion={onAddTopicQuestion}
              // TTS Mute functionality
              isTTSMuted={isTTSMuted}
              onTTSMuteToggle={onTTSMuteToggle}
            />
          </StudioLayout.InterviewerPanel>



          {/* Response Panel */}
          <StudioLayout.ResponsePanel className={!showResponsePanel ? styles.responsePanelHidden : undefined}>
            {showResponsePanel ? (
              (() => {
                // Extract common props to improve readability and maintainability
                // This avoids duplication and makes changes easier
                const responsePanelProps = {
                  transcription: {
                    ...(transcription || { current: '', final: '', interim: '', confidence: 0 }),
                    // Include AI preview data from saved question for display
                    aiPreviewData: currentQuestion?.voiceResponse?.aiPreviewData || null
                  },
                  saveStatus,
                  isEditable: true,
                  lastSavedAt,
                  onSave: handleTranscriptionSave,
                  onManualSave,
                  onManualSaveAll,
                  manualSaveStatus,
                  manualSaveError,
                  // Caption/drawer logic - use centralized recording state for immediate updates
                  isListening: state.recordingState === 'recording',
                  isUserSpeaking: state.isUserSpeaking,
                  captionText: captionText || '', // Default to empty string if undefined
                  isCaptionVisible: isCaptionVisible || false, // Default to false
                  aiPreviewContext,
                  isAiPreviewEnabled: !isIntroQuestion && isAiPreviewEnabled,
                  onToggleAiPreview: isIntroQuestion ? undefined : handleToggleAiPreview,
                  onRetryAiPreview: isIntroQuestion ? undefined : fetchAiPreview,
                  aiPreviewLoading,
                  aiPreviewData,
                  aiPreviewError,
                  aiPreviewDisabledReason: isIntroQuestion
                    ? 'AI preview is not available for introduction questions.'
                    : aiPreviewDisabledReason,
                  isAnswerAiEnhanced,
                  isAnswerManuallyEdited,
                  isEditingTranscript,
                  onStartEditingTranscript: handleStartEditingTranscript,
                  onSaveEditedTranscript: handleSaveEditedTranscript,
                  onCancelEditingTranscript: handleCancelEditingTranscript,
                  onSaveAiResponse: (aiResponse) => {
                    // Save the AI response as the answer and turn off AI mode
                    if (onAnswerSave && currentQuestionIndex >= 0 && aiResponse) {
                      // Keep answer_md separate from takeaway - DO NOT combine them
                      // The backend needs them as separate fields for proper article generation
                      const answerText = aiResponse.answer_md || '';

                      onAnswerSave(currentQuestionIndex, {
                        answer: answerText,
                        voiceResponse: {
                          transcription: answerText,
                          confidence: 1.0, // AI-generated, so high confidence
                          timestamp: Date.now(),
                          source: 'ai_enhanced',
                          // Store the complete AI response structure for backend
                          aiPreviewData: {
                            answer_md: aiResponse.answer_md,
                            takeaway: aiResponse.takeaway,
                            real_results: aiResponse.real_results,
                            question: aiResponse.question
                          }
                        }
                      });
                      // Turn off AI preview mode after saving
                      setIsAiPreviewEnabled(false);
                    }
                  }
                };


                // Conditionally wrap with Profiler for debugging performance
                // This pattern allows easy toggling without code duplication
                const Component = <ResponsePanelComponent {...responsePanelProps} />;

                return isDebugEnabled() ? (
                  <Profiler id="ResponsePanelComponent" onRender={profilerOnRender}>
                    {Component}
                  </Profiler>
                ) : (
                  Component
                );
              })()
            ) : (
              <div className={styles.responsePanelPlaceholder} />
            )}
          </StudioLayout.ResponsePanel>
          
        </StudioLayout.Panels>
      </StudioLayout.Main>



      {/* Floating Suggestions - Appears when user is silent during recording */}
      <FloatingSuggestions
        suggestions={floatingSuggestions}
        isVisible={showFloatingSuggestions}
        onSuggestionClick={onFloatingSuggestionClick}
        onDismiss={onFloatingSuggestionsDismiss}
      />





      {/* Floating Options Console (More Options only) */}
      <RecordingConsoleComponent
        isRecording={isListening}
        onToggleRecording={handleToggleRecording}
        recordingState={state.recordingState}
        showResponsePanel={showResponsePanel}
        onToggleResponsePanel={() => setShowResponsePanel(!showResponsePanel)}
        onSwitchMode={onSwitchToText}
        disabled={isAnswerAiEnhanced}
        hideRecordingButton={true}
      />

      {/* REMOVED: Auto-save Status - using response panel indicator instead */}

    </StudioLayout>
  );
};

export default React.memo(VoiceInterviewStudio, (prevProps, nextProps) => {
  // Re-render on meaningful changes. Keep memoization tight but safe.
  if (prevProps.currentQuestionIndex !== nextProps.currentQuestionIndex) return false;
  if (prevProps.isListening !== nextProps.isListening) return false;
  if (prevProps.saveStatus !== nextProps.saveStatus) return false;
  // REMOVED: autoSaveStatus comparison - no longer displayed in UI
  if (prevProps.transcription?.final !== nextProps.transcription?.final) return false;
  if (prevProps.transcription?.confidence !== nextProps.transcription?.confidence) return false;
  if (prevProps.isAISpeaking !== nextProps.isAISpeaking) return false;
  if (prevProps.error !== nextProps.error) return false;

  // Important for visual indicator during question regeneration
  if (prevProps.regeneratingQuestionIndex !== nextProps.regeneratingQuestionIndex) return false;

  // Important for visual indicator during question editing
  if (prevProps.isEditingQuestion !== nextProps.isEditingQuestion) return false;
  if (prevProps.editingQuestionIndex !== nextProps.editingQuestionIndex) return false;

  // If questions reference changes, re-render (covers reordering/replacement)
  if (prevProps.questions !== nextProps.questions) return false;

  // Also re-render if the current question's identity or text changes
  const prevQ = prevProps.questions?.[prevProps.currentQuestionIndex];
  const nextQ = nextProps.questions?.[nextProps.currentQuestionIndex];
  if (prevQ?.id !== nextQ?.id) return false;
  if (prevQ?.question !== nextQ?.question) return false;

  // Re-render when editing transcript state changes
  if (prevProps.isEditingTranscript !== nextProps.isEditingTranscript) return false;

  // Re-render when TTS mute state changes
  if (prevProps.isTTSMuted !== nextProps.isTTSMuted) return false;

  return true;
});
