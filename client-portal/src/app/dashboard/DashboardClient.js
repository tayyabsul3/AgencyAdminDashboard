'use client';

import React, { useEffect, useState, useCallback, Suspense, lazy, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useSubscription } from '../../hooks/useSubscription';
import { requireAuth } from '../../services/authService';
import { getArticleStats, getResumableArticles } from '../../services/articleService';
import { getUserProfile, subscribeToUserProfile } from '../../services/userService';
import { useErrorAndLoading } from '../../hooks/useErrorAndLoading';
import LandingNavbar from '../../components/LandingNavbar/LandingNavbar';
const ArticleList = lazy(() => import('../../components/dashboard/ArticleList'));
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorMessage from '../../components/ui/ErrorMessage';
import AgencyInfo from '../../components/AgencyInfo/AgencyInfo';
import styles from './Dashboard.module.css';

function DashboardContent() {
  // Performance tracking with proper cleanup
  const renderTimerRef = useRef(null);
  const statsTimerRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);
  
  // Start render timer only if not already started
  if (!renderTimerRef.current) {
    renderTimerRef.current = performance.now();
  }
  
  const { user, logout, subscription } = useAuth();
  const { loading, isAuthenticated, authError } = useAuthGuard({
    redirectTo: '/login',
    requireAuth: true
  });
  const { credits: creditsInfo, tier } = useSubscription(user?.uid);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState(null);
  const [resumableArticles, setResumableArticles] = useState([]);
  
  // Import the new CreditDisplay component
  const CreditDisplay = lazy(() => import('../../components/dashboard/CreditDisplay'));
  const [articleTab, setArticleTab] = useState('in_progress'); // all | draft | in_progress | completed
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const {
    isLoading,
    error,
    executeAsync,
    clearError,
    isLoadingOperation
  } = useErrorAndLoading() || {
    isLoading: false,
    error: null,
    executeAsync: async (fn) => fn(),
    clearError: () => {},
    isLoadingOperation: () => false
  };

  // Check for payment success and other messages - optimized to prevent duplicate calls
  useEffect(() => {
    const paymentSuccess = searchParams.get('payment_success');
    const message = searchParams.get('message');
    
    if (paymentSuccess === 'true') {
      setShowPaymentSuccess(true);
      // Clean up URL after 5 seconds
      const timeoutId = setTimeout(() => {
        router.replace('/dashboard');
      }, 5000);
      
      return () => clearTimeout(timeoutId);
    }
    
    // Handle agency-related messages
    if (message === 'subscription-managed-by-agency') {
      // Show a temporary message about agency management
      const timeoutId = setTimeout(() => {
        router.replace('/dashboard');
      }, 3000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [searchParams, router]);

  // Enhanced authentication check - optimized to prevent duplicate calls
  useEffect(() => {
    let isMounted = true;
    
    const verifyAuthentication = async () => {
      try {
        const currentUser = await requireAuth();
        if (isMounted && process.env.NODE_ENV === 'development') {
          console.log('Dashboard: Authentication verified');
        }
      } catch (error) {
        if (isMounted) {
          console.error('Dashboard: Authentication verification failed:', error);
          router.push('/login');
        }
      }
    };

    if (!loading && isAuthenticated && !authError && user?.uid) {
      verifyAuthentication();
    }
    
    return () => {
      isMounted = false;
    };
  }, [loading, isAuthenticated, authError, router, user?.uid]);

  const loadDashboardData = useCallback(async () => {
    // Prevent duplicate loading
    if (!user?.uid || isLoadingRef.current || hasLoadedRef.current) {
      return;
    }

    isLoadingRef.current = true;

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('Dashboard: Loading dashboard data for user:', user.uid);
      }

      // Load all data in parallel for better performance
      const [profile, articleStats, resumable] = await Promise.all([
        executeAsync(() => getUserProfile(user.uid), 'loadProfile'),
        executeAsync(() => getArticleStats(user.uid), 'loadStats'),
        executeAsync(() => getResumableArticles(user.uid), 'loadResumable')
      ]);

      if (process.env.NODE_ENV === 'development') {
        console.log('Dashboard: All data loaded successfully');
      }

      setUserProfile(profile);
      setStats(articleStats);
      setResumableArticles(resumable);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error('Dashboard: Error loading dashboard data:', error);
      // Set default stats if loading fails
      setStats({
        total: 0,
        completed: 0,
        inProgress: 0,
        drafts: 0,
        totalWords: 0,
        averageProgress: 0,
        recentActivity: []
      });
      setResumableArticles([]);
    } finally {
      isLoadingRef.current = false;
    }
  }, [user?.uid, executeAsync]);

  // Load dashboard data - optimized to prevent duplicate calls
  useEffect(() => {
    if (user?.uid && !loading && isAuthenticated && executeAsync && !hasLoadedRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Dashboard: Conditions met, loading dashboard data...');
      }
      loadDashboardData();
    }
  }, [user?.uid, loading, isAuthenticated, loadDashboardData, executeAsync]);

  // Real-time user profile subscription
  useEffect(() => {
    if (!user?.uid) return;

    let unsubscribe;

    try {
      unsubscribe = subscribeToUserProfile(user.uid, (profileData) => {
        if (profileData) {
          setUserProfile(profileData);
          if (process.env.NODE_ENV === 'development') {
            console.log('Dashboard: User profile updated in real-time');
          }
        }
      });
    } catch (error) {
      console.error('Dashboard: Failed to set up user profile real-time listener:', error);
    }

    // Cleanup subscription on unmount or user change
    return () => {
      if (unsubscribe) {
        unsubscribe();
        if (process.env.NODE_ENV === 'development') {
          console.log('🔌 User profile listener unsubscribed');
        }
      }
    };
  }, [user?.uid]);



  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect even if logout fails
      router.push('/');
    }
  };

  // Prepare dashboard stats for the drawer - optimized computation
  const dashboardStats = useMemo(() => {
    // Start timer only if not already started
    if (!statsTimerRef.current) {
      statsTimerRef.current = performance.now();
    }

    if (!stats) {
      return {
        articles: { total: 0, completed: 0, inProgress: 0, drafts: 0 },
        usage: { totalWords: 0, monthlyWords: 0, timeSaved: "0%" },
        activity: { lastLogin: new Date(), recentActions: [] }
      };
    }

    const result = {
      articles: {
        total: stats.total,
        completed: stats.completed,
        inProgress: stats.inProgress,
        drafts: stats.drafts,
      },
      usage: {
        totalWords: stats.totalWords,
        monthlyWords: stats.totalWords, // For now, use total words as monthly
        timeSaved: "95%", // Static value for now
      },
      activity: {
        lastLogin: new Date(),
        recentActions: stats.recentActivity?.map(activity => {
          const ts = activity.timestamp;
          let date;
          try {
            if (ts instanceof Date) {
              date = ts;
            } else if (ts && typeof ts.toDate === 'function') {
              date = ts.toDate();
            } else {
              const d = new Date(ts);
              date = Number.isFinite(d.getTime()) ? d : new Date();
            }
          } catch (e) {
            date = new Date();
          }
          return {
            action: activity.action,
            timestamp: date
          };
        }) || [],
      },
    };

    // Log timing only in development
    if (process.env.NODE_ENV === 'development' && statsTimerRef.current) {
      const duration = performance.now() - statsTimerRef.current;
      console.log(`Dashboard Stats Computation: ${duration.toFixed(2)}ms`);
      statsTimerRef.current = null;
    }

    return result;
  }, [stats]);

  // Enhance user object with additional data needed by the drawer
  const enhancedUser = useMemo(() => {
    if (!user) return null;
    return {
      ...user,
      name: userProfile?.name || user.displayName || user.email?.split('@')[0] || 'User',
      plan: 'pro', // Mock plan data - this would come from user subscription
      avatar: user.photoURL || null,
    };
  }, [user, userProfile]);

  // Cleanup effect to reset loading state
  useEffect(() => {
    return () => {
      hasLoadedRef.current = false;
      isLoadingRef.current = false;
      renderTimerRef.current = null;
      statsTimerRef.current = null;
    };
  }, []);

  const handleCreateArticle = () => {
    // Add smooth transition effect
    setIsTransitioning(true);

    // Add a slight delay for the fade effect
    const timeoutId = setTimeout(() => {
      router.push('/dashboard/create/interview');
    }, 300);

    // Cleanup timeout if component unmounts
    return () => clearTimeout(timeoutId);
  };

  const handleStartTutorial = () => {
    console.log('LandingNavbar: Start Tutorial clicked');
    console.log('LandingNavbar: Dispatching custom event to start onboarding');
    
    // Dispatch a custom event to trigger onboarding restart
    const event = new CustomEvent('startOnboarding', {
      detail: { restart: true }
    });
    window.dispatchEvent(event);
    
    // Also call global function as backup
    if (window.startOnboardingTutorial) {
      console.log('OnboardingManager: Global tutorial function called');
      window.startOnboardingTutorial();
    }
    console.log('LandingNavbar: Global function also called as backup');
  };


  if (loading || isLoadingOperation('loadStats')) {
    return (
      <div className={styles.loadingContainer} style={{
        background: 'transparent',
        minHeight: '100vh'
      }}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingSpinner}></div>
          <p className={styles.loadingText}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (authError || error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent'
      }}>
        <ErrorMessage
          title={authError ? "Authentication Error" : "Dashboard Error"}
          message={authError || error?.message}
          type={authError ? "auth" : error?.type}
          size="large"
          canRetry={!authError}
          onRetry={!authError ? () => {
            clearError();
            loadDashboardData();
          } : undefined}
          actions={authError ? (
            <button
              onClick={() => router.push('/login')}
              style={{
                backgroundColor: 'white',
                color: '#667eea',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 20px',
                cursor: 'pointer'
              }}
            >
              Go to Login
            </button>
          ) : undefined}
        />
      </div>
    );
  }

  if (!user || !isAuthenticated) {
    return null; // Will redirect
  }

  // Log render timing only in development
  if (process.env.NODE_ENV === 'development' && renderTimerRef.current) {
    const duration = performance.now() - renderTimerRef.current;
    console.log(`Dashboard Render: ${duration.toFixed(2)}ms`);
    renderTimerRef.current = null;
  }
