'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthGuard } from '../../../../../hooks/useAuthGuard';
import { requireAuth } from '../../../../../services/authService';
import { getInterviewById, updateInterview } from '../../../../../services/interviewService';
import { batchSaveProcessedInsights } from '../../../../../services/articleService';
import { processAnswersIntoInsights } from '../../../../../services/geminiService';
import styles from './ArticleGeneration.module.css';



function ArticleGenerationPageContent() {
  const { user, loading, isAuthenticated, authError } = useAuthGuard({
    redirectTo: '/login',
    requireAuth: true
  });
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL params
  const articleSlug = searchParams.get('id') || 'untitled-interview';
  const topic = searchParams.get('topic') || 'Your Topic';

  // Local state
  const [articleData, setArticleData] = useState(null);
  const [isProcessingInsights, setIsProcessingInsights] = useState(false);
  const [processError, setProcessError] = useState(null);
  const [processSuccess, setProcessSuccess] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Derived state: answered questions check
  const totalQuestions = (articleData?.questions || []).length;
  const answeredCount = (articleData?.questions || []).filter(q => {
    const hasText = typeof q.answer === 'string' && q.answer.trim().length > 0;
    const hasVoice = q.voiceResponse && typeof q.voiceResponse.transcription === 'string' && q.voiceResponse.transcription.trim().length > 0;
    return q.answered && (hasText || hasVoice);
  }).length;
  const canPreprocess = totalQuestions > 0 && answeredCount === totalQuestions;

  // Load article
  useEffect(() => {
    const init = async () => {
      try {
        await requireAuth();
        if (!articleSlug || articleSlug === 'untitled-article') {
          throw new Error('Invalid article ID');
        }
        if (!user) return;
        const data = await getInterviewById(user.uid, articleSlug);
        if (!data) throw new Error('Article not found');
        setArticleData(data);
      } catch (e) {
        console.error('Init error:', e);
        setProcessError(e.message);
      }
    };
    if (!loading && isAuthenticated) {
      init();
    }
  }, [loading, isAuthenticated, user, articleSlug]);

  // Preprocess handler (same logic as Questions page)
  const handlePreprocessInsights = async () => {
    if (!user || !articleSlug || !articleData) return;
    setProcessError(null);
    setProcessSuccess(false);
    setIsProcessingInsights(true);

    try {
      // Build latest payload
      const dataToProcess = {
        ...articleData,
        // Ensure topic is present for the insights API
        topic: articleData?.topic || articleData?.setup?.topic || topic,
        questions: (articleData.questions || []).map(q => ({ ...q }))
      };

      const insightsMap = await processAnswersIntoInsights(dataToProcess);

      if (insightsMap && Object.keys(insightsMap).length > 0) {
        await batchSaveProcessedInsights(user.uid, articleSlug, insightsMap);
        
        // Refresh interview data to show updated insights
        const refreshedData = await getInterviewById(user.uid, articleSlug);
        if (refreshedData) {
          setArticleData(refreshedData);
        }
        
        setProcessSuccess(true);
        setTimeout(() => setProcessSuccess(false), 4000);
      } else {
        setProcessError('No insights were generated (nothing to process).');
      }
    } catch (err) {
      console.error('Preprocessing failed:', err);
      setProcessError(err?.message || 'Preprocessing failed');
    } finally {
      setIsProcessingInsights(false);
    }
  };

  // Publish handler: mark as completed and go to FORMAT view
  const handlePublish = async () => {
    if (!user || !articleSlug) return;
    setIsPublishing(true);
    try {
      await updateInterview(user.uid, articleSlug, { status: 'completed' });
    } catch (e) {
      console.error('Failed to update status to completed:', e);
      // Non-blocking: still navigate to format view
    } finally {
      router.push(`/dashboard/create/interview/format?id=${encodeURIComponent(articleSlug)}&topic=${encodeURIComponent(topic)}`);
      setIsPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Verifying authentication...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>
          <h3>Authentication Error</h3>
          <p>{authError}</p>
          <button onClick={() => router.push('/login')} className={styles.errorButton}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!user || !isAuthenticated) return null;

  return (
    <div className={styles.generationPage}>
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className={styles.generationCard}>
              <div className={styles.generationHeader}>
                <h1 className={styles.stageTitle}>Generate: {topic}</h1>
                <p className={styles.stageDescription}>
                  You can preprocess insights here as well (optional but recommended) before generating.
                </p>
              </div>

              <div className={styles.actionSection}>
                <div className={styles.actionButtons}>
                  <button
                    className={styles.primaryButton}
                    onClick={handlePreprocessInsights}
                    disabled={isProcessingInsights || !articleData || !canPreprocess}
                    title={
                      !articleData
                        ? 'Loading article...'
                        : !canPreprocess
                          ? 'Answer all questions to enable preprocessing'
                          : 'Process answers into insights'
                    }
                  >
                    {isProcessingInsights ? 'Processing…' : 'Preprocess Insights'}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    onClick={handlePublish}
                    title="Publish this article"
                    disabled={isPublishing}
                  >
                    {isPublishing ? 'Publishing…' : 'Publish Article'}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => router.push(`/dashboard/create/interview/questions?id=${articleSlug}&topic=${encodeURIComponent(topic)}`)}
                  >
                    ← Back to Interview
                  </button>
                </div>
                {articleData && (
                  <p style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.9rem',
                    margin: '1rem 0 0',
                    textAlign: 'center'
                  }}>
                    Answered {answeredCount}/{totalQuestions} questions
                    {!canPreprocess && ' — complete all answers to enable preprocessing.'}
                  </p>
                )}
              </div>

              {(processError || processSuccess) && (
                <div className={styles.previewSection}>
                  <div className={processError ? styles.errorMessage : styles.sectionPreview} style={{
                    background: processError 
                      ? 'rgba(239, 68, 68, 0.1)' 
                      : 'rgba(34, 197, 94, 0.1)',
                    border: processError 
                      ? '1px solid rgba(239, 68, 68, 0.3)' 
                      : '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '10px',
                    padding: '1rem',
                    textAlign: 'center'
                  }}>
                    {processError ? (
                      <>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
                        <div>
                          <strong style={{ color: '#ef4444' }}>Preprocessing error:</strong>
                          <p style={{ color: 'rgba(255, 255, 255, 0.8)', margin: '0.5rem 0 0' }}>{processError}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                        <div>
                          <strong style={{ color: '#22c55e' }}>Insights processed and saved.</strong>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* FORMAT.md-style Preview */}
              {articleData && (
                <div className={styles.articlePreview}>
                  <div className={styles.previewHeader}>
                    <h2 className={styles.articleTitle}>🏆 {articleData.topic}</h2>
                  </div>
                  
                  <div className={styles.previewContent}>
                    {/* Key Takeaways */}
                    <div className={styles.previewSection}>
                      <h3>Quick Summary / Key Takeaways</h3>
                      <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1rem' }}>If you only remember 5 things from this guide, make it these:</p>
                      <ul className={styles.takeawaysList}>
                        {(() => {
                          const processed = (articleData.questions || [])
                            .map(q => {
                              let insight = (q.processedInsight || '').trim();
                              
                              // Extract just the takeaway part for key takeaways
                              const takeawayMatch = insight.match(/Takeaway:\s*(.+?)(?=\s*Real Results:|$)/is);
                              if (takeawayMatch) {
                                return takeawayMatch[1].trim();
                              }
                              
                              // Fallback to cleaned insight
                              insight = insight
                                .replace(/^Takeaway:\s*/i, '')
                                .replace(/\s*Real Results:\s*N\/A\s*Takeaway:\s*N\/A\s*$/i, '')
                                .replace(/\s*Real Results:\s*N\/A\s*$/i, '')
                                .replace(/\s*Takeaway:\s*N\/A\s*$/i, '')
                                .trim();
                              return insight;
                            })
                            .filter(Boolean)
                            .slice(0, 5);
                          if (processed.length > 0) {
                            return processed.map((t, i) => <li key={`kt-${i}`}>{t}</li>);
                          }
                          return (
                            <li style={{ color: 'rgba(240, 147, 251, 0.9)' }}>
                              Run "Preprocess Insights" to extract concise takeaways from your answers.
                            </li>
                          );
                        })()}
                      </ul>
                    </div>

                    {/* Intro */}
                    <div className={styles.previewSection}>
                      <h3>Intro</h3>
                      <div className={styles.sectionPreview}>
                        <p className={styles.sectionParagraph}>
                          {(() => {
                            const intro = articleData.setup?.expertIntro || {};
                            const introText = Object.values(intro)
                              .filter(v => typeof v === 'string' && v.trim().length)
                              .join(' ');
                            return introText || `This expert guide on ${articleData.topic} compiles your interview answers into a structured FAQ.`;
                          })()}
                        </p>
                      </div>
                    </div>

                    {/* Table of Contents */}
                    <div className={styles.previewSection}>
                      <h3>📑 FAQ – Table of Contents</h3>
                      <div className={styles.sectionPreview}>
                        <ul className={styles.sectionList}>
                          {(() => {
                            const sections = Array.from(
                              new Set((articleData.questions || []).map(q => q.sectionTitle || 'FAQs'))
                            );
                            return sections.map((s, i) => <li key={`toc-${i}`}>{s}</li>);
                          })()}
                        </ul>
                      </div>
                    </div>

                    {/* FAQs grouped by section */}
                    {(() => {
                      const bySection = (articleData.questions || []).reduce((acc, q) => {
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
                            
                            // Parse the processed insight to extract Real Results and Takeaway
                            let realResults = null;
                            let takeaway = null;
                            
                            if (q.processedInsight) {
                              const insight = q.processedInsight.trim();
                              
                              // Extract Real Results section
                              const realResultsMatch = insight.match(/Real Results:\s*(.+?)(?=\s*Takeaway:|$)/is);
                              if (realResultsMatch && realResultsMatch[1].trim() !== 'N/A') {
                                realResults = realResultsMatch[1].trim();
                              }
                              
                              // Extract Takeaway section
                              const takeawayMatch = insight.match(/Takeaway:\s*(.+?)(?=\s*Real Results:|$)/is);
                              if (takeawayMatch) {
                                takeaway = takeawayMatch[1].trim();
                              } else {
                                // If no "Takeaway:" prefix found, use the whole insight as takeaway
                                const cleanInsight = insight
                                  .replace(/^Takeaway:\s*/i, '')
                                  .replace(/\s*Real Results:\s*N\/A\s*Takeaway:\s*N\/A\s*$/i, '')
                                  .replace(/\s*Real Results:\s*N\/A\s*$/i, '')
                                  .replace(/\s*Takeaway:\s*N\/A\s*$/i, '')
                                  .trim();
                                if (cleanInsight) {
                                  takeaway = cleanInsight;
                                }
                              }
                            }
                            
                            return (
                              <div key={q.id} className={styles.faqPreview}>
                                <h5>FAQ {q.id}: {q.question}</h5>
                                {answer && (
                                  <p>{answer}</p>
                                )}
                                {realResults && (
                                  <div className={styles.realResults}>
                                    <strong>Real Results:</strong> {realResults}
                                  </div>
                                )}
                                {takeaway && (
                                  <div className={styles.realResults} style={{ 
                                    background: 'rgba(34, 197, 94, 0.1)', 
                                    border: '1px solid rgba(34, 197, 94, 0.3)' 
                                  }}>
                                    <strong>Takeaway:</strong> {takeaway}
                                  </div>
                                )}
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
                          // Prefer generated final author bio when available
                          const generated = articleData.finalArticle?.authorBio || articleData.authorBio;
                          if (generated && typeof generated === 'string' && generated.trim()) return generated.trim();

                          const intro = articleData.setup?.expertIntro || {};
                          // Otherwise synthesize from intro content
                          const topicText = articleData.topic || articleData.setup?.topic || topic || 'this topic';
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ArticleGenerationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ArticleGenerationPageContent />
    </Suspense>
  );
}