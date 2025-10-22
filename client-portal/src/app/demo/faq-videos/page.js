'use client';

import { useState } from 'react';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import ArticleWithVideoFAQs from '../../../components/ui/ArticleWithVideoFAQs';

// Sample article data for demo
const sampleArticleData = {
  id: 'demo-article-123',
  title: 'Understanding Artificial Intelligence: A Complete Guide',
  jsonContent: {
    title: 'Understanding Artificial Intelligence: A Complete Guide',
    faqs: [
      {
        id: 'faq-1',
        question: 'What is Artificial Intelligence?',
        answer: 'Artificial Intelligence (AI) is a branch of computer science that aims to create intelligent machines that can perform tasks that typically require human intelligence.',
        answer_md: '<p>Artificial Intelligence (AI) is a branch of computer science that aims to create intelligent machines that can perform tasks that typically require human intelligence. These tasks include learning, reasoning, problem-solving, perception, and language understanding.</p>',
        takeaway: 'AI simulates human intelligence to automate complex tasks and decision-making processes.'
      },
      {
        id: 'faq-2',
        question: 'How does Machine Learning work?',
        answer: 'Machine Learning is a subset of AI that enables computers to learn and improve from experience without being explicitly programmed.',
        answer_md: '<p>Machine Learning is a subset of AI that enables computers to learn and improve from experience without being explicitly programmed. It uses algorithms to analyze data, identify patterns, and make predictions or decisions.</p>',
        takeaway: 'Machine Learning allows systems to automatically improve performance through data analysis and pattern recognition.'
      },
      {
        id: 'faq-3',
        question: 'What are the main types of AI?',
        answer: 'The main types of AI include Narrow AI (designed for specific tasks), General AI (human-level intelligence), and Superintelligence (exceeding human capabilities).',
        answer_md: '<p>The main types of AI include:</p><ul><li><strong>Narrow AI</strong> - Designed for specific tasks like image recognition or language translation</li><li><strong>General AI</strong> - Human-level intelligence across all domains</li><li><strong>Superintelligence</strong> - AI that exceeds human capabilities in all areas</li></ul>',
        takeaway: 'AI ranges from task-specific narrow AI (current technology) to theoretical general AI and superintelligence.'
      }
    ]
  },
  videos: {
    // This would be populated as videos are generated
  }
};

export default function FAQVideosDemo() {
  const { user, loading } = useAuthGuard({ redirectTo: '/login', requireAuth: true });
  const [articleData, setArticleData] = useState(sampleArticleData);

  const handleArticleUpdate = (updatedArticleData) => {
    setArticleData(updatedArticleData);
    console.log('Article updated with new video data:', updatedArticleData);
  };

  if (loading) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(0, 212, 255, 0.3)',
            borderTop: '3px solid #00D4FF',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p>Loading...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      padding: '2rem 0'
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '800px',
        margin: '0 auto 2rem',
        textAlign: 'center',
        padding: '0 2rem'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '1rem',
          background: 'linear-gradient(135deg, #00D4FF 0%, #f5576c 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          FAQ Video Generation Demo
        </h1>
        <p style={{
          fontSize: '1.1rem',
          color: '#64748b',
          maxWidth: '600px',
          margin: '0 auto',
          lineHeight: '1.6'
        }}>
          Generate AI-powered videos for any FAQ in your articles using HeyGen's advanced avatar technology.
        </p>
      </div>

      {/* Demo Notice */}
      <div style={{
        maxWidth: '800px',
        margin: '0 auto 2rem',
        padding: '1rem 2rem'
      }}>
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4"/>
            <path d="M12 8h.01"/>
          </svg>
          <div>
            <div style={{
              fontWeight: '600',
              color: '#3b82f6',
              fontSize: '0.9rem',
              marginBottom: '0.25rem'
            }}>
              Demo Mode
            </div>
            <div style={{
              fontSize: '0.85rem',
              color: '#64748b',
              lineHeight: '1.4'
            }}>
              This is a demonstration using sample FAQ data. In the real application, this would be integrated into your article view page.
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <ArticleWithVideoFAQs
        articleData={articleData}
        articleId="demo-article-123"
        source="demo"
        keywordId="artificial-intelligence"
        user={user}
        onArticleUpdate={handleArticleUpdate}
      />

      {/* Footer */}
      <div style={{
        maxWidth: '800px',
        margin: '3rem auto 0',
        padding: '0 2rem',
        textAlign: 'center'
      }}>
        <div style={{
          padding: '2rem',
          background: 'rgba(0, 0, 0, 0.02)',
          borderRadius: '12px',
          border: '1px solid rgba(0, 0, 0, 0.05)'
        }}>
          <h3 style={{
            fontSize: '1.2rem',
            fontWeight: '600',
            color: '#1e293b',
            marginBottom: '1rem'
          }}>
            How to Integrate
          </h3>
          <div style={{
            textAlign: 'left',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            <p style={{
              fontSize: '0.9rem',
              color: '#64748b',
              lineHeight: '1.6',
              marginBottom: '1rem'
            }}>
              To add video generation to your existing article view:
            </p>
            <ol style={{
              fontSize: '0.9rem',
              color: '#64748b',
              lineHeight: '1.6',
              paddingLeft: '1.5rem'
            }}>
              <li style={{ marginBottom: '0.5rem' }}>
                Import the <code style={{ background: '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>FAQVideoSection</code> component
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                Add it beneath each FAQ in your article rendering
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                Pass the required props: faq data, article ID, user, etc.
              </li>
              <li>
                The component handles video generation, status polling, and display automatically
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}