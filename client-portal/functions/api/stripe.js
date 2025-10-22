const Stripe = require('stripe');
const { FieldValue } = require('firebase-admin/firestore');
const { getFirestore, getAuth } = require('../lib/firebase-admin');
const { sendTransactionConfirmationEmail, sendPlanChangeConfirmationEmail, sendSubscriptionCancellationEmail, sendSubscriptionUpdateEmail } = require('./email-service');

// Initialize Stripe with environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Get Firestore instance using centralized initialization
const db = getFirestore();
//price_1SDWXcDhWrtLIdwaZFKqbUbh
//price_1SDW8bDhWrtLIdwayov8Q60y
// Price IDs - Replace these with your actual Stripe price IDs
const PRICE_IDS = {
  // demo price_1SEwNTDwNpDs4AJujEPnZPBF
  // real price_1SDW8bDhWrtLIdwayov8Q60y
  starter: {
    monthly: 'price_1SDW8bDhWrtLIdwayov8Q60y', // Replace with your Starter monthly price ID
    yearly: 'price_1S4RjIRdSGXvq7e6EljgRLX7'   // Replace with your Starter yearly price ID
  },
  // demo price_1SFbUGDwNpDs4AJurCDhlyxn
  // real price_1SDW95DhWrtLIdwa4INi1ybJ
  growth: {
    monthly: 'price_1SDW95DhWrtLIdwa4INi1ybJ', // Replace with your Growth monthly price ID
    yearly: 'price_1S4RjIRdSGXvq7e6EljgRLX7'   // Replace with your Growth yearly price ID
  },
  scale: {
    monthly: 'price_1SDW9UDhWrtLIdway5QjiiVY', // Replace with your Scale monthly price ID
    yearly: 'price_1S4RjIRdSGXvq7e6EljgRLX7'   // Replace with your Scale yearly price ID
  },
  agency_custom: {
    monthly: 'price_1SFbUGDwNpDs4AJurCDhlyxn', // Replace with your Agency Custom monthly price ID
    yearly: 'price_1S4RjIRdSGXvq7e6EljgRLX7'   // Replace with your Agency Custom yearly price ID
  }
};

// Credit allocation based on tier
const getCreditsForTier = (tier) => {
  switch (tier.toLowerCase()) {
    case 'starter':
      return 4; // 4 credits per month
    case 'growth':
      return 10; // 10 credits per month
    case 'scale':
      return 30; // 30 credits per month
    case 'agency_custom':
      return 100; // Enterprise level
    default:
      return 0;
  }
};

// Get plan pricing for proration calculations
const getPlanPricing = (tier, billingCycle = 'monthly') => {
  const pricing = {
    starter: { monthly: 9700, yearly: 116400 }, // $97/mo, $1164/yr in cents
    growth: { monthly: 19700, yearly: 356400 }, // $197/mo, $3564/yr in cents
    scale: { monthly: 49700, yearly: 1196400 }, // $497/mo, $11964/yr in cents
  };

  return pricing[tier.toLowerCase()]?.[billingCycle.toLowerCase()] || 0;
};

// Custom proration calculation (client-specific requirements)
const calculateCustomProration = (currentPlan, newPlan, currentPeriodStart) => {
  console.log('Calculating custom proration:', { currentPlan, newPlan, currentPeriodStart });

  // Get plan prices in cents
  const currentPrice = getPlanPricing(currentPlan.tier, currentPlan.billingCycle);
  const newPrice = getPlanPricing(newPlan.tier, newPlan.billingCycle);

  if (!currentPrice || !newPrice) {
    throw new Error('Invalid plan pricing configuration');
  }

  // Calculate days used in current billing period
  const now = new Date();
  const periodStart = new Date(currentPeriodStart);
  const daysUsed = Math.floor((now - periodStart) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, 30 - daysUsed); // Based on 30-day months

  // Determine if this is an upgrade or downgrade
  const isUpgrade = newPrice > currentPrice;

  console.log('Proration calculation details:', {
    currentPrice: currentPrice / 100,
    newPrice: newPrice / 100,
    daysUsed,
    daysRemaining,
    isUpgrade
  });

  if (!isUpgrade) {
    // DOWNGRADES: No proration, charge full new plan price
    return {
      finalAmount: newPrice,
      prorationCredit: 0,
      isUpgrade: false,
      daysUsed,
      daysRemaining,
      breakdown: {
        currentPlanPrice: currentPrice,
        newPlanPrice: newPrice,
        message: 'Downgrade - No proration credit applied'
      }
    };
  }

  // UPGRADES: Apply custom proration credit
  const prorationCredit = Math.round((currentPrice * daysRemaining) / 30);
  const finalAmount = Math.max(0, newPrice - prorationCredit);

  return {
    finalAmount,
    prorationCredit,
    isUpgrade: true,
    daysUsed,
    daysRemaining,
    breakdown: {
      currentPlanPrice: currentPrice,
      newPlanPrice: newPrice,
      prorationCredit,
      calculation: `$${(currentPrice / 100).toFixed(2)} × ${daysRemaining}/30 days = $${(prorationCredit / 100).toFixed(2)} credit`,
      message: `Upgrade with ${daysRemaining} days remaining in current period`
    }
  };
};

// Helper function to find price ID for a given tier and billing cycle
const findPriceIdInConfig = (tier, billingCycle) => {
  if (!tier || !billingCycle) return null;
  return PRICE_IDS[tier.toLowerCase()]?.[billingCycle.toLowerCase()] || null;
};

// Helper function to find plan details by price ID
const findPlanByPriceId = (priceId) => {
  for (const [tier, cycles] of Object.entries(PRICE_IDS)) {
    for (const [billingCycle, id] of Object.entries(cycles)) {
      if (id === priceId) {
        return { tier, billingCycle };
      }
    }
  }
  return null;
};

// Payment method management routes
const handlePaymentMethodRoutes = async (req, res) => {
  const pathParts = req.path.replace('/stripe/payment-method/', '').split('/');
  const userId = pathParts[0];
  const action = pathParts[1]; // e.g., 'portal', 'list', 'default'

  console.log(`Payment method route: ${req.method} ${req.path}`);
  console.log(`User ID: ${userId}, Action: ${action}`);

  // Validate user ID
  if (!userId || userId === 'undefined' || userId === 'null') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_USER_ID',
        message: 'Valid user ID is required'
      }
    });
  }

  try {
    // GET /stripe/payment-method/{userId} - Get payment methods
    if (req.method === 'GET' && !action) {
      console.log('Getting payment methods for user:', userId);

      const paymentMethods = await getUserPaymentMethods(userId);

      return res.json({
        success: true,
        paymentMethods
      });
    }

    // POST /stripe/payment-method/{userId}/portal - Create Customer Portal session
    if (req.method === 'POST' && action === 'portal') {
      console.log('Creating Customer Portal session for user:', userId);

      const { returnUrl } = req.body || {};

      try {
        const portalSession = await createCustomerPortalSession(userId, returnUrl);

        return res.json({
          success: true,
          portalUrl: portalSession.url,
          sessionId: portalSession.id
        });

      } catch (portalError) {
        console.error('Customer Portal creation failed:', portalError);

        if (portalError.message.includes('not found')) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'CUSTOMER_NOT_FOUND',
              message: 'No Stripe customer found for this user'
            }
          });
        }

        return res.status(500).json({
          success: false,
          error: {
            code: 'PORTAL_CREATION_FAILED',
            message: portalError.message || 'Failed to create Customer Portal session'
          }
        });
      }
    }

    // GET /stripe/payment-method/{userId}/default - Get default payment method
    if (req.method === 'GET' && action === 'default') {
      console.log('Getting default payment method for user:', userId);

      try {
        const defaultPaymentMethod = await getDefaultPaymentMethod(userId);

        return res.json({
          success: true,
          defaultPaymentMethod
        });

      } catch (error) {
        console.error('Error getting default payment method:', error);

        return res.status(500).json({
          success: false,
          error: {
            code: 'PAYMENT_METHOD_ERROR',
            message: error.message || 'Failed to retrieve default payment method'
          }
        });
      }
    }

    // Handle unknown actions or methods
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: `Method ${req.method} not allowed for action: ${action || 'none'}`
      }
    });

  } catch (error) {
    console.error('Error handling payment method route:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
};

// Get user's payment methods using modern Stripe API
const getUserPaymentMethods = async (userId) => {
  console.log(`Getting payment methods for user: ${userId}`);

  try {
    // Get user subscription to find Stripe customer ID
    const userData = await getUserSubscription(userId);

    if (!userData || !userData.stripeCustomerId) {
      throw new Error('No Stripe customer found for this user');
    }

    // Get customer from Stripe to get default payment method
    const customer = await stripe.customers.retrieve(userData.stripeCustomerId);

    // List payment methods using modern API
    const paymentMethods = await stripe.paymentMethods.list({
      customer: userData.stripeCustomerId,
      type: 'card', // Focus on cards for now
    });

    // Format payment methods for frontend
    const formattedPaymentMethods = paymentMethods.data.map(pm => ({
      id: pm.id,
      type: pm.type,
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
        funding: pm.card.funding
      } : null,
      isDefault: pm.id === customer.invoice_settings?.default_payment_method,
      created: new Date(pm.created * 1000).toISOString()
    }));

    console.log(`Found ${formattedPaymentMethods.length} payment methods for user ${userId}`);

    return {
      paymentMethods: formattedPaymentMethods,
      defaultPaymentMethodId: customer.invoice_settings?.default_payment_method,
      customerId: userData.stripeCustomerId
    };

  } catch (error) {
    console.error('Error getting user payment methods:', error);
    throw error;
  }
};

