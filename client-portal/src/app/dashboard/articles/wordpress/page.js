'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import { getAllArticlesUnified } from '../../../../services/articleService';
import LandingNavbar from '../../../../components/LandingNavbar/LandingNavbar';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import ErrorMessage from '../../../../components/ui/ErrorMessage';
import styles from './WordPressArticles.module.css';

export default function WordPressArticlesPage() {
  const { user, loading, isAuthenticated, authError } = useAuthGuard({
    redirectTo: '/login',
    requireAuth: true
  });
  const router = useRouter();
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');

  useEffect(() => {
    if (user?.uid) {
      loadPublishedArticles();
    }
  }, [user?.uid]);

  // Filter articles based on search term and platform
  useEffect(() => {
    let filtered = articles;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(article => 
        (article.title || article.topic || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by platform
    if (platformFilter !== 'all') {
      filtered = filtered.filter(article => 
        article.publishedPlatforms.includes(platformFilter)
      );
    }

    setFilteredArticles(filtered);
  }, [articles, searchTerm, platformFilter]);

  // Helper function to detect which platforms an article has been published to
  const getPublishedPlatforms = (article) => {
    const platforms = [];

    // Debug: Log article structure for articles with potential platform data
    const hasAnyPlatformData = article.wordpressUrl || article.shopifyUrl || article.webflowItemId || article.webflowPreviewUrl;
    if (hasAnyPlatformData) {
      console.log('🔍 Checking article for platforms:', {
        id: article.id,
        title: article.title,
        wordpress: {
          url: article.wordpressUrl,
          siteUrl: article.wordpressSiteUrl,
          publishedAt: article.wordpressPublishedAt
        },
        shopify: {
          url: article.shopifyUrl,
          publishedAt: article.shopifyPublishedAt,
          blogId: article.shopifyBlogId,
          articleId: article.shopifyArticleId,
          status: article.shopifyStatus
        },
        webflow: {
          itemId: article.webflowItemId,
          publishedAt: article.webflowPublishedAt,
          previewUrl: article.webflowPreviewUrl,
          siteId: article.webflowSiteId,
          collectionId: article.webflowCollectionId,
          status: article.webflowStatus
        },
        jsonContent: article.jsonContent ? 'exists' : 'missing'
      });
    }

    // Check WordPress
    const hasWordPress = article.wordpressUrl ||
                        article.wordpressSiteUrl ||
                        article.wordpressPublishedAt ||
                        article.jsonContent?.wordpressUrl ||
                        article.jsonContent?.wordpressSiteUrl ||
                        article.jsonContent?.wordpressPublishedAt;

    // Check Shopify - enhanced detection
    const hasShopify = article.shopifyUrl ||
                      article.shopifyPublishedAt ||
                      article.lastShopifyUpload ||
                      article.shopifyApiResponse ||
                      article.jsonContent?.shopifyUrl ||
                      article.jsonContent?.shopifyPublishedAt;

    // Check Webflow - enhanced detection
    const hasWebflow = article.webflowItemId ||
                      article.webflowPublishedAt ||
                      article.webflowPreviewUrl ||
                      article.lastWebflowUpload ||
                      article.webflowApiResponse ||
                      article.jsonContent?.webflowItemId ||
                      article.jsonContent?.webflowPublishedAt;

    if (hasWordPress) platforms.push('wordpress');
    if (hasShopify) platforms.push('shopify');
    if (hasWebflow) platforms.push('webflow');

    // Debug: Log platform detection results
    if (hasAnyPlatformData) {
      console.log('🔍 Platform detection results for article', article.id, ':', {
        hasWordPress,
        hasShopify, 
        hasWebflow,
        detectedPlatforms: platforms
      });
    }

    return platforms;
  };

  // Platform-specific theme for card tints and accents
  const getPlatformTheme = (platform) => {
    switch (platform) {
      case 'wordpress':
        return {
          color: '#3B82F6',
          bg: 'linear-gradient(180deg, rgba(59,130,246,0.06) 0%, rgba(59,130,246,0.03) 100%)',
          soft: 'rgba(59,130,246,0.12)'
        };
      case 'shopify':
        return {
          color: '#22C55E',
          bg: 'linear-gradient(180deg, rgba(34,197,94,0.06) 0%, rgba(34,197,94,0.03) 100%)',
          soft: 'rgba(34,197,94,0.12)'
        };
      case 'webflow':
        return {
          color: '#374151',
          bg: 'linear-gradient(180deg, rgba(55,65,81,0.06) 0%, rgba(55,65,81,0.03) 100%)',
          soft: 'rgba(55,65,81,0.12)'
        };
      default:
        return {
          color: '#6B7280',
          bg: 'linear-gradient(180deg, rgba(107,114,128,0.06) 0%, rgba(107,114,128,0.03) 100%)',
          soft: 'rgba(107,114,128,0.12)'
        };
    }
  };

  const loadPublishedArticles = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get all articles
      const allArticles = await getAllArticlesUnified(user.uid);

      // Debug: Log all articles to see their structure
      console.log('All articles loaded:', allArticles);
      console.log('Sample article structure:', allArticles[0]);
      
      // Debug: Check specifically for Shopify and Webflow data
      const articlesWithShopify = allArticles.filter(a => a.shopifyUrl || a.shopifyPublishedAt);
      const articlesWithWebflow = allArticles.filter(a => a.webflowItemId || a.webflowPublishedAt || a.webflowPreviewUrl);
      console.log('🔍 Articles with Shopify data:', articlesWithShopify.length, articlesWithShopify);
      console.log('🔍 Articles with Webflow data:', articlesWithWebflow.length, articlesWithWebflow);

      // Filter articles that have been published to any platform
      const publishedArticles = allArticles.filter(article => {
        const platforms = getPublishedPlatforms(article);
        return platforms.length > 0;
      }).map(article => {
        // Add platform information to each article
        const platforms = getPublishedPlatforms(article);
        return {
          ...article,
          publishedPlatforms: platforms,
          // Get the most recent publish date across all platforms
          latestPublishDate: getLatestPublishDate(article, platforms)
        };
      });

      // Sort by latest publish date (most recent first)
      publishedArticles.sort((a, b) => {
        return new Date(b.latestPublishDate) - new Date(a.latestPublishDate);
      });

      console.log('Published articles found:', publishedArticles.length);
      setArticles(publishedArticles);
      setFilteredArticles(publishedArticles);
    } catch (err) {
      console.error('Error loading published articles:', err);
      setError(err.message || 'Failed to load published articles');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get the latest publish date across all platforms
  const getLatestPublishDate = (article, platforms) => {
    const dates = [];

    platforms.forEach(platform => {
      let date = null;

      switch (platform) {
        case 'wordpress':
          date = article.wordpressPublishedAt || article.jsonContent?.wordpressPublishedAt;
          break;
        case 'shopify':
          date = article.shopifyPublishedAt || article.jsonContent?.shopifyPublishedAt;
          break;
        case 'webflow':
          date = article.webflowPublishedAt || article.jsonContent?.webflowPublishedAt;
          break;
      }

      if (date) dates.push(new Date(date));
    });

    // Return the most recent date, or current date if no dates found
    return dates.length > 0 ? new Date(Math.max(...dates)) : new Date();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown';
    }
  };

  const extractDomain = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  // Helper function to get platform-specific information
  const getPlatformInfo = (article, platform) => {
    switch (platform) {
      case 'wordpress':
        return {
          url: article.wordpressUrl || article.jsonContent?.wordpressUrl,
          siteUrl: article.wordpressSiteUrl || article.jsonContent?.wordpressSiteUrl,
          publishedAt: article.wordpressPublishedAt || article.jsonContent?.wordpressPublishedAt,
          status: article.wordpressStatus || article.jsonContent?.wordpressStatus,
          domain: extractDomain(article.wordpressSiteUrl || article.jsonContent?.wordpressSiteUrl)
        };
      case 'shopify':
        return {
          url: article.shopifyUrl || article.jsonContent?.shopifyUrl,
          publishedAt: article.shopifyPublishedAt || article.jsonContent?.shopifyPublishedAt || article.lastShopifyUpload,
          status: article.shopifyStatus || article.jsonContent?.shopifyStatus || 'published',
          domain: 'Shopify Store'
        };
      case 'webflow':
        return {
          url: article.webflowPreviewUrl || article.jsonContent?.webflowPreviewUrl,
          publishedAt: article.webflowPublishedAt || article.jsonContent?.webflowPublishedAt || article.lastWebflowUpload,
          status: article.webflowStatus || article.jsonContent?.webflowStatus || 'published',
          domain: 'Webflow Site'
        };
      default:
        return {};
    }
  };

  // Helper function to get platform display info
  const getPlatformDisplayInfo = (platform) => {
    switch (platform) {
      case 'wordpress':
        return {
          name: 'WordPress',
          color: '#3b82f6',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zM3.6 12c0-1.9.7-3.7 1.8-5L10 18.3c-3.7-1-6.4-4.4-6.4-6.3zm8.4 6.1l-2.7-7.4c.5 0 1-.1 1-.1.5 0 .4-.7 0-.7 0 0-1.4.1-2.3.1-.1 0-.2 0-.3 0C9.1 6.6 12.4 4.4 16.3 5c2.4.4 4.5 1.7 5.8 3.6-.1 0-.1 0-.2 0-.8 0-1.4.7-1.4 1.5 0 .7.4 1.3.8 2 .3.5.7 1.2.7 2.1 0 .7-.3 1.5-.6 2.7l-.8 2.8-3-8.9c.5 0 .9-.1.9-.1.4 0 .4-.7 0-.7 0 0-1.4.1-2.3.1-.2 0-.3 0-.5 0l3.2 9.5 2.2-6.6c1-2.5 1.2-3.7 1.2-4.5 0-.1 0-.3 0-.4.8 1.4 1.2 3 1.2 4.7-.1 3.6-2.2 6.8-5.5 8.1z"/>
            </svg>
          )
        };
      case 'shopify':
        return {
          name: 'Shopify',
          color: '#96c93d',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1 15l-4-4h3V7h2v6h3l-4 4z"/>
            </svg>
          )
        };
      case 'webflow':
        return {
          name: 'Webflow',
          color: '#4353ff',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.83l6.5 3.25v6.84L12 19.17l-6.5-3.25V8.08L12 4.83z"/>
            </svg>
          )
        };
      default:
        return {
          name: platform,
          color: '#6b7280',
          icon: <span>?</span>
        };
    }
  };

  if (loading) {
    return (
      <LoadingSpinner 
        size="large" 
        text="Loading WordPress articles..." 
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

  const enhancedUser = {
    ...user,
    name: user.displayName || user.email?.split('@')[0] || 'User',
    plan: 'pro',
    avatar: user.photoURL || null,
  };

  return (
    <div className={`${styles.wpArticlesPage}`}>
      {/* Landing Navbar with drawer, aligned to dashboard look & feel */}
      <LandingNavbar showDrawer={true} hideGetStarted={true} containerClass="mt-2 mb-0" maxWidth="1280px" />

      <div className={`${styles.content}`}>
        <div className={`${styles.container} container`}> 
          <div className={`${styles.header} text-center mt-3`}> 
            <h1 className={`${styles.title} display-5 fw-bold`}>Published Articles</h1>
            <p className={styles.subtitle}>
              Articles you've published to WordPress, Shopify, and Webflow
            </p>
            
            {/* Stats Summary */}
            {articles.length > 0 && (
              <div className="row g-4 justify-content-center">
                {/* Total Published */}
                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body text-center py-4">
                      <div
                        className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                        style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #E6F0FF 0%, #EEF5FF 100%)' }}
                      >
                        <i className="bi bi-graph-up-arrow text-primary" style={{ fontSize: 20 }}></i>
                      </div>
                      <div className="h3 fw-bold mb-1" style={{ color: '#3B82F6' }}>{articles.length}</div>
                      <div className="text-muted text-uppercase small">Total Published</div>
                    </div>
                  </div>
                </div>

                {/* WordPress */}
                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body text-center py-4">
                      <div
                        className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                        style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #E6F0FF 0%, #EEF5FF 100%)' }}
                      >
                        <i className="bi bi-globe2 text-primary" style={{ fontSize: 20 }}></i>
                      </div>
                      <div className="h3 fw-bold mb-1" style={{ color: '#3B82F6' }}>{articles.filter(a => a.publishedPlatforms.includes('wordpress')).length}</div>
                      <div className="text-muted text-uppercase small">WordPress</div>
                    </div>
                  </div>
                </div>

                {/* Shopify */}
                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body text-center py-4">
                      <div
                        className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                        style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #FFF1DF 0%, #FFF6EA 100%)' }}
                      >
                        <i className="bi bi-bag" style={{ color: '#F59E0B', fontSize: 20 }}></i>
                      </div>
                      <div className="h3 fw-bold mb-1" style={{ color: '#F59E0B' }}>{articles.filter(a => a.publishedPlatforms.includes('shopify')).length}</div>
                      <div className="text-muted text-uppercase small">Shopify</div>
                    </div>
                  </div>
                </div>

                {/* Webflow */}
                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body text-center py-4">
                      <div
                        className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                        style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #E6F0FF 0%, #EEF5FF 100%)' }}
                      >
                        <i className="bi bi-lightning-charge" style={{ color: '#3B82F6', fontSize: 20 }}></i>
                      </div>
                      <div className="h3 fw-bold mb-1" style={{ color: '#3B82F6' }}>{articles.filter(a => a.publishedPlatforms.includes('webflow')).length}</div>
                      <div className="text-muted text-uppercase small">Webflow</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Search and Filter Controls + Back Button Row */}
          {!isLoading && !error && articles.length > 0 && (
            <div className="row align-items-stretch g-3 mb-4">
              {/* Left: Search + Filter card (reduced width) */}
              <div className="col-12 col-lg-9">
                <div className="card border-0 shadow-sm rounded-4 h-100">
                  <div className="card-body py-3">
                    <div className="row g-3 align-items-center">
                      {/* Search */}
                      <div className="col-12 col-md-8">
                        <div className="rounded-3 border bg-white shadow-sm overflow-hidden">
                          <div className="input-group">
                            <span className="input-group-text bg-white border-0">
                              <i className="bi bi-search text-secondary" />
                            </span>
                            <input
                              type="text"
                              placeholder="Search articles..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="form-control border-0 py-2"
                              aria-label="Search articles"
                            />
                          </div>
                        </div>
                      </div>
                      {/* Platform Filter */}
                      <div className="col-12 col-md-4">
                        <div className="rounded-3 border bg-white shadow-sm">
                          <select
                            value={platformFilter}
                            onChange={(e) => setPlatformFilter(e.target.value)}
                            className="form-select border-0 py-2"
                            aria-label="Filter by platform"
                          >
                            <option value="all">All Platforms</option>
                            <option value="wordpress">WordPress Only</option>
                            <option value="shopify">Shopify Only</option>
                            <option value="webflow">Webflow Only</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Right: Back to Dashboard CTA styled like landing navbar button */}
              <div className="col-12 col-lg-3 d-flex">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="btn text-white fw-semibold w-100 align-self-stretch d-inline-flex align-items-center justify-content-center"
                  style={{
                    height: '90%',
                    marginTop: '4px',
                    minHeight: '48px',
                    background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                    boxShadow: '0 6px 18px rgba(76, 110, 245, 0.35)',
                    borderRadius: '12px',
                    border: '4px solid transparent'
                  }}
                  aria-label="Back to Dashboard"
                >
                  <i className="bi bi-arrow-left me-2"></i>
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className={styles.loadingContainer}>
              <LoadingSpinner size="medium" />
              <p>Loading your WordPress publications...</p>
            </div>
          ) : error ? (
            <ErrorMessage
              title="Failed to Load Articles"
              message={error}
              type="error"
              size="medium"
              canRetry={true}
              onRetry={loadPublishedArticles}
            />
          ) : articles.length === 0 ? (
            <div className={`${styles.emptyState} ${styles.emptyStateTight} container`}>
              <div className="row justify-content-center">
                <div className="col-12 col-md-10 col-lg-8 col-xxl-6">
                  <div className={`${styles.emptyCard} text-center position-relative mx-auto`}>
                    <div className={`${styles.emptyIconWrapper} mx-auto mb-3 d-flex align-items-center justify-content-center`}>
                      <i className="bi bi-rocket-takeoff-fill"></i>
                    </div>
                    <h2 className={`${styles.emptyHeading} mb-3`}>No Published Articles Yet</h2>
                    <p className={`${styles.emptyText} mx-auto mb-4`}>
                      Articles you publish to WordPress, Shopify, or Webflow will appear here. Start by creating an article and using the upload buttons to publish to your favorite platforms.
                    </p>
                    <button
                      className={`${styles.emptyCta} btn d-inline-flex align-items-center rounded-3 justify-content-center gap-2`}
                      onClick={() => router.push('/dashboard/create/interview')}
                    >
                      <i className="bi bi-plus-lg"></i>
                      Create New Article
                      <i className="bi bi-arrow-right-short ms-1"></i>
                    </button>
                    <div className={`${styles.platformDivider} mx-auto my-4`}></div>
                    <div className={`${styles.platformSection} mt-3`}>
                      <span className={styles.platformSectionLabel}>Connected publishing platforms</span>
                      <div className="d-flex flex-wrap gap-2 justify-content-center mt-3">
                        <span className={`${styles.platformChip} rounded-3`}>WordPress</span>
                        <span className={`${styles.platformChip} rounded-3`}>Shopify</span>
                        <span className={`${styles.platformChip} rounded-3`}>Webflow</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔍</div>
              <h3>No Articles Found</h3>
              <p>
                {searchTerm || platformFilter !== 'all' 
                  ? 'No articles match your current filters. Try adjusting your search or filter settings.'
                  : 'No published articles found.'
                }
              </p>
              {(searchTerm || platformFilter !== 'all') && (
                <button
                  className={`${styles.createButton} btn`}
                  onClick={() => {
                    setSearchTerm('');
                    setPlatformFilter('all');
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className={`${styles.articlesGrid}`}>
              {filteredArticles.map((article) => {
                // Choose a primary platform to theme the card (WordPress > Shopify > Webflow)
                const primaryPlatform = article.publishedPlatforms.includes('wordpress')
                  ? 'wordpress'
                  : article.publishedPlatforms.includes('shopify')
                    ? 'shopify'
                    : article.publishedPlatforms.includes('webflow')
                      ? 'webflow'
                      : article.publishedPlatforms[0] || 'wordpress';
                const theme = getPlatformTheme(primaryPlatform);
                const primaryDomain = (article.publishedPlatforms
                  .map(p => getPlatformInfo(article, p)?.domain)
                  .find(Boolean)) || null;
                const primaryInfo = getPlatformInfo(article, primaryPlatform);

                return (
                <div
                  key={article.id}
                  className={`card border-0 shadow-sm rounded-4 h-100 overflow-hidden ${styles.articleCard}`}
                  style={{ background: theme.bg, borderLeft: `6px solid ${theme.color}` }}
                >
                  <div className={`${styles.cardHeader} card-header bg-transparent border-0 pb-0`}>
                    <div className={styles.platformBadges}>
                      {article.publishedPlatforms.map((platform) => {
                        const platformInfo = getPlatformDisplayInfo(platform);
                        return (
                          <div
                            key={platform}
                            className={`${styles.platformBadge} rounded-2 px-2 py-1`}
                            style={{
                              backgroundColor: `${platformInfo.color}15`,
                              color: platformInfo.color,
                              border: `1px solid ${platformInfo.color}33`,
                              borderRadius: '8px'
                            }}
                          >
                            {platformInfo.icon}
                            <span>{platformInfo.name}</span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Removed header domain list to avoid duplication with body */}
                  </div>

                  <div className={`${styles.cardBody} card-body pt-2`} style={{ backgroundColor: theme.bg, borderColor: theme.color }}>
                    <div className="row g-3 align-items-start">
                      <div className="col-12">
                        {primaryDomain && (
                          <a
                            href={(primaryInfo?.siteUrl || primaryInfo?.url || '#')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-decoration-none"
                          >
                            <div
                              className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-2 border small mb-3"
                              style={{
                                background: theme.soft,
                                borderColor: theme.color,
                                color: '#111827',
                                maxWidth: '100%'
                              }}
                            >
                              <i className="bi bi-link-45deg"></i>
                              <span className="text-truncate" style={{ maxWidth: '100%' }}>{primaryDomain}</span>
                            </div>
                          </a>
                        )}
                        <h3 className="h5 fw-semibold text-dark mb-3" style={{ lineHeight: 1.3 }}>
                          {article.title || article.topic || 'Untitled'}
                        </h3>
                        <div className="d-flex flex-wrap gap-3 small text-secondary mt-1">
                          <div className="d-flex align-items-center">
                            <i className="bi bi-calendar-event me-2"></i>
                            Latest: {formatDate(article.latestPublishDate)}
                          </div>
                          <div className="d-flex align-items-center">
                            <i className="bi bi-layers me-2"></i>
                            Published to {article.publishedPlatforms.length} platform{article.publishedPlatforms.length > 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`${styles.cardFooter} card-footer bg-transparent border-0 pt-0`} style={{ backgroundColor: theme.bg, borderColor: theme.color }}>
                    <div className={styles.platformLinks}>
                      {article.publishedPlatforms.map((platform) => {
                        const platformData = getPlatformInfo(article, platform);
                        const platformInfo = getPlatformDisplayInfo(platform);

                        return platformData.url ? (
                          <div key={platform} className={styles.platformLinkContainer}>
                            <a
                              href={platformData.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`${styles.platformLink} btn`}
                              style={{ borderColor: platformInfo.color, color: '#ffffff', background: platformInfo.color }}
                            >
                              <span>View on {platformInfo.name}</span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(platformData.url);
                              }}
                              className={`${styles.copyButton} btn`}
                              title="Copy link"
                              style={{ borderColor: platformInfo.color, color: platformInfo.color, background: 'transparent' }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                    <button
                      className={`${styles.editButton} btn w-100 mt-2`}
                      style={{ background: 'transparent', borderColor: theme.color, color: theme.color }}
                      onClick={() => {
                        const params = new URLSearchParams({ id: article.id });
                        if (article._source === 'keyword' && article._keywordId) {
                          params.append('source', 'keyword');
                          params.append('keywordId', article._keywordId);
                        }
                        router.push(`/dashboard/articles/view?${params.toString()}`);
                      }}
                    >
                      View Article
                    </button>
                  </div>
                </div>
              );})}
            </div>
          )}
          
          {/* Back button moved next to the filters above */}
        </div>
    </div>
  </div>
  );

}
