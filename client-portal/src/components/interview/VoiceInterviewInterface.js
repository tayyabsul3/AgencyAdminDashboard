'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { audioManager } from '../../services/audioManager';
import { speechService } from '../../services/speechService';
import VoiceInterviewStudio from './VoiceInterviewStudio';
import { useUnifiedTimer, ACTION_TYPES } from '../../hooks/useUnifiedTimer';
import { TimerHelpers, DELAYS } from '../../utils/timerHelpers';
import { useVoiceInterviewState } from '../../hooks/useVoiceInterviewState';
import styles from './VoiceInterviewInterface.module.css';


const VoiceInterviewInterface = ({
  articleData,
  questions,
  currentQuestionIndex,
  onQuestionChange,
  onAnswerSave,
  onAnswerChange,
  onSwitchToText,
  onComplete,
  // Enhanced save status props
  answers,
  pendingAnswers,
  autoSaveStatus,
  autoSaveError,
  autoSaveEnabled,
  lastSavedTime,
  // Manual save props
  onManualSave,
  onManualSaveAll,
  manualSaveStatus,
  manualSaveError,
  // Navigation props
  onGoToQuestion,
  onNextQuestion,
  onPreviousQuestion,
  // Progress props
  progress,
  answeredCount,
  totalQuestions,
  // Modal state props
  showQuestionsModal,
  onToggleQuestionsModal,
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

  // Generate article prop (forwarded to header button in StudioHeaderComponent via VoiceInterviewStudio)
  onGenerateArticle
}) => {
  // Consolidated state management with useReducer for performance
  const { state, actions } = useVoiceInterviewState();
  
  // TTS Mute state with localStorage persistence
  const [isTTSMuted, setIsTTSMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('voiceInterview_ttsMuted') === 'true';
    }
    return false;
  });
  
  // Destructure state for easier access
  const {
    audio: { isAISpeaking, isUserSpeaking, enabled: audioEnabled, volume, muted: isMuted },
    speech: { isListening, transcription },
    captions: { text: captionText, visible: isCaptionVisible },
    ui: { isInitialized, error, autoSpeakOnQuestionChange },
    save: { status: saveStatus, lastSavedAt },
    suggestions: { show: showFloatingSuggestions, items: floatingSuggestions }
  } = state;
  
  // Unified timer system (replaces multiple conflicting timeout refs)
  const timer = useUnifiedTimer({
    maxQueueSize: 10
  });

  // Refs for high-frequency updates to avoid re-renders
  const interimTranscriptionRef = useRef('');
  const lastCommittedInterimRef = useRef('');

  // Navigation ref (keep this one)
  const isNavigating = useRef(false);

  // Ref to track question ID when listening started (prevents race condition with late transcription)
  const listeningQuestionIdRef = useRef(null);

  // Ref to track last question index for conditional speaking
  const lastQuestionIndexRef = useRef(currentQuestionIndex);
  
  // Memoized current question - only recalculates when questions or index changes
  const currentQuestion = useMemo(() => 
    questions[currentQuestionIndex] || null, 
    [questions, currentQuestionIndex]
  );
  
  // Memoized derived UI state for save behavior - only recalculates when dependencies change
  const savedAnswer = useMemo(() => 
    (currentQuestion?.answer || '').trim(), 
    [currentQuestion?.answer]
  );
  
  const currentText = useMemo(() => 
    (transcription.final || '').trim(), 
    [transcription.final]
  );
  
  const isDirty = useMemo(() => 
    currentText !== savedAnswer, 
    [currentText, savedAnswer]
  );
  
// Derived question groups and Intro/FAQ flow state
const MIN_AI_PREVIEW_ANSWER_LENGTH = 20;

const { introList, topicList } = useMemo(() => {
  const intro = [];
  const topic = [];
  (questions || []).forEach((q, idx) => {
    if (!q) return;
    if (q.type === 'intro') intro.push({ ...q, __originalIndex: idx });
    else if (q.type === 'topic') topic.push({ ...q, __originalIndex: idx });
  });
  return { introList: intro, topicList: topic };
}, [questions]);

const introQuestions = introList;
const topicQuestions = topicList;

const [introComplete, setIntroComplete] = useState(false);
const [showIntroSection, setShowIntroSection] = useState(true);

useEffect(() => {
  const complete = introQuestions.length === 0 || introQuestions.every(q => {
    const t = (q.answer || '').trim();
    const vt = (q.voiceResponse?.transcription || '').trim();
    return q.answered || t.length > 0 || vt.length > 0;
  });
  setIntroComplete(complete);
  // Initial visibility: show intro section if exists and not complete; otherwise hide
  setShowIntroSection(introQuestions.length > 0 && !complete);
}, [introQuestions]);

