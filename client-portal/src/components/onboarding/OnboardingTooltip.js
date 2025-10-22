import React from 'react';
import styles from './OnboardingTooltip.module.css';

const OnboardingTooltip = ({ targetElement, step, onNext }) => {
  if (!step) return null;

  // For welcome step (no target element), show centered modal
  const isWelcomeStep = step.type === 'welcome' || !targetElement;
  const tooltipStyle = isWelcomeStep 
    ? getTooltipPosition(null, 'center')
    : getTooltipPosition(targetElement, step.tooltip?.position || 'bottom');

  return (
    <div 
      className={`${styles.tooltip} ${styles[step.tooltip?.position || 'bottom']} onboarding-tooltip`}
      style={tooltipStyle}
    >
      <div className={styles.content}>
        <h3 className={styles.title}>{step.title}</h3>
        <p className={styles.description}>{step.tooltip?.text || step.description}</p>
        
        {step.type === 'input' && step.suggestions && (
          <div className={styles.suggestions}>
            <p className={styles.suggestionsLabel}>Try these topics:</p>
            <div className={styles.suggestionsList}>
              {step.suggestions.slice(0, 3).map((suggestion, index) => (
                <span key={index} className={styles.suggestion}>
                  {suggestion}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {step.type === 'welcome' && (
          <button 
            className={styles.startButton}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNext();
            }}
          >
            Let's Start! 🚀
          </button>
        )}
        
        {step.type === 'completion' && (
          <button 
            className={styles.startButton}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNext();
            }}
          >
            Got it! 🎉
          </button>
        )}
      </div>
      
      {step.tooltip?.showPulse && (
        <div className={styles.pulseIndicator}>
          <div className={styles.pulse}></div>
        </div>
      )}
    </div>
  );
};

const getTooltipPosition = (element, position) => {
  // For center position (welcome modal), return center positioning
  if (position === 'center' || !element) {
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }
  
  const rect = element.getBoundingClientRect();
  const tooltipWidth = 280;
  const tooltipHeight = 120;
  const offset = 16;
  
  const positions = {
    top: {
      left: rect.left + (rect.width / 2) - (tooltipWidth / 2),
      top: rect.top - tooltipHeight - offset,
    },
    bottom: {
      left: rect.left + (rect.width / 2) - (tooltipWidth / 2),
      top: rect.bottom + offset,
    },
    left: {
      left: rect.left - tooltipWidth - offset,
      top: rect.top + (rect.height / 2) - (tooltipHeight / 2),
    },
    right: {
      left: rect.right + offset,
      top: rect.top + (rect.height / 2) - (tooltipHeight / 2),
    }
  };
  
  return positions[position] || positions.bottom;
};

export default OnboardingTooltip;