'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import DashboardDrawer from '../DashboardDrawer/DashboardDrawer';
import { useAuth } from '../../contexts/AuthContext';
import { useErrorAndLoading } from '../../hooks/useErrorAndLoading';
import { getArticleStats } from '../../services/articleService';
import { canSeePricing } from '../../utils/agencyProtection';


/**
 * LandingNavbar
 * A reusable Bootstrap-only navbar shell used across public pages.
 * Props:
 * - containerClass: additional classes for the outer container (e.g., spacing). Defaults to 'mt-2 mb-2'.
 * - innerClass: additional classes for the inner rounded bar. Defaults to 'p-2'.
 * - showDrawer: whether to render the drawer toggle and DashboardDrawer. Defaults to true.
 * - getStartedHref: href for the Get Started button. Defaults to '/login'.
 */
export default function LandingNavbar({ containerClass = 'mt-2 mb-2', innerClass = 'p-2', showDrawer = true, hideGetStarted = false, getStartedHref = '/login', maxWidth = '1140px' }) {
  const { user, logout, subscription } = useAuth() || { user: null, logout: async () => {}, subscription: null };
  const { executeAsync, isLoading: isLoadingHook } = useErrorAndLoading() || { executeAsync: async (fn) => fn(), isLoading: false };
  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isDashboardDrawerOpen, setIsDashboardDrawerOpen] = useState(false);

  // Check if user can see pricing/contact links (not agency clients)
  const showPricingLinks = canSeePricing(subscription);

  const toggleDashboardDrawer = useCallback(() => {
    setIsDashboardDrawerOpen((prev) => !prev);
  }, []);

  const closeDashboardDrawer = useCallback(() => {
    setIsDashboardDrawerOpen(false);
  }, []);

  // Load article stats when authenticated so the drawer shows the same quick stats
  useEffect(() => {
    const loadStats = async () => {
      if (!user?.uid) return;
      try {
        setIsLoadingStats(true);
        const statsData = await (executeAsync ? executeAsync(() => getArticleStats(user.uid), 'loadStatsForNavbar') : getArticleStats(user.uid));
        setStats(statsData);
      } catch (e) {
        // Fallback to zeros so the drawer remains consistent
        setStats({
          total: 0,
          completed: 0,
          inProgress: 0,
          drafts: 0,
          totalWords: 0,
          recentActivity: []
        });
      } finally {
        setIsLoadingStats(false);
      }
    };
    loadStats();
  }, [user?.uid, executeAsync]);

  // Compute dashboardStats in the same shape expected by DashboardDrawer -> QuickStats
  const dashboardStats = useMemo(() => {
    if (!user) return null;
    if (!stats) return {
      articles: { total: 0, completed: 0, inProgress: 0, drafts: 0 },
      usage: { totalWords: 0, monthlyWords: 0, timeSaved: '0%' },
      activity: { lastLogin: new Date(), recentActions: [] }
    };
    return {
      articles: {
        total: stats.total || 0,
        completed: stats.completed || 0,
        inProgress: stats.inProgress || 0,
        drafts: stats.drafts || 0
      },
      usage: {
        totalWords: stats.totalWords || 0,
        monthlyWords: stats.totalWords || 0,
        timeSaved: '95%'
      },
      activity: {
        lastLogin: new Date(),
        recentActions: (stats.recentActivity || []).map(a => ({ action: a.action, timestamp: a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp || Date.now()) }))
      }
    };
  }, [stats, user]);

  const handleLogout = useCallback(async () => {
    try { await (logout ? logout() : Promise.resolve()); } finally { closeDashboardDrawer(); }
  }, [logout, closeDashboardDrawer]);

  return (
    <div className="bg-transparent">
      <div className={`container d-flex justify-content-center ${containerClass}`}>
        <div
          className={`d-flex align-items-center justify-content-between flex-nowrap px-2 px-sm-3 ${innerClass}`}
          style={{
            width: '100%',
            maxWidth: maxWidth,
            minHeight: '89.42424011230469px',
            height: 'auto',
            background: '#F4F4F4',
            border: '1px solid #C2C2C2',
            borderRadius: '14px',
            backdropFilter: 'blur(24px)'
          }}
        >
          <div className="d-flex align-items-center flex-shrink-1" style={{ gap: '7.5px' }}>
            {/* Drawer toggle button (left of logo) */}
            {showDrawer && (
              <button
                className="btn btn-outline-secondary d-flex align-items-center justify-content-center"
                type="button"
                onClick={toggleDashboardDrawer}
                aria-label={isDashboardDrawerOpen ? 'Close menu' : 'Open menu'}
                style={{ width: '44px', height: '44px', marginLeft: '8px', borderRadius: '8px' }}
              >
                <i className="bi bi-list" style={{ fontSize: '20px' }}></i>
              </button>
            )}
            <Link href="/" className="text-decoration-none d-flex align-items-center">
              <img
                src="/images/Queryfuel logo.svg"
                width={29}
                height={41}
                alt="QueryFuel logo"
                className="me-2"
                style={{
                  width: '29px',
                  height: '41px',
                  marginLeft: '8px',
                  transform: 'rotate(0deg)'
                }}
              />
              <span className="fw-semibold text-dark d-inline-block text-truncate" style={{ fontSize: '26px', maxWidth: '45vw' }}>
                QueryFuel
              </span>
            </Link>
          </div>

          <div className="d-none d-md-flex align-items-center gap-4 flex-grow-1 justify-content-center">
            <Link className="text-dark text-decoration-none" href="/dashboard">Home</Link>
            {/* <a className="text-dark text-decoration-none" href="#">About</a> */}
            {!user && <Link className="text-dark text-decoration-none" href="/login">Sign In</Link>}
            <Link className="text-dark text-decoration-none" href="/how-to">Example Article</Link>
            {/* Only show Pricing and Contact links for non-agency client users */}
            {showPricingLinks && (
              <>
                <Link className="text-dark text-decoration-none" href="/pricing">Pricing</Link>
                {/* <a className="text-dark text-decoration-none" href="#">Blogs</a> */}
                <Link className="text-dark text-decoration-none" href="/contact">Contact</Link>
              </>
            )}
          </div>

          {!hideGetStarted && (
            <div className="ms-auto flex-shrink-0">
              {user ? (
                <button
                  onClick={handleLogout}
                  className="btn text-white d-none d-md-inline-flex align-items-center gap-2 fw-semibold me-2"
                  style={{
                    width: 'auto',
                    height: '56px',
                    background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)',
                    boxShadow: '0 6px 18px rgba(220, 38, 38, 0.35)',
                    padding: '14px 24px',
                    borderRadius: '8px',
                    border: '4px solid transparent',
                    justifyContent: 'center',
                    fontSize: '16px',
                    lineHeight: '24px'
                  }}
                >
                  <i className="bi bi-box-arrow-right"></i>
                  Sign Out
                </button>
              ) : (
                <Link
                  href={getStartedHref}
                  className="btn btn-gradient-border text-white d-none d-md-inline-flex align-items-center gap-2 fw-semibold me-2"
                  style={{
                    width: 'auto',
                    height: '56px',
                    background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                    boxShadow: '0 8px 20px rgba(191, 218, 232, 0.73), 0 4px 8px rgba(140, 222, 247, 0.15)',
                    padding: '14px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    justifyContent: 'center',
                    fontSize: '16px',
                    lineHeight: '24px'
                  }}
                >
                  <i className="bi bi-rocket-takeoff"></i>
                  Get Started
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Old Drawer (DashboardDrawer) with original design/functionality */}
      {showDrawer && (
        <DashboardDrawer
          isOpen={isDashboardDrawerOpen}
          onClose={closeDashboardDrawer}
          user={user}
          onLogout={handleLogout}
          dashboardStats={dashboardStats}
          isLoadingStats={isLoadingStats || (!!user && !stats) || !!isLoadingHook}
        />
      )}
    </div>
  );
}


