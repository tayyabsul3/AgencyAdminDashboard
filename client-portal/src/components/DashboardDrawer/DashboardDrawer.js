'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './DashboardDrawer.dark.module.css';
import UserProfile from './components/UserProfile';
import QuickStats from './components/QuickStats';
import { logOut } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../hooks/useSubscription';
import { canManageSubscription } from '../../utils/agencyProtection';

// Hamburger Icon Component
const HamburgerIcon = ({ isOpen, onClick }) => {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <button
      className={`${styles.hamburgerIcon} ${isOpen ? styles.hamburgerIconOpen : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={isOpen ? "Close dashboard menu" : "Open dashboard menu"}
      aria-expanded={isOpen}
      aria-controls="dashboard-drawer"
      type="button"
    >
      <span className={styles.hamburgerLine}></span>
      <span className={styles.hamburgerLine}></span>
      <span className={styles.hamburgerLine}></span>
    </button>
  );
};

const DashboardDrawer = ({
  isOpen,
  onClose,
  user,
  onLogout,
  dashboardStats = null,
  isLoadingStats = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef(null);
  const firstFocusableElementRef = useRef(null);
  const lastFocusableElementRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Get credits information from auth context
  const { credits, creditsUsed, user: authUser, subscription } = useAuth();
  
  // Get full subscription info including agency data for client tier users
  const { credits: fullCreditsInfo } = useSubscription(authUser?.uid);

  // Check if user can manage subscription (not agency clients)
  const showSubscriptionLink = canManageSubscription(subscription);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Mobile viewport and performance optimizations
  useEffect(() => {
    // Only run on client side to prevent hydration mismatches
    if (typeof window === 'undefined') return;

    // Handle mobile viewport changes (orientation, keyboard)
    const handleViewportChange = () => {
      if (isOpen && window.innerWidth <= 576) {
        // Update CSS custom properties for mobile viewport
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);

        // Handle virtual keyboard on mobile
        const visualViewport = window.visualViewport;
        if (visualViewport) {
          const handleViewportResize = () => {
            const keyboardHeight = window.innerHeight - visualViewport.height;
            document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
          };

          visualViewport.addEventListener('resize', handleViewportResize);
          return () => visualViewport.removeEventListener('resize', handleViewportResize);
        }
      }
    };

    // Optimize performance on mobile
    const optimizeForMobile = () => {
      if (window.innerWidth <= 576) {
        // Reduce animation complexity on lower-end devices
        const isLowEndDevice = navigator.hardwareConcurrency <= 2 ||
                              navigator.deviceMemory <= 2 ||
                              /Android.*Chrome\/[0-5]/.test(navigator.userAgent);

        if (isLowEndDevice) {
          document.documentElement.style.setProperty('--reduced-animations', '1');
        }

        // Optimize scrolling performance
        if (drawerRef.current) {
          drawerRef.current.style.scrollBehavior = 'auto';
        }
      }
    };

    if (isOpen) {
      handleViewportChange();
      optimizeForMobile();

      // Listen for orientation changes
      window.addEventListener('orientationchange', handleViewportChange);
      window.addEventListener('resize', handleViewportChange);

      return () => {
        window.removeEventListener('orientationchange', handleViewportChange);
        window.removeEventListener('resize', handleViewportChange);
        // Clean up CSS custom properties
        document.documentElement.style.removeProperty('--vh');
        document.documentElement.style.removeProperty('--keyboard-height');
        document.documentElement.style.removeProperty('--reduced-animations');
      };
    }
  }, [isOpen]);

  // Focus trap and keyboard navigation
  useEffect(() => {
    const getFocusableElements = () => {
      if (!drawerRef.current) return [];
      
      const focusableSelectors = [
        'button:not([disabled])',
        'a[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(', ');
      
      return Array.from(drawerRef.current.querySelectorAll(focusableSelectors));
    };

    const handleKeyDown = (event) => {
      if (!isOpen) return;

      // Handle Escape key
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      // Handle Tab key for focus trap
      if (event.key === 'Tab') {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          // Shift + Tab: moving backwards
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: moving forwards
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    // Enhanced body scroll prevention with mobile optimizations
    const preventBodyScroll = () => {
      // Only run on client side
      if (typeof window === 'undefined') return 0;

      const scrollY = window.scrollY;

      // Mobile-specific scroll prevention
      if (window.innerWidth <= 576) {
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
        // Prevent iOS bounce scrolling
        document.body.style.overscrollBehavior = 'none';
        document.body.style.touchAction = 'none';
      } else {
        // Desktop scroll prevention
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = `${window.innerWidth - document.documentElement.clientWidth}px`;
      }

      return scrollY;
    };

    const restoreBodyScroll = (scrollY) => {
      // Only run on client side
      if (typeof window === 'undefined') return;

      if (window.innerWidth <= 576) {
        // Mobile scroll restoration
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        document.body.style.overscrollBehavior = '';
        document.body.style.touchAction = '';
        // Restore scroll position smoothly on mobile
        window.requestAnimationFrame(() => {
          window.scrollTo(0, scrollY);
        });
      } else {
        // Desktop scroll restoration
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        window.scrollTo(0, scrollY);
      }
    };

    let savedScrollY = 0;

    if (isOpen) {
      // Store the previously focused element
      previousActiveElementRef.current = document.activeElement;
      
      // Add event listener for keyboard navigation
      document.addEventListener('keydown', handleKeyDown);
      
      // Prevent body scroll when drawer is open with enhanced method
      savedScrollY = preventBodyScroll();
      
      // Focus the first focusable element after a short delay to ensure drawer is rendered
      setTimeout(() => {
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }, 100);

      // Announce drawer opening to screen readers
      announceToScreenReader('Dashboard navigation drawer opened');
    } else {
      // Restore focus to previously focused element
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
      }
      
      // Restore body scroll with enhanced method
      restoreBodyScroll(savedScrollY);
      
      // Announce drawer closing to screen readers
      announceToScreenReader('Dashboard navigation drawer closed');
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Ensure body scroll is restored on cleanup
      restoreBodyScroll(savedScrollY);
    };
  }, [isOpen, onClose]);

  const handleLinkClick = (href, label) => {
    // Optional: Track navigation events for analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'dashboard_navigation', {
        'destination': href,
        'label': label
      });
    }
    onClose();
  };

  const handleButtonKeyDown = (event, action) => {
    // Handle Enter and Space key presses for buttons
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  const handleExternalLink = (url) => {
    // Handle external links by opening in new tab
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      if (typeof onLogout === 'function') {
        await onLogout();
      } else {
        const { error } = await logOut();
        if (error) {
          console.error('Logout error:', error);
        }
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      onClose();
      setIsLoggingOut(false);
    }
  };


  const isCurrentPage = (href) => {
    return pathname === href;
  };

  const handleBackdropClick = (event) => {
    // Ensure we only close when clicking the backdrop itself, not its children
    if (event.target === event.currentTarget) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  // Enhanced outside click detection using mousedown for better UX
  const handleBackdropMouseDown = (event) => {
    // Only handle if clicking directly on backdrop
    if (event.target === event.currentTarget) {
      event.preventDefault();
    }
  };

  // Enhanced touch events for mobile devices with better performance
  const handleBackdropTouchStart = (event) => {
    // Only handle if touching directly on backdrop
    if (event.target === event.currentTarget) {
      event.preventDefault();
      // Store touch start position for swipe detection
      const touch = event.touches[0];
      event.currentTarget.touchStartX = touch.clientX;
      event.currentTarget.touchStartY = touch.clientY;
      event.currentTarget.touchStartTime = Date.now();
    }
  };

  const handleBackdropTouchEnd = (event) => {
    // Only handle if touching directly on backdrop
    if (event.target === event.currentTarget) {
      event.preventDefault();
      event.stopPropagation();
      
      // Check if this was a tap (not a swipe)
      const touch = event.changedTouches[0];
      const touchEndX = touch.clientX;
      const touchEndY = touch.clientY;
      const touchStartX = event.currentTarget.touchStartX || touchEndX;
      const touchStartY = event.currentTarget.touchStartY || touchEndY;
      const touchDuration = Date.now() - (event.currentTarget.touchStartTime || 0);
      
      const deltaX = Math.abs(touchEndX - touchStartX);
      const deltaY = Math.abs(touchEndY - touchStartY);
      const isSwipe = deltaX > 30 || deltaY > 30;
      const isTap = !isSwipe && touchDuration < 300;
      
      if (isTap) {
        onClose();
      }
    }
  };

  // Handle swipe gestures to close drawer on mobile
  const handleDrawerTouchStart = (event) => {
    if (window.innerWidth <= 576) { // Only on mobile
      const touch = event.touches[0];
      event.currentTarget.swipeStartX = touch.clientX;
      event.currentTarget.swipeStartTime = Date.now();
    }
  };

  const handleDrawerTouchMove = (event) => {
    if (window.innerWidth <= 576 && event.currentTarget.swipeStartX !== undefined) {
      const touch = event.touches[0];
      const deltaX = touch.clientX - event.currentTarget.swipeStartX;
      
      // If swiping left and drawer is at the left edge, allow closing
      if (deltaX < -50 && event.currentTarget.scrollLeft === 0) {
        event.preventDefault();
        // Add visual feedback for swipe
        const opacity = Math.max(0.3, 1 - Math.abs(deltaX) / 200);
        event.currentTarget.style.opacity = opacity;
      }
    }
  };

  const handleDrawerTouchEnd = (event) => {
    if (window.innerWidth <= 576 && event.currentTarget.swipeStartX !== undefined) {
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - event.currentTarget.swipeStartX;
      const swipeDuration = Date.now() - event.currentTarget.swipeStartTime;
      
      // Reset opacity
      event.currentTarget.style.opacity = '';
      
      // Close drawer if swiped left significantly or fast
      if ((deltaX < -100 || (deltaX < -50 && swipeDuration < 300)) && event.currentTarget.scrollLeft === 0) {
        onClose();
      }
      
      // Clean up
      delete event.currentTarget.swipeStartX;
      delete event.currentTarget.swipeStartTime;
    }
  };

  // Enhanced screen reader announcement function with mobile optimizations
  const announceToScreenReader = (message) => {
    // Only run on client side
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.setAttribute('class', 'sr-only');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';

    // Add mobile-specific context to announcements
    const isMobile = window.innerWidth <= 576;
    const contextualMessage = isMobile
      ? `${message}. Swipe left to close or tap outside the drawer.`
      : `${message}. Press Escape to close or click outside the drawer.`;

    announcement.textContent = contextualMessage;

    document.body.appendChild(announcement);

    // Remove the announcement after it's been read (longer timeout for mobile)
    const timeout = isMobile ? 2000 : 1000;
    setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, timeout);
  };

  const handleProfileClick = () => {
    // Navigate to profile settings and close drawer
    handleLinkClick('/dashboard/profile', 'Profile Settings');
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ''}`}
        onClick={handleBackdropClick}
        onMouseDown={handleBackdropMouseDown}
        onTouchStart={handleBackdropTouchStart}
        onTouchEnd={handleBackdropTouchEnd}
        aria-hidden="true"
        role="presentation"
      />
      
      {/* Drawer */}
      <div 
        id="dashboard-drawer"
        ref={drawerRef}
        className={`${styles.drawer} ${styles.glassmorphism} ${styles.willChange} ${isOpen ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard navigation drawer"
        aria-describedby="drawer-description"
        onTouchStart={handleDrawerTouchStart}
        onTouchMove={handleDrawerTouchMove}
        onTouchEnd={handleDrawerTouchEnd}
      >
        {/* Hidden description for screen readers */}
        <div id="drawer-description" className={styles.srOnly}>
          Dashboard navigation drawer with user profile, quick stats, and navigation for dashboard, articles, and creating new content.
        </div>

        {/* User Profile Section */}
        <UserProfile 
          user={user} 
          onProfileClick={handleProfileClick}
          isLoading={!user}
        />
        
        {/* Quick Stats Section */}
        <QuickStats
          dashboardStats={dashboardStats}
          isLoading={isLoadingStats}
          credits={credits}
          creditsUsed={creditsUsed}
          creditsInfo={fullCreditsInfo}
        />

        {/* Navigation Content */}
        <div className={`${styles.drawerContent} ${styles.dFlex} ${styles.flexColumn} ${styles.willChange}`}>
          <nav 
            className={`${styles.navigation} ${styles.dFlex} ${styles.flexColumn} ${styles.flex1}`}
            aria-label="Dashboard navigation"
          >
            {/* Main Dashboard */}
            <div className={`${styles.navSection} ${styles.dFlex} ${styles.flexColumn}`} role="group" aria-labelledby="main-dashboard-section">
              <h3 id="main-dashboard-section" className={`${styles.sectionTitle} ${styles.textSm}`}>Dashboard</h3>
              <Link
                href="/dashboard"
                className={`${styles.navItem} ${styles.dFlex} ${styles.alignItemsCenter} ${styles.touchTarget}`}
                onClick={() => handleLinkClick('/dashboard', 'Overview')}
                aria-current={isCurrentPage('/dashboard') ? 'page' : undefined}
              >
                <span className={styles.navIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                </span>
                <span className={`${styles.textBase} ${styles.navText}`}>Overview</span>
              </Link>
            </div>

            {/* Content Management */}
            <div className={`${styles.navSection} ${styles.dFlex} ${styles.flexColumn}`} role="group" aria-labelledby="content-section">
              <h3 id="content-section" className={`${styles.sectionTitle} ${styles.textSm}`}>Content</h3>
              <Link
                href="/dashboard/articles"
                className={`${styles.navItem} ${styles.dFlex} ${styles.alignItemsCenter} ${styles.touchTarget}`}
                onClick={() => handleLinkClick('/dashboard/articles', 'My Articles')}
                aria-current={isCurrentPage('/dashboard/articles') ? 'page' : undefined}
              >
                <span className={styles.navIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </span>
                <span className={`${styles.textBase} ${styles.navText}`}>My Articles</span>
              </Link>
              <Link
                href="/dashboard/articles/wordpress"
                className={`${styles.navItem} ${styles.dFlex} ${styles.alignItemsCenter} ${styles.touchTarget}`}
                onClick={() => handleLinkClick('/dashboard/articles/wordpress', 'Published Articles')}
                aria-current={isCurrentPage('/dashboard/articles/wordpress') ? 'page' : undefined}
              >
                <span className={styles.navIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
                    <path d="M4 12h16M12 2c2.5 3.5 2.5 16.5 0 20M12 2c-2.5 3.5-2.5 16.5 0 20"/>
                  </svg>
                </span>
                <span className={`${styles.textBase} ${styles.navText}`}>Published Articles</span>
              </Link>
            </div>

            {/* Creation Tools */}
            <div className={`${styles.navSection} ${styles.dFlex} ${styles.flexColumn}`} role="group" aria-labelledby="creation-section">
              <h3 id="creation-section" className={`${styles.sectionTitle} ${styles.textSm}`}>Create</h3>
              <Link
                href="/dashboard/create/keyword/"
                className={`${styles.navItem} ${styles.dFlex} ${styles.alignItemsCenter} ${styles.touchTarget}`}
                onClick={() => handleLinkClick('/dashboard/create/keyword/', 'Create from Keyword')}
                aria-current={isCurrentPage('/dashboard/create/keyword/') ? 'page' : undefined}
              >
                <span className={styles.navIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                </span>
                <span className={`${styles.textBase} ${styles.navText}`}>From Keyword</span>
              </Link>
            </div>

            {/* Account & Settings */}
            <div className={`${styles.navSection} ${styles.dFlex} ${styles.flexColumn}`} role="group" aria-labelledby="account-section">
              <h3 id="account-section" className={`${styles.sectionTitle} ${styles.textSm}`}>Account</h3>
              {/* Only show subscription link for non-agency client users */}
              {showSubscriptionLink && (
                <Link
                  href="/dashboard/subscription"
                  className={`${styles.navItem} ${styles.dFlex} ${styles.alignItemsCenter} ${styles.touchTarget}`}
                  onClick={() => handleLinkClick('/dashboard/subscription', 'Subscription')}
                  aria-current={isCurrentPage('/dashboard/subscription') ? 'page' : undefined}
                >
                  <span className={styles.navIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                      <line x1="8" y1="21" x2="16" y2="21"/>
                      <line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                  </span>
                  <span className={`${styles.textBase} ${styles.navText}`}>Subscription</span>
                </Link>
              )}
              <Link
                href="/dashboard/profile"
                className={`${styles.navItem} ${styles.dFlex} ${styles.alignItemsCenter} ${styles.touchTarget}`}
                onClick={() => handleLinkClick('/dashboard/profile', 'Profile Settings')}
                aria-current={isCurrentPage('/dashboard/profile') ? 'page' : undefined}
              >
                <span className={styles.navIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </span>
                <span className={`${styles.textBase} ${styles.navText}`}>Profile</span>
              </Link>
            </div>


          </nav>

          {/* Logout Section */}
          <div className={`${styles.authSection} ${styles.dFlex} ${styles.flexColumn}`}>
            <button 
              className={`${styles.logoutButton} ${styles.dFlex} ${styles.alignItemsCenter} ${styles.touchTargetLarge} ${styles.w100}`} 
              onClick={handleLogout}
              onKeyDown={(e) => handleButtonKeyDown(e, handleLogout)}
              type="button"
              aria-label="Logout from your account"
              disabled={isLoggingOut}
              aria-busy={isLoggingOut ? 'true' : undefined}
            >
              <span className={styles.navIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </span>
              <span className={`${styles.textBase} ${styles.navText}`}>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// Export both components
export { HamburgerIcon };
export default DashboardDrawer;