console.log(user)
  return (
    <div className={`${styles.dashboardContainer} ${isTransitioning ? styles.fadeOut : ''}`}
      style={{
        opacity: isTransitioning ? 0 : 1,
        transition: 'opacity 0.3s ease-in-out',
        transform: isTransitioning ? 'scale(0.98)' : 'scale(1)',
      }}
    >
      {/* Landing (public) navbar at the top */}
      <LandingNavbar containerClass="mt-2 mb-2" innerClass="px-3 py-2" hideGetStarted={true} />

      {/* Main dashboard container with proper margins below landing navbar */}
      <div className="container my-4 py-3">
        {/* Inner width wrapper to align exactly with navbar width */}
        <div className="mx-auto" style={{ maxWidth: '1140px' }}>
        {/* Payment Success Banner */}
        {showPaymentSuccess && (
          <div className="alert alert-success shadow-sm d-flex align-items-center" role="alert">
            <i className="bi bi-check-circle-fill me-2"></i>
            <div>
              <strong>Payment Successful!</strong> Welcome to QueryFuel. Your subscription is active.
            </div>
          </div>
        )}

        {/* Agency Management Message */}
        {searchParams.get('message') === 'subscription-managed-by-agency' && (
          <div className="alert alert-info shadow-sm d-flex align-items-center" role="alert">
            <i className="bi bi-info-circle-fill me-2"></i>
            <div>
              <strong>Subscription Managed by Agency:</strong> Your subscription and billing are handled by your agency administrator. Contact them for any subscription changes.
            </div>
          </div>
        )}

        {/* Mobile-centered wrapper: centers content on xs while keeping md+ full width */}
        <div className="row justify-content-center">
          <div className="col-12 col-md-12">

        {/* Hero Banner */}
        <div
          className="p-4 p-md-5 mb-4 rounded-4 text-center text-white position-relative shadow"
          style={{
            background: 'linear-gradient(135deg, #5B6CFF 0%, #18C8FF 100%)',
          }}
        >
          <h1 className="fw-bold display-6 mb-2">Welcome, {enhancedUser?.name || 'Creator'}!</h1>
          <p className="opacity-75 mb-4">Ready to create amazing content? Let’s turn your expertise into compelling articles.</p>
          <div className="d-flex flex-column flex-sm-row align-items-center justify-content-center gap-3">
            <button
              type="button"
              onClick={handleCreateArticle}
              disabled={isTransitioning}
              className="btn text-white d-inline-flex align-items-center gap-2 fw-semibold"
              style={{
                width: '277px',
                height: '56px',
                background: 'linear-gradient(135deg, rgba(168,85,247,0.9) 0%, rgba(99,102,241,0.95) 45%, rgba(56,189,248,0.95) 100%)',
                boxShadow: '0 12px 30px rgba(59, 130, 246, 0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
                padding: '14px 24px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.55)',
                justifyContent: 'center',
                fontSize: '16px',
                lineHeight: '24px',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                textShadow: '0 1px 0 rgba(0,0,0,0.15)'
              }}
            >
              {isTransitioning ? (
                <span className="d-inline-flex align-items-center gap-2">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  Loading...
                </span>
              ) : (
                <>
                  <i className="bi bi-rocket-takeoff"></i>
                  Create New Article
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={handleStartTutorial}
              className="btn text-white d-inline-flex align-items-center gap-2 fw-semibold"
              style={{
                width: '200px',
                height: '56px',
                background: 'linear-gradient(135deg, rgba(34,197,94,0.9) 0%, rgba(16,185,129,0.95) 45%, rgba(6,182,212,0.95) 100%)',
                boxShadow: '0 12px 30px rgba(34, 197, 94, 0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
                padding: '14px 24px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.55)',
                justifyContent: 'center',
                fontSize: '16px',
                lineHeight: '24px',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                textShadow: '0 1px 0 rgba(0,0,0,0.15)'
              }}
            >
              <i className="bi bi-play-circle"></i>
              Start Tutorial
            </button>
          </div>
        </div>

        {/* Credits Display */}
        <div className="mt-4">
          <Suspense fallback={<LoadingSpinner />}>
            <CreditDisplay creditsInfo={creditsInfo} />
          </Suspense>
        </div>

        {/* <!-- Onboarding Card - styled to match sample --> */}
        {/* <!--
          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-body p-4">
              <!-- <!-- Header --> -->
              <div className="d-flex align-items-center mb-2">
                <i className="bi bi-gem text-primary me-2"></i>
                <h5 className="mb-0">Complete Your Onboarding</h5>
              </div>

              <!-- <!-- Progress --> -->
              <div className="mb-3">
                <div className="d-flex justify-content-between small text-muted mb-1">
                  <span>Progress</span>
                  <span>{Math.round(stats?.averageProgress || 0)}%</span>
                </div>
                <div
                  className="progress"
                  style={{ height: '10px' }}
                  role="progressbar"
                  aria-label="Onboarding progress"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={Math.round(stats?.averageProgress || 0)}
                >
                  <div
                    className="progress-bar bg-primary"
                    style={{ width: `${Math.round(stats?.averageProgress || 0)}%` }}
                  />
                </div>
              </div>

              <!-- <!-- Steps --> -->
              <div className="row g-3 mb-3">
                <div className="col-12 col-md-4">
                  <div className="p-3 rounded-3 border bg-success-subtle text-success-emphasis d-flex align-items-center gap-2">
                    <i className="bi bi-check-circle"></i>
                    <span>Connect data source</span>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 rounded-3 border bg-success-subtle text-success-emphasis d-flex align-items-center gap-2">
                    <i className="bi bi-check-circle"></i>
                    <span>Set up profile</span>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 rounded-3 border bg-light d-flex align-items-center gap-2">
                    <i className="bi bi-clock text-primary"></i>
                    <span>Create first article</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreateArticle}
                className="btn text-white fw-semibold d-inline-flex align-items-center justify-content-center"
                style={{
                  background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                  boxShadow: '0 6px 18px rgba(76, 110, 245, 0.35)',
                  borderRadius: '8px',
                  border: '4px solid transparent'
                }}
              >
                Continue Onboarding
              </button>
            </div>
          </div> */}

        {/* Agency Client Info Banner */}
        <AgencyInfo variant="banner" className="mb-4" />

        {/* Stats Row (matches sample) */}
        <div className="row g-4 mb-4">
          {/* Total Articles */}
          <div className="col-12 col-sm-6  col-lg-3">
            <div className="card border-0 shadow-sm rounded-4  ">
              <div className="card-body  text-center py-4 ">
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                  style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #F1E4FF 0%, #ECEBFF 100%)' }}
                >
                  <i className="bi bi-file-earmark text-primary" style={{ fontSize: 20 }}></i>
                </div>
                <div className="h3 fw-bold mb-1">{stats?.total || 0}</div>
                <div className="text-muted text-uppercase small">Total Articles</div>
              </div>
            </div>
          </div>

          {/* Completed */}
          <div className="col-12 col-sm-6  col-lg-3">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body text-center py-4">
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                  style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #E7FFF2 0%, #EEFDF5 100%)' }}
                >
                  <i className="bi bi-check2-circle" style={{ color: '#10B981', fontSize: 20 }}></i>
                </div>
                <div className="h3 fw-bold mb-1" style={{ color: '#10B981' }}>{stats?.completed || 0}</div>
                <div className="text-muted text-uppercase small">Completed</div>
              </div>
            </div>
          </div>

          {/* In Progress */}
          <div className="col-12 col-sm-6 col-lg-3">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body text-center py-4">
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                  style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #FFF1DF 0%, #FFF6EA 100%)' }}
                >
                  <i className="bi bi-clock" style={{ color: '#F59E0B', fontSize: 20 }}></i>
                </div>
                <div className="h3 fw-bold mb-1" style={{ color: '#F59E0B' }}>{stats?.inProgress || 0}</div>
                <div className="text-muted text-uppercase small">In Progress</div>
              </div>
            </div>
          </div>

          {/* Drafts */}
          <div className="col-12 col-sm-6 col-lg-3">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body text-center py-4">
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                  style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #E6F0FF 0%, #EEF5FF 100%)' }}
                >
                  <i className="bi bi-file-earmark-plus" style={{ color: '#3B82F6', fontSize: 20 }}></i>
                </div>
                <div className="h3 fw-bold mb-1" style={{ color: '#3B82F6' }}>{stats?.drafts || 0}</div>
                <div className="text-muted text-uppercase small">Drafts</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Articles (matches sample) */}
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden mt-4">
          <div className="card-header bg-white border-0 pt-3">
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <i className="bi bi-journal-text text-primary me-2"></i>
                <h5 className="mb-0">Recent Articles</h5>
              </div>
              <button
                onClick={() => router.push('/dashboard/articles')}
                className="btn text-white btn-sm fw-semibold mt-2 d-inline-flex align-items-center justify-content-center"
                style={{
                  background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                  boxShadow: '0 6px 18px rgba(76, 110, 245, 0.35)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  border: '4px solid transparent'
                }}
              >
                View All
              </button>
            </div>
            {/* Tabs styled as pill buttons with counts (like sample) */}
            <div className="mt-3 d-flex flex-wrap align-items-center gap-2" role="tablist">
              {(() => {
                const tabDefs = [
                  { key: 'all', label: 'All', count: stats?.total || 0 },
                  { key: 'draft', label: 'Drafts', count: stats?.drafts || 0 },
                  { key: 'in_progress', label: 'In Progress', count: stats?.inProgress || 0 },
                  { key: 'completed', label: 'Completed', count: stats?.completed || 0 },
                ];
                return tabDefs.map(t => {
                  const active = articleTab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setArticleTab(t.key)}
                      className={`btn btn-sm rounded-3 d-inline-flex align-items-center shadow-sm ${active ? 'text-primary border-primary' : 'text-secondary border border-secondary-subtle'}`}
                      style={{
                        background: active ? '#EAF1FF' : '#FFFFFF',
                        borderWidth: active ? '2px' : '1px',
                        padding: '8px 14px',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
                        borderRadius: '10px'
                      }}
                      aria-pressed={active}
                    >
                      <span className="fw-semibold">{t.label} ({t.count})</span>
                    </button>
                  );
                });
              })()}
            </div>
            {/* Light separator under the pills */}
            <div className="mt-3" style={{ height: '1px', background: '#EEF1F7' }} />
          </div>
          <div className="card-body">
            <Suspense fallback={
              <div className="text-center py-4">
                <LoadingSpinner size="medium" />
                <p className="mb-0">Loading articles...</p>
              </div>
            }>
              <ArticleList maxItems={9} showActions={true} filterStatus={articleTab} />
            </Suspense>
          </div>
        </div>

        {/* Close mobile-centered column and row */}
          </div>
        </div>
        {/* Close inner width wrapper */}
        </div>
      </div>
    </div>
  );
}

const MemoizedDashboardContent = React.memo(DashboardContent);

export default function DashboardClient() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p>Loading dashboard...</p>
        </div>
      </div>
    }>
      <MemoizedDashboardContent />
    </Suspense>
  );
}