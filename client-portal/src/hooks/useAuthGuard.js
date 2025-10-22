/**
 * Authentication Guard Hook
 * Provides authentication state management and protection for components
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentUser } from '../services/authService';

/**
 * Hook to protect pages that require authentication
 * @param {Object} options - Configuration options
 * @param {string} options.redirectTo - Path to redirect to if not authenticated (default: '/login')
 * @param {boolean} options.requireAuth - Whether authentication is required (default: true)
 * @returns {Object} Authentication state and utilities
 */
export const useAuthGuard = (options = {}) => {
  const {
    redirectTo = '/login',
    requireAuth = true
  } = options;

  const { user, loading } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        setIsChecking(true);
        setAuthError(null);

        // Wait for auth context to finish loading
        if (loading) {
          return;
        }

        // If authentication is required but user is not authenticated
        if (requireAuth && !user) {
          console.log('Authentication required, redirecting to:', redirectTo);
          router.push(redirectTo);
          return;
        }

        // Double-check with getCurrentUser for additional verification
        if (requireAuth) {
          const currentUser = await getCurrentUser();
          if (!currentUser) {
            console.log('User verification failed, redirecting to:', redirectTo);
            router.push(redirectTo);
            return;
          }
        }

      } catch (error) {
        console.error('Authentication guard error:', error);
        setAuthError(error.message);
        
        if (requireAuth) {
          router.push(redirectTo);
        }
      } finally {
        setIsChecking(false);
      }
    };

    checkAuthentication();
  }, [user, loading, requireAuth, redirectTo, router]);

  return {
    user,
    loading: loading || isChecking,
    isAuthenticated: !!user,
    authError,
    isReady: !loading && !isChecking
  };
};

/**
 * Hook for pages that should redirect authenticated users away
 * Useful for login/signup pages
 * @param {string} redirectTo - Path to redirect authenticated users to (default: '/dashboard')
 * @returns {Object} Authentication state
 */
export const useGuestGuard = (redirectTo = '/dashboard') => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        setIsChecking(true);

        // Wait for auth context to finish loading
        if (loading) {
          return;
        }

        // If user is authenticated, redirect them away
        if (user) {
          console.log('User already authenticated, redirecting to:', redirectTo);
          router.push(redirectTo);
          return;
        }

      } catch (error) {
        console.error('Guest guard error:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuthentication();
  }, [user, loading, redirectTo, router]);

  return {
    user,
    loading: loading || isChecking,
    isAuthenticated: !!user,
    isReady: !loading && !isChecking
  };
};

/**
 * Hook to get authentication status without redirects
 * @returns {Object} Authentication state
 */
export const useAuthStatus = () => {
  const { user, loading } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!loading) {
      setAuthChecked(true);
    }
  }, [loading]);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    authChecked,
    userId: user?.uid || null,
    userEmail: user?.email || null
  };
};