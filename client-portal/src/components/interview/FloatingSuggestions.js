'use client';

import React, { useState, useEffect } from 'react';
import styles from './FloatingSuggestions.module.css';

const FloatingSuggestions = ({
  suggestions = [],
  isVisible = false,
  onSuggestionClick,
  onDismiss,
  className = '',
  ...props
}) => {
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Cycle through suggestions every 3 seconds when visible
  useEffect(() => {
    if (isVisible && suggestions.length > 1) {
      const interval = setInterval(() => {
        setIsAnimating(true);
        setTimeout(() => {
          setCurrentSuggestionIndex(prev => (prev + 1) % suggestions.length);
          setIsAnimating(false);
        }, 300);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [isVisible, suggestions.length]);

  // Reset index when suggestions change
  useEffect(() => {
    setCurrentSuggestionIndex(0);
  }, [suggestions]);

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    if (isVisible) {
      const dismissTimer = setTimeout(() => {
        if (onDismiss) {
          onDismiss();
        }
      }, 10000);

      return () => clearTimeout(dismissTimer);
    }
  }, [isVisible, onDismiss]);

  if (!isVisible || suggestions.length === 0) {
    return null;
  }

  const currentSuggestion = suggestions[currentSuggestionIndex];

  const handleSuggestionClick = () => {
    if (onSuggestionClick) {
      onSuggestionClick(currentSuggestion);
    }
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <div className={`${styles.floatingSuggestions} ${className}`} {...props}>
      <div className={styles.suggestionCard}>
        <div className={styles.suggestionHeader}>
          <div className={styles.suggestionIcon}>💡</div>
          <span className={styles.suggestionLabel}>Try saying...</span>
          <button 
            className={styles.dismissButton}
            onClick={handleDismiss}
            aria-label="Dismiss suggestion"
          >
            ✕
          </button>
        </div>
        
        <div className={styles.suggestionContent}>
          <button
            className={`${styles.suggestionText} ${isAnimating ? styles.animating : ''}`}
            onClick={handleSuggestionClick}
          >
            "{currentSuggestion}"
          </button>
        </div>
        
        {suggestions.length > 1 && (
          <div className={styles.suggestionIndicators}>
            {suggestions.map((_, index) => (
              <div
                key={index}
                className={`${styles.indicator} ${
                  index === currentSuggestionIndex ? styles.active : ''
                }`}
              />
            ))}
          </div>
        )}
        
        <div className={styles.suggestionFooter}>
          <span className={styles.hintText}>Click to use this suggestion</span>
        </div>
      </div>
    </div>
  );
};

export default FloatingSuggestions;