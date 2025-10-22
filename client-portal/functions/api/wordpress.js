/**
 * WordPress API Handler
 * Handles all WordPress-related API endpoints
 */

// const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
// if (!admin.apps.length) {
//   admin.initializeApp();
// }

const WordPressService = require('../lib/wordpress/WordPressService');
const HybridWordPressService = require('../lib/wordpress/HybridWordPressService');
const EncryptionService = require('../lib/wordpress/EncryptionService');
const { convertJsonToWordPressPost, validateArticleData, extractImagesFromArticle, suggestFeaturedImage } = require('../lib/wordpress/contentConverter');
const WordPressDatabase = require('../lib/wordpress/database');
const WordPressHealthMonitor = require('../lib/wordpress/healthMonitor');
const { ERROR_CODES, CONNECTION_STATUS, POST_STATUS } = require('../lib/wordpress/constants');
const { defaultLogger } = require('../lib/wordpress/logger');
const { defaultMiddleware } = require('../lib/wordpress/middleware');
const WordPressErrorHandler = require('../lib/wordpress/errorHandler');

// Initialize Firestore (will be called in each function for testability)
let db;

// Initialize error handler
const errorHandler = new WordPressErrorHandler(defaultLogger);

/**
 * Enhanced middleware to verify Firebase Auth token with comprehensive logging
 */
// async function verifyAuth(req, res, next) {
//   const timer = defaultLogger.startOperation('auth_verification', {
//     method: req.method,
//     url: req.url,
//     userAgent: req.headers['user-agent'],
//     ipAddress: req.ip
//   });

//   try {
//     const authHeader = req.headers.authorization;
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       const error = new Error('Authentication required');
//       error.code = 'AUTH_REQUIRED';
      
//       const handledError = errorHandler.handleError(error, {
//         operation: 'auth_verification',
//         method: req.method,
//         url: req.url
//       });
      
//       timer.error(error);
      
//       return res.status(401).json(handledError);
//     }

//     const token = authHeader.split('Bearer ')[1];
//     const decodedToken = await admin.auth().verifyIdToken(token);
//     req.user = decodedToken;
    
//     timer.end({ success: true, userId: decodedToken.uid });
    
//     defaultLogger.debug('User authenticated successfully', {
//       userId: decodedToken.uid,
//       method: req.method,
//       url: req.url
//     });
    
//     next();
//   } catch (error) {
//     error.code = error.code || 'AUTH_INVALID';
    
//     const handledError = errorHandler.handleError(error, {
//       operation: 'auth_verification',
//       method: req.method,
//       url: req.url
//     });
    
//     timer.error(error);
    
//     return res.status(401).json(handledError);
//   }
// }

// Simple auth bypass for testing
async function verifyAuth(req, res, next) {
  // Skip auth for now
  req.user = { uid: 'test-user' };
  next();
}

/**
 * Main WordPress API handler with comprehensive error handling
 */
async function handler(req, res) {
  const path = req.path.replace('/wordpress', '');
  const context = {
    method: req.method,
    path,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
    userId: req.user?.uid
  };
  
  const timer = defaultLogger.startOperation('wordpress_api_handler', context);
  
  try {
    defaultLogger.info(`WordPress API request: ${req.method} ${path}`, context);
    
    let result;
    
    switch (true) {
      case path === '/connect' && req.method === 'POST':
        result = await handleConnect(req, res);
        break;
      case path === '/publish-direct' && req.method === 'POST':
        result = await handlePublishDirect(req, res);
        break;
      case path === '/connections' && req.method === 'GET':
        result = await handleGetConnections(req, res);
        break;
      case path.startsWith('/connections/') && req.method === 'DELETE':
        result = await handleDeleteConnection(req, res);
        break;
      case path.startsWith('/test/') && req.method === 'GET':
        result = await handleTestConnection(req, res);
        break;
      case path === '/health/check' && req.method === 'POST':
        result = await handleHealthCheck(req, res);
        break;
      case path === '/health/retry' && req.method === 'POST':
        result = await handleHealthRetry(req, res);
        break;
      case path === '/publish' && req.method === 'POST':
        result = await handlePublish(req, res);
        break;
      case path === '/media/upload' && req.method === 'POST':
        result = await handleMediaUpload(req, res);
        break;
      case path === '/categories' && req.method === 'POST':
        result = await handleGetCategories(req, res);
        break;
      default:
        const notFoundError = new Error(`WordPress route ${path} not found`);
        notFoundError.code = 'NOT_FOUND';
        
        const handledError = errorHandler.handleError(notFoundError, {
          ...context,
          operation: 'route_not_found'
        });
        
        timer.error(notFoundError);
        
        return res.status(404).json(handledError);
    }
    
    timer.end({ success: true });
    return result;
    
  } catch (error) {
    const handledError = errorHandler.handleError(error, {
      ...context,
      operation: 'wordpress_api_handler'
    });
    
    timer.error(error);
    
    // Determine appropriate status code
    const statusCode = getErrorStatusCode(handledError.error.code);
    
    defaultLogger.error('WordPress API handler error', {
      ...context,
      error: handledError.error,
      statusCode
    });
    
    return res.status(statusCode).json(handledError);
  }
}

