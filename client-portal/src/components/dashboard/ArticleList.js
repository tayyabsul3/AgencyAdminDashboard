'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getResumableArticles, 
  getArticlesByStatus,
  deleteArticle,
  updateArticleStatus,
  getAllArticlesUnified 
} from '../../services/articleService';
import { useErrorAndLoading } from '../../hooks/useErrorAndLoading';
import { useOperationNotifications } from '../ui/NotificationSystem';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorMessage from '../ui/ErrorMessage';
import styles from './ArticleList.module.css';

const ArticleList = React.memo(function ArticleList({
  filterStatus = null,
  showResumeOnly = false,
  maxItems = null,
  showActions = true
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [articles, setArticles] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState(filterStatus || 'all');
  const [pending, setPending] = useState({}); // { [id]: { status: boolean, delete: boolean } }
  
  const {
    isLoading,
    error,
    executeAsync,
    clearError
  } = useErrorAndLoading();

  const notifications = useOperationNotifications();

  // Keep internal selectedStatus in sync with prop changes
  useEffect(() => {
    setSelectedStatus(filterStatus || 'all');
  }, [filterStatus]);

  // Load articles when user or relevant props change
  useEffect(() => {
    if (user?.uid) {
      loadArticles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, filterStatus, showResumeOnly]);

  const loadArticles = async () => {
    try {
      let articleData;

      if (showResumeOnly) {
        articleData = await executeAsync(
          () => getResumableArticles(user.uid),
          'loadResumableArticles'
        );
      } else {
        // Always fetch all articles for consistent filtering and counts
        articleData = await executeAsync(
          () => getAllArticlesUnified(user.uid),
          'loadAllArticlesUnified'
        );
      }

      setArticles(articleData || []);
    } catch (error) {
      console.error('Error loading articles:', error);
      setArticles([]);
    }
  };

  // Helper function to get the effective status for an article
  const getEffectiveStatus = (article) => {
    if (!article) return 'unknown';

    // Treat legacy 'view' status as draft
    if (article.status === 'view') return 'draft';

    return article.status || 'draft';
  };

  // Derived list (filters + maxItems + sorting)
  const filteredArticles = useMemo(() => {
    let filtered = Array.isArray(articles) ? [...articles] : [];

    if (selectedStatus !== 'all') {
      if (selectedStatus === 'completed') {
        filtered = filtered.filter(a => getEffectiveStatus(a) === 'completed');
      } else {
        filtered = filtered.filter(a => getEffectiveStatus(a) === selectedStatus);
      }
    } else {
      // For 'all' filter, exclude articles with 'view' status
      filtered = filtered.filter(a => a.status !== 'view');
    }

    if (showResumeOnly) {
      filtered = filtered.filter(a => {
        const status = getEffectiveStatus(a);
        return status === 'draft' || status === 'in_progress';
      });
    }

    // Sort by updatedAt desc
    const toMs = (ts) => {
      try {
        const d = ts instanceof Date ? ts : (typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts));
        const t = d.getTime ? d.getTime() : 0;
        return Number.isFinite(t) ? t : 0;
      } catch {
        return 0;
      }
    };
    filtered.sort((a, b) => (toMs(b?.updatedAt) - toMs(a?.updatedAt)));

    if (maxItems && maxItems > 0) {
      filtered = filtered.slice(0, maxItems);
    }

    return filtered;
  }, [articles, selectedStatus, showResumeOnly, maxItems]);

  // Counts for filter buttons
  const counts = useMemo(() => {
    const out = { all: 0, draft: 0, in_progress: 0, completed: 0 };
    for (const a of articles) {
      // Skip 'view' status from 'all' count
      if (a.status === 'view') {
        // But count it as draft
        out.draft++;
        continue;
      }

      const s = getEffectiveStatus(a);
      if (s === 'draft') out.draft++;
      else if (s === 'in_progress') out.in_progress++;
      else if (s === 'completed') out.completed++;
      out.all++; // Increment all count for non-view articles
    }
    return out;
  }, [articles]);

  const setPendingFor = (id, key, value) => {
    setPending(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [key]: value } }));
  };

  const withPending = useCallback(async (id, key, fn) => {
    setPendingFor(id, key, true);
    try {
      return await fn();
    } finally {
      setPendingFor(id, key, false);
    }
  }, []);

  const handleResumeArticle = (article) => {
    // First, check the article source to determine the correct navigation path
    if (article._source === 'interview' || article._source === 'voice' || article._source === 'text') {
      // Interview-based articles: route based on completion status
      if (article.status === 'completed') {
        // Completed interview articles: go to view page
        // Route with source=interview for reliable loading; actual mode (voice/text) is fetched from Firestore on the view page
        router.push(`/dashboard/articles/view?id=${encodeURIComponent(article.id)}&source=interview&keywordId=${encodeURIComponent(article.topic || '')}`);
      } else {
        // In-progress interview articles: route based on interview source
        if (article._source === 'text') {
          // Route text interviews to questions page
          router.push(`/dashboard/create/interview/questions?id=${article.id}&topic=${encodeURIComponent(article.topic || '')}`);
        } else if (article._source === 'voice') {
          // Route voice interviews to voice page
          router.push(`/dashboard/create/interview/voice?id=${article.id}&topic=${encodeURIComponent(article.topic || '')}`);
        } else {
          // For legacy 'interview' source, default to questions page
          router.push(`/dashboard/create/interview/questions?id=${article.id}&topic=${encodeURIComponent(article.topic || '')}`);
        }
      }
      return;
    }
    
    if (article._source === 'keyword') {
      // Keyword-based articles: always go to view page
      const keywordId = article._keywordId || article._keyword || '';
      router.push(`/dashboard/articles/view?id=${encodeURIComponent(article.id)}&source=keyword&keywordId=${encodeURIComponent(keywordId)}`);
      return;
    }
    
    // Legacy articles: use the old resume step logic
    const resumeStep = article.resumeStep || determineResumeStep(article);
    
    switch (resumeStep) {
      case 'setup':
        router.push(`/dashboard/create/interview?resume=${article.id}`);
        break;
      case 'questions':
        router.push(`/dashboard/create/interview/questions?id=${article.id}&topic=${encodeURIComponent(article.topic || '')}`);
        break;
      case 'generation':
        router.push(`/dashboard/create/interview/generate?id=${article.id}&topic=${encodeURIComponent(article.topic || '')}`);
        break;
      case 'completed':
        router.push(`/dashboard/articles/view?id=${encodeURIComponent(article.id)}`);
        break;
      default:
        router.push(`/dashboard/create/interview?resume=${article.id}`);
    }
  };

  const handleDeleteArticle = async (articleId, articleTitle, article) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${articleTitle}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    try {
      await withPending(articleId, 'delete', async () => {
        await notifications.executeWithNotifications(
          async () => {
            // Pass keywordId if it's a keyword-based article
            const keywordId = article && article._source === 'keyword' ? article._keywordId : null;
            await deleteArticle(user.uid, articleId, keywordId);
            // Remove from local state
            setArticles(prev => prev.filter(a => a.id !== articleId));
          },
          {
            operationName: 'Delete Article',
            loadingMessage: 'Deleting article...',
            successMessage: 'Article deleted successfully',
            errorMessage: 'Failed to delete article'
          }
        );
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting article:', error);
      }
    }
  };

  const handleStatusChange = async (articleId, newStatus) => {
    const prev = articles.find(a => a.id === articleId)?.status;
    await withPending(articleId, 'status', async () => {
      // Optimistic update
      setArticles(prevList => prevList.map(article => 
        article.id === articleId ? { ...article, status: newStatus } : article
      ));
      try {
        await notifications.executeWithNotifications(
          async () => {
            await updateArticleStatus(user.uid, articleId, newStatus);
          },
          {
            operationName: 'Update Status',
            loadingMessage: 'Updating status...',
            successMessage: 'Status updated successfully',
            errorMessage: 'Failed to update status'
          }
        );
      } catch (err) {
        // Rollback
        setArticles(prevList => prevList.map(article => 
          article.id === articleId ? { ...article, status: prev } : article
        ));
        throw err;
      }
    });
  };

  const determineResumeStep = (article) => {
    if (!article) return 'setup';
    if (article.status === 'completed') return 'completed';
    if (!article.questions || article.questions.length === 0) return 'setup';
    
    const answeredQuestions = article.questions.filter(q => q.answered).length;
    const totalQuestions = article.questions.length;
    
    if (answeredQuestions < totalQuestions) return 'questions';
    if (!article.article || !article.article.title) return 'generation';
    return 'completed';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#10B981';
      case 'in_progress': return '#F59E0B';
      case 'draft': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getResumeButtonText = (article) => {
    // For interview articles (voice or text), show appropriate text based on status
    if (article._source === 'interview' || article._source === 'voice' || article._source === 'text') {
      return article.status === 'completed' ? 'View Article' : 'Continue Article';
    }

    // For other articles, use status field
    if (article.status === 'in_progress') {
      return 'Continue Article';
    }

    if (article.status === 'completed') {
      return 'View Article';
    }

    // Fallback to legacy resume step logic
    const resumeStep = article.resumeStep || determineResumeStep(article);
    switch (resumeStep) {
      case 'setup': return 'Continue Setup';
      case 'questions': return 'Continue Interview';
      case 'generation': return 'Generate Article';
      case 'completed': return 'View Article';
      default: return 'Resume';
    }
  };

  // Handle Firestore Timestamp and JS Date consistently
  const formatDisplayDate = (ts) => {
    if (!ts) return 'Unknown';
    try {
      const d = ts instanceof Date ? ts : (typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts));
      return d.toLocaleDateString();
    } catch (e) {
      return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="medium" />
        <p>Loading articles...</p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage
        title="Failed to Load Articles"
        message={error.message}
        type={error.type}
        size="medium"
        canRetry={true}
        onRetry={() => {
          clearError();
          loadArticles();
        }}
      />
    );
  }

  return (
    <div className={styles.articleList}>
      {/* Optional internal filter when not controlled by parent */}
      {!filterStatus && !showResumeOnly && (
        <div className="d-flex flex-wrap gap-2 mb-3">
          {[
            { key: 'all', label: 'All' },
            { key: 'draft', label: 'Drafts' },
            { key: 'in_progress', label: 'In Progress' },
            { key: 'completed', label: 'Completed' }
          ].map(t => (
            <button
              key={t.key}
              type="button"
              className={`btn btn-sm ${selectedStatus === t.key ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setSelectedStatus(t.key)}
            >
              {t.label} ({counts[t.key] || 0})
            </button>
          ))}
        </div>
      )}

      {/* Articles List (Bootstrap cards matching sample) */}
      {filteredArticles.length === 0 ? (
        <div className="text-center py-4">
          <h6 className="mb-2">No articles found</h6>
          <p className="text-muted mb-3">
            {showResumeOnly
              ? "You don't have any articles to resume. Start a new interview to create your first article."
              : "Start creating your first expert article through our AI-powered interview process."}
          </p>
          <button
            type="button"
            className="btn text-white d-inline-flex align-items-center gap-2 fw-semibold"
            style={{
              width: '277px',
              height: '56px',
              background: 'linear-gradient(135deg, rgba(168,85,247,0.9) 0%, rgba(99,102,241,0.95) 45%, rgba(56,189,248,0.95) 100%)',
              boxShadow: '0 12px 30px rgba(59, 130, 246, 0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
              padding: '14px 24px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.55)',
              fontSize: '16px',
              lineHeight: '24px',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              textShadow: '0 1px 0 rgba(0,0,0,0.15)',
              justifyContent: 'center'
            }}
            onClick={() => router.push('/dashboard/create/keyword/')}
          >
            <i className="bi bi-rocket-takeoff"></i>
            Create New Article
          </button>
        </div>
      ) : (
        <div className="row g-3">
          {filteredArticles.map((article) => {
            const displayTitle = article.title || article.topic || 'Untitled';
            const isStatusPending = !!pending[article.id]?.status;
            const isDeletePending = !!pending[article.id]?.delete;
            const effectiveStatus = getEffectiveStatus(article);

            // Status-based theme
            const theme = {
              draft: {
                cardBg: '#F6F9FF',
                bar: '#3B82F6',
                chipBg: '#E7F0FF',
                chipText: '#2563EB',
                chipBorder: '#90B4FF',
                btnClass: 'btn-primary',
                border: '1px solid #D7E3FF',
                btnStyle: {
                  background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                  border: '1px solid rgba(255,255,255,0.6)',
                  color: '#fff'
                }
              },
              in_progress: {
                cardBg: '#FFF7E8',
                bar: '#F59E0B',
                chipBg: '#FFF1D6',
                chipText: '#B45309',
                chipBorder: '#FFCC80',
                btnClass: 'btn-warning',
                border: '1px solid #FFE5BD',
                btnStyle: {
                  background: 'linear-gradient(135deg, #FFC14D 0%, #FFAA00 100%)',
                  border: '1px solid rgba(255,255,255,0.6)',
                  color: '#1F2937'
                }
              },
              completed: {
                cardBg: '#ECFDF5',
                bar: '#10B981',
                chipBg: '#D1FAE5',
                chipText: '#0F766E',
                chipBorder: '#9DE8CE',
                btnClass: 'btn-outline-success',
                border: '1px solid #B6F3DD',
                btnStyle: { background: 'transparent', color: '#0F766E', borderColor: '#0F766E' }
              },
            }[effectiveStatus] || {
              cardBg: '#FFFFFF',
              bar: '#3B82F6',
              chipBg: '#E7F0FF',
              chipText: '#2563EB',
              chipBorder: '#BBD3FF',
              btnClass: 'btn-primary',
              border: '1px solid #E5E7EB',
              btnStyle: {}
            };

            const percent = typeof article.progress === 'number' ? Math.round(article.progress) : undefined;

            return (
              <div key={article.id} className="col-12 col-md-6 col-lg-4">
                <div className="card border-0 shadow-sm rounded-4 h-100" style={{ background: theme.cardBg, border: theme.border }} aria-busy={isStatusPending || isDeletePending}>
                  <div className="card-body d-flex flex-column">
                    {/* Top row: category chip and actions placeholder */}
                    <div className="d-flex justify-content-between  align-items-start mb-2">
                      <span className="badge rounded-3 border" style={{ background: theme.chipBg, color: theme.chipText, borderColor: theme.chipBorder }}>
                        {article.category || article.topic || (article._source === 'keyword' ? 'Keyword' : 'Article')}
                      </span>
                      {showActions && (
                        <div className="d-flex align-items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            aria-label={`Delete ${displayTitle}`}
                            onClick={() => handleDeleteArticle(article.id, displayTitle, article)}
                            disabled={isDeletePending}
                            title="Delete article"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Title and excerpt */}
                    <h6 className="fw-semibold mb-1">{displayTitle}</h6>
                    {article.excerpt && (
                      <p className="text-muted small mb-2">{article.excerpt}</p>
                    )}

                    {/* Source badge (Voice/Text Interview/Keyword) */}
                    <div className="mb-2">
                      {(() => {
                        const src = article._source;
                        let label = 'Article';
                        if (src === 'voice') label = 'Voice Interview';
                        else if (src === 'text') label = 'Text Interview';
                        else if (src === 'interview') label = 'Interview';
                        else if (src === 'keyword') label = 'Keyword';
                        return (
                          <span className="badge rounded-3 border fw-semibold" style={{ background: theme.chipBg, color: theme.chipText, borderColor: theme.chipBorder, fontSize: '0.72rem' }}>
                            {label}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Progress */}
                    {typeof percent === 'number' && (
                      <div className="mb-2">
                        <div className="d-flex justify-content-between small text-muted mb-1">
                          <span>Progress</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="progress" style={{ height: 6 }}>
                          <div className="progress-bar" role="progressbar" style={{ width: `${percent}%`, background: theme.bar }} aria-valuenow={percent} aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="text-muted small mb-3 d-flex align-items-center gap-1">
                      <i className="bi bi-clock"></i>
                      <span>Last edited: {formatDisplayDate(article.updatedAt)}</span>
                    </div>

                    {/* Footer Button */}
                    <div className="mt-auto pt-1">
                      <button
                        type="button"
                        className={`w-100 btn ${theme.btnClass}`}
                        style={theme.btnStyle}
                        onClick={() => handleResumeArticle(article)}
                        disabled={isLoading}
                        aria-label={`${getResumeButtonText(article)} ${displayTitle}`}
                      >
                        {getResumeButtonText(article)}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

ArticleList.displayName = 'ArticleList';

export default ArticleList;
