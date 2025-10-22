'use client';

import Link from 'next/link';
import styles from './Footer.module.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.brand}>
            <div className={styles.brandInfo}>
              <span className={styles.logo}></span>
              <span className={styles.brandText}>QueryFuel</span>
            </div>
            <p className={styles.brandDescription}>
              Transform your expertise into professional blog articles with AI. 
              From interview to published content in minutes, powered by GPT-4, DALL-E, and advanced AI tools.
            </p>
            <div className={styles.social}>
              <Link href="#" className={styles.socialLink}></Link>
              <Link href="#" className={styles.socialLink}></Link>
              <Link href="#" className={styles.socialLink}></Link>
              <Link href="#" className={styles.socialLink}></Link>
            </div>
          </div>

          <div className={styles.links}>
            <div className={styles.linkGroup}>
              <h4 className={styles.linkTitle}>Product</h4>
              <ul className={styles.linkList}>
                <li><Link href="/how-it-works" className={styles.link}>How It Works</Link></li>
                <li><Link href="/pricing" className={styles.link}>Pricing</Link></li>
                <li><Link href="/examples" className={styles.link}>Examples</Link></li>
                <li><Link href="/ai-tools" className={styles.link}>AI Tools</Link></li>
              </ul>
            </div>

            <div className={styles.linkGroup}>
              <h4 className={styles.linkTitle}>Use Cases</h4>
              <ul className={styles.linkList}>
                <li><Link href="/experts" className={styles.link}>Industry Experts</Link></li>
                <li><Link href="/consultants" className={styles.link}>Consultants</Link></li>
                <li><Link href="/educators" className={styles.link}>Educators</Link></li>
                <li><Link href="/businesses" className={styles.link}>Businesses</Link></li>
              </ul>
            </div>

            <div className={styles.linkGroup}>
              <h4 className={styles.linkTitle}>Resources</h4>
              <ul className={styles.linkList}>

                <li><Link href="/help" className={styles.link}>Help Center</Link></li>
                <li><Link href="/api-docs" className={styles.link}>API Docs</Link></li>
                <li><Link href="/templates" className={styles.link}>Templates</Link></li>
              </ul>
            </div>

            <div className={styles.linkGroup}>
              <h4 className={styles.linkTitle}>Company</h4>
              <ul className={styles.linkList}>
                <li><Link href="/about" className={styles.link}>About</Link></li>
                <li><Link href="/contact" className={styles.link}>Contact</Link></li>
                <li><Link href="/privacy" className={styles.link}>Privacy</Link></li>
                <li><Link href="/terms" className={styles.link}>Terms</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <div className={styles.copyright}>
            <p>&copy; {currentYear} QueryFuel. All rights reserved.</p>
          </div>
          <div className={styles.badges}>
            <span className={styles.badge}>AI-Powered</span>
            <span className={styles.badge}>Secure & Private</span>
            <span className={styles.badge}>Lightning Fast</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;