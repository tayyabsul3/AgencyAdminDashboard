// Enhanced Firestore schema for subscription management
// This file defines the structure and validation for subscription-related documents

/**
 * Subscription Document Schema
 * Collection: subscriptions
 * Document ID: userId (Firebase Auth UID)
 */
export const subscriptionSchema = {
  // Core subscription fields
  stripeSubscriptionId: 'string', // Stripe subscription ID
  stripeCustomerId: 'string', // Stripe customer ID
  status: 'string', // active, trial, cancelled, past_due, unpaid, suspended, expired, incomplete, incomplete_expired
  tier: 'string', // starter, pro, business, enterprise
  billingCycle: 'string', // monthly, yearly
  
  // Pricing and billing
  amount: 'number', // Amount in cents
  currency: 'string', // Currency code (USD, EUR, etc.)
  
  // Period information
  currentPeriodStart: 'timestamp',
  currentPeriodEnd: 'timestamp',
  trialStart: 'timestamp', // Optional
  trialEnd: 'timestamp', // Optional
  
  // Credits system
  credits: 'number', // Total credits for current period
  creditsUsed: 'number', // Credits used in current period
  creditsResetDate: 'timestamp', // When credits reset
  
  // Cancellation tracking
  cancelledAt: 'timestamp', // Optional - when subscription was cancelled
  cancellationReason: 'string', // Optional - reason for cancellation
  cancellationFeedback: 'string', // Optional - user feedback
  cancelAtPeriodEnd: 'boolean', // Whether to cancel at period end
  
  // Plan change tracking
  pendingPlanChange: 'object', // Optional - details of pending plan change
  planChangeHistory: 'array', // Array of plan change records
  
  // Payment tracking
  lastPaymentDate: 'timestamp', // Optional
  nextPaymentDate: 'timestamp', // Optional
  paymentFailureCount: 'number', // Number of consecutive payment failures
  graceExpiresAt: 'timestamp', // Optional - when grace period expires
  
  // Access control
  accessLevel: 'object', // { level: 'premium', features: [...] }
  
  // Metadata
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
  lastSyncedAt: 'timestamp', // Last sync with Stripe
  
  // Additional tracking
  source: 'string', // How subscription was created (web, mobile, admin)
  metadata: 'object' // Additional custom metadata
};

/**
 * Billing History Document Schema
 * Collection: billing_history
 * Document ID: auto-generated
 */
