const { validateMethod, validateRequiredFields, sanitizeInput, handleApiError, sendResponse } = require('../lib/api-utils');
/* Firestore integration removed from this endpoint */

/**
 * Handle Word Document generation requests
 * This bypasses CORS by making server-to-server requests to Google Apps Script
 */
const handler = async (req, res) => {
  try {
    validateMethod(req, ['POST']);

    const body = sanitizeInput(req.body);
    validateRequiredFields(body, ['articleData']);

    const { articleData, image_url } = body;

    console.log('🔄 Starting Word document generation via Firebase Function');
    console.log('📊 Article data keys:', Object.keys(articleData));
    console.log('🖼️ Image URL received:', image_url ? 'YES' : 'NO', image_url ? image_url.substring(0, 50) + '...' : '');

    // First test connectivity
    const testResult = await testGoogleAppsScript();
    console.log('🧪 Google Apps Script test result:', testResult);

    // Call Google Apps Script (server-to-server, no CORS issues)
    const googleDocResult = await generateWordDocument(articleData, image_url);

    if (!googleDocResult.success) {
      throw new Error(`Google Apps Script error: ${googleDocResult.error}`);
    }

    console.log('✅ Word document created successfully:', googleDocResult.document_url);

    // Firestore persistence intentionally removed. If needed, handle persistence in a separate service.

    return sendResponse(res, 200, true, {
      documentUrl: googleDocResult.document_url,
      documentId: googleDocResult.document_id,
      documentTitle: googleDocResult.document_title,
      createdAt: googleDocResult.created_at
    });

  } catch (error) {
    console.error('❌ Word document generation error:', error);
    const errorResponse = handleApiError(error, 'word-document');
    return sendResponse(res, errorResponse.status, false, null, errorResponse.response.error);
  }
};

/**
 * Test Google Apps Script connectivity
 */
const testGoogleAppsScript = async () => {
  const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyMOJSGiBT8F--EL7F9hBd7eqlS5hTUWTHPQ0PgoUg0vKSN-IgSKa0OR4uLYc0-vVk2_w/exec';

  try {
    console.log('🧪 Testing Google Apps Script with POST ping');
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ping: true })
    });

    const raw = await response.text();
    console.log('🧪 POST ping status:', response.status);
    console.log('🧪 POST ping raw (first 200):', raw.substring(0, 200));

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      const contentType = response.headers.get('content-type') || '';
      const looksLikeHtml = /text\/html|<\s*!doctype|<\s*html/i.test(contentType) || /<\s*!doctype|<\s*html/i.test(raw);
      if (looksLikeHtml) {
        return {
          success: false,
          error: 'Apps Script returned HTML on POST ping (likely misconfigured deployment or wrong URL). Ensure Web App is deployed as "Execute as Me" and "Anyone" access, and that doPost returns JSON.'
        };
      }
      // Non-HTML non-JSON response
      return { success: false, error: 'Apps Script returned non-JSON response to POST ping.' };
    }

    return { success: true, response: parsed };
  } catch (error) {
    console.error('🧪 POST ping failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate Word document by calling Google Apps Script
 * Server-to-server request bypasses CORS restrictions
 */
const generateWordDocument = async (articleData, image_url = null) => {
  const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyPjgQs3ZYJNMuFFcASQn-6jElU1VVHrA-OfuW-qF7jB6wnk-QhCb8SMgyaYg0daza6Jw/exec';

  try {
    console.log('🌐 Making server-to-server request to Google Apps Script');
    console.log('📤 Sending image_url:', image_url ? image_url.substring(0, 50) + '...' : 'EMPTY');

    const requestPayload = {
      data: articleData,
      image_url: image_url || '' // Use the actual image URL from request
    };

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    console.log('📡 Google Apps Script response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    // Get response text first to debug
    const responseText = await response.text();
    console.log('📡 Raw response (first 500 chars):', responseText.substring(0, 500));

    if (!response.ok) {
      throw new Error(`Google Apps Script returned ${response.status}: ${responseText}`);
    }

    // Try to parse as JSON
    let result;
    try {
      // Some Apps Script deployments incorrectly return text/html content-type.
      // We still attempt to parse JSON first regardless of content-type.
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse response as JSON:', parseError);
      console.error('❌ FULL RAW RESPONSE:');
      console.error(responseText);
      console.error('❌ Response length:', responseText.length);
      console.error('❌ Content-Type header:', response.headers.get('content-type'));
      console.error('❌ All response headers:', Object.fromEntries(response.headers.entries()));
      
      // Detect common HTML responses that indicate misconfigured Apps Script permissions/auth
      const contentType = response.headers.get('content-type') || '';
      const looksLikeHtml = /text\/html|<\s*!doctype|<\s*html/i.test(contentType) || /<\s*!doctype|<\s*html/i.test(responseText);
      if (looksLikeHtml) {
        throw new Error(
          'Google Apps Script returned HTML instead of JSON. This often means the Web App is misconfigured (e.g., not deployed as \'Anyone\', or using the wrong deployment URL). Please redeploy the Apps Script Web App with "Execute as Me" and "Anyone" access, and ensure doPost returns JSON.'
        );
      }
      throw new Error(`Invalid JSON response from Google Apps Script: ${parseError.message}`);
    }
    console.log('📄 Google Apps Script result:', {
      success: result.success,
      hasUrl: !!result.document_url,
      title: result.document_title
    });

    return result;

  } catch (error) {
    console.error('❌ Google Apps Script request failed:', error);
    throw new Error(`Failed to generate Word document: ${error.message}`);
  }
};

module.exports = handler;