'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import { getArticle } from '../../../../services/articleService';
import styles from '../../create/interview/generate/ArticleGeneration.module.css';

export default function ArticleDetailClient() {
  const { user, loading } = useAuthGuard({ redirectTo: '/login', requireAuth: true });
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [article, setArticle] = useState(null);
  const [error, setError] = useState(null);
  // WordPress Modal State (prefilled for testing)
  const [showWpModal, setShowWpModal] = useState(false);
  const [wpUrl, setWpUrl] = useState('https://example.com');
  const [wpUser, setWpUser] = useState('admin');
  const [wpPass, setWpPass] = useState('app-password');

  // Lock background scroll when modal is open
  useEffect(() => {
    if (showWpModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [showWpModal]);

  useEffect(() => {
    if (!user || !id) return;
    let isMounted = true;
    (async () => {
      try {
        const data = await getArticle(user.uid, id);
        if (isMounted) setArticle(data || null);
      } catch (e) {
        if (isMounted) setError(e?.message || 'Failed to load article');
      }
    })();
    return () => { isMounted = false; };
  }, [user, id]);

  // Helpers (same logic as FORMAT page)
  const extractTakeaway = (insight = '') => {
    const text = (insight || '').trim();
    const m = text.match(/Takeaway:\s*(.+?)(?=\s*Real Results:|$)/is);
    if (m) return m[1].trim();
    return text
      .replace(/^Takeaway:\s*/i, '')
      .replace(/\s*Real Results:\s*N\/A\s*Takeaway:\s*N\/A\s*$/i, '')
      .replace(/\s*Real Results:\s*N\/A\s*$/i, '')
      .replace(/\s*Takeaway:\s*N\/A\s*$/i, '')
      .trim();
  };

  const extractRealResults = (insight = '') => {
    const text = (insight || '').trim();
    const m = text.match(/Real Results:\s*(.+?)(?=\s*Takeaway:|$)/is);
    if (m && m[1].trim() !== 'N/A') return m[1].trim();
    return '';
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) return null;

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h3>Failed to load</h3>
        <p>{error}</p>
        <button className={styles.secondaryButton} onClick={() => router.back()}>Go Back</button>
      </div>
    );
  }

  return (
    <div className={styles.generationPage} style={{ padding: 0 }}>
      <div className="container" style={{ width: '100%', margin: 0, padding: 0 }}>
        <div className={styles.generationCard} style={{ width: '100%', maxWidth: 'none', borderRadius: 0, margin: 0 }}>
          {/* Header */}
          <div id="top" className={styles.previewHeader}>
            <h1 className={styles.articleTitle}>🏆 {article?.topic || 'Article'}</h1>
            <div className={styles.previewActions}>
              <button
                className={styles.primaryButton}
                type="button"
                title="Upload this article to WordPress"
                onClick={() => setShowWpModal(true)}
              >
                ⤴ Upload to WordPress
              </button>
              <button
                className={styles.secondaryButton}
                onClick={() => router.push('/dashboard/articles')}
              >
                ← Back to Articles
              </button>
              <button
                className={styles.secondaryButton}
                onClick={() => router.push(`/dashboard/create/interview/generate?slug=${encodeURIComponent(id)}&topic=${encodeURIComponent(article?.topic || 'Your Topic')}`)}
              >
                Edit (Generate)
              </button>
            </div>
          </div>

          {/* Content */}
          <div className={styles.previewContent} style={{ maxHeight: 'none', overflow: 'visible' }}>
            {/* Quick Summary / Key Takeaways */}
            <div className={styles.previewSection}>
              <h3>Quick Summary / Key Takeaways</h3>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1rem' }}>If you only remember 5 things from this guide, make it these:</p>
              <ul className={styles.takeawaysList}>
                {(() => {
                  const processed = (article?.questions || [])
                    .map(q => extractTakeaway(q.processedInsight))
                    .filter(Boolean)
                    .slice(0, 5);
                  return processed.length
                    ? processed.map((t, i) => <li key={`kt-${i}`}>{t}</li>)
                    : <li style={{ color: 'rgba(240, 147, 251, 0.9)' }}>Run "Preprocess Insights" to extract concise takeaways.</li>;
                })()}
              </ul>
            </div>

            {/* Intro */}
            <div className={styles.previewSection}>
              <h3>Intro</h3>
              <div className={styles.sectionPreview}>
                <p className={styles.sectionParagraph}>
                  {(() => {
                    const intro = article?.setup?.expertIntro || {};
                    const introText = Object.values(intro)
                      .filter(v => typeof v === 'string' && v.trim().length)
                      .join(' ');
                    return introText || `This expert guide on ${article?.topic || 'your topic'} compiles your interview answers into a structured FAQ.`;
                  })()}
                </p>
              </div>
            </div>

            {/* Table of Contents (Questions) */}
            <div id="toc" className={styles.previewSection}>
              <h3>📑 {article?.topic || 'Article'} – Table of Contents</h3>
              <div className={styles.sectionPreview}>
                <ul className={styles.sectionList}>
                  {(() => {
                    const qs = (article?.questions || []);
                    return qs.length ? qs.map((q) => (
                      <li key={`toc-q-${q.id}`}>
                        <a href={`#faq-${q.id}`} style={{ color: 'rgba(255,255,255,0.9)' }}>
                          FAQ {q.id}: {q.question}
                        </a>
                      </li>
                    )) : <li>No questions yet.</li>;
                  })()}
                </ul>
              </div>
            </div>

            {/* FAQs by Section */}
            {(() => {
              const bySection = (article?.questions || []).reduce((acc, q) => {
                const key = q.sectionTitle || 'FAQs';
                acc[key] = acc[key] || [];
                acc[key].push(q);
                return acc;
              }, {});

              return Object.entries(bySection).map(([section, qs]) => (
                <div key={section} className={styles.faqSection}>
                  <h4 className={styles.sectionHeading}>{section}</h4>
                  {qs.map((q) => {
                    const answer = (q.voiceResponse?.transcription && q.voiceResponse.transcription.trim().length > 0)
                      ? q.voiceResponse.transcription
                      : q.answer;
                    const realResults = extractRealResults(q.processedInsight);
                    const takeaway = extractTakeaway(q.processedInsight);

                    return (
                      <div key={q.id} id={`faq-${q.id}`} className={styles.faqPreview}>
                        <h5>FAQ {q.id}: {q.question}</h5>
                        {answer && <p>{answer}</p>}
                        {realResults && (
                          <div className={styles.realResults}>
                            <strong>Real Results:</strong> {realResults}
                          </div>
                        )}
                        {takeaway && (
                          <div className={styles.realResults} style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                            <strong>Takeaway:</strong> {takeaway}
                          </div>
                        )}
                        <div style={{ marginTop: '0.5rem' }}>
                          <a href="#toc" style={{ color: 'rgba(240, 147, 251, 0.95)' }}>↑ Back to TOC</a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}

            {/* Author Bio */}
            <div className={styles.previewSection}>
              <h3>Author Bio</h3>
              <p className={styles.authorBio}>
                {(() => {
                  // Prefer generated authorBio from final article if available
                  const generated = article?.finalArticle?.authorBio || article?.authorBio;
                  if (generated && typeof generated === 'string' && generated.trim()) return generated.trim();

                  const intro = article?.setup?.expertIntro || {};
                  const topicText = article?.topic || article?.setup?.topic || 'this topic';
                  const firstSentence = (txt) => {
                    if (typeof txt !== 'string' || !txt.trim()) return '';
                    const s = txt.split(/(?<=\.)\s+/)[0]?.trim();
                    return s || txt.trim();
                  };
                  const synthesized = (intro.bio || intro.answer1)
                    || [firstSentence(intro.background), firstSentence(intro.qualifications)]
                        .filter(Boolean)
                        .join(' ');
                  return synthesized || `Expert in ${topicText} with practical experience.`;
                })()}
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* WordPress Modal (via Portal) */}
      {showWpModal && typeof window !== 'undefined' && createPortal(
        (
          <div className={styles.modalOverlay} onClick={() => setShowWpModal(false)}>
            <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Upload to WordPress</h3>
                <button className={styles.secondaryButton} onClick={() => setShowWpModal(false)}>✕</button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Site URL</label>
                  <input className={styles.input} value={wpUrl} onChange={(e) => setWpUrl(e.target.value)} placeholder="https://your-site.com" />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Username</label>
                  <input className={styles.input} value={wpUser} onChange={(e) => setWpUser(e.target.value)} placeholder="username" />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Password / App Password</label>
                  <input type="password" className={styles.input} value={wpPass} onChange={(e) => setWpPass(e.target.value)} placeholder="••••••••" />
                </div>
              </div>
              <div className={styles.modalActions}>
                <button className={styles.secondaryButton} onClick={() => setShowWpModal(false)}>Cancel</button>
                <button className={styles.primaryButton} type="button" title="Simulate upload (not wired yet)">Continue</button>
              </div>
            </div>
          </div>
        ),
        document.body
      )}
    </div>
  );
}