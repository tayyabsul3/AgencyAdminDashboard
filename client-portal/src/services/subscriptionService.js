// Enhanced Subscription management service for handling Stripe subscriptions
// This service manages user subscriptions with comprehensive error handling and response parsing

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://us-central1-lead-generation-6cf0f.cloudfunctions.net/api';

// Response parsing utilities
const parseApiResponse = async (response) => {
  try {
    const data = await response.json();
    return {
      success: response.ok,
      data: response.ok ? data : null,
      error: response.ok ? null : (data.error || { message: 'API request failed' }),
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: { message: 'Failed to parse response', details: error.message },
      status: response.status,
      statusText: response.statusText
    };
  }
};

// Enhanced error handling
const handleApiError = (error, operation) => {
  console.error(`Error in ${operation}:`, error);
  
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return {
      success: false,
      error: { 
        message: 'Network connection failed. Please check your internet connection.',
        type: 'network_error',
        operation
      }
    };
  }
  
  return {
    success: false,
    error: { 
      message: error.message || 'An unexpected error occurred',
      type: 'unknown_error',
      operation
    }
  };
};

export class SubscriptionService {
  /**
   * Get user's current subscription with enhanced error handling
   * @param {string} userId - Firebase user ID
   * @returns {Promise<Object>} Enhanced subscription response with success/error status
   */
  static async getUserSubscription(userId) {
    try {
      if (!userId) {
        return {
          success: false,
          error: { message: 'User ID is required', type: 'validation_error' }
        };
      }

      const response = await fetch(`${API_BASE_URL}/subscription/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await parseApiResponse(response);
      
      if (result.success) {
        return {
          success: true,
          subscription: result.data?.subscription || null,
          metadata: {
            lastFetched: new Date().toISOString(),
            source: 'api'
          }
        };
      }

      return result;
    } catch (error) {
      return handleApiError(error, 'getUserSubscription');
    }
  }



  /**
   * Check if user has active subscription with detailed status
   * @param {string} userId - Firebase user ID
   * @returns {Promise<Object>} Enhanced subscription status check
   */
  static async hasActiveSubscription(userId) {
    try {
      const result = await this.getUserSubscription(userId);
      
      if (!result.success) {
        return {
          success: false,
          isActive: false,
          error: result.error
        };
      }

      const subscription = result.subscription;
      const isActive = subscription && ['active', 'trial'].includes(subscription.status);
      
      return {
        success: true,
        isActive,
        status: subscription?.status || 'inactive',
        subscription: subscription,
        metadata: {
          checkedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return handleApiError(error, 'hasActiveSubscription');
    }
  }

  /**
   * Get subscription status with detailed information
   * @param {string} userId - Firebase user ID
   * @returns {Promise<Object>} Detailed subscription status
   */
  static async getDetailedSubscriptionStatus(userId) {
    try {
      const result = await this.getSubscriptionStatus(userId);
      
      if (!result.success) {
        return result;
      }

      // Enhance status with additional computed fields
      const status = result.status;
      const subscription = result.subscription;
      
      return {
        ...result,
        computed: {
          isActive: ['active', 'trial'].includes(status),
          isPastDue: status === 'past_due',
          isCancelled: status === 'cancelled',
          isExpired: status === 'expired',
          needsAttention: ['past_due', 'unpaid', 'incomplete'].includes(status),
          canReactivate: ['cancelled', 'expired'].includes(status),
          canCancel: ['active', 'trial'].includes(status),
          daysUntilExpiry: subscription?.currentPeriodEnd ? 
            Math.ceil((new Date(subscription.currentPeriodEnd) - new Date()) / (1000 * 60 * 60 * 24)) : null
        }
      };
    } catch (error) {
      return handleApiError(error, 'getDetailedSubscriptionStatus');
    }
  }

  /**
   * Get user's subscription tier
   * @param {string} userId - Firebase user ID
   * @returns {Promise<string|null>} Subscription tier or null
   */
  static async getUserTier(userId) {
    const subscription = await this.getUserSubscription(userId);
    return subscription ? subscription.tier : null;
  }

  /**
   * Check if user can access a feature based on their subscription
   * @param {string} userId - Firebase user ID
   * @param {string} feature - Feature to check access for
   * @returns {Promise<boolean>} Whether user can access the feature
   */
  static async canAccessFeature(userId, feature) {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription || subscription.status !== 'active') {
      return false;
    }

    // Define feature access by tier
    const tierFeatures = {
      starter: ['basic_articles', 'email_support'],
      pro: ['advanced_articles', 'priority_support', 'custom_templates', 'analytics'],
      business: ['unlimited_articles', 'phone_support', 'advanced_analytics', 'api_access'],
      enterprise: ['everything_business', 'dedicated_manager', 'custom_training', 'white_label'],
      client: ['agency_articles', 'agency_support', 'shared_credits', 'agency_management']
    };

    const userFeatures = tierFeatures[subscription.tier.toLowerCase()] || [];
    return userFeatures.includes(feature);
  }

  /**
   * Get comprehensive subscription status
   * @param {string} userId - Firebase user ID
   * @returns {Promise<Object>} Comprehensive status information
   */
  static async getSubscriptionStatus(userId) {
    try {
      const response = await fetch(`${API_BASE_URL}/stripe/subscription/${userId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        return {
          success: data.success,
          status: data.status,
          statusDetails: data.statusDetails,
          subscription: data.subscription,
          lastUpdated: data.lastUpdated
        };
      }

      return {
        success: false,
        error: data.error || { message: 'Failed to get subscription status' }
      };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return {
        success: false,
        error: { message: error.message || 'Network error occurred' }
      };
    }
  }



  /**
   * Get billing history with enhanced pagination and filtering
   * @param {string} userId - Firebase user ID
   * @param {Object} options - Query options (limit, startingAfter, status, dateRange)
   * @returns {Promise<Object>} Enhanced billing history
   */
  static async getBillingHistory(userId, options = {}) {
    try {
      if (!userId) {
        return {
          success: false,
          error: { message: 'User ID is required', type: 'validation_error' }
        };
      }

      // Validate and sanitize options
      const validatedOptions = {
        limit: Math.min(Math.max(parseInt(options.limit) || 10, 1), 100),
        startingAfter: options.startingAfter || null,
        status: options.status || null,
        dateRange: options.dateRange || null
      };

      const queryParams = new URLSearchParams();
      Object.entries(validatedOptions).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          queryParams.append(key, value);
        }
      });