/**
 * Get appropriate HTTP status code for error
 * @param {string} errorCode - Error code
 * @returns {number} HTTP status code
 */
function getErrorStatusCode(errorCode) {
  const statusMap = {
    'AUTH_REQUIRED': 401,
    'AUTH_INVALID': 401,
    'AUTH_INVALID_CREDENTIALS': 401,
    'AUTH_EXPIRED_TOKEN': 401,
    'AUTH_INSUFFICIENT_PERMISSIONS': 403,
    'ACCESS_DENIED': 403,
    'CONNECTION_NOT_FOUND': 404,
    'API_NOT_FOUND': 404,
    'NOT_FOUND': 404,
    'MISSING_REQUIRED_FIELDS': 400,
    'MISSING_CONNECTION_ID': 400,
    'INVALID_ARTICLE_DATA': 400,
    'CONTENT_INVALID_FORMAT': 400,
    'CONTENT_TOO_LARGE': 413,
    'RATE_LIMITED': 429,
    'API_RATE_LIMITED': 429,
    'NETWORK_TIMEOUT': 408,
    'METHOD_NOT_ALLOWED': 405
  };
  
  return statusMap[errorCode] || 500;
}

/**
 * POST /api/wordpress/connect
 * Establish new WordPress connection with comprehensive error handling
 */
/**
 * POST /api/wordpress/publish-direct
 * Publish directly to WordPress without storing a connection.
 */
async function handlePublishDirect(req, res) {
  const { siteUrl, username, applicationPassword, articleData, postOptions = {} } = req.body;

  // Basic validation
  if (!siteUrl || !username || !applicationPassword || !articleData) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_PARAMETERS', message: 'Missing required credentials or article data.' },
    });
  }

  try {
    // Add debugging for credentials
    defaultLogger.info('WordPress publish attempt', {
      siteUrl,
      username,
      hasPassword: !!applicationPassword,
      passwordLength: applicationPassword?.length || 0
    });

    const wpService = new HybridWordPressService(siteUrl, username, applicationPassword, { logger: defaultLogger });

    // Test connection before attempting to publish
    const connectionTest = await wpService.testConnection();
    if (!connectionTest.success) {
      defaultLogger.error('WordPress connection test failed', {
        siteUrl,
        username,
        error: connectionTest.error
      });
      
      return res.status(400).json({
        success: false,
        error: { 
          code: 'CONNECTION_FAILED', 
          message: connectionTest.error?.message || 'Failed to connect to WordPress.',
          details: connectionTest.error
        },
      });
    }

    defaultLogger.info('WordPress connection test successful', {
      siteUrl,
      username,
      method: connectionTest.method
    });

    // Handle featured image upload if provided
    let featuredImageId = null;
    
    if (postOptions.featuredImageData) {
      try {
        defaultLogger.info('Uploading featured image to WordPress...');
        
        let imageBuffer;
        let mimeType = 'image/jpeg'; // Default mime type
        let filename = `featured-image-${Date.now()}.jpg`;
        
        // Check if featuredImageData is base64 or a URL
        if (postOptions.featuredImageData.startsWith('http')) {
          // It's a URL, fetch the image
          const axios = require('axios');
          const imageResponse = await axios.get(postOptions.featuredImageData, {
            responseType: 'arraybuffer'
          });
          imageBuffer = Buffer.from(imageResponse.data);
          
          // Try to get mime type from response headers
          if (imageResponse.headers['content-type']) {
            mimeType = imageResponse.headers['content-type'];
            // Extract extension from mime type
            const ext = mimeType.split('/')[1];
            filename = `featured-image-${Date.now()}.${ext}`;
          }
        } else {
          // It's base64 data
          imageBuffer = Buffer.from(postOptions.featuredImageData, 'base64');
          
          // Try to detect image type from buffer
          if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) {
            mimeType = 'image/jpeg';
            filename = `featured-image-${Date.now()}.jpg`;
          } else if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
            mimeType = 'image/png';
            filename = `featured-image-${Date.now()}.png`;
          } else if (imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49) {
            mimeType = 'image/gif';
            filename = `featured-image-${Date.now()}.gif`;
          } else if (imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49) {
            mimeType = 'image/webp';
            filename = `featured-image-${Date.now()}.webp`;
          }
        }
        
        // Upload the image to WordPress media library
        const mediaUploadResult = await wpService.uploadMedia(imageBuffer, {
          filename: filename,
          mimeType: mimeType,
          title: articleData.title || 'Featured Image',
          altText: articleData.title || 'Featured Image',
          caption: '',
          description: `Featured image for: ${articleData.title || 'Article'}`
        });
        
        if (mediaUploadResult && mediaUploadResult.id) {
          featuredImageId = mediaUploadResult.id;
          defaultLogger.info('Featured image uploaded successfully', { 
            mediaId: featuredImageId,
            mediaUrl: mediaUploadResult.url 
          });
        }
      } catch (imageError) {
        defaultLogger.error('Failed to upload featured image', { 
          error: imageError.message 
        });
        // Continue without featured image rather than failing the entire post
      }
    } else if (postOptions.featuredMediaId) {
      // Use existing media ID if provided
      featuredImageId = postOptions.featuredMediaId;
      defaultLogger.info('Using existing featured image', { mediaId: featuredImageId });
    }

    // Prepare post data
    const postPayload = {
      title: articleData.title || 'Untitled Post',
      content: articleData.content || '',
      excerpt: articleData.excerpt || '',
      status: postOptions.status || 'draft', // Default to 'draft'
    };

    // Add categories if provided
    if (postOptions.categoryId && postOptions.categoryId !== 1) {
      // Only add if not "Uncategorized" (ID 1) since that's WordPress default
      postPayload.categories = [parseInt(postOptions.categoryId)];
      defaultLogger.info('Adding category to post', { categoryId: postOptions.categoryId });
    }

    // Create post with featured image if available
    const createPostOptions = {};
    if (featuredImageId) {
      createPostOptions.featuredImageId = featuredImageId;
    }

    const result = await wpService.createPost(postPayload, createPostOptions);

    return res.status(200).json({
      success: true,
      ...result,
      featuredImageId: featuredImageId || null
    });
  } catch (error) {
    defaultLogger.error('Direct publish error', { 
      error: error.message,
      stack: error.stack,
      siteUrl,
      username
    });
    
    // Provide more specific error messages for common issues
    let errorMessage = error.message || 'An unknown error occurred during publishing.';
    let errorCode = 'PUBLISH_FAILED';
    
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      errorMessage = 'WordPress credentials are invalid or the user does not have permission to create posts. Please check your username and application password.';
      errorCode = 'AUTH_FAILED';
    } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
      errorMessage = 'WordPress user does not have sufficient permissions to create posts. Please ensure the user has Editor or Administrator role.';
      errorCode = 'PERMISSION_DENIED';
    } else if (error.message?.includes('No working WordPress API method')) {
      errorMessage = 'Cannot connect to WordPress API. Please check your site URL and ensure WordPress REST API is enabled.';
      errorCode = 'API_UNAVAILABLE';
    }
    
    return res.status(500).json({
      success: false,
      error: { 
        code: errorCode, 
        message: errorMessage,
        originalError: error.message
      },
    });
  }
}

