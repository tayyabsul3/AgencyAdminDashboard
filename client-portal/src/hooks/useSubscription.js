'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  getDetailedSubscriptionStatus, 
  getBillingHistory, 
  getPaymentMethods,
  calculateSubscriptionMetrics,
  getTierFeatures
} from '../services/subscriptionService';
import { brandVoiceTierConfigurations } from '../lib/firestore/subscriptionSchema';

export const useSubscription = (userId, options = {}) => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [statusDetails, setStatusDetails] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [agencyData, setAgencyData] = useState(null);
  const [agencyLoading, setAgencyLoading] = useState(false);
  
  // Options with defaults - DISABLED auto-refresh to prevent continuous writes
  const {
    includeBillingHistory = false,
    includePaymentMethods = false,
    billingHistoryLimit = 10,
    autoRefresh = false, // DISABLED - was causing continuous Firestore writes
    refreshInterval = 300000 // 5 minutes if enabled
  } = options;

  // Enhanced data fetching function
  const fetchSubscriptionData = useCallback(async () => {
    if (!userId) return;

    try {
      setError(null);
      
      // Fetch detailed subscription status
      const statusResult = await getDetailedSubscriptionStatus(userId);
      if (statusResult.success) {
        setStatusDetails(statusResult);
        setLastUpdated(new Date().toISOString());
      } else {
        setError(statusResult.error?.message || 'Failed to fetch subscription status');
      }

      // Fetch billing history if requested
      if (includeBillingHistory) {
        const billingResult = await getBillingHistory(userId, { limit: billingHistoryLimit });
        if (billingResult.success) {
          setBillingHistory(billingResult.billingHistory?.invoices || []);
        }
      }

      // Fetch payment methods if requested
      if (includePaymentMethods) {
        const paymentResult = await getPaymentMethods(userId);
        if (paymentResult.success) {
          setPaymentMethods(paymentResult.paymentMethods?.paymentMethods || []);
        }
      }
    } catch (err) {
      console.error('Error fetching subscription data:', err);
      setError(err.message || 'Failed to fetch subscription data');
    }
  }, [userId, includeBillingHistory, includePaymentMethods, billingHistoryLimit]);

  // Initial data fetch (runs only once)
  useEffect(() => {
    if (userId && (includeBillingHistory || includePaymentMethods)) {
      fetchSubscriptionData();
    }
  }, [userId, includeBillingHistory, includePaymentMethods]); // Only on initial load

  // Firestore real-time listener for subscription document
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const subscriptionRef = doc(db, 'subscriptions', userId);

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      subscriptionRef,
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          const processedSubscription = {
            ...data,
            id: doc.id,
            // Convert Firestore timestamps to Date objects
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
            currentPeriodStart: data.currentPeriodStart?.toDate?.() || new Date(data.currentPeriodStart),
            currentPeriodEnd: data.currentPeriodEnd?.toDate?.() || new Date(data.currentPeriodEnd),
            cancelledAt: data.cancelledAt?.toDate?.() || (data.cancelledAt ? new Date(data.cancelledAt) : null),
            trialEnd: data.trialEnd?.toDate?.() || (data.trialEnd ? new Date(data.trialEnd) : null)
          };
          
          setSubscription(processedSubscription);
          
          // REMOVED: fetchSubscriptionData() call that was causing continuous writes
          // Additional data should only be fetched on initial load or manual refresh
        } else {
          setSubscription(null);
          setStatusDetails(null);
          setBillingHistory([]);
          setPaymentMethods([]);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to subscription:', err);
        setError(err.message);
        setSubscription(null);
        setStatusDetails(null);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount or userId change
    return unsubscribe;
  }, [userId]); // Removed fetchSubscriptionData dependency to prevent re-creating listener

  // Agency data listener for client tier users
  useEffect(() => {
    if (!subscription || subscription.tier !== 'client' || !subscription.agencyId) {
      setAgencyData(null);
      setAgencyLoading(false);
      return;
    }

    setAgencyLoading(true);
    const agencyRef = doc(db, 'agencies', subscription.agencyId);

    const unsubscribeAgency = onSnapshot(
      agencyRef,
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          const processedAgency = {
            ...data,
            id: doc.id,
            // Convert Firestore timestamps to Date objects
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
          };
          setAgencyData(processedAgency);
        } else {
          setAgencyData(null);
        }
        setAgencyLoading(false);
      },
      (err) => {
        console.error('Error listening to agency data:', err);
        setAgencyData(null);
        setAgencyLoading(false);
      }
    );

    return unsubscribeAgency;
  }, [subscription?.tier, subscription?.agencyId]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || !userId) return;

    const interval = setInterval(() => {
      fetchSubscriptionData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchSubscriptionData]);

  // Manual refetch function
  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchSubscriptionData();
    setLoading(false);
  }, [fetchSubscriptionData]);

  // Computed values using useMemo for performance
  const computedValues = useMemo(() => {
    if (!subscription) {
      return {
        hasActiveSubscription: false,
        tier: 'Free',
        status: 'inactive',
        isActive: false,
        isPastDue: false,
        isCancelled: false,
        isExpired: false,
        isInTrial: false,
        needsAttention: false,
        canReactivate: false,
        canCancel: false,
        features: [],
        metrics: null,
        // Brand voice properties
        canUseBrandVoice: false,
        maxPreferredTerms: 0,
        maxBannedPhrases: 0,
        canUseDisclaimer: false,
        canUseCustomInstructions: false,
        availableIndustries: [],
        brandVoiceFeatures: []
      };
    }

    const status = subscription.status || 'inactive';
    const computed = statusDetails?.computed || {};
    const tier = subscription.tier || 'Free';
    
    // Brand voice access control
    const brandVoiceConfig = brandVoiceTierConfigurations[tier.toLowerCase()] || brandVoiceTierConfigurations.free;
    
    return {
      hasActiveSubscription: ['active', 'trial'].includes(status),
      tier,
      status,
      isActive: computed.isActive || ['active', 'trial'].includes(status),
      isPastDue: computed.isPastDue || status === 'past_due',
      isCancelled: computed.isCancelled || status === 'cancelled',
      isExpired: computed.isExpired || status === 'expired',
      isInTrial: computed.isInTrial || status === 'trial',
      needsAttention: computed.needsAttention || ['past_due', 'unpaid', 'incomplete'].includes(status),
      canReactivate: computed.canReactivate || ['cancelled', 'expired'].includes(status),
      canCancel: computed.canCancel || ['active', 'trial'].includes(status),
      features: getTierFeatures(subscription.tier),
      metrics: calculateSubscriptionMetrics(subscription),
      
      // Brand voice properties
      canUseBrandVoice: brandVoiceConfig.canUseBrandVoice,
      maxPreferredTerms: brandVoiceConfig.maxPreferredTerms,
      maxBannedPhrases: brandVoiceConfig.maxBannedPhrases,
      canUseDisclaimer: brandVoiceConfig.canUseDisclaimer,
      canUseCustomInstructions: brandVoiceConfig.canUseCustomInstructions,
      availableIndustries: brandVoiceConfig.availableIndustries,
      brandVoiceFeatures: brandVoiceConfig.features
    };
  }, [subscription, statusDetails]);

  // Billing and payment information
  const billingInfo = useMemo(() => ({
    history: billingHistory,
    hasHistory: billingHistory.length > 0,
    lastInvoice: billingHistory[0] || null,
    totalInvoices: billingHistory.length,
    paymentMethods,
    hasPaymentMethods: paymentMethods.length > 0,
    defaultPaymentMethod: paymentMethods.find(pm => pm.isDefault) || paymentMethods[0] || null
  }), [billingHistory, paymentMethods]);

  // Credits information
  const creditsInfo = useMemo(() => {
    // For client tier users, show their article limits and usage
    if (subscription?.tier === 'client') {
      const articleLimit = subscription?.articleLimit || 0;
      const articlesGenerated = subscription?.articlesGenerated || 0;
      const remainingArticles = Math.max(0, articleLimit - articlesGenerated);
      const usagePercentage = articleLimit > 0 ? Math.round((articlesGenerated / articleLimit) * 100) : 0;
      
      return {
        total: articleLimit,
        used: articlesGenerated,
        remaining: remainingArticles,
        usagePercentage: usagePercentage,
        resetDate: subscription?.creditsResetDate || null,
        isLowOnCredits: usagePercentage >= 80,
        isOutOfCredits: remainingArticles <= 0,
        isAgencyCredits: false,
        isClientLimit: true,
        agencyName: agencyData?.agencyName || agencyData?.name || 'Agency'
      };
    }
    
    // Default behavior for non-client users
    const credits = subscription?.credits || 0;
    const creditsUsed = subscription?.creditsUsed || 0;
    const creditsRemaining = credits - creditsUsed;
    const usagePercentage = credits > 0 ? Math.round((creditsUsed / credits) * 100) : 0;
    
    return {
      total: credits,
      used: creditsUsed,
      remaining: creditsRemaining,
      usagePercentage,
      resetDate: subscription?.creditsResetDate || null,
      isLowOnCredits: usagePercentage >= 80,
      isOutOfCredits: creditsRemaining <= 0,
      isAgencyCredits: false,
      agencyName: null
    };
  }, [subscription, agencyData]);

  // Cancellation information
  const cancellationInfo = useMemo(() => {
    if (!subscription?.cancelledAt) {
      return {
        isCancelled: false,
        cancelledAt: null,
        cancellationReason: null,
        accessUntil: null,
        daysUntilAccessEnds: null
      };
    }

    const accessUntil = subscription.currentPeriodEnd || subscription.cancelledAt;
    const daysUntilAccessEnds = accessUntil ? 
      Math.ceil((new Date(accessUntil) - new Date()) / (1000 * 60 * 60 * 24)) : 0;

    return {
      isCancelled: true,
      cancelledAt: subscription.cancelledAt,
      cancellationReason: subscription.cancellationReason || null,
      accessUntil,
      daysUntilAccessEnds: Math.max(0, daysUntilAccessEnds)
    };
  }, [subscription]);

  return {
    // Core subscription data
    subscription,
    loading: loading || agencyLoading,
    error,
    lastUpdated,
    
    // Status information
    ...computedValues,
    
    // Billing and payment information
    billing: billingInfo,
    
    // Credits information
    credits: creditsInfo,
    
    // Agency information (for client tier users)
    agency: agencyData,
    agencyLoading,
    
    // Cancellation information
    cancellation: cancellationInfo,
    
    // Legacy compatibility (deprecated but kept for backward compatibility)
    billingCycle: subscription?.billingCycle || null,
    currentPeriodEnd: subscription?.currentPeriodEnd || null,
    creditsRemaining: creditsInfo.remaining,
    creditsResetDate: subscription?.creditsResetDate || null,
    
    // Actions
    refetch,
    
    // Status details from API
    statusDetails
  };
};