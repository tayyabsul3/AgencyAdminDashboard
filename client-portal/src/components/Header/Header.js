'use client';

import Link from 'next/link';
import styles from './Header.module.css';

const Header = () => {
    return (
        <header className={styles.header}>
            <div className={styles.bgAnimation}></div>
            <div className={styles.container}>
                <div className={styles.content}>
                    <h1 className={styles.title}>
                        <span className={styles.titleMain}>Turn Your Expertise Into</span>
                        <span className={styles.titleSub}>Professional Blog Articles</span>
                    </h1>
                    <p className={styles.description}>
                        QueryFuel uses AI to interview you about your domain knowledge, then automatically
                        generates SEO-optimized blog posts with images, audio, and multiple formats.
                        From expert to published author in minutes, not hours.
                    </p>
                    <div className={styles.features}>
                        <div className={styles.feature}>
                            <span className={styles.featureIcon}></span>
                            <span>AI-Powered Interviews</span>
                        </div>
                        <div className={styles.feature}>
                            <span className={styles.featureIcon}></span>
                            <span>Auto-Generated Content</span>
                        </div>
                        <div className={styles.feature}>
                            <span className={styles.featureIcon}></span>
                            <span>Images & Audio Included</span>
                        </div>
                        <div className={styles.feature}>
                            <span className={styles.featureIcon}></span>
                            <span>Multiple Export Formats</span>
                        </div>
                    </div>
                    <div className={styles.cta}>
                        <Link href="/login" className={styles.ctaPrimary}>
                            Get Started
                        </Link>
                    </div>
                    <div className={styles.socialProof}>
                        <p className={styles.proofText}>Join 1,000+ experts who&apos;ve published with QueryFuel</p>
                        <div className={styles.stats}>
                            <div className={styles.stat}>
                                <span className={styles.statNumber}>10K+</span>
                                <span className={styles.statLabel}>Articles Generated</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statNumber}>95%</span>
                                <span className={styles.statLabel}>Time Saved</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statNumber}>4.9★</span>
                                <span className={styles.statLabel}>User Rating</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className={styles.visual}>
                    <div className={styles.demoFlow}>
                        <div className={styles.step}>
                            <div className={styles.stepIcon}></div>
                            <div className={styles.stepContent}>
                                <h3>1. AI Interview</h3>
                                <p>Answer questions about your expertise via text or voice</p>
                            </div>
                        </div>
                        <div className={styles.arrow}>↓</div>
                        <div className={styles.step}>
                            <div className={styles.stepIcon}></div>
                            <div className={styles.stepContent}>
                                <h3>2. AI Processing</h3>
                                <p>GPT-4 analyzes your knowledge and creates structured content</p>
                            </div>
                        </div>
                        <div className={styles.arrow}>↓</div>
                        <div className={styles.step}>
                            <div className={styles.stepIcon}></div>
                            <div className={styles.stepContent}>
                                <h3>3. Article Ready</h3>
                                <p>Professional blog post with images, audio, and multiple formats</p>
                            </div>
                        </div>
                    </div>
                    <div className={styles.previewCard}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}>Generated Article Preview</div>
                        </div>
                        <div className={styles.articlePreview}>
                            <div className={styles.articleTitle}>The Future of AI in Healthcare</div>
                            <div className={styles.articleMeta}>By Dr. Sarah Johnson • 8 min read • Audio available</div>
                            <div className={styles.articleContent}>
                                <div className={styles.contentLine}></div>
                                <div className={styles.contentLine}></div>
                                <div className={`${styles.contentLine} ${styles.short}`}></div>
                                <div className={styles.imageBox}>AI-Generated Image</div>
                                <div className={styles.contentLine}></div>
                                <div className={styles.contentLine}></div>
                            </div>
                            <div className={styles.exportOptions}>
                                <span className={styles.exportBtn}>PDF</span>
                                <span className={styles.exportBtn}>Docs</span>
                                <span className={styles.exportBtn}>HTML</span>
                                <span className={styles.exportBtn}>MD</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;