/**
 * Authentication Middleware for API Routes
 * Provides server-side authentication verification using Firebase Admin SDK
 */

import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin SDK
let adminApp;
try {
  if (getApps().length === 0) {
    // Initialize with service account credentials in production
    if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      adminApp = initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } else {
      // Development mode - use default credentials or emulator
      console.warn('Firebase Admin credentials not found, using default initialization');
      adminApp = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'queryfuel-f830f',
      });
    }
  } else {
    adminApp = getApps()[0];
  }
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

/**
 * Verify Firebase ID token using Admin SDK
 * @param {string} idToken - Firebase ID token
 * @returns {Promise<Object>} Decoded token with user info
 */
async function verifyIdToken(idToken) {
  if (!adminApp) {
    throw new Error('Firebase Admin not initialized');
  }

  try {
    const auth = getAuth(adminApp);
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Token verification error:', error);
    throw new Error('Invalid or expired token');
  }
}

/**
 * Middleware to require authentication for API routes
 * @param {Function} handler - The API route handler
 * @returns {Function} Wrapped handler with authentication
 */
export const withAuth = (handler) => {
  return async (req, res) => {
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

      const idToken = authHeader.split('Bearer ')[1];
      
      if (!idToken) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'auth/invalid-token',
            message: 'Invalid authentication token'
          }
        });
      }

      // Verify the token with Firebase Admin SDK
      let decodedToken;
      try {
        decodedToken = await verifyIdToken(idToken);
      } catch (error) {
        // In development, allow basic token validation as fallback
        if (process.env.NODE_ENV === 'development' && !process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
          console.warn('Using development token validation fallback');
          if (idToken.length < 10) {
            return res.status(401).json({
              success: false,
              error: {
                code: 'auth/invalid-token',
                message: 'Invalid token format'
              }
            });
          }
          
          // Mock decoded token for development
          decodedToken = {
            uid: 'dev-user-' + Date.now(),
            email: 'dev@example.com',
            email_verified: true,
            auth_time: Math.floor(Date.now() / 1000),
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
          };
        } else {
          return res.status(401).json({
            success: false,
            error: {
              code: 'auth/token-verification-failed',
              message: 'Token verification failed'
            }
          });
        }
      }

      // Validate token claims
      if (!decodedToken.uid || !decodedToken.email) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'auth/invalid-claims',
            message: 'Token missing required claims'
          }
        });
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (decodedToken.exp && decodedToken.exp < now) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'auth/token-expired',
            message: 'Authentication token has expired'
          }
        });
      }

      // Add verified user info to request object
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified || false,
        authTime: decodedToken.auth_time,
        token: idToken,
        claims: decodedToken
      };

      // Call the original handler
      return handler(req, res);
      
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
};

/**
 * Middleware to optionally check authentication (doesn't fail if not authenticated)
 * @param {Function} handler - The API route handler
 * @returns {Function} Wrapped handler with optional authentication
 */
export const withOptionalAuth = (handler) => {
  return async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        
        if (idToken && idToken.length >= 10) {
          try {
            // Try to verify the token
            const decodedToken = await verifyIdToken(idToken);
            req.user = {
              uid: decodedToken.uid,
              email: decodedToken.email,
              emailVerified: decodedToken.email_verified || false,
              authTime: decodedToken.auth_time,
              token: idToken,
              claims: decodedToken
            };
          } catch (error) {
            // In development, use fallback
            if (process.env.NODE_ENV === 'development' && !process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
              req.user = {
                uid: 'dev-user-optional',
                email: 'dev@example.com',
                emailVerified: true,
                token: idToken
              };
            }
            // Otherwise, continue without authentication
          }
        }
      }

      // Always call the handler, regardless of auth status
      return handler(req, res);
      
    } catch (error) {
      console.error('Optional auth middleware error:', error);
      // Continue without authentication on error
      return handler(req, res);
    }
  };
};

/**
 * Utility to extract user ID from request
 * @param {Request} req - Request object
 * @returns {string|null} User ID or null if not authenticated
 */
export const getUserIdFromRequest = (req) => {
  return req.user?.uid || null;
};

/**
 * Utility to check if request is authenticated
 * @param {Request} req - Request object
 * @returns {boolean} True if request is authenticated
 */
export const isRequestAuthenticated = (req) => {
  return !!req.user?.uid;
};

/**
 * Session management utilities
 */

/**
 * Check if user session is valid and not expired
 * @param {Object} user - User object from request
 * @returns {boolean} True if session is valid
 */
export const isSessionValid = (user) => {
  if (!user || !user.authTime) return false;
  
  const now = Math.floor(Date.now() / 1000);
  const sessionAge = now - user.authTime;
  const maxSessionAge = 24 * 60 * 60; // 24 hours
  
  return sessionAge < maxSessionAge;
};

/**
 * Check if user needs to re-authenticate
 * @param {Object} user - User object from request
 * @returns {boolean} True if re-authentication is needed
 */
export const needsReauth = (user) => {
  if (!user || !user.authTime) return true;
  
  const now = Math.floor(Date.now() / 1000);
  const sessionAge = now - user.authTime;
  const reauthThreshold = 60 * 60; // 1 hour for sensitive operations
  
  return sessionAge > reauthThreshold;
};

/**
 * Middleware for sensitive operations that require recent authentication
 * @param {Function} handler - The API route handler
 * @returns {Function} Wrapped handler with recent auth requirement
 */
export const withRecentAuth = (handler) => {
  return withAuth(async (req, res) => {
    if (needsReauth(req.user)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'auth/recent-auth-required',
          message: 'Recent authentication required for this operation'
        }
      });
    }
    
    return handler(req, res);
  });
};

/**
 * Validate user permissions for specific operations
 * @param {Object} user - User object from request
 * @param {string} operation - Operation being performed
 * @param {string} resourceUserId - User ID of the resource being accessed
 * @returns {boolean} True if user has permission
 */
export const hasPermission = (user, operation, resourceUserId = null) => {
  if (!user || !user.uid) return false;
  
  // Users can only access their own resources
  if (resourceUserId && user.uid !== resourceUserId) {
    return false;
  }
  
  // Check email verification for sensitive operations
  const sensitiveOperations = ['delete', 'export', 'share'];
  if (sensitiveOperations.includes(operation) && !user.emailVerified) {
    return false;
  }
  
  return true;
};

/**
 * Middleware to check user permissions
 * @param {string} operation - Operation being performed
 * @param {Function} getResourceUserId - Function to extract resource user ID from request
 * @returns {Function} Middleware function
 */
export const withPermission = (operation, getResourceUserId = null) => {
  return (handler) => {
    return withAuth(async (req, res) => {
      const resourceUserId = getResourceUserId ? getResourceUserId(req) : null;
      
      if (!hasPermission(req.user, operation, resourceUserId)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'auth/insufficient-permissions',
            message: 'Insufficient permissions for this operation'
          }
        });
      }
      
      return handler(req, res);
    });
  };
};

/**
 * Create standardized error response for authentication failures
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @returns {Object} Standardized error response
 */
export const createAuthError = (code, message) => {
  return {
    success: false,
    error: {
      code,
      message
    }
  };
};