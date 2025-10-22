// Load environment variables for local development
require('dotenv').config();

const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const cors = require('cors')({ origin: true });

// Set global options for all functions
setGlobalOptions({
  maxInstances: 10,
  region: 'us-central1',
  timeoutSeconds: 540, // allow up to 9 minutes for long generations
  memory: '2GiB'       // bump memory for larger model responses
});

// Firebase Admin initialization removed; this service no longer uses Firestore directly.

// Note: route modules are lazy-required inside the handler branches to avoid slow cold starts


// Main API function that handles all /api/* routes
exports.api = onRequest({ 
  cors: true
}, async (req, res) => {
  // Handle CORS
  return cors(req, res, async () => {
    try {
      // Normalize path so it works whether called via Hosting rewrite (/api/*)
      // or directly on the function URL (/*)
      const rawPath = req.path || '/';
      const path = rawPath.replace(/^\/api\b/, '') || '/';

      // Route to appropriate handler
      if (path.startsWith('/gemini/')) {
        const geminiRoutes = require('./api/gemini');
        return await geminiRoutes.handler(req, res);
      }

      if (path.startsWith('/health')) {
        const healthRoutes = require('./api/health');
        return await healthRoutes.handler(req, res);
      }

      if (path.startsWith('/elevenlabs/')) {
        const elevenLabsRoutes = require('./api/elevenlabs');
        return await elevenLabsRoutes.handler(req, res);
      }

      if (path.startsWith('/heygen/')) {
        const heygenRoutes = require('./api/heygen');
        return await heygenRoutes.handler(req, res);
      }

      if (path.startsWith('/wordpress/')) {
        const wordpressRoutes = require('./api/wordpress');
        return await wordpressRoutes.handler(req, res);
      }

      if (path.startsWith('/word-document')) {
        const wordDocumentRoutes = require('./api/word-document');
        return await wordDocumentRoutes(req, res);
      }

      if (path === '/image' || path.startsWith('/image/')) {
        const imageRoutes = require('./api/gemini-image-generator');
        return await imageRoutes.handler(req, res);
      }

      if (path.startsWith('/stripe/')) {
        const stripeRoutes = require('./api/stripe');
        return await stripeRoutes.handler(req, res);
      }

      if (path.startsWith('/shopify/')) {
        const shopifyRoutes = require('./api/shopify');
        return await shopifyRoutes.handler(req, res);
      }

      if (path.startsWith('/webflow/')) {
        const webflowRoutes = require('./api/webflow');
        return await webflowRoutes.handler(req, res);
      }

      if (path === '/contact' || path.startsWith('/contact/')) {
        const contactRoutes = require('./api/contact');
        return await contactRoutes.handler(req, res);
      }

      // Default 404 for unknown routes
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${path} not found`
        }
      });
    } catch (error) {
      console.error('API Error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  });
});

// Separate webhook handler for Stripe that preserves raw body
exports.stripeWebhook = onRequest({
  cors: true,
  invoker: 'public'
}, async (req, res) => {
  // Only handle POST requests to webhook endpoint
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CRITICAL: Import stripe here to avoid parsing issues
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    // Get the signature from headers
    const sig = req.headers['stripe-signature'];
    
    console.log('=== WEBHOOK DEBUG INFO ===');
    console.log('Method:', req.method);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Signature present:', !!sig);
    console.log('Webhook secret configured:', !!endpointSecret);
    console.log('Body type:', typeof req.body);
    console.log('Body constructor:', req.body?.constructor?.name);
    console.log('Raw body available:', !!req.rawBody);
    console.log('Raw body type:', typeof req.rawBody);
    
    // CRITICAL: Use req.rawBody (Firebase Functions v2) or req.body (if it's still raw)
    let payload;
    if (req.rawBody) {
      payload = req.rawBody;
      console.log('Using req.rawBody, length:', payload.length);
    } else if (Buffer.isBuffer(req.body)) {
      payload = req.body;
      console.log('Using req.body as buffer, length:', payload.length);
    } else if (typeof req.body === 'string') {
      payload = Buffer.from(req.body, 'utf8');
      console.log('Converting string body to buffer, length:', payload.length);
    } else {
      // Last resort: if body is object, stringify it (not ideal but prevents crash)
      payload = Buffer.from(JSON.stringify(req.body), 'utf8');
      console.log('Converting object body to buffer (not ideal), length:', payload.length);
    }
    
    if (payload) {
      console.log('Payload first 100 chars:', payload.toString().substring(0, 100));
    }
    console.log('========================');
    
    if (!endpointSecret) {
      console.warn('WARNING: STRIPE_WEBHOOK_SECRET not configured - processing without verification');
      // Parse the body as JSON if no signature verification
      if (typeof req.body === 'object') {
        event = req.body;
      } else {
        event = JSON.parse(payload.toString());
      }
    } else {
      // Construct the event - this is where the signature verification happens
      event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
      console.log('✅ Webhook signature verified successfully');
    }
    
  } catch (err) {
    console.error(`❌ Webhook signature verification failed:`, err.message);
    console.error('Error type:', err.constructor.name);
    console.error('Error details:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Process the event
  console.log('Processing webhook event:', event.type, 'ID:', event.id);
  
  try {
    // Handle the event (import your existing handler)
    const { processWebhookEvent } = require('./api/stripe');
    await processWebhookEvent(event);
    
    console.log('✅ Webhook processed successfully');
    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error processing webhook event:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});