/**
 * API Authentication Utilities
 * Provides helpers for making authenticated API requests
 */

import { getCurrentUserToken, ensureFreshToken } from '../services/authService';

/**
 * Get authentication headers for API requests
 * @param {boolean} forceRefresh - Force token refresh
 * @returns {Promise<Object>} Headers object with Authorization
 */
export const getAuthHeaders = async (forceRefresh = false) => {
  try {
    const token = await getCurrentUserToken(forceRefresh);
    
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  } catch (error) {
    console.error('Error getting auth headers:', error);
    throw error;
  }
};

/**
 * Make authenticated API request with automatic token refresh
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @param {boolean} retryOnAuth - Retry with fresh token on auth failure
 * @returns {Promise<Response>} Fetch response
 */
export const authenticatedFetch = async (url, options = {}, retryOnAuth = true) => {
  try {
    // Get fresh token for the request
    const token = await ensureFreshToken();
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    // Prepare headers
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    // Make the request
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    // Handle authentication errors with retry
    if (response.status === 401 && retryOnAuth) {
      console.log('Auth failed, retrying with fresh token');
      
      // Get a fresh token and retry once
      const freshToken = await getCurrentUserToken(true);
      if (freshToken) {
        const retryHeaders = {
          ...headers,
          'Authorization': `Bearer ${freshToken}`
        };
        
        return await fetch(url, {
          ...options,
          headers: retryHeaders
        });
      }
    }
    
    return response;
  } catch (error) {
    console.error('Authenticated fetch error:', error);
    throw error;
  }
};

/**
 * Make authenticated POST request
 * @param {string} url - API endpoint URL
 * @param {Object} data - Request body data
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Object>} Parsed JSON response
 */
export const authenticatedPost = async (url, data, options = {}) => {
  try {
    const response = await authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Authenticated POST error:', error);
    throw error;
  }
};

/**
 * Make authenticated GET request
 * @param {string} url - API endpoint URL
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Object>} Parsed JSON response
 */
export const authenticatedGet = async (url, options = {}) => {
  try {
    const response = await authenticatedFetch(url, {
      method: 'GET',
      ...options
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Authenticated GET error:', error);
    throw error;
  }
};

/**
 * Make authenticated PUT request
 * @param {string} url - API endpoint URL
 * @param {Object} data - Request body data
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Object>} Parsed JSON response
 */
export const authenticatedPut = async (url, data, options = {}) => {
  try {
    const response = await authenticatedFetch(url, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Authenticated PUT error:', error);
    throw error;
  }
};

/**
 * Make authenticated DELETE request
 * @param {string} url - API endpoint URL
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Object>} Parsed JSON response
 */
export const authenticatedDelete = async (url, options = {}) => {
  try {
    const response = await authenticatedFetch(url, {
      method: 'DELETE',
      ...options
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Authenticated DELETE error:', error);
    throw error;
  }
};

/**
 * Handle API authentication errors
 * @param {Error} error - Error from API request
 * @param {Function} onAuthError - Callback for authentication errors
 */
export const handleAuthError = (error, onAuthError = null) => {
  if (error.message.includes('Authentication required') || 
      error.message.includes('401') ||
      error.message.includes('Unauthorized')) {
    
    console.error('Authentication error detected:', error.message);
    
    if (onAuthError) {
      onAuthError(error);
    } else {
      // Default behavior - redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }
  
  throw error;
};

/**
 * Retry API request with exponential backoff
 * @param {Function} requestFn - Function that makes the API request
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise<any>} Request result
 */
export const retryWithBackoff = async (requestFn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // Don't retry authentication errors
      if (error.message.includes('Authentication') || error.message.includes('401')) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};