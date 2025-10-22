/**
 * WordPress Service Class
 * Handles all WordPress REST API operations
 */

const axios = require('axios');
const { WP_API_ENDPOINTS, WPCOM_API_ENDPOINTS, ERROR_CODES, TIMEOUT_CONFIG, RETRY_CONFIG, SITE_TYPES } = require('./constants');
const { defaultLogger } = require('./logger');
const WordPressErrorHandler = require('./errorHandler');
const WordPressSiteDetector = require('./siteDetector');

class WordPressService {
  /**
   * @param {string} siteUrl - WordPress site URL
   * @param {string} username - WordPress username
   * @param {string} applicationPassword - WordPress application password
   */
  constructor(siteUrl, username, applicationPassword, options = {}) {
    this.siteUrl = this.normalizeSiteUrl(siteUrl);
    this.username = username;
    this.applicationPassword = applicationPassword;
    
    // Initialize logging and error handling
    this.logger = options.logger || defaultLogger;
    this.errorHandler = new WordPressErrorHandler(this.logger);
    
    // Initialize site detector
    this.siteDetector = new WordPressSiteDetector({
      timeout: TIMEOUT_CONFIG.CONNECTION_TEST,
      logger: this.logger
    });
    
    // Site detection will be performed during connection test
    this.siteType = null;
    this.apiEndpoint = null;
    this.siteInfo = null;
    this.detectionResult = null;
    
    // Create axios instance with authentication
    this.httpClient = axios.create({
      timeout: TIMEOUT_CONFIG.CONNECTION_TEST,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'QueryFuel-WordPress-Integration/1.0'
      }
    });
    