      const response = await fetch(`${API_BASE_URL}/stripe/billing/${userId}/invoices?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await parseApiResponse(response);
      
      if (result.success) {
        const billingHistory = result.data?.billingHistory || {};
        
        return {
          success: true,
          billingHistory: {
            ...billingHistory,
            invoices: (billingHistory.invoices || []).map(invoice => ({
              ...invoice,
              formattedAmount: this.formatCurrency(invoice.amount, invoice.currency),
              formattedDate: this.formatDate(invoice.invoiceDate),
              isOverdue: invoice.status === 'open' && new Date(invoice.dueDate) < new Date()
            }))
          },
          metadata: {
            fetchedAt: new Date().toISOString(),
            options: validatedOptions
          }
        };
      }

      return result;
    } catch (error) {
      return handleApiError(error, 'getBillingHistory');
    }
  }

  /**
   * Download invoice PDF
   * @param {string} userId - Firebase user ID
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object>} Download result
   */
  static async downloadInvoice(userId, invoiceId) {
    try {
      if (!userId || !invoiceId) {
        return {
          success: false,
          error: { message: 'User ID and Invoice ID are required', type: 'validation_error' }
        };
      }

      const response = await fetch(`${API_BASE_URL}/stripe/billing/${userId}/invoices/${invoiceId}/pdf`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        return {
          success: true,
          blob,
          filename: `invoice-${invoiceId}.pdf`,
          metadata: {
            downloadedAt: new Date().toISOString(),
            size: blob.size
          }
        };
      }

      const result = await parseApiResponse(response);
      return result;
    } catch (error) {
      return handleApiError(error, 'downloadInvoice');
    }
  }

  /**
   * Get payment methods
   * @param {string} userId - Firebase user ID
   * @returns {Promise<Object>} Payment methods
   */
  static async getPaymentMethods(userId) {
    try {
      const response = await fetch(`${API_BASE_URL}/stripe/payment-method/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        return {
          success: data.success,
          paymentMethods: data.paymentMethods
        };
      }

