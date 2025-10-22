import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WordPressConnectionService } from '../services/wordpressConnectionService';
import { 
  parseWordPressConnectionError, 
  getUserFriendlyErrorMessage,
  logWordPressConnectionError,
  createRetryHandler
} from '../utils/wordpressConnectionErrors';

/**
 * React hook for managing WordPress connections
 * Provides state management and methods for CRUD operations on WordPress connections
 * @returns {Object} Hook state and methods
 */
export const useWordPressConnections = () => {
  const { user, isAuthenticated } = useAuth();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load all connections for the current user (with retry)
   */
  const loadConnectionsWithRetry = createRetryHandler(async (userId) => {
    return await WordPressConnectionService.loadConnections(userId);
  }, 2, 1000);

  /**
   * Load all connections for the current user
   */
  const loadConnections = useCallback(async () => {
    if (!user || !isAuthenticated) {
      setConnections([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const userConnections = await loadConnectionsWithRetry(user.uid);
      setConnections(userConnections);
      console.log(`Loaded ${userConnections.length} WordPress connections`);
    } catch (err) {
      logWordPressConnectionError(err, 'Load Connections');
      const standardErrorMessage = 'Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.';
      setError(standardErrorMessage);
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated]);

  // Load connections when user changes or component mounts
  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  /**
   * Save a new WordPress connection
   * @param {Object} connectionData - Connection data to save
   * @returns {Promise<string>} - Connection ID
   */
  const saveConnection = async (connectionData) => {
    if (!user || !isAuthenticated) {
      throw new Error('User not authenticated');
    }

    if (!WordPressConnectionService.validateConnectionData(connectionData)) {
      throw new Error('Invalid connection data provided');
    }

    try {
      setError(null);
      
      // Sanitize connection data
      const sanitizedData = WordPressConnectionService.sanitizeConnectionData(connectionData);
      
      // Save connection using stable userId for encryption
      const connectionId = await WordPressConnectionService.saveConnection(
        user.uid, 
        sanitizedData, 
        user.uid  // Use stable userId instead of changing token
      );
      
      // Refresh connections list
      await loadConnections();
      
      console.log('WordPress connection saved successfully:', connectionId);
      return connectionId;
    } catch (err) {
      logWordPressConnectionError(err, 'Save Connection');
      const standardErrorMessage = 'Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.';
      setError(standardErrorMessage);
      throw new Error(standardErrorMessage);
    }
  };

  /**
   * Load and decrypt a specific connection with retry logic
   * @param {string} connectionId - Connection ID to load
   * @returns {Promise<Object>} - Connection data with decrypted password
   */
  const loadConnection = async (connectionId) => {
    if (!user || !isAuthenticated) {
      throw new Error('User not authenticated');
    }

    if (!connectionId) {
      throw new Error('Connection ID is required');
    }

    try {
      setError(null);
      
      // Try loading with fresh token, with retry logic for token issues
      let lastError;
      const maxRetries = 2;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Loading connection attempt ${attempt}/${maxRetries}`);
          
          // Load and decrypt connection using stable userId
          const connection = await WordPressConnectionService.loadConnection(
            user.uid, 
            connectionId, 
            user.uid  // Use stable userId instead of changing token
          );
          
          console.log('WordPress connection loaded successfully:', connectionId);
          return connection;
          
        } catch (attemptError) {
          console.warn(`Connection load attempt ${attempt} failed:`, attemptError.message);
          lastError = attemptError;
          
          // If it's a decryption error and we have more attempts, wait and try again
          if (attempt < maxRetries && 
              (attemptError.message.includes('decrypt') || 
               attemptError.message.includes('credential security'))) {
            console.log('Waiting before retry...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          
          // If it's not a decryption error or we're out of attempts, throw immediately
          throw attemptError;
        }
      }
      
      // If we get here, all attempts failed
      throw lastError;
      
    } catch (err) {
      logWordPressConnectionError(err, 'Load Connection');
      
      // Handle decryption failures more gracefully
      if (err.message === 'CONNECTION_NEEDS_REAUTH') {
        const reAuthMessage = 'This saved connection needs to be re-authenticated. Please enter your credentials again.';
        setError(reAuthMessage);
        throw new Error(reAuthMessage);
      }
      
      const standardErrorMessage = 'Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.';
      setError(standardErrorMessage);
      throw new Error(standardErrorMessage);
    }
  };

  /**
   * Delete a WordPress connection (soft delete)
   * @param {string} connectionId - Connection ID to delete
   * @returns {Promise<void>}
   */
  const deleteConnection = async (connectionId) => {
    if (!user || !isAuthenticated) {
      throw new Error('User not authenticated');
    }

    if (!connectionId) {
      throw new Error('Connection ID is required');
    }

    try {
      setError(null);
      
      await WordPressConnectionService.deleteConnection(user.uid, connectionId);
      
      // Refresh connections list
      await loadConnections();
      
      console.log('WordPress connection deleted successfully:', connectionId);
    } catch (err) {
      logWordPressConnectionError(err, 'Delete Connection');
      const standardErrorMessage = 'Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.';
      setError(standardErrorMessage);
      throw new Error(standardErrorMessage);
    }
  };

  /**
   * Update last used timestamp for a connection
   * @param {string} connectionId - Connection ID to update
   * @returns {Promise<void>}
   */
  const updateLastUsed = async (connectionId) => {
    if (!user || !isAuthenticated) {
      throw new Error('User not authenticated');
    }

    if (!connectionId) {
      throw new Error('Connection ID is required');
    }

    try {
      await WordPressConnectionService.updateLastUsed(user.uid, connectionId);
      
      // Update local state to reflect the change
      setConnections(prevConnections => 
        prevConnections.map(conn => 
          conn.id === connectionId 
            ? { ...conn, lastUsed: new Date() }
            : conn
        )
      );
      
      console.log('Updated last used for connection:', connectionId);
    } catch (err) {
      console.error('Failed to update last used:', err);
      // Don't throw error for this operation as it's not critical
      console.warn('Last used update failed, continuing...');
    }
  };

  /**
   * Check if a connection already exists for given site URL and username
   * @param {string} siteUrl - Site URL to check
   * @param {string} username - Username to check
   * @returns {boolean} - True if connection already exists
   */
  const isConnectionSaved = (siteUrl, username) => {
    return WordPressConnectionService.isConnectionSaved(connections, siteUrl, username);
  };

  /**
   * Get connection statistics for the current user
   * @returns {Promise<Object>} - Connection statistics
   */
  const getConnectionStats = async () => {
    if (!user || !isAuthenticated) {
      throw new Error('User not authenticated');
    }

    try {
      const stats = await WordPressConnectionService.getConnectionStats(user.uid);
      return stats;
    } catch (err) {
      logWordPressConnectionError(err, 'Get Connection Stats');
      const standardErrorMessage = 'Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.';
      setError(standardErrorMessage);
      throw new Error(standardErrorMessage);
    }
  };

  /**
   * Find connections by site URL
   * @param {string} siteUrl - Site URL to search for
   * @returns {Array} - Matching connections
   */
  const findConnectionsBySite = (siteUrl) => {
    if (!siteUrl) return [];
    
    return connections.filter(conn => 
      conn.siteUrl && conn.siteUrl.toLowerCase().includes(siteUrl.toLowerCase())
    );
  };

  /**
   * Get the most recently used connection
   * @returns {Object|null} - Most recent connection or null
   */
  const getMostRecentConnection = () => {
    if (connections.length === 0) return null;
    
    return connections.reduce((mostRecent, conn) => {
      if (!mostRecent) return conn;
      
      const connLastUsed = conn.lastUsed?.toDate?.() || new Date(0);
      const mostRecentLastUsed = mostRecent.lastUsed?.toDate?.() || new Date(0);
      
      return connLastUsed > mostRecentLastUsed ? conn : mostRecent;
    });
  };

  /**
   * Clear error state
   */
  const clearError = () => {
    setError(null);
  };

  /**
   * Refresh connections list
   */
  const refresh = loadConnections;

  return {
    // State
    connections,
    loading,
    error,
    isAuthenticated,
    
    // Core methods
    saveConnection,
    loadConnection,
    deleteConnection,
    updateLastUsed,
    
    // Utility methods
    isConnectionSaved,
    getConnectionStats,
    findConnectionsBySite,
    getMostRecentConnection,
    
    // Control methods
    refresh,
    clearError,
    
    // Computed values
    hasConnections: connections.length > 0,
    connectionCount: connections.length
  };
};