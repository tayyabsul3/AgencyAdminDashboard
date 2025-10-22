/**
 * SuggestiveAnswers Component
 * 
 * Displays personalized conversation starters for voice interview questions
 * Features:
 * - Shows 3-4 suggestions based on expert background
 * - Click-to-speak functionality for suggestions
 * - Fade effect when user is speaking
 * - Prominent highlighting when user is silent
 * - Loading states and error handling
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './SuggestiveAnswers.module.css';
import { generateQuestionSuggestions } from '../../services/geminiService';
import { audioManager } from '../../services/audioManager';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorMessage from '../ui/ErrorMessage';

const SuggestiveAnswers = ({
  question,
  expertIntro,
  context = {},
  isUserSpeaking = false,
  isUserSilent = false,
  onSuggestionClick,
  onSuggestionSpeak,
  className = ''
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [speakingSuggestion, setSpeakingSuggestion] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Cache suggestions per question to avoid multiple generations
  const cacheRef = useRef(new Map()); // key: questionKey -> suggestions array
  const inflightKeyRef = useRef(null); // track current in-flight question key

  const questionKey = (question || '').trim();

  // Generate suggestions when question changes
  const generateSuggestions = useCallback(async () => {
    if (!question || !expertIntro) return;

    // If we already have suggestions cached for this question, use them and skip fetch
    if (cacheRef.current.has(questionKey)) {
      setSuggestions(cacheRef.current.get(questionKey));
      setError(null);
      setLoading(false);
      return;
    }

    // Prevent duplicate in-flight requests for the same question
    if (inflightKeyRef.current === questionKey) {
      return;
    }
    inflightKeyRef.current = questionKey;

    setLoading(true);
    setError(null);

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('Generating suggestions for question:', question.substring(0, 50) + '...');
      }
      
      const result = await generateQuestionSuggestions(question, expertIntro, context);
      
      if (result && result.suggestions && Array.isArray(result.suggestions)) {
        setSuggestions(result.suggestions);
        cacheRef.current.set(questionKey, result.suggestions);
        setRetryCount(0);
      } else {
        throw new Error('Invalid suggestions format received');
      }
    } catch (err) {
      console.error('Error generating suggestions:', err);
      setError(err.message || 'Failed to generate suggestions');
      
      // Provide fallback suggestions
      const fallbackSuggestions = [
        "Share a specific example from your experience",
        "Discuss the most important aspect to consider",
        "Explain your proven approach to this",
        "Describe a common mistake to avoid"
      ];
      setSuggestions(fallbackSuggestions);
      cacheRef.current.set(questionKey, fallbackSuggestions);
    } finally {
      setLoading(false);
      inflightKeyRef.current = null;
    }
  }, [question, expertIntro, questionKey, context]);

  // Generate suggestions only when user has enabled viewing them
  useEffect(() => {
    if (showSuggestions) {
      generateSuggestions();
    }
    // Only re-run when question changes or visibility toggles
  }, [showSuggestions, questionKey, generateSuggestions]);

  const handleToggleSuggestions = useCallback(() => {
    // Let the effect trigger generation once when shown; avoid immediate double-call here
    setShowSuggestions(prev => !prev);
  }, []);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion, index) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Suggestion clicked:', suggestion);
    }
    
    // Call parent callback if provided
    if (onSuggestionClick) {
      onSuggestionClick(suggestion, index);
    }
  }, [onSuggestionClick]);

  // Handle suggestion speak (text-to-speech)
  const handleSuggestionSpeak = useCallback(async (suggestion, index) => {
    if (speakingSuggestion !== null) {
      // Stop current speech
      audioManager.stopCurrentAudio();
      setSpeakingSuggestion(null);
      return;
    }

    try {
      setSpeakingSuggestion(index);
      
      // Speak the suggestion
      await audioManager.speakText(
        suggestion,
        () => {
          if (process.env.NODE_ENV === 'development') {
            console.log('Started speaking suggestion:', suggestion);
          }
        },
        () => {
          if (process.env.NODE_ENV === 'development') {
            console.log('Finished speaking suggestion');
          }
          setSpeakingSuggestion(null);
        },
        (error) => {
          console.error('Error speaking suggestion:', error);
          setSpeakingSuggestion(null);
        }
      );

      // Call parent callback if provided
      if (onSuggestionSpeak) {
        onSuggestionSpeak(suggestion, index);
      }
    } catch (error) {
      console.error('Error in suggestion speak:', error);
      setSpeakingSuggestion(null);
    }
  }, [speakingSuggestion, onSuggestionSpeak]);

  // Handle retry
  const handleRetry = useCallback(() => {
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1);
      generateSuggestions();
    }
  }, [retryCount, generateSuggestions]);

  // Don't render if no question or expert intro
  if (!question || !expertIntro) {
    return null;
  }

  return (
    <div className={`${styles.suggestiveAnswers} ${className}`}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>💡</div>
        <div className={styles.headerText}>
          <span className={styles.headerTitle}>Consider covering these points:</span>
          {loading && (
            <span className={styles.loadingText}>Generating suggestions...</span>
          )}
        </div>
        {/* Toggle visibility button */}
        <button 
          className={styles.retryButton}
          onClick={handleToggleSuggestions}
          title={showSuggestions ? 'Hide suggestions' : 'Show suggestions'}
        >
          {showSuggestions ? '🙈 Hide' : '✨ Show'}
        </button>
        {error && retryCount < 3 && showSuggestions && (
          <button 
            className={styles.retryButton}
            onClick={handleRetry}
            title="Retry generating suggestions"
          >
            🔄
          </button>
        )}
      </div>

      {showSuggestions && (
      <div className={`${styles.suggestionsContainer} ${isUserSpeaking ? styles.faded : ''} ${isUserSilent ? styles.highlighted : ''}`}>
        {loading && suggestions.length === 0 ? (
          <div className={styles.loadingContainer}>
            <LoadingSpinner size="small" />
            <span className={styles.loadingMessage}>Generating personalized suggestions...</span>
          </div>
        ) : error && suggestions.length === 0 ? (
          <div className={styles.errorContainer}>
            <ErrorMessage 
              message="Unable to generate suggestions"
              showRetry={retryCount < 3}
              onRetry={handleRetry}
            />
          </div>
        ) : (
          <div className={styles.suggestionsList}>
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className={`${styles.suggestion} ${speakingSuggestion === index ? styles.speaking : ''}`}
                onClick={() => handleSuggestionClick(suggestion, index)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSuggestionClick(suggestion, index);
                  }
                }}
              >
                <span className={styles.suggestionBullet}>•</span>
                <span className={styles.suggestionText}>{suggestion}</span>
                <button
                  className={`${styles.speakButton} ${speakingSuggestion === index ? styles.speaking : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSuggestionSpeak(suggestion, index);
                  }}
                  title={speakingSuggestion === index ? "Stop speaking" : "Speak this suggestion"}
                  aria-label={speakingSuggestion === index ? "Stop speaking" : "Speak this suggestion"}
                >
                  {speakingSuggestion === index ? '⏹️' : '🔊'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      <div className={styles.footer}>
        <span className={styles.footerNote}>
          These are conversation starters - speak naturally about your experience
        </span>
        {isUserSilent && (
          <span className={styles.silentPrompt}>
            💬 Take your time - click a suggestion for inspiration
          </span>
        )}
      </div>
    </div>
  );
};

export default SuggestiveAnswers;