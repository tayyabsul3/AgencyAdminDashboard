'use client';

import { useState, useEffect } from 'react';
import FAQVideoSection from './FAQVideoSection';

const ArticleWithVideoFAQs = ({ 
  articleData, 
  articleId, 
  source, 
  keywordId, 
  user, 
  onArticleUpdate 
}) => {
  const [videos, setVideos] = useState(articleData?.videos || {});

  // Handle video generation completion
  const handleVideoGenerated = (faqId, videoData) => {
    const updatedVideos = {
      ...videos,
      [faqId]: videoData
    };
    setVideos(updatedVideos);
    
    // Notify parent component if needed
    if (onArticleUpdate) {
      onArticleUpdate({
        ...articleData,
        videos: updatedVideos
      });
    }
  };

  // Extract FAQs from article content
  const extractFAQsFromContent = () => {
    if (articleData?.jsonContent?.faqs) {
      return articleData.jsonContent.faqs.map((faq, index) => ({
        ...faq,
        id: faq.id || `faq-${index + 1}`
      }));
    }
    return [];
  };

  const faqs = extractFAQsFromContent();

  if (!faqs.length) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#666',
        background: 'rgba(0, 0, 0, 0.02)',
        borderRadius: '8px',
        border: '1px solid rgba(0, 0, 0, 0.1)'
      }}>
        <p>No FAQs found in this article.</p>
        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
          FAQs are required to generate videos.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{
        marginBottom: '2rem',
        textAlign: 'center'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          color: '#333',
          marginBottom: '0.5rem'
        }}>
          Frequently Asked Questions
        </h2>
        <p style={{
          color: '#666',
          fontSize: '0.9rem'
        }}>
          Generate AI videos for any FAQ to make your content more engaging
        </p>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem'
      }}>
        {faqs.map((faq, index) => {
          const faqId = faq.id || `faq-${index + 1}`;
          const existingVideo = videos[faqId];

          return (
            <div
              key={faqId}
              style={{
                padding: '1.5rem',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(0, 0, 0, 0.05)'
              }}
            >
              {/* FAQ Question */}
              <h3 style={{
                fontSize: '1.2rem',
                fontWeight: '600',
                color: '#333',
                marginBottom: '1rem',
                lineHeight: '1.4'
              }}>
                {faq.question}
              </h3>

              {/* FAQ Answer */}
              <div style={{
                fontSize: '1rem',
                lineHeight: '1.6',
                color: '#555',
                marginBottom: '1rem'
              }}>
                {/* Render markdown or HTML content */}
                {faq.answer_md ? (
                  <div dangerouslySetInnerHTML={{ __html: faq.answer_md }} />
                ) : (
                  <p>{faq.answer}</p>
                )}
              </div>

              {/* Takeaway */}
              {faq.takeaway && (
                <div style={{
                  padding: '1rem',
                  background: 'rgba(0, 212, 255, 0.05)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  borderRadius: '8px',
                  marginBottom: '1rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.5rem'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2">
                      <path d="M9 11l3 3L22 4"/>
                      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                    </svg>
                    <span style={{
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#00D4FF'
                    }}>
                      Key Takeaway
                    </span>
                  </div>
                  <p style={{
                    fontSize: '0.9rem',
                    color: '#333',
                    margin: 0,
                    lineHeight: '1.5'
                  }}>
                    {faq.takeaway}
                  </p>
                </div>
              )}

              {/* Video Section */}
              <FAQVideoSection
                faq={faq}
                faqId={faqId}
                articleId={articleId}
                source={source}
                keywordId={keywordId}
                user={user}
                onVideoGenerated={handleVideoGenerated}
                existingVideo={existingVideo}
              />

              {/* Back to Table of Contents Link */}
              <div style={{
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid rgba(0, 0, 0, 0.1)'
              }}>
                <a
                  href="#table-of-contents"
                  style={{
                    fontSize: '0.85rem',
                    color: '#00D4FF',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                  onMouseEnter={(e) => (e.target.style.textDecoration = 'underline')}
                  onMouseLeave={(e) => (e.target.style.textDecoration = 'none')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                  Back to Table of Contents
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div style={{
        marginTop: '3rem',
        padding: '1.5rem',
        background: 'rgba(34, 197, 94, 0.05)',
        border: '1px solid rgba(34, 197, 94, 0.2)',
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <h3 style={{
          fontSize: '1.1rem',
          fontWeight: '600',
          color: '#16a34a',
          marginBottom: '0.5rem'
        }}>
          Video Generation Summary
        </h3>
        <p style={{
          fontSize: '0.9rem',
          color: '#555',
          margin: 0
        }}>
          {Object.keys(videos).length} of {faqs.length} FAQs have generated videos
        </p>
      </div>
    </div>
  );
};

export default ArticleWithVideoFAQs;