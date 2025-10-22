/**
 * Progress Indicator Component
 * Shows progress with customizable styles and animations
 */

import React from 'react';
import styles from './ProgressIndicator.module.css';

const ProgressIndicator = ({
  progress = 0,
  size = 'medium',
  variant = 'linear',
  color = 'primary',
  showPercentage = true,
  showLabel = true,
  label = null,
  animated = true,
  className = ''
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  
  const containerClasses = [
    styles.container,
    styles[size],
    styles[variant],
    animated ? styles.animated : '',
    className
  ].filter(Boolean).join(' ');

  if (variant === 'circular') {
    const radius = size === 'small' ? 20 : size === 'large' ? 40 : 30;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

    return (
      <div className={containerClasses}>
        <div className={styles.circularProgress}>
          <svg 
            className={styles.circularSvg}
            width={radius * 2 + 10} 
            height={radius * 2 + 10}
          >
            <circle
              className={styles.circularTrack}
              cx={radius + 5}
              cy={radius + 5}
              r={radius}
              strokeWidth={size === 'small' ? 2 : size === 'large' ? 4 : 3}
            />
            <circle
              className={`${styles.circularFill} ${styles[color]}`}
              cx={radius + 5}
              cy={radius + 5}
              r={radius}
              strokeWidth={size === 'small' ? 2 : size === 'large' ? 4 : 3}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform={`rotate(-90 ${radius + 5} ${radius + 5})`}
            />
          </svg>
          {showPercentage && (
            <div className={styles.circularText}>
              {Math.round(clampedProgress)}%
            </div>
          )}
        </div>
        {(showLabel && label) && (
          <div className={styles.label}>{label}</div>
        )}
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      {(showLabel && label) && (
        <div className={styles.labelTop}>
          <span>{label}</span>
          {showPercentage && (
            <span className={styles.percentage}>{Math.round(clampedProgress)}%</span>
          )}
        </div>
      )}
      <div className={styles.progressBar}>
        <div className={styles.progressTrack}>
          <div 
            className={`${styles.progressFill} ${styles[color]}`}
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Step Progress Indicator
 * Shows progress through multiple steps
 */
export const StepProgress = ({
  steps = [],
  currentStep = 0,
  completedSteps = [],
  size = 'medium',
  orientation = 'horizontal',
  showLabels = true,
  className = ''
}) => {
  const containerClasses = [
    styles.stepContainer,
    styles[orientation],
    styles[size],
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(index) || index < currentStep;
        const isCurrent = index === currentStep;
        const isUpcoming = index > currentStep;

        const stepClasses = [
          styles.step,
          isCompleted ? styles.completed : '',
          isCurrent ? styles.current : '',
          isUpcoming ? styles.upcoming : ''
        ].filter(Boolean).join(' ');

        return (
          <div key={index} className={stepClasses}>
            <div className={styles.stepIndicator}>
              <div className={styles.stepCircle}>
                {isCompleted ? (
                  <svg className={styles.checkIcon} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <span className={styles.stepNumber}>{index + 1}</span>
                )}
              </div>
              {index < steps.length - 1 && (
                <div className={styles.stepConnector} />
              )}
            </div>
            {showLabels && (
              <div className={styles.stepLabel}>
                <div className={styles.stepTitle}>{step.title || `Step ${index + 1}`}</div>
                {step.description && (
                  <div className={styles.stepDescription}>{step.description}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Multi-Progress Indicator
 * Shows multiple progress bars stacked
 */
export const MultiProgress = ({
  items = [],
  size = 'medium',
  showLabels = true,
  className = ''
}) => {
  const containerClasses = [
    styles.multiContainer,
    styles[size],
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {items.map((item, index) => (
        <div key={index} className={styles.multiItem}>
          {showLabels && (
            <div className={styles.multiLabel}>
              <span>{item.label}</span>
              <span className={styles.multiValue}>
                {item.value || Math.round(item.progress)}%
              </span>
            </div>
          )}
          <ProgressIndicator
            progress={item.progress}
            color={item.color || 'primary'}
            size={size}
            showPercentage={false}
            showLabel={false}
            animated={item.animated !== false}
          />
        </div>
      ))}
    </div>
  );
};

export default ProgressIndicator;