'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { useAgencyProtection } from '../../../hooks/useAgencyProtection';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { getSubscriptionStatus, getBillingHistory, getPaymentMethods, cancelSubscription, calculateProration } from '../../../services/subscriptionService';
import CancellationModal from '../../../components/subscription/CancellationModal';
import PlanChangeModal from '../../../components/subscription/PlanChangeModal';
import styles from './subscription.module.css';
import LandingNavbar from '../../../components/LandingNavbar/LandingNavbar';

export default function SubscriptionPage() {
  const { user } = useAuth();
  
  // Protect this page from agency clients
  const { shouldRedirect, loading: protectionLoading } = useAgencyProtection({
    redirectTo: '/dashboard',
    message: 'subscription-managed-by-agency'
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [billingLoading, setBillingLoading] = useState(false);
  const [billingPage, setBillingPage] = useState(1);
  const [hasMoreInvoices, setHasMoreInvoices] = useState(true);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Set up real-time subscription listener
  useEffect(() => {
    if (!user?.uid) return;

    console.log('Setting up real-time subscription listener for user:', user.uid);

    // Set up Firestore real-time listener for subscription changes
    const subscriptionRef = doc(db, 'subscriptions', user.uid);
    
    const unsubscribe = onSnapshot(subscriptionRef, (doc) => {
      if (doc.exists()) {
        const subscriptionData = doc.data();
        console.log('📡 Real-time subscription update received:', subscriptionData);
        
        // Update subscription status with real-time data
        setSubscriptionStatus({
          success: true,
          status: subscriptionData.status || 'active',
          subscription: {
            ...subscriptionData,
            hasActiveSubscription: ['active', 'trial'].includes(subscriptionData.status || 'active'),
            canCancel: (subscriptionData.status || 'active') === 'active' && !subscriptionData.cancelAtPeriodEnd
          }
        });
      } else {
        console.log('No subscription document found, loading via API...');
        // Fallback to API if no Firestore document
        loadSubscriptionData();
      }
    }, (error) => {
      console.error('Error in subscription listener:', error);
      // Fallback to API on error
      loadSubscriptionData();
    });

    // Load billing history and payment methods (these don't need real-time updates)
    loadBillingAndPaymentData();

    // Cleanup listener on unmount
    return () => {
      console.log('Cleaning up subscription listener');
      unsubscribe();
    };
  }, [user?.uid]);

  // Handle plan change success/cancel from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('plan_change_success') === 'true') {
      setSuccessMessage('Your plan has been changed successfully! Your new features are now available.');
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
      // No need to manually refresh - real-time listener will update automatically
    }
    
    if (urlParams.get('plan_change_cancelled') === 'true') {
      setError('Plan change was cancelled. Your current plan remains unchanged.');
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    }
  }, []);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount, currency = 'USD') => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'trial': return 'info';
      case 'cancelled': return 'warning';
      case 'past_due': return 'warning';
      case 'unpaid': return 'danger';
      case 'suspended': return 'danger';
      case 'expired': return 'danger';
      case 'incomplete': return 'warning';
      case 'incomplete_expired': return 'danger';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return '✅';
      case 'trial': return '🆓';
      case 'cancelling': return '⏳';
      case 'cancelled': return '✅';
      case 'past_due': return '⚠️';
      case 'unpaid': return '🚫';
      case 'suspended': return '🚫';
      case 'expired': return '❌';
      case 'incomplete': return '⏳';
      case 'incomplete_expired': return '❌';
      default: return '❓';
    }
  };

  const getStatusDescription = (status) => {
    switch (status) {
      case 'active': return 'Your subscription is active and all features are available.';
      case 'trial': return 'You\'re in your trial period with full access to features.';
      case 'cancelling': return 'Your subscription cancellation is being processed. Tier change pending webhook confirmation.';
      case 'cancelled': return 'Your subscription has been cancelled. Your credits have been preserved.';
      case 'past_due': return 'Your payment failed. Please update your payment method to avoid service interruption.';
      case 'unpaid': return 'Your subscription is suspended due to failed payment. Update your payment method to restore access.';
      case 'suspended': return 'Your subscription has been suspended. Contact support for assistance.';
      case 'expired': return 'Your subscription has expired. Reactivate to regain access to premium features.';
      case 'incomplete': return 'Your subscription setup is incomplete. Please complete the payment process.';
      case 'incomplete_expired': return 'Your subscription setup expired. Please start the subscription process again.';
      default: return 'Subscription status unknown. Please contact support if you need assistance.';
    }
  };

  const getCardIcon = (brand) => {
    switch (brand?.toLowerCase()) {
      case 'visa': return '💳';
      case 'mastercard': return '💳';
      case 'amex': return '💳';
      case 'discover': return '💳';
      case 'diners': return '💳';
      case 'jcb': return '💳';
      case 'unionpay': return '💳';
      default: return '💳';
    }
  };

  const isCardExpired = (card) => {
    if (!card?.expMonth || !card?.expYear) return false;
    const now = new Date();
    const expiry = new Date(card.expYear, card.expMonth - 1);
    return expiry < now;
  };

  const isCardExpiringSoon = (card) => {
    if (!card?.expMonth || !card?.expYear) return false;
    const now = new Date();
    const expiry = new Date(card.expYear, card.expMonth - 1);
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    return expiry <= threeMonthsFromNow && expiry >= now;
  };

  const getGracePeriodCountdown = (graceExpiresAt) => {
    if (!graceExpiresAt) return null;
    
    const now = new Date();
    const expiry = new Date(graceExpiresAt);
    const timeDiff = expiry - now;
    
    if (timeDiff <= 0) return 'Expired';
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} remaining`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} remaining`;
    } else {
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      return `${minutes} minute${minutes !== 1 ? 's' : ''} remaining`;
    }
  };

  const loadMoreInvoices = async () => {
    if (!user?.uid || billingLoading || !hasMoreInvoices) return;

    setBillingLoading(true);
    try {
      const lastInvoice = billingHistory[billingHistory.length - 1];
      const result = await getBillingHistory(user.uid, { 
        limit: 10,
        startingAfter: lastInvoice?.id 
      });

      if (result.success) {
        const newInvoices = result.billingHistory?.invoices || [];
        setBillingHistory(prev => [...prev, ...newInvoices]);
        setHasMoreInvoices(result.billingHistory?.hasMore || false);
      }
    } catch (err) {
      console.error('Error loading more invoices:', err);
    } finally {
      setBillingLoading(false);
    }
  };

  const downloadInvoice = async (invoiceId, invoiceNumber) => {
    try {
      // In a real implementation, this would call a backend endpoint
      // that generates and returns the invoice PDF
      const response = await fetch(`/api/stripe/billing/${user.uid}/invoices/${invoiceId}/pdf`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoiceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('Failed to download invoice');
      }
    } catch (err) {
      console.error('Error downloading invoice:', err);
      setError('Failed to download invoice. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };



  const handleCancellationSuccess = (result) => {
    const creditsMsg = result.creditsPreserved > 0 ? ` Your ${result.creditsPreserved} credits have been preserved.` : '';
    setSuccessMessage(`Your subscription has been cancelled immediately.${creditsMsg}`);
    // No need to manually refresh - real-time listener will update automatically
    // Clear success message after 5 seconds
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handlePlanChangeSuccess = (result) => {
    setSuccessMessage('Your plan has been changed successfully.');
    // No need to manually refresh - real-time listener will update automatically
    // Clear success message after 5 seconds
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handlePlanChangeClick = () => {
    setShowPlanChangeModal(true);
  };

  // Load subscription data via API (fallback method)
  const loadSubscriptionData = async () => {
    if (!user?.uid) return;

    setLoading(true);
    setError(null);

    try {
      // Load subscription status
      const statusResult = await getSubscriptionStatus(user.uid);
      if (statusResult.success) {
        setSubscriptionStatus(statusResult);
      } else {
        console.error('Failed to load subscription status:', statusResult.error);
      }

      // Load billing and payment data
      await loadBillingAndPaymentData();

    } catch (err) {
      console.error('Error loading subscription data:', err);
      setError('Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  };

  // Load billing history and payment methods (separate from real-time subscription data)
  const loadBillingAndPaymentData = async () => {
    if (!user?.uid) return;

    try {
      // Load billing history
      const billingResult = await getBillingHistory(user.uid, { limit: 10 });
      if (billingResult.success) {
        setBillingHistory(billingResult.billingHistory?.invoices || []);
        setHasMoreInvoices(billingResult.billingHistory?.hasMore || false);
      }

      // Load payment methods
      const paymentResult = await getPaymentMethods(user.uid);
      if (paymentResult.success) {
        setPaymentMethods(paymentResult.paymentMethods?.paymentMethods || []);
      }

    } catch (err) {
      console.error('Error loading billing and payment data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything if redirecting (after all hooks are called)
  if (shouldRedirect) {
    return null;
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading subscription details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Subscription Error</h2>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className={`${styles.button} ${styles.primary}`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const subscription = subscriptionStatus?.subscription;
  const status = subscriptionStatus?.status || 'inactive';
  const statusDetails = subscriptionStatus?.statusDetails;

  return (
    <>
    
    <div className={styles.container}>
      <LandingNavbar />
      <div className={styles.header}>
        <h1 className={styles.title}>Subscription <span style={{
          background: 'linear-gradient(180deg, #59a1ff 0%, #4a78ff 60%, #6fe0ff 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          fontWeight: 700
        }}>Management</span></h1>
        <p className={styles.subtitle}>Manage your subscription, billing, and payment methods</p>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabNavigation}>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'billing' ? styles.active : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          Billing History
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'payment' ? styles.active : ''}`}
          onClick={() => setActiveTab('payment')}
        >
          Payment Methods
        </button>
      </div>



      {/* Success Message */}
      {successMessage && (
        <div className={styles.successAlert}>
          <span className={styles.successIcon}>✅</span>
          {successMessage}
        </div>
      )}

      <div className={styles.content}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className={styles.overviewTab}>
            {/* Status Card */}
            <div className={styles.statusCard}>
              <div className={styles.statusHeader}>
                <div className={styles.statusInfo}>
                  <span className={styles.statusIcon}>{getStatusIcon(status)}</span>
                  <div>
                    <h3 className={styles.statusTitle}>Subscription Status</h3>
                    <div className={`${styles.statusBadge} ${styles[getStatusColor(status)]}`}>
                      {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
                    </div>
                  </div>
                </div>
                <div className={styles.statusDescription}>
                  <p>{getStatusDescription(status)}</p>
                  {statusDetails?.reason && (
                    <p className={styles.statusReason}><em>{statusDetails.reason}</em></p>
                  )}
                </div>
              </div>

              {/* Status-specific alerts */}
              {status === 'past_due' && statusDetails?.graceExpiresAt && (
                <div className={`${styles.alert} ${styles.urgentAlert}`}>
                  <div className={styles.alertHeader}>
                    <span className={styles.alertIcon}>⚠️</span>
                    <strong>Payment Failed - Action Required</strong>
                  </div>
                  <div className={styles.alertContent}>
                    <p>Your payment is past due. {getGracePeriodCountdown(statusDetails.graceExpiresAt)} in your grace period.</p>
                    <p>Please contact support to resolve payment issues.</p>
                  </div>
                </div>
              )}

              {status === 'cancelling' && (
                <div className={`${styles.alert} ${styles.infoAlert}`}>
                  <div className={styles.alertHeader}>
                    <span className={styles.alertIcon}>⏳</span>
                    <strong>Cancellation in Progress</strong>
                  </div>
                  <div className={styles.alertContent}>
                    <p>Your subscription cancellation is being processed. Waiting for Stripe webhook confirmation to complete tier change.</p>
                    <p><em>Your tier will change to 'free' once confirmed, but your credits will be preserved.</em></p>
                  </div>
                </div>
              )}

              {status === 'cancelled' && (
                <div className={`${styles.alert} ${styles.infoAlert}`}>
                  <div className={styles.alertHeader}>
                    <span className={styles.alertIcon}>✅</span>
                    <strong>Subscription Cancelled</strong>
                  </div>
                  <div className={styles.alertContent}>
                    <p>Your subscription has been cancelled and confirmed by Stripe. Your credits have been preserved.</p>
                    {subscription?.credits > 0 && (
                      <p><strong>Credits preserved:</strong> {subscription.creditsUsed || 0} / {subscription.credits} used</p>
                    )}
                  </div>
                </div>
              )}

              {status === 'expired' && (
                <div className={`${styles.alert} ${styles.infoAlert}`}>
                  <div className={styles.alertHeader}>
                    <span className={styles.alertIcon}>❌</span>
                    <strong>Subscription Expired</strong>
                  </div>
                  <div className={styles.alertContent}>
                    <p>Your subscription has expired.</p>
                  </div>
                </div>
              )}

              {status === 'trial' && statusDetails?.trialEndsAt && (
                <div className={styles.alert}>
                  <strong>Trial Period:</strong> Your trial ends on {formatDate(statusDetails.trialEndsAt)}.
                </div>
              )}

              {status === 'unpaid' && (
                <div className={`${styles.alert} ${styles.dangerAlert}`}>
                  <div className={styles.alertHeader}>
                    <span className={styles.alertIcon}>🚫</span>
                    <strong>Subscription Suspended</strong>
                  </div>
                  <div className={styles.alertContent}>
                    <p>Your subscription has been suspended due to failed payment.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Subscription Details */}
            {subscription && (
              <div className={styles.subscriptionCard}>
                <div className={styles.cardHeader}>
                  <h2>Current Plan</h2>
                  {subscription.accessLevel && (
                    <span className={styles.accessLevel}>
                      {subscription.accessLevel.level} Access
                    </span>
                  )}
                </div>

                <div className={styles.subscriptionDetails}>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Plan:</span>
                    <span className={styles.value}>{subscription.tier || 'Free'}</span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.label}>Billing Cycle:</span>
                    <span className={styles.value}>{subscription.billingCycle || 'N/A'}</span>
                  </div>

                  {subscription.currentPeriodEnd && (
                    <div className={styles.detailRow}>
                      <span className={styles.label}>Next Billing Date:</span>
                      <span className={styles.value}>{formatDate(subscription.currentPeriodEnd)}</span>
                    </div>
                  )}

                  {subscription.credits !== undefined && (
                    <div className={styles.detailRow}>
                      <span className={styles.label}>Credits:</span>
                      <span className={styles.value}>
                        {subscription.creditsUsed || 0} / {subscription.credits || 0} used
                      </span>
                    </div>
                  )}

                  {subscription.creditsResetDate && (
                    <div className={styles.detailRow}>
                      <span className={styles.label}>Credits Reset:</span>
                      <span className={styles.value}>{formatDate(subscription.creditsResetDate)}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className={styles.actions}>
                  {subscription.canCancel && (
                    <button 
                      className={`${styles.button} ${styles.secondary}`}
                      onClick={() => setShowCancellationModal(true)}
                    >
                      Cancel Subscription
                    </button>
                  )}
                  
                  {/* Plan Change Button - Available for active subscriptions */}
                  {subscription.canCancel && (
                    <button 
                      className={`${styles.button} ${styles.primary}`}
                      onClick={handlePlanChangeClick}
                    >
                      Change Plan
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* No Subscription State */}
            {!subscription && (
              <div className={styles.noSubscription}>
                <h2>No Active Subscription</h2>
                <p>You don't have an active subscription. Upgrade to access premium features.</p>
                <Link href="/pricing" className={`${styles.button} ${styles.primary}`}>
                  View Plans
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Billing History Tab */}
        {activeTab === 'billing' && (
          <div className={styles.billingTab}>
            <div className={styles.sectionHeader}>
              <h2>Billing History</h2>
              <p>View and download your invoices</p>
            </div>

            {billingHistory.length > 0 ? (
              <>
                <div className={styles.invoiceList}>
                  <div className={styles.invoiceHeader}>
                    <div className={styles.headerCell}>Date</div>
                    <div className={styles.headerCell}>Invoice</div>
                    <div className={styles.headerCell}>Amount</div>
                    <div className={styles.headerCell}>Status</div>
                    <div className={styles.headerCell}>Actions</div>
                  </div>
                  
                  {billingHistory.map((invoice) => (
                    <div key={invoice.id} className={styles.invoiceItem}>
                      <div className={styles.invoiceInfo}>
                        <div className={styles.invoiceDate}>
                          {formatDate(invoice.invoiceDate)}
                        </div>
                        <div className={styles.invoiceDetails}>
                          <div className={styles.invoiceNumber}>#{invoice.number}</div>
                          <div className={styles.invoiceDescription}>{invoice.description}</div>
                          {invoice.paymentMethod && (
                            <div className={styles.paymentMethodUsed}>
                              {invoice.paymentMethod.brand?.toUpperCase()} ****{invoice.paymentMethod.last4}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={styles.invoiceAmount}>
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </div>
                      <div className={`${styles.invoiceStatus} ${styles[invoice.status]}`}>
                        <span className={styles.statusIcon}>
                          {invoice.status === 'paid' ? '✅' : 
                           invoice.status === 'open' ? '⏳' : 
                           invoice.status === 'void' ? '❌' : '📄'}
                        </span>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </div>
                      <div className={styles.invoiceActions}>
                        {invoice.hostedInvoiceUrl && (
                          <a 
                            href={invoice.hostedInvoiceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={styles.invoiceLink}
                            title="View invoice"
                          >
                            👁️ View
                          </a>
                        )}
                        {(invoice.invoicePdf || invoice.id) && (
                          <button
                            onClick={() => downloadInvoice(invoice.id, invoice.number)}
                            className={styles.downloadButton}
                            title="Download PDF"
                          >
                            📥 Download
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {hasMoreInvoices && (
                  <div className={styles.paginationContainer}>
                    <button
                      onClick={loadMoreInvoices}
                      disabled={billingLoading}
                      className={`${styles.button} ${styles.secondary} ${styles.loadMoreButton}`}
                    >
                      {billingLoading ? (
                        <>
                          <span className={styles.spinner}></span>
                          Loading...
                        </>
                      ) : (
                        'Load More Invoices'
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.emptyState}>
                <h3>No Billing History</h3>
                <p>You don't have any invoices yet. Your first invoice will appear here after your first payment.</p>
              </div>
            )}
          </div>
        )}

        {/* Payment Methods Tab */}
        {activeTab === 'payment' && (
          <div className={styles.paymentTab}>
            <div className={styles.sectionHeader}>
              <h2>Payment Methods</h2>
              <p>Manage your payment methods securely through Stripe</p>
            </div>

            {paymentMethods.length > 0 ? (
              <div className={styles.paymentMethodList}>
                {paymentMethods.map((method) => {
                  const isExpiringSoon = method.card && isCardExpiringSoon(method.card);
                  const isExpired = method.card && isCardExpired(method.card);
                  
                  return (
                    <div key={method.id} className={styles.paymentMethodItem}>
                      <div className={styles.cardInfo}>
                        <div className={styles.cardHeader}>
                          <div className={styles.cardBrand}>
                            <span className={styles.cardIcon}>
                              {getCardIcon(method.card?.brand)}
                            </span>
                            {method.card?.brand?.toUpperCase()} ****{method.card?.last4}
                          </div>
                          {method.isDefault && (
                            <span className={styles.defaultBadge}>Default</span>
                          )}
                        </div>
                        
                        <div className={styles.cardDetails}>
                          <div className={styles.cardExpiry}>
                            Expires {method.card?.expMonth?.toString().padStart(2, '0')}/{method.card?.expYear}
                          </div>
                          
                          {isExpired && (
                            <div className={styles.expiredWarning}>
                              <span className={styles.warningIcon}>⚠️</span>
                              Card expired
                            </div>
                          )}
                          
                          {isExpiringSoon && !isExpired && (
                            <div className={styles.expiringWarning}>
                              <span className={styles.warningIcon}>⚠️</span>
                              Expires soon
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <h3>No Payment Methods</h3>
                <p>Add a payment method to manage your subscription.</p>
              </div>
            )}

            <div className={styles.paymentActions}>
              <p className={styles.portalNote}>
                Contact support to manage your payment methods.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Cancellation Modal */}
      <CancellationModal
        show={showCancellationModal}
        onClose={() => setShowCancellationModal(false)}
        subscription={subscription}
        userId={user?.uid}
        onCancellationSuccess={handleCancellationSuccess}
      />

      {/* Plan Change Modal */}
      <PlanChangeModal
        show={showPlanChangeModal}
        onClose={() => setShowPlanChangeModal(false)}
        currentSubscription={subscription}
        userId={user?.uid}
        onPlanChangeSuccess={handlePlanChangeSuccess}
      />
    </div>
  </>);
}