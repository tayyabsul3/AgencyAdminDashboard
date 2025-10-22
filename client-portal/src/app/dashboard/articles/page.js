'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import ArticleList from '../../../components/dashboard/ArticleList';
import LandingNavbar from '../../../components/LandingNavbar/LandingNavbar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorMessage from '../../../components/ui/ErrorMessage';
import { getArticleStats } from '../../../services/articleService';
import { useErrorAndLoading } from '../../../hooks/useErrorAndLoading';
import styles from './ArticlesPage.dark.module.css';

export default function ArticlesPage() {
  console.time('ArticlesPage Mount');
  const { user, loading, isAuthenticated, authError } = useAuthGuard({
    redirectTo: '/login',
    requireAuth: true
  });
  
  const [stats, setStats] = useState(null);
  const [articleTab, setArticleTab] = useState('all');
  const { executeAsync } = useErrorAndLoading();

  // Load article stats
  useEffect(() => {
    const loadStats = async () => {
      if (user?.uid) {
        try {
          const statsData = await executeAsync(
            () => getArticleStats(user.uid),
            'loadStats'
          );
          setStats(statsData);
        } catch (error) {
          console.error('Error loading article stats:', error);
          setStats({
            total: 0,
            completed: 0,
            inProgress: 0,
            drafts: 0,
            totalWords: 0,
            averageProgress: 0
          });
        }
      }
    };
    
    loadStats();
  }, [user?.uid, executeAsync]);

  if (loading) {
    return (
      <LoadingSpinner 
        size="large" 
        text="Loading articles..." 
        overlay={true}
      />
    );
  }

  if (authError) {
    return (
      <ErrorMessage
        title="Authentication Error"
        message={authError}
        type="auth"
        size="large"
        canRetry={false}
        actions={
          <button 
            onClick={() => window.location.href = '/login'}
            className={styles.loginButton}
          >
            Go to Login
          </button>
        }
      />
    );
  }

  if (!user || !isAuthenticated) {
    return null;
  }

  console.timeEnd('ArticlesPage Mount');

  return (
    <div className={styles.articlesPage}>
      <LandingNavbar hideGetStarted={true} />
      
      <div className="container my-4 py-3">
        {/* Inner width wrapper to align exactly with navbar width */}
        <div className="mx-auto" style={{ maxWidth: '1140px' }}>
          {/* Page Header */}
          <div className="d-flex justify-content-center align-items-center mb-4">
            <div className="text-center">
              <h1 className="display-6 fw-bold mb-1">Your Articles</h1>
              <p className="text-muted mb-0">Manage all your expert articles in one place</p>
            </div>
          </div>
          
          {/* Stats Row */}
          <div className="row g-4 mb-4">
            {/* Total Articles */}
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="card border-0 shadow-sm rounded-4 h-100">
                <div className="card-body text-center py-4">
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
            <div className="col-12 col-sm-6 col-lg-3">
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
          
          {/* Articles List Section */}
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="card-header bg-white border-0 pt-3">
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                  <i className="bi bi-journal-text text-primary me-2"></i>
                  <h5 className="mb-0">Your Articles</h5>
                </div>
              </div>
              
              {/* Tabs */}
              <div className="mt-3 d-flex flex-wrap align-items-center gap-2" role="tablist">
                {[
                  { key: 'all', label: 'All', count: stats?.total || 0 },
                  { key: 'draft', label: 'Drafts', count: stats?.drafts || 0 },
                  { key: 'in_progress', label: 'In Progress', count: stats?.inProgress || 0 },
                  { key: 'completed', label: 'Completed', count: stats?.completed || 0 },
                ].map(tab => {
                  const active = articleTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setArticleTab(tab.key)}
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
                      <span className="fw-semibold">{tab.label} ({tab.count})</span>
                    </button>
                  );
                })}
                {/* Back to Dashboard button (aligned right) */}
                <div className="ms-auto d-flex align-items-center align-self-center">
                  <Link
                    href="/dashboard"
                    className="btn text-white d-inline-flex align-items-center gap-2 fw-semibold shadow-sm"
                    style={{
                      height: '40px',
                      background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                      boxShadow: '0 6px 18px rgba(76, 110, 245, 0.35)',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '3px solid transparent',
                      fontSize: '14px',
                      lineHeight: '20px',
                      transform: 'translateY(-6px)'
                    }}
                    aria-label="Back to Dashboard"
                  >
                    <i className="bi bi-arrow-left"></i>
                    Back to Dashboard
                  </Link>
                </div>
              </div>
              
              {/* Separator */}
              <div className="mt-3" style={{ height: '1px', background: '#EEF1F7' }} />
            </div>
            
            {/* Article List */}
            <div className="card-body">
              <ArticleList 
                showActions={true} 
                filterStatus={articleTab}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}