// Create Customer Portal session for secure payment method management
const createCustomerPortalSession = async (userId, returnUrl) => {
  console.log(`Creating Customer Portal session for user: ${userId}`);

  try {
    // Get user subscription to find Stripe customer ID
    const userData = await getUserSubscription(userId);

    if (!userData || !userData.stripeCustomerId) {
      throw new Error('No Stripe customer found for this user');
    }

    // Default return URL if not provided
    const defaultReturnUrl = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL}/dashboard/subscription`
      : 'https://your-project.web.app/dashboard/subscription';

    // Create Customer Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: userData.stripeCustomerId,
      return_url: returnUrl || defaultReturnUrl,
      // Configure what features are available in the portal
      flow_data: {
        type: 'payment_method_update',
        after_completion: {
          type: 'redirect',
          redirect: {
            return_url: returnUrl || defaultReturnUrl
          }
        }
      }
    });

    console.log('✅ Customer Portal session created:', portalSession.id);

    return portalSession;

  } catch (error) {
    console.error('❌ Error creating Customer Portal session:', error);
    throw error;
  }
};

// Get default payment method for a user
const getDefaultPaymentMethod = async (userId) => {
  console.log(`Getting default payment method for user: ${userId}`);

  try {
    // Get user subscription to find Stripe customer ID
    const userData = await getUserSubscription(userId);

    if (!userData || !userData.stripeCustomerId) {
      throw new Error('No Stripe customer found for this user');
    }

    // Get customer from Stripe
    const customer = await stripe.customers.retrieve(userData.stripeCustomerId);

    if (!customer.invoice_settings?.default_payment_method) {
      return {
        hasDefaultPaymentMethod: false,
        message: 'No default payment method set'
      };
    }

    // Get the default payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(
      customer.invoice_settings.default_payment_method
    );

    const formattedPaymentMethod = {
      id: paymentMethod.id,
      type: paymentMethod.type,
      card: paymentMethod.card ? {
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        expMonth: paymentMethod.card.exp_month,
        expYear: paymentMethod.card.exp_year,
        funding: paymentMethod.card.funding
      } : null,
      created: new Date(paymentMethod.created * 1000).toISOString()
    };

    console.log(`Default payment method for user ${userId}: ${paymentMethod.card?.brand} ****${paymentMethod.card?.last4}`);

    return {
      hasDefaultPaymentMethod: true,
      paymentMethod: formattedPaymentMethod,
      customerId: userData.stripeCustomerId
    };

  } catch (error) {
    console.error('Error getting default payment method:', error);
    throw error;
  }
};

// Billing history management routes
const handleBillingRoutes = async (req, res) => {
  const pathParts = req.path.replace('/stripe/billing/', '').split('/');
  const userId = pathParts[0];
  const action = pathParts[1]; // e.g., 'invoices', 'upcoming'

  console.log(`Billing route: ${req.method} ${req.path}`);
  console.log(`User ID: ${userId}, Action: ${action}`);

  // Validate user ID
  if (!userId || userId === 'undefined' || userId === 'null') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_USER_ID',
        message: 'Valid user ID is required'
      }
    });
  }

  try {
    // GET /stripe/billing/{userId}/invoices - Get billing history
    if (req.method === 'GET' && action === 'invoices') {
      console.log('Getting billing history for user:', userId);

      const { limit, startingAfter, status } = req.query;

      const billingHistory = await getUserBillingHistory(userId, {
        limit: limit ? parseInt(limit) : 10,
        startingAfter,
        status
      });

      return res.json({
        success: true,
        billingHistory
      });
    }

    // GET /stripe/billing/{userId}/upcoming - Get upcoming invoice
    if (req.method === 'GET' && action === 'upcoming') {
      console.log('Getting upcoming invoice for user:', userId);

      try {
        const upcomingInvoice = await getUpcomingInvoice(userId);

        return res.json({
          success: true,
          upcomingInvoice
        });

      } catch (upcomingError) {
        console.error('Error getting upcoming invoice:', upcomingError);

        if (upcomingError.message.includes('not found')) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NO_UPCOMING_INVOICE',
              message: 'No upcoming invoice found for this customer'
            }
          });
        }

        return res.status(500).json({
          success: false,
          error: {
            code: 'UPCOMING_INVOICE_ERROR',
            message: upcomingError.message || 'Failed to retrieve upcoming invoice'
          }
        });
      }
    }

    // GET /stripe/billing/{userId}/invoice/{invoiceId} - Get specific invoice
    if (req.method === 'GET' && action === 'invoice') {
      const invoiceId = pathParts[2];

      if (!invoiceId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_INVOICE_ID',
            message: 'Invoice ID is required'
          }
        });
      }

      console.log('Getting specific invoice:', invoiceId, 'for user:', userId);

      try {
        const invoice = await getSpecificInvoice(userId, invoiceId);

        return res.json({
          success: true,
          invoice
        });

      } catch (invoiceError) {
        console.error('Error getting specific invoice:', invoiceError);

        if (invoiceError.message.includes('not found')) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'INVOICE_NOT_FOUND',
              message: 'Invoice not found or does not belong to this user'
            }
          });
        }

        return res.status(500).json({
          success: false,
          error: {
            code: 'INVOICE_ERROR',
            message: invoiceError.message || 'Failed to retrieve invoice'
          }
        });
      }
    }

    // GET /stripe/billing/{userId}/download/{invoiceId} - Download invoice PDF
    if (req.method === 'GET' && action === 'download') {
      const invoiceId = pathParts[2];

      if (!invoiceId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_INVOICE_ID',
            message: 'Invoice ID is required for download'
          }
        });
      }

      console.log('Getting invoice download URL:', invoiceId, 'for user:', userId);

      try {
        const downloadUrl = await getInvoiceDownloadUrl(userId, invoiceId);

        return res.json({
          success: true,
          downloadUrl,
          invoiceId
        });

      } catch (downloadError) {
        console.error('Error getting invoice download URL:', downloadError);

        return res.status(500).json({
          success: false,
          error: {
            code: 'DOWNLOAD_ERROR',
            message: downloadError.message || 'Failed to generate download URL'
          }
        });
      }
    }

    // Handle unknown actions or methods
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: `Method ${req.method} not allowed for action: ${action || 'none'}`
      }
    });

  } catch (error) {
    console.error('Error handling billing route:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
};

// Get COMPLETE billing history including ALL Stripe transaction types
const getUserBillingHistory = async (userId, options = {}) => {
  console.log(`🔍 [COMPLETE BILLING] Getting ALL transaction types for user: ${userId}`, options);

  const { limit = 10, startingAfter, status } = options;

  try {
    // Get user subscription to find Stripe customer ID
    const userData = await getUserSubscription(userId);
    console.log(`🔍 [COMPLETE BILLING] User data:`, {
      hasUserData: !!userData,
      stripeCustomerId: userData?.stripeCustomerId,
      tier: userData?.tier,
      billingCycle: userData?.billingCycle
    });

    if (!userData || !userData.stripeCustomerId) {
      console.log(`❌ [COMPLETE BILLING] No Stripe customer found for user: ${userId}`);
      throw new Error('No Stripe customer found for this user');
    }

    const customerId = userData.stripeCustomerId;
    console.log(`🔍 [COMPLETE BILLING] Fetching ALL transaction types from Stripe for customer: ${customerId}`);

    // Get comprehensive payment data from multiple Stripe endpoints
    const [invoices, checkoutSessions, paymentIntents, charges] = await Promise.all([
      // 1. Get subscription invoices
      stripe.invoices.list({
        customer: userData.stripeCustomerId,
        limit: Math.min(limit * 2, 100), // Get more to account for filtering
        expand: ['data.payment_intent', 'data.charge'],
        ...(status && { status })
      }),

      // 2. Get plan change checkout sessions
      stripe.checkout.sessions.list({
        customer: userData.stripeCustomerId,
        limit: Math.min(limit * 2, 100),
        expand: ['data.payment_intent']
      }),

      // 3. Get all payment intents for this customer (to catch any missed payments)
      stripe.paymentIntents.list({
        customer: userData.stripeCustomerId,
        limit: Math.min(limit * 2, 100)
      }),

      // 4. Get all charges for this customer (alternative payment tracking)
      stripe.charges.list({
        customer: userData.stripeCustomerId,
        limit: Math.min(limit * 2, 100)
      })
    ]);

    console.log(`🔍 [BILLING DEBUG] Raw Stripe data:`, {
      invoicesCount: invoices.data.length,
      checkoutSessionsCount: checkoutSessions.data.length,
      paymentIntentsCount: paymentIntents.data.length,
      chargesCount: charges.data.length,
      invoiceIds: invoices.data.map(i => i.id),
      sessionIds: checkoutSessions.data.map(s => s.id),
      paymentIntentIds: paymentIntents.data.map(pi => pi.id),
      chargeIds: charges.data.map(c => c.id),
      sessionMetadata: checkoutSessions.data.map(s => ({ id: s.id, metadata: s.metadata, payment_status: s.payment_status }))
    });

    // Transform subscription invoices
    const transformedInvoices = invoices.data.map(invoice => {
      let paymentMethod = null;
      if (invoice.payment_intent?.charges?.data?.[0]?.payment_method_details) {
        const pmDetails = invoice.payment_intent.charges.data[0].payment_method_details;
        if (pmDetails.card) {
          paymentMethod = {
            type: 'card',
            brand: pmDetails.card.brand,
            last4: pmDetails.card.last4,
            expMonth: pmDetails.card.exp_month,
            expYear: pmDetails.card.exp_year
          };
        }
      }

      return {
        id: invoice.id,
        type: 'subscription',
        number: invoice.number,
        amount: invoice.amount_paid || invoice.total,
        amountDue: invoice.amount_due,
        currency: invoice.currency,
        status: invoice.status,
        invoiceDate: new Date(invoice.created * 1000).toISOString(),
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
        paidAt: invoice.status_transitions?.paid_at ?
          new Date(invoice.status_transitions.paid_at * 1000).toISOString() : null,
        description: invoice.description || `${userData.tier || 'Subscription'} - ${userData.billingCycle || 'monthly'}`,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
        paymentMethod,
        subtotal: invoice.subtotal,
        tax: invoice.tax || 0,
        discount: invoice.total_discount_amounts?.reduce((sum, discount) => sum + discount.amount, 0) || 0,
        periodStart: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
        periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
        lineItems: invoice.lines?.data?.map(line => ({
          description: line.description,
          amount: line.amount,
          quantity: line.quantity,
          period: {
            start: new Date(line.period.start * 1000).toISOString(),
            end: new Date(line.period.end * 1000).toISOString()
          }
        })) || []
      };
    });

    // Transform plan change checkout sessions
    console.log(`🔍 [BILLING DEBUG] All checkout sessions analysis:`,
      checkoutSessions.data.map(session => ({
        id: session.id,
        payment_status: session.payment_status,
        metadata: session.metadata,
        amount_total: session.amount_total,
        created: new Date(session.created * 1000).toISOString(),
        mode: session.mode
      }))
    );

    // Transform ALL successful checkout sessions (not just plan changes)
    const transformedCheckoutSessions = checkoutSessions.data
      .filter(session => session.payment_status === 'paid' && session.amount_total > 0)
      .map(session => {
        let paymentMethod = null;
        if (session.payment_intent?.charges?.data?.[0]?.payment_method_details) {
          const pmDetails = session.payment_intent.charges.data[0].payment_method_details;
          if (pmDetails.card) {
            paymentMethod = {
              type: 'card',
              brand: pmDetails.card.brand,
              last4: pmDetails.card.last4,
              expMonth: pmDetails.card.exp_month,
              expYear: pmDetails.card.exp_year
            };
          }
        }

        // Determine transaction type and details based on metadata and mode
        const isPlanChange = session.metadata?.planChangeType === 'subscription_update';
        const isSubscriptionCreation = session.mode === 'subscription';
        const isOneTimePayment = session.mode === 'payment';

        let transactionType, description, additionalDetails = null;

        if (isPlanChange) {
          const fromTier = session.metadata?.currentTier || 'Unknown';
          const toTier = session.metadata?.newTier || 'Unknown';
          const prorationAmount = parseInt(session.metadata?.prorationAmount || '0');
          const isUpgrade = session.metadata?.isUpgrade === 'true';

          transactionType = 'plan_change';
          description = `Plan Change: ${fromTier} → ${toTier.charAt(0).toUpperCase() + toTier.slice(1)}${isUpgrade && prorationAmount > 0 ? ` (with $${(prorationAmount / 100).toFixed(2)} proration credit)` : ''}`;
          additionalDetails = {
            planChangeDetails: {
              fromTier,
              toTier,
              prorationCredit: prorationAmount,
              isUpgrade,
              originalAmount: session.metadata?.newTier ? getPlanPricing(session.metadata.newTier, session.metadata?.newBillingCycle || 'monthly') : null
            }
          };
        } else if (isSubscriptionCreation) {
          transactionType = 'subscription_creation';
          description = `Subscription Created - ${session.metadata?.tier || 'Plan'} ${session.metadata?.billingCycle || 'monthly'}`;
        } else if (isOneTimePayment) {
          transactionType = 'one_time_payment';
          description = session.metadata?.description || `One-time Payment - ${session.customer_details?.name || 'Customer'}`;
        } else {
          transactionType = 'checkout_payment';
          description = `Payment via Checkout - ${session.metadata?.description || 'Purchase'}`;
        }

        return {
          id: session.id,
          type: transactionType,
          number: `${transactionType === 'plan_change' ? 'PC' : transactionType === 'subscription_creation' ? 'SUB' : transactionType === 'one_time_payment' ? 'OTP' : 'CHK'}-${session.id.slice(-8).toUpperCase()}`,
          amount: session.amount_total,
          currency: session.currency,
          status: 'paid',
          invoiceDate: new Date(session.created * 1000).toISOString(),
          paidAt: new Date(session.created * 1000).toISOString(),
          description,
          hostedInvoiceUrl: null, // Checkout sessions don't have hosted invoice URLs
          invoicePdf: null,
          paymentMethod,
          metadata: session.metadata,
          ...additionalDetails
        };
      });

    // Transform standalone payment intents (not associated with invoices or checkout sessions)
    const existingPaymentIntentIds = new Set([
      ...transformedInvoices.map(inv => inv.paymentMethod?.paymentIntentId).filter(Boolean),
      ...transformedCheckoutSessions.map(cs => cs.paymentMethod?.paymentIntentId).filter(Boolean)
    ]);

    const transformedPaymentIntents = paymentIntents.data
      .filter(pi =>
        pi.status === 'succeeded' &&
        !existingPaymentIntentIds.has(pi.id) &&
        pi.amount > 0
      )
      .map(paymentIntent => {
        let paymentMethod = null;
        if (paymentIntent.charges?.data?.[0]?.payment_method_details) {
          const pmDetails = paymentIntent.charges.data[0].payment_method_details;
          if (pmDetails.card) {
            paymentMethod = {
              type: 'card',
              brand: pmDetails.card.brand,
              last4: pmDetails.card.last4,
              expMonth: pmDetails.card.exp_month,
              expYear: pmDetails.card.exp_year
            };
          }
        }

        return {
          id: paymentIntent.id,
          type: 'payment_intent',
          number: `PI-${paymentIntent.id.slice(-8).toUpperCase()}`,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: 'paid',
          invoiceDate: new Date(paymentIntent.created * 1000).toISOString(),
          paidAt: new Date(paymentIntent.created * 1000).toISOString(),
          description: paymentIntent.description || `Payment - ${paymentIntent.metadata?.description || 'One-time payment'}`,
          hostedInvoiceUrl: null,
          invoicePdf: null,
          paymentMethod,
          metadata: paymentIntent.metadata
        };
      });

    // Transform standalone charges (not associated with other transactions)
    const existingChargeIds = new Set([
      ...transformedInvoices.map(inv => inv.paymentMethod?.chargeId).filter(Boolean),
      ...transformedCheckoutSessions.map(cs => cs.paymentMethod?.chargeId).filter(Boolean),
      ...transformedPaymentIntents.map(pi => pi.paymentMethod?.chargeId).filter(Boolean)
    ]);

    const transformedCharges = charges.data
      .filter(charge =>
        charge.status === 'succeeded' &&
        !existingChargeIds.has(charge.id) &&
        charge.amount > 0 &&
        !charge.invoice // Don't duplicate invoice charges
      )
      .map(charge => {
        let paymentMethod = null;
        if (charge.payment_method_details?.card) {
          const pmDetails = charge.payment_method_details.card;
          paymentMethod = {
            type: 'card',
            brand: pmDetails.brand,
            last4: pmDetails.last4,
            expMonth: pmDetails.exp_month,
            expYear: pmDetails.exp_year
          };
        }

        return {
          id: charge.id,
          type: 'charge',
          number: `CH-${charge.id.slice(-8).toUpperCase()}`,
          amount: charge.amount,
          currency: charge.currency,
          status: 'paid',
          invoiceDate: new Date(charge.created * 1000).toISOString(),
          paidAt: new Date(charge.created * 1000).toISOString(),
          description: charge.description || `Charge - ${charge.metadata?.description || 'Payment'}`,
          hostedInvoiceUrl: null,
          invoicePdf: null,
          paymentMethod,
          metadata: charge.metadata
        };
      });

    console.log(`🔍 [BILLING DEBUG] Additional transactions found:`, {
      paymentIntentsCount: transformedPaymentIntents.length,
      chargesCount: transformedCharges.length
    });

    // Combine and sort all transactions by date (newest first)
    const allTransactions = [
      ...transformedInvoices,
      ...transformedCheckoutSessions,
      ...transformedPaymentIntents,
      ...transformedCharges
    ].sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));

    // Apply pagination
    let paginatedTransactions = allTransactions;
    if (startingAfter) {
      const startIndex = allTransactions.findIndex(t => t.id === startingAfter);
      if (startIndex !== -1) {
        paginatedTransactions = allTransactions.slice(startIndex + 1);
      }
    }

    // Limit results
    const limitedTransactions = paginatedTransactions.slice(0, limit);
    const hasMore = paginatedTransactions.length > limit;

    console.log(`🔍 [BILLING DEBUG] Transformation results:`, {
      transformedInvoicesCount: transformedInvoices.length,
      transformedCheckoutSessionsCount: transformedCheckoutSessions.length,
      transformedPaymentIntentsCount: transformedPaymentIntents.length,
      transformedChargesCount: transformedCharges.length,
      allTransactionsCount: allTransactions.length,
      limitedTransactionsCount: limitedTransactions.length,
      planChangeFilter: checkoutSessions.data.filter(s => s.metadata?.planChangeType === 'subscription_update').length,
      paidPlanChanges: checkoutSessions.data.filter(s => s.metadata?.planChangeType === 'subscription_update' && s.payment_status === 'paid').length
    });

    console.log(`✅ [BILLING DEBUG] Retrieved ${limitedTransactions.length} transactions for user ${userId} (${transformedInvoices.length} invoices + ${transformedCheckoutSessions.length} checkout sessions + ${transformedPaymentIntents.length} payment intents + ${transformedCharges.length} charges)`);

    return {
      invoices: limitedTransactions,
      hasMore,
      totalCount: limitedTransactions.length,
      customerId: userData.stripeCustomerId
    };

  } catch (error) {
    console.error('Error getting comprehensive billing history:', error);
    throw error;
  }
};

// Get COMPLETE billing history including ALL Stripe transaction types (NEW VERSION)
const getUserBillingHistoryComplete = async (userId, options = {}) => {
  console.log(`🔍 [COMPLETE BILLING] Getting ALL transaction types for user: ${userId}`, options);

  const { limit = 10, startingAfter, status } = options;

  try {
    // Get user subscription to find Stripe customer ID
    const userData = await getUserSubscription(userId);
    console.log(`🔍 [COMPLETE BILLING] User data:`, {
      hasUserData: !!userData,
      stripeCustomerId: userData?.stripeCustomerId,
      tier: userData?.tier,
      billingCycle: userData?.billingCycle
    });

    if (!userData || !userData.stripeCustomerId) {
      console.log(`❌ [COMPLETE BILLING] No Stripe customer found for user: ${userId}`);
      throw new Error('No Stripe customer found for this user');
    }

    const customerId = userData.stripeCustomerId;
    console.log(`🔍 [COMPLETE BILLING] Fetching ALL transaction types from Stripe for customer: ${customerId}`);

    // Step 1: Get all charges first (needed for filtering other objects)
    const charges = await stripe.charges.list({
      customer: customerId,
      limit: 100
    });

    console.log(`🔍 [COMPLETE BILLING] Found ${charges.data.length} charges for customer`);

    // Step 2: Get ALL possible transaction types from Stripe
    const [
      invoices,
      checkoutSessions,
      paymentIntents,
      refunds
    ] = await Promise.all([
      // 1. Subscription invoices
      stripe.invoices.list({
        customer: customerId,
        limit: 100,
        expand: ['data.payment_intent', 'data.charge']
      }),

      // 2. Checkout sessions (ALL successful ones)
      stripe.checkout.sessions.list({
        customer: customerId,
        limit: 100,
        expand: ['data.payment_intent']
      }),

      // 3. Payment intents
      stripe.paymentIntents.list({
        customer: customerId,
        limit: 100
      }),

      // 4. Refunds (filtered for this customer's charges)
      stripe.refunds.list({
        limit: 100
      }).then(result => ({
        ...result,
        data: result.data.filter(refund =>
          charges.data.some(charge => charge.id === refund.charge)
        )
      }))
    ]);

    console.log(`🔍 [COMPLETE BILLING] Raw data counts:`, {
      invoices: invoices.data.length,
      checkoutSessions: checkoutSessions.data.length,
      paymentIntents: paymentIntents.data.length,
      charges: charges.data.length,
      refunds: refunds.data.length
    });

    // Step 3: Transform ALL transaction types into unified format
    const allTransactions = [];

    // Transform invoices
    invoices.data.forEach(invoice => {
      let paymentMethod = null;
      if (invoice.payment_intent?.charges?.data?.[0]?.payment_method_details) {
        const pmDetails = invoice.payment_intent.charges.data[0].payment_method_details;
        if (pmDetails.card) {
          paymentMethod = {
            type: 'card',
            brand: pmDetails.card.brand,
            last4: pmDetails.card.last4,
            expMonth: pmDetails.card.exp_month,
            expYear: pmDetails.card.exp_year
          };
        }
      }

      allTransactions.push({
        id: invoice.id,
        type: 'subscription_invoice',
        number: invoice.number,
        amount: invoice.amount_paid || invoice.total,
        currency: invoice.currency,
        status: invoice.status,
        invoiceDate: new Date(invoice.created * 1000).toISOString(),
        paidAt: invoice.status_transitions?.paid_at ?
          new Date(invoice.status_transitions.paid_at * 1000).toISOString() : null,
        description: invoice.description || `${userData.tier || 'Subscription'} - ${userData.billingCycle || 'monthly'}`,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
        paymentMethod,
        originalObject: 'invoice'
      });
    });

    // Transform checkout sessions
    checkoutSessions.data
      .filter(session => session.payment_status === 'paid' && session.amount_total > 0)
      .forEach(session => {
        let paymentMethod = null;
        if (session.payment_intent?.charges?.data?.[0]?.payment_method_details) {
          const pmDetails = session.payment_intent.charges.data[0].payment_method_details;
          if (pmDetails.card) {
            paymentMethod = {
              type: 'card',
              brand: pmDetails.card.brand,
              last4: pmDetails.card.last4,
              expMonth: pmDetails.card.exp_month,
              expYear: pmDetails.card.exp_year
            };
          }
        }

        // Determine transaction type
        const isPlanChange = session.metadata?.planChangeType === 'subscription_update';
        const isSubscriptionCreation = session.mode === 'subscription';
        const isOneTimePayment = session.mode === 'payment';

        let transactionType, description, additionalDetails = {};

        if (isPlanChange) {
          const fromTier = session.metadata?.currentTier || 'Unknown';
          const toTier = session.metadata?.newTier || 'Unknown';
          const prorationAmount = parseInt(session.metadata?.prorationAmount || '0');
          const isUpgrade = session.metadata?.isUpgrade === 'true';

          transactionType = 'plan_change';
          description = `Plan Change: ${fromTier} → ${toTier.charAt(0).toUpperCase() + toTier.slice(1)}${isUpgrade && prorationAmount > 0 ? ` (with $${(prorationAmount / 100).toFixed(2)} proration credit)` : ''}`;
          additionalDetails.planChangeDetails = {
            fromTier,
            toTier,
            prorationCredit: prorationAmount,
            isUpgrade
          };
        } else if (isSubscriptionCreation) {
          transactionType = 'subscription_creation';
          description = `New Subscription - ${session.metadata?.tier || 'Plan'} ${session.metadata?.billingCycle || 'monthly'}`;
        } else if (isOneTimePayment) {
          transactionType = 'one_time_payment';
          description = session.metadata?.description || `One-time Payment`;
        } else {
          transactionType = 'checkout_payment';
          description = `Checkout Payment - ${session.metadata?.description || 'Purchase'}`;
        }

        allTransactions.push({
          id: session.id,
          type: transactionType,
          number: `${transactionType === 'plan_change' ? 'PC' : transactionType === 'subscription_creation' ? 'SUB' : transactionType === 'one_time_payment' ? 'OTP' : 'CHK'}-${session.id.slice(-8).toUpperCase()}`,
          amount: session.amount_total,
          currency: session.currency,
          status: 'paid',
          invoiceDate: new Date(session.created * 1000).toISOString(),
          paidAt: new Date(session.created * 1000).toISOString(),
          description,
          hostedInvoiceUrl: null,
          invoicePdf: null,
          paymentMethod,
          metadata: session.metadata,
          originalObject: 'checkout_session',
          ...additionalDetails
        });
      });

    // Transform payment intents (exclude those already covered by invoices/checkout)
    const existingPaymentIntentIds = new Set([
      ...invoices.data.map(inv => inv.payment_intent?.id).filter(Boolean),
      ...checkoutSessions.data.map(cs => cs.payment_intent?.id).filter(Boolean)
    ]);

    paymentIntents.data
      .filter(pi =>
        pi.status === 'succeeded' &&
        !existingPaymentIntentIds.has(pi.id) &&
        pi.amount > 0
      )
      .forEach(paymentIntent => {
        let paymentMethod = null;
        if (paymentIntent.charges?.data?.[0]?.payment_method_details) {
          const pmDetails = paymentIntent.charges.data[0].payment_method_details;
          if (pmDetails.card) {
            paymentMethod = {
              type: 'card',
              brand: pmDetails.card.brand,
              last4: pmDetails.card.last4,
              expMonth: pmDetails.card.exp_month,
              expYear: pmDetails.card.exp_year
            };
          }
        }

        allTransactions.push({
          id: paymentIntent.id,
          type: 'payment_intent',
          number: `PI-${paymentIntent.id.slice(-8).toUpperCase()}`,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: 'paid',
          invoiceDate: new Date(paymentIntent.created * 1000).toISOString(),
          paidAt: new Date(paymentIntent.created * 1000).toISOString(),
          description: paymentIntent.description || `Direct Payment`,
          hostedInvoiceUrl: null,
          invoicePdf: null,
          paymentMethod,
          metadata: paymentIntent.metadata,
          originalObject: 'payment_intent'
        });
      });

    // Transform charges (exclude those already covered)
    const existingChargeIds = new Set([
      ...invoices.data.map(inv => inv.charge?.id || inv.payment_intent?.charges?.data?.[0]?.id).filter(Boolean),
      ...checkoutSessions.data.map(cs => cs.payment_intent?.charges?.data?.[0]?.id).filter(Boolean),
      ...paymentIntents.data.map(pi => pi.charges?.data?.[0]?.id).filter(Boolean)
    ]);

    charges.data
      .filter(charge =>
        charge.status === 'succeeded' &&
        !existingChargeIds.has(charge.id) &&
        charge.amount > 0 &&
        !charge.invoice // Don't duplicate invoice charges
      )
      .forEach(charge => {
        let paymentMethod = null;
        if (charge.payment_method_details?.card) {
          const pmDetails = charge.payment_method_details.card;
          paymentMethod = {
            type: 'card',
            brand: pmDetails.brand,
            last4: pmDetails.last4,
            expMonth: pmDetails.exp_month,
            expYear: pmDetails.exp_year
          };
        }

        allTransactions.push({
          id: charge.id,
          type: 'charge',
          number: `CH-${charge.id.slice(-8).toUpperCase()}`,
          amount: charge.amount,
          currency: charge.currency,
          status: 'paid',
          invoiceDate: new Date(charge.created * 1000).toISOString(),
          paidAt: new Date(charge.created * 1000).toISOString(),
          description: charge.description || `Direct Charge`,
          hostedInvoiceUrl: null,
          invoicePdf: null,
          paymentMethod,
          metadata: charge.metadata,
          originalObject: 'charge'
        });
      });

    // Transform refunds
    refunds.data.forEach(refund => {
      allTransactions.push({
        id: refund.id,
        type: 'refund',
        number: `REF-${refund.id.slice(-8).toUpperCase()}`,
        amount: -refund.amount, // Negative amount for refunds
        currency: refund.currency,
        status: refund.status,
        invoiceDate: new Date(refund.created * 1000).toISOString(),
        paidAt: new Date(refund.created * 1000).toISOString(),
        description: `Refund - ${refund.reason || 'Customer request'}`,
        hostedInvoiceUrl: null,
        invoicePdf: null,
        paymentMethod: null,
        metadata: refund.metadata,
        originalObject: 'refund',
        refundDetails: {
          chargeId: refund.charge,
          reason: refund.reason,
          status: refund.status
        }
      });
    });

    // Sort all transactions by date (newest first)
    allTransactions.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));

    // Apply pagination
    let paginatedTransactions = allTransactions;
    if (startingAfter) {
      const startIndex = allTransactions.findIndex(t => t.id === startingAfter);
      if (startIndex !== -1) {
        paginatedTransactions = allTransactions.slice(startIndex + 1);
      }
    }

    const limitedTransactions = paginatedTransactions.slice(0, limit);
    const hasMore = paginatedTransactions.length > limit;

    console.log(`🔍 [COMPLETE BILLING] Final results:`, {
      totalTransactionsFound: allTransactions.length,
      transactionTypes: [...new Set(allTransactions.map(t => t.type))],
      limitedTransactionsCount: limitedTransactions.length,
      hasMore
    });

    console.log(`✅ [COMPLETE BILLING] Retrieved ${limitedTransactions.length} of ${allTransactions.length} total transactions for user ${userId}`);

    return {
      invoices: limitedTransactions,
      hasMore,
      totalCount: limitedTransactions.length,
      customerId: userData.stripeCustomerId
    };

  } catch (error) {
    console.error('❌ [COMPLETE BILLING] Error getting complete billing history:', error);
    throw error;
  }
};

// Get upcoming invoice for a user
const getUpcomingInvoice = async (userId) => {
  console.log(`Getting upcoming invoice for user: ${userId}`);

  try {
    // Get user subscription to find Stripe customer ID
    const userData = await getUserSubscription(userId);

    if (!userData || !userData.stripeCustomerId) {
      throw new Error('No Stripe customer found for this user');
    }

    // Get upcoming invoice using modern API from Context7 docs
    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      customer: userData.stripeCustomerId,
      expand: ['lines.data.price.product']
    });

    const formattedUpcomingInvoice = {
      id: 'upcoming',
      amount: upcomingInvoice.amount_due,
      currency: upcomingInvoice.currency,
      description: `Upcoming ${userData.tier} subscription charge`,
      periodStart: new Date(upcomingInvoice.period_start * 1000).toISOString(),
      periodEnd: new Date(upcomingInvoice.period_end * 1000).toISOString(),
      nextPaymentAttempt: upcomingInvoice.next_payment_attempt ? new Date(upcomingInvoice.next_payment_attempt * 1000).toISOString() : null,
      lineItems: upcomingInvoice.lines?.data?.map(line => ({
        description: line.description,
        amount: line.amount,
        quantity: line.quantity,
        period: {
          start: new Date(line.period.start * 1000).toISOString(),
          end: new Date(line.period.end * 1000).toISOString()
        }
      })) || []
    };

    console.log(`Upcoming invoice for user ${userId}: ${upcomingInvoice.currency} ${upcomingInvoice.amount_due / 100}`);

    return formattedUpcomingInvoice;

  } catch (error) {
    console.error('Error getting upcoming invoice:', error);
    throw error;
  }
};

// Get a specific invoice by ID
const getSpecificInvoice = async (userId, invoiceId) => {
  console.log(`Getting specific invoice ${invoiceId} for user: ${userId}`);

  try {
    // Get user subscription to find Stripe customer ID
    const userData = await getUserSubscription(userId);

    if (!userData || !userData.stripeCustomerId) {
      throw new Error('No Stripe customer found for this user');
    }

    // Retrieve the specific invoice
    const invoice = await stripe.invoices.retrieve(invoiceId, {
      expand: ['payment_intent.payment_method', 'charge']
    });

    // Verify the invoice belongs to this customer
    if (invoice.customer !== userData.stripeCustomerId) {
      throw new Error('Invoice not found or does not belong to this user');
    }

    const formattedInvoice = {
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amount: invoice.amount_paid,
      amountDue: invoice.amount_due,
      subtotal: invoice.subtotal,
      tax: invoice.tax || 0,
      total: invoice.total,
      currency: invoice.currency,
      description: invoice.description || `${userData.tier} subscription`,
      invoiceDate: new Date(invoice.created * 1000).toISOString(),
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
      paidAt: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() : null,
      periodStart: new Date(invoice.period_start * 1000).toISOString(),
      periodEnd: new Date(invoice.period_end * 1000).toISOString(),
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      paymentMethod: invoice.payment_intent?.payment_method ? {
        id: invoice.payment_intent.payment_method.id,
        type: invoice.payment_intent.payment_method.type,
        card: invoice.payment_intent.payment_method.card ? {
          brand: invoice.payment_intent.payment_method.card.brand,
          last4: invoice.payment_intent.payment_method.card.last4,
          expMonth: invoice.payment_intent.payment_method.card.exp_month,
          expYear: invoice.payment_intent.payment_method.card.exp_year
        } : null
      } : null,
      lineItems: invoice.lines?.data?.map(line => ({
        id: line.id,
        description: line.description,
        amount: line.amount,
        quantity: line.quantity,
        unitAmount: line.price?.unit_amount || 0,
        period: {
          start: new Date(line.period.start * 1000).toISOString(),
          end: new Date(line.period.end * 1000).toISOString()
        }
      })) || []
    };

    console.log(`Retrieved invoice ${invoiceId} for user ${userId}`);

    return formattedInvoice;

  } catch (error) {
    console.error('Error getting specific invoice:', error);
    throw error;
  }
};

// Get invoice download URL
const getInvoiceDownloadUrl = async (userId, invoiceId) => {
  console.log(`Getting download URL for invoice ${invoiceId} for user: ${userId}`);

  try {
    // Get user subscription to find Stripe customer ID
    const userData = await getUserSubscription(userId);

    if (!userData || !userData.stripeCustomerId) {
      throw new Error('No Stripe customer found for this user');
    }

    // Retrieve the invoice to verify ownership and get PDF URL
    const invoice = await stripe.invoices.retrieve(invoiceId);

    // Verify the invoice belongs to this customer
    if (invoice.customer !== userData.stripeCustomerId) {
      throw new Error('Invoice not found or does not belong to this user');
    }

    if (!invoice.invoice_pdf) {
      throw new Error('PDF not available for this invoice');
    }

    console.log(`Generated download URL for invoice ${invoiceId}`);

    return {
      downloadUrl: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url,
      invoiceNumber: invoice.number,
      expiresAt: null // Stripe PDF URLs don't expire quickly
    };

  } catch (error) {
    console.error('Error getting invoice download URL:', error);
    throw error;
  }
};

// Enhanced helper function to get raw body for webhook signature verification
const getRawBody = (req) => {
  console.log('getRawBody: Analyzing request body...');
  console.log('getRawBody: req.rawBody available:', !!req.rawBody);
  console.log('getRawBody: req.body type:', typeof req.body);
  console.log('getRawBody: req.body constructor:', req.body?.constructor?.name);

  // Firebase Functions v2 provides rawBody for webhook endpoints - this is the preferred method
  if (req.rawBody) {
    console.log('getRawBody: Using req.rawBody (Firebase Functions v2)');
    return req.rawBody;
  }

  // If body is already a buffer, use it directly
  if (Buffer.isBuffer(req.body)) {
    console.log('getRawBody: Using req.body as Buffer');
    return req.body;
  }

  // If body is a string, convert to buffer with utf8 encoding
  if (typeof req.body === 'string') {
    console.log('getRawBody: Converting string body to Buffer');
    return Buffer.from(req.body, 'utf8');
  }

  // If body is parsed JSON, convert back to string then buffer
  // This is not ideal but prevents crashes
  if (typeof req.body === 'object' && req.body !== null) {
    console.log('getRawBody: Converting object body to Buffer (not ideal for signature verification)');
    const jsonString = JSON.stringify(req.body);
    return Buffer.from(jsonString, 'utf8');
  }

  // If we get here, we couldn't extract a raw body
  console.error('getRawBody: Unable to extract raw body from request');
  console.error('getRawBody: req.body:', req.body);
  throw new Error('Unable to get raw body for webhook verification - body format not supported');
};

const handler = async (req, res) => {
  const path = req.path?.replace('/stripe', '') || '';

  // Route to appropriate Stripe endpoint
  if (path === '/create-checkout-session' || path === '') {
    return handleCreateCheckoutSession(req, res);
  }

  if (path === '/webhook') {
    return handleWebhook(req, res);
  }

  if (path === '/verify-session') {
    return handleVerifySession(req, res);
  }

  if (path.startsWith('/subscription/')) {
    return handleSubscriptionRoutes(req, res);
  }

  if (path.startsWith('/payment-method/')) {
    return handlePaymentMethodRoutes(req, res);
  }

  if (path.startsWith('/billing/')) {
    return handleBillingRoutes(req, res);
  }

  // Default 404 for unknown Stripe routes
  return res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Stripe route ${path} not found`
    }
  });
};

