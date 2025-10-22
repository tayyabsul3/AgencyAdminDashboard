'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { updatePurchaseStatus } from '../../../lib/purchase';
import styles from '../pricing.module.css';

const SuccessContent = () => {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const purchaseId = searchParams.get('purchase_id');
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    if (sessionId) {
      // Fetch actual subscription details from Stripe via our API
      fetchSubscriptionDetails(sessionId);
    } else {
      setLoading(false);
    }
  }, [sessionId]);

  const fetchSubscriptionDetails = async (sessionId) => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://us-central1-lead-generation-6cf0f.cloudfunctions.net/api';
      console.log('Fetching from:', `${apiBaseUrl}/stripe/verify-session?session_id=${sessionId}`);

      const response = await fetch(`${apiBaseUrl}/stripe/verify-session?session_id=${sessionId}`);
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log('Response data:', data);

        if (data.success && data.subscription) {
          setSubscription(data.subscription);

          // Update purchase status in Firestore if we have a purchase ID
          if (purchaseId) {
            console.log('Updating purchase status in Firestore:', purchaseId);
            try {
              await updatePurchaseStatus(purchaseId, 'completed', {
                sessionId,
                stripeSubscriptionId: data.subscription.id,
                paymentMethod: data.subscription.paymentMethod,
                amountPaid: data.subscription.amountPaid
              });
              console.log('Purchase status updated successfully');
            } catch (firestoreError) {
              console.error('Failed to update purchase status in Firestore:', firestoreError);
            }
          }
        } else {
          // Fallback to basic success message
          setSubscription({
            status: 'processing',
            tier: 'Processing...',
            nextBilling: 'Pending verification',
            debug: `API Response: ${JSON.stringify(data)}`
          });
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to verify session:', response.status, errorText);

        // Update purchase status to failed if we have a purchase ID
        if (purchaseId) {
          try {
            await updatePurchaseStatus(purchaseId, 'failed', {
              sessionId,
              error: errorText,
              statusCode: response.status
            });
          } catch (firestoreError) {
            console.error('Failed to update purchase status to failed:', firestoreError);
          }
        }

        setSubscription({
          status: 'error',
          tier: `Error ${response.status}`,
          nextBilling: errorText || 'Verification failed',
          debug: `Status: ${response.status}, Response: ${errorText}`
        });
      }
    } catch (error) {
      console.error('Error fetching subscription details:', error);

      // Update purchase status to failed if we have a purchase ID
      if (purchaseId) {
        try {
          await updatePurchaseStatus(purchaseId, 'failed', {
            sessionId,
            error: error.message
          });
        } catch (firestoreError) {
          console.error('Failed to update purchase status to failed:', firestoreError);
        }
      }

      setSubscription({
        status: 'error',
        tier: 'Network Error',
        nextBilling: error.message,
        debug: `Network error: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pricing}>
      <div className={styles.container}>
        <div className={styles.success}>
          <div className={styles.successIcon}>
            ✓
          </div>

          <h1 className={styles.successTitle}>
            Welcome to QueryFuel!
          </h1>

          <p className={styles.successMessage}>
            Your subscription has been activated successfully.
          </p>

          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Setting up your account...</p>
            </div>
          ) : subscription ? (
            <div className={styles.subscriptionDetails}>
              <div className={styles.detailCard}>
                <h3>Subscription Details</h3>
                <div className={styles.details}>
                  <div className={styles.detail}>
                    <span>Plan:</span>
                    <span>{subscription.tier}</span>
                  </div>
                  <div className={styles.detail}>
                    <span>Status:</span>
                    <span className={styles.active}>{subscription.status}</span>
                  </div>
                  <div className={styles.detail}>
                    <span>Next Billing:</span>
                    <span>{subscription.nextBilling}</span>
                  </div>
                  {subscription.debug && (
                    <div className={styles.detail}>
                      <span>Debug:</span>
                      <span style={{ fontSize: '12px', color: '#666' }}>{subscription.debug}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className={styles.successActions}>
            <Link href="/dashboard" className={styles.primaryBtn}>
              Go to Dashboard
            </Link>
            <Link href="/" className={styles.secondaryBtn}>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const Success = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
};

export default Success;