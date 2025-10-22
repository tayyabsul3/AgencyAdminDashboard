import { useReducer, useCallback } from 'react';

// Action types for voice interview state management
export const VOICE_ACTIONS = {
  // Audio actions
  SET_AI_SPEAKING: 'SET_AI_SPEAKING',
  SET_USER_SPEAKING: 'SET_USER_SPEAKING',
  SET_AUDIO_ENABLED: 'SET_AUDIO_ENABLED',
  SET_VOLUME: 'SET_VOLUME',
  SET_MUTED: 'SET_MUTED',
  
  // Speech recognition actions
  SET_LISTENING: 'SET_LISTENING',
  UPDATE_TRANSCRIPTION: 'UPDATE_TRANSCRIPTION',
  SET_TRANSCRIPTION: 'SET_TRANSCRIPTION',
  RESET_TRANSCRIPTION: 'RESET_TRANSCRIPTION',
  
  // Caption actions
  SET_CAPTION_TEXT: 'SET_CAPTION_TEXT',
  SET_CAPTION_VISIBLE: 'SET_CAPTION_VISIBLE',
  
  // UI state actions
  SET_INITIALIZED: 'SET_INITIALIZED',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERRORS: 'CLEAR_ERRORS',
  
  // Auto-speak actions
  SET_AUTO_SPEAK_ON_QUESTION_CHANGE: 'SET_AUTO_SPEAK_ON_QUESTION_CHANGE',
  
  // Save state actions
  SET_SAVE_STATUS: 'SET_SAVE_STATUS',
  SET_LAST_SAVED_AT: 'SET_LAST_SAVED_AT',
  
  // Floating suggestions actions
  SET_SHOW_FLOATING_SUGGESTIONS: 'SET_SHOW_FLOATING_SUGGESTIONS',
  SET_FLOATING_SUGGESTIONS: 'SET_FLOATING_SUGGESTIONS',
  HIDE_FLOATING_SUGGESTIONS: 'HIDE_FLOATING_SUGGESTIONS',
  
  // Batch actions for performance
  BATCH_AUDIO_UPDATE: 'BATCH_AUDIO_UPDATE',
  BATCH_SPEECH_UPDATE: 'BATCH_SPEECH_UPDATE',
  BATCH_UI_UPDATE: 'BATCH_UI_UPDATE'
};

// Initial state structure
const initialState = {
  // Audio state
  audio: {
    isAISpeaking: false,
    isUserSpeaking: false,
    enabled: true,
    volume: 80,
    muted: false
  },
  
  // Speech recognition state
  speech: {
    isListening: false,
    transcription: {
      current: '',
      final: '',
      interim: '',
      confidence: 0
    }
  },
  
  // Caption state
  captions: {
    text: '',
    visible: false
  },
  
  // UI state
  ui: {
    isInitialized: false,
    error: null,
    autoSpeakOnQuestionChange: false
  },
  
  // Save state
  save: {
    status: 'idle', // idle | saving | saved | error
    lastSavedAt: null
  },
  
  // Floating suggestions state
  suggestions: {
    show: false,
    items: []
  }
};

