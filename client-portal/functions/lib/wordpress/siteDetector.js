/**
 * WordPress Site Detection Service
 * Handles detection of WordPress installation types and API endpoint resolution
 */

const axios = require('axios');
const { WP_API_ENDPOINTS, WPCOM_API_ENDPOINTS, ERROR_CODES, SITE_TYPES } = require('./constants');

class WordPressSiteDetector {
  constructor(options = {}) {
    this.timeout = options.timeout || 10000;
    this.logger = options.logger || console;
  }

  /**
   * Detect WordPress installation type and resolve API endpoints
   * @param {string} siteUrl - WordPress site URL
   * @returns {Promise<Object>} Detection result with site type and endpoints
   */
  async detectSite(siteUrl) {
    const normalizedUrl = this.normalizeSiteUrl(siteUrl);
    
    try {
      // First, try to determine if it's WordPress.com based on URL patterns
      const urlBasedDetection = this.detectFromUrl(normalizedUrl);
      
      if (urlBasedDetection.isWordPressCom) {
        return await this.detectWordPressCom(normalizedUrl);
      }
      
      // For potential self-hosted sites, probe the API endpoints
      return await this.detectSelfHosted(normalizedUrl);
      
    } catch (error) {
      this.logger.error('Site detection failed', {
        siteUrl: normalizedUrl,
        error: error.message
      });
      
      return {
        success: false,
        siteType: null,
        apiEndpoint: null,
        error: {
          code: ERROR_CODES.API_NOT_FOUND,
          message: 'Unable to detect WordPress installation type',
          details: { originalError: error.message }
        }
      };
    }
  }

  /**
   * Normalize site URL to ensure consistent format
   * @param {string} url - Raw site URL
   * @returns {string} Normalized URL
   */
  normalizeSiteUrl(url) {
    if (!url) {
      throw new Error('Site URL is required');
    }
    
    // If URL already has protocol, preserve it
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url.replace(/\/$/, ''); // Just remove trailing slash
    }
    
