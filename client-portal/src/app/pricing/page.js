'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { useAuth } from '../../contexts/AuthContext';
import styles from './pricing.module.css';
import LandingNavbar from '../../components/LandingNavbar/LandingNavbar';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

const Pricing = () => {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  // CTA style to match landing page buttons
  const ctaStyle = {
    width: '180px',
    height: '56px',
    background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
    boxShadow: '0 6px 18px rgba(76, 110, 245, 0.35)',
    padding: '14px 24px',
    borderRadius: '8px',
    border: '4px solid transparent',
    justifyContent: 'center',
    fontSize: '16px',
    lineHeight: '24px'
  };


  const tiers = [
    {
      name: 'Starter',
      price: billingCycle === 'monthly' ? 97 : 1164,
      credits: 4,
      description: 'Perfect for individuals getting started',
      features: [
        '4 credits / month',
        'Keyword → blog articles (1 credit each)',
        'Limited to 1 interview article / month (2 credits)',
        'Export to Google Docs, WordPress, Shopify, Webflow',
        'Priority: Standard email support',
        '+2 free starter credits included',
      ],
      popular: false,
      stripePriceId: 'price_starter_monthly'
    },
    {
      name: 'Growth',
      price: billingCycle === 'monthly' ? 197 : 3564,
      credits: 15,
      description: 'For scaling teams and growing businesses',
      features: [
        '10 credits / month',
        'Keyword blogs (1 credit) + Interview articles (2 credits)',
        'Unlimited interviews (credit-based)',
        'Enhanced articles with stats, FAQs, comparisons',
        'Unlimited projects & keywords',
        'Priority email support',
        '+2 free starter credits included',
        '10% credit rollover month to month',
      ],
      popular: true,
      stripePriceId: 'price_growth_monthly'
    },
    {
      name: 'Scale',
      price: billingCycle === 'monthly' ? 497 : 11964,
      credits: 60,
      description: 'For scaling operations with advanced needs',
      features: [
        '30 credits / month',
        'Keyword + Enhanced + Interview articles',
        'Priority chat support',
        '+2 free starter credits included',
        '10% credit rollover month to month',
      ],
      popular: false,
      stripePriceId: 'price_scale_monthly'
    },
    {
      name: 'Agency Custom',
      price: billingCycle === 'monthly' ? 'Custom' : 'Custom',
      priceRange: true,
      credits: 100,
      description: 'Bespoke solutions for agencies and enterprise clients',
      features: [
        '10+ seats',
        '100–500+ credits / month (volume pricing)',
        'White-label dashboard (full branding)',
        'Dedicated account manager & onboarding',
      ],
      popular: false,
      stripePriceId: 'price_agency_custom_monthly'
    }
  ];

  const handleSubscribe = async (tier) => {
    // Handle Agency Custom tier differently - redirect to Calendly
    if (tier.name === 'Agency Custom') {
      window.open('http://www.calendly.com/mikesanchez/60min', '_blank');
      return;
    }

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    try {
      // Show a loading indicator or disable button
      console.log('Starting checkout for tier:', tier.name);

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:5002/lead-generation-6cf0f/us-central1/api';
      const response = await fetch(`${apiBaseUrl}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: tier.name.toLowerCase(),
          billingCycle,
          userId: user?.uid || null,
        }),
      });

      const data = await response.json();
      console.log('API Response:', response.status, data);

      if (data.success && data.data?.url) {
        console.log('Redirecting to Stripe checkout:', data.data.url);
        window.location.href = data.data.url;
      } else {
        // Show user-friendly error message
        const errorMessage = data.error?.message || 'Failed to create checkout session';
        console.error('Checkout session error:', errorMessage);

        // Display error to user
        alert(`Unable to process payment: ${errorMessage}\n\nPlease try again later or contact support if the issue persists.`);

        // If it's a configuration error, provide more context
        if (data.error?.code === 'STRIPE_NOT_CONFIGURED') {
          console.log('Stripe is not configured. Please set up STRIPE_SECRET_KEY in Firebase Functions environment.');
        }
      }
    } catch (error) {
      console.error('Network or unexpected error:', error);
      alert('Unable to connect to payment service. Please check your internet connection and try again.');
    }
  };

  return (
    <div className={styles.pricing}>
      <div className={styles.contentWrapper}>
        {/* Landing Navbar - pricing page specific width and spacing */}
        <LandingNavbar
          containerClass={styles.pricingNavContainer}
          innerClass={`${styles.pricingNavInner} p-2`}
        />
        <div className={styles.container}>
          <div className={styles.header}>
            <h2
              className="text-center fw-bold mb-2"
              style={{
                fontSize: '5rem',
                lineHeight: 1.2,
                background: 'linear-gradient(90deg, #627FFF 0%, #23D2EE 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                marginTop: '2rem'
              }}
            >
              QueryFuel Pricing
            </h2>
            <p className="text-center fw-semibold text-dark mb-2" style={{fontSize: '1.375rem'}}>
              Turn keywords and interviews into publish-ready AIO articles.
            </p>
            <p className="text-center text-muted mb-5" style={{maxWidth: '840px', marginLeft: 'auto', marginRight: 'auto', fontSize: '1.125rem'}}>
              Every plan includes 2 free starter credits so you can try both keyword and interview workflows before you commit.
            </p>
          </div>
          <div className="container">
            <div className="row row-cols-1 row-cols-lg-4 g-4">
              {tiers.map((tier) => {
                const label = tier.name === 'Agency Custom' ? 'Talk to Sales' : `Start ${tier.name.split(' ')[0]}`;
                return (
                  <div className="col d-flex" key={tier.name}>
                    <div className={`${styles.tier} ${styles.tierBorder} ${tier.name === 'Scale' ? styles.scaleGradient : ''} ${tier.popular ? styles.popular : ''} w-100 d-flex flex-column`}>
                      {tier.popular && <div className={styles.popularBadge}>Most Popular</div>}

                      <div className={styles.tierHeader}>
                        <h3 className={styles.tierName}>{tier.name}</h3>
                        <div className={styles.price}>
                          <span className={styles.currency}>$</span>
                          <span className={styles.amount}>{tier.price}</span>
                          {!tier.priceRange && (
                            <span className={styles.period}>/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                          )}
                        </div>
                        <p className={styles.tierDescription}>{tier.description}</p>
                      </div>

                      <ul className={styles.features}>
                      {tier.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className={styles.feature}>
                          <span className={styles.bulletIcon} aria-hidden="true"></span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className={`${styles.ctaWrap} d-flex justify-content-center mt-auto`}>
                      <button
                        className={`${styles.subscribeBtn} btn text-white fw-semibold d-inline-flex align-items-center gap-2 mx-auto`}
                        style={ctaStyle}
                        onClick={() => handleSubscribe(tier)}
                      >
                        {label}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          {/* What's a Credit? info container */}
          <div className="container my-5">
            <div className="row justify-content-center">
              <div className="col-lg-12">
                <div className={`d-flex align-items-start gap-3 p-4 rounded-4 border bg-light ${styles.creditInfo}`}>
                  {/* Icon */}
                  <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{width: 44, height: 44, background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)', boxShadow: '0 4px 12px rgba(76,110,245,.25)'}}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M4 7h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" stroke="white" strokeWidth="1.6"/>
                      <path d="M4 7h16v2H4z" fill="white"/>
                      <rect x="7.5" y="13" width="5" height="2" rx="1" fill="white"/>
                    </svg>
                  </div>
                  {/* Text */}
                  <div className="flex-grow-1">
                    <h3 className="h5 fw-bold mb-2 text-dark">What’s a Credit?</h3>
                    <ul className="mb-0 ps-3 text-muted">
                      <li className="mb-1">1 credit = keyword input → blog article</li>
                      <li className="mb-1">2 credits = full interview → humanized article (expert commentary, stats, FAQs)</li>
                      <li className="mb-0">Credits refresh monthly; Growth+ plans include 10% rollover</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Why Users Choose QueryFuel */}
          <div className="container my-4">
            <div className="row justify-content-center">
              <div className="col-lg-12">
                <div className={`d-flex align-items-start gap-3 p-4 rounded-4 border bg-light ${styles.creditInfo}`}>
                  {/* Icon */}
                  <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{width: 44, height: 44, background: 'linear-gradient(135deg, #22c55e 0%, #86efac 100%)', boxShadow: '0 4px 12px rgba(34,197,94,.25)'}}>
                    {/* Trophy/Star icon */}
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M12 3l2.09 4.24L18.8 8.4l-3.4 3.31.8 4.68L12 14.9l-4.2 2.2.8-4.68L5.2 8.4l4.71-1.16L12 3z" fill="white"/>
                    </svg>
                  </div>
                  {/* Text */}
                  <div className="flex-grow-1">
                    <h3 className="h5 fw-bold mb-2 text-dark">Why Users Choose QueryFuel</h3>
                    <ul className="list-unstyled mb-0">
                      <li className="d-flex align-items-start gap-2 mb-1">
                        <span className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{width:18,height:18,background:'#eafff6'}}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                        <span>2 Free Credits with every plan (try keyword & interview)</span>
                      </li>
                      <li className="d-flex align-items-start gap-2 mb-1">
                        <span className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{width:18,height:18,background:'#eafff6'}}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                        <span>Save 80–90% of time compared to manual writing</span>
                      </li>
                      <li className="d-flex align-items-start gap-2 mb-1">
                        <span className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{width:18,height:18,background:'#eafff6'}}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                        <span>Built for AI Overviews (AIO) so you get cited in Google AI results</span>
                      </li>
                      <li className="d-flex align-items-start gap-2 mb-1">
                        <span className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{width:18,height:18,background:'#eafff6'}}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                        <span>White-label ready for agencies (Growth+)</span>
                      </li>
                      <li className="d-flex align-items-start gap-2 mb-0">
                        <span className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{width:18,height:18,background:'#eafff6'}}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                        <span>Export in one click: Docs, WordPress, Shopify, Webflow</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;