// Topic progress metrics
const totalTopicQuestions = topicQuestions.length;
const topicQuestionOriginalIndices = useMemo(() => {
  if (!Array.isArray(topicQuestions) || topicQuestions.length === 0) {
    return [];
  }
  const baseQuestions = Array.isArray(questions) ? questions : [];
  return topicQuestions
    .map((q) => {
      if (!q) return -1;
      if (typeof q.__originalIndex === 'number') return q.__originalIndex;
      return baseQuestions.findIndex((base) => base?.id === q.id);
    })
    .filter((idx) => typeof idx === 'number' && idx >= 0)
    .sort((a, b) => a - b);
}, [topicQuestions, questions]);
const answeredTopicCount = useMemo(() => {
  return topicQuestions.filter(q => {
    const t = (q.answer || '').trim();
    const vt = (q.voiceResponse?.transcription || '').trim();
    return q.answered || t.length > 0 || vt.length > 0;
  }).length;
}, [topicQuestions]);

// Current topic position (null when viewing intro)
const currentTopicPosition = useMemo(() => {
  if (!currentQuestion || currentQuestion.type !== 'topic') return null;
  const idx = topicQuestions.findIndex(q => q.id === currentQuestion.id);
  return idx >= 0 ? idx : null;
}, [currentQuestion, topicQuestions]);

// Gate for starting FAQs
const canStartFAQs = useMemo(() => {
  if (totalTopicQuestions <= 0) return false;
  if (introQuestions.length === 0) return true;
  return introComplete;
}, [introComplete, introQuestions.length, totalTopicQuestions]);

// Handlers for section flow
const handleStartFAQs = useCallback(() => {
  if (!canStartFAQs) return;
  setShowIntroSection(false);
  setIntroComplete(true);
  const first = topicQuestions[0];
  if (first) {
    const idx = typeof first.__originalIndex === 'number'
      ? first.__originalIndex
      : (questions || []).findIndex(q => q?.id === first.id);
    if (idx >= 0) {
      if (onGoToQuestion) onGoToQuestion(idx);
      else if (onQuestionChange) onQuestionChange(idx);
    }
  }
}, [canStartFAQs, topicQuestions, onGoToQuestion, onQuestionChange, questions]);

const handleToggleIntroVisibility = useCallback((show) => {
  setShowIntroSection(!!show);
}, []);

// Topic-centric progress for downstream display
const topicProgress = useMemo(() => {
  if (totalTopicQuestions > 0) {
    return Math.round((answeredTopicCount / totalTopicQuestions) * 100);
  }
  return progress || 0;
}, [answeredTopicCount, totalTopicQuestions, progress]);

const interviewTopic = useMemo(() => {
  const topicFromArticle = (articleData?.topic || articleData?.setup?.topic || '').trim();
  if (topicFromArticle) return topicFromArticle;

  const topicQuestionWithTopic = (Array.isArray(topicQuestions) ? topicQuestions : []).find(
    (q) => typeof q?.topic === 'string' && q.topic.trim().length > 0
  );
  if (topicQuestionWithTopic?.topic) {
    return topicQuestionWithTopic.topic.trim();
  }

  return '';
}, [articleData?.topic, articleData?.setup?.topic, topicQuestions]);

const currentAnswerText = useMemo(() => {
  const finalText = (transcription?.final || '').trim();
  if (finalText) return finalText;

  const voiceText = (currentQuestion?.voiceResponse?.transcription || '').trim();
  if (voiceText) return voiceText;

  const savedText = (currentQuestion?.answer || '').trim();
  if (savedText) return savedText;

  return '';
}, [transcription?.final, currentQuestion?.voiceResponse?.transcription, currentQuestion?.answer]);

const expertBackgroundText = useMemo(() => {
  if (!Array.isArray(introQuestions) || introQuestions.length === 0) {
    return '';
  }

  const entries = introQuestions
    .map((introQuestion, idx) => {
      const questionText = (introQuestion?.question || '').trim();
      if (!questionText) return null;

      const answerText = (
        introQuestion?.voiceResponse?.transcription ||
        introQuestion?.answer ||
        ''
      ).trim();
      if (!answerText) return null;

      const questionLabel = `Q${idx + 1}: ${questionText}`;
      const answerLabel = `A${idx + 1}: ${answerText}`;
      return `${questionLabel}\n${answerLabel}`;
    })
    .filter(Boolean);

  return entries.length ? entries.join('\n\n') : '';
}, [introQuestions]);

