/**
 * Protected Route Component
 * Wraps components that require authentication
 */

'use client';

import { useAuthGuard } from '../../hooks/useAuthGuard';

/**
 * Loading component for authentication checks
 */
const AuthLoadingSpinner = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f8fafc'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '4px solid #e2e8f0',
      borderTop: '4px solid #3b82f6',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }}></div>
    <p style={{
      marginTop: '16px',
      color: '#64748b',
      fontSize: '14px'
    }}>
      Verifying authentication...
    </p>
    <style jsx>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

/**
 * Error component for authentication failures
 */
const AuthError = ({ error, onRetry }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f8fafc',
    padding: '20px'
  }}>
    <div style={{
      backgroundColor: '#fee2e2',
      border: '1px solid #fecaca',
      borderRadius: '8px',
      padding: '20px',
      maxWidth: '400px',
      textAlign: 'center'
    }}>
      <h2 style={{
        color: '#dc2626',
        fontSize: '18px',
        marginBottom: '12px'
      }}>
        Authentication Error
      </h2>
      <p style={{
        color: '#7f1d1d',
        fontSize: '14px',
        marginBottom: '16px'
      }}>
        {error || 'An authentication error occurred'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      )}
    </div>
  </div>
);

/**
 * Protected Route Component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to protect
 * @param {string} props.redirectTo - Path to redirect to if not authenticated
 * @param {React.ComponentType} props.fallback - Custom loading component
 * @param {React.ComponentType} props.errorComponent - Custom error component
 * @returns {React.ReactNode} Protected component or loading/error state
 */
export const ProtectedRoute = ({ 
  children, 
  redirectTo = '/login',
  fallback: LoadingComponent = AuthLoadingSpinner,
  errorComponent: ErrorComponent = AuthError
}) => {
  const { user, loading, authError, isReady } = useAuthGuard({ 
    redirectTo,
    requireAuth: true 
  });

  // Show loading state while checking authentication
  if (loading || !isReady) {
    return <LoadingComponent />;
  }

  // Show error state if authentication failed
  if (authError) {
    return <ErrorComponent error={authError} />;
  }

  // Show nothing if user is not authenticated (will redirect)
  if (!user) {
    return null;
  }

  // Render protected content
  return children;
};

/**
 * Guest Route Component - for pages that should redirect authenticated users
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {string} props.redirectTo - Path to redirect authenticated users to
 * @returns {React.ReactNode} Component or loading state
 */
export const GuestRoute = ({ 
  children, 
  redirectTo = '/dashboard',
  fallback: LoadingComponent = AuthLoadingSpinner
}) => {
  const { user, loading, isReady } = useAuthGuard({ 
    redirectTo,
    requireAuth: false 
  });

  // Show loading state while checking authentication
  if (loading || !isReady) {
    return <LoadingComponent />;
  }

  // Show nothing if user is authenticated (will redirect)
  if (user) {
    return null;
  }

  // Render guest content
  return children;
};

export default ProtectedRoute;