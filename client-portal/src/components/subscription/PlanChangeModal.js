'use client';

import { useState, useEffect } from 'react';
import { calculateProration, changePlan } from '../../services/subscriptionService';
import styles from './PlanChangeModal.module.css';

// Available plans for updates (excluding Agency Custom)
const AVAILABLE_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 97,
    credits: 4,
    billingCycle: 'monthly',
    features: [
      '4 credits / month',
      'Keyword → blog articles (1 credit each)',
      'Limited to 1 interview article / month (2 credits)',
      'Export to Google Docs, WordPress, Shopify, Webflow',
      'Standard email support'
    ]
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 197,
    credits: 10,
    billingCycle: 'monthly',
    features: [
      '10 credits / month',
      'Keyword blogs (1 credit) + Interview articles (2 credits)',
      'Unlimited interviews (credit-based)',
      'Enhanced articles with stats, FAQs, comparisons',
      'Unlimited projects & keywords',
      'Priority email support',
      '10% credit rollover month to month'
    ]
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 497,
    credits: 30,
    billingCycle: 'monthly',
    features: [
      '30 credits / month',
      'Keyword + Enhanced + Interview articles',
      'Priority chat support',
      '10% credit rollover month to month'
    ]
  }
];

export default function PlanChangeModal({ 
  show, 
  onClose, 
  currentSubscription, 
  userId, 
  onPlanChangeSuccess 
}) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [prorationData, setProrationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: plan selection, 2: confirmation

  useEffect(() => {
    if (show) {
      setStep(1);
      setSelectedPlan(null);
      setProrationData(null);
      setError(null);
    }
  }, [show]);

  const getCurrentPlanId = () => {
    return currentSubscription?.tier?.toLowerCase() || 'starter';
  };

  const isCurrentPlan = (planId) => {
    return planId === getCurrentPlanId();
  };

  const isUpgrade = (plan) => {
    if (!currentSubscription) return true;
    const currentPlan = AVAILABLE_PLANS.find(p => p.id === getCurrentPlanId());
    return currentPlan ? plan.price > currentPlan.price : true;
  };

  const handlePlanSelect = async (plan) => {
    if (isCurrentPlan(plan.id)) return;
    
    setSelectedPlan(plan);
    setError(null);
    setLoading(true);

    try {
      // Calculate proration for this plan change
      const result = await calculateProration(userId, plan.id, 'monthly');
      
      if (result.success) {
        setProrationData(result.proration);
      } else {
        setError(result.error?.message || 'Failed to calculate proration');
      }
    } catch (err) {
      console.error('Error calculating proration:', err);
      setError('Failed to calculate proration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!selectedPlan || !prorationData) {
      setError('Please select a plan to continue');
      return;
    }
    setStep(2);
  };

  const handleConfirmChange = async () => {
    if (!selectedPlan || !prorationData) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Initiating plan change:', { 
        selectedPlan: selectedPlan.id, 
        billingCycle: selectedPlan.billingCycle 
      });

      const result = await changePlan(userId, selectedPlan.id, selectedPlan.billingCycle);

      if (result.success && result.checkoutUrl) {
        console.log('✅ Plan change checkout created, redirecting to:', result.checkoutUrl);
        // Redirect to Stripe checkout
        window.location.href = result.checkoutUrl;
      } else {
        setError(result.error?.message || 'Failed to initiate plan change. Please try again.');
      }
    } catch (err) {
      console.error('Plan change error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setStep(1);
      setSelectedPlan(null);
      setProrationData(null);
      setError(null);
      onClose();
    }
  };

  if (!show) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            {step === 1 ? 'Change Your Plan' : 'Confirm Plan Change'}
          </h2>
          <button 
            className={styles.closeButton} 
            onClick={handleClose}
            disabled={loading}
          >
            ×
          </button>
        </div>

        {/* Step 1: Plan Selection */}
        {step === 1 && (
          <div className={styles.content}>
            <p className={styles.description}>
              Choose a new plan. Upgrades include proration credit, downgrades are charged the full amount.
            </p>

            <div className={styles.planGrid}>
              {AVAILABLE_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`${styles.planCard} ${
                    isCurrentPlan(plan.id) ? styles.currentPlan : ''
                  } ${
                    selectedPlan?.id === plan.id ? styles.selectedPlan : ''
                  }`}
                  onClick={() => handlePlanSelect(plan)}
                >
                  <div className={styles.planHeader}>
                    <h3 className={styles.planName}>{plan.name}</h3>
                    <div className={styles.planPrice}>
                      <span className={styles.price}>${plan.price}</span>
                      <span className={styles.period}>/month</span>
                    </div>
                  </div>

                  <div className={styles.planCredits}>
                    {plan.credits} credits/month
                  </div>

                  <ul className={styles.planFeatures}>
                    {plan.features.slice(0, 3).map((feature, index) => (
                      <li key={index} className={styles.planFeature}>
                        <span className={styles.featureIcon}>✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isCurrentPlan(plan.id) && (
                    <div className={styles.currentPlanBadge}>
                      Current Plan
                    </div>
                  )}

                  {!isCurrentPlan(plan.id) && (
                    <div className={styles.planAction}>
                      <span className={`${styles.actionText} ${
                        isUpgrade(plan) ? styles.upgrade : styles.downgrade
                      }`}>
                        {isUpgrade(plan) ? 'Upgrade' : 'Downgrade'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Proration Preview */}
            {selectedPlan && prorationData && (
              <div className={styles.prorationPreview}>
                <h4>Pricing Details</h4>
                <div className={styles.prorationDetails}>
                  <div className={styles.prorationRow}>
                    <span>New Plan Price:</span>
                    <span>{prorationData.newPlan.price}</span>
                  </div>
                  {prorationData.isUpgrade && prorationData.prorationCredit > 0 && (
                    <div className={styles.prorationRow}>
                      <span>Proration Credit:</span>
                      <span className={styles.credit}>-{prorationData.prorationCreditDisplay}</span>
                    </div>
                  )}
                  <div className={`${styles.prorationRow} ${styles.total}`}>
                    <span><strong>Amount to Charge:</strong></span>
                    <span><strong>{prorationData.finalAmountDisplay}</strong></span>
                  </div>
                  <div className={styles.prorationNote}>
                    <small>{prorationData.breakdown.message}</small>
                  </div>
                </div>
              </div>
            )}

            {loading && selectedPlan && (
              <div className={styles.loadingProration}>
                <span className={styles.spinner}></span>
                Calculating proration...
              </div>
            )}

            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}

            <div className={styles.actions}>
              <button 
                className={`${styles.button} ${styles.secondary}`}
                onClick={handleClose}
              >
                Cancel
              </button>
              <button 
                className={`${styles.button} ${styles.primary}`}
                onClick={handleContinue}
                disabled={!selectedPlan || !prorationData || loading}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Confirmation */}
        {step === 2 && selectedPlan && prorationData && (
          <div className={styles.content}>
            <div className={styles.confirmationContent}>
              <h3>Confirm Plan Change</h3>
              
              <div className={styles.planComparison}>
                <div className={styles.comparisonItem}>
                  <h4>Current Plan</h4>
                  <p>{prorationData.currentPlan.tier} - {prorationData.currentPlan.price}/month</p>
                </div>
                <div className={styles.arrow}>→</div>
                <div className={styles.comparisonItem}>
                  <h4>New Plan</h4>
                  <p>{selectedPlan.name} - ${selectedPlan.price}/month</p>
                </div>
              </div>

              <div className={styles.finalProration}>
                <h4>Billing Summary</h4>
                <div className={styles.billingDetails}>
                  <div className={styles.billingRow}>
                    <span>New Plan Price:</span>
                    <span>{prorationData.newPlan.price}</span>
                  </div>
                  {prorationData.isUpgrade && prorationData.prorationCredit > 0 && (
                    <>
                      <div className={styles.billingRow}>
                        <span>Proration Credit ({prorationData.daysRemaining} days remaining):</span>
                        <span className={styles.credit}>-{prorationData.prorationCreditDisplay}</span>
                      </div>
                      <div className={styles.billingNote}>
                        <small>{prorationData.breakdown.calculation}</small>
                      </div>
                    </>
                  )}
                  <div className={`${styles.billingRow} ${styles.total}`}>
                    <span><strong>Total Charge Today:</strong></span>
                    <span><strong>{prorationData.finalAmountDisplay}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}

            <div className={styles.actions}>
              <button 
                className={`${styles.button} ${styles.secondary}`}
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Back
              </button>
              <button 
                className={`${styles.button} ${styles.primary}`}
                onClick={handleConfirmChange}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Confirm Change'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}