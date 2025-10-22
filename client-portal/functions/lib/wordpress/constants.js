/**
 * WordPress integration constants
 */

// WordPress REST API endpoints
const WP_API_ENDPOINTS = {
  POSTS: '/wp-json/wp/v2/posts',
  USERS: '/wp-json/wp/v2/users/me',
  CATEGORIES: '/wp-json/wp/v2/categories',
  TAGS: '/wp-json/wp/v2/tags',
  MEDIA: '/wp-json/wp/v2/media',
  SITE_INFO: '/wp-json'
};

// WordPress.com specific endpoints
const WPCOM_API_ENDPOINTS = {
  BASE: 'https://public-api.wordpress.com/wp/v2/sites',
  POSTS: '/posts',
  USERS: '/users/me',
  CATEGORIES: '/categories',
  TAGS: '/tags',
  MEDIA: '/media'
};

// Error codes for WordPress operations
const ERROR_CODES = {
  // Authentication errors
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_EXPIRED_TOKEN: 'AUTH_EXPIRED_TOKEN',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_INSUFFICIENT_PERMISSIONS',
  
  // Network errors
  NETWORK_UNREACHABLE: 'NETWORK_UNREACHABLE',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_SSL_ERROR: 'NETWORK_SSL_ERROR',
  
  // API errors
  API_NOT_FOUND: 'API_NOT_FOUND',
  API_VERSION_INCOMPATIBLE: 'API_VERSION_INCOMPATIBLE',
  API_RATE_LIMITED: 'API_RATE_LIMITED',
  
  // Content errors
  CONTENT_INVALID_FORMAT: 'CONTENT_INVALID_FORMAT',
  CONTENT_TOO_LARGE: 'CONTENT_TOO_LARGE',
  CONTENT_MISSING_REQUIRED: 'CONTENT_MISSING_REQUIRED',
  
  // Media errors
  MEDIA_UPLOAD_FAILED: 'MEDIA_UPLOAD_FAILED',
  MEDIA_INVALID_TYPE: 'MEDIA_INVALID_TYPE',
  MEDIA_TOO_LARGE: 'MEDIA_TOO_LARGE'
};

// WordPress site types
const SITE_TYPES = {
  SELF_HOSTED: 'self-hosted',
  WORDPRESS_COM: 'wordpress.com'
};

// Connection statuses
const CONNECTION_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ERROR: 'error'
};

// Post statuses
const POST_STATUS = {
  DRAFT: 'draft',
  PUBLISH: 'publish',
  PRIVATE: 'private',
  PENDING: 'pending'
};

// Retry configuration
const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY: 1000, // 1 second
  MAX_DELAY: 8000,  // 8 seconds
  BACKOFF_FACTOR: 2
};

// Request timeout configuration
const TIMEOUT_CONFIG = {
  CONNECTION_TEST: 10000,  // 10 seconds
  POST_CREATION: 30000,    // 30 seconds
  MEDIA_UPLOAD: 180000     // 180 seconds (3 minutes) - increased for slow sites/CloudFlare
};

module.exports = {
  WP_API_ENDPOINTS,
  WPCOM_API_ENDPOINTS,
  ERROR_CODES,
  SITE_TYPES,
  CONNECTION_STATUS,
  POST_STATUS,
  RETRY_CONFIG,
  TIMEOUT_CONFIG
};