/**
 * Webflow API Handler
 * Handles all Webflow-related API endpoints for CMS publishing
 */

// Simple auth bypass for testing (same as WordPress/Shopify)
async function verifyAuth(req, res, next) {
  req.user = { uid: 'test-user' };
  next();
}

/**
 * Main Webflow API handler
 */
async function handler(req, res) {
  const path = req.path.replace('/webflow', '');

  try {
    switch (true) {
      case path === '/connect' && req.method === 'POST':
        return await handleConnect(req, res);
      case path === '/publish-direct' && req.method === 'POST':
        return await handlePublishDirect(req, res);
      case path === '/sites' && req.method === 'GET':
        return await handleGetSites(req, res);
      case path === '/collections' && req.method === 'GET':
        return await handleGetCollections(req, res);
      case path === '/test-connection' && req.method === 'POST':
        return await handleTestConnection(req, res);
      default:
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Webflow route ${path} not found`
          }
        });
    }
  } catch (error) {
    console.error('Webflow API Error:', error);
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
 * POST /api/webflow/connect
 * Test Webflow connection and get site info
 */
async function handleConnect(req, res) {
  const { apiToken } = req.body;

  // Basic validation
  if (!apiToken) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETERS',
        message: 'Missing required parameter: apiToken'
      }
    });
  }

  try {
    // Test connection by fetching sites
    const testResult = await testWebflowConnection(apiToken);

    if (!testResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: testResult.error.message || 'Failed to connect to Webflow'
        }
      });
    }

    return res.status(200).json({
      success: true,
      sites: testResult.sites,
      user: testResult.user
    });

  } catch (error) {
    console.error('Webflow connect error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CONNECT_ERROR',
        message: error.message || 'Failed to connect to Webflow'
      }
    });
  }
}

/**
 * POST /api/webflow/publish-direct
 * Publish article directly to Webflow CMS
 */
async function handlePublishDirect(req, res) {
  const { apiToken, siteId, collectionId, articleData, publishOptions = {} } = req.body;

  // Basic validation
  if (!apiToken || !siteId || !collectionId || !articleData) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETERS',
        message: 'Missing required parameters: apiToken, siteId, collectionId, articleData'
      }
    });
  }

  try {
    // Test connection first
    const testResult = await testWebflowConnection(apiToken);
    if (!testResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: 'Failed to connect to Webflow'
        }
      });
    }

    // Prepare article data for Webflow
    const webflowItem = prepareArticleForWebflow(articleData, publishOptions);

    // Publish to Webflow
    const publishResult = await publishToWebflow(apiToken, collectionId, webflowItem, siteId);

    if (!publishResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PUBLISH_FAILED',
          message: publishResult.error || 'Failed to publish to Webflow'
        }
      });
    }

    return res.status(200).json({
      success: true,
      item: publishResult.item,
      previewUrl: publishResult.previewUrl
    });

  } catch (error) {
    console.error('Webflow publish direct error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PUBLISH_ERROR',
        message: error.message || 'Failed to publish to Webflow'
      }
    });
  }
}

/**
 * GET /api/webflow/sites
 * Get list of sites from Webflow account
 */
async function handleGetSites(req, res) {
  const { apiToken } = req.query;

  if (!apiToken) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETERS',
        message: 'Missing required parameter: apiToken'
      }
    });
  }

  try {
    const sitesResult = await getWebflowSites(apiToken);

    if (!sitesResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SITES_FETCH_FAILED',
          message: sitesResult.error || 'Failed to fetch sites'
        }
      });
    }

    return res.status(200).json({
      success: true,
      sites: sitesResult.sites
    });

  } catch (error) {
    console.error('Webflow get sites error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SITES_ERROR',
        message: error.message || 'Failed to fetch sites'
      }
    });
  }
}

/**
 * GET /api/webflow/collections
 * Get collections for a specific site
 */
async function handleGetCollections(req, res) {
  const { apiToken, siteId } = req.query;

  if (!apiToken || !siteId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETERS',
        message: 'Missing required parameters: apiToken, siteId'
      }
    });
  }

  try {
    const collectionsResult = await getWebflowCollections(apiToken, siteId);

    if (!collectionsResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'COLLECTIONS_FETCH_FAILED',
          message: collectionsResult.error || 'Failed to fetch collections'
        }
      });
    }

    return res.status(200).json({
      success: true,
      collections: collectionsResult.collections
    });

  } catch (error) {
    console.error('Webflow get collections error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'COLLECTIONS_ERROR',
        message: error.message || 'Failed to fetch collections'
      }
    });
  }
}

/**
 * POST /api/webflow/test-connection
 * Test Webflow connection
 */
async function handleTestConnection(req, res) {
  const { apiToken } = req.body;

  if (!apiToken) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETERS',
        message: 'Missing required parameter: apiToken'
      }
    });
  }

  try {
    const testResult = await testWebflowConnection(apiToken);
    return res.status(testResult.success ? 200 : 400).json(testResult);

  } catch (error) {
    console.error('Webflow test connection error:', error);
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
 * Test Webflow connection and get user/sites info
 */
async function testWebflowConnection(apiToken) {
  try {
    const fetch = (await import('node-fetch')).default;

    // Get user info
    const userResponse = await fetch('https://api.webflow.com/v2/token/authorized_by', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'accept-version': '1.0.0',
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      return {
        success: false,
        error: `Webflow API error: ${userResponse.status} ${userResponse.statusText}`
      };
    }

    const userData = await userResponse.json();

    // Get sites
    const sitesResponse = await fetch('https://api.webflow.com/v2/sites', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'accept-version': '1.0.0',
        'Content-Type': 'application/json'
      }
    });

    if (!sitesResponse.ok) {
      return {
        success: false,
        error: `Failed to fetch sites: ${sitesResponse.status} ${sitesResponse.statusText}`
      };
    }

    const sitesData = await sitesResponse.json();

    return {
      success: true,
      user: userData,
      sites: sitesData.sites || []
    };

  } catch (error) {
    console.error('Webflow connection test error:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect to Webflow'
    };
  }
}

/**
 * Get Webflow sites
 */
async function getWebflowSites(apiToken) {
  try {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch('https://api.webflow.com/v2/sites', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'accept-version': '1.0.0',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch sites: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();

    return {
      success: true,
      sites: data.sites || []
    };

  } catch (error) {
    console.error('Get Webflow sites error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch sites'
    };
  }
}

/**
 * Get Webflow collections for a site
 */
async function getWebflowCollections(apiToken, siteId) {
  try {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(`https://api.webflow.com/v2/sites/${siteId}/collections`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'accept-version': '1.0.0',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch collections: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();

    return {
      success: true,
      collections: data.collections || []
    };

  } catch (error) {
    console.error('Get Webflow collections error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch collections'
    };
  }
}

/**
 * Prepare article data for Webflow format
 */
function prepareArticleForWebflow(articleData, options = {}) {
  // Get content from any of the possible field names sent by frontend
  let content = articleData.content || articleData.body || articleData.body_html || 
                articleData['post-body'] || articleData.text || articleData.html || '';

  // Only remove potentially problematic elements, keep essential styling
  content = content.replace(/<!--[^>]*-->/g, ''); // Remove comments

  // Create Webflow CMS item structure with fieldData wrapper
  // Use multiple possible field names that are commonly used in Webflow collections
  const fieldData = {
    // Required fields that should exist in most Webflow blog collections
    name: articleData.title || 'Untitled Article',
    slug: generateSlug(articleData.title || 'untitled-article')
  };

  // Add content with multiple possible field names
  if (content) {
    // Try multiple common field names for body content
    const bodyFieldNames = ['body', 'content', 'post-body', 'description', 'text', 'html', 'rich-text', 'article-body'];
    // We'll add all of them and let the schema validation filter out the ones that don't exist
    bodyFieldNames.forEach(fieldName => {
      fieldData[fieldName] = content;
    });
  }

  // Add summary with multiple possible field names
  const summary = articleData.summary || articleData.excerpt || articleData.summary_html || 
                  articleData['meta-description'] || articleData.subtitle || '';
  if (summary) {
    const summaryFieldNames = ['summary', 'excerpt', 'post-summary', 'meta-description', 'subtitle', 'description'];
    summaryFieldNames.forEach(fieldName => {
      fieldData[fieldName] = summary;
    });
  }

  // Add author if available
  if (articleData.author) {
    const authorFieldNames = ['author', 'byline', 'writer', 'contributor'];
    authorFieldNames.forEach(fieldName => {
      fieldData[fieldName] = articleData.author;
    });
  }

  // Add date with multiple possible field names
  const dateValue = new Date().toISOString();
  const dateFieldNames = ['date', 'publish-date', 'created-date', 'post-date'];
  dateFieldNames.forEach(fieldName => {
    fieldData[fieldName] = dateValue;
  });

  // Remove null/undefined values
  Object.keys(fieldData).forEach(key => {
    if (fieldData[key] === null || fieldData[key] === undefined || fieldData[key] === '') {
      delete fieldData[key];
    }
  });

  console.log('Prepared fieldData with multiple field name options:', Object.keys(fieldData));

  // Return the correct Webflow API structure
  return {
    fieldData: fieldData,
    isArchived: false,
    isDraft: false
  };
}

/**
 * Generate URL-friendly slug from title
 */
function generateSlug(title, addTimestamp = false) {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .substring(0, 80); // Leave room for timestamp if needed

  if (addTimestamp) {
    // Add timestamp to make slug unique
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    baseSlug = `${baseSlug}-${timestamp}`;
  }

  return baseSlug.substring(0, 100); // Final length limit
}

/**
 * Get collection fields to understand the schema
 */
async function getCollectionFields(apiToken, collectionId) {
  try {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(`https://api.webflow.com/v2/collections/${collectionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'accept-version': '1.0.0',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('Could not fetch collection schema, proceeding with generic fields');
      return null;
    }

    const data = await response.json();
    return data.fields || [];
  } catch (error) {
    console.warn('Error fetching collection fields:', error);
    return null;
  }
}

/**
 * Get site information for URL generation
 */
async function getSiteInfo(apiToken, siteId) {
  try {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(`https://api.webflow.com/v2/sites/${siteId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'accept-version': '1.0.0',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('Could not fetch site info for URL generation');
      return null;
    }

    const data = await response.json();
    return {
      domain: data.domain || data.shortName,
      customDomain: data.customDomain
    };
  } catch (error) {
    console.warn('Error fetching site info:', error);
    return null;
  }
}

/**
 * Get collection information for URL generation
 */
async function getCollectionInfo(apiToken, collectionId) {
  try {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(`https://api.webflow.com/v2/collections/${collectionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'accept-version': '1.0.0',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('Could not fetch collection info for URL generation');
      return null;
    }

    const data = await response.json();
    return {
      slug: data.slug,
      name: data.name
    };
  } catch (error) {
    console.warn('Error fetching collection info:', error);
    return null;
  }
}

/**
 * Publish article to Webflow CMS
 */
async function publishToWebflow(apiToken, collectionId, itemData, siteId) {
  try {
    const fetch = (await import('node-fetch')).default;

    // First, try to get the collection schema to understand available fields
    const collectionFields = await getCollectionFields(apiToken, collectionId);

    if (collectionFields) {
      console.log('Available collection fields:', collectionFields.map(f => ({ slug: f.slug, type: f.type })));

      // Filter itemData.fieldData to only include fields that exist in the collection
      const filteredFieldData = {};
      const availableFieldSlugs = collectionFields.map(f => f.slug);

      console.log('Attempting to send fields:', Object.keys(itemData.fieldData));

      Object.keys(itemData.fieldData).forEach(key => {
        if (availableFieldSlugs.includes(key)) {
          filteredFieldData[key] = itemData.fieldData[key];
          console.log(`✓ Including field '${key}'`);
        } else {
          console.log(`✗ Skipping field '${key}' - not in collection schema`);
        }
      });

      // Ensure we have at least name and slug (required fields)
      if (!filteredFieldData.name) {
        filteredFieldData.name = itemData.fieldData.name || 'Untitled Article';
        console.log('Added required field: name');
      }
      if (!filteredFieldData.slug) {
        filteredFieldData.slug = itemData.fieldData.slug || 'untitled-article';
        console.log('Added required field: slug');
      }

      // Check if we have any content fields matched
      const contentFields = ['body', 'content', 'post-body', 'description', 'text', 'html', 'rich-text', 'article-body'];
      const hasContentField = contentFields.some(field => filteredFieldData[field]);
      
      if (!hasContentField) {
        console.warn('WARNING: No content field was matched in the collection schema!');
        console.warn('Available fields in collection:', availableFieldSlugs);
        console.warn('Attempted content fields:', contentFields);
        
        // Return detailed error to help user understand the issue
        return {
          success: false,
          error: `Could not find a matching content field in the Webflow collection. ` +
                 `The collection has these fields: ${availableFieldSlugs.join(', ')}. ` +
                 `We tried to match: ${contentFields.join(', ')}. ` +
                 `Please ensure your Webflow collection has a rich text field for the article content.`
        };
      }

      itemData.fieldData = filteredFieldData;
      console.log('Final fieldData being sent to Webflow:', Object.keys(filteredFieldData));
    } else {
      console.log('Could not fetch collection schema, sending all fields as-is');
      // As a fallback, try to send at least the basic content fields
      // that are most commonly used in Webflow blog collections
      const fallbackFields = ['body', 'content', 'description', 'text'];
      let hasContentField = false;

      for (const field of fallbackFields) {
        if (itemData.fieldData[field]) {
          hasContentField = true;
          console.log(`Fallback: Keeping content field '${field}'`);
          break;
        }
      }

      if (!hasContentField && itemData.fieldData.body_html) {
        // If no standard content field exists, try to map body_html to a common field
        itemData.fieldData.content = itemData.fieldData.body_html;
        console.log('Fallback: Mapped body_html to content field');
      }
    }

    let response = await fetch(`https://api.webflow.com/v2/collections/${collectionId}/items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'accept-version': '1.0.0',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(itemData)
    });

    // Handle slug uniqueness error by retrying with timestamp
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Webflow API Error Response:', errorText);

      // Check if it's a slug uniqueness error
      if (errorText.includes('Unique value is already in database') && errorText.includes('slug')) {
        console.log('Slug conflict detected, retrying with unique slug...');

        // Generate new slug with timestamp
        const originalSlug = itemData.fieldData.slug;
        const uniqueSlug = generateSlug(originalSlug.replace(/-\d+$/, ''), true); // Remove any existing timestamp and add new one

        // Update the slug in itemData
        itemData.fieldData.slug = uniqueSlug;
        console.log(`Retrying with unique slug: ${uniqueSlug}`);

        // Retry the request with the new slug
        response = await fetch(`https://api.webflow.com/v2/collections/${collectionId}/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'accept-version': '1.0.0',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(itemData)
        });

        if (!response.ok) {
          const retryErrorText = await response.text();
          console.error('Webflow API Error on retry:', retryErrorText);
          return {
            success: false,
            error: `Webflow API error: ${response.status} ${response.statusText} - ${retryErrorText}`
          };
        }
      } else {
        return {
          success: false,
          error: `Webflow API error: ${response.status} ${response.statusText} - ${errorText}`
        };
      }
    }

    const data = await response.json();
    console.log('Webflow API Success Response:', JSON.stringify(data, null, 2));

    // Validate that the item was created with content
    if (!data || !data.id) {
      return {
        success: false,
        error: 'Failed to create item in Webflow - no item ID returned'
      };
    }

    // Check if the created item has any content
    const contentFields = ['body', 'content', 'post-body', 'description', 'text', 'html', 'rich-text', 'article-body'];
    const hasContent = data.fieldData && contentFields.some(field => data.fieldData[field]);
    
    if (!hasContent) {
      console.warn('WARNING: Item was created but appears to have no content!');
      console.warn('Item fieldData:', data.fieldData ? Object.keys(data.fieldData) : 'none');
    }

    // Publish the site to make the new item live
    try {
      console.log('Publishing site to make new item live...');
      const publishResponse = await fetch(`https://api.webflow.com/v2/sites/${siteId}/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'accept-version': '1.0.0',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          publishToWebflowSubdomain: true
        })
      });

      if (!publishResponse.ok) {
        const publishError = await publishResponse.text();
        console.warn('Could not auto-publish site:', publishError);
        console.warn('The item was created but you need to manually publish in Webflow for it to be live');
      } else {
        console.log('Site published successfully!');
      }
    } catch (publishError) {
      console.warn('Auto-publish failed:', publishError);
      console.warn('The item was created but you need to manually publish in Webflow for it to be live');
    }

    // Generate preview URL if item was created
    let previewUrl = null;
    if (data && data.id && data.fieldData && data.fieldData.slug) {
      try {
        // Get site and collection info for URL generation
        const [siteInfo, collectionInfo] = await Promise.all([
          getSiteInfo(apiToken, siteId),
          getCollectionInfo(apiToken, collectionId)
        ]);

        if (siteInfo && collectionInfo) {
          // Use custom domain if available, otherwise use webflow.io domain
          const domain = siteInfo.customDomain || `${siteInfo.domain}.webflow.io`;
          const itemSlug = data.fieldData.slug;
          const collectionSlug = collectionInfo.slug;

          // Construct the preview URL
          previewUrl = `https://${domain}/${collectionSlug}/${itemSlug}`;
          console.log('Generated preview URL:', previewUrl);
        }
      } catch (urlError) {
        console.warn('Could not generate preview URL:', urlError);
        // Don't fail the whole operation if URL generation fails
      }
    }

    return {
      success: true,
      item: data,
      previewUrl: previewUrl
    };

  } catch (error) {
    console.error('Publish to Webflow error:', error);
    return {
      success: false,
      error: error.message || 'Failed to publish to Webflow'
    };
  }
}

module.exports = { handler };