/**
 * POST /api/wordpress/categories
 * Get WordPress categories using provided credentials
 */
async function handleGetCategories(req, res) {
  const { siteUrl, username, applicationPassword } = req.body;

  // Basic validation
  if (!siteUrl || !username || !applicationPassword) {
    return res.status(400).json({
      success: false,
      error: { 
        code: 'MISSING_PARAMETERS', 
        message: 'Missing required credentials (siteUrl, username, applicationPassword).' 
      },
    });
  }

  try {
    const wpService = new HybridWordPressService(siteUrl, username, applicationPassword, { 
      logger: defaultLogger 
    });

    // Test connection first to ensure credentials work
    const connectionTest = await wpService.testConnection();
    if (!connectionTest.success) {
      return res.status(400).json({
        success: false,
        error: { 
          code: 'CONNECTION_FAILED', 
          message: connectionTest.error?.message || 'Failed to connect to WordPress.' 
        },
      });
    }

    // Fetch categories
    const categoriesResult = await wpService.getCategories();
    
    if (!categoriesResult.success) {
      return res.status(400).json({
        success: false,
        error: { 
          code: 'CATEGORIES_FETCH_FAILED', 
          message: categoriesResult.error?.message || 'Failed to fetch categories from WordPress.' 
        },
      });
    }

    return res.status(200).json({
      success: true,
      categories: categoriesResult.categories || [],
      count: categoriesResult.categories?.length || 0
    });

  } catch (error) {
    defaultLogger.error('Categories fetch error', { error: error.message });
    return res.status(500).json({
      success: false,
      error: { 
        code: 'CATEGORIES_FETCH_FAILED', 
        message: error.message || 'An unknown error occurred while fetching categories.' 
      },
    });
  }
}