    // Set up request/response interceptors for logging
    this.setupInterceptors();
  }

  /**
   * Normalize site URL to ensure consistent format
   * @param {string} url - Raw site URL
   * @returns {string} Normalized URL
   */
  normalizeSiteUrl(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    return url.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Perform comprehensive site detection and configuration
   * @returns {Promise<Object>} Detection result
   */
  async performSiteDetection() {
    if (this.detectionResult) {
      return this.detectionResult;
    }
    
    try {
      this.detectionResult = await this.siteDetector.detectSite(this.siteUrl);
      
      if (this.detectionResult.success) {
        this.siteType = this.detectionResult.siteType;
        this.apiEndpoint = this.detectionResult.apiEndpoint;
        this.siteInfo = this.detectionResult.siteInfo;
        
        // Update authentication based on detected site type
        this.setupAuthentication();
        
        this.logger.info('WordPress site detection completed', {
          siteUrl: this.siteUrl,
          siteType: this.siteType,
          apiEndpoint: this.apiEndpoint,
          apiVersion: this.detectionResult.apiVersion
        });
      } else {
        this.logger.error('WordPress site detection failed', {
          siteUrl: this.siteUrl,
          error: this.detectionResult.error
        });
      }
      
      return this.detectionResult;
      
    } catch (error) {
      this.detectionResult = {
        success: false,
        error: {
          code: ERROR_CODES.NETWORK_UNREACHABLE,
          message: 'Site detection failed',
          details: { originalError: error.message }
        }
      };
      
      return this.detectionResult;
    }
  }

  /**
   * Get site detection result (cached if available)
   * @returns {Object|null} Detection result or null if not performed
   */
  getDetectionResult() {
    return this.detectionResult;
  }

  /**
   * Check if site detection has been performed
   * @returns {boolean} Whether detection has been performed
   */
  isDetectionComplete() {
    return this.detectionResult !== null;
  }

  /**
   * Set up HTTP client authentication based on detected site type
   */
  setupAuthentication() {
    if (!this.siteType) {
      // Authentication will be set up after site detection
      return;
    }
    
    if (this.siteType === SITE_TYPES.WORDPRESS_COM) {
      // WordPress.com uses OAuth Bearer tokens
      // For now, we'll treat the applicationPassword as an OAuth token
      this.httpClient.defaults.headers.common['Authorization'] = 
        `Bearer ${this.applicationPassword}`;
      
      this.logger.debug('Set up WordPress.com OAuth authentication', {
        siteUrl: this.siteUrl
      });
    } else {
      // Self-hosted WordPress uses Basic Auth with application passwords
      const credentials = Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64');
      this.httpClient.defaults.headers.common['Authorization'] = `Basic ${credentials}`;
      
      this.logger.debug('Set up self-hosted Basic authentication', {
        siteUrl: this.siteUrl,
        username: this.username
      });
    }
  }

  /**
   * Set up request/response interceptors for comprehensive logging
   */
  setupInterceptors() {
    // Only set up interceptors if they exist (not in test mocks)
    if (!this.httpClient.interceptors) {
      return;
    }
    
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        const context = {
          siteUrl: this.siteUrl,
          siteType: this.siteType,
          operation: 'wordpress_api_request'
        };
        
        this.logger.logRequest({
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: config.headers,
          body: config.data,
          timeout: config.timeout
        }, context);
        
        // Add request timestamp for duration calculation
        config.metadata = { startTime: Date.now() };
        
        return config;
      },
      (error) => {
        this.logger.error('WordPress API Request Setup Failed', {
          siteUrl: this.siteUrl,
          error: {
            name: error.name,
            message: error.message,
            code: error.code
          }
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        const duration = response.config.metadata ? 
          Date.now() - response.config.metadata.startTime : undefined;
        
        const context = {
          siteUrl: this.siteUrl,
          siteType: this.siteType,
          operation: 'wordpress_api_response',
          duration
        };
        
        this.logger.logResponse({
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data,
          duration
        }, context);
        
        return response;
      },
      (error) => {
        const duration = error.config?.metadata ? 
          Date.now() - error.config.metadata.startTime : undefined;
        
        const context = {
          siteUrl: this.siteUrl,
          siteType: this.siteType,
          operation: 'wordpress_api_error',
          duration,
          request: {
            method: error.config?.method,
            url: error.config?.url
          }
        };
        
        // Log the error through our error handler
        const handledError = this.errorHandler.handleError(error, context);
        
        this.logger.error('WordPress API Request Failed', {
          ...context,
          error: handledError.error
        });
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Test WordPress connection and authentication with retry logic
   * @param {Object} options - Test options
   * @param {boolean} options.withRetry - Whether to retry on transient failures
   * @param {number} options.maxAttempts - Maximum retry attempts
   * @param {boolean} options.skipDetection - Skip site detection if already performed
   * @returns {Promise<{success: boolean, siteInfo?: Object, error?: Object, attempts?: number, detectionResult?: Object}>}
   */
  async testConnection(options = {}) {
    const { withRetry = true, maxAttempts = RETRY_CONFIG.MAX_ATTEMPTS, skipDetection = false } = options;
    let lastError = null;
    let attempts = 0;

    // Perform site detection first if not already done
    if (!skipDetection && !this.isDetectionComplete()) {
      const detectionResult = await this.performSiteDetection();
      
      if (!detectionResult.success) {
        return {
          success: false,
          error: detectionResult.error,
          attempts: 1,
          detectionResult
        };
      }
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;
      
      try {
        const result = await this._performConnectionTest();
        
        if (result.success) {
          return { 
            ...result, 
            attempts,
            detectionResult: this.detectionResult
          };
        }
        
        lastError = result.error;
        
        // Don't retry on authentication or permanent errors
        if (!withRetry || !this._isRetryableError(result.error)) {
          break;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < maxAttempts) {
          const delay = Math.min(
            RETRY_CONFIG.BASE_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_FACTOR, attempt - 1),
            RETRY_CONFIG.MAX_DELAY
          );
          await this._sleep(delay);
        }
        
      } catch (error) {
        lastError = this.handleError(error).error;
        
        if (!withRetry || !this._isRetryableError(lastError)) {
          break;
        }
        
        if (attempt < maxAttempts) {
          const delay = Math.min(
            RETRY_CONFIG.BASE_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_FACTOR, attempt - 1),
            RETRY_CONFIG.MAX_DELAY
          );
          await this._sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
      detectionResult: this.detectionResult
    };
  }

  /**
   * Perform a single connection test attempt
   * @private
   * @returns {Promise<{success: boolean, siteInfo?: Object, error?: Object}>}
   */
  async _performConnectionTest() {
    // Ensure site detection has been performed
    if (!this.isDetectionComplete()) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.API_NOT_FOUND,
          message: 'Site detection must be performed before connection test'
        }
      };
    }
    
    // If detection failed, return the detection error
    if (!this.detectionResult.success) {
      return {
        success: false,
        error: this.detectionResult.error
      };
    }

    // Test user authentication with detected endpoints
    const authResult = await this._testAuthentication();
    if (!authResult.success) {
      return authResult;
    }

    // Combine detection info with authentication result
    return {
      success: true,
      siteInfo: {
        ...this.siteInfo,
        authenticationValid: true,
        apiVersion: this.detectionResult.apiVersion || 'Unknown',
        siteType: this.siteType,
        capabilities: this.detectionResult.capabilities || [],
        isHttps: this.detectionResult.isHttps !== false
      }
    };
  }

  /**
   * Test site accessibility and API availability (deprecated - now handled by site detector)
   * @private
   * @returns {Promise<{success: boolean, siteInfo?: Object, error?: Object}>}
   */
  async _testSiteInfo() {
    // This method is now deprecated as site info is obtained during detection
    // Return the cached site info from detection
    if (this.siteInfo) {
      return {
        success: true,
        siteInfo: this.siteInfo
      };
    }
    
    return {
      success: false,
      error: {
        code: ERROR_CODES.API_NOT_FOUND,
        message: 'Site information not available - detection may have failed'
      }
    };
  }

  /**
   * Test user authentication and permissions using detected endpoints
   * @private
   * @returns {Promise<{success: boolean, error?: Object}>}
   */
  async _testAuthentication() {
    try {
      let endpoint;
      
      if (this.siteType === SITE_TYPES.WORDPRESS_COM) {
        endpoint = `${this.apiEndpoint}${WPCOM_API_ENDPOINTS.USERS}`;
      } else {
        // Handle different REST API formats
        if (this.detectionResult.useRestRoute) {
          endpoint = `${this.apiEndpoint}/?rest_route=/wp/v2/users/me`;
        } else {
          endpoint = `${this.apiEndpoint}/wp/v2/users/me`;
        }
      }
      
      let response;
      let fallbackUsed = false;
      
      try {
        response = await this.httpClient.get(endpoint);
      } catch (usersMeError) {
        // If /users/me fails, try using posts endpoint as fallback
        this.logger.debug('Primary auth endpoint failed, trying fallback', {
          primaryEndpoint: endpoint,
          error: usersMeError.response?.status
        });
        
        const fallbackEndpoint = this.detectionResult.useRestRoute 
          ? `${this.apiEndpoint}/?rest_route=/wp/v2/posts`
          : `${this.apiEndpoint}/wp/v2/posts`;
          
        try {
          response = await this.httpClient.get(fallbackEndpoint, {
            params: { per_page: 1 }
          });
          fallbackUsed = true;
          
          this.logger.debug('Fallback authentication successful', {
            endpoint: fallbackEndpoint,
            status: response.status
          });
        } catch (fallbackError) {
          throw usersMeError; // Throw original error if fallback also fails
        }
      }
      
      if (response.status === 200) {
        this.logger.debug('Authentication test successful', {
          siteUrl: this.siteUrl,
          siteType: this.siteType,
          endpoint: fallbackUsed ? 'posts (fallback)' : endpoint,
          fallbackUsed
        });
        
        if (fallbackUsed) {
          // For fallback, we don't have user info but auth worked
          return { 
            success: true,
            userInfo: {
              id: 'authenticated',
              username: 'authenticated_user',
              displayName: 'Authenticated User',
              email: null
            },
            fallbackAuth: true
          };
        } else {
          // Normal user info response
          return { 
            success: true,
            userInfo: {
              id: response.data.id,
              username: response.data.username || response.data.slug,
              displayName: response.data.name || response.data.display_name,
              email: response.data.email
            }
          };
        }
      }
      
      return {
        success: false,
        error: {
          code: ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
          message: 'Authentication successful but insufficient permissions'
        }
      };
    } catch (error) {
      const errorResult = this.handleError(error);
      
      // Enhance error message for authentication failures based on site type
      if (errorResult.error.code === ERROR_CODES.AUTH_INVALID_CREDENTIALS) {
        if (this.siteType === SITE_TYPES.WORDPRESS_COM) {
          errorResult.error.message = 'Invalid WordPress.com OAuth token or insufficient permissions';
          errorResult.error.details = {
            ...errorResult.error.details,
            suggestion: 'Verify your WordPress.com OAuth token is valid and has the required scopes'
          };
        } else {
          errorResult.error.message = 'Invalid WordPress application password or username';
          errorResult.error.details = {
            ...errorResult.error.details,
            suggestion: 'Verify your WordPress application password is correct and not expired'
          };
        }
      }
      
      return errorResult;
    }
  }

  /**
   * Check if an error is retryable (transient failure)
   * @private
   * @param {Object} error - Error object
   * @returns {boolean} Whether the error is retryable
   */
  _isRetryableError(error) {
    const retryableCodes = [
      ERROR_CODES.NETWORK_TIMEOUT,
      ERROR_CODES.NETWORK_UNREACHABLE,
      ERROR_CODES.API_RATE_LIMITED
    ];
    
    return retryableCodes.includes(error.code) || 
           (error.code === 'API_ERROR' && error.details && error.details.status >= 500);
  }

  /**
   * Sleep for specified milliseconds
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get WordPress site information (uses cached data from detection)
   * @param {boolean} refresh - Whether to refresh site info from API
   * @returns {Promise<Object>} Site information
   */
  async getSiteInfo(refresh = false) {
    // Return cached site info if available and not refreshing
    if (!refresh && this.siteInfo) {
      return {
        ...this.siteInfo,
        siteType: this.siteType,
        apiVersion: this.detectionResult?.apiVersion || 'Unknown',
        capabilities: this.detectionResult?.capabilities || []
      };
    }
    
    // Ensure detection has been performed
    if (!this.isDetectionComplete()) {
      await this.performSiteDetection();
    }
    
    if (!this.detectionResult.success) {
      throw this.createError(new Error(this.detectionResult.error.message));
    }
    
    try {
      let endpoint;
      
      if (this.siteType === SITE_TYPES.WORDPRESS_COM) {
        endpoint = `${this.apiEndpoint}`;
      } else {
        // Handle different REST API formats
        if (this.detectionResult.useRestRoute) {
          endpoint = `${this.apiEndpoint}/?rest_route=/`;
        } else {
          endpoint = `${this.apiEndpoint}`;
        }
      }
      
      const response = await this.httpClient.get(endpoint);
      
      const siteInfo = {
        name: response.data.name || 'WordPress Site',
        url: response.data.url || response.data.URL || this.siteUrl,
        description: response.data.description || '',
        version: response.data.version || 'Unknown',
        siteType: this.siteType,
        apiVersion: this.detectionResult?.apiVersion || 'Unknown',
        capabilities: this.detectionResult?.capabilities || []
      };
      
      // Update cached site info
      this.siteInfo = siteInfo;
      
      return siteInfo;
    } catch (error) {
      throw this.createError(error);
    }
  }

  /**
   * Upload media file to WordPress
   * @param {Buffer|string} fileData - File data (Buffer or base64 string)
   * @param {Object} options - Upload options
   * @param {string} options.filename - Original filename
   * @param {string} options.mimeType - MIME type of the file
   * @param {string} [options.title] - Media title
   * @param {string} [options.altText] - Alt text for images
   * @param {string} [options.caption] - Media caption
   * @param {string} [options.description] - Media description
   * @returns {Promise<Object>} Uploaded media information
   */
  async uploadMedia(fileData, options = {}) {
    // Ensure detection has been performed
    if (!this.isDetectionComplete()) {
      await this.performSiteDetection();
    }
    
    if (!this.detectionResult.success) {
      throw this.createError(new Error(this.detectionResult.error.message));
    }

    // Validate required options
    if (!options.filename) {
      throw this.createError(new Error('Filename is required for media upload'));
    }
    
    if (!options.mimeType) {
      throw this.createError(new Error('MIME type is required for media upload'));
    }

    // Validate file data
    if (!fileData) {
      throw this.createError(new Error('File data is required for media upload'));
    }

    try {
      let endpoint;
      
      if (this.siteType === SITE_TYPES.WORDPRESS_COM) {
        endpoint = `${this.apiEndpoint}${WPCOM_API_ENDPOINTS.MEDIA}`;
      } else {
        // Handle different REST API formats
        if (this.detectionResult.useRestRoute) {
          endpoint = `${this.apiEndpoint}/?rest_route=/wp/v2/media`;
        } else {
          endpoint = `${this.apiEndpoint}/wp/v2/media`;
        }
      }

      // Prepare form data for multipart upload
      const FormData = require('form-data');
      const formData = new FormData();

      // Convert file data to buffer if it's a base64 string
      let fileBuffer;
      if (typeof fileData === 'string') {
        // Assume base64 string, remove data URL prefix if present
        const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
        fileBuffer = Buffer.from(base64Data, 'base64');
      } else if (Buffer.isBuffer(fileData)) {
        fileBuffer = fileData;
      } else {
        throw this.createError(new Error('File data must be a Buffer or base64 string'));
      }

      // Add file to form data
      formData.append('file', fileBuffer, {
        filename: options.filename,
        contentType: options.mimeType
      });

      // Add optional metadata
      if (options.title) {
        formData.append('title', options.title);
      }
      
      if (options.altText) {
        formData.append('alt_text', options.altText);
      }
      
      if (options.caption) {
        formData.append('caption', options.caption);
      }
      
      if (options.description) {
        formData.append('description', options.description);
      }

      // Set longer timeout for media upload
      const originalTimeout = this.httpClient.defaults.timeout;
      this.httpClient.defaults.timeout = TIMEOUT_CONFIG.MEDIA_UPLOAD;

      // Update headers for multipart upload
      const uploadHeaders = {
        ...this.httpClient.defaults.headers.common,
        ...formData.getHeaders()
      };

      this.logger.debug('Uploading media to WordPress', {
        siteUrl: this.siteUrl,
        siteType: this.siteType,
        endpoint,
        filename: options.filename,
        mimeType: options.mimeType,
        fileSize: fileBuffer.length
      });

      const response = await this.httpClient.post(endpoint, formData, {
        headers: uploadHeaders,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      // Restore original timeout
      this.httpClient.defaults.timeout = originalTimeout;

      const mediaInfo = {
        id: response.data.id,
        title: response.data.title?.rendered || response.data.title || options.title,
        url: response.data.source_url || response.data.guid?.rendered,
        filename: response.data.media_details?.file || options.filename,
        mimeType: response.data.mime_type || options.mimeType,
        fileSize: response.data.media_details?.filesize || fileBuffer.length,
        altText: response.data.alt_text || options.altText,
        caption: response.data.caption?.rendered || response.data.caption || options.caption,
        description: response.data.description?.rendered || response.data.description || options.description,
        uploadDate: response.data.date || new Date().toISOString()
      };

      this.logger.info('WordPress media uploaded successfully', {
        siteUrl: this.siteUrl,
        mediaId: mediaInfo.id,
        mediaUrl: mediaInfo.url,
        filename: mediaInfo.filename,
        fileSize: mediaInfo.fileSize
      });

      return mediaInfo;
    } catch (error) {
      // Restore original timeout on error
      this.httpClient.defaults.timeout = TIMEOUT_CONFIG.CONNECTION_TEST;
      
      // Enhance error message for media upload failures
      if (error.response?.status === 413) {
        const enhancedError = new Error('File too large for upload');
        enhancedError.code = ERROR_CODES.CONTENT_TOO_LARGE;
        enhancedError.details = { 
          originalError: error.message,
          suggestion: 'Try reducing the file size or check WordPress upload limits'
        };
        throw this.createError(enhancedError);
      }
      
      if (error.response?.status === 415) {
        const enhancedError = new Error('Unsupported media type');
        enhancedError.code = ERROR_CODES.CONTENT_INVALID_FORMAT;
        enhancedError.details = { 
          originalError: error.message,
          mimeType: options.mimeType,
          suggestion: 'Check that the file type is supported by WordPress'
        };
        throw this.createError(enhancedError);
      }

      throw this.createError(error);
    }
  }

  /**
   * Create a WordPress post using detected endpoints
   * @param {Object} postData - Post data in WordPress format
   * @param {Object} [options] - Additional options
   * @param {number} [options.featuredImageId] - ID of featured image from media library
   * @returns {Promise<Object>} Created post information
   */
  async createPost(postData, options = {}) {
    // Ensure detection has been performed
    if (!this.isDetectionComplete()) {
      await this.performSiteDetection();
    }
    
    if (!this.detectionResult.success) {
      throw this.createError(new Error(this.detectionResult.error.message));
    }
    
    try {
      let endpoint;
      
      if (this.siteType === SITE_TYPES.WORDPRESS_COM) {
        endpoint = `${this.apiEndpoint}${WPCOM_API_ENDPOINTS.POSTS}`;
      } else {
        // Handle different REST API formats
        if (this.detectionResult.useRestRoute) {
          endpoint = `${this.apiEndpoint}/?rest_route=/wp/v2/posts`;
        } else {
          endpoint = `${this.apiEndpoint}/wp/v2/posts`;
        }
      }
      
      // Set longer timeout for post creation
      const originalTimeout = this.httpClient.defaults.timeout;
      this.httpClient.defaults.timeout = TIMEOUT_CONFIG.POST_CREATION;
      
      // Add featured image if provided
      const finalPostData = { ...postData };
      if (options.featuredImageId && typeof options.featuredImageId === 'number') {
        finalPostData.featured_media = options.featuredImageId;
      }

      this.logger.debug('Creating WordPress post', {
        siteUrl: this.siteUrl,
        siteType: this.siteType,
        endpoint,
        postTitle: postData.title,
        featuredImageId: options.featuredImageId
      });
      
      const response = await this.httpClient.post(endpoint, finalPostData);
      
      // Restore original timeout
      this.httpClient.defaults.timeout = originalTimeout;
      
      const postInfo = {
        id: response.data.id,
        title: response.data.title?.rendered || response.data.title || postData.title,
        url: response.data.link || response.data.URL,
        editUrl: this.generateEditUrl(response.data),
        status: response.data.status
      };
      
      this.logger.info('WordPress post created successfully', {
        siteUrl: this.siteUrl,
        postId: postInfo.id,
        postUrl: postInfo.url,
        status: postInfo.status
      });
      
      return postInfo;
    } catch (error) {
      throw this.createError(error);
    }
  }

  /**
   * Generate edit URL for WordPress post based on site type
   * @private
   * @param {Object} postData - WordPress post response data
   * @returns {string} Edit URL
   */
  generateEditUrl(postData) {
    if (postData.edit_link) {
      return postData.edit_link;
    }
    
    if (this.siteType === SITE_TYPES.WORDPRESS_COM) {
      // WordPress.com edit URLs
      const siteId = this.detectionResult.siteId || this.siteUrl.replace(/^https?:\/\//, '');
      return `https://wordpress.com/post/${siteId}/${postData.id}`;
    } else {
      // Self-hosted WordPress edit URLs
      return `${this.siteUrl}/wp-admin/post.php?post=${postData.id}&action=edit`;
    }
  }

  /**
   * Handle HTTP errors and convert to standardized format
   * @param {Error} error - Axios error object
   * @returns {Object} Standardized error response
   */
  handleError(error) {
    const context = {
      siteUrl: this.siteUrl,
      siteType: this.siteType,
      operation: 'wordpress_service_error'
    };
    
    return this.errorHandler.handleError(error, context);
  }

  /**
   * Create standardized error for throwing
   * @param {Error} error - Original error
   * @returns {Error} Standardized error
   */
  createError(error) {
    const errorResponse = this.handleError(error);
    const wpError = new Error(errorResponse.error.message);
    wpError.code = errorResponse.error.code;
    wpError.userMessage = errorResponse.error.userMessage;
    wpError.details = errorResponse.error.details;
    wpError.suggestions = errorResponse.error.details?.suggestions;
    return wpError;
  }

  /**
   * Get WordPress categories
   * @returns {Promise<Object>} Categories list or error
   */
  async getCategories() {
    // Ensure detection has been performed
    if (!this.isDetectionComplete()) {
      await this.performSiteDetection();
    }

    if (!this.detectionResult.success) {
      return {
        success: false,
        error: this.detectionResult.error
      };
    }

    // Ensure authentication is set up
    this.setupAuthentication();

    try {
      this.logger.info('Fetching WordPress categories via REST API...');
      
      const endpoint = this.getEndpoint('CATEGORIES');
      this.logger.debug('Categories endpoint:', { endpoint });
      
      // Try authenticated request first
      let response;
      try {
        response = await this.httpClient.get(endpoint);
      } catch (authError) {
        // If authenticated request fails, try without authentication (categories are often public)
        this.logger.debug('Authenticated categories request failed, trying public access...', { error: authError.message });
        
        const publicResponse = await this.httpClient.get(endpoint, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'QueryFuel-WordPress-Integration/1.0'
          }
        });
        response = publicResponse;
      }
      this.logger.debug('Categories API response received', { 
        status: response?.status, 
        dataLength: response?.data?.length,
        headers: response?.headers ? Object.keys(response.headers) : []
      });
      
      if (response && response.data) {
        const categories = response.data
          .filter(cat => cat && cat.id && cat.name) // Filter out invalid entries
          .map(cat => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug || '',
            count: cat.count || 0,
            parent: cat.parent || 0
          }))
          .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

        this.logger.info('Categories fetched successfully via REST API', { 
          count: categories.length,
          categories: categories.slice(0, 5).map(c => c.name) // Log first 5 for debugging
        });

        return {
          success: true,
          categories: categories
        };
      } else {
        this.logger.error('Invalid response format from WordPress categories API', { response });
        throw new Error('Invalid response format from WordPress API');
      }
    } catch (error) {
      this.logger.error('Failed to fetch categories via REST API', { 
        error: error.message,
        endpoint: this.getEndpoint('CATEGORIES'),
        statusCode: error.response?.status,
        responseData: error.response?.data
      });

      return {
        success: false,
        error: {
          code: 'CATEGORIES_FETCH_FAILED',
          message: error.message || 'Failed to fetch categories from WordPress'
        }
      };
    }
  }

  /**
   * Check API compatibility with current WordPress installation
   * @returns {Promise<Object>} Compatibility check result
   */
  async checkApiCompatibility() {
    if (!this.isDetectionComplete()) {
      await this.performSiteDetection();
    }
    
    if (!this.detectionResult.success) {
      return {
        isCompatible: false,
        error: this.detectionResult.error
      };
    }
    
    const apiVersion = this.detectionResult.apiVersion || 'Unknown';
    return this.siteDetector.checkApiCompatibility(apiVersion);
  }

  /**
   * Get available WordPress capabilities
   * @returns {Array} List of available capabilities
   */
  getCapabilities() {
    return this.detectionResult?.capabilities || [];
  }

  /**
   * Check if a specific capability is available
   * @param {string} capability - Capability to check
   * @returns {boolean} Whether capability is available
   */
  hasCapability(capability) {
    const capabilities = this.getCapabilities();
    return capabilities.includes(capability);
  }

  /**
   * Get WordPress installation type
   * @returns {string|null} Site type or null if not detected
   */
  getSiteType() {
    return this.siteType;
  }

  /**
   * Get resolved API endpoint
   * @returns {string|null} API endpoint or null if not detected
   */
  getApiEndpoint() {
    return this.apiEndpoint;
  }

  /**
   * Get endpoint URL for a specific resource
   * @param {string} resource - Resource name (e.g., 'CATEGORIES', 'POSTS', 'USERS')
   * @returns {string} Full endpoint URL
   */
  getEndpoint(resource) {
    if (!this.apiEndpoint || !this.detectionResult?.success) {
      throw new Error('Site detection not completed or failed');
    }

    let endpoint;
    
    if (this.siteType === SITE_TYPES.WORDPRESS_COM) {
      // WordPress.com endpoints
      const wpcomPath = WPCOM_API_ENDPOINTS[resource];
      if (!wpcomPath) {
        throw new Error(`Unknown resource: ${resource}`);
      }
      endpoint = `${this.apiEndpoint}${wpcomPath}`;
    } else {
      // Self-hosted WordPress endpoints - extract just the API path part
      const wpPath = WP_API_ENDPOINTS[resource];
      if (!wpPath) {
        throw new Error(`Unknown resource: ${resource}`);
      }
      
      // Remove /wp-json prefix from the path since apiEndpoint already includes it
      const apiPath = wpPath.replace('/wp-json', '');
      
      if (this.detectionResult.useRestRoute) {
        // Some hosts require ?rest_route= format
        endpoint = `${this.apiEndpoint}/?rest_route=${apiPath}`;
      } else {
        // Standard format: apiEndpoint already includes /wp-json
        endpoint = `${this.apiEndpoint}${apiPath}`;
      }
    }

    return endpoint;
  }

  /**
   * Test connection with fallback mechanisms
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test result with fallback information
   */
  async testConnectionWithFallbacks(options = {}) {
    const result = await this.testConnection(options);
    
    if (result.success) {
      return result;
    }
    
    // If initial test failed, try fallback mechanisms
    const fallbackResults = [];
    
    // Try HTTP if HTTPS failed (for self-hosted sites)
    if (this.siteUrl.startsWith('https://') && 
        result.error?.code === ERROR_CODES.NETWORK_SSL_ERROR) {
      
      try {
        const httpUrl = this.siteUrl.replace('https://', 'http://');
        const fallbackService = new WordPressService(httpUrl, this.username, this.applicationPassword, {
          logger: this.logger
        });
        
        const fallbackResult = await fallbackService.testConnection({ ...options, skipDetection: false });
        
        if (fallbackResult.success) {
          fallbackResults.push({
            type: 'http_fallback',
            success: true,
            url: httpUrl,
            result: fallbackResult
          });
        }
      } catch (error) {
        fallbackResults.push({
          type: 'http_fallback',
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      ...result,
      fallbackResults
    };
  }
}

module.exports = WordPressService;