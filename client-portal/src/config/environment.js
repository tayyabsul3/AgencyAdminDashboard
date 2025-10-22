/**
 * Environment Configuration
 * Manages environment-specific settings and validates required variables
 */

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',
  
  // Firebase Configuration
  FIREBASE: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    useEmulator: process.env.NEXT_PUBLIC_USE_FIRESTORE_EMULATOR === 'true'
  },
  
  // API Configuration
  API: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '/api',
    timeout: parseInt(process.env.API_TIMEOUT_MS || '30000'),
    retryAttempts: parseInt(process.env.API_RETRY_ATTEMPTS || '3')
  },
  
  // Gemini AI Configuration
  GEMINI: {
    apiKey: process.env.GEMINI_API_KEY
  },
  
  // Rate Limiting
  RATE_LIMIT: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED_REQUESTS === 'true'
  },
  
  // Monitoring and Logging
  MONITORING: {
    enableErrorLogging: process.env.NEXT_PUBLIC_ENABLE_ERROR_LOGGING === 'true',
    enablePerformanceMonitoring: process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING === 'true',
    enableApiMonitoring: process.env.NEXT_PUBLIC_ENABLE_API_MONITORING === 'true',
    logLevel: process.env.NEXT_PUBLIC_LOG_LEVEL || 'info',
    performanceSampleRate: parseFloat(process.env.NEXT_PUBLIC_PERFORMANCE_SAMPLE_RATE || '0.1')
  },
  
  // Security
  SECURITY: {
    enableSecurityHeaders: process.env.NEXT_PUBLIC_ENABLE_SECURITY_HEADERS === 'true',
    cspEnabled: process.env.NEXT_PUBLIC_CSP_ENABLED === 'true'
  }
};

// Environment validation
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'GEMINI_API_KEY'
];

export function validateEnvironment() {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    const error = `Missing required environment variables: ${missing.join(', ')}`;
    console.error(error);
    
    if (ENV.NODE_ENV === 'production') {
      throw new Error(error);
    }
  }
  
  return missing.length === 0;
}

// Environment-specific configurations
export const isProduction = () => ENV.NODE_ENV === 'production';
export const isDevelopment = () => ENV.NODE_ENV === 'development';
export const isTest = () => ENV.NODE_ENV === 'test';

// Feature flags based on environment
export const FEATURES = {
  enableDebugLogging: isDevelopment(),
  enablePerformanceMonitoring: isProduction() || ENV.MONITORING.enablePerformanceMonitoring,
  enableErrorReporting: isProduction() || ENV.MONITORING.enableErrorLogging,
  enableRateLimiting: isProduction(),
  enableSecurityHeaders: isProduction() || ENV.SECURITY.enableSecurityHeaders
};

export default ENV;