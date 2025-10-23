'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './Drawer.module.css';

const Drawer = ({ isOpen, onClose, user, onLogout }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleLinkClick = () => {
    onClose();
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ''}`}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}>
        <div className={styles.drawerHeader}>
          <div className={styles.brandSection}>
            <span className={styles.logo}>⚡</span>
            <span className={styles.brandText}>QueryFuel</span>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.drawerContent}>
          {user && (
            <div className={styles.userSection}>
              <div className={styles.userAvatar}>
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>
                  {user.email?.split('@')[0]}
                </div>
                <div className={styles.userEmail}>
                  {user.email}
                </div>
              </div>
            </div>
          )}

          <nav className={styles.navigation}>
            <div className={styles.navSection}>
              <h3 className={styles.sectionTitle}>Navigation</h3>
              <Link href="/" className={styles.navItem} onClick={handleLinkClick}>
                <span className={styles.navIcon}>🏠</span>
                <span>Home</span>
              </Link>
              {user && (
                <Link href="/dashboard" className={styles.navItem} onClick={handleLinkClick}>
                  <span className={styles.navIcon}>📊</span>
                  <span>Dashboard</span>
                </Link>
              )}
              <Link href="/how-it-works" className={styles.navItem} onClick={handleLinkClick}>
                <span className={styles.navIcon}>❓</span>
                <span>How It Works</span>
              </Link>
              <Link href="/pricing" className={styles.navItem} onClick={handleLinkClick}>
                <span className={styles.navIcon}>💰</span>
                <span>Pricing</span>
              </Link>
              <Link href="/examples" className={styles.navItem} onClick={handleLinkClick}>
                <span className={styles.navIcon}>📝</span>
                <span>Examples</span>
              </Link>
            </div>

            {user && (
              <div className={styles.navSection}>
                <h3 className={styles.sectionTitle}>Create Content</h3>
                <div className={styles.navItem}>
                  <span className={styles.navIcon}>🎤</span>
                  <span>Voice Interview</span>
                </div>
                <div className={styles.navItem}>
                  <span className={styles.navIcon}>💬</span>
                  <span>Text Interview</span>
                </div>
                <div className={styles.navItem}>
                  <span className={styles.navIcon}>📄</span>
                  <span>Templates</span>
                </div>
              </div>
            )}

            <div className={styles.navSection}>
              <h3 className={styles.sectionTitle}>Support</h3>
              <Link href="/contact" className={styles.navItem} onClick={handleLinkClick}>
                <span className={styles.navIcon}>📞</span>
                <span>Contact</span>
              </Link>
              <div className={styles.navItem}>
                <span className={styles.navIcon}>❓</span>
                <span>Help Center</span>
              </div>
            </div>
          </nav>

          {user ? (
            <div className={styles.authSection}>
              <button className={styles.logoutButton} onClick={onLogout}>
                <span className={styles.navIcon}>🚪</span>
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className={styles.authSection}>
              <Link href="/login" className={styles.loginButton} onClick={handleLinkClick}>
                <span className={styles.navIcon}>🔑</span>
                <span>Sign In</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Drawer;