'use client';

import { useState } from 'react';
import { cancelSubscription } from '../../services/subscriptionService';
import styles from './CancellationModal.module.css';

const CANCELLATION_REASONS = [
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'not_using', label: 'Not using the service enough' },
  { value: 'missing_features', label: 'Missing features I need' },
  { value: 'found_alternative', label: 'Found a better alternative' },
  { value: 'technical_issues', label: 'Technical issues' },
  { value: 'temporary_pause', label: 'Temporary pause' },
  { value: 'other', label: 'Other' }
];

export default function CancellationModal({ 
  show, 
  onClose, 
  subscription, 
  userId, 
  onCancellationSuccess 
}) {
  const [step, setStep] = useState(1); // 1: reason, 2: confirmation, 3: success
  const [selectedReason, setSelectedReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleReasonSelect = (reason) => {
    setSelectedReason(reason);
    setError(null);
  };

  const handleNext = () => {
    if (!selectedReason) {
      setError('Please select a reason for cancellation');
      return;
    }
    setStep(2);
  };

  const handleConfirmCancellation = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await cancelSubscription(userId, {
        reason: selectedReason,
        feedback: feedback.trim()
      });

      if (result.success) {
        setStep(3);
        // Call success callback after a short delay to show success message
        setTimeout(() => {
          onCancellationSuccess?.(result);
          handleClose();
        }, 2000);
      } else {
        setError(result.error?.message || 'Failed to cancel subscription. Please try again.');
      }
    } catch (err) {
      console.error('Cancellation error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setStep(1);
      setSelectedReason('');
      setFeedback('');
      setError(null);
      onClose();
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!show) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            {step === 1 && 'Cancel Subscription'}
            {step === 2 && 'Confirm Cancellation'}
            {step === 3 && 'Subscription Cancelled'}
          </h2>
          {step !== 3 && (
            <button 
              className={styles.closeButton} 
              onClick={handleClose}
              disabled={loading}
            >
              ×
            </button>
          )}
        </div>

        {/* Step 1: Reason Selection */}
        {step === 1 && (
          <div className={styles.content}>
            <p className={styles.description}>
              We're sorry to see you go! Help us improve by letting us know why you're cancelling.
            </p>

            <div className={styles.reasonList}>
              {CANCELLATION_REASONS.map((reason) => (
                <label key={reason.value} className={styles.reasonOption}>
                  <input
                    type="radio"
                    name="cancellation_reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={(e) => handleReasonSelect(e.target.value)}
                    className={styles.reasonRadio}
                  />
                  <span className={styles.reasonLabel}>{reason.label}</span>
                </label>
              ))}
            </div>

            {selectedReason === 'other' && (
              <div className={styles.feedbackSection}>
                <label className={styles.feedbackLabel}>
                  Please tell us more:
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Your feedback helps us improve..."
                  className={styles.feedbackTextarea}
                  rows={3}
                />
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
                Keep Subscription
              </button>
              <button 
                className={`${styles.button} ${styles.primary}`}
                onClick={handleNext}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Confirmation */}
        {step === 2 && (
          <div className={styles.content}>
            <div className={styles.confirmationInfo}>
              <div className={styles.warningIcon}>⚠️</div>
              <h3 className={styles.confirmationTitle}>
                Are you sure you want to cancel?
              </h3>
              
              <div className={styles.cancellationDetails}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Current Plan:</span>
                  <span className={styles.detailValue}>
                    {subscription?.tier || 'N/A'} ({subscription?.billingCycle || 'N/A'})
                  </span>
                </div>
                
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Access Until:</span>
                  <span className={styles.detailValue}>
                    {formatDate(subscription?.currentPeriodEnd)}
                  </span>
                </div>
                
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>What happens next:</span>
                  <span className={styles.detailValue}>
                    You'll keep access to all features until {formatDate(subscription?.currentPeriodEnd)}.
                    After that, your account will revert to the free plan.
                  </span>
                </div>
              </div>

              <div className={styles.additionalFeedback}>
                <label className={styles.feedbackLabel}>
                  Any additional feedback? (Optional)
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Help us understand how we can improve..."
                  className={styles.feedbackTextarea}
                  rows={3}
                />
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
                className={`${styles.button} ${styles.danger}`}
                onClick={handleConfirmCancellation}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className={styles.spinner}></span>
                    Cancelling...
                  </>
                ) : (
                  'Yes, Cancel Subscription'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className={styles.content}>
            <div className={styles.successContent}>
              <div className={styles.successIcon}>✅</div>
              <h3 className={styles.successTitle}>
                Subscription Cancelled Successfully
              </h3>
              <p className={styles.successMessage}>
                Your subscription has been cancelled. You'll continue to have access 
                to all features until {formatDate(subscription?.currentPeriodEnd)}.
              </p>
              <p className={styles.successNote}>
                We've sent a confirmation email to your registered email address.
                You can reactivate your subscription anytime before it expires.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}