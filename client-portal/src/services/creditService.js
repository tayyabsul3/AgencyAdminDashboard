import { db } from '@/lib/firebase';
import { doc, runTransaction } from 'firebase/firestore';

/**
 * Atomically deducts credits from a user's subscription or agency (for client tier users)
 * @param {string} userId - The user's ID
 * @param {number} creditsToDeduct - Number of credits to deduct (default: 1)
 * @returns {Promise<{success: boolean, error?: string, newCreditsUsed?: number, availableCredits?: number}>}
 */
export const deductCreditsAtomic = async (userId, creditsToDeduct = 1) => {
  const subscriptionRef = doc(db, 'subscriptions', userId);

  try {
    return await runTransaction(db, async (transaction) => {
      // Get current subscription data
      const subscriptionDoc = await transaction.get(subscriptionRef);

      if (!subscriptionDoc.exists()) {
        throw new Error('Subscription not found');
      }

      const subscriptionData = subscriptionDoc.data();

      // Check if this is a client tier user with an agency
      if (subscriptionData.tier === 'client' && subscriptionData.agencyId) {
        // Deduct from agency credits
        const agencyRef = doc(db, 'agencies', subscriptionData.agencyId);
        const agencyDoc = await transaction.get(agencyRef);

        if (!agencyDoc.exists()) {
          throw new Error('Agency not found');
        }

        const agencyData = agencyDoc.data();
        const agencySubscription = agencyData.subscription || {};
        const currentCreditsUsed = agencySubscription.creditsUsed || 0;
        const totalCredits = agencySubscription.credits || 0;
        const availableCredits = totalCredits - currentCreditsUsed;

        // Check if agency has enough credits
        if (availableCredits < creditsToDeduct) {
          throw new Error(`Insufficient agency credits. Available: ${availableCredits}, Required: ${creditsToDeduct}`);
        }

        // Calculate new values
        const newCreditsUsed = currentCreditsUsed + creditsToDeduct;

        // Update agency subscription with new credit usage
        transaction.update(agencyRef, {
          'subscription.creditsUsed': newCreditsUsed,
          updatedAt: new Date(),
          'subscription.lastCreditDeduction': new Date()
        });

        console.log(`✅ Atomically deducted ${creditsToDeduct} credit(s) from agency ${subscriptionData.agencyId} for client user ${userId}`);
        return {
          success: true,
          newCreditsUsed,
          availableCredits: totalCredits - newCreditsUsed,
          isAgencyCredits: true,
          agencyId: subscriptionData.agencyId
        };
      } else {
        // Regular user - deduct from personal credits
        const currentCreditsUsed = subscriptionData.creditsUsed || 0;
        const totalCredits = subscriptionData.credits || 0;
        const availableCredits = totalCredits - currentCreditsUsed;

        // Check if user has enough credits
        if (availableCredits < creditsToDeduct) {
          throw new Error(`Insufficient credits. Available: ${availableCredits}, Required: ${creditsToDeduct}`);
        }

        // Calculate new values
        const newCreditsUsed = currentCreditsUsed + creditsToDeduct;

        // Update subscription with new credit usage
        transaction.update(subscriptionRef, {
          creditsUsed: newCreditsUsed,
          updatedAt: new Date(),
          lastCreditDeduction: new Date()
        });

        console.log(`✅ Atomically deducted ${creditsToDeduct} credit(s) from user ${userId}`);
        return {
          success: true,
          newCreditsUsed,
          availableCredits: totalCredits - newCreditsUsed,
          isAgencyCredits: false
        };
      }
    });
  } catch (error) {
    console.error('❌ Failed to deduct credits atomically:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Refunds credits to a user's subscription or agency (for client tier users)
 * @param {string} userId - The user's ID
 * @param {number} creditsToRefund - Number of credits to refund (default: 1)
 * @returns {Promise<{success: boolean, error?: string, newCreditsUsed?: number}>}
 */
export const refundCredits = async (userId, creditsToRefund = 1) => {
  const subscriptionRef = doc(db, 'subscriptions', userId);

  try {
    return await runTransaction(db, async (transaction) => {
      const subscriptionDoc = await transaction.get(subscriptionRef);

      if (!subscriptionDoc.exists()) {
        throw new Error('Subscription not found');
      }

      const subscriptionData = subscriptionDoc.data();

      // Check if this is a client tier user with an agency
      if (subscriptionData.tier === 'client' && subscriptionData.agencyId) {
        // Refund to agency credits
        const agencyRef = doc(db, 'agencies', subscriptionData.agencyId);
        const agencyDoc = await transaction.get(agencyRef);

        if (!agencyDoc.exists()) {
          throw new Error('Agency not found');
        }

        const agencyData = agencyDoc.data();
        const agencySubscription = agencyData.subscription || {};
        const currentCreditsUsed = agencySubscription.creditsUsed || 0;

        // Ensure we don't go below 0
        const newCreditsUsed = Math.max(0, currentCreditsUsed - creditsToRefund);

        transaction.update(agencyRef, {
          'subscription.creditsUsed': newCreditsUsed,
          updatedAt: new Date(),
          'subscription.lastCreditRefund': new Date()
        });

        console.log(`🔄 Refunded ${creditsToRefund} credit(s) to agency ${subscriptionData.agencyId} for client user ${userId}`);
        return { 
          success: true, 
          newCreditsUsed,
          isAgencyCredits: true,
          agencyId: subscriptionData.agencyId
        };
      } else {
        // Regular user - refund to personal credits
        const currentCreditsUsed = subscriptionData.creditsUsed || 0;

        // Ensure we don't go below 0
        const newCreditsUsed = Math.max(0, currentCreditsUsed - creditsToRefund);

        transaction.update(subscriptionRef, {
          creditsUsed: newCreditsUsed,
          updatedAt: new Date(),
          lastCreditRefund: new Date()
        });

        console.log(`🔄 Refunded ${creditsToRefund} credit(s) to user ${userId}`);
        return { 
          success: true, 
          newCreditsUsed,
          isAgencyCredits: false
        };
      }
    });
  } catch (error) {
    console.error('❌ Failed to refund credits:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Validates if user has sufficient credits
 * @param {number} creditsRemaining - User's remaining credits
 * @param {number} required - Required credits (default: 1)
 * @returns {boolean} True if user has enough credits
 */
export const validateCredits = (creditsRemaining, required = 1) => {
  return creditsRemaining >= required;
};