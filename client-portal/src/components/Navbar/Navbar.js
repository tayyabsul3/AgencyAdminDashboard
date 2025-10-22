'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import DashboardDrawer from '../DashboardDrawer/DashboardDrawer';
import styles from './Navbar.module.css';

const Navbar = ({ user = null, onLogout, dashboardStats = null, isLoadingStats = false }) => {
  const [isDashboardDrawerOpen, setIsDashboardDrawerOpen] = useState(false);
  const pathname = usePathname();

  const toggleDashboardDrawer = () => {
    setIsDashboardDrawerOpen(!isDashboardDrawerOpen);
  };

  const closeDashboardDrawer = () => {
    setIsDashboardDrawerOpen(false);
  };

  // Check if we're on a dashboard page
  const isDashboardPage = pathname?.startsWith('/dashboard');

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        {/* Dashboard Hamburger Icon - Only show on dashboard pages */}
        {isDashboardPage && user && (
          <button
            className={`${styles.dashboardToggle} ${isDashboardDrawerOpen ? styles.active : ''}`}
            onClick={toggleDashboardDrawer}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleDashboardDrawer();
              }
            }}
            aria-label={isDashboardDrawerOpen ? "Close dashboard settings menu" : "Open dashboard settings menu"}
            aria-expanded={isDashboardDrawerOpen}
            type="button"
          >
            <span className={styles.dashboardHamburger}></span>
            <span className={styles.dashboardHamburger}></span>
            <span className={styles.dashboardHamburger}></span>
          </button>
        )}

        <div className={styles.brand}>
          <Link href="/" className={styles.brandLink}>
            <span className={styles.logo}></span>
            <span className={styles.brandText}>QueryFuel</span>
          </Link>
        </div>

        <div className={styles.navLinks}>
          <Link href="/" className={styles.navLink}>Home</Link>
          <Link href="/how-it-works" className={styles.navLink}>How It Works</Link>
          <Link href="/pricing" className={styles.navLink}>Pricing</Link>
          <Link href="/examples" className={styles.navLink}>Examples</Link>
          <Link href="/contact" className={styles.navLink}>Contact</Link>
        </div>

        <div className={styles.authSection}>
          {user ? (
            <div className={styles.userMenu}>
              <Link href="/dashboard" className={styles.dashboardBtn}>
                Dashboard
              </Link>
              <button 
                onClick={onLogout} 
                className={styles.logoutBtn}
                type="button"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className={styles.authButtons}>
              <Link href="/login" className={styles.loginBtn}>
                Sign In
              </Link>
              <Link href="/signup" className={styles.signupBtn}>
                Start Creating
              </Link>
            </div>
          )}
        </div>


      </div>



      {/* Dashboard Drawer - Only render on dashboard pages */}
      {isDashboardPage && user && (
        <DashboardDrawer
          isOpen={isDashboardDrawerOpen}
          onClose={closeDashboardDrawer}
          user={user}
          onLogout={onLogout}
          dashboardStats={dashboardStats}
          isLoadingStats={isLoadingStats}
        />
      )}
    </nav>
  );
};

export default Navbar;