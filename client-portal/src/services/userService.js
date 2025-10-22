import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, onSnapshot, arrayUnion, addDoc, collection } from 'firebase/firestore';

/**
 * Get user profile data from Firestore
 * @param {string} userId - The user's UID
 * @returns {Promise<Object>} User profile data
 */
export const getUserProfile = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const userRef = doc(db, 'email', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

/**
 * Update user profile data in Firestore
 * @param {string} userId - The user's UID
 * @param {Object} updates - Profile data to update
 * @returns {Promise<void>}
 */
export const updateUserProfile = async (userId, updates) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const userRef = doc(db, 'email', userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

/**
 * Get user's display name
 * @param {string} userId - The user's UID
 * @returns {Promise<string>} User's name or email
 */
export const getUserDisplayName = async (userId) => {
  try {
    const profile = await getUserProfile(userId);
    return profile?.name || profile?.email?.split('@')[0] || 'User';
  } catch (error) {
    console.error('Error getting user display name:', error);
    return 'User';
  }
};

/**
 * Subscribe to real-time user profile updates
 * @param {string} userId - The user's UID
 * @param {Function} callback - Callback function to handle profile updates
 * @returns {Function} Unsubscribe function
 */
export const subscribeToUserProfile = (userId, callback) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (typeof callback !== 'function') {
    throw new Error('Callback must be a function');
  }

  try {
    const userRef = doc(db, 'email', userId);
    
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const profileData = doc.data();
        callback(profileData);
      } else {
        callback(null);
      }
    }, (error) => {
      callback(null);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up user profile real-time listener:', error);
    throw error;
  }
};

/**
 * Get default brand voice settings based on subscription tier
 * @param {string} tier - User's subscription tier
 * @returns {Object} Default brand voice settings
 */
export const getDefaultBrandVoiceSettings = (tier) => {
  const tierLower = tier?.toLowerCase() || 'free';
  
  // Base settings for all tiers
  const baseSettings = {
    enabled: false,
    preferredTerms: [],
    bannedPhrases: [],
    defaultDisclaimer: '',
    industry: 'general',
    customInstructions: '',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Tier-specific defaults
  switch (tierLower) {
    case 'free':
    case 'starter':
      return {
        ...baseSettings,
        enabled: false, // No brand voice access for free/starter
        maxPreferredTerms: 0,
        maxBannedPhrases: 0,
        canUseDisclaimer: false,
        canUseCustomInstructions: false,
        availableIndustries: ['general']
      };
    
    case 'growth':
      return {
        ...baseSettings,
        maxPreferredTerms: 10,
        maxBannedPhrases: 10,
        canUseDisclaimer: true,
        canUseCustomInstructions: false,
        availableIndustries: ['general', 'business', 'education']
      };
    
    case 'scale':
    case 'agency':
    case 'entryagency':
      return {
        ...baseSettings,
        maxPreferredTerms: 25,
        maxBannedPhrases: 25,
        canUseDisclaimer: true,
        canUseCustomInstructions: true,
        availableIndustries: ['general', 'business', 'education', 'spiritual', 'healthcare', 'legal', 'finance']
      };
    
    default:
      return baseSettings;
  }
};

/**
 * Get user's brand voice settings from Firestore
 * @param {string} userId - The user's UID
 * @returns {Promise<Object>} Brand voice settings or null if not found
 */
export const getBrandVoiceSettings = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const userRef = doc(db, 'email', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      return userData.brandVoiceSettings || null;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching brand voice settings:', error);
    throw error;
  }
};

/**
 * Update user's brand voice settings in Firestore
 * @param {string} userId - The user's UID
 * @param {Object} brandVoiceSettings - Brand voice settings to update
 * @returns {Promise<void>}
 */
