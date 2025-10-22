import React from 'react';
import { getErrorBoundaryProps } from '../utils/wordpressConnectionErrors';

/**
 * Error display component for WordPress connection errors
 * @param {Object} props - Component props
 * @param {Error} props.error - The error to display
 * @param {Function} props.onRetry - Retry callback function
 * @param {Function} props.onDismiss - Dismiss callback function
 * @param {string} props.context - Context where the error occurred
 */
export const WordPressConnectionErrorDisplay = ({ 
  error, 
  onRetry, 
  onDismiss, 
  context = 'WordPress Connection' 
}) => {
  if (!error) return null;

  const errorProps = getErrorBoundaryProps(error, onRetry, onDismiss);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#ef4444'; // red-500
      case 'medium': return '#f59e0b'; // amber-500
      case 'low': return '#3b82f6'; // blue-500
      default: return '#6b7280'; // gray-500
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high': return '🚨';
      case 'medium': return '⚠️';
      case 'low': return 'ℹ️';
      default: return '📝';
    }
  };

  return (
    <div style={{
      background: 'rgba(239, 68, 68, 0.1)',
      border: `1px solid ${getSeverityColor(errorProps.severity)}`,
      borderRadius: '8px',
      padding: '1rem',
      margin: '1rem 0',
      color: 'white'
    }}>
      {/* Error Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.75rem'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.2rem' }}>
            {getSeverityIcon(errorProps.severity)}
          </span>
          <h4 style={{
            color: getSeverityColor(errorProps.severity),
            margin: 0,
            fontSize: '1rem',
            fontWeight: '600'
          }}>
            {errorProps.title}
          </h4>
        </div>
        
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0.25rem'
            }}
            onMouseEnter={(e) => e.target.style.color = 'white'}
            onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.6)'}
          >
            ✕
          </button>
        )}
      </div>

      {/* Error Message */}
      <p style={{
        margin: '0 0 1rem 0',
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: '1.5'
      }}>
        {errorProps.message}
      </p>

      {/* Recovery Suggestions */}
      {errorProps.recovery && errorProps.recovery.length > 0 && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '6px',
          padding: '0.75rem',
          marginBottom: '1rem'
        }}>
          <h5 style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'rgba(255, 255, 255, 0.9)'
          }}>
            Try these solutions:
          </h5>
          <ul style={{
            margin: 0,
            paddingLeft: '1.25rem',
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '0.875rem'
          }}>
            {errorProps.recovery.map((suggestion, index) => (
              <li key={index} style={{ marginBottom: '0.25rem' }}>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center'
      }}>
        {errorProps.canRetry && onRetry && (
          <button
            onClick={onRetry}
            style={{
              background: getSeverityColor(errorProps.severity),
              border: 'none',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.opacity = '0.8'}
            onMouseLeave={(e) => e.target.style.opacity = '1'}
          >
            Try Again
          </button>
        )}

        {errorProps.requiresAuth && (
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'transparent',
              border: `1px solid ${getSeverityColor(errorProps.severity)}`,
              color: getSeverityColor(errorProps.severity),
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = getSeverityColor(errorProps.severity);
              e.target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.color = getSeverityColor(errorProps.severity);
            }}
          >
            Sign In Again
          </button>
        )}

        <span style={{
          fontSize: '0.75rem',
          color: 'rgba(255, 255, 255, 0.5)',
          marginLeft: 'auto'
        }}>
          {errorProps.timestamp}
        </span>
      </div>
    </div>
  );
};

/**
 * Inline error message component for form fields
 * @param {Object} props - Component props
 * @param {string} props.message - Error message to display
 * @param {string} props.severity - Error severity (high, medium, low)
 */
export const InlineErrorMessage = ({ message, severity = 'medium' }) => {
  if (!message) return null;

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginTop: '0.5rem',
      padding: '0.5rem',
      background: `rgba(${severity === 'high' ? '239, 68, 68' : severity === 'medium' ? '245, 158, 11' : '59, 130, 246'}, 0.1)`,
      border: `1px solid ${getSeverityColor(severity)}`,
      borderRadius: '4px',
      fontSize: '0.875rem',
      color: getSeverityColor(severity)
    }}>
      <span>⚠️</span>
      <span>{message}</span>
    </div>
  );
};

/**
 * Success message component
 * @param {Object} props - Component props
 * @param {string} props.message - Success message to display
 * @param {Function} props.onDismiss - Dismiss callback function
 */
export const SuccessMessage = ({ message, onDismiss }) => {
  if (!message) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'rgba(34, 197, 94, 0.1)',
      border: '1px solid #22c55e',
      borderRadius: '6px',
      padding: '0.75rem',
      margin: '0.5rem 0',
      color: '#22c55e',
      fontSize: '0.875rem'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span>✅</span>
        <span>{message}</span>
      </div>
      
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#22c55e',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: '0.25rem'
          }}
          onMouseEnter={(e) => e.target.style.opacity = '0.7'}
          onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
          ✕
        </button>
      )}
    </div>
  );
};