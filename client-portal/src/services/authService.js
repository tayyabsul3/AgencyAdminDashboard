/**
 * Authentication Service
 * Provides centralized authentication utilities and middleware for protected operations
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * Get current authenticated user
 * @returns {Promise<User|null>} Current user or null if not authenticated
 */
export const getCurrentUser = () => {
  return new Promise((resolve) => {
    if (!auth) {
      console.error('Firebase auth not initialized');
      resolve(null);
      return;
    }

    // If user is already available, return immediately
    if (auth.currentUser !== undefined) {
      resolve(auth.currentUser);
      return;
    }

    // Wait for auth state to be determined
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

/**
 * Get current user's ID token for API authentication
 * @param {boolean} forceRefresh - Force token refresh
 * @returns {Promise<string|null>} ID token or null if not authenticated
 */
export const getCurrentUserToken = async (forceRefresh = false) => {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    
    return await user.getIdToken(forceRefresh);
  } catch (error) {
    console.error('Error getting user token:', error);
    return null;
  }
};

/**
 * Check if current user's token is expired and refresh if needed
 * @returns {Promise<string|null>} Fresh token or null if not authenticated
 */
export const ensureFreshToken = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    
    // Get token result with metadata
    const tokenResult = await user.getIdTokenResult();
    const now = new Date();
    const tokenExpiry = new Date(tokenResult.expirationTime);
    
    // Refresh if token expires within 5 minutes
    const shouldRefresh = (tokenExpiry.getTime() - now.getTime()) < (5 * 60 * 1000);
    
    if (shouldRefresh) {
      console.log('Refreshing expired token');
      return await user.getIdToken(true);
    }
    
    return tokenResult.token;
  } catch (error) {
    console.error('Error ensuring fresh token:', error);
    return null;
  }
};

/**
 * Require authentication - throws error if user is not authenticated
 * @returns {Promise<User>} Current authenticated user
 * @throws {AuthError} If user is not authenticated
 */
export const requireAuth = async () => {
  const user = await getCurrentUser();
  
  if (!user) {
    const error = new Error('Authentication required');
    error.code = 'auth/unauthenticated';
    error.name = 'AuthError';
    throw error;
  }
  
  return user;
};

/**
 * Check if user is currently authenticated
 * @returns {boolean} True if user is authenticated
 */
export const isAuthenticated = async () => {
  const user = await getCurrentUser();
  return !!user;
};

/**
 * Get user ID safely
 * @returns {Promise<string|null>} User ID or null if not authenticated
 */
export const getUserId = async () => {
  const user = await getCurrentUser();
  return user?.uid || null;
};

/**
 * Handle authentication state changes
 * @param {Function} callback - Callback function to handle auth state changes
 * @returns {Function} Unsubscribe function
 */
export const onAuthStateChange = (callback) => {
  if (!auth) {
    console.warn('Firebase auth not initialized');
    return () => {}; // Return empty unsubscribe function
  }
  
  return onAuthStateChanged(auth, callback);
};

/**
 * Authentication middleware for API routes
 * @param {Request} req - Request object
 * @param {Response} res - Response object
 * @param {Function} next - Next middleware function
 */
export const requireAuthMiddleware = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'auth/no-token',
          message: 'No authentication token provided'
        }
      });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token with Firebase Admin (this would need Firebase Admin SDK)
    // For now, we'll implement a basic check
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'auth/invalid-token',
          message: 'Invalid authentication token'
        }
      });
    }

    // In a real implementation, you would verify the token with Firebase Admin SDK
    // For now, we'll pass the token to the next middleware
    req.user = { token };
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(401).json({
      success: false,
      error: {
        code: 'auth/verification-failed',
        message: 'Token verification failed'
      }
    });
  }
};

/**
 * Client-side authentication guard for pages
 * @param {Function} WrappedComponent - Component to protect
 * @returns {Function} Protected component
 */
export const withAuth = (WrappedComponent) => {
  return function AuthenticatedComponent(props) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
      const checkAuth = async () => {
        try {
          const currentUser = await getCurrentUser();
          if (!currentUser) {
            router.push('/login');
            return;
          }
          setUser(currentUser);
        } catch (error) {
          console.error('Authentication check failed:', error);
          router.push('/login');
        } finally {
          setLoading(false);
        }
      };

      checkAuth();
    }, [router]);

    if (loading) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh' 
        }}>
          <div>Loading...</div>
        </div>
      );
    }

    if (!user) {
      return null; // Will redirect to login
    }

    return <WrappedComponent {...props} user={user} />;
  };
};

/**
 * Session management utilities
 */

/**
 * Set up automatic token refresh
 * @param {Function} onTokenRefresh - Callback when token is refreshed
 * @returns {Function} Cleanup function
 */
export const setupTokenRefresh = (onTokenRefresh = null) => {
  let refreshInterval;
  
  const startTokenRefresh = (user) => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    // Refresh token every 50 minutes (tokens expire after 1 hour)
    refreshInterval = setInterval(async () => {
      try {
        const freshToken = await user.getIdToken(true);
        if (onTokenRefresh) {
          onTokenRefresh(freshToken);
        }
        console.log('Token refreshed automatically');
      } catch (error) {
        console.error('Automatic token refresh failed:', error);
      }
    }, 50 * 60 * 1000); // 50 minutes
  };
  
  const stopTokenRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  };
  
  // Set up auth state listener
  const unsubscribe = onAuthStateChange((user) => {
    if (user) {
      startTokenRefresh(user);
    } else {
      stopTokenRefresh();
    }
  });
  
  // Return cleanup function
  return () => {
    stopTokenRefresh();
    unsubscribe();
  };
};

/**
 * Check if user session is still valid
 * @returns {Promise<boolean>} True if session is valid
 */
export const isSessionValid = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) return false;
    
    // Try to get a fresh token to verify session
    const token = await user.getIdToken(false);
    return !!token;
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
};

/**
 * Force user re-authentication
 * @returns {Promise<void>}
 */
export const forceReauth = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AuthError('No user to re-authenticate', 'auth/no-user');
    }
    
    // Force token refresh to validate session
    await user.getIdToken(true);
  } catch (error) {
    console.error('Re-authentication failed:', error);
    throw new AuthError('Re-authentication failed', 'auth/reauth-failed');
  }
};

/**
 * Get user session information
 * @returns {Promise<Object|null>} Session info or null
 */
export const getSessionInfo = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    
    const tokenResult = await user.getIdTokenResult();
    
    return {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      authTime: new Date(tokenResult.authTime),
      issuedAt: new Date(tokenResult.issuedAtTime),
      expiresAt: new Date(tokenResult.expirationTime),
      signInProvider: tokenResult.signInProvider,
      claims: tokenResult.claims
    };
  } catch (error) {
    console.error('Error getting session info:', error);
    return null;
  }
};



/**
 * Custom error class for authentication errors
 */
export class AuthError extends Error {
  constructor(message, code = 'auth/unknown') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}