export const updateBrandVoiceSettings = async (userId, brandVoiceSettings) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!brandVoiceSettings || typeof brandVoiceSettings !== 'object') {
    throw new Error('Brand voice settings must be a valid object');
  }

  try {
    // Validate settings structure
    const validatedSettings = {
      enabled: Boolean(brandVoiceSettings.enabled),
      preferredTerms: Array.isArray(brandVoiceSettings.preferredTerms) 
        ? brandVoiceSettings.preferredTerms.filter(term => typeof term === 'string' && term.trim().length > 0)
        : [],
      bannedPhrases: Array.isArray(brandVoiceSettings.bannedPhrases)
        ? brandVoiceSettings.bannedPhrases.filter(phrase => typeof phrase === 'string' && phrase.trim().length > 0)
        : [],
      defaultDisclaimer: typeof brandVoiceSettings.defaultDisclaimer === 'string' 
        ? brandVoiceSettings.defaultDisclaimer.trim() 
        : '',
      industry: typeof brandVoiceSettings.industry === 'string' 
        ? brandVoiceSettings.industry.trim() 
        : 'general',
      customInstructions: typeof brandVoiceSettings.customInstructions === 'string'
        ? brandVoiceSettings.customInstructions.trim()
        : '',
      updatedAt: serverTimestamp()
    };

    // Preserve createdAt if it exists, otherwise set it
    if (brandVoiceSettings.createdAt) {
      validatedSettings.createdAt = brandVoiceSettings.createdAt;
    } else {
      validatedSettings.createdAt = serverTimestamp();
    }

    const userRef = doc(db, 'email', userId);
    await setDoc(userRef, {
      brandVoiceSettings: validatedSettings,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating brand voice settings:', error);
    throw error;
  }
};

/**
 * Get user's brand voice settings with tier-based defaults
 * @param {string} userId - The user's UID
 * @param {string} tier - User's subscription tier
 * @returns {Promise<Object>} Brand voice settings with defaults applied
 */
export const getBrandVoiceSettingsWithDefaults = async (userId, tier) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const existingSettings = await getBrandVoiceSettings(userId);
    const defaultSettings = getDefaultBrandVoiceSettings(tier);

    if (!existingSettings) {
      return defaultSettings;
    }

    // Merge existing settings with defaults and tier limits
    return {
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
  } catch (error) {
    console.error('Error getting brand voice settings with defaults:', error);
    throw error;
  }
};

/**
 * Validate brand voice settings against tier limits
 * @param {Object} settings - Brand voice settings to validate
 * @param {string} tier - User's subscription tier
 * @returns {Object} Validation result with isValid and errors
 */
