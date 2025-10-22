'use client';

import { useState } from 'react';
import { FaKeyboard, FaMicrophone, FaFileAlt, FaCheck, FaInfoCircle } from 'react-icons/fa';
import styles from './InterviewModeSelector.module.css';

const InterviewModeSelector = ({ 
  onModeSelect, 
  articleData = null, 
  isLoading = false,
  className = '' 
}) => {
  const [selectedMode, setSelectedMode] = useState(null);

  const handleModeSelect = (mode) => {
    setSelectedMode(mode);
    if (onModeSelect) {
      onModeSelect(mode);
    }
  };

  const modes = [
    {
      id: 'keyword',
      title: 'Keyword Article',
      icon: FaFileAlt,
      description: 'Generate comprehensive articles from keywords',
      benefits: [
        'AI-powered content creation',
        'AIO-optimized articles',
        'Quick generation',
        'Customizable topics'
      ],
      recommended: false
    },
    {
      id: 'text',
      title: 'Text Interview',
      icon: FaKeyboard,
      description: 'Type your responses at your own pace',
      benefits: [
        'Perfect for detailed, thoughtful answers',
        'Easy to edit and refine responses',
        'No audio equipment needed',
        'Works on any device'
      ],
      recommended: false
    },
    {
      id: 'voice',
      title: 'Voice Interview',
      icon: FaMicrophone,
      description: 'Have a natural conversation with AI',
      benefits: [
        'Natural, conversational experience',
        'Faster than typing',
        'AI follow-up questions',
        'Zoom-like interface',
      ],
      recommended: true
    }
  ];

  return (
    <div className={`${styles.modeSelector} ${className}`}>
      <div className={`${styles.header} text-center`}>
        <h2 className={`${styles.title} text-center`}>Choose Your Interview Style</h2>
        <p className={`${styles.subtitle} mb-5`}>
          Select how you&apos;d like to conduct your expert interview
        </p>
      </div>

      <div className={styles.modeOptions}>
        {modes.map((mode) => (
          <div
            key={mode.id}
            className={`${styles.modeCard} ${selectedMode === mode.id ? styles.selected : ''} ${isLoading ? styles.disabled : ''}`}
            onClick={() => !isLoading && handleModeSelect(mode.id)}
          >
            {mode.recommended && (
              <div className={styles.recommendedBadge}>
                Recommended
              </div>
            )}
            
            <div className={styles.modeHeader}>
              <mode.icon className={styles.modeIcon} />
              <h3 className={styles.modeTitle}>{mode.title}</h3>
            </div>
            
            <p className={styles.modeDescription}>{mode.description}</p>
            
            <ul className={styles.benefitsList}>
              {mode.benefits.map((benefit, index) => (
                <li key={index} className={styles.benefit}>
                  <FaCheck className={styles.checkmark} />
                  {benefit}
                </li>
              ))}
            </ul>

            <div className={styles.modeFooter}>
              <button
                className={`${styles.selectButton} ${
                  selectedMode === mode.id ? styles.selected : ''
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className={styles.spinner}></div>
                    Starting...
                  </>
                ) : selectedMode === mode.id ? (
                  'Selected ✓'
                ) : (
                  `Choose ${mode.title}`
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedMode && selectedMode !== 'keyword' && (
        <div className={styles.selectionInfo}>
          <div className={styles.infoCard}>
            <FaInfoCircle className={styles.infoIcon} />
            <div className={styles.infoContent}>
              <h4>
                {selectedMode === 'voice' ? 'Voice Interview Selected' : 'Text Interview Selected'}
              </h4>
              <p>
                {selectedMode === 'voice'
                  ? 'You\'ll have a natural conversation with an AI interviewer. Make sure your microphone is working and you\'re in a quiet environment.'
                  : 'You\'ll answer questions by typing your responses. Take your time to craft detailed, thoughtful answers.'
                }
              </p>
              {selectedMode === 'voice' && (
                <div className={styles.voiceRequirements}>
                  <h5>Requirements for voice interview:</h5>
                  <ul>
                    <li>Working microphone</li>
                    <li>Quiet environment</li>
                    <li>Modern browser (Chrome, Firefox, Safari)</li>
                    <li>Stable internet connection</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={styles.switchNote}>
        <span className={styles.noteIcon}>•</span>
        <span>You can switch between modes anytime during the interview</span>
      </div>
    </div>
  );
};

export default InterviewModeSelector;