// Reducer function with optimized state updates
function voiceInterviewReducer(state, action) {
  switch (action.type) {
    // Audio actions
    case VOICE_ACTIONS.SET_AI_SPEAKING:
      return {
        ...state,
        audio: { ...state.audio, isAISpeaking: action.payload }
      };
      
    case VOICE_ACTIONS.SET_USER_SPEAKING:
      return {
        ...state,
        audio: { ...state.audio, isUserSpeaking: action.payload }
      };
      
    case VOICE_ACTIONS.SET_AUDIO_ENABLED:
      return {
        ...state,
        audio: { ...state.audio, enabled: action.payload }
      };
      
    case VOICE_ACTIONS.SET_VOLUME:
      return {
        ...state,
        audio: { ...state.audio, volume: action.payload }
      };
      
    case VOICE_ACTIONS.SET_MUTED:
      return {
        ...state,
        audio: { ...state.audio, muted: action.payload }
      };
      
    // Speech recognition actions
    case VOICE_ACTIONS.SET_LISTENING:
      return {
        ...state,
        speech: { ...state.speech, isListening: action.payload }
      };
      
    case VOICE_ACTIONS.UPDATE_TRANSCRIPTION:
      return {
        ...state,
        speech: {
          ...state.speech,
          transcription: { ...state.speech.transcription, ...action.payload }
        }
      };
      
    case VOICE_ACTIONS.SET_TRANSCRIPTION:
      return {
        ...state,
        speech: { ...state.speech, transcription: action.payload }
      };
      
    case VOICE_ACTIONS.RESET_TRANSCRIPTION:
      return {
        ...state,
        speech: {
          ...state.speech,
          transcription: { current: '', final: '', interim: '', confidence: 0 }
        }
      };
      
    // Caption actions
    case VOICE_ACTIONS.SET_CAPTION_TEXT:
      return {
        ...state,
        captions: { ...state.captions, text: action.payload }
      };
      
    case VOICE_ACTIONS.SET_CAPTION_VISIBLE:
      return {
        ...state,
        captions: { ...state.captions, visible: action.payload }
      };
      
    // UI state actions
    case VOICE_ACTIONS.SET_INITIALIZED:
      return {
        ...state,
        ui: { ...state.ui, isInitialized: action.payload }
      };
      
    case VOICE_ACTIONS.SET_ERROR:
      return {
        ...state,
        ui: { ...state.ui, error: action.payload }
      };
      
    case VOICE_ACTIONS.CLEAR_ERRORS:
      return {
        ...state,
        ui: { ...state.ui, error: null }
      };
      
    case VOICE_ACTIONS.SET_AUTO_SPEAK_ON_QUESTION_CHANGE:
      return {
        ...state,
        ui: { ...state.ui, autoSpeakOnQuestionChange: action.payload }
      };
      
    // Save state actions
    case VOICE_ACTIONS.SET_SAVE_STATUS:
      return {
        ...state,
        save: { ...state.save, status: action.payload }
      };
      
    case VOICE_ACTIONS.SET_LAST_SAVED_AT:
      return {
        ...state,
        save: { ...state.save, lastSavedAt: action.payload }
      };
      
    // Floating suggestions actions
    case VOICE_ACTIONS.SET_SHOW_FLOATING_SUGGESTIONS:
      return {
        ...state,
        suggestions: { ...state.suggestions, show: action.payload }
      };
      
    case VOICE_ACTIONS.SET_FLOATING_SUGGESTIONS:
      return {
        ...state,
        suggestions: { ...state.suggestions, items: action.payload }
      };
      
    case VOICE_ACTIONS.HIDE_FLOATING_SUGGESTIONS:
      return {
        ...state,
        suggestions: { show: false, items: [] }
      };
      
    // Batch actions for performance optimization
    case VOICE_ACTIONS.BATCH_AUDIO_UPDATE:
      return {
        ...state,
        audio: { ...state.audio, ...action.payload }
      };
      
    case VOICE_ACTIONS.BATCH_SPEECH_UPDATE:
      return {
        ...state,
        speech: { ...state.speech, ...action.payload }
      };
      
    case VOICE_ACTIONS.BATCH_UI_UPDATE:
      return {
        ...state,
        ui: { ...state.ui, ...action.payload }
      };
      
    default:
      return state;
  }
}

