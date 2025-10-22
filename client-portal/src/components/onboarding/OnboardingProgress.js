import React from 'react';
import styles from './OnboardingProgress.module.css';

const OnboardingProgress = ({ currentStep, totalSteps, stepTitle }) => {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.stepCounter}>
          Step {currentStep + 1} of {totalSteps}
        </span>
        <span className={styles.percentage}>
          {Math.round(progress)}%
        </span>
      </div>
      
      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {stepTitle && (
        <div className={styles.stepTitle}>
          {stepTitle}
        </div>
      )}
    </div>
  );
};

export default OnboardingProgress;