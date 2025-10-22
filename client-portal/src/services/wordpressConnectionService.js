import { 
  doc, 
  setDoc, 
  getDoc,
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  updateDoc, 
  serverTimestamp,
  increment 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { EncryptionService } from './encryptionService';

export class WordPressConnectionService {
  /**
   * Save WordPress connection after successful publishing
   * @param {string} userId - User's Firebase UID
   * @param {Object} connectionData - Connection data to save
   * @param {string} userIdentifier - Firebase UID (for stable encryption)
   * @returns {Promise<string>} - Connection ID
   */
  static async saveConnection(userId, connectionData, userIdentifier) {
    try {
      if (!userId || !connectionData || !userIdentifier) {
        throw new Error('Missing required parameters for saving connection');
      }

      // Validate required connection data
      if (!connectionData.siteUrl || !connectionData.username || !connectionData.password) {
        throw new Error('Missing required connection data (siteUrl, username, password)');
      }

      // Generate unique connection ID
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Encrypt password before storage using stable userId
      const encryptedPassword = await EncryptionService.encryptPassword(
        connectionData.password,
        userId
      );
      
      // Create document reference
      const docRef = doc(db, 'users', userId, 'wordpressConnections', connectionId);
      
      // Prepare connection document
      const connectionDoc = {
        id: connectionId,
        name: connectionData.name || this.extractSiteName(connectionData.siteUrl),
        siteUrl: connectionData.siteUrl,
        username: connectionData.username,
        encryptedPassword: encryptedPassword,
        categories: connectionData.categories || [],
        createdAt: serverTimestamp(),
        lastUsed: serverTimestamp(),
        isActive: true,
        metrics: {
          totalPublishes: 1,
          successRate: 100,
          lastPublishTime: serverTimestamp()
        }
      };

      // Save to Firestore
      await setDoc(docRef, connectionDoc);
      
      console.log('WordPress connection saved successfully:', connectionId);
      return connectionId;
    } catch (error) {
      console.error('Failed to save WordPress connection:', error);
      throw new Error('Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.');
    }
  }

  /**
   * Load all active WordPress connections for user
   * @param {string} userId - User's Firebase UID
   * @returns {Promise<Array>} - Array of user's active connections
   */
  static async loadConnections(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required to load connections');
      }

      const connectionsRef = collection(db, 'users', userId, 'wordpressConnections');
      // Temporarily remove orderBy to avoid index requirement
      // TODO: Create Firestore composite index for isActive + lastUsed
      const q = query(
        connectionsRef,
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(q);
      
      const connections = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by lastUsed on client-side (since we removed orderBy to avoid index requirement)
      const sortedConnections = connections.sort((a, b) => {
        const aTime = a.lastUsed?.toDate?.() || new Date(0);
        const bTime = b.lastUsed?.toDate?.() || new Date(0);
        return bTime.getTime() - aTime.getTime(); // Descending order (most recent first)
      });

      console.log(`Loaded ${sortedConnections.length} WordPress connections for user:`, userId);
      return sortedConnections;
    } catch (error) {
      console.error('Failed to load WordPress connections:', error);
      throw new Error('Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.');
    }
  }

  /**
   * Load and decrypt a specific connection
   * @param {string} userId - User's Firebase UID
   * @param {string} connectionId - Connection ID to load
   * @param {string} userIdentifier - Firebase UID (for stable decryption)
   * @returns {Promise<Object>} - Connection data with decrypted password
   */
  static async loadConnection(userId, connectionId, userIdentifier) {
    try {
      if (!userId || !connectionId || !userIdentifier) {
        throw new Error('Missing required parameters for loading connection');
      }

      const docRef = doc(db, 'users', userId, 'wordpressConnections', connectionId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Connection not found');
      }
      
      const connection = docSnap.data();
      
      // Check if connection is active
      if (!connection.isActive) {
        throw new Error('Connection is inactive');
      }

      // Safely decrypt password using stable userId - returns null if decryption fails
      const decryptedPassword = await EncryptionService.safeDecryptPassword(
        connection.encryptedPassword,
        userId
      );
      
      // If decryption failed, mark connection as needing re-authentication
      if (decryptedPassword === null) {
        console.warn('Connection password could not be decrypted, session may have changed:', connectionId);
        throw new Error('CONNECTION_NEEDS_REAUTH');
      }
      
      console.log('WordPress connection loaded and decrypted:', connectionId);
      return {
        ...connection,
        password: decryptedPassword
      };
    } catch (error) {
      console.error('Failed to load WordPress connection:', error);
      throw new Error('Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.');
    }
  }

  /**
   * Update last used timestamp and increment usage metrics
   * @param {string} userId - User's Firebase UID
   * @param {string} connectionId - Connection ID to update
   * @returns {Promise<void>}
   */
  static async updateLastUsed(userId, connectionId) {
    try {
      if (!userId || !connectionId) {
        throw new Error('Missing required parameters for updating last used');
      }

      const docRef = doc(db, 'users', userId, 'wordpressConnections', connectionId);
      await updateDoc(docRef, { 
        lastUsed: serverTimestamp(),
        'metrics.totalPublishes': increment(1)
      });
      
      console.log('Updated last used for connection:', connectionId);
    } catch (error) {
      console.error('Failed to update last used:', error);
      throw new Error('Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.');
    }
  }

  /**
   * Delete connection (soft delete by marking as inactive)
   * @param {string} userId - User's Firebase UID
   * @param {string} connectionId - Connection ID to delete
   * @returns {Promise<void>}
   */
  static async deleteConnection(userId, connectionId) {
    try {
      if (!userId || !connectionId) {
        throw new Error('Missing required parameters for deleting connection');
      }

      const docRef = doc(db, 'users', userId, 'wordpressConnections', connectionId);
      await updateDoc(docRef, { 
        isActive: false,
        deletedAt: serverTimestamp()
      });
      
      console.log('WordPress connection soft deleted:', connectionId);
    } catch (error) {
      console.error('Failed to delete WordPress connection:', error);
      throw new Error('Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.');
    }
  }

  /**
   * Check if connection already exists for given site URL and username
   * @param {Array} connections - Array of existing connections
   * @param {string} siteUrl - Site URL to check
   * @param {string} username - Username to check
   * @returns {boolean} - True if connection already exists
   */
  static isConnectionSaved(connections, siteUrl, username) {
    if (!Array.isArray(connections) || !siteUrl || !username) {
      return false;
    }

    return connections.some(conn => 
      conn.siteUrl === siteUrl && conn.username === username
    );
  }

  /**
   * Extract site name from URL for auto-naming connections
   * @param {string} url - Site URL
   * @returns {string} - Extracted site name
   */
  static extractSiteName(url) {
    try {
      if (!url || typeof url !== 'string') {
        return 'WordPress Site';
      }

      const domain = new URL(url).hostname;
      return domain
        .replace(/^www\./, '')
        .replace(/\.(com|org|net|io|co|edu|gov)$/, '')
        .split('.')[0]
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    } catch (error) {
      console.warn('Failed to extract site name from URL:', url, error);
      return 'WordPress Site';
    }
  }

  /**
   * Validate connection data structure
   * @param {Object} connectionData - Connection data to validate
   * @returns {boolean} - True if valid
   */
  static validateConnectionData(connectionData) {
    if (!connectionData || typeof connectionData !== 'object') {
      return false;
    }

    const requiredFields = ['siteUrl', 'username', 'password'];
    return requiredFields.every(field => 
      connectionData[field] && typeof connectionData[field] === 'string'
    );
  }

  /**
   * Sanitize connection data before saving
   * @param {Object} connectionData - Raw connection data
   * @returns {Object} - Sanitized connection data
   */
  static sanitizeConnectionData(connectionData) {
    if (!connectionData) {
      throw new Error('Connection data is required');
    }

    return {
      name: connectionData.name ? String(connectionData.name).trim() : '',
      siteUrl: String(connectionData.siteUrl).trim(),
      username: String(connectionData.username).trim(),
      password: String(connectionData.password),
      categories: Array.isArray(connectionData.categories) ? connectionData.categories : []
    };
  }

  /**
   * Get connection statistics for a user
   * @param {string} userId - User's Firebase UID
   * @returns {Promise<Object>} - Connection statistics
   */
  static async getConnectionStats(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required to get connection stats');
      }

      const connections = await this.loadConnections(userId);
      
      const stats = {
        totalConnections: connections.length,
        totalPublishes: connections.reduce((sum, conn) => sum + (conn.metrics?.totalPublishes || 0), 0),
        mostUsedConnection: connections.length > 0 ? connections[0] : null,
        oldestConnection: connections.length > 0 ? 
          connections.reduce((oldest, conn) => 
            (!oldest || conn.createdAt?.toDate() < oldest.createdAt?.toDate()) ? conn : oldest
          ) : null
      };

      return stats;
    } catch (error) {
      console.error('Failed to get connection stats:', error);
      throw new Error('Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.');
    }
  }
}