async function handleConnect(req, res) {
  const context = {
    operation: 'connect_wordpress',
    userId: req.user?.uid,
  };
  
  const timer = defaultLogger.startOperation('connect_wordpress', { userId: req.user.uid });

  try {
    // Verify authentication
    await new Promise((resolve, reject) => {
      verifyAuth(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { siteUrl, username, applicationPassword } = req.body;

    // Validate required fields with detailed error messages
    const missingFields = [];
    if (!siteUrl) missingFields.push('siteUrl');
    if (!username) missingFields.push('username');
    if (!applicationPassword) missingFields.push('applicationPassword');

    if (missingFields.length > 0) {
      const error = new Error(`Missing required fields: ${missingFields.join(', ')}`);
      error.code = 'MISSING_REQUIRED_FIELDS';
      error.details = { missingFields };
      
      const handledError = errorHandler.handleError(error, context);
      timer.error(error);
      
      return res.status(400).json(handledError);
    }

    defaultLogger.info('Testing WordPress connection', {
      ...context,
      siteUrl,
      username
    });

    // Test WordPress connection with hybrid fallback and enhanced error handling
    const wpService = new HybridWordPressService(siteUrl, username, applicationPassword, {
      logger: defaultLogger
    });
    
    const connectionTest = await wpService.testConnection();

    if (!connectionTest.success) {
      defaultLogger.warn('WordPress connection test failed', {
        ...context,
        siteUrl,
        error: connectionTest.error
      });
      
      timer.error(new Error(connectionTest.error.message));
      return res.status(400).json(connectionTest);
    }

    defaultLogger.info('WordPress connection test successful', {
      ...context,
      siteUrl,
      siteInfo: connectionTest.siteInfo
    });

    // Encrypt credentials
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      const error = new Error('Encryption master key not configured');
      error.code = 'ENCRYPTION_KEY_MISSING';
      
      const handledError = errorHandler.handleError(error, context);
      timer.error(error);
      
      return res.status(500).json(handledError);
    }

    let encryptedCredentials;
    try {
      encryptedCredentials = EncryptionService.encryptCredentials(
        { username, applicationPassword },
        req.user.uid,
        masterKey
      );
    } catch (encryptionError) {
      encryptionError.code = 'ENCRYPTION_FAILED';
      
      const handledError = errorHandler.handleError(encryptionError, context);
      timer.error(encryptionError);
      
      return res.status(500).json(handledError);
    }

    // Store connection in Firestore (DISABLED)
    // const connectionData = {
    //   userId: req.user.uid,
    //   siteUrl: wpService.siteUrl,
    //   siteName: connectionTest.siteInfo.name,
    //   username: username,
    //   encryptedPassword: encryptedCredentials.encryptedData,
    //   encryptionIV: encryptedCredentials.iv,
    //   authTag: encryptedCredentials.authTag,
    //   siteType: wpService.siteType,
    //   apiEndpoint: wpService.apiEndpoint,
    //   status: CONNECTION_STATUS.ACTIVE,
    //   lastTested: admin.firestore.FieldValue.serverTimestamp(),
    //   createdAt: admin.firestore.FieldValue.serverTimestamp(),
    //   updatedAt: admin.firestore.FieldValue.serverTimestamp()
    // };

    // let docRef;
    // try {
    //   docRef = await db.collection('wordpress_connections').add(connectionData);
    // } catch (dbError) {
    //   dbError.code = 'DATABASE_ERROR';
    //   
    //   const handledError = errorHandler.handleError(dbError, {
    //     ...context,
    //     operation: 'store_connection'
    //   });
    //   timer.error(dbError);
    //   
    //   return res.status(500).json(handledError);
    // }

    const result = {
      success: true,
      connectionId: 'dummy-connection-id',
      siteInfo: connectionTest.siteInfo
    };

    timer.end(result);
    
    defaultLogger.info('WordPress connection established successfully', {
      ...context,
      connectionId: docRef.id,
      siteUrl: wpService.siteUrl,
      siteName: connectionTest.siteInfo.name
    });

    return res.status(200).json(result);

  } catch (error) {
    const handledError = errorHandler.handleError(error, context);
    timer.error(error);
    
    const statusCode = getErrorStatusCode(handledError.error.code);
    
    return res.status(statusCode).json(handledError);
  }
}

/**
 * GET /api/wordpress/connections
 * Retrieve user's WordPress connections
 */
async function handleGetConnections(req, res) {
  try {
    // Initialize database connection
    // if (!db) db = admin.firestore();
    
    // Verify authentication
    await new Promise((resolve, reject) => {
      verifyAuth(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // const connectionsSnapshot = await db
    //   .collection('wordpress_connections')
    //   .where('userId', '==', req.user.uid)
    //   .orderBy('createdAt', 'desc')
    //   .get();

    // const connections = connectionsSnapshot.docs.map(doc => {
    //   const data = doc.data();
    //   return {
    //     id: doc.id,
    //     siteUrl: data.siteUrl,
    //     siteName: data.siteName,
    //     username: data.username,
    //     siteType: data.siteType,
    //     status: data.status,
    //     lastTested: data.lastTested?.toDate(),
    //     createdAt: data.createdAt?.toDate()
    //   };
    // });
    const connections = [];

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
}

/**
 * DELETE /api/wordpress/connections/:id
 * Remove WordPress connection
 */
async function handleDeleteConnection(req, res) {
  try {
    // Initialize database connection
    // if (!db) db = admin.firestore();
    
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

    // Verify connection belongs to user (DISABLED)
    // const connectionDoc = await db.collection('wordpress_connections').doc(connectionId).get();
    
    // if (!connectionDoc.exists) {
    //   return res.status(404).json({
    //     success: false,
    //     error: {
    //       code: 'CONNECTION_NOT_FOUND',
    //       message: 'WordPress connection not found'
    //     }
    //   });
    // }

    // const connectionData = connectionDoc.data();
    // if (connectionData.userId !== req.user.uid) {
    //   return res.status(403).json({
    //     success: false,
    //     error: {
    //       code: 'ACCESS_DENIED',
    //       message: 'Access denied to this connection'
    //     }
    //   });
    // }

    // // Delete the connection
    // await db.collection('wordpress_connections').doc(connectionId).delete();

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
}

/**
 * GET /api/wordpress/test/:id
 * Test WordPress connection health with comprehensive validation
 */
async function handleTestConnection(req, res) {
  try {
    // Initialize database connection
    // if (!db) db = admin.firestore();
    
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

    // Get connection from database (DISABLED)
    // const connectionDoc = await db.collection('wordpress_connections').doc(connectionId).get();
    
    // if (!connectionDoc.exists) {
    //   return res.status(404).json({
    //     success: false,
    //     error: {
    //       code: 'CONNECTION_NOT_FOUND',
    //       message: 'WordPress connection not found'
    //     }
    //   });
    // }

    // const connectionData = connectionDoc.data();
    // if (connectionData.userId !== req.user.uid) {
    //   return res.status(403).json({
    //     success: false,
    //     error: {
    //       code: 'ACCESS_DENIED',
    //       message: 'Access denied to this connection'
    //     }
    //   });
    // }
    return res.status(400).json({ success: false, error: { code: 'DISABLED', message: 'This endpoint is disabled.' }});

    // Decrypt credentials
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      throw new Error('Encryption master key not configured');
    }

    let decryptedCredentials;
    try {
      decryptedCredentials = EncryptionService.decryptCredentials(
        {
          encryptedData: connectionData.encryptedPassword,
          iv: connectionData.encryptionIV,
          authTag: connectionData.authTag
        },
        req.user.uid,
        masterKey
      );
    } catch (decryptError) {
      // Credential decryption failed - likely corrupted or invalid
      const updateData = {
        status: CONNECTION_STATUS.ERROR,
        lastTested: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await db.collection('wordpress_connections').doc(connectionId).update(updateData);
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'CREDENTIAL_DECRYPTION_FAILED',
          message: 'Failed to decrypt stored credentials. Please reconnect your WordPress account.',
          details: { suggestion: 'Delete and recreate this connection' }
        }
      });
    }

    // Test connection with hybrid fallback and retry logic
    const wpService = new HybridWordPressService(
      connectionData.siteUrl,
      decryptedCredentials.username,
      decryptedCredentials.applicationPassword,
      { logger: defaultLogger }
    );

    // Parse query parameters for test options
    const withRetry = req.query.retry !== 'false';
    const maxAttempts = parseInt(req.query.maxAttempts) || 3;

    const testResult = await wpService.testConnection({ 
      withRetry, 
      maxAttempts: Math.min(maxAttempts, 5) // Cap at 5 attempts
    });

    // Determine new connection status based on test result
    let newStatus = CONNECTION_STATUS.ERROR;
    let statusReason = null;

    if (testResult.success) {
      newStatus = CONNECTION_STATUS.ACTIVE;
    } else {
      // Categorize the error for better status tracking
      const errorCode = testResult.error?.code;
      
      if (errorCode === 'AUTH_INVALID_CREDENTIALS' || errorCode === 'AUTH_EXPIRED_TOKEN') {
        statusReason = 'credentials_invalid';
      } else if (errorCode === 'NETWORK_UNREACHABLE' || errorCode === 'NETWORK_TIMEOUT') {
        statusReason = 'network_error';
      } else if (errorCode === 'API_NOT_FOUND') {
        statusReason = 'api_unavailable';
      } else {
        statusReason = 'unknown_error';
      }
    }

    // Update connection status in database with detailed information
    const updateData = {
      status: newStatus,
      statusReason: statusReason,
      lastTested: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastTestAttempts: testResult.attempts || 1
    };

    // Add error details if test failed
    if (!testResult.success && testResult.error) {
      updateData.lastError = {
        code: testResult.error.code,
        message: testResult.error.message,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };
    } else if (testResult.success) {
      // Clear previous error on successful test
      updateData.lastError = admin.firestore.FieldValue.delete();
      updateData.statusReason = admin.firestore.FieldValue.delete();
    }

    await db.collection('wordpress_connections').doc(connectionId).update(updateData);

    // Enhance response with health check details
    const response = {
      ...testResult,
      connectionId,
      healthCheck: {
        status: newStatus,
        statusReason,
        attempts: testResult.attempts || 1,
        timestamp: new Date().toISOString()
      }
    };

    // Add recommendations based on error type
    if (!testResult.success && testResult.error) {
      response.recommendations = getHealthCheckRecommendations(testResult.error.code);
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('Test connection error:', error);
    
    // Try to update connection status to error if we have the connection ID
    const connectionId = req.path.split('/').pop();
    if (connectionId && db) {
      try {
        await db.collection('wordpress_connections').doc(connectionId).update({
          status: CONNECTION_STATUS.ERROR,
          statusReason: 'system_error',
          lastTested: admin.firestore.FieldValue.serverTimestamp(),
          lastError: {
            code: 'INTERNAL_ERROR',
            message: 'System error during health check',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          }
        });
      } catch (updateError) {
        console.error('Failed to update connection status after error:', updateError);
      }
    }
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error during health check'
      }
    });
  }
}

/**
 * POST /api/wordpress/health/check
 * Run health checks on user's WordPress connections
 */
async function handleHealthCheck(req, res) {
  try {
    // Initialize database connection
    // if (!db) db = admin.firestore();
    
    // Verify authentication
    await new Promise((resolve, reject) => {
      verifyAuth(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      throw new Error('Encryption master key not configured');
    }

    // Parse options from request body
    const { maxAge = 3600000, batchSize = 10, userOnly = true } = req.body;

    const healthMonitor = new WordPressHealthMonitor(masterKey);

    let result;
    if (userOnly) {
      // Check only the current user's connections
      const connections = await WordPressDatabase.getUserConnections(req.user.uid);
      const connectionsNeedingCheck = connections.filter(conn => {
        const lastTested = conn.lastTested || new Date(0);
        return Date.now() - lastTested.getTime() > maxAge;
      });

      if (connectionsNeedingCheck.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No connections need health checking',
          checked: 0,
          results: []
        });
      }

      // Run health checks on user's connections
      const results = [];
      for (const connection of connectionsNeedingCheck) {
        const healthResult = await healthMonitor.checkConnectionHealth(connection);
        results.push(healthResult);
        
        // Update database with results
        try {
          await WordPressDatabase.updateConnectionHealth(
            connection.id,
            {
              status: healthResult.status,
              statusReason: healthResult.statusReason,
              attempts: healthResult.attempts,
              error: healthResult.error
            },
            req.user.uid
          );
        } catch (updateError) {
          console.error(`Failed to update health status for connection ${connection.id}:`, updateError);
        }
      }

      result = {
        success: true,
        message: `Health check completed for ${connectionsNeedingCheck.length} connections`,
        checked: connectionsNeedingCheck.length,
        results
      };
    } else {
      // Run system-wide health checks (admin only)
      result = await healthMonitor.runHealthChecks({ maxAge, batchSize });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed'
      }
    });
  }
}

