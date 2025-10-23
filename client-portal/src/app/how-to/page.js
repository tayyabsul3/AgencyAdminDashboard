'use client';

import styles from './HowToPage.module.css';
import { FaRegCheckCircle, FaChartBar, FaRegFileAlt, FaChartLine, FaBrain, FaQuoteLeft, FaArrowRight } from 'react-icons/fa';
import ImageCarousel from '@/components/ImageCarousel/ImageCarousel';
import LandingNavbar from '@/components/LandingNavbar/LandingNavbar';

export default function HowToPage() {
  return (
    <>
      <LandingNavbar containerClass="py-2" showDrawer={false} getStartedHref="/login" />
      <main className="position-relative bg-light overflow-hidden">
        {/* Left/Right glow backgrounds (behind hero content) */}
        <div className="d-none d-md-block position-absolute" aria-hidden="true"
             style={{ top: '170px', left: '-340px', width: '360px', height: '360px', background: 'linear-gradient(90deg, #23D2EE 0%, #627FFF 100%)', filter: 'blur(120px)', WebkitBackdropFilter: 'blur(120px)', backdropFilter: 'blur(120px)', borderRadius: '50%', opacity: 1, pointerEvents: 'none', zIndex: 0 }}></div>
        <div className="d-none d-md-block position-absolute" aria-hidden="true"
             style={{ top: '170px', right: '-340px', width: '360px', height: '360px', background: 'linear-gradient(90deg, #23D2EE 0%, #627FFF 100%)', filter: 'blur(120px)', WebkitBackdropFilter: 'blur(120px)', backdropFilter: 'blur(120px)', borderRadius: '50%', opacity: 1, pointerEvents: 'none', zIndex: 0 }}></div>

        <div className={styles.pageContainer} style={{ paddingTop: '10px' }}>
          <div className={styles.headerSection}>
            <h1 className="display-3 display-md-2 lh-1 mb-3 text-center mx-auto">
              <span style={{ fontWeight: 400 }}>Example Blog<br/>
              </span><span style={{
                background: 'linear-gradient(180deg, #59a1ff 0%, #4a78ff 60%, #6fe0ff 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                fontWeight: 700
              }}>AI Overviews</span><br/>
            </h1>
            <p className="lead text-muted mx-auto mb-4 text-center" style={{ maxWidth: '860px' }}>Learn how QueryFuel helps brands get cited in AI overviews with real-world examples</p>
          </div>

          <div className={styles.featuredArticleCard}>
            <div className={styles.tags}>
              <span className={styles.tag}>Featured Article</span>
              <span className={styles.tag}>Case Study</span>
            </div>
            <h2 className={styles.articleTitle}>How ViralSweep Gets Cited in AI Overviews Using QueryFuel</h2>
            <p className={styles.articleDescription}>A complete guide to transforming expert knowledge into AI-friendly content that wins citations in Google, ChatGPT, and Perplexity</p>
            <div className={styles.articleMeta}>
              <span>Published October 17, 2025</span>
              <span>•</span>
              <span>8 min read</span>
              <span>•</span>
              <span>SEO & Content Strategy</span>
            </div>
          </div>

          <div className={styles.whatsIncludedSection}>
            <h3 className={`${styles.whatsIncludedTitle} ${styles.gradientText}`}>What's Included In This Article</h3>
            <div className={styles.contentCardsGrid}>
              <div className={styles.contentCard}>
                <FaRegCheckCircle className={styles.cardIcon} />
                <h4 className={styles.cardTitle}>Interview-to-Content Process</h4>
                <p className={styles.cardDescription}>Learn how ViralSweep's expertise was transformed into structured, citation-worthy content through our AI-powered interview system.</p>
              </div>
              <div className={styles.contentCard}>
                <FaChartBar className={styles.cardIcon} />
                <h4 className={styles.cardTitle}>Stats & Data Integration</h4>
                <p className={styles.cardDescription}>See how we enriched the content with industry statistics, data points, and metrics that AI systems trust and cite.</p>
              </div>
              <div className={styles.contentCard}>
                <FaRegFileAlt className={styles.cardIcon} />
                <h4 className={styles.cardTitle}>Structured Content Format</h4>
                <p className={styles.cardDescription}>Discover the exact structure and formatting techniques that make content easily parseable by Google, ChatGPT, and other AI engines.</p>
              </div>
              <div className={styles.contentCard}>
                <FaChartLine className={styles.cardIcon} />
                <h4 className={styles.cardTitle}>Citation Results & Analytics</h4>
                <p className={styles.cardDescription}>Real results showing how ViralSweep achieved citations in AI overviews, including visibility metrics and performance data.</p>
              </div>
            </div>
          </div>

          <div className={styles.screenshotsSection}>
            <h3 className={`${styles.screenshotsTitle} ${styles.gradientText}`}>Article Screenshots & Highlights</h3>
            <div className={styles.screenshotItem}>
              <h4 className={`${styles.screenshotSubtitle} ${styles.gradientText}`}>1. The Interview Process</h4>
              <ImageCarousel
                images={[
                  '/images/how-to/step1.png',
                  '/images/how-to/step2.png',
                  '/images/how-to/step3.png',
                  '/images/how-to/step4.png',
                  '/images/how-to/step5.png',
                  '/images/how-to/step6.png',
                  '/images/how-to/step7.png',
                  '/images/how-to/step8.png',
                  '/images/how-to/step9.png',
                ]}
                descriptions={[
                  'Go to dashboard and click generate article',
                  'Choose plan',
                  'Type Topic',
                  'It will load',
                  'Add your introduction',
                  'Starting answering questions',
                  'Answer all questions',
                  'Here we gave all answers and now we are good to go',
                  'Publish and generate article',
                ]}
              />
              <p className={styles.screenshotDetail}>Our AI interviewer asked targeted questions about sweepstakes, contest marketing, and lead generation strategies. The conversation captured ViralSweep's unique expertise in a natural, conversational format.</p>
            </div>

            <div className={styles.screenshotItem}>
              <h4 className={`${styles.screenshotSubtitle} ${styles.gradientText}`}>2. Content Transformation</h4>
              <ImageCarousel
                images={[
                  '/images/how-to/contentStep1.png',
                  '/images/how-to/contentStep2.png',
                ]}
                descriptions={[
                  'We can see our ariticle is generated',
                  'Here are headings,checklist and bullet points,showing our seo optimized content',
                ]}
              />
              <p className={styles.screenshotDetail}>The interview responses were automatically transformed into a comprehensive article with proper headings, bullet points, statistics, and checklist sections optimized for AI parsing.</p>
            </div>
          </div>

          <div className={styles.keyTakeawaysSection}>
            <h3 className={`${styles.keyTakeawaysTitle} ${styles.gradientText}`}>Key Takeaways from the ViralSweep Case Study</h3>
            <div className={styles.takeawayItem}>
              <FaRegCheckCircle className={styles.takeawayIcon} />
              <p className={styles.takeawayText}><strong>Time Savings:</strong> Content created in under 30 minutes vs. 8+ hours traditional writing</p>
            </div>
            <div className={styles.takeawayItem}>
              <FaRegCheckCircle className={styles.takeawayIcon} />
              <p className={styles.takeawayText}><strong>Citation Rate:</strong> Featured in 12 different AI overview results within first month</p>
            </div>
            <div className={styles.takeawayItem}>
              <FaRegCheckCircle className={styles.takeawayIcon} />
              <p className={styles.takeawayText}><strong>SEO Impact:</strong> 45% increase in organic traffic from AI-powered search results</p>
            </div>
            <div className={styles.takeawayItem}>
              <FaRegCheckCircle className={styles.takeawayIcon} />
              <p className={styles.takeawayText}><strong>Content Quality:</strong> Structured format with stats, checklists, and expert insights</p>
            </div>
            <div className={styles.takeawayItem}>
              <FaRegCheckCircle className={styles.takeawayIcon} />
              <p className={styles.takeawayText}><strong>Platform Coverage:</strong> Citations across Google, ChatGPT, and Perplexity</p>
            </div>
          </div>

          <div className={styles.callToActionSection}>
            <h2 className={styles.callToActionTitle}>Ready to Get Your Brand Cited?</h2>
            <p className={styles.callToActionSubtitle}>
              Join ViralSweep and hundreds of other brands using QueryFuel to dominate
              AI-powered search results
            </p>
            <button className={styles.callToActionBtn}>
              Try QueryFuel Free <FaArrowRight className={styles.callToActionArrow} />
            </button>
            <p className={styles.callToActionFinePrint}>No credit card required - Get started in minutes</p>
          </div>
        </div>
      </main>
    </>
  );
}