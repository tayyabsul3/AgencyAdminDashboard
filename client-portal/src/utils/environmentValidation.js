/**
 * Environment validation utilities for WordPress Connection Persist feature
 */

/**
 * Validate that required environment variables are set
 * @returns {Object} Validation result with status and missing variables
 */
export const validateEnvironmentConfig = () => {
  const requiredVars = {
    'NEXT_PUBLIC_ENCRYPTION_SALT': process.env.NEXT_PUBLIC_ENCRYPTION_SALT,
    'NEXT_PUBLIC_FIREBASE_API_KEY': process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID': process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  };

  const missing = [];
  const warnings = [];

  // Check for missing required variables
  Object.entries(requiredVars).forEach(([key, value]) => {
    if (!value) {
      missing.push(key);
    }
  });

  // Check for default/insecure values
  if (requiredVars.NEXT_PUBLIC_ENCRYPTION_SALT === 'default-salt-change-this') {
    warnings.push('NEXT_PUBLIC_ENCRYPTION_SALT is using default value - change in production');
  }

  if (requiredVars.NEXT_PUBLIC_ENCRYPTION_SALT && 
      requiredVars.NEXT_PUBLIC_ENCRYPTION_SALT.length < 32) {
    warnings.push('NEXT_PUBLIC_ENCRYPTION_SALT should be at least 32 characters long');
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
    hasWarnings: warnings.length > 0
  };
};

/**
 * Log environment validation results
 */
export const logEnvironmentValidation = () => {
  const validation = validateEnvironmentConfig();
  
  if (!validation.isValid) {
    console.error('❌ WordPress Connection Persist - Missing required environment variables:', validation.missing);
  } else {
    console.log('✅ WordPress Connection Persist - Environment configuration valid');
  }

  if (validation.hasWarnings) {
    console.warn('⚠️ WordPress Connection Persist - Environment warnings:', validation.warnings);
  }

  return validation;
};

/**
 * Check if encryption is properly configured
 * @returns {boolean} True if encryption can be used
 */
export const isEncryptionConfigured = () => {
  const validation = validateEnvironmentConfig();
  return validation.isValid && 
         process.env.NEXT_PUBLIC_ENCRYPTION_SALT !== 'default-salt-change-this';
};

/**
 * Get encryption salt with fallback
 * @returns {string} Encryption salt
 */
export const getEncryptionSalt = () => {
  const salt = process.env.NEXT_PUBLIC_ENCRYPTION_SALT;
  
  if (!salt) {
    console.warn('No encryption salt configured, using default (insecure)');
    return 'default-salt-change-this';
  }

  if (salt === 'default-salt-change-this') {
    console.warn('Using default encryption salt - change in production');
  }

  return salt;
};