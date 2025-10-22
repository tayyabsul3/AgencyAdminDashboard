// Enhanced Firestore operations for subscription management
import { 
  doc, 
  collection, 
  setDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  writeBatch,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  validateSubscriptionData, 
  getDefaultSubscriptionData, 
  tierConfigurations 
} from './subscriptionSchema';

/**
 * Subscription Operations
 */
export class SubscriptionOperations {
  
  /**
   * Create or update subscription document
   * @param {string} userId - User ID
   * @param {Object} subscriptionData - Subscription data
   * @param {Object} options - Options for the operation
   * @returns {Promise<Object>} Operation result
   */
  static async upsertSubscription(userId, subscriptionData, options = {}) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Validate subscription data
      const validation = validateSubscriptionData(subscriptionData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const subscriptionRef = doc(db, 'subscriptions', userId);
      
      // Prepare data with timestamps
      const dataToSave = {
        ...subscriptionData,
        updatedAt: serverTimestamp(),
        lastSyncedAt: serverTimestamp()
      };

      // If creating new subscription, add createdAt
      if (options.isNew) {
        dataToSave.createdAt = serverTimestamp();
      }

      // Use merge to preserve existing fields not being updated
      await setDoc(subscriptionRef, dataToSave, { merge: !options.replace });

      // Log the operation
      await this.logSubscriptionEvent(userId, {
        eventType: options.isNew ? 'created' : 'updated',
        newState: subscriptionData,
        source: options.source || 'api',
        triggeredBy: options.triggeredBy || 'system'
      });

      return {
        success: true,
        message: options.isNew ? 'Subscription created successfully' : 'Subscription updated successfully',
        data: { userId, ...dataToSave }
      };
    } catch (error) {
      console.error('Error upserting subscription:', error);
      return {
        success: false,
        error: { message: error.message, type: 'database_error' }
      };
    }
  }

  /**
   * Get subscription by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Subscription data
   */
  static async getSubscription(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const subscriptionRef = doc(db, 'subscriptions', userId);
      const subscriptionDoc = await getDoc(subscriptionRef);

      if (!subscriptionDoc.exists()) {
        return {
          success: true,
          subscription: null,
          message: 'No subscription found'
        };
      }

      const data = subscriptionDoc.data();
      
      // Convert Firestore timestamps to Date objects
      const processedData = this.processTimestamps(data);

      return {
        success: true,
        subscription: {
          id: subscriptionDoc.id,
          ...processedData
        }
      };
    } catch (error) {
      console.error('Error getting subscription:', error);
      return {
        success: false,
        error: { message: error.message, type: 'database_error' }
      };
    }
  }

  /**
   * Update subscription status
   * @param {string} userId - User ID
   * @param {string} newStatus - New status
   * @param {Object} additionalData - Additional data to update
   * @returns {Promise<Object>} Operation result
   */
  static async updateSubscriptionStatus(userId, newStatus, additionalData = {}) {
    try {
      const subscriptionRef = doc(db, 'subscriptions', userId);
      
      // Get current subscription for event logging
      const currentDoc = await getDoc(subscriptionRef);
      const previousState = currentDoc.exists() ? currentDoc.data() : null;

      const updateData = {
        status: newStatus,
        ...additionalData,
        updatedAt: serverTimestamp(),
        lastSyncedAt: serverTimestamp()
      };

      await updateDoc(subscriptionRef, updateData);

      // Log the status change
      await this.logSubscriptionEvent(userId, {
        eventType: 'status_changed',
        previousState,
        newState: { status: newStatus, ...additionalData },
        changes: ['status', ...Object.keys(additionalData)],
        source: additionalData.source || 'webhook',
        triggeredBy: additionalData.triggeredBy || 'system'
      });

      return {
        success: true,
        message: `Subscription status updated to ${newStatus}`,
        data: updateData
      };
    } catch (error) {
      console.error('Error updating subscription status:', error);
      return {
        success: false,
        error: { message: error.message, type: 'database_error' }
      };
    }
  }

  /**
   * Cancel subscription
   * @param {string} userId - User ID
   * @param {Object} cancellationData - Cancellation details
   * @returns {Promise<Object>} Operation result
   */
  static async cancelSubscription(userId, cancellationData = {}) {
    try {
      const subscriptionRef = doc(db, 'subscriptions', userId);
      
      // Get current subscription
      const currentDoc = await getDoc(subscriptionRef);
      if (!currentDoc.exists()) {
        throw new Error('Subscription not found');
      }

      const previousState = currentDoc.data();
      const now = new Date();

      const updateData = {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancellationReason: cancellationData.reason || 'user_requested',
        cancellationFeedback: cancellationData.feedback || '',
        cancelAtPeriodEnd: cancellationData.cancelAtPeriodEnd !== false,
        updatedAt: serverTimestamp(),
        lastSyncedAt: serverTimestamp()
      };

      await updateDoc(subscriptionRef, updateData);

      // Log the cancellation
      await this.logSubscriptionEvent(userId, {
        eventType: 'cancelled',
        previousState,
        newState: updateData,
        source: cancellationData.source || 'user',
        triggeredBy: cancellationData.triggeredBy || userId
      });

      return {
        success: true,
        message: 'Subscription cancelled successfully',
        data: updateData
      };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return {
        success: false,
        error: { message: error.message, type: 'database_error' }
      };
    }
  }

  /**
   * Change subscription plan
   * @param {string} userId - User ID
   * @param {Object} planData - New plan details
   * @returns {Promise<Object>} Operation result
   */
  static async changePlan(userId, planData) {
    try {
      const subscriptionRef = doc(db, 'subscriptions', userId);
      
      // Get current subscription
      const currentDoc = await getDoc(subscriptionRef);
      if (!currentDoc.exists()) {
        throw new Error('Subscription not found');
      }

      const previousState = currentDoc.data();
      const tierConfig = tierConfigurations[planData.newTier];
      
      if (!tierConfig) {
        throw new Error(`Invalid tier: ${planData.newTier}`);
      }

      // Prepare plan change data
      const planChangeRecord = {
        fromTier: previousState.tier,
        toTier: planData.newTier,
        fromBillingCycle: previousState.billingCycle,
        toBillingCycle: planData.newBillingCycle || previousState.billingCycle,
        changedAt: new Date(),
        reason: planData.reason || 'user_requested',
        prorationAmount: planData.prorationAmount || 0
      };

      const updateData = {
        tier: planData.newTier,
        billingCycle: planData.newBillingCycle || previousState.billingCycle,
        credits: tierConfig.credits,
        accessLevel: {
          level: planData.newTier,
          features: tierConfig.features
        },
        planChangeHistory: [...(previousState.planChangeHistory || []), planChangeRecord],
        updatedAt: serverTimestamp(),
        lastSyncedAt: serverTimestamp()
      };

      await updateDoc(subscriptionRef, updateData);

      // Log the plan change
      await this.logSubscriptionEvent(userId, {
        eventType: 'plan_changed',
        previousState,
        newState: updateData,
        changes: ['tier', 'billingCycle', 'credits', 'accessLevel'],
        source: planData.source || 'user',
        triggeredBy: planData.triggeredBy || userId
      });

      return {
        success: true,
        message: `Plan changed from ${previousState.tier} to ${planData.newTier}`,
        data: { ...updateData, planChangeRecord }
      };
    } catch (error) {
      console.error('Error changing plan:', error);
      return {
        success: false,
        error: { message: error.message, type: 'database_error' }
      };
    }
  }

  /**
   * Update credits usage
   * @param {string} userId - User ID
   * @param {number} creditsUsed - Credits to add to usage
   * @returns {Promise<Object>} Operation result
   */
  static async updateCreditsUsage(userId, creditsUsed) {
    try {
      const subscriptionRef = doc(db, 'subscriptions', userId);
      
      // Get current subscription
      const currentDoc = await getDoc(subscriptionRef);
      if (!currentDoc.exists()) {
        throw new Error('Subscription not found');
      }

      const currentData = currentDoc.data();
      const newCreditsUsed = (currentData.creditsUsed || 0) + creditsUsed;
      const totalCredits = currentData.credits || 0;

      // Check if user has enough credits
      if (totalCredits > 0 && newCreditsUsed > totalCredits) {
        return {
          success: false,
          error: { 
            message: 'Insufficient credits', 
            type: 'credits_exceeded',
            details: {
              requested: creditsUsed,
              available: totalCredits - (currentData.creditsUsed || 0),
              total: totalCredits,
              used: currentData.creditsUsed || 0
            }
          }
        };
      }

      const updateData = {
        creditsUsed: newCreditsUsed,
        updatedAt: serverTimestamp()
      };

      await updateDoc(subscriptionRef, updateData);

      return {
        success: true,
        message: 'Credits usage updated',
        data: {
          creditsUsed: newCreditsUsed,
          creditsRemaining: Math.max(0, totalCredits - newCreditsUsed),
          totalCredits
        }
      };
    } catch (error) {
      console.error('Error updating credits usage:', error);
      return {
        success: false,
        error: { message: error.message, type: 'database_error' }
      };
    }
  }

  /**
   * Reset credits for new billing period
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Operation result
   */
  static async resetCredits(userId) {
    try {
      const subscriptionRef = doc(db, 'subscriptions', userId);
      
      const updateData = {
        creditsUsed: 0,
        creditsResetDate: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await updateDoc(subscriptionRef, updateData);

      return {
        success: true,
        message: 'Credits reset successfully',
        data: updateData
      };
    } catch (error) {
      console.error('Error resetting credits:', error);
      return {
        success: false,
        error: { message: error.message, type: 'database_error' }
      };
    }
  }

  /**
   * Log subscription event
   * @param {string} userId - User ID
   * @param {Object} eventData - Event data
   * @returns {Promise<void>}
   */
  static async logSubscriptionEvent(userId, eventData) {
    try {
      const eventsRef = collection(db, 'subscription_events');
      
      const eventDoc = {
        userId,
        stripeSubscriptionId: eventData.stripeSubscriptionId || '',
        eventType: eventData.eventType,
        previousState: eventData.previousState || null,
        newState: eventData.newState || null,
        changes: eventData.changes || [],
        source: eventData.source || 'system',
        triggeredBy: eventData.triggeredBy || 'system',
        createdAt: serverTimestamp(),
        stripeEventId: eventData.stripeEventId || null,
        metadata: eventData.metadata || {}
      };

      await setDoc(doc(eventsRef), eventDoc);
    } catch (error) {
      console.error('Error logging subscription event:', error);
      // Don't throw error for logging failures
    }
  }

  /**
   * Get subscription events
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Events data
   */
  static async getSubscriptionEvents(userId, options = {}) {
    try {
      const eventsRef = collection(db, 'subscription_events');
      
      let q = query(
        eventsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      if (options.limit) {
        q = query(q, limit(options.limit));
      }

      if (options.startAfter) {
        q = query(q, startAfter(options.startAfter));
      }

      const querySnapshot = await getDocs(q);
      const events = [];

      querySnapshot.forEach((doc) => {
        events.push({
          id: doc.id,
          ...this.processTimestamps(doc.data())
        });
      });

      return {
        success: true,
        events,
        hasMore: querySnapshot.size === (options.limit || 0)
      };
    } catch (error) {
      console.error('Error getting subscription events:', error);
      return {
        success: false,
        error: { message: error.message, type: 'database_error' }
      };
    }
  }

  /**
   * Process Firestore timestamps to Date objects
   * @param {Object} data - Data with timestamps
   * @returns {Object} Processed data
   */
  static processTimestamps(data) {
    const processed = { ...data };
    
    // List of timestamp fields to convert
    const timestampFields = [
      'createdAt', 'updatedAt', 'lastSyncedAt', 'cancelledAt',
      'currentPeriodStart', 'currentPeriodEnd', 'trialStart', 'trialEnd',
      'creditsResetDate', 'lastPaymentDate', 'nextPaymentDate', 'graceExpiresAt'
    ];

    timestampFields.forEach(field => {
      if (processed[field] && processed[field].toDate) {
        processed[field] = processed[field].toDate();
      } else if (processed[field] && typeof processed[field] === 'string') {
        processed[field] = new Date(processed[field]);
      }
    });

    // Process plan change history timestamps
    if (processed.planChangeHistory && Array.isArray(processed.planChangeHistory)) {
      processed.planChangeHistory = processed.planChangeHistory.map(change => ({
        ...change,
        changedAt: change.changedAt?.toDate ? change.changedAt.toDate() : new Date(change.changedAt)
      }));
    }

    return processed;
  }

  /**
   * Create real-time subscription listener
   * @param {string} userId - User ID
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  static subscribeToSubscription(userId, callback) {
    const subscriptionRef = doc(db, 'subscriptions', userId);
    
    return onSnapshot(subscriptionRef, (doc) => {
      if (doc.exists()) {
        const data = this.processTimestamps(doc.data());
        callback({
          success: true,
          subscription: { id: doc.id, ...data }
        });
      } else {
        callback({
          success: true,
          subscription: null
        });
      }
    }, (error) => {
      callback({
        success: false,
        error: { message: error.message, type: 'listener_error' }
      });
    });
  }
}

export default SubscriptionOperations;