// Custom hook for voice interview state management
export function useVoiceInterviewState() {
  const [state, dispatch] = useReducer(voiceInterviewReducer, initialState);
  
  // Action creators for better developer experience and performance
  const actions = {
    // Audio actions
    setAISpeaking: useCallback((speaking) => 
      dispatch({ type: VOICE_ACTIONS.SET_AI_SPEAKING, payload: speaking }), []),
    setUserSpeaking: useCallback((speaking) => 
      dispatch({ type: VOICE_ACTIONS.SET_USER_SPEAKING, payload: speaking }), []),
    setAudioEnabled: useCallback((enabled) => 
      dispatch({ type: VOICE_ACTIONS.SET_AUDIO_ENABLED, payload: enabled }), []),
    setVolume: useCallback((volume) => 
      dispatch({ type: VOICE_ACTIONS.SET_VOLUME, payload: volume }), []),
    setMuted: useCallback((muted) => 
      dispatch({ type: VOICE_ACTIONS.SET_MUTED, payload: muted }), []),
    
    // Speech recognition actions
    setListening: useCallback((listening) => 
      dispatch({ type: VOICE_ACTIONS.SET_LISTENING, payload: listening }), []),
    updateTranscription: useCallback((updates) => 
      dispatch({ type: VOICE_ACTIONS.UPDATE_TRANSCRIPTION, payload: updates }), []),
    setTranscription: useCallback((transcription) => 
      dispatch({ type: VOICE_ACTIONS.SET_TRANSCRIPTION, payload: transcription }), []),
    resetTranscription: useCallback(() => 
      dispatch({ type: VOICE_ACTIONS.RESET_TRANSCRIPTION }), []),
    
    // Caption actions
    setCaptionText: useCallback((text) => 
      dispatch({ type: VOICE_ACTIONS.SET_CAPTION_TEXT, payload: text }), []),
    setCaptionVisible: useCallback((visible) => 
      dispatch({ type: VOICE_ACTIONS.SET_CAPTION_VISIBLE, payload: visible }), []),
    
    // UI state actions
    setInitialized: useCallback((initialized) => 
      dispatch({ type: VOICE_ACTIONS.SET_INITIALIZED, payload: initialized }), []),
    setError: useCallback((error) => 
      dispatch({ type: VOICE_ACTIONS.SET_ERROR, payload: error }), []),
    clearErrors: useCallback(() => 
      dispatch({ type: VOICE_ACTIONS.CLEAR_ERRORS }), []),
    setAutoSpeakOnQuestionChange: useCallback((autoSpeak) => 
      dispatch({ type: VOICE_ACTIONS.SET_AUTO_SPEAK_ON_QUESTION_CHANGE, payload: autoSpeak }), []),
    
    // Save state actions
    setSaveStatus: useCallback((status) => 
      dispatch({ type: VOICE_ACTIONS.SET_SAVE_STATUS, payload: status }), []),
    setLastSavedAt: useCallback((timestamp) => 
      dispatch({ type: VOICE_ACTIONS.SET_LAST_SAVED_AT, payload: timestamp }), []),
    
    // Floating suggestions actions
    setShowFloatingSuggestions: useCallback((show) => 
      dispatch({ type: VOICE_ACTIONS.SET_SHOW_FLOATING_SUGGESTIONS, payload: show }), []),
    setFloatingSuggestions: useCallback((suggestions) => 
      dispatch({ type: VOICE_ACTIONS.SET_FLOATING_SUGGESTIONS, payload: suggestions }), []),
    hideFloatingSuggestions: useCallback(() => 
      dispatch({ type: VOICE_ACTIONS.HIDE_FLOATING_SUGGESTIONS }), []),
    
    // Batch actions for performance
    batchAudioUpdate: useCallback((updates) => 
      dispatch({ type: VOICE_ACTIONS.BATCH_AUDIO_UPDATE, payload: updates }), []),
    batchSpeechUpdate: useCallback((updates) => 
      dispatch({ type: VOICE_ACTIONS.BATCH_SPEECH_UPDATE, payload: updates }), []),
    batchUIUpdate: useCallback((updates) => 
      dispatch({ type: VOICE_ACTIONS.BATCH_UI_UPDATE, payload: updates }), [])
  };
  
  return { state, actions, dispatch };
}

export default useVoiceInterviewState;