/**
 * Shopify API Handler
 * Handles all Shopify-related API endpoints for blog publishing
 */

// Simple auth bypass for testing (same as WordPress)
async function verifyAuth(req, res, next) {
  req.user = { uid: 'test-user' };
  next();
}

/**
 * Main Shopify API handler
 */
async function handler(req, res) {
  const path = req.path.replace('/shopify', '');

  try {
    switch (true) {
      case path === '/connect' && req.method === 'POST':
        return await handleConnect(req, res);
      case path === '/publish-direct' && req.method === 'POST':
        return await handlePublishDirect(req, res);
      case path === '/blogs' && req.method === 'GET':
        return await handleGetBlogs(req, res);
      case path === '/test-connection' && req.method === 'POST':
        return await handleTestConnection(req, res);
      default:
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Shopify route ${path} not found`
          }
        });
    }
  } catch (error) {
    console.error('Shopify API Error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: error.message
      }
    });
  }
}

/**
 * POST /api/shopify/connect
 * Test Shopify connection and store credentials
 */
async function handleConnect(req, res) {
  const { storeUrl, apiKey, apiSecret, blogId } = req.body;

  // Basic validation
  if (!storeUrl || !apiKey || !apiSecret) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETERS',
        message: 'Missing required parameters: storeUrl, apiKey, apiSecret'
      }
    });
  }

  try {
    // Test connection by fetching blogs
    const testResult = await testShopifyConnection(storeUrl, apiKey, apiSecret);

    if (!testResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: testResult.error.message || 'Failed to connect to Shopify'
        }
      });
    }

    return res.status(200).json({
      success: true,
      blogs: testResult.blogs,
      storeInfo: testResult.storeInfo
    });

  } catch (error) {
    console.error('Shopify connect error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CONNECT_ERROR',
        message: error.message || 'Failed to connect to Shopify'
      }
    });
  }
}

/**
 * POST /api/shopify/publish-direct
 * Publish article directly to Shopify blog
 */
async function handlePublishDirect(req, res) {
  const { storeUrl, apiKey, apiSecret, blogId, articleData, publishOptions = {} } = req.body;

  // Basic validation
  if (!storeUrl || !apiKey || !apiSecret || !articleData) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETERS',
        message: 'Missing required parameters'
      }
    });
  }

  try {
    // Test connection first
    const testResult = await testShopifyConnection(storeUrl, apiKey, apiSecret);
    if (!testResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: 'Failed to connect to Shopify'
        }
      });
    }

    const availableBlogs = testResult.blogs || [];
    let resolvedBlogId = blogId;

    if (!resolvedBlogId && availableBlogs.length > 0) {
      resolvedBlogId = availableBlogs[0].id;
    }

    if (!resolvedBlogId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_BLOG_FOUND',
          message: 'No Shopify blogs available for publishing. Please create a blog in your store first.'
        }
      });
    }

    // Prepare article data for Shopify
    const shopifyArticle = prepareArticleForShopify(articleData, publishOptions);

    // Publish to Shopify
    const publishResult = await publishToShopify(storeUrl, apiKey, apiSecret, resolvedBlogId, shopifyArticle);

    if (!publishResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PUBLISH_FAILED',
          message: publishResult.error || 'Failed to publish to Shopify'
        }
      });
    }

    // Construct the public URL for the published article
    const cleanStoreUrl = storeUrl.replace(/\/$/, '');
    const article = publishResult.article;

    // Get blog handle - try to fetch it, fallback to 'news' (default blog handle)
    let blogHandle = 'news'; // Default fallback
    try {
      const fetch = (await import('node-fetch')).default;
      const blogResponse = await fetch(`${cleanStoreUrl}/admin/api/2024-01/blogs/${resolvedBlogId}.json`, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (blogResponse.ok) {
        const blogData = await blogResponse.json();
        blogHandle = blogData.blog.handle || 'news';
      }
    } catch (error) {
      console.warn('Could not fetch blog handle, using default:', error.message);
    }

    // Construct public article URL
    const articleUrl = `${cleanStoreUrl}/blogs/${blogHandle}/${article.handle}`;

    return res.status(200).json({
      success: true,
      article: publishResult.article,
      url: articleUrl,
      blogId: resolvedBlogId
    });

  } catch (error) {
    console.error('Shopify publish direct error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PUBLISH_ERROR',
        message: error.message || 'Failed to publish to Shopify'
      }
    });
  }
}

/**
 * GET /api/shopify/blogs
 * Get list of blogs from Shopify store
 */
async function handleGetBlogs(req, res) {
  const { storeUrl, apiKey, apiSecret } = req.query;

  if (!storeUrl || !apiKey || !apiSecret) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETERS',
        message: 'Missing required parameters: storeUrl, apiKey, apiSecret'
      }
    });
  }

  try {
    const blogsResult = await getShopifyBlogs(storeUrl, apiKey, apiSecret);

    if (!blogsResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BLOGS_FETCH_FAILED',
          message: blogsResult.error || 'Failed to fetch blogs'
        }
      });
    }

    return res.status(200).json({
      success: true,
      blogs: blogsResult.blogs
    });

  } catch (error) {
    console.error('Shopify get blogs error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'BLOGS_ERROR',
        message: error.message || 'Failed to fetch blogs'
      }
    });
  }
}

/**
 * POST /api/shopify/test-connection
 * Test Shopify connection
 */
async function handleTestConnection(req, res) {
  const { storeUrl, apiKey, apiSecret } = req.body;

  if (!storeUrl || !apiKey || !apiSecret) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETERS',
        message: 'Missing required parameters'
      }
    });
  }

  try {
    const testResult = await testShopifyConnection(storeUrl, apiKey, apiSecret);
    return res.status(testResult.success ? 200 : 400).json(testResult);

  } catch (error) {
    console.error('Shopify test connection error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'TEST_ERROR',
        message: error.message || 'Connection test failed'
      }
    });
  }
}

// Helper Functions

/**
 * Test Shopify connection and get store info
 */
async function testShopifyConnection(storeUrl, apiKey, apiSecret) {
  try {
    const fetch = (await import('node-fetch')).default;

    // Clean store URL
    const cleanStoreUrl = storeUrl.replace(/\/$/, '');

    // Get store info
    const storeResponse = await fetch(`${cleanStoreUrl}/admin/api/2024-01/shop.json`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!storeResponse.ok) {
      return {
        success: false,
        error: `Shopify API error: ${storeResponse.status} ${storeResponse.statusText}`
      };
    }

    const storeData = await storeResponse.json();

    // Get blogs
    const blogsResponse = await fetch(`${cleanStoreUrl}/admin/api/2024-01/blogs.json`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!blogsResponse.ok) {
      return {
        success: false,
        error: `Failed to fetch blogs: ${blogsResponse.status} ${blogsResponse.statusText}`
      };
    }

    const blogsData = await blogsResponse.json();

    return {
      success: true,
      storeInfo: storeData.shop,
      blogs: blogsData.blogs || []
    };

  } catch (error) {
    console.error('Shopify connection test error:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect to Shopify'
    };
  }
}

/**
 * Get Shopify blogs
 */
async function getShopifyBlogs(storeUrl, apiKey, apiSecret) {
  try {
    const fetch = (await import('node-fetch')).default;
    const cleanStoreUrl = storeUrl.replace(/\/$/, '');

    const response = await fetch(`${cleanStoreUrl}/admin/api/2024-01/blogs.json`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch blogs: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();

    return {
      success: true,
      blogs: data.blogs || []
    };

  } catch (error) {
    console.error('Get Shopify blogs error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch blogs'
    };
  }
}

/**
 * Prepare article data for Shopify format
 */
function prepareArticleForShopify(articleData, options = {}) {
  // Use the body_html directly from frontend (no stripping needed for Shopify)
  let content = articleData.body_html || '';

  // Only remove potentially problematic elements, keep essential styling
  content = content.replace(/<!--[^>]*-->/g, ''); // Remove comments

  return {
    article: {
      title: articleData.title || 'Untitled Article',
      author: articleData.author || 'QueryFuel',
      body_html: content,
      summary_html: articleData.summary_html || articleData.excerpt || articleData.summary || '',
      published: options.publish !== false, // Default to published
      tags: options.tags || [],
      metafields: options.metafields || []
    }
  };
}

/**
 * Publish article to Shopify
 */
async function publishToShopify(storeUrl, apiKey, apiSecret, blogId, articleData) {
  try {
    const fetch = (await import('node-fetch')).default;
    const cleanStoreUrl = storeUrl.replace(/\/$/, '');

    const response = await fetch(`${cleanStoreUrl}/admin/api/2024-01/blogs/${blogId}/articles.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(articleData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Shopify API error: ${response.status} ${response.statusText} - ${errorText}`
      };
    }

    const data = await response.json();

    return {
      success: true,
      article: data.article
    };

  } catch (error) {
    console.error('Publish to Shopify error:', error);
    return {
      success: false,
      error: error.message || 'Failed to publish to Shopify'
    };
  }
}

module.exports = { handler };