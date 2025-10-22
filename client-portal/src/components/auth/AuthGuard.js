/**
 * Comprehensive Authentication Guard Component
 * Provides complete authentication and authorization protection
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { requireAuth, isSessionValid } from '../../services/authService';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorMessage from '../ui/ErrorMessage';

/**
 * Authentication Guard Component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to protect
 * @param {string} props.redirectTo - Path to redirect to if not authenticated
 * @param {boolean} props.requireEmailVerification - Require email verification
 * @param {boolean} props.requireRecentAuth - Require recent authentication
 * @param {Array<string>} props.requiredClaims - Required custom claims
 * @param {Function} props.onAuthError - Custom auth error handler
 * @param {React.ComponentType} props.loadingComponent - Custom loading component
 * @param {React.ComponentType} props.errorComponent - Custom error component
 * @returns {React.ReactNode} Protected component or loading/error state
 */
export const AuthGuard = ({
  children,
  redirectTo = '/login',
  requireEmailVerification = false,
  requireRecentAuth = false,
  requiredClaims = [],
  onAuthError = null,
  loadingComponent: LoadingComponent = null,
  errorComponent: ErrorComponent = null
}) => {
  const { 
    user, 
    loading, 
    authError, 
    sessionInfo, 
    isSessionExpired, 
    refreshSession,
    clearAuthError 
  } = useAuth();
  const router = useRouter();
  
  const [authState, setAuthState] = useState({
    isChecking: true,
    isAuthorized: false,
    error: null,
    needsRedirect: false
  });

  // Comprehensive authentication check
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        setAuthState(prev => ({ ...prev, isChecking: true, error: null }));

        // Wait for auth context to finish loading
        if (loading) {
          return;
        }

        // Check if user is authenticated
        if (!user) {
          setAuthState({
            isChecking: false,
            isAuthorized: false,
            error: 'Authentication required',
            needsRedirect: true
          });
          return;
        }

        // Verify authentication with service
        try {
          await requireAuth();
        } catch (error) {
          setAuthState({
            isChecking: false,
            isAuthorized: false,
            error: error.message,
            needsRedirect: true
          });
          return;
        }

        // Check session validity
        const sessionValid = await isSessionValid();
        if (!sessionValid) {
          setAuthState({
            isChecking: false,
            isAuthorized: false,
            error: 'Session expired',
            needsRedirect: true
          });
          return;
        }

        // Check if session is expired
        if (isSessionExpired()) {
          try {
            await refreshSession();
          } catch (error) {
            setAuthState({
              isChecking: false,
              isAuthorized: false,
              error: 'Session refresh failed',
              needsRedirect: true
            });
            return;
          }
        }

        // Check email verification requirement
        if (requireEmailVerification && !user.emailVerified) {
          setAuthState({
            isChecking: false,
            isAuthorized: false,
            error: 'Email verification required',
            needsRedirect: false
          });
          return;
        }

        // Check recent authentication requirement
        if (requireRecentAuth && sessionInfo) {
          const now = new Date();
          const authTime = sessionInfo.authTime;
          const timeSinceAuth = now.getTime() - authTime.getTime();
          const oneHour = 60 * 60 * 1000;
          
          if (timeSinceAuth > oneHour) {
            setAuthState({
              isChecking: false,
              isAuthorized: false,
              error: 'Recent authentication required',
              needsRedirect: false
            });
            return;
          }
        }

        // Check required custom claims
        if (requiredClaims.length > 0 && sessionInfo?.claims) {
          const missingClaims = requiredClaims.filter(claim => 
            !sessionInfo.claims[claim]
          );
          
          if (missingClaims.length > 0) {
            setAuthState({
              isChecking: false,
              isAuthorized: false,
              error: `Missing required permissions: ${missingClaims.join(', ')}`,
              needsRedirect: false
            });
            return;
          }
        }

        // All checks passed
        setAuthState({
          isChecking: false,
          isAuthorized: true,
          error: null,
          needsRedirect: false
        });

      } catch (error) {
        console.error('Authentication guard error:', error);
        setAuthState({
          isChecking: false,
          isAuthorized: false,
          error: error.message,
          needsRedirect: true
        });
      }
    };

    checkAuthentication();
  }, [
    user, 
    loading, 
    requireEmailVerification, 
    requireRecentAuth, 
    requiredClaims, 
    sessionInfo,
    isSessionExpired,
    refreshSession
  ]);

  // Handle redirects
  useEffect(() => {
    if (authState.needsRedirect && !authState.isChecking) {
      if (onAuthError) {
        onAuthError(authState.error);
      } else {
        router.push(redirectTo);
      }
    }
  }, [authState.needsRedirect, authState.isChecking, authState.error, onAuthError, router, redirectTo]);

  // Show loading state
  if (authState.isChecking || loading) {
    if (LoadingComponent) {
      return <LoadingComponent />;
    }
    
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <LoadingSpinner size="large" />
        <p style={{
          marginTop: '16px',
          color: '#64748b',
          fontSize: '16px'
        }}>
          Verifying authentication...
        </p>
      </div>
    );
  }

  // Show error state
  if (authState.error && !authState.needsRedirect) {
    if (ErrorComponent) {
      return <ErrorComponent error={authState.error} />;
    }
    
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8fafc',
        padding: '20px'
      }}>
        <ErrorMessage
          title="Access Denied"
          message={authState.error}
          type="auth"
          size="large"
          actions={
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              {authState.error.includes('email verification') && (
                <button
                  onClick={async () => {
                    try {
                      await user.sendEmailVerification();
                      alert('Verification email sent!');
                    } catch (error) {
                      console.error('Error sending verification email:', error);
                    }
                  }}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px 20px',
                    cursor: 'pointer'
                  }}
                >
                  Resend Verification Email
                </button>
              )}
              {authState.error.includes('recent authentication') && (
                <button
                  onClick={() => router.push('/login?reauth=true')}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px 20px',
                    cursor: 'pointer'
                  }}
                >
                  Re-authenticate
                </button>
              )}
              <button
                onClick={() => {
                  clearAuthError();
                  router.push('/dashboard');
                }}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  cursor: 'pointer'
                }}
              >
                Go to Dashboard
              </button>
            </div>
          }
        />
      </div>
    );
  }

  // Show nothing if redirecting
  if (authState.needsRedirect) {
    return null;
  }

  // Show protected content
  if (authState.isAuthorized) {
    return children;
  }

  // Fallback
  return null;
};

/**
 * Higher-order component for authentication protection
 * @param {React.ComponentType} WrappedComponent - Component to protect
 * @param {Object} guardOptions - AuthGuard options
 * @returns {React.ComponentType} Protected component
 */
export const withAuthGuard = (WrappedComponent, guardOptions = {}) => {
  return function AuthGuardedComponent(props) {
    return (
      <AuthGuard {...guardOptions}>
        <WrappedComponent {...props} />
      </AuthGuard>
    );
  };
};

export default AuthGuard;