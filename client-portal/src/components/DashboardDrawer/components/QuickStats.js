'use client';

import styles from '../DashboardDrawer.dark.module.css';

const QuickStats = ({ dashboardStats, isLoading = false, credits = 0, creditsUsed = 0, creditsInfo = null }) => {
  if (isLoading) {
    return (
      <div className={styles.quickStats}>
        <div className={styles.stat}><div className={styles.statSkeleton}></div></div>
        <div className={styles.stat}><div className={styles.statSkeleton}></div></div>
        <div className={styles.stat}><div className={styles.statSkeleton}></div></div>
        <div className={styles.stat}><div className={styles.statSkeleton}></div></div>
      </div>
    );
  }

  if (!dashboardStats) {
    return null;
  }

  const formatNumber = (num) => {
    const n = Number(num ?? 0);
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toLocaleString();
  };

  return (
    <div className={styles.quickStats}>
      <div className={styles.stat} title="Total articles created">
        <span className={styles.statNumber}>
          {formatNumber(dashboardStats.articles?.total || 0)}
        </span>
        <span className={styles.statLabel}>Articles</span>
      </div>

      <div className={styles.stat} title="Published articles">
        <span className={styles.statNumber}>
          {formatNumber(dashboardStats.articles?.completed || 0)}
        </span>
        <span className={styles.statLabel}>Published</span>
      </div>

      <div className={styles.stat} title="Total words written">
        <span className={styles.statNumber}>
          {formatNumber(dashboardStats.usage?.totalWords || 0)}
        </span>
        <span className={styles.statLabel}>Words</span>
      </div>

      <div className={styles.stat} title={creditsInfo?.isAgencyCredits ? `Agency credits from ${creditsInfo.agencyName}` : "Available credits"}>
        <span className={styles.statNumber} style={{ color: (credits - creditsUsed) > 0 ? '#0f172a' : '#FF6B6B' }}>
          {formatNumber(Math.max(0, (credits || 0) - (creditsUsed || 0)))}
        </span>
        <span className={styles.statLabel}>
          {creditsInfo?.isAgencyCredits ? 'Agency Credits' : 'Credits'}
        </span>
      </div>
    </div>
  );
};

export default QuickStats;