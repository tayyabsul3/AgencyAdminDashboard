/**
 * Hybrid WordPress Service
 * Tries REST API first, falls back to XML-RPC (like Zapier)
 */

const WordPressService = require('./WordPressService');
const WordPressXmlRpcService = require('./XmlRpcService');

class HybridWordPressService {
  constructor(siteUrl, username, password, options = {}) {
    this.siteUrl = siteUrl;
    this.username = username;
    this.password = password;
    this.logger = options.logger || console;

    // Initialize both services
    this.restService = new WordPressService(siteUrl, username, password, options);
    this.xmlrpcService = new WordPressXmlRpcService(siteUrl, username, password, options);

    // Track which service is working
    this.preferredService = null;
    this.restApiWorking = null;
    this.xmlrpcWorking = null;
  }

  /**
   * Test connection with both methods
   */
  async testConnection() {
    this.logger.info('Testing WordPress connection with hybrid approach...');

    // Test REST API first
    this.logger.debug('Trying REST API...');
    try {
      const restResult = await this.restService.testConnection();
      if (restResult.success) {
        this.logger.info('✅ REST API working - will use as primary method');
        this.restApiWorking = true;
        this.preferredService = 'rest';
        return {
          success: true,
          method: 'rest',
          siteInfo: restResult.siteInfo,
          fallbackAvailable: true
        };
      } else {
        this.logger.debug('REST API failed:', restResult.error?.message);
        this.restApiWorking = false;
      }
    } catch (error) {
      this.logger.debug('REST API error:', error.message);
      this.restApiWorking = false;
    }

    // Fallback to XML-RPC
    this.logger.debug('Trying XML-RPC fallback...');
    try {
      const xmlrpcResult = await this.xmlrpcService.testConnection();
      if (xmlrpcResult.success) {
        this.logger.info('✅ XML-RPC working - using as fallback method');
        this.xmlrpcWorking = true;
        this.preferredService = 'xmlrpc';
        return {
          success: true,
          method: 'xmlrpc',
          siteInfo: xmlrpcResult.siteInfo,
          restApiFailed: true
        };
      } else {
        this.logger.debug('XML-RPC failed:', xmlrpcResult.error?.message);
        this.xmlrpcWorking = false;
      }
    } catch (error) {
      this.logger.debug('XML-RPC error:', error.message);
      this.xmlrpcWorking = false;
    }

    // Both methods failed
    return {
      success: false,
      error: {
        code: 'ALL_METHODS_FAILED',
        message: 'Both REST API and XML-RPC connection attempts failed',
        details: {
          restApiWorking: this.restApiWorking,
          xmlrpcWorking: this.xmlrpcWorking
        }
      }
    };
  }