const aiPreviewAnswerSignature = useMemo(() => {
  if (!currentQuestion) return null;
  const answer = currentAnswerText.trim();
  if (!answer) return null;

  const base = currentQuestion.id ? `id:${currentQuestion.id}` : `index:${currentQuestionIndex}`;
  const shorthand =
    answer.length > 120 ? `${answer.slice(0, 60)}|${answer.slice(-60)}` : answer;

  return `${base}|len:${answer.length}|${shorthand}`;
}, [currentQuestion, currentQuestionIndex, currentAnswerText]);

const aiPreviewContext = useMemo(() => {
  if (!currentQuestion) {
    return null;
  }

  const trimmedQuestion = (currentQuestion.question || '').trim();

  return {
    questionId: currentQuestion.id || null,
    questionIndex: currentQuestionIndex,
    question: trimmedQuestion,
    answer: currentAnswerText,
    topic: interviewTopic,
    expertBackground: expertBackgroundText,
    answerLength: currentAnswerText.length,
    answerSignature: aiPreviewAnswerSignature,
    answerTimestamp: currentQuestion?.voiceResponse?.timestamp || currentQuestion?.updatedAt || null,
    minimumAnswerLength: MIN_AI_PREVIEW_ANSWER_LENGTH,
    isAnswerEligible: currentAnswerText.length >= MIN_AI_PREVIEW_ANSWER_LENGTH
  };
}, [
  currentQuestion,
  currentQuestionIndex,
  currentAnswerText,
  interviewTopic,
  expertBackgroundText,
  aiPreviewAnswerSignature
]);

  

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        actions.setError(null);

        // Initialize speech service
        const speechInitialized = await speechService.initialize();
        if (!speechInitialized) {
          throw new Error('Speech recognition not supported');
        }
        
        // Start audio session
        audioManager.startSession({
          volume,
          muted: isMuted
        });
        
        // Set up audio manager listeners
        audioManager.addListener(handleAudioManagerEvent);
        
        actions.setInitialized(true);
        
      } catch (error) {
        actions.setError(error.message);
        actions.setAudioEnabled(false);
      }
    };
    
    initializeServices();
    
    // Cleanup on unmount
    return () => {
      try {
        audioManager.removeListener(handleAudioManagerEvent);
        audioManager.endSession();
        speechService.destroy();
      } catch (cleanupError) {
        // Cleanup error silently handled
      }
      
      // Clear all unified timer actions
      timer.clear();
    };
  }, []);

  // DO NOT auto-stop when tab becomes hidden - user must manually stop recording
  // Browser tab visibility changes should NOT affect recording state
  // Removed auto-stop behavior to give user full control
  
  // Handle audio manager events
  const handleAudioManagerEvent = useCallback((event, data) => {
    switch (event) {
      case 'audio-start':
        actions.setAISpeaking(true);
        break;
      case 'audio-end':
        actions.setAISpeaking(false);
        // Simplified UX: do not auto-start listening based on AI audio events
        break;
      case 'audio-error':
        actions.setAISpeaking(false);
        // Audio playback failed - log for debugging but don't show notification
        if (process.env.NODE_ENV === 'development') {
          console.log('Audio playback failed:', data?.error?.code || 'Unknown error');
        }
        break;
      case 'volume-changed':
        actions.setVolume(data.volume);
        break;
      case 'mute-changed':
        actions.setMuted(data.isMuted);
        break;
    }
  }, [actions, timer]);
  
  // Start speech recognition
  const startListening = useCallback(async () => {
    if (isListening) return;

    try {
      // Clear any previous errors
      actions.setError(null);

      // When starting to listen, preserve existing transcription content
      // This ensures we don't lose previously saved content when starting a new recording session
      const existingSavedAnswer = (currentQuestion?.answer || '').trim();
      if (existingSavedAnswer && !transcription.final.includes(existingSavedAnswer)) {
        actions.setTranscription({
          ...transcription,
          final: existingSavedAnswer,
          current: '',
          interim: ''
        });
      }

      const success = await speechService.startListening({
        onTranscription: handleTranscription,
        onError: handleSpeechError,
        onStart: () => {
          actions.setListening(true);
          actions.setError(null);
          // Track question ID to prevent race condition with late transcription
          listeningQuestionIdRef.current = currentQuestion?.id;
        },
        onEnd: () => {
          actions.setListening(false);
        },
        onSpeechStart: () => {
          actions.setUserSpeaking(true);
          actions.setCaptionVisible(true);
          // Clear all pending timer actions when user starts speaking
          timer.cancelByType(ACTION_TYPES.AUTO_SAVE);
          timer.cancelByType(ACTION_TYPES.SHOW_SUGGESTIONS);
          timer.cancelByType(ACTION_TYPES.HIDE_CAPTION);
        },
        onSpeechEnd: () => {
          actions.setUserSpeaking(false);
          // Auto-hide caption shortly after speech ends
          TimerHelpers.scheduleHideCaption(
            timer,
            () => actions.setCaptionVisible(false),
            DELAYS.CAPTION_HIDE
          );
          // Start silence detection; do not clear the save debounce timer
          startSilenceDetection();
          startSilentDetection();
        }
      });

      if (!success) {
        throw new Error('Failed to start speech recognition');
      }

    } catch (error) {
      actions.setError('Failed to start speech recognition. Please try again.');
      actions.setListening(false);
    }
  }, [isListening, actions, currentQuestion, transcription, timer]);
  
  // Stop speech recognition
  const stopListening = useCallback(async () => {
    // Await clean shutdown to avoid restart races on same question
    try { await speechService.stopListening(); } catch (_) {}
    actions.setListening(false);
    actions.setUserSpeaking(false);

    // Clear question ID tracking to prevent stale transcription processing
    listeningQuestionIdRef.current = null;

    // Cancel all pending timer actions when stopping listening
    timer.cancelByType(ACTION_TYPES.AUTO_SAVE);
    timer.cancelByType(ACTION_TYPES.SHOW_SUGGESTIONS);
  }, [actions, timer]);
  
  // Handle answer save (supports both direct text saves and structured payloads)
  const handleSaveAnswer = useCallback(
    async (...args) => {
      let targetIndex = currentQuestionIndex;
      let payload = args[0];
      let voiceResponseOverride = null;

      // Support signature handleSaveAnswer(index, payload)
      if (args.length >= 2 && typeof args[0] === 'number') {
        targetIndex = args[0];
        payload = args[1];
      }

      let text = '';
      if (typeof payload === 'string') {
        text = payload.trim();
      } else if (payload && typeof payload === 'object') {
        const rawAnswer =
          typeof payload.answer === 'string'
            ? payload.answer
            : typeof payload.text === 'string'
            ? payload.text
            : '';
        text = rawAnswer.trim();
        if (payload.voiceResponse && typeof payload.voiceResponse === 'object') {
          voiceResponseOverride = payload.voiceResponse;
        }
      } else if (payload != null) {
        text = String(payload).trim();
      }

      if (!text) return;

      const targetQuestion = questions[targetIndex] || null;
      const saved = (targetQuestion?.answer || '').trim();
      const isCurrentQuestion = targetIndex === currentQuestionIndex;

      if (isCurrentQuestion && saveStatus === 'saving') return;
      if (text === saved) return;

      const voiceResponsePayload = {
        transcription: text,
        confidence:
          typeof (voiceResponseOverride?.confidence) === 'number'
            ? voiceResponseOverride.confidence
            : transcription.confidence ?? 1,
        timestamp: voiceResponseOverride?.timestamp ?? Date.now(),
        source: voiceResponseOverride?.source || 'voice_transcription',
        ...(voiceResponseOverride || {})
      };

      try {
        if (isCurrentQuestion) {
          actions.setSaveStatus('saving');
        }
        await onAnswerSave(targetIndex, {
          answer: text,
          voiceResponse: voiceResponsePayload
        });

        if (isCurrentQuestion) {
          actions.setTranscription({
            current: '',
            final: text,
            interim: '',
            confidence: voiceResponsePayload.confidence
          });
          actions.setSaveStatus('saved');
          actions.setLastSavedAt(Date.now());
          actions.setAutoSpeakOnQuestionChange(false);
        }
      } catch (error) {
        actions.setError('Failed to save answer. Please try again.');
        if (isCurrentQuestion) {
          actions.setSaveStatus('error');
        }
      }
    },
    [
      actions,
      currentQuestionIndex,
      onAnswerSave,
      questions,
      saveStatus,
      transcription.confidence
    ]
  );
  
  // Handle transcription updates (final only for main panel; show interim in caption)
  const handleTranscription = useCallback((transcriptionData) => {
    // Prevent race condition: ignore transcription if question changed since listening started
    if (listeningQuestionIdRef.current !== currentQuestion?.id) return;

    // Get the existing saved answer for this question
    const existingSavedAnswer = (currentQuestion?.answer || '').trim();
    
    // If we have existing content and this is a new transcription session,
    // we should append to the existing content instead of replacing it
    let finalText = transcriptionData.final;
    if (existingSavedAnswer && transcriptionData.final && !transcriptionData.final.includes(existingSavedAnswer)) {
      // Add a space between existing content and new transcription if needed
      const separator = existingSavedAnswer.endsWith('.') || existingSavedAnswer.endsWith('!') || existingSavedAnswer.endsWith('?') ? ' ' : '. ';
      finalText = existingSavedAnswer + separator + transcriptionData.final;
    }

    // Only update final/confidence; do not touch interim/current to avoid flicker
    const newTranscription = {
      current: '',
      final: finalText || transcription.final,
      interim: '',
      confidence: transcriptionData.confidence
    };
    
    // Only update if there's actually a change to prevent unnecessary re-renders
    if (transcription.final !== newTranscription.final || transcription.confidence !== newTranscription.confidence) {
      actions.setTranscription(newTranscription);
    }

    // Update live caption with interim/current (does not affect layout)
    const snippet = (transcriptionData.current || transcriptionData.interim || '').trim();
    if (snippet) {
      actions.setCaptionText(snippet);
      actions.setCaptionVisible(true);
    }

    // Auto-save final transcription if it's substantial AND auto-save is enabled
    if (finalText && finalText.trim().length > 10 && autoSaveEnabled) {
      // Use unified timer for auto-save (replaces silenceTimeoutRef)
      TimerHelpers.scheduleAutoSave(
        timer,
        finalText,
        async () => {
          try {
            await handleSaveAnswer(finalText);
          } catch (error) {
            // If primary save fails, trigger fallback via onAnswerChange
            // This ensures the answer gets added to pendingAnswers for backup save
            if (onAnswerChange) {
              onAnswerChange(currentQuestionIndex, finalText, {
                transcription: finalText,
                confidence: transcription.confidence,
                timestamp: new Date().toISOString(),
                source: 'voice_transcription_fallback'
              });
            }
          }
        },
        DELAYS.AUTO_SAVE
      );
    }
  }, [actions, currentQuestion, transcription, timer, autoSaveEnabled, handleSaveAnswer, onAnswerChange, currentQuestionIndex]);
  
  // Handle speech recognition errors
  const handleSpeechError = useCallback((errorInfo) => {
    // Treat transient "no-speech" quietly: do not surface as an error state
    if (errorInfo.error === 'no-speech') {
      // Ignore no-speech errors entirely - keep recording active
      // Don't set isListening to false or restart
      if (process.env.NODE_ENV === 'development') {
        console.log('No speech detected, but continuing to listen...');
      }
      return;
    }

    // For other errors, avoid propagating transient retries as blocking UI errors
    actions.setListening(false);
    actions.setUserSpeaking(false);

    if (errorInfo.error === 'not-allowed') {
      actions.setError('Microphone access denied. Please click the microphone icon in your browser\'s address bar and allow access, then try again.');
      // Don't disable audio completely - allow retry
    } else if (errorInfo.canRetry) {
      // Retry transient errors
      setTimeout(() => {
        if (audioEnabled) {
          startListening();
        }
      }, 1500);
    } else {
      actions.setError(`Speech recognition error: ${errorInfo.message}`);
    }
  }, [actions, audioEnabled, startListening]);
  
  // Start silence detection (keep save debounce intact)
  const startSilenceDetection = () => {
    // No-op: We intentionally DO NOT clear the save debounce timeout here.
    // handleTranscription sets a save debounce (silenceTimeoutRef) that should survive
    // the 'speechend' event to allow auto-save after silence.
  };
  
  // Start silent detection (for showing floating suggestions)
  const startSilentDetection = () => {
    // Use unified timer for suggestions (replaces silentDetectionTimeoutRef)
    TimerHelpers.scheduleShowSuggestions(
      timer,
      () => {
        if (isListening && !isUserSpeaking && !showFloatingSuggestions) {
          showContextualSuggestions();
        }
      },
      [], // suggestions will be generated in showContextualSuggestions
      DELAYS.SUGGESTIONS
    );
  };

  // Memoized contextual suggestions - only recalculates when question or answer changes
  const contextualSuggestions = useMemo(() => {
    if (!currentQuestion) return [];

    const questionType = currentQuestion.question.toLowerCase();
    const existingAnswer = (currentQuestion?.answer || '').trim();

    // Generate contextual suggestions based on question type and existing content
    if (existingAnswer) {
      return [
        "Additionally, I would like to mention...",
        "Another important point is...",
        "To expand on that...",
        "Furthermore..."
      ];
    } else {
      if (questionType.includes('experience') || questionType.includes('background')) {
        return [
          "I have been working in this field for...",
          "My experience includes...",
          "I started my journey when..."
        ];
      } else if (questionType.includes('challenge') || questionType.includes('problem')) {
        return [
          "One of the biggest challenges I faced was...",
          "The main obstacle was...",
          "I overcame this by..."
        ];
      } else if (questionType.includes('advice') || questionType.includes('recommend')) {
        return [
          "I would recommend...",
          "My advice would be to...",
          "The key is to..."
        ];
      } else {
        return [
          "In my opinion...",
          "From my experience...",
          "I believe that..."
        ];
      }
    }
  }, [currentQuestion]);

  // Show contextual suggestions when user is silent
  const showContextualSuggestions = useCallback(() => {
    if (!currentQuestion) return;

    actions.setFloatingSuggestions(contextualSuggestions);
    actions.setShowFloatingSuggestions(true);
  }, [currentQuestion, contextualSuggestions, actions]);

  // Handle floating suggestion click
  const handleFloatingSuggestionClick = (suggestion) => {
    // Add the suggestion to the current transcription
    const existingText = transcription.final || '';
    const separator = existingText ? (existingText.endsWith('.') || existingText.endsWith('!') || existingText.endsWith('?') ? ' ' : '. ') : '';
    const newText = existingText + separator + suggestion;
    
    actions.setTranscription({
      ...transcription,
      final: newText,
      current: suggestion
    });

    // Hide suggestions and continue listening
    actions.setShowFloatingSuggestions(false);
  };

  // Handle floating suggestions dismiss
  const handleFloatingSuggestionsDismiss = useCallback(() => {
    actions.setShowFloatingSuggestions(false);
  }, [actions]);
  
  // Track previous mute state to detect unmute events
  const prevIsTTSMutedRef = useRef(isTTSMuted);

  // TTS Mute toggle handler with persistence
  const handleTTSMuteToggle = useCallback(() => {
    setIsTTSMuted(prev => {
      const newValue = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('voiceInterview_ttsMuted', newValue.toString());
      }
      return newValue;
    });
  }, []);

  // Stop current speech when muting
  useEffect(() => {
    if (isTTSMuted && isAISpeaking) {
      try {
        audioManager.stopCurrentAudio();
        actions.setAISpeaking(false);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Failed to stop speech when muting:', error);
        }
      }
    }
  }, [isTTSMuted, isAISpeaking, actions]);

  // Speak AI question
  const speakQuestion = async (question) => {
    if (!audioEnabled || !question || isTTSMuted) {
      return; // Early return prevents Eleven Labs API calls when muted
    }

    try {
      const questionText = `${question.question}`;
      await audioManager.speakText(questionText, {
        priority: true,
        onStart: () => actions.setAISpeaking(true),
        onEnd: () => {
          actions.setAISpeaking(false);
        },
        onError: (error) => {
          actions.setAISpeaking(false);
          // Speech failed - log for debugging but don't show notification
          if (process.env.NODE_ENV === 'development') {
            console.log('Failed to speak question:', error);
          }
        }
      });
    } catch (error) {
      // Speech failed - log for debugging but don't show notification
      if (process.env.NODE_ENV === 'development') {
        console.log('Failed to speak question (catch):', error);
      }
    }
  };

  // Handle unmute event - speak current question when unmuting
  useEffect(() => {
    const wasUnmuted = prevIsTTSMutedRef.current && !isTTSMuted;
    
    if (wasUnmuted && currentQuestion && isInitialized && audioEnabled) {
      // Small delay to ensure state has fully updated
      const timeoutId = setTimeout(() => {
        speakQuestion(currentQuestion);
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
    
    // Update ref for next comparison
    prevIsTTSMutedRef.current = isTTSMuted;
  }, [isTTSMuted, currentQuestion, isInitialized, audioEnabled]);
  
  // Handle question change: only auto-speak when index changes and gate is enabled
  useEffect(() => {
    if (currentQuestion && isInitialized && audioEnabled) {
      // DO NOT auto-stop recording when question changes
      // User must manually stop recording if they want to
      // This allows continuous recording across multiple questions if desired
      
      // Initialize transcription with saved answer if available
      const savedAnswer = currentQuestion?.answer?.trim() || '';
      const savedConfidence = currentQuestion?.voiceResponse?.confidence || 0;
      actions.setTranscription({
        current: '',
        final: savedAnswer,
        interim: '',
        confidence: savedConfidence
      });

      // Reflect saved state for this question
      if (currentQuestion?.answered && savedAnswer) {
        actions.setSaveStatus('saved');
      } else {
        actions.setSaveStatus('idle');
      }
      // Hydrate last saved timestamp when returning to a question
      const savedTs = currentQuestion?.voiceResponse?.timestamp || null;
      actions.setLastSavedAt(savedTs);



      // Auto-speak question when changing to a new question
      if (autoSpeakOnQuestionChange) {
        speakQuestion(currentQuestion);
        actions.setAutoSpeakOnQuestionChange(false); // Reset the flag
      }
    }
  }, [currentQuestionIndex, isInitialized, audioEnabled, autoSpeakOnQuestionChange]);

  // Handle question text changes (regeneration, editing) - speak new question
  useEffect(() => {
    if (currentQuestion && isInitialized && audioEnabled) {
      // Only speak if question index didn't change (avoid duplicate speaking during navigation)
      if (lastQuestionIndexRef.current === currentQuestionIndex) {
        speakQuestion(currentQuestion);
      }
      // Update the ref to track the current index
      lastQuestionIndexRef.current = currentQuestionIndex;
    }
  }, [currentQuestion?.question, isInitialized, audioEnabled, currentQuestionIndex]);

  // Handle answer changes - reset transcription display
  useEffect(() => {
    if (currentQuestion && isInitialized) {
      // Reset transcription when answer changes
      const savedAnswer = currentQuestion?.answer?.trim() || '';
      const savedConfidence = currentQuestion?.voiceResponse?.confidence || 0;
      actions.setTranscription({
        current: '',
        final: savedAnswer,
        interim: '',
        confidence: savedConfidence
      });

      // Update save status based on new answer state
      if (currentQuestion?.answered && savedAnswer) {
        actions.setSaveStatus('saved');
      } else {
        actions.setSaveStatus('idle');
      }
    }
  }, [currentQuestion?.answer, isInitialized]);

  // Auto-speak the first question when interview initializes
  useEffect(() => {
    // Removed speaking logic - handled by question change effect to prevent duplicate speaking
    // if (isInitialized && audioEnabled && currentQuestion && currentQuestionIndex === 0) {
    //   setTimeout(() => {
    //     speakQuestion(currentQuestion);
    //   }, 1000);
    // }
  }, [isInitialized, audioEnabled, currentQuestionIndex]);
  

  


  
  // Handle audio controls
  const handleVolumeChange = (newVolume) => {
    audioManager.setVolume(newVolume);
  };
  
  const handleMute = (muted) => {
    audioManager.setMuted(muted);
  };
  



  
  // Handle navigation
  const handlePrevious = useCallback(async () => {
    if (isNavigating.current || saveStatus === 'saving') return;

    if (!topicQuestionOriginalIndices.length) {
      return;
    }

    let targetIndex = null;
    for (const idx of topicQuestionOriginalIndices) {
      if (idx >= currentQuestionIndex) {
        break;
      }
      targetIndex = idx;
    }

    if (targetIndex === null || targetIndex === undefined || targetIndex === currentQuestionIndex) {
      return;
    }

    isNavigating.current = true;

    try {
      timer.cancelByType(ACTION_TYPES.AUTO_SAVE);

      // DO NOT auto-stop recording when navigating - user must manually stop
      // Recording will continue even when moving to a new question
      actions.setAutoSpeakOnQuestionChange(true);

      if (onGoToQuestion) {
        onGoToQuestion(targetIndex);
      } else if (onQuestionChange) {
        onQuestionChange(targetIndex);
      } else if (onPreviousQuestion) {
        onPreviousQuestion();
      }
    } finally {
      setTimeout(() => {
        isNavigating.current = false;
      }, 500);
    }
  }, [
    actions,
    currentQuestionIndex,
    onGoToQuestion,
    onPreviousQuestion,
    onQuestionChange,
    saveStatus,
    stopListening,
    timer,
    topicQuestionOriginalIndices
  ]);
  
  const handleNext = useCallback(async () => {
    // Prevent rapid navigation clicks or navigation during save
    if (isNavigating.current || saveStatus === 'saving') return;
    isNavigating.current = true;

    try {
      // Cancel any pending auto-save timers first
      timer.cancelByType(ACTION_TYPES.AUTO_SAVE);

      if (currentQuestionIndex < questions.length - 1) {
        // DO NOT auto-stop recording when moving to next question
        // User must manually stop recording
        actions.setAutoSpeakOnQuestionChange(true);
        // Use the passed navigation function if available, otherwise use onQuestionChange
        if (onNextQuestion) {
          onNextQuestion();
        } else {
          onQuestionChange(currentQuestionIndex + 1);
        }
      } else {
        // Interview complete - DO NOT auto-stop recording
        // User can continue recording or manually stop
        onComplete();
      }
    } finally {
      // Reset navigation lock after a short delay
      setTimeout(() => {
        isNavigating.current = false;
      }, 500);
    }
  }, [currentQuestionIndex, questions.length, onNextQuestion, onQuestionChange, onComplete, saveStatus, timer]);



  
  const handleRepeatQuestion = () => {
    if (currentQuestion && audioEnabled) {
      // DO NOT auto-stop recording when repeating question
      // User must manually stop if they want to pause recording
      // Note: This means microphone may pick up the AI speaking the question
      speakQuestion(currentQuestion);
    }
  };
  
  // Loading state with consistent styling
  if (!isInitialized) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p className={styles.loadingText}>Initializing voice interview...</p>
        <div className={styles.loadingDetails}>
          <span>Setting up audio services...</span>
        </div>
      </div>
    );
  }
  
  // Error state with consistent styling and recovery options
  if (error && !audioEnabled) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>
          <div className={styles.errorIcon}>⚠️</div>
          <h3>Voice Interview Unavailable</h3>
          <p>{error}</p>
          <div className={styles.errorActions}>
            <button onClick={onSwitchToText} className={styles.primaryButton}>
              Continue with Text Interview
            </button>
            <button
              onClick={() => window.location.reload()}
              className={styles.secondaryButton}
            >
              Retry Voice Setup
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <VoiceInterviewStudio
      // Article and question data
      articleData={articleData}
      questions={questions}
      currentQuestionIndex={currentQuestionIndex}

      // New Intro/FAQ separation props
      introQuestions={introQuestions}
      topicQuestions={topicQuestions}
      introComplete={introComplete}
      showIntroSection={showIntroSection}
      onStartFAQs={handleStartFAQs}
      onToggleIntroVisibility={handleToggleIntroVisibility}
      answeredTopicCount={answeredTopicCount}
      totalTopicQuestions={totalTopicQuestions}
      currentTopicPosition={currentTopicPosition}
      canStartFAQs={canStartFAQs}
      
      // Navigation handlers
      onQuestionChange={onQuestionChange}
      onNextQuestion={handleNext}
      onPreviousQuestion={handlePrevious}
      // Answer management
      onAnswerSave={handleSaveAnswer}
      onAnswerChange={onAnswerChange}
      answers={answers}
      pendingAnswers={pendingAnswers}
      aiPreviewContext={aiPreviewContext}
      
      // Audio state
      isAISpeaking={isAISpeaking}
      isUserSpeaking={isUserSpeaking}
      audioEnabled={audioEnabled}
      volume={volume}
      isMuted={isMuted}
      
      // Recording state
      isListening={isListening}
      transcription={transcription}
      
      // Save status
      autoSaveStatus={autoSaveStatus}
      autoSaveError={autoSaveError}
      saveStatus={saveStatus}
      lastSavedAt={lastSavedAt}
      lastSavedTime={lastSavedTime}
      
      // Progress tracking (topic-centric)
      answeredCount={answeredCount}
      totalQuestions={totalQuestions}
      progress={topicProgress}
      
      // Mode switching
      onSwitchToText={onSwitchToText}
      
      // Modal state
      showQuestionsModal={showQuestionsModal}
      onToggleQuestionsModal={onToggleQuestionsModal}
      
      // Error handling
      error={error}
      isInitialized={isInitialized}
      
      // Additional handlers for studio integration
      onStartListening={startListening}
      onStopListening={stopListening}
      onRepeatQuestion={handleRepeatQuestion}
      onVolumeChange={handleVolumeChange}
      onMute={handleMute}
      
      // Manual save functions
      onManualSave={onManualSave}
      onManualSaveAll={onManualSaveAll}
      manualSaveStatus={manualSaveStatus}
      manualSaveError={manualSaveError}
      
      // Caption props
      captionText={captionText}
      isCaptionVisible={isCaptionVisible}
      
      // Floating suggestions
      showFloatingSuggestions={showFloatingSuggestions}
      floatingSuggestions={floatingSuggestions}
      onFloatingSuggestionClick={handleFloatingSuggestionClick}
      onFloatingSuggestionsDismiss={handleFloatingSuggestionsDismiss}
      
      // Regenerate question prop
      onRegenerateIntroQuestion={onRegenerateIntroQuestion}
      regeneratingQuestionIndex={regeneratingQuestionIndex}
      
      // Edit question prop
      onEditQuestion={onEditQuestion}
      isEditingQuestion={isEditingQuestion}
      editingQuestionIndex={editingQuestionIndex}
      
      // Delete question prop
      onDeleteQuestion={onDeleteQuestion}
      
      // Add topic question prop
      onAddTopicQuestion={onAddTopicQuestion}

      // Generate article prop
      onGenerateArticle={onGenerateArticle}
      
      // TTS Mute functionality
      isTTSMuted={isTTSMuted}
      onTTSMuteToggle={handleTTSMuteToggle}
    />
  );
};

export default React.memo(VoiceInterviewInterface);
