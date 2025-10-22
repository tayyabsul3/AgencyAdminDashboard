/**
 * Configuration utilities for Firebase and Gemini API
 * This file provides centralized configuration management and validation
 */

import { auth, db } from './firebase';
import { isGeminiConfigured, getGeminiStatus } from './gemini';

/**
 * Firebase configuration validation
 */
export const validateFirebaseConfig = () => {
  const requiredEnvVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  return {
    isValid: missing.length === 0,
    missing,
    hasAuth: !!auth,
    hasFirestore: !!db
  };
};

/**
 * Gemini API configuration validation
 */
export const validateGeminiConfig = () => {
  const status = getGeminiStatus();
  
  return {
    isValid: status.configured,
    hasApiKey: status.hasApiKey,
    hasClient: status.hasClient,
    hasModel: status.hasModel,
    details: status
  };
};

/**
 * Overall system configuration check
 */
export const validateSystemConfig = () => {
  const firebase = validateFirebaseConfig();
  const gemini = validateGeminiConfig();
  
  return {
    firebase,
    gemini,
    isReady: firebase.isValid && gemini.isValid,
    readyServices: {
      auth: firebase.hasAuth,
      firestore: firebase.hasFirestore,
      gemini: gemini.isValid
    }
  };
};

/**
 * Get configuration status for debugging
 */
export const getConfigStatus = () => {
  const systemConfig = validateSystemConfig();
  
  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    ...systemConfig,
    environmentVariables: {
      firebase: {
        apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        useEmulator: process.env.NEXT_PUBLIC_USE_FIRESTORE_EMULATOR === 'true'
      },
      gemini: {
        apiKey: !!process.env.GEMINI_API_KEY
      }
    }
  };
};

/**
 * Initialize and validate all services
 * This function should be called during app initialization
 */
export const initializeServices = async () => {
  console.log('Initializing services...');
  
  const config = validateSystemConfig();
  
  if (!config.isReady) {
    console.warn('System configuration incomplete:', config);
    
    if (!config.firebase.isValid) {
      console.error('Firebase configuration issues:', config.firebase);
    }
    
    if (!config.gemini.isValid) {
      console.error('Gemini configuration issues:', config.gemini);
    }
  } else {
    console.log('All services initialized successfully');
  }
  
  return config;
};

// Export service instances for convenience
export { auth, db } from './firebase';
export { generateContent, generateStructuredContent, isGeminiConfigured } from './gemini';