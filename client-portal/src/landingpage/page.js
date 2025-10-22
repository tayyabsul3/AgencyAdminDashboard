"use client";
import React from "react";
import Link from "next/link";
import LandingNavbar from "../components/LandingNavbar/LandingNavbar";

export default function QueryfuelLandingPage() {
  return (
    <>

      <main className="position-relative bg-light overflow-hidden">
      {/* Top nav: reusable component */}
      <LandingNavbar containerClass="py-2" showDrawer={false} getStartedHref="/signup" />

      {/* Hero */}
      <section className="py-5 py-xl-6 position-relative overflow-hidden">
        {/* Left/Right glow backgrounds (behind hero content) */}
        <div className="d-none d-md-block position-absolute" aria-hidden="true"
             style={{ top: '170px', left: '-340px', width: '360px', height: '360px', background: 'linear-gradient(90deg, #23D2EE 0%, #627FFF 100%)', filter: 'blur(120px)', WebkitBackdropFilter: 'blur(120px)', backdropFilter: 'blur(120px)', borderRadius: '50%', opacity: 1, pointerEvents: 'none', zIndex: 0 }}></div>
        <div className="d-none d-md-block position-absolute" aria-hidden="true"
             style={{ top: '170px', right: '-340px', width: '360px', height: '360px', background: 'linear-gradient(90deg, #23D2EE 0%, #627FFF 100%)', filter: 'blur(120px)', WebkitBackdropFilter: 'blur(120px)', backdropFilter: 'blur(120px)', borderRadius: '50%', opacity: 1, pointerEvents: 'none', zIndex: 0 }}></div>

        <div className="container-xl position-relative" style={{ zIndex: 1 }}>
          <div className="row justify-content-center">
            <div className="col-12 col-xl-10 text-center mx-auto">
              <h1 className="display-3 display-md-2 lh-1 mb-3">
                <span style={{ fontWeight: 400 }}>Get Your Brand Cited<br/>
                in </span><span style={{
                  background: 'linear-gradient(180deg, #59a1ff 0%, #4a78ff 60%, #6fe0ff 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  fontWeight: 700
                }}>AI Overviews</span><br/>
                
              </h1>
              <p className="lead text-muted mx-auto mb-4" style={{ maxWidth: '860px' }}> 
              Our interview-to-content engine turns your knowledge into structured, AI-friendly articles — complete with stats, checklists, and images — built to win citations in Google, ChatGPT, and Perplexity.
              </p>

              {/* Chips */}
              <div className="d-flex flex-wrap justify-content-center gap-3 mb-4">
                {/* Chip 1 */}
                <div className="rounded-pill d-inline-flex" style={{ padding: '1px', background: 'linear-gradient(90deg, #627FFF 0%, #23D2EE 100%)' }}>
                  <div className="bg-white rounded-pill d-inline-flex align-items-center gap-2 px-3" style={{ minWidth: '152px', height: '45px' }}>
                    
                    <span className="small text-dark text-nowrap">⚡ Interview to AIO Article in Minutes</span>
                  </div>
                </div>

                {/* Chip 2 */}
                <div className="rounded-pill d-inline-flex" style={{ padding: '1px', background: 'linear-gradient(90deg, #627FFF 0%, #23D2EE 100%)' }}>
                  <div className="bg-white rounded-pill d-inline-flex align-items-center gap-2 px-3" style={{ minWidth: '152px', height: '45px' }}>
            
                    <span className="small text-dark text-nowrap"> 📝 Perfectly Structured & SEO-Ready</span>
                  </div>
                </div>

                {/* Chip 3 */}
                <div className="rounded-pill d-inline-flex" style={{ padding: '1px', background: 'linear-gradient(90deg, #627FFF 0%, #23D2EE 100%)' }}>
                  <div className="bg-white rounded-pill d-inline-flex align-items-center gap-2 px-3" style={{ minWidth: '152px', height: '45px' }}>
                    <span className="small text-dark text-nowrap">📄 One-Click Publish</span>
                  </div>
                </div>
              </div>

              {/* CTAs */}
              <div className="d-flex flex-column flex-sm-row justify-content-center align-items-center gap-3">
                <Link 
                href="/signup" 
                className="btn btn-gradient-border text-white d-inline-flex align-items-center gap-2 fw-semibold"
                style={{
                  width: '277px',
                  height: '56px',
                  background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                  boxShadow: '0 8px 20px rgba(191, 218, 232, 0.73), 0 4px 8px rgba(140, 222, 247, 0.15)',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  justifyContent: 'center',
                  fontSize: '16px',
                  lineHeight: '24px'
                }}
              >
                <i className="bi bi-rocket-takeoff"></i>
                Get started for FREE
              </Link>
                <a 
                  href="#video" 
                  className="d-inline-flex align-items-center gap-3"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#374151',
                    fontSize: '16px',
                    fontWeight: '500',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <img 
                    src="/images/Demo Button.svg" 
                    alt="Play" 
                    style={{
                      width: '48px',
                      height: '48px',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.3' }}>
                    <span style={{marginLeft: '-0px'}}>Watch Demo</span>
                  
                  </div>
                </a>
              </div>

              {/* Steps + Input Panel */}
              <div className="container px-0 mt-5" style={{maxWidth: '1080px'}}>
                {/* Steps */}
                <div className="row g-3 justify-content-center mb-4">
                  <div className="col-12 col-md-4 d-flex justify-content-center">
                    <div className="border shadow-sm d-flex flex-column" style={{
                      borderColor: '#C2C2C2',
                      background: '#F4F4F4',
                      width: '100%',
                      maxWidth: '362px',
                      minHeight: '157px',
                      padding: '24px',
                      borderRadius: '14px',
                      borderWidth: '1px'
                    }}>
                      <div className="text-start">
                        <span className="d-inline-flex align-items-center mb-2" style={{
                          width: '32px',
                          height: '32px',
                          background: 'transparent',
                          color: '#627FFF',
                          border: '0',
                          boxShadow: 'none',
                          flexShrink: 0,
                          justifyContent: 'flex-start'
                        }}>
                          <img src="/images/input mic icon.svg" alt="Step 01" width="32" height="32" style={{ display: 'block' }} />
                        </span>
                        <h5 className="mb-2 fw-semibold" style={{color: '#111827'}}><span className="me-2" style={{ background: 'linear-gradient(90deg, #23D2EE 0%, #627FFF 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>01</span>Choose a Keyword</h5>
                        <p className="mb-0" style={{color: '#6B7280', fontSize: '0.875rem', lineHeight: '1.5'}}>
                          Get interviewed by our tool for maximum citation potential!
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-12 col-md-4 d-flex justify-content-center">
                    <div className="border shadow-sm d-flex flex-column" style={{
                      borderColor: '#C2C2C2',
                      background: '#F4F4F4',
                      width: '100%',
                      maxWidth: '362px',
                      minHeight: '157px',
                      padding: '24px',
                      borderRadius: '14px',
                      borderWidth: '1px'
                    }}>
                      <div className="text-start">
                        <span className="d-inline-flex align-items-center mb-2" style={{
                          width: '32px',
                          height: '32px',
                          background: '#F4F4F4',
                          color: '#627FFF',
                          border: '0',
                          boxShadow: 'none',
                          flexShrink: 0,
                          justifyContent: 'flex-start'
                        }}>
                          <img src="/images/input Ai icon.svg" alt="Step 02" width="32" height="32" style={{ display: 'block' }} />
                        </span>
                        <h5 className="mb-2 fw-semibold" style={{color: '#111827'}}><span className="me-2" style={{ background: 'linear-gradient(90deg, #23D2EE 0%, #627FFF 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>02</span>AI Transformation</h5>
                        <p className="mb-0" style={{color: '#6B7280', fontSize: '0.875rem', lineHeight: '1.5'}}>
                          We extract insights, add stats and structure for search visibility.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-12 col-md-4 d-flex justify-content-center">
                    <div className="border shadow-sm d-flex flex-column" style={{
                      borderColor: '#C2C2C2',
                      background: '#F4F4F4',
                      width: '100%',
                      maxWidth: '362px',
                      minHeight: '157px',
                      padding: '24px',
                      borderRadius: '14px',
                      borderWidth: '1px'
                    }}>
                      <div className="text-start">
                        <span className="d-inline-flex align-items-center mb-2" style={{
                          width: '32px',
                          height: '32px',
                          background: 'transparent',
                          color: '#627FFF',
                          border: '0',
                          boxShadow: 'none',
                          flexShrink: 0,
                          justifyContent: 'flex-start'
                        }}>
                          <img src="/images/input publish icon.svg" alt="Step 03" width="32" height="32" style={{ display: 'block' }} />
                        </span>
                        <h5 className="mb-2 fw-semibold" style={{color: '#111827'}}><span className="me-2" style={{ background: 'linear-gradient(90deg, #23D2EE 0%, #627FFF 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>03</span>Publish Anywhere</h5>
                        <p className="mb-0" style={{color: '#6B7280', fontSize: '0.875rem', lineHeight: '1.5'}}>
                          Publish to WordPress, Webflow, Shopify or Export to Google Doc
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connection Flow Section (local assets) */}
              <div className="d-none d-md-block position-relative mx-auto" style={{ width: '680px', height: '160px', transform: 'translateY(-24px)' }}>
                {/* Vectors - positioned to converge at a single point */}
                <img
                  className="position-absolute"
                  alt="Vector left connector"
                  src="/images/Vector 2.svg"
                  style={{ width: '550px', height: '192px', left: '-121px', top: 0 }}
                />
                <img
                  className="position-absolute start-50 translate-middle-x"
                  alt="Center frame connector"
                  src="/images/Vector 3.svg"
                  style={{ width: '147px', height: '192px', top: 0 }}
                />
                <img
                  className="position-absolute"
                  alt="Vector right connector"
                  src="/images/Vector 1.svg"
                  style={{ width: '550px', height: '192px', right: '-115.5px', top: 0 }}
                />

                {/* Blue dots - only at the top */}
                <img
                  className="position-absolute"
                  alt="Left dot"
                  src="/images/blue dot.svg"
                  style={{ width: '8px', height: '8px', left: '-35px', top: '0px' }}
                />
                <img
                  className="position-absolute start-50 translate-middle-x"
                  alt="Center top dot"
                  src="/images/blue dot.svg"
                  style={{ width: '8px', height: '8px', top: '0px' }}
                />
                <img
                  className="position-absolute"
                  alt="Right dot"
                  src="/images/blue dot.svg"
                  style={{ width: '8px', height: '8px', right: '-24px', top: '0px' }}
                />
              </div>

              {/* Solution Statement moved below features */}

                {/* Input Panel */}
                <div className="position-relative p-4" style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.98) 100%)',
                  borderRadius: '16px',
                  boxShadow: '0 10px 30px rgba(31, 89, 255, 0.08)',
                  marginTop: '8px',
                  isolation: 'isolate'
                }}>
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '16px',
                    padding: '3px',
                    background: 'linear-gradient(90deg, #627FFF 0%, #23D2EE 100%)',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    pointerEvents: 'none',
                    zIndex: -1
                  }} />
                  <h5 className="mb-3 text-start">Start by typing your keyword.</h5>

                  {/* Search/Input */}
                  <div className="mb-3">
                    <div className="input-group">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter your article keyword here"
                        style={{ height: '48px', borderColor: '#E5E7EB', borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}
                      />
                    </div>
                  </div>

                  {/* Upload Area */}
                  {/* <div className="d-flex justify-content-center align-items-center text-center px-3 px-md-4" style={{
                    border: '2px dashed #D9E2FF',
                    borderRadius: '12px',
                    background: 'rgba(244, 248, 255, 0.6)',
                    minHeight: '220px'
                  }}>
                    <div className="d-flex flex-column align-items-center gap-3 w-100" style={{ maxWidth: '189px' }}>
                      <button
                        type="button"
                        className="btn d-flex align-items-center justify-content-center gap-2"
                        style={{
                          padding: '10px 20px',
                          height: '48px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '12px',
                          background: '#FFFFFF',
                          color: '#111827',
                          boxShadow: '0 1px 0 rgba(16,24,40,0.04), 0 2px 4px rgba(16,24,40,0.06)',
                          width: '100%',
                          fontWeight: 500,
                          fontSize: '12px'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#D0D5DD')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
                      >
                        <img src="/images/subway_video-1.svg" style={{ width: '16px', height: '16px', color: '#6B7280' }} />
                        Upload a Video
                      </button>
                      <div className="text-muted fw-semibold small">OR</div>
                      <button
                        type="button"
                        className="btn d-flex align-items-center justify-content-center gap-2"
                        style={{
                          padding: '10px 20px',
                          height: '48px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '12px',
                          background: '#FFFFFF',
                          color: '#111827',
                          boxShadow: '0 1px 0 rgba(16,24,40,0.04), 0 2px 4px rgba(16,24,40,0.06)',
                          width: '100%',
                          fontWeight: 500,
                          fontSize: '12px'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#D0D5DD')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
                      >
                        <img src="/images/logos_google-meet.svg" style={{ width: '16px', height: '16px', color: '#6B7280' }} />
                        Connect a Interview
                      </button>
                    </div>
                  </div> */}

                  {/* Footer row */}
                  <div className="d-flex flex-column align-items-center justify-content-center gap-3 mt-3">
                    {/* <small className="text-muted text-center">Get 4 Free keyword base article, <a href="#" className="text-primary text-decoration-none">no credit card requires</a></small> */}
                    <Link 
                      href="/signup" 
                      className="btn btn-gradient-border text-white d-inline-flex align-items-center gap-2 fw-semibold"
                      style={{
                        width: '277px',
                        height: '56px',
                        background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                        boxShadow: '0 8px 20px rgba(191, 218, 232, 0.73), 0 4px 8px rgba(140, 222, 247, 0.15)',
                        padding: '14px 24px',
                        borderRadius: '12px',
                        border: 'none',
                        justifyContent: 'center',
                        fontSize: '16px',
                        lineHeight: '24px'
                      }}
                    >
                      <i className="bi bi-rocket-takeoff"></i>
                      Create My First Article
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/*
      {/* Trusted by logos */}
      <section className="pt-3 pb-5 bg-light">
        <div className="container text-center">
          {/* <p className="mb-5" style={{color:'#6B7280'}}>
            Trusted by <a href="#" className="text-primary fw-semibold text-decoration-none">500+ marketers & creators</a> worldwide
          </p>
          <div className="row g-4 justify-content-center align-items-center">
            {[
              { src: "/images/myob.svg", alt: "MyOB" },
              { src: "/images/lilly.svg", alt: "Lilly" },
              { src: "/images/trustly.svg", alt: "Trustly" },
              { src: "/images/citrus.svg", alt: "Citrus" },
              { src: "/images/lifegroups.svg", alt: "LifeGroups" }
            ].map((img) => (
              <div className="col-4 col-md-2 d-flex justify-content-center" key={img.alt}>
                <div className="d-flex align-items-center" style={{ height: '40px' }}>
                  <img 
                    src={img.src} 
                    alt={img.alt} 
                    className="img-fluid" 
                    style={{
                      maxWidth: '140px',
                      height: 'auto',
                      filter: 'brightness(0) invert(0.5)',
                      opacity: 0.7,
                      transition: 'opacity 0.2s ease-in-out'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                  />
                </div>
              </div>
            ))}
          </div>
      */}
      

      {/* Why Choose Us heading */}
      <section className="py-3 bg-light">
        <div className="container">
          <div className="text-center">
            <div className="d-inline-block rounded-pill mb-4" style={{
              padding: '2px',
              background: 'linear-gradient(to right, #23D2EE, #627FFF)'
            }}>
              <button 
                className="d-flex align-items-center justify-content-center bg-white border-0 rounded-pill fw-semibold"
                style={{
                  width: '133px',
                  height: '45px',
                  fontSize: '14px',
                  border: '1px',
                }}
              >
                Why Choose us
              </button>
            </div>
            <h2 className="display-5 fw-semibold mb-0">We Fix the </h2>
            <h2 className="display-5 fw-semibold">Content Bottlenecks</h2>
          </div>
        </div>
      </section>

      {/* Common Problems – top row (exact layout) */}
      <section className="py-4">
        <div className="container position-relative">
          <div className="row g-4">
            {/* Card 1 */}
            <div className="col-12 col-md-6 d-flex justify-content-center">
              <div className="border p-4 h-100" style={{ background: '#F4F4F4', borderColor: '#C2C2C2', borderWidth: '1px', borderRadius: '14px', padding: '24px', minHeight: '191px', width: '100%', maxWidth: '533px' }}>
                <div className="text-start">
                  <img src="/images/problem card 1 icon.svg" alt="Problem 1" width="50" height="50" className="mb-2 d-block" />
                  <h5 className="mb-2 fw-semibold text-dark fs-4">
                   Starting From Scratch Is Painful
                  </h5>
                  <p className="mb-0 text-muted small">No more blank pages. Enter a keyword or jump on a quick interview call — we instantly shape your ideas into a ready-to-publish draft.</p>
                </div>
              </div>
              {/* dotted connector for left card (between rows) */}
              <div className="d-none d-md-block position-relative" style={{ height: '75%', left: '-43%', position: 'relative', top: '65%', transform: 'translateY(-50%)' }}>
                <img
                  src="/images/dotted vector line.svg"
                  alt="right dotted connector"
                  style={{ position: 'absolute', top: '114%', transform: 'translateY(-50%)', height: '45px' }}
                />
              </div>
            </div>

            {/* Card 2 */}
            <div className="col-12 col-md-6 d-flex justify-content-center">
              <div className="border p-4 h-100" style={{ background: '#F4F4F4', borderColor: '#C2C2C2', borderWidth: '1px', borderRadius: '14px', padding: '24px', minHeight: '191px', width: '100%', maxWidth: '533px' }}>
                <div className="text-start">
                  <img src="/images/problem card 2 icon.svg" alt="Problem 2" width="50" height="50" className="mb-2 d-block" />
                  <h5 className="mb-2 fw-semibold text-dark fs-4">Content Never Feels “Good Enough”</h5>
                  <p className="mb-0 text-muted small">Our AIO engine adds images, links, and structured sections so your articles look professional, humanized, and citation-worthy from the start.</p>
                </div>
              </div>
              {/* dotted connector for right card (between rows) */}
              <div className="d-none d-md-block position-relative" style={{ height: '100%', left: '-43%', position: 'relative', top: '50%', transform: 'translateY(-50%)' }}>
                <img
                  src="/images/dotted vector line.svg"
                  alt="right dotted connector"
                  style={{ position: 'absolute', top: '113%', transform: 'translateY(-50%)', height: '45px' }}
                />
              </div>
            </div>
          </div>
          {/* Bottom row with tuned spacing above connectors */}
          <div className="row g-4 mt-4 mb-2">
            {/* Card 3 */}
            <div className="col-12 col-md-6 d-flex justify-content-center">
              <div className="border p-4 h-100" style={{ background: '#F4F4F4', borderColor: '#C2C2C2', borderWidth: '1px', borderRadius: '14px', padding: '24px', minHeight: '191px', width: '100%', maxWidth: '533px' }}>
                <div className="text-start">
                  <img src="/images/problem card 3 icon.svg" alt="Problem 3" width="50" height="50" className="mb-2 d-block" />
                  <h5 className="mb-2 fw-semibold text-dark fs-4">SEO Feels Like Guesswork</h5>
                  <p className="mb-0 text-muted small">Every piece is optimized with headings, stats, and AI-friendly formatting built for Google’s AI Overviews — so you actually get found and cited.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4 */}
            <div className="col-12 col-md-6 d-flex justify-content-center">
              <div className="border p-4 h-100" style={{ background: '#F4F4F4', borderColor: '#C2C2C2', borderWidth: '1px', borderRadius: '14px', padding: '24px', minHeight: '191px', width: '100%', maxWidth: '533px' }}>
                <div className="text-start">
                  <img src="/images/problem card 4 icon.svg" alt="Problem 4" width="50" height="50" className="mb-2 d-block" />
                  <h5 className="mb-2 fw-semibold text-dark fs-4">Publishing Takes Too Long</h5>
                  <p className="mb-0 text-muted small">Export directly to Google Docs, WordPress, or HTML in seconds — your content is live and driving traffic faster than ever.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

          {/* Curved connectors under bottom row (desktop only) */}
          <div className="d-none d-md-block position-relative" style={{ height: '160px', marginTop: '-8px' }}>
            {/* Left curved vector under Card 3 */}
            <img
              src="/images/Left Vector.svg"
              alt="left curved connector"
              style={{ position: 'absolute', top: '-20px', left: '33%', transform: 'translateX(-50%)', height: '140px' }}
            />
            {/* Right curved vector under Card 4 */}
            <img
              src="/images/Right Vector .svg"
              alt="right curved connector"
              style={{ position: 'absolute', top: '-20px', left: '67%', transform: 'translateX(-50%)', height: '140px' }}
            />
            {/* Center logo placeholder – replace src later */}
            <img
              src="/images/Queryfuel connector logo.svg"
              alt="center logo placeholder"
              style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translate(-50%, 20%)', width: '117px', height: '117px', zIndex: 1 }}
            />
          </div>
        </div>
      </section>

      {/* Solution Statement (Bootstrap version of snippet) */}
      <section className="bg-light py-2">
        <div className="container">
          <div className="d-flex justify-content-center align-items-center">
            <div className="rounded-pill border border-primary" style={{ width: '100%', maxWidth: '1126px', opacity: 1, top: '941px', gap: '10px', borderRadius: '140px', padding: '14px' }}>
              <p className="mb-0 text-center text-secondary" style={{ fontFamily: 'Inter', fontWeight: 500, fontStyle: 'Medium', fontSize: '24px', lineHeight: '1', letterSpacing: '0', textAlign: 'center' }}>
                Our AI automates everything — making content creation fast, simple, and stress-free.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section id="video" className="py-5">
        <div className="container position-relative">
          {/* Side gradient glows (behind content) */}
          <div className="d-none d-md-block position-absolute" aria-hidden="true"
             style={{ top: '320px', left: '-340px', width: '360px', height: '200px', background: 'linear-gradient(90deg, #23D2EE 0%, #627FFF 100%)', filter: 'blur(120px)', WebkitBackdropFilter: 'blur(120px)', backdropFilter: 'blur(120px)', borderRadius: '50%', opacity: 1, pointerEvents: 'none', zIndex: 0 }}></div>
        <div className="d-none d-md-block position-absolute" aria-hidden="true"
             style={{ top: '320px', right: '-340px', width: '360px', height: '200px', background: 'linear-gradient(90deg, #23D2EE 0%, #627FFF 100%)', filter: 'blur(120px)', WebkitBackdropFilter: 'blur(120px)', backdropFilter: 'blur(120px)', borderRadius: '50%', opacity: 1, pointerEvents: 'none', zIndex: 0 }}></div>

          <div className="position-relative" style={{ zIndex: 1 }}>
          <div className="row justify-content-center">
            <div className="col-lg-10 text-center mb-4">
              <h2 className="mb-3 fw-semibold" style={{ fontSize: '45px' }}>
                Watch a short tutorial and learn how to
                <br className="d-none d-md-block" />
                <span className="fw-bold" style={{
                  background: 'linear-gradient(90deg, #3B82F6 0%, #22D3EE 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent'
                }}>Transform your content with AI.</span>
              </h2>
            </div>
          </div>

          <div className="row justify-content-center">
            <div className="col-lg-10">
              {/* Gradient border wrapper */}
              <div className="position-relative rounded-4 p-1 w-100" style={{
                background: 'linear-gradient(135deg, #6CA4FF 0%, #4ADEDE 100%)'
              }}>
                {/* Loom video embed */}
                <div className="ratio ratio-16x9 rounded-4 bg-white position-relative w-100">
                  <iframe
                    src="https://www.loom.com/embed/86be25b1fffe40d79ba21269127362db?sid=147c36e5-2a72-4684-ba79-817b9c24a64a"
                    frameBorder="0"
                    allowFullScreen
                    className="rounded-4 w-100 h-100"
                    title="QueryFuel Demo Video"
                  ></iframe>
                </div>
              </div>
            </div>
          </div>
          
          {/* Demo Button */}
          <div className="row justify-content-center mt-4">
            <div className="col-12 text-center">
              <a 
                href="http://www.calendly.com/mikesanchez/60min"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-gradient-border text-white d-inline-flex align-items-center gap-2 fw-semibold"
                style={{
                  width: '200px',
                  height: '56px',
                  background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                  boxShadow: '0 8px 20px rgba(191, 218, 232, 0.73), 0 4px 8px rgba(140, 222, 247, 0.15)',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  justifyContent: 'center',
                  fontSize: '16px',
                  lineHeight: '24px',
                  textDecoration: 'none'
                }}
              >
                <i className="bi bi-calendar-check"></i>
                Book Demo
              </a>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      {/* <!-- 
      <section className="py-6">
        <div className="container">
          <div className="row gx-0 gx-md-2 gy-2 justify-content-center">
            <div className="col-12 col-sm-6 col-lg-auto d-flex justify-content-center px-1 px-md-2">
              <div className="border text-center d-flex flex-column align-items-center justify-content-center p-4 mx-auto"
                   style={{ background: '#F4F4F4', width: '260px', height: '127px', borderRadius: '14px', borderWidth: '2px', opacity: 1 }}>
                <div className="d-flex justify-content-center">
                  <div className="fw-bold" style={{
                    fontSize: '45px',
                    background: 'linear-gradient(90deg, #3B82F6 0%, #22D3EE 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent'
                  }}>10,000+</div>
                </div>
                <div className="text-body-secondary small mt-1 text-center" style={{ fontSize: '1.25rem' }}>Articles Generated</div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-lg-auto d-flex justify-content-center px-1 px-md-2">
              <div className="border text-center d-flex flex-column align-items-center justify-content-center p-4 mx-auto"
                   style={{ background: '#F4F4F4', width: '260px', height: '127px', borderRadius: '14px', borderWidth: '2px', opacity: 1, }}>
                <div className="fw-bold" style={{
                  fontSize: '45px',
                  background: 'linear-gradient(90deg, #3B82F6 0%, #22D3EE 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent'
                }}>95%</div>
                <div className="text-body-secondary small mt-1 text-center" style={{ fontSize: '1.25rem' }}>Average Time Saved</div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-lg-auto d-flex justify-content-center px-1 px-md-2">
              <div className="border text-center d-flex flex-column align-items-center justify-content-center p-4 mx-auto"
                   style={{ background: '#F4F4F4', width: '260px', height: '127px', borderRadius: '14px', borderWidth: '2px', opacity: 1,}}>
                <div className="fw-bold" style={{
                  fontSize: '45px',
                  background: 'linear-gradient(90deg, #3B82F6 0%, #22D3EE 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent'
                }}>4.9</div>
                <div className="text-body-secondary small mt-1 text-center" style={{ fontSize: '1.25rem' }}>Ratings</div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-lg-auto d-flex justify-content-center px-1 px-md-2">
              <div className="border text-center d-flex flex-column align-items-center justify-content-center p-4 mx-auto"
                   style={{ background: '#F4F4F4', width: '260px', height: '127px', borderRadius: '14px', borderWidth: '2px', opacity: 1, }}>
                <div className="fw-bold" style={{
                  fontSize: '45px',
                  background: 'linear-gradient(90deg, #3B82F6 0%, #22D3EE 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent'
                }}>1000+</div>
                <div className="text-body-secondary small mt-1 text-center" style={{ fontSize: '1.25rem' }}>Expert Agencies</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      --> */}

      {/* Our Pricing Packages */}
<section className="py-3 bg-light">
  <div className="container">
    <div className="row g-4 justify-content-center align-items-stretch row-cols-1 row-cols-md-2">

      {/* Card 1 - Starter (independent) */}
      <div className="col-12 col-sm-10 col-md-6 col-xl-5 d-flex">
        <div
          className="border rounded-4 h-100 w-100 mx-auto d-flex flex-column position-relative p-4"
          style={{ background: '#F4F4F4', borderColor: '#E5E7EB', minHeight: '400px', paddingBottom: '84px' }}
        >
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div className="d-flex align-items-baseline gap-1">
              <span
                className="fw-bold"
                style={{
                  fontSize: '40px',
                  background: 'linear-gradient(90deg, #627FFF 0%, #23D2EE 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                $97
              </span>
              <span className="text-muted">Month</span>
            </div>
            <span className="d-inline-flex align-items-center justify-content-center rounded-pill border border-1 border-info px-4 py-2 fw-semibold text-dark" style={{ fontSize: '12px' }}>
              Perfect for solo creators
            </span>
          </div>

          <h3 className="mb-3 fw-semibold" style={{ fontSize: '20px' }}>Starter</h3>

          <ul className="pricing-list-starter text-muted small mb-0 ps-3 mt-md-2" style={{ lineHeight: 1.6, listStyleType: 'disc' }}>
            <li className="mb-2">4 credits / month</li>
            <li className="mb-2">Keyword → blog articles (1 credit each)</li>
            <li className="mb-2">Limited to 1 interview article / month (2 credits)</li>
            <li className="mb-2">Export to Google Docs, WordPress, Shopify, Webflow</li>
            <li className="mb-2">Priority: Standard email support</li>
            <li className="mb-0">+2 free starter credits included</li>
          </ul>

          <div className="d-grid d-md-none mt-3">
            <a
              href="/pricing"
              className="btn btn-gradient-border fw-semibold text-white px-4 text-decoration-none starter-cta d-flex align-items-center justify-content-center"
              style={{
                height: '56px',
                background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                boxShadow: '0 8px 20px rgba(191, 218, 232, 0.73), 0 4px 8px rgba(140, 222, 247, 0.15)',
                borderRadius: '12px',
                border: 'none',
                textDecoration: 'none',
              }}
            >
              Start Starter →
            </a>
          </div>

          <a
            href="/pricing"
            className="d-none d-md-inline-flex btn-gradient-border fw-semibold text-white px-4 position-absolute end-0 bottom-0 me-3 mb-3 text-decoration-none starter-cta align-items-center justify-content-center"
            style={{
              height: '56px',
              background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
              boxShadow: '0 8px 20px rgba(191, 218, 232, 0.73), 0 4px 8px rgba(140, 222, 247, 0.15)',
              borderRadius: '12px',
              border: 'none',
              textDecoration: 'none',
            }}
          >
            Start Starter →
          </a>
        </div>
      </div>

      {/* Card 2 - Growth (independent) */}
      <div className="col-12 col-sm-10 col-md-6 col-xl-5 d-flex">
        <div
          className="border rounded-4 h-100 w-100 mx-auto d-flex flex-column position-relative p-4"
          style={{ background: '#F4F4F4', borderColor: '#E5E7EB', minHeight: '400px', paddingBottom: '84px' }}
        >
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div className="d-flex align-items-baseline gap-1">
              <span
                className="fw-bold"
                style={{
                  fontSize: '40px',
                  background: 'linear-gradient(90deg, #627FFF 0%, #23D2EE 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                $197
              </span>
              <span className="text-muted">Month</span>
            </div>
            <span className="d-inline-flex align-items-center justify-content-center rounded-pill border border-1 border-info px-4 py-2 fw-semibold text-dark" style={{ fontSize: '12px' }}>
              Most Popular Recomended
            </span>
          </div>

          <h3 className="mb-3 fw-semibold" style={{ fontSize: '20px' }}>Growth</h3>

          <ul className="pricing-list-growth text-muted small mb-0 ps-3" style={{ lineHeight: 1.6, listStyleType: 'disc' }}>
            <li className="mb-2">10 credits / month</li>
            <li className="mb-2">Keyword blogs (1 credit) + Interview articles (2 credits)</li>
            <li className="mb-2">Unlimited interviews (credit-based)</li>
            <li className="mb-2">Enhanced articles with stats, FAQs, comparisons</li>
            <li className="mb-2">Unlimited projects & keywords</li>
            <li className="mb-2">Priority email support</li>
            <li className="mb-2">+2 free starter credits included</li>
            <li className="mb-0">10% credit rollover month to month</li>
          </ul>

          <div className="d-grid d-md-none mt-3">
            <a
              href="/pricing"
              className="btn btn-gradient-border fw-semibold text-white px-4 text-decoration-none growth-cta d-flex align-items-center justify-content-center"
              style={{
                height: '56px',
                background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                boxShadow: '0 8px 20px rgba(191, 218, 232, 0.73), 0 4px 8px rgba(140, 222, 247, 0.15)',
                borderRadius: '12px',
                border: 'none',
                textDecoration: 'none',
              }}
            >
              Start Growth →
            </a>
          </div>

          <a
            href="/pricing"
            className="d-none d-md-inline-flex btn-gradient-border fw-semibold text-white px-4 position-absolute end-0 bottom-0 me-3 mb-3 text-decoration-none growth-cta align-items-center justify-content-center"
            style={{
              height: '56px',
              background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
              boxShadow: '0 8px 20px rgba(191, 218, 232, 0.73), 0 4px 8px rgba(140, 222, 247, 0.15)',
              borderRadius: '12px',
              border: 'none',
              textDecoration: 'none',
            }}
          >
            Start Growth →
          </a>
        </div>
      </div>

      {/* Card 3 - Scale (independent) */}
      <div className="col-12 col-sm-10 col-md-6 col-xl-5 d-flex">
        <div
          className="border rounded-4 h-100 w-100 mx-auto d-flex flex-column position-relative p-4"
          style={{ background: '#F4F4F4', borderColor: '#E5E7EB', minHeight: '400px', paddingBottom: '84px' }}
        >
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div className="d-flex align-items-baseline gap-1">
              <span
                className="fw-bold"
                style={{
                  fontSize: '40px',
                  background: 'linear-gradient(90deg, #627FFF 0%, #23D2EE 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                $497
              </span>
              <span className="text-muted">Month</span>
            </div>
            <span className="d-inline-flex align-items-center justify-content-center rounded-pill border border-1 border-info px-4 py-2 fw-semibold text-dark" style={{ fontSize: '12px' }}>
              Perfect for Businesses
            </span>
          </div>

          <h3 className="mb-3 fw-semibold" style={{ fontSize: '20px' }}>Scale</h3>

          <ul className="pricing-list-scale text-muted small mb-0 ps-3" style={{ lineHeight: 1.6, listStyleType: 'disc' }}>
            <li className="mb-2">30 credits / month</li>
            <li className="mb-2">Keyword + Enhanced + Interview articles</li>
            <li className="mb-2">Priority chat support</li>
            <li className="mb-2">+2 free starter credits included</li>
            <li className="mb-0">10% credit rollover month to month</li>
          </ul>

          <div className="d-grid d-md-none mt-3">
            <a
              href="/pricing"
              className="btn btn-gradient-border fw-semibold text-white px-4 text-decoration-none scale-cta d-flex align-items-center justify-content-center"
              style={{
                height: '56px',
                background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                boxShadow: '0 8px 20px rgba(191, 218, 232, 0.73), 0 4px 8px rgba(140, 222, 247, 0.15)',
                borderRadius: '12px',
                border: 'none',
                textDecoration: 'none',
              }}
            >
              Start Scale →
            </a>
          </div>

          <a
            href="/pricing"
            className="d-none d-md-inline-flex btn-gradient-border fw-semibold text-white px-4 position-absolute end-0 bottom-0 me-3 mb-3 text-decoration-none scale-cta align-items-center justify-content-center"
            style={{
              height: '56px',
              background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
              boxShadow: '0 8px 20px rgba(191, 218, 232, 0.73), 0 4px 8px rgba(140, 222, 247, 0.15)',
              borderRadius: '12px',
              border: 'none',
              textDecoration: 'none',
            }}
          >
            Start Scale →
          </a>
        </div>
      </div>

      {/* Card 4 - Agency – Custom (independent) */}
      <div className="col-12 col-sm-10 col-md-6 col-xl-5 d-flex">
        <div
          className="border rounded-4 h-100 w-100 mx-auto d-flex flex-column position-relative p-4"
          style={{ background: '#F4F4F4', borderColor: '#E6EEF8', minHeight: '400px', paddingBottom: '84px' }}
        >
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div className="d-flex align-items-baseline gap-1">
              <span
                className="fw-bold"
                style={{
                  fontSize: '40px',
                  background: 'linear-gradient(90deg, #627FFF 0%, #23D2EE 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                Custom<span style={{ fontSize: '4px' }}>*</span>
              </span>
              <span className="text-muted">Month</span>
            </div>
            <span className="d-inline-flex align-items-center justify-content-center rounded-pill border border-1 border-info px-4 py-2 fw-semibold text-dark" style={{ fontSize: '12px' }}>
              Perfect for Enterprises
            </span>
          </div>

          <h3 className="mb-3 fw-semibold" style={{ fontSize: '20px' }}>Agency – Custom</h3>

          <ul className="pricing-list-agency text-body-secondary small mb-0 ps-3" style={{ lineHeight: 1.6, listStyleType: 'disc' }}>
            <li className="mb-2">10+ seats</li>
            <li className="mb-2">100–500+ credits / month (volume pricing)</li>
            <li className="mb-2">White-label dashboard (full branding)</li>
            <li className="mb-0">Dedicated account manager & onboarding</li>
          </ul>

          <div className="d-grid d-md-none mt-3">
            <a
              href="https://calendly.com/mikesanchez/60min"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-gradient-border fw-semibold text-white px-4 text-decoration-none agency-cta d-flex align-items-center justify-content-center"
              style={{
                height: '56px',
                background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                boxShadow: '0 8px 20px rgba(191, 218, 232, 0.73), 0 4px 8px rgba(140, 222, 247, 0.15)',
                borderRadius: '12px',
                border: 'none',
                textDecoration: 'none',
              }}
            >
              Talk to Sales →
            </a>
          </div>

          <a
            href="https://calendly.com/mikesanchez/60min"
            target="_blank"
            rel="noopener noreferrer"
            className="d-none d-md-inline-flex btn-gradient-border fw-semibold text-white px-4 position-absolute end-0 bottom-0 me-3 mb-3 text-decoration-none agency-cta align-items-center justify-content-center"
            style={{
              height: '56px',
              background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
              boxShadow: '0 8px 20px rgba(191, 218, 232, 0.73), 0 4px 8px rgba(140, 222, 247, 0.15)',
              borderRadius: '12px',
              border: 'none',
              textDecoration: 'none',
            }}
          >
            Talk to Sales →
          </a>
        </div>
      </div>

    </div>
  </div>

  {/* Single, non-nested styled-jsx block to reserve list padding on md+ so bullets don't flow under CTAs */}
  <style jsx global>{`
    html {
      scroll-behavior: smooth;
    }
    
    .starter-cta,
    .growth-cta,
    .scale-cta,
    .agency-cta { text-decoration: none !important; }
    .starter-cta:hover, .starter-cta:focus,
    .growth-cta:hover, .growth-cta:focus,
    .scale-cta:hover, .scale-cta:focus,
    .agency-cta:hover, .agency-cta:focus { text-decoration: none !important; }

    @media (min-width: 768px) {
      .pricing-list-starter { padding-right: 220px; }
      .pricing-list-growth { padding-right: 220px; }
      .pricing-list-scale { padding-right: 220px; }
      .pricing-list-agency { padding-right: 220px; }
    }
  `}</style>
</section>

      {/* Gradient CTA Banner (per screenshot) */}
      <section className="py-5 bg-light">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-12 col-lg-10">
              <div className="text-center text-white mx-auto" style={{
                background: 'linear-gradient(90deg, #627FFF 0%, #23D2EE 100%)',
                borderRadius: '14px',
                padding: '32px 24px',
                backdropFilter: 'blur(24px)',
                width: '100%',
                maxWidth: '1140px',
                height: '355px'
              }}>
                <h2 className="fw-bold mb-3" style={{ fontSize: 'clamp(28px, 6vw, 56px)' }}>Ready to Turn Your<br/>Knowledge Into Content?<br/></h2>
                <p className="mx-auto mb-4" style={{ maxWidth: '780px' }}>
                In minutes, create professional, AIO-optimized
                  <br className="d-none d-md-block" />
                  articles — no writing required.
                </p>
                <Link href="/signup" className="btn btn-light d-inline-flex align-items-center gap-2 fw-semibold px-4 py-3 rounded-3 shadow-sm" style={{ width: '259px', height: '56px' }}>
                  🚀 Start Your First Article
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-5 bg-light">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-12 d-flex justify-content-center">
              <img
                src="/images/queryfuel end section logo.svg"
                alt="Your brand logo"
                className="img-fluid"
                style={{ maxHeight: '58px', height: 'auto' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-light">
        <div className="container py-4">
          <hr className="mt-0 mb-4 border-0 border-top border-secondary-subtle opacity-75" />

          {/* Top row: contact + socials */}
          <div className="d-flex justify-content-center">
            <div className="d-flex align-items-center gap-2">
              <a href="#" className="btn text-primary d-inline-flex align-items-center justify-content-center p-0" style={{ width: '34px', height: '34px' }}>
                <img src="/images/facebook link.svg" alt="Facebook icon" className="img-fluid" style={{borderRadius: '0'}} />
              </a>
              <a href="#" className="btn text-primary d-inline-flex align-items-center justify-content-center p-0" style={{ width: '34px', height: '34px' }}>
                <img src="/images/twitter link.svg" alt="Twitter icon" className="img-fluid" style={{borderRadius: '0'}} />
              </a>
              <a href="#" className="btn text-primary d-inline-flex align-items-center justify-content-center p-0" style={{ width: '34px', height: '34px' }}>
                <img src="/images/linkedin link.svg" alt="LinkedIn icon" className="img-fluid" style={{borderRadius: '0'}} />
              </a>
              <a href="#" className="btn text-primary d-inline-flex align-items-center justify-content-center p-0" style={{ width: '34px', height: '34px' }}>
                <img src="/images/Instagram link.svg" alt="Instagram icon" className="img-fluid" style={{borderRadius: '0'}} />
              </a>
            </div>
          </div>

          {/* Bottom row: copyright + links */}
          <div className="d-flex flex-column justify-content-center align-items-center mt-4">
            <div className="d-flex align-items-center justify-content-center gap-3">
              <a href="#" className="text-secondary small text-decoration-underline">Privacy Policy</a>
              <a href="#" className="text-secondary small text-decoration-underline">Terms & Conditions</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
    </>
  );
}