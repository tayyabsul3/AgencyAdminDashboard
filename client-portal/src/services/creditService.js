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
            // 1. Get client's main subscription document (Source of Truth for Article Limit)
            const subscriptionDoc = await transaction.get(subscriptionRef);

            if (!subscriptionDoc.exists()) {
                throw new Error('Subscription not found');
            }

            const subscriptionData = subscriptionDoc.data();

            // Check if this is a client tier user with an agency
            if (subscriptionData.tier === 'client' && subscriptionData.agencyId) {
                // --- START: ALL READS MUST HAPPEN BEFORE ANY WRITES ---
                const agencyId = subscriptionData.agencyId;
                const agencyRef = doc(db, 'agencies', agencyId);
                const agencyDoc = await transaction.get(agencyRef); // Read agency doc BEFORE any writes

                if (!agencyDoc.exists()) {
                    throw new Error('Agency not found'); 
                }
                // --- END: ALL READS COMPLETED ---

                // --- START: CLIENT SUBSCRIPTION UPDATE (Article Count) ---
                const articleLimit = subscriptionData.articleLimit || 0;
                const articlesGenerated = subscriptionData.articlesGenerated || 0;
                
                // 1a. Check if the article limit is reached
                if (articleLimit > 0 && articlesGenerated >= articleLimit) {
                    throw new Error(`Article limit reached for client. Limit: ${articleLimit}, Generated: ${articlesGenerated}`);
                }

                // 1b. Increment articlesGenerated count
                const newArticlesGenerated = articlesGenerated + 1;

                // 1c. Update the client's main subscription document
                transaction.update(subscriptionRef, {
                    articlesGenerated: newArticlesGenerated,
                    updatedAt: new Date()
                });
                // --- END: CLIENT SUBSCRIPTION UPDATE ---


                // --- START: AGENCY DOCUMENT UPDATES (Client Array and Credit) ---

                const agencyData = agencyDoc.data();
                const clientsArray = agencyData.clients || [];
                
                // 2. Find the specific client in the agency's 'clients' array
                const clientIndex = clientsArray.findIndex(client => client.userId === userId);

                if (clientIndex === -1) {
                    // This will rollback the client subscription update (1c) too.
                    throw new Error(`Client user ${userId} not found in agency client list.`);
                }
                
                // 3. Update the client's articlesGenerated in the agency's embedded array
                const clientDataInAgency = clientsArray[clientIndex];
                clientsArray[clientIndex] = {
                    ...clientDataInAgency, // preserve existing client data
                    articlesGenerated: newArticlesGenerated, // Use the new value from 1b
                    updatedAt: new Date() 
                };
                
                // 4. Check Agency Credit Availability 
                const agencySubscription = agencyData.subscription || {};
                const currentCreditsUsed = agencySubscription.creditsUsed || 0;
                const totalCredits = agencySubscription.credits || 0;
                const availableCredits = totalCredits - currentCreditsUsed;

                if (availableCredits < creditsToDeduct) {
                    // This will rollback all previous updates in this transaction.
                    throw new Error(`Insufficient agency credits. Available: ${availableCredits}, Required: ${creditsToDeduct}`);
                }

                // 5. Calculate new agency credit usage
                const newAgencyCreditsUsed = currentCreditsUsed + creditsToDeduct;

                // 6. Update the Agency Document (Atomic Write)
                transaction.update(agencyRef, {
                    clients: clientsArray, // Update the clients array
                    'subscription.creditsUsed': newAgencyCreditsUsed, // Update agency subscription credits
                    updatedAt: new Date(),
                    'subscription.lastCreditDeduction': new Date()
                });
                // --- END: AGENCY DOCUMENT UPDATES ---

                console.log(`✅ Atomically generated article (count: ${newArticlesGenerated}) and deducted ${creditsToDeduct} credit(s) from agency ${agencyId} for client user ${userId}`);
                return {
                    success: true,
                    newCreditsUsed: newAgencyCreditsUsed,
                    availableCredits: totalCredits - newAgencyCreditsUsed,
                    articlesGenerated: newArticlesGenerated,
                    isAgencyCredits: true,
                    agencyId: agencyId
                };
            } else {
        const currentCreditsUsed = subscriptionData.creditsUsed || 0;
        const totalCredits = subscriptionData.credits || 0;
        const availableCredits = totalCredits - currentCreditsUsed;

        if (availableCredits < creditsToDeduct) {
          throw new Error(`Insufficient credits. Available: ${availableCredits}, Required: ${creditsToDeduct}`);
        }

        const newCreditsUsed = currentCreditsUsed + creditsToDeduct;

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