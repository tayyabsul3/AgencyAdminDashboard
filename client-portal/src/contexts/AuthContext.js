'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChange, signIn, signUp, logOut, db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getCurrentUser, requireAuth } from '../services/authService';
import { useSubscription } from '../hooks/useSubscription';
import { getBrandVoiceSettingsWithDefaults, getDefaultBrandVoiceSettings } from '../services/userService';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [brandVoiceSettings, setBrandVoiceSettings] = useState(null);
  const [brandVoiceLoading, setBrandVoiceLoading] = useState(false);

  // Get subscription data for the current user
  const {
    subscription,
    loading: subscriptionLoading,
    error: subscriptionError,
    refetch: refetchSubscription,
    hasActiveSubscription,
    tier,
    billingCycle,
    currentPeriodEnd,
    credits: creditsInfo,
    creditsRemaining,
    creditsResetDate
  } = useSubscription(user?.uid);

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChange(async (user) => {
        setUser(user);
        setLoading(false);
        setAuthError(null);
        
        // Get session info when user changes
        if (user) {
          try {
            const tokenResult = await user.getIdTokenResult();
            setSessionInfo({
              uid: user.uid,
              email: user.email,
              emailVerified: user.emailVerified,
              authTime: new Date(tokenResult.authTime),
              issuedAt: new Date(tokenResult.issuedAtTime),
              expiresAt: new Date(tokenResult.expirationTime),
              signInProvider: tokenResult.signInProvider,
              claims: tokenResult.claims
            });
          } catch (error) {
            console.error('Error getting session info:', error);
            setSessionInfo(null);
          }
        } else {
          setSessionInfo(null);
        }
      });

      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    } catch (error) {
      console.error('Auth state change error:', error);
      setAuthError(error.message);
      setLoading(false);
    }
  }, []);

  // Set up automatic token refresh
  useEffect(() => {
    if (user) {
      let refreshInterval;
      
      const startTokenRefresh = () => {
        // Refresh token every 50 minutes (tokens expire after 1 hour)
        refreshInterval = setInterval(async () => {
          try {
            await user.getIdToken(true);
            console.log('Token refreshed automatically');
            
            // Update session info
            const tokenResult = await user.getIdTokenResult();
            setSessionInfo(prev => ({
              ...prev,
              issuedAt: new Date(tokenResult.issuedAtTime),
              expiresAt: new Date(tokenResult.expirationTime)
            }));
          } catch (error) {
            console.error('Automatic token refresh failed:', error);
            setAuthError('Session expired. Please log in again.');
          }
        }, 50 * 60 * 1000); // 50 minutes
      };
      
      startTokenRefresh();
      
      return () => {
        if (refreshInterval) {
          clearInterval(refreshInterval);
        }
      };
    }
  }, [user]);

  // Set up real-time listener for brand voice settings when user or tier changes
  useEffect(() => {
    let unsubscribeBrandVoice = null;

    const setupBrandVoiceListener = () => {
      if (user?.uid && tier) {
        setBrandVoiceLoading(true);
        
        // Set up real-time listener for user document
        const userRef = doc(db, 'email', user.uid);
        
        unsubscribeBrandVoice = onSnapshot(userRef, 
          (docSnapshot) => {
            try {
              if (docSnapshot.exists()) {
                const userData = docSnapshot.data();
                const existingSettings = userData.brandVoiceSettings || null;
                const defaultSettings = getDefaultBrandVoiceSettings(tier);

                let finalSettings;
                if (!existingSettings) {
                  finalSettings = defaultSettings;
                } else {
                  // Merge existing settings with defaults and tier limits
                  finalSettings = {
                    ...defaultSettings,
                    ...existingSettings,
                    // Enforce tier limits
                    preferredTerms: existingSettings.preferredTerms?.slice(0, defaultSettings.maxPreferredTerms) || [],
                    bannedPhrases: existingSettings.bannedPhrases?.slice(0, defaultSettings.maxBannedPhrases) || [],
                    defaultDisclaimer: defaultSettings.canUseDisclaimer ? (existingSettings.defaultDisclaimer || '') : '',
                    customInstructions: defaultSettings.canUseCustomInstructions ? (existingSettings.customInstructions || '') : '',
                    // Ensure industry is allowed for tier
                    industry: defaultSettings.availableIndustries.includes(existingSettings.industry) 
                      ? existingSettings.industry 
                      : 'general'
                  };
                }

                setBrandVoiceSettings(finalSettings);
                console.log('🔄 Brand voice settings updated via real-time listener:', finalSettings);
              } else {
                // User document doesn't exist, use defaults
                setBrandVoiceSettings(getDefaultBrandVoiceSettings(tier));
              }
            } catch (error) {
              console.error('Error processing brand voice settings update:', error);
              setBrandVoiceSettings(getDefaultBrandVoiceSettings(tier));
            } finally {
              setBrandVoiceLoading(false);
            }
          },
          (error) => {
            console.error('Error in brand voice settings listener:', error);
            setBrandVoiceSettings(getDefaultBrandVoiceSettings(tier));
            setBrandVoiceLoading(false);
          }
        );
      } else {
        setBrandVoiceSettings(null);
        setBrandVoiceLoading(false);
      }
    };

    setupBrandVoiceListener();

    // Cleanup function
    return () => {
      if (unsubscribeBrandVoice) {
        unsubscribeBrandVoice();
        console.log('🔌 Brand voice settings listener unsubscribed');
      }
    };
  }, [user?.uid, tier]);

  // Function to manually refresh brand voice settings (kept for backward compatibility)
  const refreshBrandVoiceSettings = async () => {
    if (user?.uid && tier) {
      setBrandVoiceLoading(true);
      try {
        const settings = await getBrandVoiceSettingsWithDefaults(user.uid, tier);
        setBrandVoiceSettings(settings);
        console.log('🔄 Brand voice settings manually refreshed:', settings);
      } catch (error) {
        console.error('Error refreshing brand voice settings:', error);
      } finally {
        setBrandVoiceLoading(false);
      }
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    return result;
  };

  const signup = async (email, password, name) => {
    setLoading(true);
    const result = await signUp(email, password, name);
    setLoading(false);
    return result;
  };

  const logout = async () => {
    setLoading(true);
    const result = await logOut();
    setUser(null);
    setLoading(false);
    return result;
  };

  // Enhanced authentication utilities
  const getCurrentUserSafe = async () => {
    try {
      return await getCurrentUser();
    } catch (error) {
      console.error('Error getting current user:', error);
      setAuthError(error.message);
      return null;
    }
  };

  const requireAuthSafe = async () => {
    try {
      return await requireAuth();
    } catch (error) {
      console.error('Authentication required error:', error);
      setAuthError(error.message);
      throw error;
    }
  };

  // Enhanced session management
  const isSessionExpired = () => {
    if (!sessionInfo || !sessionInfo.expiresAt) return false;
    return new Date() >= sessionInfo.expiresAt;
  };

  const getTimeUntilExpiry = () => {
    if (!sessionInfo || !sessionInfo.expiresAt) return null;
    const now = new Date();
    const expiry = sessionInfo.expiresAt;
    return Math.max(0, expiry.getTime() - now.getTime());
  };

  const refreshSession = async () => {
    if (!user) return null;
    
    try {
      const token = await user.getIdToken(true);
      const tokenResult = await user.getIdTokenResult();
      
      setSessionInfo({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        authTime: new Date(tokenResult.authTime),
        issuedAt: new Date(tokenResult.issuedAtTime),
        expiresAt: new Date(tokenResult.expirationTime),
        signInProvider: tokenResult.signInProvider,
        claims: tokenResult.claims
      });
      
      return token;
    } catch (error) {
      console.error('Session refresh failed:', error);
      setAuthError('Failed to refresh session');
      throw error;
    }
  };

  const value = {
    user,
    loading,
    authError,
    sessionInfo,
    login,
    signup,
    logout,
    getCurrentUser: getCurrentUserSafe,
    requireAuth: requireAuthSafe,
    isAuthenticated: !!user,
    userId: user?.uid || null,
    userEmail: user?.email || null,
    isSessionExpired,
    getTimeUntilExpiry,
    refreshSession,
    clearAuthError: () => setAuthError(null),
    // Subscription data
    subscription,
    subscriptionLoading,
    subscriptionError,
    refetchSubscription,
    hasActiveSubscription,
    subscriptionTier: tier,
    billingCycle,
    currentPeriodEnd,
    credits: creditsInfo?.total || 0,
    creditsUsed: creditsInfo?.used || 0,
    creditsRemaining: creditsInfo?.remaining || 0,
    creditsResetDate,
    // Brand voice data
    brandVoiceSettings,
    brandVoiceLoading,
    refreshBrandVoiceSettings
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};