const handleCreateCheckoutSession = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST requests allowed' }
    });
  }

  // Check if Stripe is configured
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not configured in environment variables');
    return res.status(500).json({
      success: false,
      error: {
        code: 'STRIPE_NOT_CONFIGURED',
        message: 'Payment processing is not configured. Please contact support.'
      }
    });
  }

  try {
    const { tier, billingCycle, userId } = req.body;

    if (!tier || !billingCycle) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'Missing required parameters: tier, billingCycle' }
      });
    }

    const priceId = PRICE_IDS[tier]?.[billingCycle];

    if (!priceId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'Invalid tier or billing cycle' }
      });
    }

    // Create checkout session
    const baseUrl = (process.env.FRONTEND_URL || 'https://your-project.firebaseapp.com').replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/dashboard?payment_success=true`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: {
        userId: userId || 'anonymous',
        tier,
        billingCycle
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_email: userId ? undefined : undefined, // Will be collected if no user
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });

  } catch (error) {
    console.error('Stripe checkout session error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STRIPE_ERROR',
        message: error.message || 'Failed to create checkout session'
      }
    });
  }
};

const handleVerifySession = async (req, res) => {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET requests allowed' }
    });
  }

  const sessionId = req.query.session_id;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_PARAMS', message: 'Missing session_id parameter' }
    });
  }

  try {
    console.log('Verifying session:', sessionId);
    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer']
    });
    console.log('Session retrieved:', session.id, 'Payment status:', session.payment_status);
    console.log('Session subscription:', session.subscription);
    console.log('Session metadata:', session.metadata);

    if (session.payment_status === 'paid') {
      // Extract subscription details
      let subscription = session.subscription;
      if (typeof subscription === 'string') {
        console.log('Subscription is ID, retrieving separately');
        subscription = await stripe.subscriptions.retrieve(subscription);
      }
      const tier = session.metadata?.tier || 'Unknown';
      const billingCycle = session.metadata?.billingCycle || 'monthly';

      // Calculate next billing date
      let nextBilling = 'Unknown';
      if (subscription && subscription.current_period_end) {
        nextBilling = new Date(subscription.current_period_end * 1000).toISOString().split('T')[0];
      }

      res.json({
        success: true,
        subscription: {
          status: subscription?.status || 'active',
          tier: tier.charAt(0).toUpperCase() + tier.slice(1),
          nextBilling,
          billingCycle,
          customerId: session.customer,
          subscriptionId: subscription?.id
        }
      });
    } else {
      res.json({
        success: false,
        error: { code: 'PAYMENT_INCOMPLETE', message: 'Payment not completed' }
      });
    }
  } catch (error) {
    console.error('Error verifying session:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'VERIFICATION_ERROR',
        message: 'Failed to verify payment session'
      }
    });
  }
};

// Enhanced subscription routes with proper validation and error handling
const handleSubscriptionRoutes = async (req, res) => {
  const pathParts = req.path.replace('/stripe/subscription/', '').split('/');
  const userId = pathParts[0];
  const action = pathParts[1]; // e.g., 'cancel', 'reactivate', 'change-plan'

  console.log(`Subscription route: ${req.method} ${req.path}`);
  console.log(`User ID: ${userId}, Action: ${action}`);

  // Validate user ID
  if (!userId || userId === 'undefined' || userId === 'null') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_USER_ID',
        message: 'Valid user ID is required'
      }
    });
  }

  try {
    // GET /stripe/subscription/{userId} - Get user subscription details
    if (req.method === 'GET' && !action) {
      console.log('Getting subscription for user:', userId);

      const subscription = await getUserSubscription(userId);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_NOT_FOUND',
            message: 'No subscription found for this user'
          }
        });
      }

      return res.json({
        success: true,
        subscription: {
          ...subscription,
          // Add computed fields for frontend
          hasActiveSubscription: subscription.status === 'active',
          canCancel: subscription.status === 'active' && !subscription.cancelAtPeriodEnd
        }
      });
    }

    // PUT /stripe/subscription/{userId} - Update subscription (general updates)
    if (req.method === 'PUT' && !action) {
      console.log('Updating subscription for user:', userId);

      const updateData = req.body;

      // Validate update data
      if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_UPDATE_DATA',
            message: 'Update data is required'
          }
        });
      }

      const success = await updateUserSubscription(userId, updateData);

      return res.json({
        success,
        message: success ? 'Subscription updated successfully' : 'Failed to update subscription'
      });
    }

    // POST /stripe/subscription/{userId}/cancel - Cancel subscription
    if (req.method === 'POST' && action === 'cancel') {
      console.log('Cancelling subscription for user:', userId);

      // Extract cancellation data from request body
      const { reason, feedback } = req.body || {};

      // Validate cancellation reason (optional but recommended)
      const validReasons = [
        'too_expensive',
        'missing_features',
        'switched_service',
        'temporary_pause',
        'other'
      ];

      if (reason && !validReasons.includes(reason)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CANCELLATION_REASON',
            message: `Invalid cancellation reason. Must be one of: ${validReasons.join(', ')}`
          }
        });
      }

      try {
        const result = await cancelUserSubscription(userId, { reason, feedback });

        return res.json({
          success: true,
          message: 'Subscription cancelled successfully',
          data: {
            accessUntil: result.accessUntil,
            subscriptionId: result.subscriptionId
          }
        });

      } catch (cancellationError) {
        console.error('Cancellation failed:', cancellationError);

        // Return specific error messages based on the error
        if (cancellationError.message.includes('not found')) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'SUBSCRIPTION_NOT_FOUND',
              message: 'No active subscription found to cancel'
            }
          });
        }

        if (cancellationError.message.includes('already cancelled')) {
          return res.status(409).json({
            success: false,
            error: {
              code: 'ALREADY_CANCELLED',
              message: 'Subscription is already cancelled or scheduled for cancellation'
            }
          });
        }

        return res.status(500).json({
          success: false,
          error: {
            code: 'CANCELLATION_FAILED',
            message: cancellationError.message || 'Failed to cancel subscription'
          }
        });
      }
    }



    // GET /stripe/subscription/{userId}/status - Get comprehensive subscription status
    if (req.method === 'GET' && action === 'status') {
      console.log('Getting comprehensive subscription status for user:', userId);

      try {
        const statusResult = await updateSubscriptionStatus(userId);

        // Get additional subscription details
        const subscription = await getUserSubscription(userId);

        return res.json({
          success: true,
          status: statusResult.status,
          statusDetails: statusResult.statusDetails,
          subscription: subscription ? {
            ...subscription,
            // Add computed fields for frontend
            hasActiveSubscription: ['active', 'trial'].includes(statusResult.status),
            canCancel: statusResult.status === 'active' && !subscription.cancelAtPeriodEnd,
            accessLevel: determineAccessLevel(statusResult.status, subscription)
          } : null,
          lastUpdated: statusResult.lastUpdated
        });

      } catch (statusError) {
        console.error('Error getting subscription status:', statusError);

        return res.status(500).json({
          success: false,
          error: {
            code: 'STATUS_ERROR',
            message: statusError.message || 'Failed to retrieve subscription status'
          }
        });
      }
    }

    // POST /stripe/subscription/{userId}/change-plan - Initiate plan change with custom checkout
    if (req.method === 'POST' && action === 'change-plan') {
      console.log('Initiating plan change for user:', userId);

      const { newTier, newBillingCycle } = req.body || {};

      // Validate required parameters
      if (!newTier || !newBillingCycle) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'newTier and newBillingCycle are required'
          }
        });
      }

      // Validate tier and billing cycle
      const validTiers = ['starter', 'growth', 'scale'];
      const validBillingCycles = ['monthly', 'yearly'];

      if (!validTiers.includes(newTier.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TIER',
            message: `Invalid tier. Must be one of: ${validTiers.join(', ')}`
          }
        });
      }

      if (!validBillingCycles.includes(newBillingCycle.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_BILLING_CYCLE',
            message: `Invalid billing cycle. Must be one of: ${validBillingCycles.join(', ')}`
          }
        });
      }

      try {
        // Get current subscription
        const currentSubscription = await getUserSubscription(userId);

        if (!currentSubscription) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'SUBSCRIPTION_NOT_FOUND',
              message: 'No subscription found for this user'
            }
          });
        }

        // Check if user is trying to change to the same plan
        const currentTier = currentSubscription.tier?.toLowerCase();
        const currentBillingCycle = currentSubscription.billingCycle?.toLowerCase();

        if (currentTier === newTier.toLowerCase() && currentBillingCycle === newBillingCycle.toLowerCase()) {
          return res.status(409).json({
            success: false,
            error: {
              code: 'SAME_PLAN',
              message: 'User is already on the requested plan'
            }
          });
        }

        // Calculate custom proration
        const prorationResult = calculateCustomProration(
          {
            tier: currentSubscription.tier,
            billingCycle: currentSubscription.billingCycle
          },
          {
            tier: newTier.toLowerCase(),
            billingCycle: newBillingCycle.toLowerCase()
          },
          currentSubscription.currentPeriodStart
        );

        // Create custom Stripe checkout session for the prorated amount
        const baseUrl = (process.env.FRONTEND_URL || 'https://your-project.firebaseapp.com').replace(/\/$/, '');

        const session = await stripe.checkout.sessions.create({
          mode: 'payment', // One-time payment for prorated amount
          payment_method_types: ['card'],
          customer: currentSubscription.stripeCustomerId, // Link to existing customer
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `Plan Change: ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} (${newBillingCycle})`,
                  description: prorationResult.isUpgrade
                    ? `Upgrade with ${prorationResult.daysRemaining} days proration credit`
                    : `Downgrade to ${newTier} plan`
                },
                unit_amount: prorationResult.finalAmount, // Amount in cents
              },
              quantity: 1,
            },
          ],
          success_url: `${baseUrl}/dashboard/subscription?plan_change_success=true`,
          cancel_url: `${baseUrl}/dashboard/subscription?plan_change_cancelled=true`,
          metadata: {
            userId: userId,
            planChangeType: 'subscription_update',
            currentTier: currentSubscription.tier,
            currentBillingCycle: currentSubscription.billingCycle,
            newTier: newTier.toLowerCase(),
            newBillingCycle: newBillingCycle.toLowerCase(),
            prorationAmount: prorationResult.prorationCredit.toString(),
            isUpgrade: prorationResult.isUpgrade.toString(),
            subscriptionId: currentSubscription.stripeSubscriptionId || ''
          },
          allow_promotion_codes: false,
          billing_address_collection: 'auto',
        });

        console.log('✅ Plan change checkout session created:', session.id);

        return res.json({
          success: true,
          checkoutUrl: session.url,
          sessionId: session.id,
          prorationDetails: {
            ...prorationResult,
            finalAmountDisplay: `$${(prorationResult.finalAmount / 100).toFixed(2)}`,
            prorationCreditDisplay: `$${(prorationResult.prorationCredit / 100).toFixed(2)}`
          }
        });

      } catch (planChangeError) {
        console.error('Plan change initiation failed:', planChangeError);

        return res.status(500).json({
          success: false,
          error: {
            code: 'PLAN_CHANGE_FAILED',
            message: planChangeError.message || 'Failed to initiate plan change'
          }
        });
      }
    }

    // GET /stripe/subscription/{userId}/calculate-proration - Calculate custom proration
    if (req.method === 'GET' && action === 'calculate-proration') {
      console.log('Calculating proration for user:', userId);

      const { newTier, newBillingCycle } = req.query;

      // Validate required parameters
      if (!newTier || !newBillingCycle) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'newTier and newBillingCycle are required'
          }
        });
      }

      // Validate tier and billing cycle
      const validTiers = ['starter', 'growth', 'scale'];
      const validBillingCycles = ['monthly', 'yearly'];

      if (!validTiers.includes(newTier.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TIER',
            message: `Invalid tier. Must be one of: ${validTiers.join(', ')}`
          }
        });
      }

      if (!validBillingCycles.includes(newBillingCycle.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_BILLING_CYCLE',
            message: `Invalid billing cycle. Must be one of: ${validBillingCycles.join(', ')}`
          }
        });
      }

      try {
        // Get current subscription
        const currentSubscription = await getUserSubscription(userId);

        if (!currentSubscription) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'SUBSCRIPTION_NOT_FOUND',
              message: 'No subscription found for this user'
            }
          });
        }

        // Calculate custom proration
        const prorationResult = calculateCustomProration(
          {
            tier: currentSubscription.tier,
            billingCycle: currentSubscription.billingCycle
          },
          {
            tier: newTier.toLowerCase(),
            billingCycle: newBillingCycle.toLowerCase()
          },
          currentSubscription.currentPeriodStart
        );

        return res.json({
          success: true,
          proration: {
            ...prorationResult,
            // Convert cents to dollars for display
            finalAmountDisplay: `$${(prorationResult.finalAmount / 100).toFixed(2)}`,
            prorationCreditDisplay: `$${(prorationResult.prorationCredit / 100).toFixed(2)}`,
            currentPlan: {
              tier: currentSubscription.tier,
              billingCycle: currentSubscription.billingCycle,
              price: `$${(prorationResult.breakdown.currentPlanPrice / 100).toFixed(2)}`
            },
            newPlan: {
              tier: newTier,
              billingCycle: newBillingCycle,
              price: `$${(prorationResult.breakdown.newPlanPrice / 100).toFixed(2)}`
            }
          }
        });

      } catch (prorationError) {
        console.error('Proration calculation failed:', prorationError);

        return res.status(500).json({
          success: false,
          error: {
            code: 'PRORATION_CALCULATION_FAILED',
            message: prorationError.message || 'Failed to calculate proration'
          }
        });
      }
    }

    // Handle unknown actions or methods
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: `Method ${req.method} not allowed for action: ${action || 'none'}`
      }
    });

  } catch (error) {
    console.error('Error handling subscription route:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
};

// Firestore database operations
const getUserSubscription = async (userId) => {
  try {
    // Get from subscriptions collection only (single source of truth)
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    const subscriptionDoc = await subscriptionRef.get();

    if (subscriptionDoc.exists) {
      return subscriptionDoc.data();
    }

    return null;
  } catch (error) {
    console.error('Error getting user subscription:', error);
    return null;
  }
};

const updateUserSubscription = async (userId, subscriptionData) => {
  try {
    // Write to subscriptions collection only (single source of truth)
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    const subscriptionDoc = await subscriptionRef.get();

    if (subscriptionDoc.exists) {
      // Update existing subscription document
      await subscriptionRef.update({
        ...subscriptionData,
        updatedAt: FieldValue.serverTimestamp()
      });
    } else {
      // Create new subscription document
      await subscriptionRef.set({
        userId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...subscriptionData
      });
    }

    console.log('User subscription updated successfully for user:', userId);
    console.log('Data written to subscriptions collection only');
    return true;
  } catch (error) {
    console.error('Error updating user subscription:', error);
    return false;
  }
};

// Enhanced subscription cancellation with modern Stripe API
const cancelUserSubscription = async (userId, cancellationData = {}) => {
  console.log(`Starting subscription cancellation for user: ${userId}`);

  try {
    // Get subscription data from database (single source of truth)
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      console.log('User subscription not found:', userId);
      throw new Error('User subscription not found');
    }

    const userData = subscriptionDoc.data();

    if (!userData.stripeSubscriptionId) {
      console.log('No Stripe subscription ID found for user:', userId);
      throw new Error('No active subscription found');
    }

    // Get current subscription from Stripe to verify status
    let stripeSubscription;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(userData.stripeSubscriptionId);
      console.log('Current Stripe subscription status:', stripeSubscription.status);
    } catch (stripeError) {
      console.error('Error retrieving Stripe subscription:', stripeError);
      throw new Error('Failed to retrieve subscription from Stripe');
    }

    // Check if subscription is already cancelled
    if (stripeSubscription.status === 'canceled' || stripeSubscription.cancel_at_period_end) {
      console.log('Subscription already cancelled or scheduled for cancellation');
      throw new Error('Subscription is already cancelled or scheduled for cancellation');
    }

    // Cancel subscription in Stripe using modern API
    let updatedSubscription;
    try {
      // First, update metadata before cancelling (optional step for tracking)
      try {
        await stripe.subscriptions.update(userData.stripeSubscriptionId, {
          metadata: {
            cancelled_by: userId,
            cancelled_at: new Date().toISOString(),
            cancellation_reason: cancellationData.reason || 'user_requested',
            cancellation_feedback: cancellationData.feedback || ''
          }
        });
      } catch (metadataError) {
        console.warn('Failed to update metadata before cancellation:', metadataError.message);
        // Continue with cancellation even if metadata update fails
      }

      // Cancel subscription immediately
      updatedSubscription = await stripe.subscriptions.cancel(userData.stripeSubscriptionId, {
        // Optional: provide proration behavior
        prorate: false, // Don't prorate - user keeps what they paid for
        invoice_now: false // Don't create final invoice immediately
      });

      console.log('✅ Stripe subscription cancelled immediately:', updatedSubscription.id);
      console.log('Subscription cancelled at:', new Date(updatedSubscription.canceled_at * 1000).toISOString());

    } catch (stripeError) {
      console.error('❌ Error cancelling Stripe subscription:', stripeError);
      throw new Error(`Failed to cancel subscription in Stripe: ${stripeError.message}`);
    }

    // Update local database with cancellation metadata only (NO tier change yet)
    const updateData = {
      status: 'cancelling', // ← Intermediate status until webhook confirms
      // DON'T change tier here - let webhook handle it for 100% confirmation
      originalTier: userData.tier, // ← Preserve original tier for reactivation
      cancelledAt: FieldValue.serverTimestamp(),
      cancelAtPeriodEnd: false, // Immediate cancellation
      cancellationReason: cancellationData.reason || 'user_requested',
      cancellationFeedback: cancellationData.feedback || '',
      updatedAt: FieldValue.serverTimestamp(),
      // Keep Stripe subscription data for reference
      stripeSubscriptionStatus: updatedSubscription.status,
      stripeCancelledAt: updatedSubscription.canceled_at ? new Date(updatedSubscription.canceled_at * 1000).toISOString() : null,
      // Flag to indicate cancellation is in progress
      cancellationInProgress: true
    };

    // Update subscriptions collection only (single source of truth)
    await subscriptionRef.update(updateData);

    console.log('✅ User subscription cancellation initiated for user:', userId);
    console.log('Waiting for webhook confirmation to complete tier change...');

    return {
      success: true,
      message: 'Subscription cancellation initiated. Tier change will be confirmed via webhook.',
      status: 'cancelling',
      cancelledAt: updateData.stripeCancelledAt,
      subscriptionId: updatedSubscription.id,
      note: 'Tier will change to free once Stripe webhook confirms the cancellation.'
    };

  } catch (error) {
    console.error('❌ Error canceling user subscription:', error);
    throw error; // Re-throw to be handled by the endpoint
  }
};



const handleWebhook = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST requests allowed' }
    });
  }

  console.log('=== LEGACY WEBHOOK HANDLER ===');
  console.log('NOTE: Consider using the dedicated stripeWebhook function for better signature verification');
  console.log('Webhook received - method:', req.method);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Webhook body type:', typeof req.body);
  console.log('Webhook rawBody available:', !!req.rawBody);
  console.log('Webhook body length:', req.body ? (Buffer.isBuffer(req.body) ? req.body.length : JSON.stringify(req.body).length) : 0);

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  console.log('Stripe signature present:', !!sig);
  console.log('Webhook secret configured:', !!webhookSecret);

  try {
    // Verify webhook signature if secret is configured
    if (webhookSecret && sig) {
      console.log('Verifying webhook signature...');

      try {
        const rawBody = getRawBody(req);
        console.log('Raw body extracted, length:', rawBody.length);

        // Use the exact pattern from Stripe documentation
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
        console.log('✅ Webhook signature verified successfully');

      } catch (signatureError) {
        console.error('❌ Signature verification failed:', signatureError.message);
        console.error('This is the exact error causing production issues');
        console.error('Raw body type:', typeof rawBody);
        console.error('Signature header:', sig);
        console.error('Webhook secret (first 10 chars):', webhookSecret ? webhookSecret.substring(0, 10) + '...' : 'not set');

        // Return the exact error that Stripe expects
        return res.status(400).send(`Webhook signature verification failed: ${signatureError.message}`);
      }

    } else {
      // For development without webhook secret
      console.warn('⚠️  WARNING: Processing webhook without signature verification');
      console.warn('Set STRIPE_WEBHOOK_SECRET environment variable for production');

      if (typeof req.body === 'object' && req.body !== null) {
        event = req.body;
      } else if (typeof req.body === 'string') {
        event = JSON.parse(req.body);
      } else {
        throw new Error('Invalid webhook body format');
      }
    }

    console.log('Webhook event type:', event.type);
    console.log('Webhook event ID:', event.id);

  } catch (err) {
    console.error('❌ Webhook processing failed:', err.message);
    console.error('Error type:', err.constructor.name);
    console.error('Body type:', typeof req.body);
    console.error('Signature present:', !!sig);
    console.error('Webhook secret configured:', !!webhookSecret);

    // Return proper error response for Stripe
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Process the event using the shared function
    await processWebhookEvent(event);

    console.log('✅ Webhook processed successfully');
    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error processing webhook event:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Webhook event handlers
const handleCheckoutSessionCompleted = async (session) => {
  console.log('Processing checkout.session.completed:', session.id);

  const userId = session.metadata?.userId;
  const planChangeType = session.metadata?.planChangeType;

  if (!userId || userId === 'anonymous') {
    console.log('No user ID in session metadata, skipping processing');
    return;
  }

  try {
    // Handle plan change checkout completion
    if (planChangeType === 'subscription_update') {
      console.log('Processing plan change completion for user:', userId);

      const currentTier = session.metadata?.currentTier;
      const currentBillingCycle = session.metadata?.currentBillingCycle;
      const newTier = session.metadata?.newTier;
      const newBillingCycle = session.metadata?.newBillingCycle;
      const prorationAmount = parseInt(session.metadata?.prorationAmount || '0');
      const isUpgrade = session.metadata?.isUpgrade === 'true';
      const subscriptionId = session.metadata?.subscriptionId;

      console.log('Plan change details:', {
        currentTier,
        currentBillingCycle,
        newTier,
        newBillingCycle,
        prorationAmount,
        isUpgrade,
        subscriptionId
      });

      // Get current subscription data
      const currentSubscription = await getUserSubscription(userId);
      if (!currentSubscription) {
        throw new Error('Current subscription not found');
      }

      // Calculate new credits and preserve existing usage
      const newCredits = getCreditsForTier(newTier);
      const currentCreditsUsed = currentSubscription.creditsUsed || 0;

      // For upgrades, reset credits used; for downgrades, keep current usage (capped at new limit)
      const newCreditsUsed = isUpgrade ? 0 : Math.min(currentCreditsUsed, newCredits);

      // Update subscription with new plan details
      const subscriptionUpdateData = {
        tier: newTier.charAt(0).toUpperCase() + newTier.slice(1),
        billingCycle: newBillingCycle,
        credits: newCredits,
        creditsUsed: newCreditsUsed,
        // Keep existing period dates (immediate change, not billing cycle change)
        planChangedAt: FieldValue.serverTimestamp(),
        lastPlanChangeAmount: session.amount_total, // Amount paid for plan change
        lastPlanChangeDate: new Date().toISOString(),
        planChangeHistory: FieldValue.arrayUnion({
          changedAt: new Date().toISOString(),
          fromTier: currentTier,
          fromBillingCycle: currentBillingCycle,
          toTier: newTier,
          toBillingCycle: newBillingCycle,
          amountPaid: session.amount_total,
          prorationCredit: prorationAmount,
          isUpgrade: isUpgrade,
          checkoutSessionId: session.id
        }),
        updatedAt: FieldValue.serverTimestamp()
      };

      // Update subscriptions collection only (single source of truth)
      const subscriptionRef = db.collection('subscriptions').doc(userId);
      await subscriptionRef.update(subscriptionUpdateData);

      console.log(`✅ Plan change completed for user ${userId}: ${currentTier} → ${newTier}`);
      console.log(`Credits updated: ${currentCreditsUsed}/${currentSubscription.credits} → ${newCreditsUsed}/${newCredits}`);

      // Send plan change confirmation email
      try {
        // Get customer details from Stripe
        const customer = await stripe.customers.retrieve(session.customer);
        
        if (customer.email) {
          const planChangeDetails = {
            transactionId: session.id,
            amount: session.amount_total,
            currency: session.currency,
            fromPlan: currentTier.charAt(0).toUpperCase() + currentTier.slice(1),
            toPlan: newTier.charAt(0).toUpperCase() + newTier.slice(1),
            billingCycle: newBillingCycle,
            date: new Date().toLocaleDateString(),
            nextBillingDate: currentSubscription.currentPeriodEnd ? new Date(currentSubscription.currentPeriodEnd).toLocaleDateString() : null,
            newCredits: newCredits,
            prorationCredit: prorationAmount,
            isUpgrade: isUpgrade
          };

          await sendPlanChangeConfirmationEmail({
            customerEmail: customer.email,
            customerName: customer.name || customer.email.split('@')[0],
            planChangeDetails
          });

          console.log(`✅ Plan change confirmation email sent to ${customer.email}`);
        }
      } catch (emailError) {
        console.error('Failed to send plan change confirmation email:', emailError);
        // Don't throw - email failure shouldn't break the webhook
      }

      return;
    }

    // Handle regular subscription creation (existing logic)
    const tier = session.metadata?.tier;
    const billingCycle = session.metadata?.billingCycle;

    if (!tier || !billingCycle) {
      console.log('No tier/billingCycle in session metadata, skipping subscription creation');
      return;
    }

    // Calculate subscription end date
    const currentPeriodEnd = new Date(Date.now() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);

    // Calculate credits for this tier
    const credits = getCreditsForTier(tier);

    // Create or update user subscription
    const subscriptionData = {
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      tier: tier.charAt(0).toUpperCase() + tier.slice(1),
      billingCycle,
      status: 'active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      createdAt: new Date().toISOString(),
      credits: credits, // Total credits allocated
      creditsUsed: 0, // Credits used this period
      creditsResetDate: currentPeriodEnd.toISOString() // When credits reset
    };

    const success = await updateUserSubscription(userId, subscriptionData);

    if (success) {
      console.log(`Subscription activated for user ${userId}: ${tier} (${billingCycle})`);
      
      // Send transaction confirmation email
      try {
        // Get customer details from Stripe
        const customer = await stripe.customers.retrieve(session.customer);
        
        if (customer.email) {
          const transactionDetails = {
            transactionId: session.id,
            amount: session.amount_total,
            currency: session.currency,
            planName: tier.charAt(0).toUpperCase() + tier.slice(1),
            billingCycle: billingCycle,
            transactionType: 'New Subscription',
            date: new Date().toLocaleDateString(),
            nextBillingDate: currentPeriodEnd.toLocaleDateString(),
            credits: credits
          };

          await sendTransactionConfirmationEmail({
            customerEmail: customer.email,
            customerName: customer.name || customer.email.split('@')[0],
            transactionDetails
          });

          console.log(`✅ Transaction confirmation email sent to ${customer.email}`);
        }
      } catch (emailError) {
        console.error('Failed to send transaction confirmation email:', emailError);
        // Don't throw - email failure shouldn't break the webhook
      }
    } else {
      console.error('Failed to save subscription data for user:', userId);
    }

  } catch (error) {
    console.error('Error handling checkout session completed:', error);
    throw error;
  }
};

const handleInvoicePaymentSucceeded = async (invoice) => {
  console.log('Processing invoice.payment_succeeded:', invoice.id);

  try {
    // Find user by Stripe customer ID
    const subscriptionsQuery = await db.collection('subscriptions')
      .where('stripeCustomerId', '==', invoice.customer)
      .limit(1)
      .get();

    if (subscriptionsQuery.empty) {
      console.log('No user found for customer:', invoice.customer);
      return;
    }

    const userDoc = subscriptionsQuery.docs[0];
    const userId = userDoc.id;

    console.log('Invoice payment succeeded for user:', userId);

    // Update subscription status and reset credits if it's a new billing period
    const updateData = {
      status: 'active',
      lastInvoiceId: invoice.id,
      lastPaymentDate: new Date(invoice.status_transitions?.paid_at * 1000).toISOString(),
      updatedAt: FieldValue.serverTimestamp()
    };

    // If this is a subscription renewal, reset credits
    if (invoice.billing_reason === 'subscription_cycle') {
      const currentData = userDoc.data();
      updateData.creditsUsed = 0; // Reset credits for new period
      updateData.creditsResetDate = new Date(invoice.period_end * 1000).toISOString();

      console.log(`Credits reset for user ${userId} - new billing period`);
    }

    // Update subscriptions collection only (single source of truth)
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    await subscriptionRef.update(updateData);

    console.log('✅ Invoice payment success processed for user:', userId);

    // Send payment receipt email for recurring payments
    try {
      // Get customer details from Stripe
      const customer = await stripe.customers.retrieve(invoice.customer);
      
      if (customer.email && invoice.billing_reason === 'subscription_cycle') {
        const currentData = userDoc.data();
        const transactionDetails = {
          transactionId: invoice.id,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          planName: currentData.tier || 'Subscription',
          billingCycle: currentData.billingCycle || 'monthly',
          transactionType: 'Recurring Payment',
          date: new Date(invoice.status_transitions?.paid_at * 1000).toLocaleDateString(),
          nextBillingDate: new Date(invoice.period_end * 1000).toLocaleDateString(),
          credits: currentData.credits
        };

        await sendTransactionConfirmationEmail({
          customerEmail: customer.email,
          customerName: customer.name || customer.email.split('@')[0],
          transactionDetails
        });

        console.log(`✅ Recurring payment confirmation email sent to ${customer.email}`);
      }
    } catch (emailError) {
      console.error('Failed to send recurring payment confirmation email:', emailError);
      // Don't throw - email failure shouldn't break the webhook
    }

  } catch (error) {
    console.error('Error processing invoice payment success:', error);
  }
};

const handleInvoicePaymentFailed = async (invoice) => {
  console.log('Processing invoice.payment_failed:', invoice.id);

  try {
    // Find user by Stripe customer ID
    const subscriptionsQuery = await db.collection('subscriptions')
      .where('stripeCustomerId', '==', invoice.customer)
      .limit(1)
      .get();

    if (subscriptionsQuery.empty) {
      console.log('No user found for customer:', invoice.customer);
      return;
    }

    const userDoc = subscriptionsQuery.docs[0];
    const userId = userDoc.id;

    console.log('Invoice payment failed for user:', userId);

    // Update subscription status to indicate payment failure
    const updateData = {
      status: 'past_due',
      lastFailedInvoiceId: invoice.id,
      lastPaymentFailureDate: new Date().toISOString(),
      paymentFailureCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
      // Store failure details for recovery
      paymentFailure: {
        invoiceId: invoice.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        attemptCount: invoice.attempt_count,
        nextPaymentAttempt: invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toISOString() : null
      }
    };

    // Update subscriptions collection only (single source of truth)
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    await subscriptionRef.update(updateData);

    console.log('✅ Invoice payment failure processed for user:', userId);

    // TODO: Send payment failure notification email
    // TODO: Trigger payment recovery flow

  } catch (error) {
    console.error('Error processing invoice payment failure:', error);
  }
};

const handleInvoiceCreated = async (invoice) => {
  console.log('Processing invoice.created:', invoice.id);

  try {
    // Find user by Stripe customer ID
    const subscriptionsQuery = await db.collection('subscriptions')
      .where('stripeCustomerId', '==', invoice.customer)
      .limit(1)
      .get();

    if (subscriptionsQuery.empty) {
      console.log('No user found for customer:', invoice.customer);
      return;
    }

    const userDoc = subscriptionsQuery.docs[0];
    const userId = userDoc.id;

    console.log('Invoice created for user:', userId);

    // Update next invoice information
    const updateData = {
      nextInvoiceDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
      nextInvoiceAmount: invoice.amount_due,
      updatedAt: FieldValue.serverTimestamp()
    };

    // Update subscriptions collection only (single source of truth)
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    await subscriptionRef.update(updateData);

    console.log('✅ Invoice creation processed for user:', userId);

  } catch (error) {
    console.error('Error processing invoice creation:', error);
  }
};

const handleInvoiceFinalized = async (invoice) => {
  console.log('Processing invoice.finalized:', invoice.id);

  try {
    // Find user by Stripe customer ID
    const subscriptionsQuery = await db.collection('subscriptions')
      .where('stripeCustomerId', '==', invoice.customer)
      .limit(1)
      .get();

    if (subscriptionsQuery.empty) {
      console.log('No user found for customer:', invoice.customer);
      return;
    }

    const userDoc = subscriptionsQuery.docs[0];
    const userId = userDoc.id;

    console.log('Invoice finalized for user:', userId);

    // Update invoice information
    const updateData = {
      lastFinalizedInvoiceId: invoice.id,
      updatedAt: FieldValue.serverTimestamp()
    };

    // Update subscriptions collection only (single source of truth)
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    await subscriptionRef.update(updateData);

    console.log('✅ Invoice finalization processed for user:', userId);

  } catch (error) {
    console.error('Error processing invoice finalization:', error);
  }
};

const handleSubscriptionUpdated = async (subscription) => {
  console.log('Processing customer.subscription.updated:', subscription.id);

  try {
    // Find user by Stripe subscription ID
    const subscriptionsQuery = await db.collection('subscriptions')
      .where('stripeSubscriptionId', '==', subscription.id)
      .limit(1)
      .get();

    if (subscriptionsQuery.empty) {
      console.log('No user found for updated subscription:', subscription.id);
      return;
    }

    const userDoc = subscriptionsQuery.docs[0];
    const userId = userDoc.id;
    const currentData = userDoc.data();

    console.log('Updating subscription for user:', userId);

    // Prepare enhanced update data
    const updateData = {
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
      stripeSubscriptionStatus: subscription.status,
      stripeCancelAtPeriodEnd: subscription.cancel_at_period_end || false,
      webhookSource: 'subscription.updated'
    };

    // Handle cancellation changes
    if (subscription.cancel_at_period_end && !currentData.cancelAtPeriodEnd) {
      updateData.cancelAtPeriodEnd = true;
      updateData.cancelledAt = FieldValue.serverTimestamp();
      updateData.cancellationReason = 'cancelled_via_stripe_dashboard';
      console.log('Subscription cancelled via Stripe dashboard');
    }



    // Handle plan changes
    if (subscription.items && subscription.items.data.length > 0) {
      const currentPriceId = subscription.items.data[0].price.id;
      const storedPriceId = findPriceIdInConfig(currentData.tier, currentData.billingCycle);

      if (currentPriceId !== storedPriceId) {
        console.log('Plan change detected via webhook');
        const planInfo = findPlanByPriceId(currentPriceId);

        if (planInfo) {
          updateData.tier = planInfo.tier.charAt(0).toUpperCase() + planInfo.tier.slice(1);
          updateData.billingCycle = planInfo.billingCycle;
          updateData.credits = getCreditsForTier(planInfo.tier);
          updateData.creditsResetDate = new Date(subscription.current_period_end * 1000).toISOString();
          updateData.planChangedAt = FieldValue.serverTimestamp();

          console.log(`Plan changed to ${planInfo.tier} ${planInfo.billingCycle}`);
        }
      }
    }

    // Use enhanced status management system
    await updateSubscriptionStatus(userId, updateData);

    console.log('✅ Enhanced subscription update processed for user:', userId);

    // Send subscription update email
    try {
      // Get customer details from Stripe
      const customer = await stripe.customers.retrieve(subscription.customer);
      
      if (customer.email) {
        // Determine what changed and create appropriate email
        const changes = [];
        let updateType = 'Subscription Update';

        // Check for cancellation changes
        if (subscription.cancel_at_period_end && !currentData.cancelAtPeriodEnd) {
          changes.push('Subscription set to cancel at period end');
          updateType = 'Cancellation Scheduled';
        } else if (!subscription.cancel_at_period_end && currentData.cancelAtPeriodEnd) {
          changes.push('Subscription cancellation removed - will continue');
          updateType = 'Cancellation Removed';
        }

        // Check for plan changes
        if (subscription.items && subscription.items.data.length > 0) {
          const currentPriceId = subscription.items.data[0].price.id;
          const storedPriceId = findPriceIdInConfig(currentData.tier, currentData.billingCycle);

          if (currentPriceId !== storedPriceId) {
            const planInfo = findPlanByPriceId(currentPriceId);
            if (planInfo) {
              changes.push(`Plan changed to ${planInfo.tier.charAt(0).toUpperCase() + planInfo.tier.slice(1)} (${planInfo.billingCycle})`);
              updateType = 'Plan Change';
            }
          }
        }

        // Check for billing period changes
        const newPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        if (currentData.currentPeriodEnd !== newPeriodEnd) {
          changes.push('Billing period updated');
        }

        // Check for status changes
        if (currentData.stripeSubscriptionStatus !== subscription.status) {
          changes.push(`Status changed to ${subscription.status}`);
        }

        // Only send email if there are meaningful changes
        if (changes.length > 0) {
          const updateDetails = {
            planName: updateData.tier || currentData.tier || 'Subscription',
            billingCycle: updateData.billingCycle || currentData.billingCycle || 'monthly',
            updateDate: new Date().toLocaleDateString(),
            updateType: updateType,
            changes: changes,
            nextBillingDate: new Date(subscription.current_period_end * 1000).toLocaleDateString(),
            credits: updateData.credits || currentData.credits
          };

          await sendSubscriptionUpdateEmail({
            customerEmail: customer.email,
            customerName: customer.name || customer.email.split('@')[0],
            updateDetails
          });

          console.log(`✅ Subscription update email sent to ${customer.email} for: ${updateType}`);
        }
      }
    } catch (emailError) {
      console.error('Failed to send subscription update email:', emailError);
      // Don't throw - email failure shouldn't break the webhook
    }

  } catch (error) {
    console.error('Error processing subscription update:', error);
  }
};

const handleSubscriptionDeleted = async (subscription) => {
  console.log('Processing customer.subscription.deleted:', subscription.id);

  try {
    // Find user by Stripe subscription ID
    const subscriptionsQuery = await db.collection('subscriptions')
      .where('stripeSubscriptionId', '==', subscription.id)
      .limit(1)
      .get();

    if (subscriptionsQuery.empty) {
      console.log('No user found for deleted subscription:', subscription.id);
      return;
    }

    const userDoc = subscriptionsQuery.docs[0];
    const userId = userDoc.id;

    console.log('Processing subscription deletion for user:', userId);

    // Get current user data to preserve credits and metadata
    const currentData = userDoc.data();

    // Prepare complete cancellation update data
    const updateData = {
      status: 'cancelled', // ← Final confirmed status
      tier: 'free', // ← NOW we change tier (100% confirmed by Stripe)
      // PRESERVE CREDITS - Don't reset them on cancellation!
      credits: currentData.credits || 0, // Keep existing credits
      creditsUsed: currentData.creditsUsed || 0, // Keep credits used
      // Preserve cancellation metadata from direct API call
      originalTier: currentData.originalTier || currentData.tier,
      cancelledAt: currentData.cancelledAt || FieldValue.serverTimestamp(),
      cancellationReason: currentData.cancellationReason || 'stripe_webhook',
      cancellationFeedback: currentData.cancellationFeedback || '',
      // Webhook-specific data
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      stripeSubscriptionStatus: 'canceled',
      webhookSource: 'subscription.deleted',
      cancellationInProgress: false, // ← Clear the in-progress flag
      tierChangedAt: FieldValue.serverTimestamp(), // ← Track when tier actually changed
      reason: 'Subscription cancelled - tier downgraded via webhook confirmation'
    };

    // Use enhanced status management system
    await updateSubscriptionStatus(userId, updateData);

    console.log('✅ Enhanced subscription deletion processed for user:', userId);

    // Send cancellation confirmation email
    try {
      // Get customer details from Stripe
      const customer = await stripe.customers.retrieve(subscription.customer);
      
      if (customer.email) {
        const cancellationDetails = {
          planName: currentData.originalTier || currentData.tier || 'Subscription',
          billingCycle: currentData.billingCycle || 'monthly',
          cancellationDate: new Date().toLocaleDateString(),
          accessUntilDate: currentData.currentPeriodEnd ? new Date(currentData.currentPeriodEnd).toLocaleDateString() : 'Immediately',
          remainingCredits: (currentData.credits || 0) - (currentData.creditsUsed || 0),
          cancellationReason: currentData.cancellationReason || 'Subscription cancelled'
        };

        await sendSubscriptionCancellationEmail({
          customerEmail: customer.email,
          customerName: customer.name || customer.email.split('@')[0],
          cancellationDetails
        });

        console.log(`✅ Subscription cancellation email sent to ${customer.email}`);
      }
    } catch (emailError) {
      console.error('Failed to send subscription cancellation email:', emailError);
      // Don't throw - email failure shouldn't break the webhook
    }

  } catch (error) {
    console.error('Error processing subscription deletion:', error);
  }
};

const handleSubscriptionCreated = async (subscription) => {
  console.log('Processing customer.subscription.created:', subscription.id);

  try {
    // This event is typically handled by checkout.session.completed
    // But we can use it for additional processing if needed
    console.log('New subscription created:', {
      id: subscription.id,
      customer: subscription.customer,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end
    });

    // Additional processing can be added here if needed

  } catch (error) {
    console.error('Error processing subscription creation:', error);
  }
};

const handlePaymentMethodAttached = async (paymentMethod) => {
  console.log('Processing payment_method.attached:', paymentMethod.id);

  try {
    // Find user by Stripe customer ID
    const subscriptionsQuery = await db.collection('subscriptions')
      .where('stripeCustomerId', '==', paymentMethod.customer)
      .limit(1)
      .get();

    if (subscriptionsQuery.empty) {
      console.log('No user found for customer:', paymentMethod.customer);
      return;
    }

    const userDoc = subscriptionsQuery.docs[0];
    const userId = userDoc.id;

    console.log('Payment method attached for user:', userId);

    // Update user's payment method information in database
    const updateData = {
      paymentMethod: {
        type: paymentMethod.type,
        last4: paymentMethod.card?.last4 || null,
        brand: paymentMethod.card?.brand || null,
        expiryMonth: paymentMethod.card?.exp_month || null,
        expiryYear: paymentMethod.card?.exp_year || null
      },
      paymentMethodUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    // Update subscriptions collection only (single source of truth)
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    await subscriptionRef.update(updateData);

    console.log('✅ Payment method attachment processed for user:', userId);

  } catch (error) {
    console.error('Error processing payment method attachment:', error);
  }
};

const handlePaymentMethodDetached = async (paymentMethod) => {
  console.log('Processing payment_method.detached:', paymentMethod.id);

  try {
    // Find user by Stripe customer ID
    const subscriptionsQuery = await db.collection('subscriptions')
      .where('stripeCustomerId', '==', paymentMethod.customer)
      .limit(1)
      .get();

    if (subscriptionsQuery.empty) {
      console.log('No user found for customer:', paymentMethod.customer);
      return;
    }

    const userDoc = subscriptionsQuery.docs[0];
    const userId = userDoc.id;

    console.log('Payment method detached for user:', userId);

    // Note: We don't clear payment method info here as there might be other payment methods
    // The frontend should refresh payment method list after detachment

    const updateData = {
      paymentMethodUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    // Update subscriptions collection only (single source of truth)
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    await subscriptionRef.update(updateData);

    console.log('✅ Payment method detachment processed for user:', userId);

  } catch (error) {
    console.error('Error processing payment method detachment:', error);
  }
};

const handleCustomerUpdated = async (customer) => {
  console.log('Processing customer.updated:', customer.id);

  try {
    // Find user by Stripe customer ID
    const subscriptionsQuery = await db.collection('subscriptions')
      .where('stripeCustomerId', '==', customer.id)
      .limit(1)
      .get();

    if (subscriptionsQuery.empty) {
      console.log('No user found for customer:', customer.id);
      return;
    }

    const userDoc = subscriptionsQuery.docs[0];
    const userId = userDoc.id;

    console.log('Customer updated for user:', userId);

    // Update customer information if needed
    const updateData = {
      customerUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    // If default payment method changed, update it
    if (customer.invoice_settings?.default_payment_method) {
      try {
        const defaultPM = await stripe.paymentMethods.retrieve(
          customer.invoice_settings.default_payment_method
        );

        updateData.paymentMethod = {
          type: defaultPM.type,
          last4: defaultPM.card?.last4 || null,
          brand: defaultPM.card?.brand || null,
          expiryMonth: defaultPM.card?.exp_month || null,
          expiryYear: defaultPM.card?.exp_year || null
        };

        console.log('Updated default payment method info');
      } catch (pmError) {
        console.error('Error retrieving default payment method:', pmError);
      }
    }

    // Update subscriptions collection only (single source of truth)
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    await subscriptionRef.update(updateData);

    console.log('✅ Customer update processed for user:', userId);

  } catch (error) {
    console.error('Error processing customer update:', error);
  }
};



// Enhanced subscription status management with real-time updates
const updateSubscriptionStatus = async (userId, statusData = {}) => {
  console.log(`Updating subscription status for user: ${userId}`, statusData);

  // Validate user ID
  if (!userId || userId === 'undefined' || userId === 'null' || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('Valid user ID is required');
  }

  try {
    // Get current subscription data (single source of truth)
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      console.log('User subscription not found:', userId);
      throw new Error('User subscription not found');
    }

    const userData = subscriptionDoc.data();

    // Get latest subscription data from Stripe if subscription ID exists
    let stripeSubscription = null;
    if (userData.stripeSubscriptionId) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(userData.stripeSubscriptionId, {
          expand: ['latest_invoice', 'default_payment_method', 'customer']
        });
        console.log('Retrieved Stripe subscription status:', stripeSubscription.status);
      } catch (stripeError) {
        console.error('Error retrieving Stripe subscription:', stripeError);
        // Don't throw here, continue with local data update
      }
    }

    // Determine the comprehensive status based on Stripe data and local overrides
    const comprehensiveStatus = determineSubscriptionStatus(stripeSubscription, userData, statusData);

    // Prepare update data with enhanced status information
    const updateData = {
      ...statusData,
      status: comprehensiveStatus.status,
      statusDetails: comprehensiveStatus.details,
      lastStatusUpdate: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    // Add Stripe-specific data if available
    if (stripeSubscription) {
      updateData.stripeSubscriptionStatus = stripeSubscription.status;
      updateData.stripeCancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
      updateData.stripeCurrentPeriodStart = new Date(stripeSubscription.current_period_start * 1000).toISOString();
      updateData.stripeCurrentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000).toISOString();

      // Update trial information if applicable
      if (stripeSubscription.trial_end) {
        updateData.trialEnd = new Date(stripeSubscription.trial_end * 1000).toISOString();
        updateData.isInTrial = stripeSubscription.trial_end * 1000 > Date.now();
      }

      // Update payment method information
      if (stripeSubscription.default_payment_method) {
        updateData.hasPaymentMethod = true;
        updateData.defaultPaymentMethodId = stripeSubscription.default_payment_method;
      } else if (stripeSubscription.customer?.invoice_settings?.default_payment_method) {
        updateData.hasPaymentMethod = true;
        updateData.defaultPaymentMethodId = stripeSubscription.customer.invoice_settings.default_payment_method;
      } else {
        updateData.hasPaymentMethod = false;
      }
    }

    // Update subscriptions collection only (single source of truth)
    await subscriptionRef.update(updateData);

    console.log('✅ Subscription status updated successfully for user:', userId);
    console.log('New status:', comprehensiveStatus.status);

    return {
      success: true,
      status: comprehensiveStatus.status,
      statusDetails: comprehensiveStatus.details,
      stripeStatus: stripeSubscription?.status || null,
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error updating subscription status:', error);
    throw error;
  }
};

// Determine comprehensive subscription status based on Stripe and local data
const determineSubscriptionStatus = (stripeSubscription, localData, overrides = {}) => {
  // Priority order: overrides > Stripe status > local status > default

  if (overrides.status) {
    return {
      status: overrides.status,
      details: {
        source: 'manual_override',
        reason: overrides.reason || 'Manual status update',
        timestamp: new Date().toISOString()
      }
    };
  }

  if (!stripeSubscription) {
    return {
      status: localData.status || 'inactive',
      details: {
        source: 'local_data',
        reason: 'No Stripe subscription data available',
        timestamp: new Date().toISOString()
      }
    };
  }

  const currentTime = Date.now();
  const periodEnd = stripeSubscription.current_period_end * 1000;
  const trialEnd = stripeSubscription.trial_end ? stripeSubscription.trial_end * 1000 : null;

  // Handle different Stripe subscription statuses
  switch (stripeSubscription.status) {
    case 'active':
      if (stripeSubscription.cancel_at_period_end) {
        return {
          status: 'cancelled',
          details: {
            source: 'stripe',
            reason: 'Subscription cancelled, access until period end',
            accessUntil: new Date(periodEnd).toISOString(),
            timestamp: new Date().toISOString()
          }
        };
      }

      if (trialEnd && currentTime < trialEnd) {
        return {
          status: 'trial',
          details: {
            source: 'stripe',
            reason: 'Active trial period',
            trialEndsAt: new Date(trialEnd).toISOString(),
            timestamp: new Date().toISOString()
          }
        };
      }

      return {
        status: 'active',
        details: {
          source: 'stripe',
          reason: 'Active subscription',
          nextBilling: new Date(periodEnd).toISOString(),
          timestamp: new Date().toISOString()
        }
      };

    case 'past_due':
      // Check grace period (7 days)
      const gracePeriodMs = 7 * 24 * 60 * 60 * 1000;
      const latestInvoiceCreated = stripeSubscription.latest_invoice?.created * 1000 || currentTime;
      const graceExpired = currentTime - latestInvoiceCreated >= gracePeriodMs;

      return {
        status: graceExpired ? 'suspended' : 'past_due',
        details: {
          source: 'stripe',
          reason: graceExpired ? 'Grace period expired' : 'Payment past due, in grace period',
          graceExpiresAt: graceExpired ? null : new Date(latestInvoiceCreated + gracePeriodMs).toISOString(),
          timestamp: new Date().toISOString()
        }
      };

    case 'canceled':
      return {
        status: 'expired',
        details: {
          source: 'stripe',
          reason: 'Subscription has been cancelled',
          cancelledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : null,
          timestamp: new Date().toISOString()
        }
      };

    case 'unpaid':
      return {
        status: 'suspended',
        details: {
          source: 'stripe',
          reason: 'Subscription unpaid and suspended',
          timestamp: new Date().toISOString()
        }
      };

    case 'incomplete':
      return {
        status: 'incomplete',
        details: {
          source: 'stripe',
          reason: 'Subscription setup incomplete',
          timestamp: new Date().toISOString()
        }
      };

    case 'incomplete_expired':
      return {
        status: 'expired',
        details: {
          source: 'stripe',
          reason: 'Incomplete subscription expired',
          timestamp: new Date().toISOString()
        }
      };

    case 'trialing':
      return {
        status: 'trial',
        details: {
          source: 'stripe',
          reason: 'In trial period',
          trialEndsAt: trialEnd ? new Date(trialEnd).toISOString() : null,
          timestamp: new Date().toISOString()
        }
      };

    default:
      return {
        status: 'unknown',
        details: {
          source: 'stripe',
          reason: `Unknown Stripe status: ${stripeSubscription.status}`,
          stripeStatus: stripeSubscription.status,
          timestamp: new Date().toISOString()
        }
      };
  }
};

// Determine user access level based on subscription status
const determineAccessLevel = (status, subscription) => {
  switch (status) {
    case 'active':
    case 'trial':
      return {
        level: 'full',
        description: 'Full access to all features',
        features: ['all_features', 'priority_support', 'advanced_analytics']
      };

    case 'cancelled':
      // Still has access until period end
      return {
        level: 'full',
        description: 'Full access until subscription ends',
        features: ['all_features', 'priority_support', 'advanced_analytics'],
        expiresAt: subscription?.currentPeriodEnd
      };

    case 'past_due':
      // Grace period - limited access
      return {
        level: 'limited',
        description: 'Limited access during grace period',
        features: ['basic_features', 'limited_usage'],
        restrictions: ['no_new_projects', 'reduced_limits']
      };

    case 'suspended':
    case 'unpaid':
      return {
        level: 'restricted',
        description: 'Access suspended due to payment issues',
        features: ['view_only'],
        restrictions: ['no_new_content', 'no_exports', 'no_api_access']
      };

    case 'expired':
    case 'incomplete':
    case 'unknown':
    default:
      return {
        level: 'none',
        description: 'No subscription access',
        features: ['free_tier_only'],
        restrictions: ['all_premium_features_disabled']
      };
  }
};

// Process webhook events (called from the dedicated webhook function)
const processWebhookEvent = async (event) => {
  console.log('Processing webhook event:', event.type);

  try {
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'customer.subscription.created':
        console.log('Subscription created:', event.data.object.id);
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.created':
        console.log('Subscription created:', event.data.object.id);
        // Handle new subscription creation if needed
        break;

      case 'invoice.created':
        console.log('Invoice created:', event.data.object.id);
        await handleInvoiceCreated(event.data.object);
        break;

      case 'invoice.finalized':
        console.log('Invoice finalized:', event.data.object.id);
        await handleInvoiceFinalized(event.data.object);
        break;

      case 'payment_method.attached':
        console.log('Payment method attached:', event.data.object.id);
        await handlePaymentMethodAttached(event.data.object);
        break;

      case 'payment_method.detached':
        console.log('Payment method detached:', event.data.object.id);
        await handlePaymentMethodDetached(event.data.object);
        break;

      case 'customer.updated':
        console.log('Customer updated:', event.data.object.id);
        await handleCustomerUpdated(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`Error processing ${event.type} event:`, error);
    throw error; // Re-throw to be handled by the webhook function
  }
};

module.exports = {
  handler,
  handleCreateCheckoutSession,
  handleWebhook,
  handleVerifySession,
  getRawBody,
  processWebhookEvent,
  // Subscription management functions
  cancelUserSubscription,
  updateSubscriptionStatus,
  determineSubscriptionStatus,
  determineAccessLevel,
  getUserSubscription,
  updateUserSubscription,
  // Payment method management functions
  handlePaymentMethodRoutes,
  getUserPaymentMethods,
  createCustomerPortalSession,
  getDefaultPaymentMethod,
  // Billing history functions
  handleBillingRoutes,
  getUserBillingHistory,
  getUpcomingInvoice,
  getSpecificInvoice,
  getInvoiceDownloadUrl
};