/**
 * POST /api/wordpress/health/retry
 * Retry health checks for connections in error state
 */
async function handleHealthRetry(req, res) {
  try {
    // Initialize database connection
    // if (!db) db = admin.firestore();
    
    // Verify authentication
    await new Promise((resolve, reject) => {
      verifyAuth(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      throw new Error('Encryption master key not configured');
    }

    // Parse options from request body
    const { minRetryDelay = 300000, batchSize = 5, userOnly = true } = req.body;

    const healthMonitor = new WordPressHealthMonitor(masterKey);

    let result;
    if (userOnly) {
      // Retry only the current user's error connections
      const connections = await WordPressDatabase.getUserConnections(req.user.uid);
      const errorConnections = connections.filter(conn => {
        const lastTested = conn.lastTested || new Date(0);
        return conn.status === CONNECTION_STATUS.ERROR && 
               Date.now() - lastTested.getTime() > minRetryDelay;
      });

      if (errorConnections.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No error connections ready for retry',
          retried: 0,
          results: []
        });
      }

      // Retry health checks on user's error connections
      const results = [];
      for (const connection of errorConnections) {
        const healthResult = await healthMonitor.checkConnectionHealth(connection);
        results.push(healthResult);
        
        // Update database with results
        try {
          await WordPressDatabase.updateConnectionHealth(
            connection.id,
            {
              status: healthResult.status,
              statusReason: healthResult.statusReason,
              attempts: healthResult.attempts,
              error: healthResult.error
            },
            req.user.uid
          );
        } catch (updateError) {
          console.error(`Failed to update retry status for connection ${connection.id}:`, updateError);
        }
      }

      result = {
        success: true,
        message: `Health check retry completed for ${errorConnections.length} connections`,
        retried: errorConnections.length,
        results,
        summary: {
          recovered: results.filter(r => r.success).length,
          stillFailing: results.filter(r => !r.success).length
        }
      };
    } else {
      // Run system-wide retry (admin only)
      result = await healthMonitor.retryErrorConnections({ minRetryDelay, batchSize });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Health retry error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_RETRY_FAILED',
        message: 'Health retry failed'
      }
    });
  }
}

