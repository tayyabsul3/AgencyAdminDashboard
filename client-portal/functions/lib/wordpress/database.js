/**
 * Database utilities for WordPress integration
 * Handles Firestore operations for WordPress connections and posts
 */

const { getFirestore } = require('../firebase-admin');
const { CONNECTION_STATUS } = require('./constants');

// Helper function to get database instance
const initializeDb = () => {
  return getFirestore();
};

class WordPressDatabase {
  /**
   * Create a new WordPress connection record
   * @param {Object} connectionData - Connection data to store
   * @returns {Promise<string>} Document ID of created connection
   */
  static async createConnection(connectionData) {
    try {
      initializeDb();
      const docRef = await db.collection('wordpress_connections').add({
        ...connectionData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      throw new Error(`Failed to create connection: ${error.message}`);
    }
  }

  /**
   * Get WordPress connection by ID
   * @param {string} connectionId - Connection document ID
   * @param {string} userId - User ID for ownership verification
   * @returns {Promise<Object|null>} Connection data or null if not found
   */
  static async getConnection(connectionId, userId) {
    try {
      initializeDb();
      const doc = await db.collection('wordpress_connections').doc(connectionId).get();
      
      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      
      // Verify ownership
      if (data.userId !== userId) {
        throw new Error('Access denied to this connection');
      }

      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        lastTested: data.lastTested?.toDate()
      };
    } catch (error) {
      throw new Error(`Failed to get connection: ${error.message}`);
    }
  }

  /**
   * Get all WordPress connections for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of connection objects
   */
  static async getUserConnections(userId) {
    try {
      initializeDb();
      const snapshot = await db
        .collection('wordpress_connections')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          siteUrl: data.siteUrl,
          siteName: data.siteName,
          username: data.username,
          siteType: data.siteType,
          status: data.status,
          lastTested: data.lastTested?.toDate(),
          createdAt: data.createdAt?.toDate()
        };
      });
    } catch (error) {
      throw new Error(`Failed to get user connections: ${error.message}`);
    }
  }

  /**
   * Update WordPress connection
   * @param {string} connectionId - Connection document ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - User ID for ownership verification
   * @returns {Promise<void>}
   */
  static async updateConnection(connectionId, updateData, userId) {
    try {
      // First verify ownership
      const connection = await this.getConnection(connectionId, userId);
      if (!connection) {
        throw new Error('Connection not found or access denied');
      }

      initializeDb();
      await db.collection('wordpress_connections').doc(connectionId).update({
        ...updateData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      throw new Error(`Failed to update connection: ${error.message}`);
    }
  }

  /**
   * Delete WordPress connection
   * @param {string} connectionId - Connection document ID
   * @param {string} userId - User ID for ownership verification
   * @returns {Promise<void>}
   */
  static async deleteConnection(connectionId, userId) {
    try {
      // First verify ownership
      const connection = await this.getConnection(connectionId, userId);
      if (!connection) {
        throw new Error('Connection not found or access denied');
      }

      initializeDb();
      await db.collection('wordpress_connections').doc(connectionId).delete();
    } catch (error) {
      throw new Error(`Failed to delete connection: ${error.message}`);
    }
  }

  /**
   * Update connection status and last tested timestamp
   * @param {string} connectionId - Connection document ID
   * @param {string} status - New status
   * @param {string} userId - User ID for ownership verification
   * @returns {Promise<void>}
   */
  static async updateConnectionStatus(connectionId, status, userId) {
    try {
      await this.updateConnection(connectionId, {
        status,
        lastTested: admin.firestore.FieldValue.serverTimestamp()
      }, userId);
    } catch (error) {
      throw new Error(`Failed to update connection status: ${error.message}`);
    }
  }

  /**
   * Create a WordPress post record
   * @param {Object} postData - Post data to store
   * @returns {Promise<string>} Document ID of created post record
   */
  static async createPostRecord(postData) {
    try {
      initializeDb();
      const docRef = await db.collection('wordpress_posts').add({
        ...postData,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      throw new Error(`Failed to create post record: ${error.message}`);
    }
  }

  /**
   * Get WordPress posts for a user
   * @param {string} userId - User ID
   * @param {number} [limit=50] - Maximum number of posts to return
   * @returns {Promise<Array>} Array of post objects
   */
  static async getUserPosts(userId, limit = 50) {
    try {
      initializeDb();
      const snapshot = await db
        .collection('wordpress_posts')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          publishedAt: data.publishedAt?.toDate()
        };
      });
    } catch (error) {
      throw new Error(`Failed to get user posts: ${error.message}`);
    }
  }

  /**
   * Get WordPress posts for a specific connection
   * @param {string} connectionId - Connection ID
   * @param {string} userId - User ID for ownership verification
   * @returns {Promise<Array>} Array of post objects
   */
  static async getConnectionPosts(connectionId, userId) {
    try {
      initializeDb();
      const snapshot = await db
        .collection('wordpress_posts')
        .where('connectionId', '==', connectionId)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          publishedAt: data.publishedAt?.toDate()
        };
      });
    } catch (error) {
      throw new Error(`Failed to get connection posts: ${error.message}`);
    }
  }

  /**
   * Initialize database indexes (to be run during setup)
   * This is for documentation - indexes should be created via Firebase console or CLI
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

  /**
   * Get connections that need health checking
   * @param {number} [maxAge=3600000] - Maximum age in milliseconds (default: 1 hour)
   * @returns {Promise<Array>} Array of connections that need health checking
   */
  static async getConnectionsNeedingHealthCheck(maxAge = 3600000) {
    try {
      initializeDb();
      
      const cutoffTime = new Date(Date.now() - maxAge);
      
      const snapshot = await db
        .collection('wordpress_connections')
        .where('status', '==', CONNECTION_STATUS.ACTIVE)
        .where('lastTested', '<', cutoffTime)
        .limit(50) // Process in batches
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          lastTested: data.lastTested?.toDate()
        };
      });
    } catch (error) {
      throw new Error(`Failed to get connections needing health check: ${error.message}`);
    }
  }

  /**
   * Get connections with error status for retry
   * @param {number} [minRetryDelay=300000] - Minimum delay before retry in milliseconds (default: 5 minutes)
   * @returns {Promise<Array>} Array of error connections ready for retry
   */
  static async getErrorConnectionsForRetry(minRetryDelay = 300000) {
    try {
      initializeDb();
      
      const retryTime = new Date(Date.now() - minRetryDelay);
      
      const snapshot = await db
        .collection('wordpress_connections')
        .where('status', '==', CONNECTION_STATUS.ERROR)
        .where('lastTested', '<', retryTime)
        .limit(20) // Smaller batch for error retries
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          lastTested: data.lastTested?.toDate()
        };
      });
    } catch (error) {
      throw new Error(`Failed to get error connections for retry: ${error.message}`);
    }
  }

  /**
   * Update connection health status with detailed information
   * @param {string} connectionId - Connection document ID
   * @param {Object} healthData - Health check results
   * @param {string} userId - User ID for ownership verification
   * @returns {Promise<void>}
   */
  static async updateConnectionHealth(connectionId, healthData, userId) {
    try {
      // First verify ownership
      const connection = await this.getConnection(connectionId, userId);
      if (!connection) {
        throw new Error('Connection not found or access denied');
      }

      initializeDb();
      
      const updateData = {
        status: healthData.status,
        lastTested: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastTestAttempts: healthData.attempts || 1
      };

      // Add optional fields
      if (healthData.statusReason) {
        updateData.statusReason = healthData.statusReason;
      }

      if (healthData.error) {
        updateData.lastError = {
          code: healthData.error.code,
          message: healthData.error.message,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        };
      } else {
        // Clear error on successful health check
        updateData.lastError = admin.firestore.FieldValue.delete();
        updateData.statusReason = admin.firestore.FieldValue.delete();
      }

      await db.collection('wordpress_connections').doc(connectionId).update(updateData);
    } catch (error) {
      throw new Error(`Failed to update connection health: ${error.message}`);
    }
  }

  /**
   * Reset database connection for testing
   */
  static resetDb() {
    db = null;
  }
}

module.exports = WordPressDatabase;