    // Add HTTPS by default for URLs without protocol
    return `https://${url.replace(/\/$/, '')}`;
  }

  /**
   * Detect WordPress type based on URL patterns
   * @param {string} url - Normalized site URL
   * @returns {Object} URL-based detection result
   */
  detectFromUrl(url) {
    const urlLower = url.toLowerCase();
    
    // WordPress.com patterns
    const wpcomPatterns = [
      /\.wordpress\.com$/,
      /\.wp\.com$/,
      /^https?:\/\/wordpress\.com\//,
      /\.wpcomstaging\.com$/
    ];
    
    const isWordPressCom = wpcomPatterns.some(pattern => pattern.test(urlLower));
    
    return {
      isWordPressCom,
      isSelfHosted: !isWordPressCom
    };
  }

  /**
   * Detect and configure WordPress.com site
   * @param {string} siteUrl - WordPress.com site URL
   * @returns {Promise<Object>} Detection result
   */
  async detectWordPressCom(siteUrl) {
    try {
      // Extract site identifier for WordPress.com API
      const siteId = this.extractWordPressComSiteId(siteUrl);
      const apiEndpoint = `${WPCOM_API_ENDPOINTS.BASE}/${siteId}`;
      
      // Test WordPress.com API accessibility
      const testResult = await this.testWordPressComApi(apiEndpoint);
      
      if (testResult.success) {
        return {
          success: true,
          siteType: SITE_TYPES.WORDPRESS_COM,
          apiEndpoint,
          siteId,
          apiVersion: 'WordPress.com API v2',
          authMethod: 'oauth',
          capabilities: testResult.capabilities || [],
          siteInfo: testResult.siteInfo
        };
      }
      
      return {
        success: false,
        siteType: SITE_TYPES.WORDPRESS_COM,
        apiEndpoint,
        error: testResult.error
      };
      
    } catch (error) {
      return {
        success: false,
        siteType: SITE_TYPES.WORDPRESS_COM,
        apiEndpoint: null,
        error: {
          code: ERROR_CODES.API_NOT_FOUND,
          message: 'WordPress.com API not accessible',
          details: { originalError: error.message }
        }
      };
    }
  }

  /**
   * Extract site identifier from WordPress.com URL
   * @param {string} siteUrl - WordPress.com site URL
   * @returns {string} Site identifier for API calls
   */
  extractWordPressComSiteId(siteUrl) {
    // Remove protocol and extract domain
    const domain = siteUrl.replace(/^https?:\/\//, '');
    
    // For WordPress.com sites, the site ID is typically the domain
    // Handle different WordPress.com URL formats
    if (domain.endsWith('.wordpress.com')) {
      return domain;
    }
    
    if (domain.endsWith('.wp.com')) {
      return domain;
    }
    
    // For custom domains on WordPress.com, use the domain as-is
    return domain;
  }

  /**
   * Test WordPress.com API accessibility
   * @param {string} apiEndpoint - WordPress.com API endpoint
   * @returns {Promise<Object>} Test result
   */
  async testWordPressComApi(apiEndpoint) {
    try {
      const response = await axios.get(apiEndpoint, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'QueryFuel-WordPress-Integration/1.0'
        }
      });
      
      if (response.status === 200) {
        return {
          success: true,
          siteInfo: {
            name: response.data.name || 'WordPress.com Site',
            url: response.data.URL || response.data.url,
            description: response.data.description || ''
          },
          capabilities: this.extractWordPressComCapabilities(response.data)
        };
      }
      
      return {
        success: false,
        error: {
          code: ERROR_CODES.API_NOT_FOUND,
          message: 'WordPress.com site not accessible'
        }
      };
      
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.API_NOT_FOUND,
            message: 'WordPress.com site not found'
          }
        };
      }
      
      return {
        success: false,
        error: {
          code: ERROR_CODES.NETWORK_UNREACHABLE,
          message: 'Unable to connect to WordPress.com API',
          details: { status: error.response?.status, message: error.message }
        }
      };
    }
  }

  /**
   * Extract capabilities from WordPress.com API response
   * @param {Object} siteData - WordPress.com site data
   * @returns {Array} Available capabilities
   */
  extractWordPressComCapabilities(siteData) {
    const capabilities = [];
    
    if (siteData.capabilities) {
      capabilities.push(...Object.keys(siteData.capabilities));
    }
    
    // Add standard WordPress.com capabilities
    capabilities.push('posts', 'media', 'users');
    
    return [...new Set(capabilities)]; // Remove duplicates
  }

  /**
   * Detect and configure self-hosted WordPress site
   * @param {string} siteUrl - Self-hosted WordPress site URL
   * @returns {Promise<Object>} Detection result
   */
  async detectSelfHosted(siteUrl) {
    // Try different common WordPress REST API endpoints
    const endpointsToTry = [
      `${siteUrl}/wp-json/wp/v2`,
      `${siteUrl}/wp-json`,
      `${siteUrl}/index.php/wp-json/wp/v2`,
      `${siteUrl}/index.php/wp-json`,
      `${siteUrl}/?rest_route=/wp/v2`,
      `${siteUrl}/?rest_route=/`
    ];
    
    // Also try HTTP if HTTPS fails
    const urlsToTry = [siteUrl];
    if (siteUrl.startsWith('https://')) {
      urlsToTry.push(siteUrl.replace('https://', 'http://'));
    }
    
    for (const baseUrl of urlsToTry) {
      for (const endpoint of endpointsToTry) {
        const fullEndpoint = endpoint.replace(siteUrl, baseUrl);
        
        try {
          const result = await this.testSelfHostedApi(baseUrl, fullEndpoint);
          
          if (result.success) {
            // Determine the correct API endpoint base
            let apiEndpoint;
            if (fullEndpoint.includes('?rest_route=')) {
              // For rest_route format, we need to use the base URL with rest_route parameter
              apiEndpoint = baseUrl;
            } else {
              // For standard wp-json format, extract the base path
              apiEndpoint = fullEndpoint.replace(/\/wp\/v2$/, '').replace(/\/$/, '');
            }
            
            return {
              success: true,
              siteType: SITE_TYPES.SELF_HOSTED,
              apiEndpoint: apiEndpoint,
              restApiBase: fullEndpoint,
              apiVersion: result.apiVersion,
              authMethod: 'application_password',
              capabilities: result.capabilities || [],
              siteInfo: result.siteInfo,
              isHttps: baseUrl.startsWith('https://'),
              useRestRoute: fullEndpoint.includes('?rest_route=')
            };
          }
          
        } catch (error) {
          // Continue trying other endpoints
          this.logger.debug('Endpoint test failed', {
            endpoint: fullEndpoint,
            error: error.message
          });
        }
      }
    }
    
    // If all endpoints failed, return failure
    return {
      success: false,
      siteType: SITE_TYPES.SELF_HOSTED,
      apiEndpoint: siteUrl,
      error: {
        code: ERROR_CODES.API_NOT_FOUND,
        message: 'WordPress REST API not found or not accessible',
        details: {
          testedEndpoints: endpointsToTry,
          suggestion: 'Ensure WordPress REST API is enabled and accessible'
        }
      }
    };
  }

  /**
   * Test self-hosted WordPress REST API
   * @param {string} baseUrl - Base site URL
   * @param {string} apiEndpoint - Full API endpoint to test
   * @returns {Promise<Object>} Test result
   */
  async testSelfHostedApi(baseUrl, apiEndpoint) {
    try {
      const response = await axios.get(apiEndpoint, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'QueryFuel-WordPress-Integration/1.0'
        }
      });
      
      if (response.status === 200 && response.data) {
        // Check if this looks like a WordPress REST API response
        const isWordPressApi = this.validateWordPressApiResponse(response.data);
        
        if (isWordPressApi) {
          return {
            success: true,
            apiVersion: this.extractApiVersion(response.data),
            siteInfo: {
              name: response.data.name || 'WordPress Site',
              url: response.data.url || baseUrl,
              description: response.data.description || ''
            },
            capabilities: this.extractSelfHostedCapabilities(response.data)
          };
        }
      }
      
      return {
        success: false,
        error: {
          code: ERROR_CODES.API_VERSION_INCOMPATIBLE,
          message: 'Endpoint found but does not appear to be WordPress REST API'
        }
      };
      
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.API_NOT_FOUND,
            message: 'WordPress REST API endpoint not found'
          }
        };
      }
      
      return {
        success: false,
        error: {
          code: ERROR_CODES.NETWORK_UNREACHABLE,
          message: 'Unable to connect to WordPress site',
          details: { status: error.response?.status, message: error.message }
        }
      };
    }
  }

  /**
   * Validate that API response looks like WordPress REST API
   * @param {Object} data - API response data
   * @returns {boolean} Whether response appears to be WordPress REST API
   */
  validateWordPressApiResponse(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    // Check for common WordPress REST API indicators
    const indicators = [
      'name',
      'description',
      'url',
      'home',
      'namespaces',
      'routes'
    ];
    
    // Must have at least some WordPress-specific fields
    const hasWordPressFields = indicators.some(field => data.hasOwnProperty(field));
    
    // Check for WordPress-specific namespaces
    const hasWordPressNamespaces = !!(data.namespaces && 
      Array.isArray(data.namespaces) &&
      data.namespaces.some(ns => ns.includes('wp/v')));
    
    return hasWordPressFields || hasWordPressNamespaces;
  }

  /**
   * Extract API version from WordPress REST API response
   * @param {Object} data - API response data
   * @returns {string} API version
   */
  extractApiVersion(data) {
    // Try to find version in namespaces
    if (data.namespaces && Array.isArray(data.namespaces)) {
      const wpNamespace = data.namespaces.find(ns => ns.startsWith('wp/v'));
      if (wpNamespace) {
        return `WordPress REST API ${wpNamespace}`;
      }
    }
    
    // Fallback to generic version
    return 'WordPress REST API v2';
  }

  /**
   * Extract capabilities from self-hosted WordPress API response
   * @param {Object} data - API response data
   * @returns {Array} Available capabilities
   */
  extractSelfHostedCapabilities(data) {
    const capabilities = [];
    
    // Extract from routes if available
    if (data.routes) {
      const routes = Object.keys(data.routes);
      
      if (routes.some(route => route.includes('/posts'))) {
        capabilities.push('posts');
      }
      
      if (routes.some(route => route.includes('/media'))) {
        capabilities.push('media');
      }
      
      if (routes.some(route => route.includes('/users'))) {
        capabilities.push('users');
      }
      
      if (routes.some(route => route.includes('/categories'))) {
        capabilities.push('categories');
      }
      
      if (routes.some(route => route.includes('/tags'))) {
        capabilities.push('tags');
      }
    }
    
    // Add default capabilities if none found
    if (capabilities.length === 0) {
      capabilities.push('posts', 'media', 'users');
    }
    
    return capabilities;
  }

  /**
   * Check WordPress API version compatibility
   * @param {string} apiVersion - Detected API version
   * @returns {Object} Compatibility check result
   */
  checkApiCompatibility(apiVersion) {
    const supportedVersions = ['wp/v2', 'WordPress REST API v2'];
    
    const isCompatible = supportedVersions.some(version => 
      apiVersion.toLowerCase().includes(version.toLowerCase())
    );
    
    return {
      isCompatible,
      version: apiVersion,
      supportedVersions,
      recommendation: isCompatible 
        ? 'API version is supported'
        : 'API version may not be fully supported. Consider updating WordPress.'
    };
  }
}

module.exports = WordPressSiteDetector;