/**
 * Get recommendations based on health check error code
 * @param {string} errorCode - Error code from health check
 * @returns {Array} Array of recommendation strings
 */
function getHealthCheckRecommendations(errorCode) {
  const recommendations = {
    'AUTH_INVALID_CREDENTIALS': [
      'Verify your WordPress username is correct',
      'Check that your Application Password is still valid',
      'Regenerate your Application Password in WordPress admin',
      'Ensure your WordPress user has sufficient permissions'
    ],
    'AUTH_EXPIRED_TOKEN': [
      'Your Application Password may have expired',
      'Generate a new Application Password in WordPress admin',
      'Update your connection with the new credentials'
    ],
    'NETWORK_UNREACHABLE': [
      'Check that your WordPress site is online and accessible',
      'Verify the site URL is correct',
      'Check for any firewall or hosting restrictions',
      'Try again in a few minutes if this is a temporary issue'
    ],
    'NETWORK_TIMEOUT': [
      'Your WordPress site may be experiencing high load',
      'Check your hosting provider status',
      'Try the test again in a few minutes',
      'Consider contacting your hosting provider if the issue persists'
    ],
    'API_NOT_FOUND': [
      'Ensure WordPress REST API is enabled on your site',
      'Check if any security plugins are blocking API access',
      'Verify your WordPress version supports REST API (5.0+)',
      'Contact your hosting provider about API restrictions'
    ],
    'API_RATE_LIMITED': [
      'You are making too many requests to WordPress',
      'Wait a few minutes before testing again',
      'Check if your hosting provider has API rate limits',
      'Consider upgrading your hosting plan if limits are too restrictive'
    ]
  };

  return recommendations[errorCode] || [
    'Check your WordPress site accessibility',
    'Verify your credentials are correct',
    'Try testing the connection again',
    'Contact support if the issue persists'
  ];
}

