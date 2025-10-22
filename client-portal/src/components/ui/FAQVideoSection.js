'use client';

import { useState } from 'react';
import { ENV } from '../../config/environment';

const FAQVideoSection = ({ 
  faq, 
  faqId, 
  articleId, 
  source, 
  keywordId, 
  user, 
  onVideoGenerated,
  existingVideo = null 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [error, setError] = useState(null);
  const [videoData, setVideoData] = useState(existingVideo);
  const [duration, setDuration] = useState(20); // Default 20 seconds
  const [showSettings, setShowSettings] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [generationStartTime, setGenerationStartTime] = useState(null);
  
  // Free tier: max 30 seconds
  const MAX_DURATION_FREE = 30;
  
  // Average generation time: 60-90 seconds
  const ESTIMATED_GENERATION_TIME = 75;
  
  // Estimate: ~150 words per minute = 2.5 words per second
  const getMaxCharactersForDuration = (seconds) => {
    const wordsPerSecond = 2.5;
    const avgCharsPerWord = 5;
    return Math.floor(seconds * wordsPerSecond * avgCharsPerWord);
  };

  // Generate video for this FAQ
  const handleGenerateVideo = async () => {
    console.log('🎬 Generate video button clicked for FAQ:', faqId);
    
    if (!user) {
      setError('Please log in to generate videos');
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    console.log('📝 Sending video generation request with duration:', duration);
    
    // Truncate script to fit duration (answer only)
    const maxChars = getMaxCharactersForDuration(duration);
    const fullAnswer = (faq.answer_md || faq.answer || '').trim();
    if (!fullAnswer) {
      setError('This FAQ has no answer to generate a video from.');
      setIsGenerating(false);
      return;
    }
    const truncatedAnswer = fullAnswer.length > maxChars 
      ? fullAnswer.substring(0, maxChars) + '...'
      : fullAnswer;
    
    console.log('📊 Script stats:', {
      originalLength: fullAnswer.length,
      maxChars,
      truncatedLength: truncatedAnswer.length,
      targetDuration: duration
    });

    try {
      const token = await user.getIdToken();

      const response = await fetch(`${ENV.API.baseUrl}/heygen/generate-faq-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          articleId,
          faqId,
          faqContent: {
            answer: truncatedAnswer,
            takeaway: faq.takeaway || ''
          },
          source,
          keywordId,
          options: {
            emotion: 'Friendly',
            background: '#FAFAFA',
            targetDuration: duration
          }
        })
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate video';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorData.message || errorMessage;
          console.error('❌ Video generation error:', errorData);
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Video generation response:', result);

      // Update local state with correct fields from backend
      const newVideoData = {
        heygenVideoId: result.data.heygenVideoId, // Use heygenVideoId, not videoId (which is faqId)
        status: result.data.status || 'processing', // Use backend status
        generatedAt: new Date().toISOString()
      };

      setVideoData(newVideoData);
      console.log('📊 Updated video data:', newVideoData);
      
      // Notify parent component
      if (onVideoGenerated) {
        onVideoGenerated(faqId, newVideoData);
      }

      // Start polling for status and elapsed time tracking
      setGenerationStartTime(Date.now());
      pollVideoStatus(result.data.videoId);

    } catch (error) {
      console.error('Video generation error:', error);
      setError(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Poll video status until completion
  const pollVideoStatus = async (videoId) => {
    setIsCheckingStatus(true);
    setElapsedTime(0);
    
    // Start elapsed time counter
    const timerInterval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    const checkStatus = async () => {
      try {
        const token = await user.getIdToken();
        
        const response = await fetch(`${ENV.API.baseUrl}/heygen/update-video-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            articleId,
            faqId,
            videoId,
            source,
            keywordId
          })
        });

        if (!response.ok) {
          throw new Error('Failed to check video status');
        }

        const result = await response.json();
        const status = result.data.status;
        
        console.log('📊 Video status:', status, status === 'completed' ? '✅' : '⏳');

        // Update local state
        const updatedVideoData = {
          ...videoData,
          status: status,
          videoUrl: result.data.videoUrl,
          thumbnailUrl: result.data.thumbnailUrl,
          duration: result.data.duration,
          error: result.data.error
        };

        setVideoData(updatedVideoData);

        if (status === 'completed') {
          clearInterval(timerInterval);
          setIsCheckingStatus(false);
          setElapsedTime(0);
          if (onVideoGenerated) {
            onVideoGenerated(faqId, updatedVideoData);
          }
        } else if (status === 'failed') {
          clearInterval(timerInterval);
          setIsCheckingStatus(false);
          setElapsedTime(0);
          // Extract error message from HeyGen error object
          const errorMessage = result.data.error?.message || result.data.error?.detail || 'Video generation failed';
          setError(errorMessage);
          // Reset videoData so user can try again with adjusted settings
          setVideoData(null);
        } else {
          // Continue polling
          setTimeout(checkStatus, 5000); // Check every 5 seconds
        }

      } catch (error) {
        console.error('Status check error:', error);
        clearInterval(timerInterval);
        setIsCheckingStatus(false);
        setElapsedTime(0);
        setError('Failed to check video status');
      }
    };

    checkStatus();
  };

  // Render video player
  const renderVideoPlayer = () => {
    if (!videoData?.videoUrl) return null;

    return (
      <div style={{
        marginTop: '1rem',
        padding: '1rem',
        background: 'rgba(0, 0, 0, 0.02)',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '8px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span style={{
            fontSize: '0.9rem',
            fontWeight: '600',
            color: '#00D4FF'
          }}>
            AI Generated Video
          </span>
        </div>
        
        <video
          controls
          style={{
            width: '100%',
            maxWidth: '600px',
            height: 'auto',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
          poster={videoData.thumbnailUrl}
        >
          <source src={videoData.videoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        
        {videoData.duration && (
          <div style={{
            fontSize: '0.8rem',
            color: '#666',
            marginTop: '0.5rem'
          }}>
            Duration: {Math.round(videoData.duration)}s
          </div>
        )}
      </div>
    );
  };

  // Render generation status
  const renderGenerationStatus = () => {
    if (isGenerating) {
      return (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: 'rgba(0, 212, 255, 0.05)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid rgba(0, 212, 255, 0.3)',
            borderTop: '2px solid #00D4FF',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <div>
            <div style={{ fontWeight: '600', color: '#00D4FF', fontSize: '0.9rem' }}>
              Generating Video...
            </div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>
              This may take 1-2 minutes
            </div>
          </div>
        </div>
      );
    }

    // Show processing spinner for any in-progress status
    const inProgressStatuses = ['generating', 'processing', 'pending'];
    if (isCheckingStatus && videoData?.status && inProgressStatuses.includes(videoData.status)) {
      // Calculate simulated progress (0-95%, never shows 100% until actually complete)
      const simulatedProgress = Math.min(95, Math.floor((elapsedTime / ESTIMATED_GENERATION_TIME) * 100));
      const remainingTime = Math.max(0, ESTIMATED_GENERATION_TIME - elapsedTime);
      
      return (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: 'rgba(255, 193, 7, 0.05)',
          border: '1px solid rgba(255, 193, 7, 0.2)',
          borderRadius: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid rgba(255, 193, 7, 0.3)',
              borderTop: '2px solid #FFC107',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', color: '#FFC107', fontSize: '0.9rem' }}>
                {videoData.status === 'pending' ? 'In Queue...' : 'Processing Video...'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                {videoData.status === 'pending' 
                  ? `⏱️ Waiting in queue... ${elapsedTime}s`
                  : `⏱️ ${Math.floor(elapsedTime / 60)}:${(elapsedTime % 60).toString().padStart(2, '0')} elapsed${remainingTime > 0 ? ` • ~${Math.floor(remainingTime)}s remaining` : ' • finishing up...'}`}
              </div>
            </div>
          </div>
          
          {/* Simulated progress bar */}
          <div style={{
            width: '100%',
            height: '6px',
            background: 'rgba(255, 193, 7, 0.1)',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${simulatedProgress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #FFC107, #FF9800)',
              borderRadius: '3px',
              transition: 'width 1s ease-out'
            }} />
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.5rem',
            fontSize: '0.7rem',
            color: '#999'
          }}>
            <span>ℹ️ Progress is estimated</span>
            <span style={{ fontWeight: '600', color: '#FFC107' }}>{simulatedProgress}%</span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Duration Settings (only show when not generating/processing and no video exists) */}
      {!videoData && !isGenerating && !isCheckingStatus && (
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          background: 'rgba(240, 147, 251, 0.05)',
          border: '1px solid rgba(240, 147, 251, 0.2)',
          borderRadius: '8px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem'
          }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#333' }}>
                Video Duration: {duration} seconds
              </div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                🆓 Free tier: max {MAX_DURATION_FREE} seconds
              </div>
            </div>
          </div>
          
          <input
            type="range"
            min="5"
            max={MAX_DURATION_FREE}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              background: `linear-gradient(to right, #f093fb 0%, #f5576c ${(duration / MAX_DURATION_FREE) * 100}%, #ddd ${(duration / MAX_DURATION_FREE) * 100}%, #ddd 100%)`,
              outline: 'none',
              cursor: 'pointer'
            }}
          />
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '0.5rem',
            fontSize: '0.7rem',
            color: '#999'
          }}>
            <span>5s</span>
            <span>{MAX_DURATION_FREE}s</span>
          </div>
          
          <div style={{
            marginTop: '0.75rem',
            padding: '0.5rem',
            background: 'rgba(255, 193, 7, 0.1)',
            borderLeft: '3px solid #FFC107',
            fontSize: '0.75rem',
            color: '#666',
            borderRadius: '4px'
          }}>
            ℹ️ Script will be automatically truncated to fit ~{Math.floor(duration * 2.5)} words ({duration}s at 150 wpm)
          </div>
        </div>
      )}
      
      {/* Generate Video Button - hide while generating or checking status */}
      {!videoData && !isCheckingStatus && (
        <button
          onClick={handleGenerateVideo}
          disabled={isGenerating}
          style={{
            padding: '0.5rem 1rem',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s',
            opacity: isGenerating ? 0.7 : 1,
            boxShadow: '0 2px 8px rgba(240, 147, 251, 0.3)'
          }}
          onMouseEnter={(e) => !isGenerating && (e.target.style.transform = 'translateY(-1px)')}
          onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          {isGenerating ? 'Generating...' : 'Generate Video'}
        </button>
      )}

      {/* Regenerate Button for existing videos */}
      {videoData && videoData.status === 'completed' && (
        <button
          onClick={handleGenerateVideo}
          disabled={isGenerating}
          style={{
            padding: '0.4rem 0.8rem',
            background: 'transparent',
            color: '#f5576c',
            border: '1px solid rgba(245, 87, 108, 0.3)',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: '600',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.2s',
            opacity: isGenerating ? 0.7 : 1
          }}
          onMouseEnter={(e) => !isGenerating && (e.target.style.background = 'rgba(245, 87, 108, 0.1)')}
          onMouseLeave={(e) => (e.target.style.background = 'transparent')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
          Regenerate
        </button>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '6px',
          color: '#dc2626',
          fontSize: '0.85rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
          
          {/* Show retry suggestion if video was too long */}
          {error.includes('too long') && error.includes('30') && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.5rem',
              background: 'rgba(255, 193, 7, 0.2)',
              borderRadius: '4px',
              fontSize: '0.75rem',
              color: '#856404'
            }}>
              💡 Try reducing the duration slider to 15-20 seconds and generate again
            </div>
          )}
        </div>
      )}

      {/* Generation Status */}
      {renderGenerationStatus()}

      {/* Video Player */}
      {renderVideoPlayer()}

      {/* Add CSS for spin animation and slider styling */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(240, 147, 251, 0.4);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(240, 147, 251, 0.4);
        }
      `}</style>
    </div>
  );
};

export default FAQVideoSection;