      return {
        success: false,
        error: data.error || { message: 'Failed to get payment methods' }
      };
    } catch (error) {
      console.error('Error getting payment methods:', error);
      return {
        success: false,
        error: { message: error.message || 'Network error occurred' }
      };
    }
  }



  // Utility methods
  
  /**
   * Format currency amount
   * @param {number} amount - Amount in cents
   * @param {string} currency - Currency code
   * @returns {string} Formatted currency string
   */
  static formatCurrency(amount, currency = 'USD') {
    if (!amount || isNaN(amount)) return 'N/A';
    
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase()
      }).format(amount / 100);
    } catch (error) {
      return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
    }
  }

  /**
   * Format date
   * @param {string|Date} date - Date to format
   * @returns {string} Formatted date string
   */
  static formatDate(date) {
    if (!date) return 'N/A';
    
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  }

  /**
   * Validate URL
   * @param {string} url - URL to validate
   * @returns {boolean} Whether URL is valid
   */
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cancel user's subscription with enhanced validation and tracking
   * @param {string} userId - Firebase user ID
   * @param {Object} cancellationData - Cancellation reason and feedback
   * @returns {Promise<Object>} Enhanced cancellation result
   */
  static async cancelUserSubscription(userId, cancellationData = {}) {
    try {
      if (!userId) {
        return {
          success: false,
          error: { message: 'User ID is required', type: 'validation_error' }
        };
      }

      // Validate cancellation data
      const validatedData = {
        reason: cancellationData.reason || 'other',
        feedback: cancellationData.feedback || '',
        cancelledAt: new Date().toISOString(),
        ...cancellationData
      };

      const response = await fetch(`${API_BASE_URL}/stripe/subscription/${userId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validatedData),
      });

      const result = await parseApiResponse(response);
      
      if (result.success) {
        return {
          success: true,
          message: result.data?.message || 'Subscription cancelled successfully',
          data: result.data,
          metadata: {
            cancelledAt: validatedData.cancelledAt,
            reason: validatedData.reason,
            operation: 'cancellation'
          }
        };
      }

      return result;
    } catch (error) {
      return handleApiError(error, 'cancelUserSubscription');
    }
  }

  /**
   * Calculate custom proration for plan change
   * @param {string} userId - Firebase user ID
   * @param {string} newTier - New subscription tier
   * @param {string} newBillingCycle - New billing cycle
   * @returns {Promise<Object>} Proration calculation result
   */
  static async calculateProration(userId, newTier, newBillingCycle) {
    try {
      if (!userId || !newTier || !newBillingCycle) {
        return {
          success: false,
          error: { message: 'User ID, new tier, and billing cycle are required', type: 'validation_error' }
        };
      }

      const queryParams = new URLSearchParams({
        newTier: newTier.toLowerCase(),
        newBillingCycle: newBillingCycle.toLowerCase()
      });

      const response = await fetch(`${API_BASE_URL}/stripe/subscription/${userId}/calculate-proration?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await parseApiResponse(response);
      
      if (result.success) {
        return {
          success: true,
          proration: result.data?.proration,
          metadata: {
            calculatedAt: new Date().toISOString(),
            operation: 'proration_calculation'
          }
        };
      }

      return result;
    } catch (error) {
      return handleApiError(error, 'calculateProration');
    }
  }

  /**
   * Initiate plan change with custom proration
   * @param {string} userId - Firebase user ID
   * @param {string} newTier - New subscription tier
   * @param {string} newBillingCycle - New billing cycle
   * @returns {Promise<Object>} Plan change initiation result
   */
  static async changePlan(userId, newTier, newBillingCycle) {
    try {
      if (!userId || !newTier || !newBillingCycle) {
        return {
          success: false,
          error: { message: 'User ID, new tier, and billing cycle are required', type: 'validation_error' }
        };
      }

      const response = await fetch(`${API_BASE_URL}/stripe/subscription/${userId}/change-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newTier: newTier.toLowerCase(),
          newBillingCycle: newBillingCycle.toLowerCase()
        }),
      });

      const result = await parseApiResponse(response);
      
      if (result.success) {
        return {
          success: true,
          checkoutUrl: result.data?.checkoutUrl,
          sessionId: result.data?.sessionId,
          prorationDetails: result.data?.prorationDetails,
          metadata: {
            initiatedAt: new Date().toISOString(),
            operation: 'plan_change'
          }
        };
      }

      return result;
    } catch (error) {
      return handleApiError(error, 'changePlan');
    }
  }

  /**
   * Get subscription tier features
   * @param {string} tier - Subscription tier
   * @returns {Array} Array of features for the tier
   */
  static getTierFeatures(tier) {
    const tierFeatures = {
      starter: ['basic_articles', 'email_support', '1000_credits'],
      pro: ['advanced_articles', 'priority_support', 'custom_templates', 'analytics', '3000_credits'],
      business: ['unlimited_articles', 'phone_support', 'advanced_analytics', 'api_access', '10000_credits'],
      enterprise: ['everything_business', 'dedicated_manager', 'custom_training', 'white_label', 'unlimited_credits'],
      client: ['agency_articles', 'agency_support', 'shared_credits', 'agency_management']
    };

    return tierFeatures[tier?.toLowerCase()] || [];
  }

  /**
   * Calculate subscription metrics
   * @param {Object} subscription - Subscription object
   * @returns {Object} Calculated metrics
   */
  static calculateSubscriptionMetrics(subscription) {
    if (!subscription) return null;

    const now = new Date();
    const currentPeriodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
    const trialEnd = subscription.trialEnd ? new Date(subscription.trialEnd) : null;
    
    return {
      daysUntilRenewal: currentPeriodEnd ? Math.ceil((currentPeriodEnd - now) / (1000 * 60 * 60 * 24)) : null,
      daysUntilTrialEnd: trialEnd ? Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)) : null,
      isInTrial: subscription.status === 'trial',
      creditsUsagePercentage: subscription.credits ? 
        Math.round(((subscription.creditsUsed || 0) / subscription.credits) * 100) : null,
      monthlyValue: subscription.amount ? subscription.amount / 100 : null
    };
  }
}

// Helper functions for common subscription operations
export const getSubscriptionStatus = (userId) => SubscriptionService.getSubscriptionStatus(userId);
export const getDetailedSubscriptionStatus = (userId) => SubscriptionService.getDetailedSubscriptionStatus(userId);
export const getUserSubscription = (userId) => SubscriptionService.getUserSubscription(userId);
export const cancelSubscription = (userId, data) => SubscriptionService.cancelUserSubscription(userId, data);
export const calculateProration = (userId, newTier, newBillingCycle) => SubscriptionService.calculateProration(userId, newTier, newBillingCycle);
export const changePlan = (userId, newTier, newBillingCycle) => SubscriptionService.changePlan(userId, newTier, newBillingCycle);
export const getBillingHistory = (userId, options) => SubscriptionService.getBillingHistory(userId, options);
export const downloadInvoice = (userId, invoiceId) => SubscriptionService.downloadInvoice(userId, invoiceId);
export const getPaymentMethods = (userId) => SubscriptionService.getPaymentMethods(userId);
export const checkSubscriptionAccess = (userId, feature) => SubscriptionService.canAccessFeature(userId, feature);
export const hasActiveSubscription = (userId) => SubscriptionService.hasActiveSubscription(userId);

// Utility exports
export const formatCurrency = (amount, currency) => SubscriptionService.formatCurrency(amount, currency);
export const formatDate = (date) => SubscriptionService.formatDate(date);
export const getTierFeatures = (tier) => SubscriptionService.getTierFeatures(tier);
export const calculateSubscriptionMetrics = (subscription) => SubscriptionService.calculateSubscriptionMetrics(subscription);

export default SubscriptionService;