export const validateBrandVoiceSettings = (settings, tier) => {
  const errors = [];
  const defaults = getDefaultBrandVoiceSettings(tier);

  // Check if tier allows brand voice
  if ((tier === 'free' || tier === 'starter') && settings.enabled) {
    errors.push('Brand voice is not available for Free/Starter plans. Upgrade to Growth or higher.');
  }

  // Check preferred terms limit
  if (settings.preferredTerms?.length > defaults.maxPreferredTerms) {
    errors.push(`Too many preferred terms. Your ${tier} plan allows up to ${defaults.maxPreferredTerms} terms.`);
  }

  // Check banned phrases limit
  if (settings.bannedPhrases?.length > defaults.maxBannedPhrases) {
    errors.push(`Too many banned phrases. Your ${tier} plan allows up to ${defaults.maxBannedPhrases} phrases.`);
  }

  // Check disclaimer access
  if (settings.defaultDisclaimer && !defaults.canUseDisclaimer) {
    errors.push('Custom disclaimers are not available for your plan. Upgrade to Growth or higher.');
  }

  // Check custom instructions access
  if (settings.customInstructions && !defaults.canUseCustomInstructions) {
    errors.push('Custom instructions are not available for your plan. Upgrade to Scale or higher.');
  }

  // Check industry availability
  if (settings.industry && !defaults.availableIndustries.includes(settings.industry)) {
    errors.push(`Industry "${settings.industry}" is not available for your plan.`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// ============================================================================
// ONBOARDING FUNCTIONS
// ============================================================================

/**
 * Initialize onboarding for a new user
 * @param {string} userId - The user's UID
 * @returns {Promise<void>}
 */
export const initializeOnboarding = async (userId) => {
  try {
    const userRef = doc(db, 'email', userId);
    await updateDoc(userRef, {
      'onboarding.isCompleted': false,
      'onboarding.isMandatory': true,
      'onboarding.currentStep': 0,
      'onboarding.totalSteps': 7,
      'onboarding.completedSteps': [],
      'onboarding.startedAt': serverTimestamp(),
      'onboarding.completedAt': null,
      'onboarding.lastActiveAt': serverTimestamp(),
      'onboarding.hasCreatedFirstArticle': false,
      'onboarding.firstArticleId': null,
      'onboarding.sessionId': generateUUID(),
      'onboarding.canSkip': false,
      'onboarding.isActive': true,
      'onboarding.version': '1.0',
      'onboarding.customSteps': null,
      'onboarding.stepTimings': {},
      'onboarding.interactions': [],
      'onboarding.totalTimeSpent': 0,
      'onboarding.lastError': null,
      'onboarding.retryCount': 0,
      'onboarding.recoveryData': null
    });
  } catch (error) {
    console.error('Error initializing onboarding:', error);
    throw error;
  }
};

/**
 * Update onboarding step progress
 * @param {string} userId - The user's UID
 * @param {number} stepId - The step ID to update
 * @param {Object} data - Additional data (timeSpent, etc.)
 * @returns {Promise<void>}
 */
export const updateOnboardingStep = async (userId, stepId, data = {}) => {
  try {
    const userRef = doc(db, 'email', userId);
    const updateData = {
      'onboarding.currentStep': stepId,
      'onboarding.lastActiveAt': serverTimestamp(),
      'onboarding.completedSteps': arrayUnion(stepId)
    };

    if (data.timeSpent) {
      updateData[`onboarding.stepTimings.${stepId}`] = data.timeSpent;
    }

    await updateDoc(userRef, updateData);
  } catch (error) {
    console.error('Error updating onboarding step:', error);
    throw error;
  }
};

/**
 * Complete the onboarding process
 * @param {string} userId - The user's UID
 * @param {string} firstArticleId - ID of the first article created (optional)
 * @returns {Promise<void>}
 */
export const completeOnboarding = async (userId, firstArticleId = null) => {
  try {
    const userRef = doc(db, 'email', userId);
    await updateDoc(userRef, {
      'onboarding.isCompleted': true,
      'onboarding.completedAt': serverTimestamp(),
      'onboarding.hasCreatedFirstArticle': !!firstArticleId,
      'onboarding.firstArticleId': firstArticleId,
      'onboarding.isActive': false
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    throw error;
  }
};

/**
 * Track onboarding analytics events
 * @param {string} userId - The user's UID
 * @param {string} eventType - Type of event ('onboarding_start', 'step_complete', 'error', 'completion')
 * @param {Object} data - Event data
 * @returns {Promise<void>}
 */
export const trackOnboardingEvent = async (userId, eventType, data) => {
  // Temporarily disable analytics to avoid Firebase errors
  return Promise.resolve();
};

/**
 * Reset onboarding for a user (for testing/debugging)
 * @param {string} userId - The user's UID
 * @returns {Promise<void>}
 */
export const resetOnboarding = async (userId) => {
  try {
    const userRef = doc(db, 'email', userId);
    await updateDoc(userRef, {
      'onboarding.isCompleted': false,
      'onboarding.currentStep': 0,
      'onboarding.completedSteps': [],
      'onboarding.startedAt': null,
      'onboarding.completedAt': null,
      'onboarding.lastActiveAt': null,
      'onboarding.isActive': true,
      'onboarding.hasCreatedFirstArticle': false,
      'onboarding.firstArticleId': null,
      'onboarding.sessionId': generateUUID(),
      'onboarding.stepTimings': {},
      'onboarding.totalTimeSpent': 0,
      'onboarding.lastError': null,
      'onboarding.retryCount': 0
    });
    
    // Track reset event
    await trackOnboardingEvent(userId, 'reset', {
      stepId: 0,
      timestamp: Date.now()
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Subscribe to real-time onboarding updates
 * @param {string} userId - The user's UID
 * @param {Function} callback - Callback function to handle onboarding updates
 * @returns {Function} Unsubscribe function
 */
export const subscribeToOnboardingUpdates = (userId, callback) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (typeof callback !== 'function') {
    throw new Error('Callback must be a function');
  }

  try {
    const userRef = doc(db, 'email', userId);
    
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const onboardingData = doc.data().onboarding;
        callback(onboardingData);
      } else {
        callback(null);
      }
    }, (error) => {
      callback(null);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up onboarding real-time listener:', error);
    throw error;
  }
};

/**
 * Helper function to generate UUID for session IDs
 * @returns {string} UUID string
 */
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};