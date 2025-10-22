import { db } from './firebase';
import { collection, addDoc, updateDoc, doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * Save purchase data to Firestore
 * @param {string} userId - The user's Firebase Auth UID
 * @param {Object} purchaseData - Purchase information
 * @returns {Promise<Object>} - Result of the save operation
 */
export const savePurchaseData = async (userId, purchaseData) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const purchaseInfo = {
      userId,
      tier: purchaseData.tier,
      billingCycle: purchaseData.billingCycle,
      price: purchaseData.price,
      stripePriceId: purchaseData.stripePriceId,
      status: 'initiated', // initiated, completed, failed, cancelled
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: purchaseData.metadata || {}
    };

    // Save to purchases collection
    const docRef = await addDoc(collection(db, 'purchases'), purchaseInfo);

    console.log('Purchase data saved successfully:', docRef.id);

    // Also update user's subscription status
    await updateUserSubscription(userId, {
      currentTier: purchaseData.tier,
      billingCycle: purchaseData.billingCycle,
      status: 'pending_payment',
      lastPurchaseId: docRef.id,
      updatedAt: new Date()
    });

    return {
      success: true,
      purchaseId: docRef.id,
      message: 'Purchase data saved successfully'
    };

  } catch (error) {
    console.error('Error saving purchase data:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to save purchase data'
    };
  }
};

/**
 * Update user's subscription information
 * @param {string} userId - The user's Firebase Auth UID
 * @param {Object} subscriptionData - Subscription information
 */
export const updateUserSubscription = async (userId, subscriptionData) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      // Update existing user document
      await updateDoc(userRef, {
        ...subscriptionData,
        updatedAt: new Date()
      });
    } else {
      // Create new user document
      await setDoc(userRef, {
        userId,
        createdAt: new Date(),
        ...subscriptionData
      });
    }

    console.log('User subscription updated successfully');
  } catch (error) {
    console.error('Error updating user subscription:', error);
    throw error;
  }
};

/**
 * Update purchase status after payment completion
 * @param {string} purchaseId - The purchase document ID
 * @param {string} status - New status (completed, failed, cancelled)
 * @param {Object} paymentData - Additional payment information
 */
export const updatePurchaseStatus = async (purchaseId, status, paymentData = {}) => {
  try {
    const purchaseRef = doc(db, 'purchases', purchaseId);

    await updateDoc(purchaseRef, {
      status,
      updatedAt: new Date(),
      paymentData: {
        ...paymentData,
        completedAt: status === 'completed' ? new Date() : null
      }
    });

    console.log(`Purchase ${purchaseId} status updated to ${status}`);

    // If payment completed, update user's subscription status
    if (status === 'completed') {
      const purchaseDoc = await getDoc(purchaseRef);
      if (purchaseDoc.exists()) {
        const purchaseData = purchaseDoc.data();
        await updateUserSubscription(purchaseData.userId, {
          currentTier: purchaseData.tier,
          billingCycle: purchaseData.billingCycle,
          status: 'active',
          subscriptionStartDate: new Date(),
          updatedAt: new Date()
        });
      }
    }

  } catch (error) {
    console.error('Error updating purchase status:', error);
    throw error;
  }
};

/**
 * Get user's current subscription information
 * @param {string} userId - The user's Firebase Auth UID
 * @returns {Promise<Object|null>} - User's subscription data or null
 */
export const getUserSubscription = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      return userDoc.data();
    }

    return null;
  } catch (error) {
    console.error('Error getting user subscription:', error);
    return null;
  }
};