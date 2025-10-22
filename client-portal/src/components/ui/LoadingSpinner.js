/**
 * Loading Spinner Component
 * Reusable loading spinner with different sizes and styles
 */

import React from 'react';
import styles from './LoadingSpinner.module.css';

const LoadingSpinner = ({ 
  size = 'medium', 
  color = 'primary', 
  text = null,
  overlay = false,
  className = ''
}) => {
  const spinnerClasses = [
    styles.spinner,
    styles[size],
    styles[color],
    className
  ].filter(Boolean).join(' ');

  const content = (
    <div className={styles.container}>
      <div className={spinnerClasses}>
        <div className={styles.circle}></div>
        <div className={styles.circle}></div>
        <div className={styles.circle}></div>
        <div className={styles.circle}></div>
      </div>
      {text && <div className={styles.text}>{text}</div>}
    </div>
  );

  if (overlay) {
    return (
      <div className={styles.overlay}>
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingSpinner;