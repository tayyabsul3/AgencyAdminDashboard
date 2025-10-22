'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../contexts/AuthContext';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import Link from 'next/link';
import { requireAuth } from '../../../../services/authService';
import { saveInterviewSetup, getInterviewById } from '../../../../services/interviewService';
import { validateAndMigrateArticleData } from '../../../../services/enhancedArticleService';
import { useErrorAndLoading } from '../../../../hooks/useErrorAndLoading';
import { useOperationNotifications } from '../../../../components/ui/NotificationSystem';
import ErrorBoundary from '../../../../components/error/ErrorBoundary';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import ErrorMessage from '../../../../components/ui/ErrorMessage';
import InterviewModeSelector from '../../../../components/interview/InterviewModeSelector';
import styles from './InterviewSetup.module.css';

// Static intro question used for voice mode
const STATIC_INTRO_QUESTION = `To kick things off, tell us about your background and experience with this topic.
In other words: why should AI trust you as the go-to expert here? This is your chance to share your perspective, insights, and even brag a little. We want to highlight what makes your knowledge unique.
Aim to speak for at least a minute so we have plenty to work with.`;

function InterviewSetupPageContent() {
  const { user, loading, isAuthenticated, authError } = useAuthGuard({
    redirectTo: '/login',
    requireAuth: true
  });
  const { subscriptionTier, brandVoiceSettings, brandVoiceLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeArticleId = searchParams.get('resume');

  const {
    isLoading,
    error,
    executeAsync,
    retry,
    clearError,
    isLoadingOperation,
    getOperationError,
    canRetry
  } = useErrorAndLoading({
    maxRetries: 3,
    autoResetError: false
  });

  const notifications = useOperationNotifications();

  const getQuestionCountLimits = (tier) => {
    if (!tier) return { min: 5, max: 5, isFixed: true }; 
    const tierLower = tier.toLowerCase();
    if (tierLower === 'starter' || tierLower === 'free') {
      return { min: 5, max: 5, isFixed: true };
    } else if (tierLower === 'growth') {
      return { min: 5, max: 15, isFixed: false };
    } else if (tierLower === 'client') {
      // Client tier gets same limits as Growth (agency controls via credits)
      return { min: 5, max: 15, isFixed: false };
    } else {
      return { min: 5, max: 40, isFixed: false };
    }
  };

  const questionLimits = getQuestionCountLimits(subscriptionTier);

  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(
    Math.min(Math.max(15, questionLimits.min), questionLimits.max)
  );

  const handleQuestionCountChange = (newValue) => {
    const clampedValue = Math.min(Math.max(newValue, questionLimits.min), questionLimits.max);
    setQuestionCount(clampedValue);
  };
  const [isResuming, setIsResuming] = useState(false);
  const [resumeData, setResumeData] = useState(null);

  const [currentStep, setCurrentStep] = useState('mode-selection');
  const [selectedMode, setSelectedMode] = useState(null);

  // Brand voice state
  const [brandModeEnabled, setBrandModeEnabled] = useState(false);

  useEffect(() => {
    const verifyAuthentication = async () => {
      try {
        await requireAuth();
      } catch (error) {
        console.error('Authentication verification failed:', error);
        router.push('/login');
      }
    };

    if (!loading && isAuthenticated) {
      verifyAuthentication();
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    const loadResumeData = async () => {
      if (resumeArticleId && user?.uid && !isResuming) {
        setIsResuming(true);
        try {
          const articleData = await executeAsync(
            () => getInterviewById(user.uid, resumeArticleId),
            'loadResumeData'
          );

          if (articleData) {
            const validatedData = validateAndMigrateArticleData(articleData);
            setResumeData(validatedData);
            setTopic(validatedData.topic || validatedData.setup?.topic || '');
            const existingQuestionCount = validatedData.questionCount || validatedData.setup?.questionCount || 15;
            const adjustedQuestionCount = Math.min(Math.max(existingQuestionCount, questionLimits.min), questionLimits.max);
            setQuestionCount(adjustedQuestionCount);
            if (existingQuestionCount > questionLimits.max) {
              console.warn(`Interview had ${existingQuestionCount} questions, but ${subscriptionTier} tier only allows up to ${questionLimits.max}. Adjusted to ${adjustedQuestionCount}.`);
            }
            if (validatedData.mode || validatedData.setup?.mode) {
              setSelectedMode(validatedData.mode || validatedData.setup.mode);
              setCurrentStep('topic-setup');
            } else {
              setCurrentStep('mode-selection');
            }
            if (validatedData.setup?.expertIntro) {
              // The expert intro data is now handled in the next step
            }
          } else {
            router.push('/dashboard/create/interview');
          }
        } catch (error) {
          console.error('Error loading resume data:', error);
        } finally {
          setIsResuming(false);
        }
      }
    };

    if (resumeArticleId && user?.uid) {
      loadResumeData();
    } else if (user?.uid && !resumeArticleId) {
      setCurrentStep('mode-selection');
    }
  }, [resumeArticleId, user?.uid, executeAsync, router]);

  const handleModeSelection = (mode) => {
    setSelectedMode(mode);
    if (mode === 'keyword') {
      router.push('/dashboard/create/keyword');
      return;
    }
    setCurrentStep('topic-setup');
  };

  const canGenerateQuestions = () => {
    return topic.trim().length >= 3;
  };

  const handleGenerateQuestions = async () => {
    if (!canGenerateQuestions()) return;

    try {
      await notifications.executeWithNotifications(
        async () => {
          const finalMode = selectedMode || 'text';
          const setupData = {
            topic: topic.trim(),
            mode: finalMode,
            questionCount: questionCount,
            expertIntro: finalMode === 'voice' ? {
              question1: STATIC_INTRO_QUESTION,
              answer1: ''
            } : {},
            status: 'in_progress',
            journeyStatus: 'in_progress',
            createdAt: new Date(),
            updatedAt: new Date()
          };

          let currentInterviewId;
          if (resumeArticleId && resumeData) {
            currentInterviewId = resumeArticleId;
            setupData.updatedAt = new Date();
            await saveInterviewSetup(user.uid, setupData);
          } else {
            currentInterviewId = await saveInterviewSetup(user.uid, setupData);
          }

          let targetUrl;
          if (finalMode === 'voice') {
            targetUrl = `/dashboard/create/interview/voice?id=${currentInterviewId}&topic=${encodeURIComponent(topic)}&mode=voice`;
          } else if (finalMode === 'keyword') {
            targetUrl = `/dashboard/create/keyword`;
          } else {
            targetUrl = `/dashboard/create/interview/questions?id=${currentInterviewId}&topic=${encodeURIComponent(topic)}&mode=text`;
          }
          router.push(targetUrl);
        },
        {
          operationName: resumeArticleId ? 'Update Interview Setup' : 'Create Interview Setup',
          loadingMessage: resumeArticleId ? 'Updating your interview setup...' : 'Creating your interview setup...',
          successMessage: resumeArticleId ? 'Interview setup updated successfully!' : 'Interview setup created successfully!',
          showSuccess: false
        }
      );
    } catch (error) {
      console.error('Error creating/updating article:', error);
    }
  };

  const topicComplete = topic.trim().length >= 3;
  const overallProgress = topicComplete ? 100 : 0;

  if (loading || isResuming) {
    return (
      <LoadingSpinner
        size="large"
        text={isResuming ? "Loading article data..." : "Verifying authentication..."}
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
          <button onClick={() => router.push('/login')} className={styles.errorButton}>
            Go to Login
          </button>
        }
      />
    );
  }

  if (!user || !isAuthenticated) {
    return null;
  }

  return (
    <ErrorBoundary>
      <div className={styles.interviewSetup}>
        <div className={`container ${styles.pageContainer}`}>
          <div className="row mb-4">
            <div className="col-12">
              <div className={`${styles.header} ${currentStep === 'mode-selection' ? styles.headerFlush : ''}`}>
                {currentStep === 'mode-selection' ? (
                  <div className="row gx-0">
                    <div className="col-12 px-4">
                      <div className="row gx-0 align-items-center">
                        <div className="col-md-3 d-flex align-items-center ps-0">
                          <Link 
                            href="/dashboard" 
                            className="btn text-white d-inline-flex align-items-center gap-2 fw-semibold"
                            style={{
                              height: '44px',
                              background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                              boxShadow: '0 6px 18px rgba(76, 110, 245, 0.35)',
                              padding: '10px 18px',
                              borderRadius: '8px',
                              border: '4px solid transparent',
                              justifyContent: 'center',
                              fontSize: '14px',
                              lineHeight: '20px'
                            }}
                          >
                            <i className="bi bi-arrow-left"></i>
                            Back to Dashboard
                          </Link>
                        </div>
                        <div className="col-md-6 text-center">
                          <div className="d-inline-flex align-items-center gap-2">
                            <span className={`${styles.iconBadge} ${styles.iconGradient}`} aria-hidden="true">
                              <i className="bi bi-stars"></i>
                            </span>
                            <h1 className={`${styles.title} ${styles.titleGradient}`}>
                              {resumeArticleId ? 'Resume Expert Article' : 'Expert Article Creator'}
                            </h1>
                          </div>
                          <div className={styles.subtitle}>
                            {resumeArticleId
                              ? 'Continue working on your expert article'
                              : 'AI-Powered Interview Process'}
                          </div>
                        </div>
                        <div className="col-md-3"></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="row align-items-center">
                    <div className="col-md-3 d-flex align-items-center">
                      <Link 
                        href="/dashboard" 
                        className="btn text-white d-inline-flex align-items-center gap-2 fw-semibold"
                        style={{
                          height: '44px',
                          background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                          boxShadow: '0 6px 18px rgba(76, 110, 245, 0.35)',
                          padding: '10px 18px',
                          borderRadius: '8px',
                          border: '4px solid transparent',
                          justifyContent: 'center',
                          fontSize: '14px',
                          lineHeight: '20px'
                        }}
                      >
                        <i className="bi bi-arrow-left"></i>
                        Back to Dashboard
                      </Link>
                        </div>
                        <div className={`${'col-md-6'} text-center`}>
                      <div className="d-inline-flex align-items-center gap-2">
                        <span className={`${styles.iconBadge} ${styles.iconGradient}`} aria-hidden="true">
                          <i className="bi bi-stars"></i>
                        </span>
                        <h1 className={`${styles.title} ${styles.titleGradient}`}>
                          {resumeArticleId ? 'Resume Expert Article' : 'Expert Article Creator'}
                        </h1>
                      </div>
                      <div className={styles.subtitle}>
                        {resumeArticleId
                          ? 'Continue working on your expert article'
                          : 'AI-Powered Interview Process'}
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className={styles.compactRight}>
                        <span className="label">Setup Progress</span>
                        <div className={styles.miniBar}>
                          <div className={styles.miniFill} style={{ width: `${overallProgress}%` }}></div>
                        </div>
                        <span className={styles.compactSmall}>{overallProgress}% Complete</span>
                      </div>
                    </div>
                  </div>
                )}
                {resumeArticleId && resumeData && (
                  <div className={styles.resumeInfo}>
                    <div className={styles.resumeBadge}>Resuming: {resumeData.title}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {currentStep === 'mode-selection' ? (
            <div className="row">
              <div className="col-12">
                <InterviewModeSelector
                  onModeSelect={handleModeSelection}
                  isLoading={isLoading}
                />
              </div>
            </div>
          ) : currentStep === 'topic-setup' ? (
            <>
              <div className="row g-4">
                <div className="col-lg-6">
                  <div className={`${styles.card} ${styles.modeCard} mb-4`}>
                    <div className={styles.cardBody}>
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center">
                          <span className={`${styles.iconBadgeLg}`} aria-hidden="true">
                            <i className={`bi ${selectedMode === 'voice' ? 'bi-mic' : 'bi-chat-square-dots'} ${styles.iconInverse}`}></i>
                          </span>
                          <div className="ms-3">
                            <div className={styles.modeTitle}>Interview Mode</div>
                            <div className="d-flex align-items-center mt-1">
                              <span className={styles.statusDot}></span>
                              <span className={`ms-2 ${styles.modeActiveText}`}>
                                {selectedMode === 'voice' ? 'Voice Interview Active' : 'Text Interview Active'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button className={styles.changeModeButton} onClick={() => setCurrentStep('mode-selection')}>Change</button>
                      </div>
                    </div>
                  </div>
                  <div className={`${styles.card} ${styles.topicCard} mb-4`}>
                    <div className={styles.cardHeader}>
                      <h3 className={styles.cardTitle}>
                        <span className={styles.topicIcon} aria-hidden="true">
                          <i className="bi bi-bullseye"></i>
                        </span>
                        Article Topic
                      </h3>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>
                          What's your area of expertise?
                        </label>
                        <input
                          type="text"
                          className={styles.inputLg}
                          placeholder="e.g., Digital Marketing, Leadership, AI Tech"
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                        />
                        {topicComplete ? (
                          <small className={styles.validHint}>✓ Perfect! This topic looks great</small>
                        ) : (
                          <small className={styles.helpText}>Enter your expertise area to get started</small>
                        )}
                      </div>
                      <div className={styles.formGroup}>
                        <div className={styles.depthRow}>
                          <label className={styles.label} style={{marginBottom: 0}}>
                            Interview Depth
                            {questionLimits.isFixed && (
                              <span className={styles.tierIndicator} style={{marginLeft: '0.5rem', fontSize: '0.75rem', color: '#6B7280'}}>
                                ({subscriptionTier || 'Free'} Plan)
                              </span>
                            )}
                          </label>
                          <div>
                            <span className={styles.depthValue}>{questionCount}</span>
                            <span className={styles.depthSuffix}> questions</span>
                          </div>
                        </div>
                        <div className={styles.sliderContainer}>
                          <input
                            type="range"
                            min={questionLimits.min}
                            max={questionLimits.max}
                            value={questionCount}
                            onChange={(e) => handleQuestionCountChange(parseInt(e.target.value))}
                            className={styles.slider}
                            disabled={questionLimits.isFixed}
                            style={{
                              background: questionLimits.isFixed
                                ? '#e5e7eb'
                                : `linear-gradient(90deg, #3b82f6 ${((questionCount - questionLimits.min) / (questionLimits.max - questionLimits.min)) * 100}%, #e5e7eb ${((questionCount - questionLimits.min) / (questionLimits.max - questionLimits.min)) * 100}%)`
                            }}
                          />
                          <div className={styles.sliderLabels}>
                            <span>{questionLimits.min} {questionLimits.isFixed ? '(Fixed)' : '(Min)'}</span>
                            <span>{questionLimits.isFixed ? 'Fixed' : 'Range'}</span>
                            <span>{questionLimits.max} {questionLimits.isFixed ? '' : '(Max)'}</span>
                          </div>
                        </div>
                        {!questionLimits.isFixed && (
                          <div className={styles.tierInfo} style={{marginTop: '0.5rem', fontSize: '0.875rem', color: '#6B7280'}}>
                            Your {subscriptionTier} plan allows {questionLimits.min}-{questionLimits.max} questions
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Brand Voice Card */}
                  {brandVoiceSettings && (
                    <div className={`${styles.card} ${styles.brandVoiceCard} mb-4`}>
                      <div className={styles.cardHeader}>
                        <h3 className={styles.cardTitle}>
                          <span className={styles.brandVoiceIcon} aria-hidden="true">
                            <i className="bi bi-palette"></i>
                          </span>
                          Brand Voice
                          {brandVoiceSettings.enabled && brandModeEnabled && (
                            <span className={styles.brandVoiceActiveBadge}>Active</span>
                          )}
                        </h3>
                      </div>
                      <div className={styles.cardBody}>
                        {brandVoiceSettings.enabled ? (
                          <div className={styles.brandVoiceContent}>
                            <div className={styles.brandVoiceToggle}>
                              <label className={styles.toggleLabel}>
                                <input
                                  type="checkbox"
                                  checked={brandModeEnabled}
                                  onChange={(e) => setBrandModeEnabled(e.target.checked)}
                                  className={styles.toggleInput}
                                />
                                <span className={styles.toggleSlider}></span>
                                <span className={styles.toggleText}>
                                  {brandModeEnabled ? 'Brand Mode ON' : 'Brand Mode OFF'}
                                </span>
                              </label>
                            </div>
                            
                            <div className={styles.brandVoiceStats}>
                              <div className={styles.brandVoiceStat}>
                                <span className={styles.statNumber}>{brandVoiceSettings.preferredTerms?.length || 0}</span>
                                <span className={styles.statLabel}>Preferred Terms</span>
                              </div>
                              <div className={styles.brandVoiceStat}>
                                <span className={styles.statNumber}>{brandVoiceSettings.bannedPhrases?.length || 0}</span>
                                <span className={styles.statLabel}>Banned Phrases</span>
                              </div>
                              <div className={styles.brandVoiceStat}>
                                <span className={styles.statNumber}>{brandVoiceSettings.industry || 'General'}</span>
                                <span className={styles.statLabel}>Industry</span>
                              </div>
                            </div>

                            {brandModeEnabled && (
                              <div className={styles.brandVoiceActive}>
                                <i className="bi bi-check-circle-fill"></i>
                                <span>AI will follow your brand voice rules</span>
                              </div>
                            )}

                            <div className={styles.brandVoiceLink}>
                              <Link href="/dashboard/profile?tab=brandvoice" className={styles.configureLink}>
                                <i className="bi bi-gear"></i>
                                Configure Brand Voice
                              </Link>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.brandVoiceDisabled}>
                            <div className={styles.disabledMessage}>
                              <i className="bi bi-info-circle"></i>
                              <span>Brand voice is not configured</span>
                            </div>
                            <Link href="/dashboard/profile?tab=brandvoice" className={styles.setupLink}>
                              <i className="bi bi-plus-circle"></i>
                              Set up Brand Voice
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className={`${styles.card} ${styles.previewAccent}`}>
                    <div className={styles.cardHeader}>
                      <h3 className={styles.cardTitle}>
                        <span className={styles.previewIcon} aria-hidden="true">
                          <i className="bi bi-bar-chart-line"></i>
                        </span>
                        Article Preview
                      </h3>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.statGrid}>
                        <div className={styles.statBox}>
                          <div className={styles.statNumberBlue}>{Math.max(600, Math.round(questionCount*120))}</div>
                          <div className={styles.statLabel}>Words</div>
                        </div>
                        <div className={styles.statBox}>
                          <div className={styles.statNumberCyan}>~{Math.max(4, Math.round(questionCount*0.6))}m</div>
                          <div className={styles.statLabel}>Read Time</div>
                        </div>
                        <div className={styles.statBox}>
                          <div className={styles.statNumberGreen}>{questionCount}</div>
                          <div className={styles.statLabel}>Questions</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-lg-6">
                   <div className={styles.card}>
                     <div className={`${styles.cardBody} ${styles.setupProgress}`}>
                       <div className={`d-flex align-items-center mb-3 mt-3 ${styles.setupHeader}`}>
                         <span className={styles.headerDot}></span>
                         <div className="fw-bold">Setup Progress</div>
                       </div>
                       <ul className={styles.statusList}>
                         <li className={styles.statusItem}>
                           <div className="d-flex align-items-center">
                             {topicComplete ? (
                               <i className="bi bi-check-circle text-success me-2"></i>
                             ) : (
                               <span className={styles.radioCircle}></span>
                             )}
                             <span className={`${styles.statusLabel} ${topicComplete ? styles.statusLabelComplete : ''}`}>Article Topic</span>
                           </div>
                           <span className={`${styles.statusBadge} ${topicComplete ? styles.badgeComplete : styles.badgePending}`}>{topicComplete ? 'Complete' : 'Pending'}</span>
                         </li>
                       </ul>
                       <div className="d-flex align-items-center justify-content-between small">
                         <span>Overall Progress</span>
                         <span className={styles.overallPercent}>{overallProgress}%</span>
                       </div>
                       <div className={styles.progressBar} style={{marginTop:'8px'}}>
                         <div className={styles.progressFill} style={{width: `${overallProgress}%`}}></div>
                       </div>
                     </div>
                   </div>
                   <div className={`${styles.card} ${styles.hiwCard}`} style={{marginTop:'1rem'}}>
                     <div className={`${styles.cardBody} ${styles.hiwBody}`}>
                       <div className={`d-flex align-items-center ${styles.hiwHeader}`}>
                         <span className={styles.hiwHeaderIcon} aria-hidden="true">
                           <i className="bi bi-info-circle"></i>
                         </span>
                         <h6 className={`mb-0 ${styles.hiwTitleTxt}`}>How it works</h6>
                       </div>
                       <div className="d-flex flex-column">
                         <div className={styles.hiwItem}>
                           <span className={`d-inline-flex align-items-center justify-content-center rounded-circle ${styles.hiwNumber}`}>1</span>
                           <div>
                             <div className={styles.hiwTitle}>Smart Question Generation</div>
                             <p className={styles.hiwDesc}>We create <a href="#" className={styles.hiwLink}>expert-level questions</a> tailored to your topic</p>
                           </div>
                         </div>
                         <div className={styles.hiwItem}>
                           <span className={`d-inline-flex align-items-center justify-content-center rounded-circle ${styles.hiwNumber}`}>2</span>
                           <div>
                             <div className={styles.hiwTitle}>Expert Interview</div>
                             <p className={styles.hiwDesc}>Share your insights and knowledge through our guided interview process</p>
                           </div>
                         </div>
                         <div className={styles.hiwItem}>
                           <span className={`d-inline-flex align-items-center justify-content-center rounded-circle ${styles.hiwNumber}`}>3</span>
                           <div>
                             <div className={styles.hiwTitle}>Article Creation</div>
                             <p className={styles.hiwDesc}>AI transforms your expertise into a professional, publishable article</p>
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>
                   <div className={styles.generateSection} style={{marginTop:'1rem'}}>
                     <button
                       className={`${styles.generateButton} ${overallProgress < 100 || isLoading ? styles.disabled : ''}`}
                       onClick={handleGenerateQuestions}
                       disabled={overallProgress < 100 || isLoading || !canGenerateQuestions()}
                     >
                       {isLoading ? (
                         <>
                           <LoadingSpinner size="small" color="white" />
                           Setting up Interview...
                         </>
                       ) : (
                         overallProgress === 100 ? 'Start Interview' : `Complete Setup (${overallProgress}%)`
                       )}
                     </button>
                     {overallProgress === 100 ? (
                       <div className={styles.successNote} style={{textAlign:'center', marginTop:'8px'}}>✓ Ready to create your expert article!</div>
                     ) : null}
                   </div>
                 </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function InterviewSetupPage() {
  return (
    <Suspense fallback={<LoadingSpinner size="large" />}>
      <InterviewSetupPageContent />
    </Suspense>
  )
}
