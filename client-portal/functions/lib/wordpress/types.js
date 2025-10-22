/**
 * TypeScript-style interfaces for WordPress integration
 * These are JSDoc definitions for better IDE support and documentation
 */

/**
 * @typedef {Object} WordPressConnection
 * @property {string} id - Auto-generated document ID
 * @property {string} userId - Firebase Auth user ID
 * @property {string} siteUrl - WordPress site URL
 * @property {string} siteName - WordPress site name
 * @property {string} username - WordPress username
 * @property {string} encryptedPassword - Encrypted application password
 * @property {string} encryptionIV - Initialization vector for decryption
 * @property {'self-hosted'|'wordpress.com'} siteType - WordPress installation type
 * @property {string} apiEndpoint - Resolved REST API endpoint
 * @property {'active'|'inactive'|'error'} status - Connection status
 * @property {Date} lastTested - Last successful connection test
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} WordPressPostData
 * @property {string} title - Post title
 * @property {string} content - HTML content from JSON conversion
 * @property {string} [excerpt] - Article subtitle or summary
 * @property {'draft'|'publish'} status - Post publication status
 * @property {number[]} [categories] - WordPress category IDs
 * @property {string[]} [tags] - Tag names
 * @property {number} [featured_media] - Featured image media ID
 * @property {Object} [meta] - Custom meta fields
 */

/**
 * @typedef {Object} ConnectionResponse
 * @property {boolean} success - Operation success status
 * @property {string} [connectionId] - Created connection ID
 * @property {SiteInfo} [siteInfo] - WordPress site information
 * @property {ErrorInfo} [error] - Error details if failed
 */

/**
 * @typedef {Object} PublishResponse
 * @property {boolean} success - Operation success status
 * @property {number} [postId] - WordPress post ID
 * @property {string} [postUrl] - Public post URL
 * @property {string} [editUrl] - WordPress admin edit URL
 * @property {ErrorInfo} [error] - Error details if failed
 */

/**
 * @typedef {Object} SiteInfo
 * @property {string} name - Site name
 * @property {string} url - Site URL
 * @property {string} description - Site description
 * @property {string} [version] - WordPress version
 */

/**
 * @typedef {Object} ErrorInfo
 * @property {string} code - Error code
 * @property {string} message - Error message
 * @property {*} [details] - Additional error details
 */

/**
 * @typedef {Object} ArticleJSON
 * @property {string} title - Article title
 * @property {string} [subtitle] - Article subtitle
 * @property {string} [intro_md] - Introduction markdown
 * @property {string[]} [key_takeaways] - Key takeaways list
 * @property {Object[]} [tables] - Article tables
 * @property {Object} [checklists] - Article checklists
 * @property {Object[]} [toc] - Table of contents
 * @property {Object[]} [faqs] - FAQ sections
 * @property {Object} [author] - Author information
 * @property {Object} [cta] - Call to action
 */

/**
 * @typedef {Object} WordPressPost
 * @property {number} id - WordPress post ID
 * @property {string} title - Post title
 * @property {string} content - Post content (HTML)
 * @property {string} excerpt - Post excerpt
 * @property {string} status - Post status (draft, publish, etc.)
 * @property {string} link - Public post URL
 * @property {string} [edit_link] - Admin edit URL
 * @property {number[]} categories - Category IDs
 * @property {number[]} tags - Tag IDs
 * @property {number} [featured_media] - Featured image ID
 * @property {Date} date - Publication date
 * @property {Date} modified - Last modified date
 */

/**
 * @typedef {Object} EncryptedCredentials
 * @property {string} encryptedData - Encrypted credential data
 * @property {string} iv - Initialization vector
 * @property {string} authTag - Authentication tag
 * @property {string} algorithm - Encryption algorithm used
 */

/**
 * @typedef {Object} ConnectionTestResult
 * @property {boolean} success - Test success status
 * @property {SiteInfo} [siteInfo] - Site information if successful
 * @property {ErrorInfo} [error] - Error information if failed
 */

/**
 * @typedef {Object} WordPressCredentials
 * @property {string} username - WordPress username
 * @property {string} applicationPassword - WordPress application password
 */

/**
 * @typedef {Object} PublishOptions
 * @property {'draft'|'publish'|'private'} [status] - Post publication status
 * @property {number[]} [categories] - Category IDs to assign
 * @property {string[]} [tags] - Tag names to assign
 * @property {boolean} [setFeaturedImage] - Whether to set featured image
 * @property {Object} [customFields] - Custom field values
 */

/**
 * @typedef {Object} RetryConfig
 * @property {number} maxAttempts - Maximum retry attempts
 * @property {number} baseDelay - Base delay in milliseconds
 * @property {number} maxDelay - Maximum delay in milliseconds
 * @property {number} backoffFactor - Exponential backoff factor
 */

/**
 * @typedef {Object} TimeoutConfig
 * @property {number} connectionTest - Connection test timeout
 * @property {number} postCreation - Post creation timeout
 * @property {number} mediaUpload - Media upload timeout
 */

module.exports = {
  // Export types for JSDoc usage - these are used for IDE intellisense
  // and documentation generation, not runtime functionality
};