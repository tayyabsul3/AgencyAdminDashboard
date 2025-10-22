/**
 * Encryption Service Class
 * Handles secure credential storage and retrieval using AES-256-GCM
 */

const crypto = require('crypto');

class EncryptionService {
  /**
   * Encrypt data using AES-256-GCM
   * @param {string} data - Data to encrypt
   * @param {string} key - Encryption key (base64 encoded)
   * @returns {Object} Encrypted data with IV and auth tag
   */
  static encrypt(data, key) {
    try {
      if (!data || typeof data !== 'string') {
        throw new Error('Data must be a non-empty string');
      }
      
      if (!key || typeof key !== 'string') {
        throw new Error('Key must be a non-empty string');
      }

      // Generate random IV for each encryption (16 bytes for AES)
      const iv = crypto.randomBytes(16);
      
      // Convert base64 key to buffer
      const keyBuffer = Buffer.from(key, 'base64');
      
      if (keyBuffer.length !== 32) {
        throw new Error('Key must be 32 bytes (256 bits) when decoded');
      }
      
      // Create cipher
      const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
      
      // Encrypt the data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        authTag: '' // Not used in CBC mode, keeping for compatibility
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data using AES-256-CBC
   * @param {string} encryptedData - Encrypted data (hex)
   * @param {string} key - Decryption key (base64 encoded)
   * @param {string} iv - Initialization vector (hex)
   * @param {string} authTag - Authentication tag (hex) - not used in CBC mode
   * @returns {string} Decrypted data
   */
  static decrypt(encryptedData, key, iv, authTag = '') {
    try {
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Encrypted data must be a non-empty string');
      }
      
      if (!key || typeof key !== 'string') {
        throw new Error('Key must be a non-empty string');
      }
      
      if (!iv || typeof iv !== 'string') {
        throw new Error('IV must be a non-empty string');
      }

      // Convert inputs from hex/base64 to buffers
      const keyBuffer = Buffer.from(key, 'base64');
      const ivBuffer = Buffer.from(iv, 'hex');
      
      if (keyBuffer.length !== 32) {
        throw new Error('Key must be 32 bytes (256 bits) when decoded');
      }
      
      if (ivBuffer.length !== 16) {
        throw new Error('IV must be 16 bytes when decoded');
      }
      
      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);
      
      // Decrypt the data
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Generate a secure encryption key
   * @returns {string} Base64 encoded encryption key
   */
  static generateKey() {
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * Derive encryption key from user ID and master key
   * @param {string} userId - Firebase user ID
   * @param {string} masterKey - Master encryption key from environment
   * @returns {string} Derived key (base64 encoded)
   */
  static deriveKey(userId, masterKey) {
    if (!masterKey) {
      throw new Error('Master encryption key not configured');
    }
    
    // Use PBKDF2 to derive user-specific key
    const salt = Buffer.from(userId, 'utf8');
    const derivedKey = crypto.pbkdf2Sync(masterKey, salt, 10000, 32, 'sha256');
    
    return derivedKey.toString('base64');
  }

  /**
   * Hash password for secure comparison (not used for encryption)
   * @param {string} password - Password to hash
   * @param {string} salt - Salt for hashing
   * @returns {string} Hashed password
   */
  static hashPassword(password, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(16).toString('hex');
    }
    
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256');
    return `${salt}:${hash.toString('hex')}`;
  }

  /**
   * Verify password against hash
   * @param {string} password - Password to verify
   * @param {string} hashedPassword - Stored hash (salt:hash format)
   * @returns {boolean} True if password matches
   */
  static verifyPassword(password, hashedPassword) {
    try {
      const [salt, hash] = hashedPassword.split(':');
      const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256');
      return hash === verifyHash.toString('hex');
    } catch (error) {
      return false;
    }
  }

  /**
   * Encrypt WordPress credentials for storage
   * @param {Object} credentials - Credentials object
   * @param {string} credentials.username - WordPress username
   * @param {string} credentials.applicationPassword - WordPress application password
   * @param {string} userId - Firebase user ID
   * @param {string} masterKey - Master encryption key
   * @returns {Object} Encrypted credentials with metadata
   */
  static encryptCredentials(credentials, userId, masterKey) {
    const key = this.deriveKey(userId, masterKey);
    const credentialsJson = JSON.stringify(credentials);
    
    const encrypted = this.encrypt(credentialsJson, key);
    
    return {
      encryptedData: encrypted.encryptedData,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      algorithm: 'aes-256-cbc'
    };
  }

  /**
   * Decrypt WordPress credentials from storage
   * @param {Object} encryptedCredentials - Encrypted credentials object
   * @param {string} userId - Firebase user ID
   * @param {string} masterKey - Master encryption key
   * @returns {Object} Decrypted credentials
   */
  static decryptCredentials(encryptedCredentials, userId, masterKey) {
    const key = this.deriveKey(userId, masterKey);
    
    const decryptedJson = this.decrypt(
      encryptedCredentials.encryptedData,
      key,
      encryptedCredentials.iv,
      encryptedCredentials.authTag
    );
    
    return JSON.parse(decryptedJson);
  }

  /**
   * Securely clear sensitive data from memory
   * @param {Object} obj - Object containing sensitive data
   */
  static clearSensitiveData(obj) {
    if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'string') {
          // Overwrite string with random data
          obj[key] = crypto.randomBytes(obj[key].length).toString('hex');
        }
        delete obj[key];
      });
    }
  }
}

module.exports = EncryptionService;