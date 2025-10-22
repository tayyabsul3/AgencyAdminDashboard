/**
 * Example Protected API Route
 * Demonstrates how to use authentication middleware
 */

import { withAuth, getUserIdFromRequest } from '../../middleware/auth';

/**
 * Protected API route handler
 * @param {Request} req - Request object
 * @param {Response} res - Response object
 */
async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'method-not-allowed',
        message: 'Method not allowed'
      }
    });
  }

  try {
    // Get user ID from authenticated request
    const userId = getUserIdFromRequest(req);
    
    // Example: Return user-specific data
    const userData = {
      userId,
      message: 'This is protected data',
      timestamp: new Date().toISOString(),
      userEmail: req.user?.email
    };

    return res.status(200).json({
      success: true,
      data: userData
    });

  } catch (error) {
    console.error('Protected route error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'internal-error',
        message: 'Internal server error'
      }
    });
  }
}

// Export the handler wrapped with authentication middleware
export default withAuth(handler);