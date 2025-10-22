'use client';

import Link from 'next/link';
import styles from '../pricing.module.css';

const Cancel = () => {
  return (
    <div className={styles.pricing}>
      <div className={styles.container}>
        <div className={styles.cancel}>
          <div className={styles.cancelIcon}>
            ✕
          </div>

          <h1 className={styles.cancelTitle}>
            Payment Cancelled
          </h1>

          <p className={styles.cancelMessage}>
            No worries! Your payment was cancelled and you haven't been charged.
          </p>

          <div className={styles.cancelReasons}>
            <h3>Common reasons for cancellation:</h3>
            <ul>
              <li>You changed your mind</li>
              <li>You found a different plan that suits you better</li>
              <li>You have questions about the service</li>
            </ul>
          </div>

          <div className={styles.cancelActions}>
            <Link href="/pricing" className={styles.primaryBtn}>
              Try Again
            </Link>
            <Link href="/contact" className={styles.secondaryBtn}>
              Contact Support
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

export default Cancel;