/**
 * Client-side encryption service for WordPress passwords
 * Uses Web Crypto API with AES-GCM encryption
 */

const SALT = process.env.NEXT_PUBLIC_ENCRYPTION_SALT || 'default-salt-change-this';

/**
 * Custom error class for decryption failures
 */
class DecryptionFailureError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DecryptionFailureError';
  }
}

export class EncryptionService {
  /**
   * Derive user-specific encryption key from user identifier
   * @param {string} userIdentifier - Stable user identifier (UID or token)
   * @returns {Promise<CryptoKey>} - Derived encryption key
   */
  static async deriveUserKey(userIdentifier) {
    try {
      let stableUserId = userIdentifier;
      
      // If it looks like a JWT token, extract the UID from it
      if (userIdentifier && userIdentifier.includes('.') && userIdentifier.split('.').length === 3) {
        try {
          // Parse JWT token to get stable UID
          const tokenParts = userIdentifier.split('.');
          const payload = JSON.parse(atob(tokenParts[1]));
          if (payload.user_id || payload.uid) {
            stableUserId = payload.user_id || payload.uid;
            console.log('Extracted stable UID from token for encryption:', stableUserId);
          } else {
            console.warn('No UID found in token payload, using full token');
          }
        } catch (e) {
          console.warn('Failed to parse JWT token, treating as direct UID:', e.message);
          // If parsing fails, assume it's already a UID
        }
      } else {
        // Assume it's already a stable UID (Firebase UID format)
        console.log('Using direct UID for encryption:', stableUserId);
      }
      
      // Import the key material from stable user ID + salt
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(stableUserId + SALT),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      
      // Derive the actual encryption key using PBKDF2
      return await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: new TextEncoder().encode('queryfuel-wp-salt'),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Failed to derive user key:', error);
      
      // Provide more specific error messages
      if (error.name === 'NotSupportedError') {
        throw new Error('Your browser does not support the required encryption features. Please use a modern browser.');
      } else if (error.name === 'InvalidAccessError') {
        throw new Error('Unable to access encryption features. Please check your browser security settings.');
      } else {
        throw new Error('Encryption key generation failed. Please try again or contact support.');
      }
    }
  }

  /**
   * Encrypt password using user-specific key
   * @param {string} password - Plain text password to encrypt
   * @param {string} userIdentifier - Firebase UID or Auth token (UID will be extracted)
   * @returns {Promise<Object>} - Encrypted data with IV and algorithm info
   */
  static async encryptPassword(password, userIdentifier) {
    try {
      if (!password || typeof password !== 'string') {
        throw new Error('Invalid password provided');
      }

      if (!userIdentifier || typeof userIdentifier !== 'string') {
        throw new Error('Invalid user identifier provided');
      }

      // Derive user-specific encryption key using stable identifier
      const key = await this.deriveUserKey(userIdentifier);
      
      // Generate random initialization vector
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt the password
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        new TextEncoder().encode(password)
      );
      
      return {
        encryptedData: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv),
        algorithm: 'AES-GCM-256'
      };
    } catch (error) {
      console.error('Failed to encrypt password:', error);
      
      if (error.name === 'NotSupportedError') {
        throw new Error('Your browser does not support password encryption. Please use a modern browser.');
      } else if (error.name === 'InvalidAccessError') {
        throw new Error('Unable to encrypt password. Please check your browser security settings.');
      } else if (error.message.includes('Invalid')) {
        throw new Error('Invalid password or user authentication. Please try again.');
      } else {
        throw new Error('Password encryption failed. Please try again or contact support.');
      }
    }
  }

  /**
   * Decrypt password using user-specific key
   * @param {Object} encryptedData - Encrypted data object with encryptedData, iv, and algorithm
   * @param {string} userIdentifier - Firebase UID or Auth token (UID will be extracted)
   * @returns {Promise<string>} - Decrypted plain text password
   */
  static async decryptPassword(encryptedData, userIdentifier) {
    try {
      if (!encryptedData || !encryptedData.encryptedData || !encryptedData.iv) {
        throw new Error('Invalid encrypted data structure');
      }

      if (!userIdentifier || typeof userIdentifier !== 'string') {
        throw new Error('Invalid user identifier provided');
      }

      // Verify algorithm
      if (encryptedData.algorithm !== 'AES-GCM-256') {
        throw new Error('Unsupported encryption algorithm');
      }

      // Derive user-specific encryption key using stable identifier
      const key = await this.deriveUserKey(userIdentifier);
      
      // Decrypt the password
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
        key,
        new Uint8Array(encryptedData.encryptedData)
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.warn('Password decryption failed, this is expected if session changed:', error.message);
      
      // Instead of throwing complex errors that break the UI, throw a simple marker
      // The calling code can detect this and handle gracefully
      throw new DecryptionFailureError('DECRYPTION_FAILED');
    }
  }

  /**
   * Safely attempt to decrypt password, returning null on failure instead of throwing
   * @param {Object} encryptedData - Encrypted data object
   * @param {string} userIdentifier - Firebase UID or Auth token
   * @returns {Promise<string|null>} - Decrypted password or null if decryption fails
   */
  static async safeDecryptPassword(encryptedData, userIdentifier) {
    try {
      return await this.decryptPassword(encryptedData, userIdentifier);
    } catch (error) {
      if (error instanceof DecryptionFailureError) {
        console.log('Decryption failed gracefully, returning null');
        return null;
      }
      // Re-throw other types of errors
      throw error;
    }
  }

  /**
   * Validate that Web Crypto API is available
   * @returns {boolean} - True if Web Crypto API is supported
   */
  static isSupported() {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.getRandomValues !== 'undefined';
  }

  /**
   * Generate a test encryption/decryption to verify functionality
   * @param {string} userIdentifier - Firebase UID or Auth token
   * @returns {Promise<boolean>} - True if encryption/decryption works correctly
   */
  static async testEncryption(userIdentifier) {
    try {
      const testPassword = 'test-password-123';
      const encrypted = await this.encryptPassword(testPassword, userIdentifier);
      const decrypted = await this.decryptPassword(encrypted, userIdentifier);
      return decrypted === testPassword;
    } catch (error) {
      console.error('Encryption test failed:', error);
      return false;
    }
  }
}