  /**
   * Upload media with fallback and retry logic
   */
  async uploadMedia(fileData, options = {}) {
    let restError = null;
    let xmlrpcError = null;
    const maxRetries = 2; // Try up to 3 times total (1 initial + 2 retries)

    // Try preferred service first with retry logic
    if (this.preferredService === 'rest' && this.restApiWorking !== false) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff: 1s, 2s, max 5s
            this.logger.debug(`Retrying media upload (attempt ${attempt + 1}/${maxRetries + 1}) after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            this.logger.debug('Attempting media upload via REST API...');
          }
          
          return await this.restService.uploadMedia(fileData, options);
        } catch (error) {
          const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
          const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
          
          // Only retry on timeout or network errors
          if ((isTimeout || isNetworkError) && attempt < maxRetries) {
            this.logger.warn(`Media upload attempt ${attempt + 1} failed with ${error.code}, retrying...`);
            restError = error;
            continue;
          }
          
          this.logger.error('REST API media upload failed:', {
            error: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            attempts: attempt + 1
          });
          restError = error;
          this.restApiWorking = false;
          break;
        }
      }
    }

    // Fallback to XML-RPC
    if (this.xmlrpcWorking !== false) {
      try {
        this.logger.debug('Attempting media upload via XML-RPC...');
        return await this.xmlrpcService.uploadMedia(fileData, options);
      } catch (error) {
        this.logger.error('XML-RPC media upload failed:', {
          error: error.message
        });
        xmlrpcError = error;
        this.xmlrpcWorking = false;
      }
    }

    // Both methods failed - provide detailed error information
    const errorDetails = {
      restError: restError?.message,
      xmlrpcError: xmlrpcError?.message,
      restStatus: restError?.response?.status,
      xmlrpcStatus: xmlrpcError?.response?.status
    };

    this.logger.error('All WordPress media upload methods failed', errorDetails);

    // Determine the most relevant error to throw
    const primaryError = restError || xmlrpcError;
    if (primaryError?.response?.status === 401) {
      throw new Error('WordPress authentication failed. Please check your username and application password.');
    } else if (primaryError?.response?.status === 403) {
      throw new Error('WordPress user does not have permission to upload media. Please ensure the user has Editor or Administrator role.');
    } else {
      throw new Error(`Media upload failed: No working WordPress API method available. REST: ${restError?.message || 'not attempted'}, XML-RPC: ${xmlrpcError?.message || 'not attempted'}`);
    }
  }

  /**
   * Get categories with fallback
   */
  async getCategories() {
    // Always try REST API first for categories (more reliable)
    try {
      this.logger.info('Attempting to fetch categories via REST API...');
      
      // Check if REST service is properly initialized
      if (!this.restService) {
        throw new Error('REST service not initialized');
      }
      
      const result = await this.restService.getCategories();
      
      if (result && result.success) {
        this.restApiWorking = true;
        this.logger.info('Categories fetched successfully via REST API', { count: result.categories?.length });
        return result;
      } else {
        this.logger.warn('REST API categories returned unsuccessful result', { 
          result: result,
          error: result?.error 
        });
        throw new Error(result?.error?.message || 'REST API categories fetch unsuccessful');
      }
    } catch (error) {
      this.logger.warn('REST API categories fetch failed, trying XML-RPC fallback...', { 
        error: error.message,
        stack: error.stack?.split('\n')[0] // Just first line of stack
      });
      this.restApiWorking = false;
    }

    // Fallback to XML-RPC (which now has better error handling)
    try {
      this.logger.info('Attempting to fetch categories via XML-RPC...');
      const result = await this.xmlrpcService.getCategories();
      if (result.success) {
        this.logger.info('Categories fetched successfully via XML-RPC', { count: result.categories?.length });
        return result;
      } else {
        throw new Error(result.error?.message || 'XML-RPC categories fetch failed');
      }
    } catch (error) {
      this.logger.warn('XML-RPC categories fetch failed:', error.message);
      this.xmlrpcWorking = false;
      
      // Return fallback categories instead of throwing error
      this.logger.info('Returning fallback categories due to API failures');
      return {
        success: true,
        categories: [{
          id: 1,
          name: 'Uncategorized',
          slug: 'uncategorized',
          count: 0,
          parent: 0
        }]
      };
    }
  }

  /**
   * Create post with fallback
   */
  async createPost(postData, options = {}) {
    let restError = null;
    let xmlrpcError = null;

    // Try preferred service first
    if (this.preferredService === 'rest' && this.restApiWorking !== false) {
      try {
        this.logger.debug('Attempting post creation via REST API...');
        return await this.restService.createPost(postData, options);
      } catch (error) {
        this.logger.error('REST API post creation failed:', {
          error: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText
        });
        restError = error;
        this.restApiWorking = false;
      }
    }

    // Fallback to XML-RPC
    if (this.xmlrpcWorking !== false) {
      try {
        this.logger.debug('Attempting post creation via XML-RPC...');
        return await this.xmlrpcService.createPost(postData, options);
      } catch (error) {
        this.logger.error('XML-RPC post creation failed:', {
          error: error.message
        });
        xmlrpcError = error;
        this.xmlrpcWorking = false;
      }
    }

    // Both methods failed - provide detailed error information
    const errorDetails = {
      restError: restError?.message,
      xmlrpcError: xmlrpcError?.message,
      restStatus: restError?.response?.status,
      xmlrpcStatus: xmlrpcError?.response?.status
    };

    this.logger.error('All WordPress API methods failed', errorDetails);

    // Determine the most relevant error to throw
    const primaryError = restError || xmlrpcError;
    if (primaryError?.response?.status === 401) {
      throw new Error('WordPress authentication failed. Please check your username and application password.');
    } else if (primaryError?.response?.status === 403) {
      throw new Error('WordPress user does not have permission to create posts. Please ensure the user has Editor or Administrator role.');
    } else {
      throw new Error(`Post creation failed: No working WordPress API method available. REST: ${restError?.message || 'not attempted'}, XML-RPC: ${xmlrpcError?.message || 'not attempted'}`);
    }
  }

  /**
   * Get site info with fallback
   */
  async getSiteInfo() {
    if (this.preferredService === 'rest' && this.restApiWorking !== false) {
      try {
        return await this.restService.getSiteInfo();
      } catch (error) {
        this.logger.debug('REST API getSiteInfo failed, trying XML-RPC...');
        this.restApiWorking = false;
      }
    }

    // XML-RPC doesn't have a direct equivalent, return basic info
    return {
      name: 'WordPress Site',
      url: this.siteUrl,
      method: 'xmlrpc',
      description: 'Connected via XML-RPC'
    };
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      preferredService: this.preferredService,
      restApiWorking: this.restApiWorking,
      xmlrpcWorking: this.xmlrpcWorking,
      hasWorkingConnection: this.preferredService !== null
    };
  }
}

module.exports = HybridWordPressService;