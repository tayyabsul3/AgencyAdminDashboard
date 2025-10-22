'use client';

import styles from '../DashboardDrawer.dark.module.css';
import { useAuth } from '../../../contexts/AuthContext';

const UserProfile = ({ user, onProfileClick, isLoading = false }) => {
  const { subscriptionTier, subscriptionLoading, hasActiveSubscription } = useAuth();

  const getUserInitials = (user) => {
    if (user?.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  const getUserDisplayName = (user) => {
    return user?.name || user?.email?.split('@')[0] || 'User';
  };

  const getPlanDisplayName = (tier) => {
    if (!tier) return 'Free Plan';

    switch (tier.toLowerCase()) {
      case 'free':
        return 'Free Plan';
      case 'starter':
        return 'Starter Plan';
      case 'growth':
        return 'Growth Plan';
      case 'scale':
        return 'Scale Plan';
      case 'client':
        return 'Client Plan';
      case 'agency_custom':
        return 'Agency Custom Plan';
      default:
        return `${tier} Plan`;
    }
  };

  const getPlanColor = (tier) => {
    if (!tier) return '#6B7280';

    switch (tier.toLowerCase()) {
      case 'starter':
        return '#6B7280';
      case 'growth':
        return '#10B981';
      case 'scale':
        return '#3B82F6';
      case 'client':
        return '#F59E0B';
      case 'agency_custom':
        return '#8B5CF6';
      default:
        return '#6B7280';
    }
  };

  if (isLoading) {
    return (
      <div className={`${styles.userProfileSection} ${styles.dFlex} ${styles.flexColumn} ${styles.loadingFadeIn}`}>
        <div className={styles.userProfileSkeleton}>
          <div className={styles.userAvatarSkeleton}></div>
          <div className={styles.userInfoSkeleton}>
            <div className={styles.userNameSkeleton}></div>
            <div className={styles.userEmailSkeleton}></div>
            <div className={styles.planStatusSkeleton}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.userProfileSection} ${styles.dFlex} ${styles.flexColumn} ${styles.loadingFadeIn}`}>
      <div 
        className={`${styles.dFlex} ${styles.alignItemsCenter}`} 
        style={{ 
          gap: '1rem', 
          cursor: onProfileClick ? 'pointer' : 'default',
          transition: 'all 0.3s ease',
          borderRadius: '10px',
          padding: '0.5rem',
          margin: '-0.5rem'
        }}
        onClick={onProfileClick}
        role={onProfileClick ? 'button' : undefined}
        tabIndex={onProfileClick ? 0 : undefined}
        onKeyDown={onProfileClick ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onProfileClick();
          }
        } : undefined}
        aria-label={onProfileClick ? 'View profile settings' : undefined}
      >
        <div className={styles.userAvatar}>
          {getUserInitials(user)}
        </div>
        <div className={`${styles.userInfo} ${styles.flex1}`}>
          <div className={`${styles.userName} ${styles.textBase}`}>
            {getUserDisplayName(user)}
          </div>
          <div className={`${styles.userEmail} ${styles.textSm}`}>
            {user?.email || 'user@example.com'}
          </div>
          {!subscriptionLoading && subscriptionTier && (
            <div
              className={`${styles.planStatus} ${styles.textSm}`}
              style={{
                color: getPlanColor(subscriptionTier),
                marginTop: '0.25rem'
              }}
            >
              {getPlanDisplayName(subscriptionTier)}
              {!hasActiveSubscription && (
                <span style={{ color: '#EF4444', marginLeft: '0.25rem' }}>
                  (Inactive)
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;