/**
 * POST /api/wordpress/publish
 * Publish article to WordPress
 */
async function handlePublish(req, res) {
  try {
    // Initialize database connection
    // if (!db) db = admin.firestore();
    
    // Verify authentication
    await new Promise((resolve, reject) => {
      verifyAuth(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { connectionId, articleData, postOptions = {} } = req.body;

    return res.status(400).json({ success: false, error: { code: 'DISABLED', message: 'This endpoint is deprecated. Use /publish-direct instead.' }});


    // Validate required fields
    if (!connectionId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CONNECTION_ID',
          message: 'Connection ID is required'
        }
      });
    }

    if (!articleData) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ARTICLE_DATA',
          message: 'Article data is required'
        }
      });
    }

    // Validate article data structure
    const validation = validateArticleData(articleData);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ARTICLE_DATA',
          message: 'Article data validation failed',
          details: {
            errors: validation.errors,
            warnings: validation.warnings
          }
        }
      });
    }

    // Get WordPress connection
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

    // Check connection status
    if (connectionData.status !== CONNECTION_STATUS.ACTIVE) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONNECTION_INACTIVE',
          message: 'WordPress connection is not active. Please test the connection first.'
        }
      });
    }

    // Decrypt credentials
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      throw new Error('Encryption master key not configured');
    }

    const decryptedCredentials = EncryptionService.decryptCredentials(
      {
        encryptedData: connectionData.encryptedPassword,
        iv: connectionData.encryptionIV,
        authTag: connectionData.authTag
      },
      req.user.uid,
      masterKey
    );

    // Convert article to WordPress post format
    const convertOptions = {
      status: postOptions.status || POST_STATUS.DRAFT,
      categories: postOptions.categories || [],
      tags: postOptions.tags || [],
      preserveFormatting: postOptions.preserveFormatting !== false
    };

    let wordpressPostData;
    try {
      wordpressPostData = convertJsonToWordPressPost(articleData, convertOptions);
    } catch (conversionError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONTENT_CONVERSION_FAILED',
          message: 'Failed to convert article to WordPress format',
          details: { error: conversionError.message }
        }
      });
    }

    // Create WordPress service instance with hybrid fallback
    const wpService = new HybridWordPressService(
      connectionData.siteUrl,
      decryptedCredentials.username,
      decryptedCredentials.applicationPassword,
      { logger: defaultLogger }
    );

    // Publish to WordPress
    let publishResult;
    try {
      publishResult = await wpService.createPost(wordpressPostData);
    } catch (publishError) {
      return res.status(400).json({
        success: false,
        error: {
          code: publishError.code || 'PUBLISH_FAILED',
          message: publishError.message || 'Failed to publish post to WordPress',
          details: publishError.details || {}
        }
      });
    }

    // Store post record in database
    const postRecord = {
      userId: req.user.uid,
      connectionId: connectionId,
      wordpressPostId: publishResult.id,
      title: articleData.title,
      status: publishResult.status,
      wordpressUrl: publishResult.url,
      editUrl: publishResult.editUrl,
      articleData: articleData,
      publishedAt: publishResult.status === POST_STATUS.PUBLISH ? 
        admin.firestore.FieldValue.serverTimestamp() : null
    };

    try {
      const postRecordId = await WordPressDatabase.createPostRecord(postRecord);
      
      return res.status(200).json({
        success: true,
        postId: publishResult.id,
        postUrl: publishResult.url,
        editUrl: publishResult.editUrl,
        status: publishResult.status,
        recordId: postRecordId
      });
    } catch (dbError) {
      // Post was created in WordPress but failed to save record
      // Still return success but log the error
      console.error('Failed to save post record to database:', dbError);
      
      return res.status(200).json({
        success: true,
        postId: publishResult.id,
        postUrl: publishResult.url,
        editUrl: publishResult.editUrl,
        status: publishResult.status,
        warning: 'Post published successfully but failed to save record to database'
      });
    }

  } catch (error) {
    console.error('WordPress publish error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  }
}

/**
 * Handle media upload to WordPress
 */
async function handleMediaUpload(req, res) {
  const context = {
    operation: 'media_upload',
    method: req.method,
    path: req.path,
    userId: req.user?.uid
  };
  
  const timer = defaultLogger.startOperation('media_upload', context);
  
  try {
    // Initialize database connection
    // if (!db) db = admin.firestore();
    
    // Verify authentication
    await new Promise((resolve, reject) => {
      verifyAuth(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { connectionId, fileData, filename, mimeType, title, altText, caption, description } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!connectionId) missingFields.push('connectionId');
    if (!fileData) missingFields.push('fileData');
    if (!filename) missingFields.push('filename');
    if (!mimeType) missingFields.push('mimeType');

    if (missingFields.length > 0) {
      const error = new Error(`Missing required fields: ${missingFields.join(', ')}`);
      error.code = 'MISSING_REQUIRED_FIELDS';
      error.details = { missingFields };
      
      const handledError = errorHandler.handleError(error, context);
      timer.error(error);
      
      return res.status(400).json(handledError);
    }

    defaultLogger.info('Uploading media to WordPress', {
      ...context,
      connectionId,
      filename,
      mimeType
    });

    // Get WordPress connection
    const wpDatabase = new WordPressDatabase(db, defaultLogger);
    const connection = await wpDatabase.getConnection(connectionId, req.user.uid);

    if (!connection) {
      const error = new Error('WordPress connection not found');
      error.code = 'CONNECTION_NOT_FOUND';
      
      const handledError = errorHandler.handleError(error, context);
      timer.error(error);
      
      return res.status(404).json(handledError);
    }

    // Decrypt credentials
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      const error = new Error('Encryption master key not configured');
      error.code = 'ENCRYPTION_KEY_MISSING';
      
      const handledError = errorHandler.handleError(error, context);
      timer.error(error);
      
      return res.status(500).json(handledError);
    }

    let credentials;
    try {
      credentials = EncryptionService.decryptCredentials(
        {
          encryptedData: connection.encryptedPassword,
          iv: connection.encryptionIV
        },
        req.user.uid,
        masterKey
      );
    } catch (decryptionError) {
      decryptionError.code = 'DECRYPTION_FAILED';
      
      const handledError = errorHandler.handleError(decryptionError, context);
      timer.error(decryptionError);
      
      return res.status(500).json(handledError);
    }

    // Create WordPress service
    const wpService = new WordPressService(
      connection.siteUrl,
      credentials.username,
      credentials.applicationPassword,
      { logger: defaultLogger }
    );

    // Upload media
    const uploadOptions = {
      filename,
      mimeType,
      title,
      altText,
      caption,
      description
    };

    const mediaResult = await wpService.uploadMedia(fileData, uploadOptions);

    defaultLogger.info('WordPress media uploaded successfully', {
      ...context,
      connectionId,
      mediaId: mediaResult.id,
      mediaUrl: mediaResult.url,
      filename: mediaResult.filename
    });

    timer.end({ success: true });

    return res.status(200).json({
      success: true,
      media: mediaResult
    });

  } catch (error) {
    const handledError = errorHandler.handleError(error, context);
    timer.error(error);
    
    defaultLogger.error('WordPress media upload error', {
      ...context,
      error: handledError.error
    });

    // Determine appropriate status code
    const statusCode = getErrorStatusCode(handledError.error.code);
    
    return res.status(statusCode).json(handledError);
  }
}

// Export for testing
function resetDb() {
  db = null;
}

module.exports = { handler, verifyAuth, resetDb };