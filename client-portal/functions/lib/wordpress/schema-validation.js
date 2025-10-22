/**
 * Database schema validation for WordPress integration
 * Validates that database documents match the expected schema
 */

const { CONNECTION_STATUS } = require('./constants');

/**
 * WordPress Connection Schema Validator
 */
class ConnectionSchemaValidator {
  /**
   * Validate WordPress connection data structure
   * @param {Object} data - Connection data to validate
   * @returns {Object} Validation result with isValid and errors
   */
  static validate(data) {
    const errors = [];
    
    // Required fields
    const requiredFields = [
      'userId', 'siteUrl', 'siteName', 'username', 
      'encryptedPassword', 'encryptionIV', 'siteType', 
      'apiEndpoint', 'status'
    ];
    
    for (const field of requiredFields) {
      if (!data[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Field type validations
    if (data.userId && typeof data.userId !== 'string') {
      errors.push('userId must be a string');
    }
    
    if (data.siteUrl && typeof data.siteUrl !== 'string') {
      errors.push('siteUrl must be a string');
    }
    
    if (data.siteUrl && !this.isValidUrl(data.siteUrl)) {
      errors.push('siteUrl must be a valid URL');
    }
    
    if (data.siteName && typeof data.siteName !== 'string') {
      errors.push('siteName must be a string');
    }
    
    if (data.username && typeof data.username !== 'string') {
      errors.push('username must be a string');
    }
    
    if (data.encryptedPassword && typeof data.encryptedPassword !== 'string') {
      errors.push('encryptedPassword must be a string');
    }
    
    if (data.encryptionIV && typeof data.encryptionIV !== 'string') {
      errors.push('encryptionIV must be a string');
    }
    
    if (data.siteType && !['self-hosted', 'wordpress.com'].includes(data.siteType)) {
      errors.push('siteType must be either "self-hosted" or "wordpress.com"');
    }
    
    if (data.apiEndpoint && typeof data.apiEndpoint !== 'string') {
      errors.push('apiEndpoint must be a string');
    }
    
    if (data.apiEndpoint && !this.isValidUrl(data.apiEndpoint)) {
      errors.push('apiEndpoint must be a valid URL');
    }
    
    if (data.status && !Object.values(CONNECTION_STATUS).includes(data.status)) {
      errors.push(`status must be one of: ${Object.values(CONNECTION_STATUS).join(', ')}`);
    }
    
    // Optional timestamp fields
    if (data.lastTested && !(data.lastTested instanceof Date) && typeof data.lastTested !== 'object') {
      errors.push('lastTested must be a Date or Firestore Timestamp');
    }
    
    if (data.createdAt && !(data.createdAt instanceof Date) && typeof data.createdAt !== 'object') {
      errors.push('createdAt must be a Date or Firestore Timestamp');
    }
    
    if (data.updatedAt && !(data.updatedAt instanceof Date) && typeof data.updatedAt !== 'object') {
      errors.push('updatedAt must be a Date or Firestore Timestamp');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Check if a string is a valid URL
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid URL
   */
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * WordPress Post Schema Validator
 */
class PostSchemaValidator {
  /**
   * Validate WordPress post record data structure
   * @param {Object} data - Post data to validate
   * @returns {Object} Validation result with isValid and errors
   */
  static validate(data) {
    const errors = [];
    
    // Required fields
    const requiredFields = [
      'userId', 'connectionId', 'wordpressPostId', 
      'title', 'status'
    ];
    
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Field type validations
    if (data.userId && typeof data.userId !== 'string') {
      errors.push('userId must be a string');
    }
    
    if (data.connectionId && typeof data.connectionId !== 'string') {
      errors.push('connectionId must be a string');
    }
    
    if (data.wordpressPostId && typeof data.wordpressPostId !== 'number') {
      errors.push('wordpressPostId must be a number');
    }
    
    if (data.title && typeof data.title !== 'string') {
      errors.push('title must be a string');
    }
    
    if (data.status && !['draft', 'published', 'failed'].includes(data.status)) {
      errors.push('status must be one of: draft, published, failed');
    }
    
    // Optional fields
    if (data.wordpressUrl && typeof data.wordpressUrl !== 'string') {
      errors.push('wordpressUrl must be a string');
    }
    
    if (data.wordpressUrl && !ConnectionSchemaValidator.isValidUrl(data.wordpressUrl)) {
      errors.push('wordpressUrl must be a valid URL');
    }
    
    if (data.editUrl && typeof data.editUrl !== 'string') {
      errors.push('editUrl must be a string');
    }
    
    if (data.editUrl && !ConnectionSchemaValidator.isValidUrl(data.editUrl)) {
      errors.push('editUrl must be a valid URL');
    }
    
    if (data.articleData && typeof data.articleData !== 'object') {
      errors.push('articleData must be an object');
    }
    
    // Timestamp fields
    if (data.publishedAt && !(data.publishedAt instanceof Date) && typeof data.publishedAt !== 'object') {
      errors.push('publishedAt must be a Date or Firestore Timestamp');
    }
    
    if (data.createdAt && !(data.createdAt instanceof Date) && typeof data.createdAt !== 'object') {
      errors.push('createdAt must be a Date or Firestore Timestamp');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Database Schema Manager
 * Provides utilities for schema validation and documentation
 */
class DatabaseSchemaManager {
  /**
   * Get the complete database schema documentation
   * @returns {Object} Schema documentation
   */
  static getSchemaDocumentation() {
    return {
      collections: {
        wordpress_connections: {
          description: 'Stores WordPress site connection information and credentials',
          fields: {
            id: { type: 'string', description: 'Auto-generated document ID', required: false },
            userId: { type: 'string', description: 'Firebase Auth user ID', required: true },
            siteUrl: { type: 'string', description: 'WordPress site URL', required: true },
            siteName: { type: 'string', description: 'WordPress site name', required: true },
            username: { type: 'string', description: 'WordPress username', required: true },
            encryptedPassword: { type: 'string', description: 'Encrypted application password', required: true },
            encryptionIV: { type: 'string', description: 'Initialization vector for decryption', required: true },
            siteType: { type: 'enum', values: ['self-hosted', 'wordpress.com'], description: 'WordPress installation type', required: true },
            apiEndpoint: { type: 'string', description: 'Resolved REST API endpoint', required: true },
            status: { type: 'enum', values: Object.values(CONNECTION_STATUS), description: 'Connection status', required: true },
            lastTested: { type: 'timestamp', description: 'Last successful connection test', required: false },
            createdAt: { type: 'timestamp', description: 'Creation timestamp', required: false },
            updatedAt: { type: 'timestamp', description: 'Last update timestamp', required: false }
          },
          indexes: [
            { fields: ['userId', 'createdAt'], description: 'Query user connections by creation date' },
            { fields: ['userId', 'status'], description: 'Query user connections by status' }
          ]
        },
        wordpress_posts: {
          description: 'Stores published WordPress post information and metadata',
          fields: {
            id: { type: 'string', description: 'Auto-generated document ID', required: false },
            userId: { type: 'string', description: 'Firebase Auth user ID', required: true },
            connectionId: { type: 'string', description: 'Reference to wordpress_connections', required: true },
            wordpressPostId: { type: 'number', description: 'WordPress post ID', required: true },
            title: { type: 'string', description: 'Post title', required: true },
            status: { type: 'enum', values: ['draft', 'published', 'failed'], description: 'Post status', required: true },
            wordpressUrl: { type: 'string', description: 'Public post URL', required: false },
            editUrl: { type: 'string', description: 'WordPress admin edit URL', required: false },
            articleData: { type: 'object', description: 'Original JSON article data', required: false },
            publishedAt: { type: 'timestamp', description: 'Publication timestamp', required: false },
            createdAt: { type: 'timestamp', description: 'Creation timestamp', required: false }
          },
          indexes: [
            { fields: ['userId', 'createdAt'], description: 'Query user posts by creation date' },
            { fields: ['connectionId', 'userId', 'createdAt'], description: 'Query posts by connection and user' }
          ]
        }
      }
    };
  }
  
  /**
   * Validate a connection document against the schema
   * @param {Object} data - Connection data to validate
   * @returns {Object} Validation result
   */
  static validateConnection(data) {
    return ConnectionSchemaValidator.validate(data);
  }
  
  /**
   * Validate a post document against the schema
   * @param {Object} data - Post data to validate
   * @returns {Object} Validation result
   */
  static validatePost(data) {
    return PostSchemaValidator.validate(data);
  }
  
  /**
   * Get required database indexes for Firebase CLI setup
   * @returns {Array} Array of index configurations
   */
  static getRequiredIndexes() {
    return [
      {
        collection: 'wordpress_connections',
        fields: [
          { field: 'userId', order: 'ASCENDING' },
          { field: 'createdAt', order: 'DESCENDING' }
        ]
      },
      {
        collection: 'wordpress_connections',
        fields: [
          { field: 'userId', order: 'ASCENDING' },
          { field: 'status', order: 'ASCENDING' }
        ]
      },
      {
        collection: 'wordpress_posts',
        fields: [
          { field: 'userId', order: 'ASCENDING' },
          { field: 'createdAt', order: 'DESCENDING' }
        ]
      },
      {
        collection: 'wordpress_posts',
        fields: [
          { field: 'connectionId', order: 'ASCENDING' },
          { field: 'userId', order: 'ASCENDING' },
          { field: 'createdAt', order: 'DESCENDING' }
        ]
      }
    ];
  }
}

module.exports = {
  ConnectionSchemaValidator,
  PostSchemaValidator,
  DatabaseSchemaManager
};