export const billingHistorySchema = {
  userId: 'string', // Reference to user
  stripeInvoiceId: 'string', // Stripe invoice ID
  stripeSubscriptionId: 'string', // Associated subscription
  
  // Invoice details
  number: 'string', // Invoice number
  description: 'string', // Invoice description
  amount: 'number', // Amount in cents
  currency: 'string', // Currency code
  status: 'string', // paid, open, void, draft
  
  // Dates
  invoiceDate: 'timestamp',
  dueDate: 'timestamp',
  paidAt: 'timestamp', // Optional
  
  // Payment method used
  paymentMethod: 'object', // { type, brand, last4, expMonth, expYear }
  
  // URLs
  hostedInvoiceUrl: 'string', // Stripe hosted invoice URL
  invoicePdf: 'string', // PDF download URL
  
  // Metadata
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

/**
 * Payment Methods Document Schema
 * Collection: payment_methods
 * Document ID: auto-generated
 */
export const paymentMethodSchema = {
  userId: 'string', // Reference to user
  stripePaymentMethodId: 'string', // Stripe payment method ID
  stripeCustomerId: 'string', // Stripe customer ID
  
  // Payment method details
  type: 'string', // card, bank_account, etc.
  isDefault: 'boolean', // Whether this is the default payment method
  
  // Card details (if type is card)
  card: 'object', // { brand, last4, expMonth, expYear, country }
  
  // Status
  status: 'string', // active, expired, requires_action
  
  // Metadata
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
  lastUsedAt: 'timestamp' // Optional
};

/**
 * Subscription Events Document Schema
 * Collection: subscription_events
 * Document ID: auto-generated
 */
export const subscriptionEventsSchema = {
  userId: 'string', // Reference to user
  stripeSubscriptionId: 'string', // Associated subscription
  eventType: 'string', // created, updated, cancelled, reactivated, plan_changed, payment_failed, etc.
  
  // Event data
  previousState: 'object', // Previous subscription state
  newState: 'object', // New subscription state
  changes: 'array', // Array of changed fields
  
  // Context
  source: 'string', // webhook, api, admin, user
  triggeredBy: 'string', // user_id or system
  
  // Metadata
  createdAt: 'timestamp',
  stripeEventId: 'string', // Optional - Stripe webhook event ID
  metadata: 'object' // Additional event metadata
};

// Validation functions
export const validateSubscriptionData = (data) => {
  const errors = [];
  
  // Required fields
  if (!data.stripeSubscriptionId) errors.push('stripeSubscriptionId is required');
  if (!data.stripeCustomerId) errors.push('stripeCustomerId is required');
  if (!data.status) errors.push('status is required');
  if (!data.tier) errors.push('tier is required');
  
  // Valid status values
  const validStatuses = ['active', 'trial', 'cancelled', 'past_due', 'unpaid', 'suspended', 'expired', 'incomplete', 'incomplete_expired'];
  if (data.status && !validStatuses.includes(data.status)) {
    errors.push(`Invalid status: ${data.status}`);
  }
  
  // Valid tier values
  const validTiers = ['starter', 'pro', 'business', 'enterprise', 'client'];
  if (data.tier && !validTiers.includes(data.tier)) {
    errors.push(`Invalid tier: ${data.tier}`);
  }
  
  // Valid billing cycle values
  const validBillingCycles = ['monthly', 'yearly'];
  if (data.billingCycle && !validBillingCycles.includes(data.billingCycle)) {
    errors.push(`Invalid billingCycle: ${data.billingCycle}`);
  }
  
  // Numeric validations
  if (data.amount !== undefined && (typeof data.amount !== 'number' || data.amount < 0)) {
    errors.push('amount must be a non-negative number');
  }
  
  if (data.credits !== undefined && (typeof data.credits !== 'number' || data.credits < 0)) {
    errors.push('credits must be a non-negative number');
  }
  
  if (data.creditsUsed !== undefined && (typeof data.creditsUsed !== 'number' || data.creditsUsed < 0)) {
    errors.push('creditsUsed must be a non-negative number');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Default values for new subscriptions
export const getDefaultSubscriptionData = (userId, stripeData = {}) => {
  const now = new Date();
  
  return {
    stripeSubscriptionId: stripeData.id || '',
    stripeCustomerId: stripeData.customer || '',
    status: stripeData.status || 'incomplete',
    tier: 'starter',
    billingCycle: 'monthly',
    
    amount: stripeData.amount || 0,
    currency: stripeData.currency || 'usd',
    
    currentPeriodStart: stripeData.current_period_start ? new Date(stripeData.current_period_start * 1000) : now,
    currentPeriodEnd: stripeData.current_period_end ? new Date(stripeData.current_period_end * 1000) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    
    credits: 1000, // Default starter credits
    creditsUsed: 0,
    creditsResetDate: stripeData.current_period_end ? new Date(stripeData.current_period_end * 1000) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    
    cancelAtPeriodEnd: false,
    planChangeHistory: [],
    paymentFailureCount: 0,
    
    accessLevel: {
      level: 'starter',
      features: ['basic_articles', 'email_support', '1000_credits']
    },
    
    createdAt: now,
    updatedAt: now,
    lastSyncedAt: now,
    source: 'web',
    metadata: {}
  };
};

/**
 * Brand Voice Settings Schema
 * Stored in user profile document (email collection)
 */
export const brandVoiceSettingsSchema = {
  enabled: 'boolean', // Whether brand voice is enabled
  preferredTerms: 'array', // Array of preferred terms/phrases
  bannedPhrases: 'array', // Array of banned terms/phrases
  defaultDisclaimer: 'string', // Default disclaimer text
  industry: 'string', // Industry preset (general, spiritual, healthcare, etc.)
  customInstructions: 'string', // Custom tone/style instructions
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

/**
 * Brand Voice Tier Configurations
 * Defines what brand voice features are available per tier
 */
export const brandVoiceTierConfigurations = {
  free: {
    canUseBrandVoice: false,
    maxPreferredTerms: 0,
    maxBannedPhrases: 0,
    canUseDisclaimer: false,
    canUseCustomInstructions: false,
    availableIndustries: ['general'],
    features: []
  },
  starter: {
    canUseBrandVoice: false,
    maxPreferredTerms: 0,
    maxBannedPhrases: 0,
    canUseDisclaimer: false,
    canUseCustomInstructions: false,
    availableIndustries: ['general'],
    features: []
  },
  growth: {
    canUseBrandVoice: true,
    maxPreferredTerms: 10,
    maxBannedPhrases: 10,
    canUseDisclaimer: true,
    canUseCustomInstructions: false,
    availableIndustries: ['general', 'business', 'education'],
    features: ['basic_brand_voice', 'preferred_terms', 'banned_phrases', 'disclaimers']
  },
  scale: {
    canUseBrandVoice: true,
    maxPreferredTerms: 25,
    maxBannedPhrases: 25,
    canUseDisclaimer: true,
    canUseCustomInstructions: true,
    availableIndustries: ['general', 'business', 'education', 'spiritual', 'healthcare', 'legal', 'finance'],
    features: ['full_brand_voice', 'preferred_terms', 'banned_phrases', 'disclaimers', 'custom_instructions', 'industry_presets']
  },
  agency: {
    canUseBrandVoice: true,
    maxPreferredTerms: 50,
    maxBannedPhrases: 50,
    canUseDisclaimer: true,
    canUseCustomInstructions: true,
    availableIndustries: ['general', 'business', 'education', 'spiritual', 'healthcare', 'legal', 'finance', 'custom'],
    features: ['enterprise_brand_voice', 'unlimited_terms', 'unlimited_phrases', 'disclaimers', 'custom_instructions', 'industry_presets', 'custom_presets']
  },
  entryagency: {
    canUseBrandVoice: true,
    maxPreferredTerms: 25,
    maxBannedPhrases: 25,
    canUseDisclaimer: true,
    canUseCustomInstructions: true,
    availableIndustries: ['general', 'business', 'education', 'spiritual', 'healthcare', 'legal', 'finance'],
    features: ['full_brand_voice', 'preferred_terms', 'banned_phrases', 'disclaimers', 'custom_instructions', 'industry_presets']
  },
  client: {
    canUseBrandVoice: true,
    maxPreferredTerms: 15,
    maxBannedPhrases: 15,
    canUseDisclaimer: true,
    canUseCustomInstructions: false,
    availableIndustries: ['general', 'business', 'education', 'spiritual', 'healthcare'],
    features: ['agency_client_brand_voice', 'preferred_terms', 'banned_phrases', 'disclaimers', 'industry_presets']
  }
};

/**
 * Industry Preset Configurations
 * Predefined brand voice settings for different industries
 */
export const industryPresets = {
  general: {
    name: 'General Business',
    description: 'Professional, clear, and accessible language',
    preferredTerms: ['professional', 'effective', 'solution', 'strategy', 'optimize'],
    bannedPhrases: [],
    defaultDisclaimer: '',
    customInstructions: 'Use professional, clear language that is accessible to a general business audience.'
  },
  spiritual: {
    name: 'Spiritual & Wellness',
    description: 'Reflective, empowering, non-clinical language',
    preferredTerms: ['capacity', 'sacred pause', 'story-based recovery', 'mindful awareness', 'inner wisdom', 'transformation', 'journey', 'practice', 'reflection'],
    bannedPhrases: ['treat', 'heal trauma', 'clinical outcomes', 'therapy', 'cure', 'diagnose', 'medical treatment', 'therapeutic intervention'],
    defaultDisclaimer: 'This content is for reflective and educational purposes only and is not a substitute for professional therapy, medical treatment, or mental health services.',
    customInstructions: 'Use reflective, empowering language that focuses on personal capacity and growth. Avoid medical or therapeutic claims. Frame content as supportive practices rather than treatments.'
  },
  healthcare: {
    name: 'Healthcare & Medical',
    description: 'Evidence-based, professional medical language',
    preferredTerms: ['evidence-based', 'clinical research', 'peer-reviewed', 'medical professional', 'healthcare provider', 'treatment protocol'],
    bannedPhrases: ['cure', 'miracle', 'guaranteed results', 'instant healing'],
    defaultDisclaimer: 'This information is for educational purposes only and should not replace professional medical advice. Always consult with a qualified healthcare provider.',
    customInstructions: 'Use evidence-based language with appropriate medical terminology. Include relevant disclaimers and emphasize the importance of professional medical consultation.'
  },
  business: {
    name: 'Business & Corporate',
    description: 'Professional, results-oriented language',
    preferredTerms: ['ROI', 'strategic', 'optimize', 'efficiency', 'scalable', 'data-driven', 'performance metrics'],
    bannedPhrases: ['guaranteed success', 'get rich quick', 'overnight results'],
    defaultDisclaimer: 'Results may vary based on individual circumstances and market conditions.',
    customInstructions: 'Use professional business language with focus on measurable outcomes and strategic thinking. Avoid overpromising results.'
  },
  education: {
    name: 'Education & Learning',
    description: 'Clear, instructional, accessible language',
    preferredTerms: ['learning objective', 'skill development', 'knowledge base', 'educational resource', 'best practices'],
    bannedPhrases: ['easy', 'simple', 'anyone can do it'],
    defaultDisclaimer: 'Educational content requires practice and dedication to master.',
    customInstructions: 'Use clear, instructional language that acknowledges the learning process and individual differences in comprehension.'
  },
  legal: {
    name: 'Legal & Compliance',
    description: 'Precise, compliant, professional language',
    preferredTerms: ['compliance', 'regulatory', 'legal framework', 'due diligence', 'best practices'],
    bannedPhrases: ['legal advice', 'guaranteed outcome', 'foolproof'],
    defaultDisclaimer: 'This information is for general educational purposes only and does not constitute legal advice. Consult with a qualified attorney for specific legal matters.',
    customInstructions: 'Use precise, compliant language. Always include appropriate disclaimers and emphasize the need for professional legal consultation.'
  },
  finance: {
    name: 'Finance & Investment',
    description: 'Professional financial language with risk awareness',
    preferredTerms: ['financial planning', 'risk assessment', 'diversification', 'due diligence', 'market analysis'],
    bannedPhrases: ['guaranteed returns', 'risk-free', 'get rich quick', 'sure thing'],
    defaultDisclaimer: 'This information is for educational purposes only and does not constitute financial advice. Past performance does not guarantee future results. Consult with a qualified financial advisor.',
    customInstructions: 'Use professional financial language with appropriate risk disclosures. Emphasize the importance of professional financial consultation and due diligence.'
  }
};

// Tier configurations (updated with brand voice features)
export const tierConfigurations = {
  starter: {
    credits: 1000,
    features: ['basic_articles', 'email_support', '1000_credits'],
    brandVoice: brandVoiceTierConfigurations.starter,
    limits: {
      articles_per_month: 50,
      api_calls_per_day: 100
    }
  },
  pro: {
    credits: 3000,
    features: ['advanced_articles', 'priority_support', 'custom_templates', 'analytics', '3000_credits'],
    brandVoice: brandVoiceTierConfigurations.growth,
    limits: {
      articles_per_month: 200,
      api_calls_per_day: 500
    }
  },
  business: {
    credits: 10000,
    features: ['unlimited_articles', 'phone_support', 'advanced_analytics', 'api_access', '10000_credits'],
    brandVoice: brandVoiceTierConfigurations.scale,
    limits: {
      articles_per_month: -1, // unlimited
      api_calls_per_day: 2000
    }
  },
  enterprise: {
    credits: -1, // unlimited
    features: ['everything_business', 'dedicated_manager', 'custom_training', 'white_label', 'unlimited_credits'],
    brandVoice: brandVoiceTierConfigurations.agency,
    limits: {
      articles_per_month: -1, // unlimited
      api_calls_per_day: -1 // unlimited
    }
  },
  client: {
    credits: 0, // Credits come from agency
    features: ['agency_articles', 'agency_support', 'shared_credits', 'brand_voice'],
    brandVoice: brandVoiceTierConfigurations.client,
    limits: {
      articles_per_month: -1, // unlimited (limited by agency credits)
      api_calls_per_day: 1000
    }
  },
  // Add missing tiers from your Firestore data
  growth: {
    credits: 2000,
    features: ['growth_articles', 'priority_support', 'brand_voice', '2000_credits'],
    brandVoice: brandVoiceTierConfigurations.growth,
    limits: {
      articles_per_month: 100,
      api_calls_per_day: 300
    }
  },
  scale: {
    credits: 5000,
    features: ['scale_articles', 'phone_support', 'full_brand_voice', 'analytics', '5000_credits'],
    brandVoice: brandVoiceTierConfigurations.scale,
    limits: {
      articles_per_month: 500,
      api_calls_per_day: 1000
    }
  },
  agency: {
    credits: 10000,
    features: ['agency_articles', 'dedicated_support', 'enterprise_brand_voice', 'white_label', '10000_credits'],
    brandVoice: brandVoiceTierConfigurations.agency,
    limits: {
      articles_per_month: -1, // unlimited
      api_calls_per_day: -1 // unlimited
    }
  },
  entryagency: {
    credits: 5000,
    features: ['entry_agency_articles', 'priority_support', 'full_brand_voice', '5000_credits'],
    brandVoice: brandVoiceTierConfigurations.entryagency,
    limits: {
      articles_per_month: 300,
      api_calls_per_day: 800
    }
  }
};

/**
 * Validate brand voice settings against schema and tier limits
 * @param {Object} settings - Brand voice settings to validate
 * @param {string} tier - User's subscription tier
 * @returns {Object} Validation result
 */
export const validateBrandVoiceSettings = (settings, tier) => {
  const errors = [];
  const tierConfig = brandVoiceTierConfigurations[tier?.toLowerCase()] || brandVoiceTierConfigurations.free;

  // Check if tier allows brand voice
  if (!tierConfig.canUseBrandVoice && settings.enabled) {
    errors.push(`Brand voice is not available for ${tier} plan. Upgrade to Growth or higher.`);
  }

  // Validate preferred terms
  if (settings.preferredTerms && Array.isArray(settings.preferredTerms)) {
    if (settings.preferredTerms.length > tierConfig.maxPreferredTerms) {
      errors.push(`Too many preferred terms. Your ${tier} plan allows up to ${tierConfig.maxPreferredTerms} terms.`);
    }
    
    // Validate each term
    settings.preferredTerms.forEach((term, index) => {
      if (typeof term !== 'string' || term.trim().length === 0) {
        errors.push(`Preferred term ${index + 1} must be a non-empty string.`);
      } else if (term.length > 100) {
        errors.push(`Preferred term ${index + 1} is too long (max 100 characters).`);
      }
    });
  }

  // Validate banned phrases
  if (settings.bannedPhrases && Array.isArray(settings.bannedPhrases)) {
    if (settings.bannedPhrases.length > tierConfig.maxBannedPhrases) {
      errors.push(`Too many banned phrases. Your ${tier} plan allows up to ${tierConfig.maxBannedPhrases} phrases.`);
    }
    
    // Validate each phrase
    settings.bannedPhrases.forEach((phrase, index) => {
      if (typeof phrase !== 'string' || phrase.trim().length === 0) {
        errors.push(`Banned phrase ${index + 1} must be a non-empty string.`);
      } else if (phrase.length > 100) {
        errors.push(`Banned phrase ${index + 1} is too long (max 100 characters).`);
      }
    });
  }

  // Validate disclaimer
  if (settings.defaultDisclaimer && !tierConfig.canUseDisclaimer) {
    errors.push(`Custom disclaimers are not available for ${tier} plan. Upgrade to Growth or higher.`);
  } else if (settings.defaultDisclaimer && settings.defaultDisclaimer.length > 500) {
    errors.push('Default disclaimer is too long (max 500 characters).');
  }

  // Validate custom instructions
  if (settings.customInstructions && !tierConfig.canUseCustomInstructions) {
    errors.push(`Custom instructions are not available for ${tier} plan. Upgrade to Scale or higher.`);
  } else if (settings.customInstructions && settings.customInstructions.length > 1000) {
    errors.push('Custom instructions are too long (max 1000 characters).');
  }

  // Validate industry
  if (settings.industry && !tierConfig.availableIndustries.includes(settings.industry)) {
    errors.push(`Industry "${settings.industry}" is not available for ${tier} plan.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    tierConfig
  };
};