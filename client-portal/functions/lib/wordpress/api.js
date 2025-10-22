/**
 * WordPress API endpoints and utilities
 * Firebase Functions for WordPress integration
 */

const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });
const { getFirestore, getAuth } = require('../firebase-admin');

const WordPressService = require('./WordPressService');
const EncryptionService = require('./EncryptionService');
const { ERROR_CODES, CONNECTION_STATUS } = require('./constants');

// Get Firestore instance using centralized initialization
const db = getFirestore();

/**
 * Middleware to verify Firebase Auth token
 */
async function verifyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_INVALID',
        message: 'Invalid authentication token'
      }
    });
  }
}

/**
 * POST /api/wordpress/connect
 * Establish new WordPress connection
 */
const connectWordPress = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST method allowed' }
      });
    }

    try {
      // Verify authentication
      await new Promise((resolve, reject) => {
        verifyAuth(req, res, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      const { siteUrl, username, applicationPassword } = req.body;

      if (!siteUrl || !username || !applicationPassword) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'siteUrl, username, and applicationPassword are required'
          }
        });
      }

      // Test WordPress connection
      const wpService = new WordPressService(siteUrl, username, applicationPassword);
      const connectionTest = await wpService.testConnection();

      if (!connectionTest.success) {
        return res.status(400).json(connectionTest);
      }

      // Encrypt credentials
      const masterKey = process.env.ENCRYPTION_MASTER_KEY;
      if (!masterKey) {
        throw new Error('Encryption master key not configured');
      }

      const encryptedCredentials = EncryptionService.encryptCredentials(
        { username, applicationPassword },
        req.user.uid,
        masterKey
      );

      // Store connection in Firestore
      const connectionData = {
        userId: req.user.uid,
        siteUrl: wpService.siteUrl,
        siteName: connectionTest.siteInfo.name,
        username: username,
        encryptedPassword: encryptedCredentials.encryptedData,
        encryptionIV: encryptedCredentials.iv,
        authTag: encryptedCredentials.authTag,
        siteType: wpService.siteType,
        apiEndpoint: wpService.apiEndpoint,
        status: CONNECTION_STATUS.ACTIVE,
        lastTested: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('wordpress_connections').add(connectionData);

      return res.status(200).json({
        success: true,
        connectionId: docRef.id,
        siteInfo: connectionTest.siteInfo
      });

    } catch (error) {
      console.error('WordPress connection error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  });
});

/**
 * GET /api/wordpress/connections
 * Retrieve user's WordPress connections
 */
const getWordPressConnections = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET method allowed' }
      });
    }

    try {
      // Verify authentication
      await new Promise((resolve, reject) => {
        verifyAuth(req, res, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      const connectionsSnapshot = await db
        .collection('wordpress_connections')
        .where('userId', '==', req.user.uid)
        .orderBy('createdAt', 'desc')
        .get();

      const connections = connectionsSnapshot.docs.map(doc => {
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

      return res.status(200).json({
        success: true,
        connections
      });

    } catch (error) {
      console.error('Get connections error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  });
});

/**
 * DELETE /api/wordpress/connections/:id
 * Remove WordPress connection
 */
const deleteWordPressConnection = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== 'DELETE') {
      return res.status(405).json({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Only DELETE method allowed' }
      });
    }

    try {
      // Verify authentication
      await new Promise((resolve, reject) => {
        verifyAuth(req, res, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      const connectionId = req.path.split('/').pop();
      if (!connectionId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_CONNECTION_ID',
            message: 'Connection ID is required'
          }
        });
      }

      // Verify connection belongs to user
      const connectionDoc = await db.collection('wordpress_connections').doc(connectionId).get();
      
      if (!connectionDoc.exists) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CONNECTION_NOT_FOUND',
            message: 'WordPress connection not found'
          }
        });
      }

      const connectionData = connectionDoc.data();
      if (connectionData.userId !== req.user.uid) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied to this connection'
          }
        });
      }

      // Delete the connection
      await db.collection('wordpress_connections').doc(connectionId).delete();

      return res.status(200).json({
        success: true,
        message: 'WordPress connection deleted successfully'
      });

    } catch (error) {
      console.error('Delete connection error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  });
});

module.exports = {
  connectWordPress,
  getWordPressConnections,
  deleteWordPressConnection,
  verifyAuth
};