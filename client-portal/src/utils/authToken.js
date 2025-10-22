/**
 * Authentication Token Utilities
 * Handles client-side token management for API calls
 */

import { auth } from '../lib/firebase';

/**
 * Get the current user's ID token for API calls
 * @returns {Promise<string|null>} ID token or null if not authenticated
 */
export const getAuthToken = async () => {
  try {
    if (!auth?.currentUser) {
      return null;
    }

    // Get fresh ID token
    const token = await auth.currentUser.getIdToken();
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

/**
 * Get authorization headers for API calls
 * @returns {Promise<Object>} Headers object with authorization
 */
export const getAuthHeaders = async () => {
  const token = await getAuthToken();
  
  if (!token) {
    return {};
  }

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Make authenticated API request
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export const authenticatedFetch = async (url, options = {}) => {
  const authHeaders = await getAuthHeaders();
  
  const requestOptions = {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers
    }
  };

  return fetch(url, requestOptions);
};

/**
 * Make authenticated API request and parse JSON response
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Parsed JSON response
 */
export const authenticatedRequest = async (url, options = {}) => {
  try {
    const response = await authenticatedFetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Authenticated request error:', error);
    throw error;
  }
};

/**
 * Check if current user has a valid token
 * @returns {Promise<boolean>} True if user has valid token
 */
export const hasValidToken = async () => {
  const token = await getAuthToken();
  return !!token;
};

/**
 * Refresh the current user's token
 * @returns {Promise<string|null>} New token or null if failed
 */
export const refreshAuthToken = async () => {
  try {
    if (!auth?.currentUser) {
      return null;
    }

    // Force refresh the token
    const token = await auth.currentUser.getIdToken(true);
    return token;
  } catch (error) {
    console.error('Error refreshing auth token:', error);
    return null;
  }
};