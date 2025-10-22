/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree and displays fallback UI
 */

import React from 'react';
import styles from './ErrorBoundary.module.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Report error to monitoring service if available
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false
      });
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, retryCount } = this.state;
      const { fallback, showDetails = false } = this.props;

      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, this.handleRetry, this.handleReload);
      }

      return (
        <div className={styles.errorBoundary}>
          <div className={styles.errorContainer}>
            <div className={styles.errorIcon}>⚠️</div>
            <h2 className={styles.errorTitle}>Something went wrong</h2>
            <p className={styles.errorMessage}>
              We encountered an unexpected error. This has been logged and we&apos;ll look into it.
            </p>
            
            {showDetails && error && (
              <details className={styles.errorDetails}>
                <summary>Error Details</summary>
                <div className={styles.errorStack}>
                  <strong>Error:</strong> {error.toString()}
                  {errorInfo && (
                    <>
                      <br />
                      <strong>Component Stack:</strong>
                      <pre>{errorInfo.componentStack}</pre>
                    </>
                  )}
                </div>
              </details>
            )}

            <div className={styles.errorActions}>
              <button 
                className={styles.primaryButton}
                onClick={this.handleRetry}
                disabled={retryCount >= 3}
              >
                {retryCount >= 3 ? 'Max Retries Reached' : `Try Again ${retryCount > 0 ? `(${retryCount}/3)` : ''}`}
              </button>
              <button 
                className={styles.secondaryButton}
                onClick={this.handleReload}
              >
                Reload Page
              </button>
            </div>

            {retryCount >= 3 && (
              <p className={styles.maxRetriesMessage}>
                If the problem persists, please try refreshing the page or contact support.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;