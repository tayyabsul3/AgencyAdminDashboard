'use client';

import { useEffect, useState } from 'react';
import styles from './LoadingScreen.module.css';

const LoadingScreen = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Hide loading screen after a short delay
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loader}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>Loading...</p>
        </div>
      </div>
    );
  }

  return children;
};

export default LoadingScreen;