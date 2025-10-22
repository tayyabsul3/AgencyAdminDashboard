'use client';

import { useEffect, useMemo, useState, useCallback, useRef, Suspense, useReducer } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import { useSubscription } from '../../../../hooks/useSubscription';
import { useWordPressConnections } from '../../../../hooks/useWordPressConnections';
import { getUnifiedArticleContent, updateArticle } from '../../../../services/articleService';
import { getUserProfile } from '../../../../services/userService';
import { getCurrentArticleContent, getArticleVersionHistory, smartRestoreVersion } from '../../../../services/articleVersionService';
import { convertJsonToGutenbergHtml, getDefaultSectionOrder } from '../../../../utils/articleConverter';
import { deductCreditsAtomic, refundCredits, validateCredits } from '../../../../services/creditService';
import { shouldShowBranding, generateBrandingHtml, appendBrandingToContent, getBrandingPreview, formatBrandVoiceForDisplay } from '../../../../utils/branding';
import BrandVoicePreview from '../../../../components/ui/BrandVoicePreview';
import { WordPressConnectionService } from '../../../../services/wordpressConnectionService';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import styles from '../../create/interview/generate/ArticleGeneration.module.css';
import './modal-animations.css';
import { ENV } from '../../../../config/environment';
import FAQVideoSection from '../../../../components/ui/FAQVideoSection';
import InsertSectionImagesModal from './components/modals/InsertSectionImagesModal';
import { getCachedVideo, preloadVideo } from '../../../../utils/videoCache';

// Helper function to calculate relative time
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return interval + ' years ago';
  if (interval === 1) return '1 year ago';

  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return interval + ' months ago';
  if (interval === 1) return '1 month ago';

  interval = Math.floor(seconds / 86400);
  if (interval > 1) return interval + ' days ago';
  if (interval === 1) return '1 day ago';

  interval = Math.floor(seconds / 3600);
  if (interval > 1) return interval + ' hours ago';
  if (interval === 1) return '1 hour ago';

  interval = Math.floor(seconds / 60);
  if (interval > 1) return interval + ' minutes ago';
  if (interval === 1) return '1 minute ago';

  return 'just now';
}

const formatBioHtml = (text) => {
  if (!text) {
    return '';
  }
  return text.includes('<') ? text : text.replace(/\n/g, '<br />');
};

// Unified Versioning State Management
const VERSIONING_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_VERSIONS: 'SET_VERSIONS',
  SET_CURRENT_VERSION: 'SET_CURRENT_VERSION',
  SET_RESTORED_INFO: 'SET_RESTORED_INFO',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SHOW_MODAL: 'SHOW_MODAL',
  HIDE_MODAL: 'HIDE_MODAL',
  RESET_STATE: 'RESET_STATE'
};

const initialVersioningState = {
  showVersionModal: false,
  versions: [],
  currentVersion: null,
  loadingVersions: false,
  restoredInfo: null,
  error: null
};

function versioningReducer(state, action) {
  switch (action.type) {
    case VERSIONING_ACTIONS.SET_LOADING:
      return {
        ...state,
        loadingVersions: action.payload,
        error: null // Clear error when starting new operation
      };

    case VERSIONING_ACTIONS.SET_VERSIONS:
      return {
        ...state,
        versions: action.payload,
        loadingVersions: false,
        error: null
      };

    case VERSIONING_ACTIONS.SET_CURRENT_VERSION:
      return {
        ...state,
        currentVersion: action.payload
      };

    case VERSIONING_ACTIONS.SET_RESTORED_INFO:
      return {
        ...state,
        restoredInfo: action.payload
      };

    case VERSIONING_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loadingVersions: false
      };

    case VERSIONING_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    case VERSIONING_ACTIONS.SHOW_MODAL:
      return {
        ...state,
        showVersionModal: true
      };

    case VERSIONING_ACTIONS.HIDE_MODAL:
      return {
        ...state,
        showVersionModal: false,
        error: null // Clear error when closing modal
      };

    case VERSIONING_ACTIONS.RESET_STATE:
      return initialVersioningState;

    default:
      return state || initialVersioningState;
  }
}

// Custom hook for unified versioning state management
function useVersioningState() {
  const [state, dispatch] = useReducer(versioningReducer, initialVersioningState);

  const actions = {
    setLoading: (loading) => dispatch({ type: VERSIONING_ACTIONS.SET_LOADING, payload: loading }),
    setVersions: (versions) => dispatch({ type: VERSIONING_ACTIONS.SET_VERSIONS, payload: versions }),
    setCurrentVersion: (version) => dispatch({ type: VERSIONING_ACTIONS.SET_CURRENT_VERSION, payload: version }),
    setRestoredInfo: (info) => dispatch({ type: VERSIONING_ACTIONS.SET_RESTORED_INFO, payload: info }),
    setError: (error) => dispatch({ type: VERSIONING_ACTIONS.SET_ERROR, payload: error }),
    clearError: () => dispatch({ type: VERSIONING_ACTIONS.CLEAR_ERROR }),
    showModal: () => dispatch({ type: VERSIONING_ACTIONS.SHOW_MODAL }),
    hideModal: () => dispatch({ type: VERSIONING_ACTIONS.HIDE_MODAL }),
    resetState: () => dispatch({ type: VERSIONING_ACTIONS.RESET_STATE })
  };

  return { state, actions };
}

function ArticleViewContent() {
  const { user, loading } = useAuthGuard({ redirectTo: '/login', requireAuth: true });
  const { credits: fullCreditsInfo, tier, refetch: refetchSubscription } = useSubscription(user?.uid);
  
  // Extract credit values from the new credits info structure
  const credits = fullCreditsInfo?.total || 0;
  const creditsUsed = fullCreditsInfo?.used || 0;
  const creditsRemaining = fullCreditsInfo?.remaining || 0;
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const source = searchParams.get('source') || 'legacy';
  const keywordId = searchParams.get('keywordId') || undefined;

  const [html, setHtml] = useState('');
  const [title, setTitle] = useState('Article');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState('');
  const [successUrl, setSuccessUrl] = useState(null);
  const [articleData, setArticleData] = useState(null);
  const [authorProfile, setAuthorProfile] = useState({
    name: '',
    body: '',
    image: ''
  });
  // WordPress Modal State
  const [showWpModal, setShowWpModal] = useState(false);
  const [wpUrl, setWpUrl] = useState('');
  const [wpUser, setWpUser] = useState('');
  const [wpPass, setWpPass] = useState('');
  const [wpError, setWpError] = useState(''); // Separate error state for WordPress upload
  const [isUploading, setIsUploading] = useState(false);
  const [showWpCreditConfirmation, setShowWpCreditConfirmation] = useState(false); // Credit confirmation for WordPress
  
  // WordPress Categories State
  const [wpCategories, setWpCategories] = useState([{ id: 1, name: 'Uncategorized' }]);
  const [selectedCategory, setSelectedCategory] = useState(1);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [categoryError, setCategoryError] = useState(null);

  // WordPress Connection Persist State
  const {
    connections: savedConnections,
    loading: connectionsLoading,
    saveConnection,
    loadConnection,
    updateLastUsed,
    isConnectionSaved
  } = useWordPressConnections();

  const [showSaveConnectionModal, setShowSaveConnectionModal] = useState(false);
  const [connectionName, setConnectionName] = useState('');
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [showWpPassword, setShowWpPassword] = useState(false);

  // Brand Voice State
  const [showBrandVoiceInfo, setShowBrandVoiceInfo] = useState(false);
  const [brandVoiceData, setBrandVoiceData] = useState(null);

  // Shopify Modal State
  const [showShopifyModal, setShowShopifyModal] = useState(false);
  const [showShopifyCreditConfirmation, setShowShopifyCreditConfirmation] = useState(false); // Credit confirmation for Shopify
  const [shopifyUrl, setShopifyUrl] = useState('');
  const [shopifyApiKey, setShopifyApiKey] = useState('');
  const [shopifyApiSecret, setShopifyApiSecret] = useState('');
  const [shopifyError, setShopifyError] = useState(''); // Separate error state for Shopify upload
  const [isShopifyUploading, setIsShopifyUploading] = useState(false);

  // Webflow Modal State
  const [showWebflowModal, setShowWebflowModal] = useState(false);
  const [showWebflowCreditConfirmation, setShowWebflowCreditConfirmation] = useState(false); // Credit confirmation for Webflow
  const [webflowApiToken, setWebflowApiToken] = useState('');
  const [webflowSiteId, setWebflowSiteId] = useState('');
  const [webflowCollectionId, setWebflowCollectionId] = useState('');
  const [webflowSites, setWebflowSites] = useState([]);
  const [webflowCollections, setWebflowCollections] = useState([]);
  const [webflowError, setWebflowError] = useState(''); // Separate error state for Webflow upload
  const [isWebflowUploading, setIsWebflowUploading] = useState(false);
  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  // Unified versioning state management
  const { state: versioningState, actions: versioningActions } = useVersioningState();
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);
  const [imageGenerationStatus, setImageGenerationStatus] = useState('');
  const [imageGenerationProgress, setImageGenerationProgress] = useState(0);
  const [showImageGenerationModal, setShowImageGenerationModal] = useState(false);
  const [imageGenerationError, setImageGenerationError] = useState(null);
  const [isConvertingToDocs, setIsConvertingToDocs] = useState(false);
  const [googleDocUrl, setGoogleDocUrl] = useState(null);
  const [showGoogleDocsModal, setShowGoogleDocsModal] = useState(false);
  const [showGoogleDocsCreditConfirmation, setShowGoogleDocsCreditConfirmation] = useState(false);
  const [googleDocsData, setGoogleDocsData] = useState(null);
  const [googleDocsError, setGoogleDocsError] = useState(null);
  const [showCreditErrorModal, setShowCreditErrorModal] = useState(false);
  const [creditErrorMessage, setCreditErrorMessage] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [networkRetryCount, setNetworkRetryCount] = useState(0);
  // Auto-generation state
  const [autoGenerationAttempted, setAutoGenerationAttempted] = useState(false);
  const [autoGenerationEnabled, setAutoGenerationEnabled] = useState(true);
  
  // Branding state
  const [brandingPreview, setBrandingPreview] = useState(null);
  const [userBrandingSettings, setUserBrandingSettings] = useState({ showBranding: null });
  const [savingBrandingSettings, setSavingBrandingSettings] = useState(false);
  
  // FAQ Video Generation state
  const [faqVideos, setFaqVideos] = useState({});
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedFaqForVideo, setSelectedFaqForVideo] = useState(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenerationProgress, setVideoGenerationProgress] = useState(0);
  const [videoGenerationStatus, setVideoGenerationStatus] = useState('');
  const [videoDuration, setVideoDuration] = useState(20); // Default 20 seconds
  
  // Enhanced video options state
  const [availableAvatars, setAvailableAvatars] = useState([]);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [loadingAvatars, setLoadingAvatars] = useState(false);
  const [loadingVoices, setLoadingVoices] = useState(false);
  // Toast notification for video generation
  const [showVideoToast, setShowVideoToast] = useState(false);
  const [videoToastMessage, setVideoToastMessage] = useState('');
  
  // Video generation status tracking
  const [videoModalTab, setVideoModalTab] = useState('generate'); // 'generate' or 'status'
  const [activeVideoGenerations, setActiveVideoGenerations] = useState([]); // Array of {faqId, faqQuestion, progress, status, startTime}
  const videoGenerationsInitialized = useRef(false); // Track if we've initialized
  const lastLocalStorageSave = useRef(Date.now());
  
  // Memoize processing count to avoid recalculation in dependencies
  const processingVideoCount = useMemo(() => 
    activeVideoGenerations.filter(g => g.status === 'processing').length,
    [activeVideoGenerations]
  );
  
  const [videoOptions, setVideoOptions] = useState({
    avatarId: 'Daisy-inskirt-20220818', // Default avatar
    voiceId: '1bd001e7e50f421d891986aad5158bc8', // Default voice
    quality: 'SD',
    speed: 1.0,
    pitch: 0,
    emotion: 'Friendly',
    caption: false,
    avatarStyle: 'normal',
    // Background: automatic realistic selection by default
    backgroundMode: 'automatic', // 'automatic' or 'manual'
    backgroundCategory: null, // null = all categories
    backgroundUrl: null // custom URL override
  });
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [availableBackgrounds, setAvailableBackgrounds] = useState([]);
  const [loadingBackgrounds, setLoadingBackgrounds] = useState(false);
  const avatarsFetchAttemptedRef = useRef(false);
  const voicesFetchAttemptedRef = useRef(false);
  const backgroundsFetchAttemptedRef = useRef(false);
  
  // Insert Section Images state
  const [showInjectImagesModal, setShowInjectImagesModal] = useState(false);
  const [selectedSectionsForImages, setSelectedSectionsForImages] = useState([]);
  const [customSectionPrompt, setCustomSectionPrompt] = useState('');
  const [isInjectingImages, setIsInjectingImages] = useState(false);
  const [injectImagesProgress, setInjectImagesProgress] = useState(0);

  
  // Calculate credits required based on article source
  const getCreditsRequired = () => {
    // Check if articleData has _source field
    const articleSource = articleData?._source;
    // If source is 'voice' or 'text', it costs 2 credits, otherwise 1 credit
    return (articleSource === 'voice' || articleSource === 'text') ? 2 : 1;
  };
  
  // Function to detect if article already has an image
  const hasExistingImage = () => {
    // Check multiple sources for existing images
    return (
      generatedImageUrl || // Already generated in this session
      html.includes('article-featured-image') || // Image in HTML
      articleData?.featuredImage || // Stored in Firestore
      articleData?.generatedImageUrl // Alternative storage key
    );
  };

  useEffect(() => {
    if (!user?.uid) return;
    let isMounted = true;
    (async () => {
      try {
        const profile = await getUserProfile(user.uid);
        if (!isMounted) return;
        setAuthorProfile({
          name: profile?.name || user?.displayName || user?.email || '',
          body: profile?.authorBioBody || '',
          image: profile?.authorBioImage || user?.photoURL || ''
        });
      } catch (err) {
        console.error('Failed to load author profile for article view:', err);
        if (!isMounted) return;
        setAuthorProfile((prev) => ({
          ...prev,
          name: prev.name || user?.displayName || user?.email || '',
          image: prev.image || user?.photoURL || ''
        }));
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user?.uid, user?.displayName, user?.email, user?.photoURL]);

  // Handler for retrying image generation
  const handleRetryImageGeneration = () => {
    setImageGenerationError(null);
    setImageGenerationProgress(0);
    setImageGenerationStatus('');
    setAutoGenerationAttempted(false); // Allow auto-generation to be attempted again
    handleGenerateImage();
  };

  // Handler for Generate Image button
  const handleGenerateImage = async (isAutoGenerated = false) => {
    try {
      setIsGeneratingImage(true);

      // For auto-generation, skip the modal and use subtle feedback
      if (!isAutoGenerated) {
        setShowImageGenerationModal(true);
        setImageGenerationProgress(0);
        setImageGenerationStatus('Initializing AI image generation...');
      } else {
        setImageGenerationStatus('Auto-generating image...');
      }

      setError('');
      setInfo('');
      
      if (!user) throw new Error('Not authenticated');
      
      // Simulate progress updates for better UX
      const progressInterval = setInterval(() => {
        setImageGenerationProgress(prev => {
          if (prev >= 90) return 90; // Hard cap at 90% until complete
          const increment = Math.random() * 15;
          const next = prev + increment;
          return Math.max(0, Math.min(90, next));
        });
      }, 800);
      
      // Update status messages
      setTimeout(() => setImageGenerationStatus('Analyzing article content...'), 1000);
      setTimeout(() => setImageGenerationStatus('Creating visual concepts...'), 3000);
      setTimeout(() => setImageGenerationStatus('Generating high-quality image...'), 5000);
      setTimeout(() => setImageGenerationStatus('Applying final touches...'), 8000);
      
      const token = await user.getIdToken();
      
      // Use only the article title; the Apps Script handles style/size
      const imagePrompt = title;
      
      // Call the image generation endpoint
      const response = await fetch(`${ENV.API.baseUrl}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: imagePrompt
        })
      });
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to generate image');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setImageGenerationProgress(95);
        setImageGenerationStatus('Processing and optimizing image...');
        
        const imageUrl = result.data.shareableLink || result.data.url;
        setGeneratedImageUrl(imageUrl);
        
        // Insert the image into the article HTML (function will convert internally too)
        setImageGenerationStatus('Inserting image into article...');
        await insertImageIntoArticle(imageUrl);
        
        setImageGenerationProgress(100);
        setImageGenerationStatus('Image generated successfully!');

        // Handle success differently for auto vs manual generation
        if (isAutoGenerated) {
          // Auto-generation: show subtle success message
          setInfo('Image automatically generated and added to article!');
          setTimeout(() => setInfo(''), 3000);
        } else {
          // Manual generation: show full modal flow
          setTimeout(() => {
            setShowImageGenerationModal(false);
            setShowImageModal(true);
            setInfo('Image generated and inserted into article!');
            setTimeout(() => setInfo(''), 5000);
          }, 1500);
        }
      } else {
        throw new Error(result.error?.message || 'Failed to generate image');
      }
      
    } catch (error) {
      console.error('Image generation error:', error);

      if (isAutoGenerated) {
        // Auto-generation failures: silent or minimal feedback
        console.log('Auto-generation failed, user can try manually:', error.message);
        setAutoGenerationAttempted(false); // Allow manual retry
        setInfo('Auto-generation failed. Click Generate Image to try manually.');
        setTimeout(() => setInfo(''), 5000);
      } else {
        // Manual generation: show full error modal
        setImageGenerationError({
          message: error.message,
          type: error.message.includes('auth') ? 'auth' :
                error.message.includes('network') ? 'network' : 'general'
        });
        setImageGenerationStatus('Generation failed');
        setImageGenerationProgress(0);
        // Don't close modal - let user retry or close manually
      }

      // Don't set global error - handle it in modal
    } finally {
      setIsGeneratingImage(false);
    }
  };
  
  
  // Function to insert image into article HTML and save it
  const insertImageIntoArticle = async (imageUrl) => {
    try {
      console.log('Using image URL:', imageUrl);
      
      // Create the image HTML with cropping to 1200x630 aspect ratio and fallback attributes
      // IMPORTANT: Use text-align: left for the container to ensure content after image remains left-aligned
      const imageHtml = `
<div class="article-featured-image" style="margin: 2rem 0; text-align: left; display: block !important; width: 100%; visibility: visible !important;">
  <div style="position: relative; width: 100%; max-width: 100%; aspect-ratio: 1200 / 630; overflow: hidden; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin: 0;">
    <img 
      src="${imageUrl}" 
      alt="${title}" 
      loading="lazy"
      crossorigin="anonymous"
      referrerpolicy="no-referrer"
      style="width: 100%; height: 100%; object-fit: cover; display: block !important; visibility: visible !important; margin: 0;" 
      onerror="console.error('Failed to load image:', '${imageUrl}')" 
      onload="console.log('Image loaded successfully:', '${imageUrl}')" 
    />
  </div>
  <p style="font-size: 0.875rem; color: #666; margin-top: 0.5rem; font-style: italic; text-align: left;"></p>
</div>`;
      
      console.log('Inserting image with URL:', imageUrl);
      console.log('Current HTML structure (first 500 chars):', html.substring(0, 500));
      
      // Find where to insert the image
      let updatedHtml = html;
      
      // Check if there's already a featured image and remove it first
      if (updatedHtml.includes('class="article-featured-image"')) {
        // Remove existing featured image completely (including any nested content)
        updatedHtml = updatedHtml.replace(
          /<div class="article-featured-image"[^>]*>(?:(?!<div class="article-featured-image")[\s\S])*?<\/div>/g,
          ''
        );
      }
      
      // Now insert the new image in the right place
      // Try multiple approaches to ensure it gets inserted
      
      let imageInserted = false;
      
      // Method 1: Look for the subtitle and Quick Summary pattern
      if (!imageInserted && updatedHtml.includes('class="subtitle"') && updatedHtml.includes('Quick Summary')) {
        const pattern = /(<p class="subtitle"[^>]*>.*?<\/p>)([\s\S]*?)(<h2[^>]*>.*?Quick Summary)/i;
        if (pattern.test(updatedHtml)) {
          updatedHtml = updatedHtml.replace(pattern, `$1\n${imageHtml}\n$3`);
          imageInserted = true;
          console.log('Image inserted after subtitle, before Quick Summary');
        }

const formatBioHtml = (text) => {
  if (!text) {
    return '';
  }
  return text.includes('<') ? text : text.replace(/\n/g, '<br />');
};
      }
      
      // Method 2: After subtitle (if no Quick Summary)
      if (!imageInserted && updatedHtml.includes('class="subtitle"')) {
        updatedHtml = updatedHtml.replace(
          /(<p class="subtitle"[^>]*>.*?<\/p>)/is,
          `$1\n${imageHtml}`
        );
        imageInserted = true;
        console.log('Image inserted after subtitle');
      }
      
      // Method 3: After h1 title
      if (!imageInserted && /<h1[^>]*>.*?<\/h1>/i.test(updatedHtml)) {
        updatedHtml = updatedHtml.replace(
          /(<h1[^>]*>.*?<\/h1>)/is,
          `$1\n${imageHtml}`
        );
        imageInserted = true;
        console.log('Image inserted after h1 title');
      }
      
      // Method 4: At the beginning of article-container
      if (!imageInserted && updatedHtml.includes('article-container')) {
        updatedHtml = updatedHtml.replace(
          /(<div[^>]*class="article-container"[^>]*>)/i,
          `$1\n${imageHtml}`
        );
        imageInserted = true;
        console.log('Image inserted at beginning of article-container');
      }
      
      // Method 5: Force insert at a specific position if all else fails
      if (!imageInserted) {
        // Try to insert after any opening div tag
        if (/<div[^>]*>/.test(updatedHtml)) {
          updatedHtml = updatedHtml.replace(
            /(<div[^>]*>)/i,
            `$1\n${imageHtml}`
          );
          imageInserted = true;
          console.log('Image inserted after first div');
        } else {
          // Last resort: prepend
          updatedHtml = imageHtml + updatedHtml;
          imageInserted = true;
          console.log('Image prepended to HTML');
        }
      }
      
      // Log the result
      console.log('Image inserted. Checking if it exists in HTML:', updatedHtml.includes(imageUrl));
      console.log('Image HTML position in updated content:', updatedHtml.indexOf('article-featured-image'));
      
      // Update the local state
      setHtml(updatedHtml);
      
      // Force a re-render by also updating a timestamp state
      setInfo(`Image inserted at ${new Date().toLocaleTimeString()}`);
      
      // Save the updated HTML to Firestore
      const { updateArticle } = await import('../../../../services/articleService');
      await updateArticle(
        user.uid,
        id,
        {
          htmlContent: updatedHtml,
          lastModified: new Date().toISOString(),
          modifiedBy: user.email || 'user',
          featuredImage: imageUrl // Save the image URL for reference
        },
        source,
        keywordId
      );
      
      console.log('Article updated with generated image');
      
    } catch (error) {
      console.error('Error inserting image into article:', error);
      throw error;
    }
  };

  /**
   * Extract article sections from HTML for section image injection
   */
  const extractArticleSections = () => {
    if (!html) {
      return [];
    }

    const sections = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const headingElements = Array.from(doc.querySelectorAll('h2, h3'));

    headingElements.forEach((heading, index) => {
      const titleText = heading.textContent?.trim();
      if (!titleText) {
        return;
      }

      const tagName = heading.tagName.toLowerCase();
      const sectionLevel = tagName === 'h2' ? 'Main Section' : 'Subsection';
      const sectionId = `section-${tagName}-${index}`;

      let contentHtml = '';
      let contentText = '';
      let sibling = heading.nextElementSibling;
      while (sibling) {
        const siblingTag = sibling.tagName?.toLowerCase();
        if (siblingTag === 'h2' || (tagName === 'h3' && siblingTag === 'h3')) {
          break;
        }

        contentHtml += `${sibling.outerHTML}\n`;
        contentText += `${(sibling.textContent || '').trim()}\n`;
        sibling = sibling.nextElementSibling;
      }

      sections.push({
        id: sectionId,
        title: titleText,
        type: tagName,
        level: sectionLevel,
        contentHtml: contentHtml.trim(),
        contentText: contentText.trim()
      });
    });

    return sections;
  };

  /**
   * Inject images into selected sections
   */
  const handleCloseInjectImagesModal = () => {
    setShowInjectImagesModal(false);
    setCustomSectionPrompt('');
  };

  const handleInjectSectionImages = async () => {
    if (selectedSectionsForImages.length === 0) {
      setError('Please select at least one section');
      return;
    }

    try {
      setIsInjectingImages(true);
      setInjectImagesProgress(0);
      setInfo('Generating and inserting images into selected sections...');

      const token = await user.getIdToken();
      let updatedHtml = html;
      
      // Process each selected section
      for (let i = 0; i < selectedSectionsForImages.length; i++) {
        const section = selectedSectionsForImages[i];
        setInjectImagesProgress(((i + 1) / selectedSectionsForImages.length) * 90);
        setInfo(`Processing section ${i + 1}/${selectedSectionsForImages.length}: ${section.title.substring(0, 40)}...`);
        
        // Generate image for this section
        const autoPromptContent = section.contentText?.trim() || section.contentHtml?.replace(/<[^>]+>/g, ' ').trim() || section.title;
        const promptContent = customSectionPrompt?.trim()
          ? `${customSectionPrompt.trim()}

Section context:
${autoPromptContent}`
          : autoPromptContent;

        const response = await fetch(`${ENV.API.baseUrl}/image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: promptContent,
            heading: section.title
          })
        });
        
        if (!response.ok) {
          console.error(`Failed to generate image for section: ${section.title}`);
          continue;
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          const imageUrl = result.data.shareableLink || result.data.url;
          
          // Create image HTML for this section with same dimensions as featured image (1200x630)
          const sectionImageHtml = `
<div class="section-image" style="margin: 2rem 0; text-align: left; display: block !important; width: 100%; visibility: visible !important;">
  <div style="position: relative; width: 100%; max-width: 100%; aspect-ratio: 1200 / 630; overflow: hidden; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin: 0;">
    <img 
      src="${imageUrl}" 
      alt="${section.title}" 
      loading="lazy"
      crossorigin="anonymous"
      referrerpolicy="no-referrer"
      style="width: 100%; height: 100%; object-fit: cover; display: block !important; visibility: visible !important; margin: 0;" 
      onerror="console.error('Failed to load section image:', '${imageUrl}')" 
      onload="console.log('Section image loaded successfully:', '${imageUrl}')" 
    />
  </div>
</div>`;
          
          // Inject image after the heading
          const headingPattern = new RegExp(`(<${section.type}[^>]*>${section.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\/${section.type}>)`, 'i');
          
          if (headingPattern.test(updatedHtml)) {
            updatedHtml = updatedHtml.replace(
              headingPattern,
              `$1\n${sectionImageHtml}`
            );
            console.log(`Image inserted for section: ${section.title}`);
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setInjectImagesProgress(95);
      setInfo('Saving updated article...');
      
      // Update local state
      setHtml(updatedHtml);
      
      // Save to Firestore
      const { updateArticle } = await import('../../../../services/articleService');
      await updateArticle(
        user.uid,
        id,
        {
          htmlContent: updatedHtml,
          lastModified: new Date().toISOString(),
          modifiedBy: user.email || 'user'
        },
        source,
        keywordId
      );
      
      setInjectImagesProgress(100);
      setInfo(`Successfully inserted images into ${selectedSectionsForImages.length} section(s)!`);
      handleCloseInjectImagesModal();
      setSelectedSectionsForImages([]);
      
      setTimeout(() => setInfo(''), 5000);
      
    } catch (error) {
      console.error('Error injecting section images:', error);
      setError('Failed to inject images: ' + error.message);
    } finally {
      setIsInjectingImages(false);
      setInjectImagesProgress(0);
    }
  };

  const previewAuthorName = authorProfile.name || 'Your Name';
  const previewBioImage = authorProfile.image || '/images/default-avatar.png';
  const fallbackBody = articleData?.finalArticle?.authorBio || articleData?.authorBio || '';
  const previewBodyHtml = authorProfile.body
    ? formatBioHtml(authorProfile.body)
    : formatBioHtml(fallbackBody || 'Write your author bio here. Include your role, expertise, and achievements.');
  
  /**
   * Inject video HTML into a specific FAQ in the article
   * Similar pattern to insertImageIntoArticle - updates HTML string and saves to Firestore
   */
  const injectVideoIntoFAQ = async (faqId, videoData) => {
    if (!videoData?.videoUrl || videoData?.status !== 'completed') {
      console.warn('Cannot inject incomplete video:', faqId, videoData);
      return;
    }
    
    try {
      console.log(`🎬 Injecting video for ${faqId}`, videoData);
      
      // ✅ CACHE: Try to use cached video or preload for caching
      let videoUrl = videoData.videoUrl;
      try {
        const cachedUrl = await getCachedVideo(videoData.videoUrl);
        if (cachedUrl) {
          videoUrl = cachedUrl;
          console.log('📦 Using cached video for', faqId);
        } else {
          // Preload video for future use (async, don't wait)
          preloadVideo(videoData.videoUrl).catch(err => 
            console.warn('Failed to preload video:', err)
          );
        }
      } catch (cacheError) {
        console.warn('Video cache error, using direct URL:', cacheError);
      }
      
      // Create video HTML
      const videoHtml = `
    <div class="faq-video-player" data-faq-id="${faqId}" style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span style="font-size: 0.9rem; font-weight: 600; color: #00D4FF;">AI Generated Video</span>
      </div>
      <video 
        controls 
        preload="metadata"
        style="width: 100%; max-width: 600px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" 
        poster="${videoData.thumbnailUrl || ''}"
        crossorigin="anonymous"
      >
        <source src="${videoUrl}" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      ${videoData.duration ? `<div style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">Duration: ${Math.round(videoData.duration)}s</div>` : ''}
    </div>`;
      
      let updatedHtml = html;
      
      // Remove existing video player for this FAQ if present
      const existingVideoPattern = new RegExp(
        `<div class="faq-video-player" data-faq-id="${faqId}"[^>]*>[\\s\\S]*?</div>\\s*(?=<p class="back-to-toc"|</div>)`,
        'gi'
      );
      updatedHtml = updatedHtml.replace(existingVideoPattern, '');
      
      // Find and replace the mount point with video HTML
      const mountPointPattern = new RegExp(
        `<div class="faq-video-mount" data-faq-id="${faqId}"[^>]*></div>`,
        'gi'
      );
      
      if (mountPointPattern.test(updatedHtml)) {
        updatedHtml = updatedHtml.replace(mountPointPattern, videoHtml);
        console.log(`✅ Video injected for ${faqId} (replaced mount point)`);
      } else {
        // Fallback: Insert before "Back to Table of Contents" link
        const faqIndex = faqId.split('-')[1];
        const backToTocPattern = new RegExp(
          `(<div class="faq-item" id="faq-${faqIndex}"[\\s\\S]*?)<p class="back-to-toc">`,
          'i'
        );
        
        if (backToTocPattern.test(updatedHtml)) {
          updatedHtml = updatedHtml.replace(backToTocPattern, `$1${videoHtml}\n      <p class="back-to-toc">`);
          console.log(`✅ Video injected for ${faqId} (fallback method)`);
        } else {
          console.warn(`⚠️ Could not find injection point for ${faqId}`);
          return;
        }
      }
      
      // Update state
      setHtml(updatedHtml);
      console.log(`🔄 HTML state updated with video for ${faqId}`);
      
      // Save to Firestore
      const { updateArticle } = await import('../../../../services/articleService');
      await updateArticle(
        user.uid,
        id,
        {
          htmlContent: updatedHtml,
          videos: { ...faqVideos, [faqId]: videoData },
          lastModified: new Date().toISOString()
        },
        source,
        keywordId
      );
      
      console.log(`💾 Video saved to Firestore for ${faqId}`);
      
      // ✅ AUTO-UPDATE: Mark as completed in activeVideoGenerations
      setActiveVideoGenerations(prev => prev.map(gen => 
        gen.faqId === faqId 
          ? { ...gen, progress: 100, status: 'completed' }
          : gen
      ));
      
      // ✅ TOAST NOTIFICATION: Show success message
      const faqNumber = faqId.split('-')[1] || '?';
      const faqQuestion = extractFAQsFromArticle().find(f => f.id === faqId)?.question || 'Question';
      const truncatedQuestion = faqQuestion.length > 50 
        ? faqQuestion.substring(0, 50) + '...' 
        : faqQuestion;
      
      setVideoToastMessage(`✅ FAQ #${faqNumber}: ${truncatedQuestion} - Video inserted!`);
      setShowVideoToast(true);
      setTimeout(() => setShowVideoToast(false), 5000);
      
    } catch (error) {
      console.error(`❌ Error injecting video for ${faqId}:`, error);
      throw error;
    }
  };

  // Helper: extract FAQ answer from current HTML using its faqId (e.g., "faq-3")
  const extractAnswerFromHtmlByFaqId = (faqId) => {
    try {
      if (!html || !faqId) return '';
      const faqIndex = (faqId.includes('-') ? faqId.split('-')[1] : faqId).toString();
      const blockPattern = new RegExp(
        `(<div\\s+class=\\"faq-item\\"\\s+id=\\"faq-${faqIndex}\\"[\\s\\S]*?)<p\\s+class=\\"back-to-toc\\">`,
        'i'
      );
      const match = html.match(blockPattern);
      if (!match) return '';

      // Strip HTML tags from captured block
      const blockHtml = match[1];
      const text = blockHtml
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Heuristic: remove the question heading if present at the start
      // Keep the first 800 chars to avoid overlong prompts
      return text ? text.substring(0, 800).trim() : '';
    } catch (_) {
      return '';
    }
  };

  /**
   * Fetch available avatars from HeyGen API
   */
  const fetchAvatars = async () => {
    if (availableAvatars.length > 0 && avatarsFetchAttemptedRef.current) return;
    if (avatarsFetchAttemptedRef.current && loadingAvatars) return;

    try {
      setLoadingAvatars(true);
      avatarsFetchAttemptedRef.current = true;
      const token = await user.getIdToken();
      const response = await fetch(`${ENV.API.baseUrl}/heygen/avatars`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        const fetchedAvatars = result.data?.avatars || [];
        if (fetchedAvatars.length) {
          setAvailableAvatars(fetchedAvatars);
        } else {
          setAvailableAvatars([
            {
              avatar_id: 'Daisy-inskirt-20220818',
              avatar_name: 'Daisy (Default)',
              is_public: true
            }
          ]);
        }
        console.log('✅ Loaded avatars:', {
          total: result.data?.total ?? fetchedAvatars.length,
          cached: result.data?.cached === true
        });
      } else {
        avatarsFetchAttemptedRef.current = false;
      }
    } catch (error) {
      console.error('Failed to fetch avatars:', error);
      avatarsFetchAttemptedRef.current = false;
    } finally {
      setLoadingAvatars(false);
    }
  };

  /**
   * Fetch available voices from HeyGen API
   */
  const fetchVoices = async () => {
    if (availableVoices.length > 0 && voicesFetchAttemptedRef.current) return;
    if (voicesFetchAttemptedRef.current && loadingVoices) return;

    try {
      setLoadingVoices(true);
      voicesFetchAttemptedRef.current = true;
      const token = await user.getIdToken();
      const response = await fetch(`${ENV.API.baseUrl}/heygen/voices`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        const fetchedVoices = result.data?.voices || [];
        if (fetchedVoices.length) {
          setAvailableVoices(fetchedVoices);
        }
        console.log('✅ Loaded voices:', {
          total: result.data?.total ?? fetchedVoices.length,
          cached: result.data?.cached === true
        });
      } else {
        voicesFetchAttemptedRef.current = false;
      }
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      voicesFetchAttemptedRef.current = false;
    } finally {
      setLoadingVoices(false);
    }
  };

  /**
   * Fetch available realistic backgrounds from HeyGen API
   */
  const fetchBackgrounds = async () => {
    if (availableBackgrounds.length > 0 && backgroundsFetchAttemptedRef.current) return;
    if (backgroundsFetchAttemptedRef.current && loadingBackgrounds) return;

    try {
      setLoadingBackgrounds(true);
      backgroundsFetchAttemptedRef.current = true;
      const token = await user.getIdToken();
      const response = await fetch(`${ENV.API.baseUrl}/heygen/backgrounds`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setAvailableBackgrounds(result.data || {});
        console.log('✅ Loaded backgrounds:', result.data?.total);
      } else {
        backgroundsFetchAttemptedRef.current = false;
      }
    } catch (error) {
      console.error('Failed to fetch backgrounds:', error);
      backgroundsFetchAttemptedRef.current = false;
    } finally {
      setLoadingBackgrounds(false);
    }
  };

  /**
   * Handle FAQ video generation from the top button
   * Similar pattern to handleGenerateImage
   */
  const handleGenerateFaqVideo = async () => {
    if (!selectedFaqForVideo) {
      setError('Please select an FAQ first');
      return;
    }

    try {
      setIsGeneratingVideo(true);
      setVideoGenerationProgress(0);
      setVideoGenerationStatus('Initializing AI video generation...');
      setError('');

      if (!user) throw new Error('Not authenticated');

      const faq = selectedFaqForVideo;
      const faqId = faq.id;

      // Build the script from FAQ answer ONLY (no question), supporting answer_md and HTML fallback
      let rawAnswer = (faq.answer_md || faq.answer || '').trim();
      if (!rawAnswer) {
        // Fallback: extract from HTML based on faqId
        rawAnswer = extractAnswerFromHtmlByFaqId(faqId);
      }
      if (!rawAnswer) {
        setIsGeneratingVideo(false);
        setError('Selected FAQ has no answer text to generate a video from.');
        return;
      }
      const script = rawAnswer;
      
      // Calculate max characters based on duration (150 words per minute, ~5 chars per word)
      const maxChars = Math.floor((videoDuration / 60) * 150 * 5);
      const truncatedScript = script.length > maxChars ? script.substring(0, maxChars) : script;

      console.log('📝 Generating video with:', { faqId, duration: videoDuration, scriptLength: truncatedScript.length });
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setVideoGenerationProgress(prev => Math.min(prev + 5, 90));
      }, 1000);

      const token = await user.getIdToken();
      const response = await fetch(`${ENV.API.baseUrl}/heygen/generate-faq-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          articleId: id,
          faqId: faqId,
          faqContent: {
            answer: truncatedScript,
            question: faq.question,
            takeaway: faq.takeaway || ''
          },
          source: source,
          keywordId: keywordId,
          options: {
            ...videoOptions,
            targetDuration: videoDuration
          }
        })
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to generate video');
      }

      const result = await response.json();
      console.log('📦 Initial video generation response:', result);

      if (result.success && result.data) {
        setVideoGenerationProgress(95);
        setVideoGenerationStatus('Video generated! Embedding in article...');

        const videoData = {
          ...result.data,
          question: faq.question,
          generatedAt: new Date().toISOString()
        };

        console.log('🎬 Video data:', {
          status: videoData.status,
          heygenVideoId: videoData.heygenVideoId,
          videoId: result.data.videoId,
          hasVideoUrl: !!videoData.videoUrl
        });

        // IMPORTANT: Save video to Firestore FIRST before polling
        // The polling endpoint needs the video to exist in the database
        const updatedVideos = {
          ...faqVideos,
          [faqId]: videoData
        };
        setFaqVideos(updatedVideos);

        // Save to Firestore
        await updateArticle(
          user.uid,
          id,
          {
            videos: updatedVideos,
            lastModified: new Date().toISOString()
          },
          source,
          keywordId
        );
        console.log('💾 Saved initial video data to Firestore');

        // Add to active generations tracking
        setActiveVideoGenerations(prev => [...prev, {
          faqId: faqId,
          faqQuestion: faq.question,
          progress: 0,
          status: 'processing',
          startTime: Date.now(),
          videoId: result.data.videoId
        }]);

        // Show success and close modal immediately
        setVideoGenerationProgress(100);
        setVideoGenerationStatus('Video generation started!');
        
        setTimeout(() => {
          setShowVideoModal(false);
          setVideoModalTab('generate'); // Reset to generate tab
          
          // Show prominent toast notification
          setVideoToastMessage('🎬 Video is generating on the server! Check the Status tab to track progress.');
          setShowVideoToast(true);
          
          // Auto-dismiss toast after 8 seconds
          setTimeout(() => {
            setShowVideoToast(false);
            setTimeout(() => setVideoToastMessage(''), 500); // Clear message after fade-out
          }, 8000);
        }, 1000);

        // Start SERVER-SIDE polling - video generation continues even if browser closes
        if (videoData.status === 'processing' && result.data.videoId) {
          console.log('⏳ Starting server-side polling for videoId:', result.data.videoId);
          
          // Call server-side polling endpoint (don't await - fire and forget)
          fetch(`${ENV.API.baseUrl}/heygen/poll-and-inject`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              videoId: result.data.videoId,
              articleId: id,
              faqId: faqId,
              userId: user.uid,
              source: source,
              keywordId: keywordId
            })
          }).then(response => response.json())
            .then(data => {
              console.log('✅ Server-side polling started:', data);
            })
            .catch(error => {
              console.error('❌ Failed to start server-side polling:', error);
              setError('Failed to start video monitoring. Please refresh the page.');
            });
        } else if (videoData.status === 'completed' && videoData.videoUrl) {
          // Inject immediately if already complete (rare case)
          await injectVideoIntoFAQ(faqId, videoData);
          setInfo('Video generated and embedded in FAQ!');
          setTimeout(() => setInfo(''), 5000);
        }
      } else {
        throw new Error(result.error?.message || 'Failed to generate video');
      }

    } catch (error) {
      console.error('Video generation error:', error);
      setError(error.message);
      setVideoGenerationStatus('Generation failed');
      setVideoGenerationProgress(0);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  /**
   * NOTE: Client-side polling has been removed and replaced with server-side polling.
   * The server now handles video status polling independently via Firebase Functions.
   * This allows video generation to complete even if the browser is closed.
   * 
   * Video completion is now handled entirely server-side via:
   * - /heygen/poll-and-inject endpoint (triggers server-side polling)
   * - pollVideoAndInject function (runs on Firebase Functions)
   * 
   * Users can refresh the page to see completed videos, or implement a
   * Firestore listener for real-time updates (future enhancement).
   */
  
  // Helper: strip the in-body title before sending to WordPress to avoid duplicate titles
  const stripTitleForWordPress = (contentHtml, currentTitle) => {
    if (!contentHtml) return contentHtml;

    let updated = contentHtml;

    // Remove only the first H1 occurrence (assumed to be the article's in-body title)
    updated = updated.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');

    // Optionally, if the very next element is a subtitle that exactly matches the title, remove it too
    // This is conservative: only remove when the text matches the current title exactly (ignoring whitespace)
    try {
      // Remove a leading subtitle paragraph if it equals the title
      const subtitleMatch = updated.match(/^(\s*<p[^>]*class=[\"']subtitle[\"'][^>]*>)([\s\S]*?)(<\/p>)/i);
      if (subtitleMatch) {
        const subtitleText = subtitleMatch[2].replace(/<[^>]+>/g, '').trim();
        if (currentTitle && subtitleText && subtitleText.trim() === currentTitle.trim()) {
          updated = updated.replace(subtitleMatch[0], '');
        }
      }
    } catch (_) {
      // fail safe: ignore subtitle removal errors
    }

    return updated;
  };

  // Helper: keep featured image tag but remove image src (and hide wrapper to avoid gap) when sending to WordPress
  const neutralizeFeaturedImageForWordPress = (contentHtml) => {
    if (!contentHtml) return contentHtml;

    let updated = contentHtml;

    try {
      // Add display:none to wrapper to avoid layout space on WP
      updated = updated.replace(
        /<div class=\"article-featured-image\"([^>]*)style=\"([^\"]*)\"/i,
        (match, attrs, style) => `<div class=\"article-featured-image\"${attrs}style=\"${style}; display:none;\"`
      );

      // If wrapper has no style attribute, add one
      updated = updated.replace(
        /<div class=\"article-featured-image\"(?![^>]*style=)[^>]*>/i,
        (match) => match.replace('>', ' style=\"display:none;\">')
      );

      // Remove src from the first <img> inside the featured image block, preserve the tag
      updated = updated.replace(
        /(<div class=\"article-featured-image\"[\s\S]*?<img)([^>]*?)\ssrc=\"[^\"]*\"([^>]*>)/i,
        (full, start, beforeSrc, after) => `${start}${beforeSrc} src=\"\" data-neutralized=\"true\"${after}`
      );
    } catch (_) {
      // If anything goes wrong, return original to avoid breaking content
      return contentHtml;
    }

    return updated;
  };

  // DOM-based neutralizer to avoid regex brittleness (preferred)
  const neutralizeInContentFeaturedImage = (contentHtml) => {
    try {
      const container = document.createElement('div');
      container.innerHTML = contentHtml || '';
      const img = container.querySelector('div.article-featured-image img');
      if (img) {
        // Remove the image source so it doesn't load
        img.setAttribute('src', '');
        img.removeAttribute('srcset');
        img.removeAttribute('onerror');
        img.removeAttribute('onload');

        // Also hide the wrapper to avoid taking up layout space in WP editor/theme
        const wrapper = img.closest('div.article-featured-image');
        if (wrapper) {
          const prev = wrapper.getAttribute('style') || '';
          const appended = prev.endsWith(';') || prev.length === 0 ? prev : prev + ';';
          wrapper.setAttribute('style', appended + 'display:none !important;');
        }
      }
      return container.innerHTML;
    } catch (e) {
      console.warn('neutralizeInContentFeaturedImage failed:', e);
      return contentHtml;
    }
  };
  
  // Handler for retrying Google Docs conversion
  const handleRetryGoogleDocsConversion = () => {
    setGoogleDocsError(null);
    setGoogleDocsData(null);
    handleGoogleDocsConversion();
  };

  // Helper function to perform the actual Google Docs conversion
  const performGoogleDocsConversion = async () => {
    try {
      console.log('Starting Google Docs conversion via Firebase Function');
      setInfo('Converting to Google Docs...');

      const token = await user.getIdToken();
      const apiBaseUrl = ENV.API.baseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:5002/lead-generation-6cf0f/us-central1/api';

      // Prepare article data for conversion
      // Extract JSON data from the current article if possible
      let articleData = null;
      try {
        // First try to get the original JSON data from Firestore
        const articleJson = await getUnifiedArticleContent(user.uid, { id, source, keywordId });
        articleData = articleJson?.data || articleJson;
      } catch (err) {
        console.warn('Could not fetch original article data, using HTML fallback:', err);
        articleData = {}; // On error, ensure articleData is an object to avoid crashes
      }

      // Ensure htmlContent is available for image extraction and conversion, using local state as a fallback.
      if (articleData && !articleData.htmlContent && html) {
        articleData.htmlContent = html;
      }
      
      // Add branding to content for Google Docs if required
      if (articleData && articleData.htmlContent) {
        articleData.htmlContent = appendBrandingToContent(articleData.htmlContent, tier, userBrandingSettings);
      }

      // Extract image URL from Firestore data (prioritize stored image over local state)
      let firestoreImageUrl = null;
      if (articleData) {
        // Prefer explicit fields saved in Firestore
        const candidates = [
          articleData.featuredImage,
          articleData.generatedImageUrl,
          articleData.image_url,
          articleData.imageUrl,
          articleData.headerImage,
          articleData?.metadata?.featuredImage,
          articleData?.metadata?.image,
          articleData?.metadata?.imageUrl,
          articleData?._metadata?.featuredImage,
          articleData?._metadata?.image,
          articleData?._metadata?.imageUrl
        ].filter(Boolean);

        // Attempt to extract from HTML if not found in metadata
        if (candidates.length === 0 && articleData.htmlContent) {
          try {
            const match = articleData.htmlContent.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
            if (match && match[1]) {
              candidates.push(match[1]);
            }
          } catch (_) {
            // ignore HTML parse errors
          }
        }

        // Pick the first valid candidate
        firestoreImageUrl = candidates.find(Boolean) || null;
      }

      // If we don't have JSON data, create a minimal structure from HTML
      if (!articleData || (!articleData.title && !articleData.key_takeaways)) {
        articleData = {
          title: title || 'Document',
          htmlContent: html
        };
      }

      const response = await fetch(`${apiBaseUrl}/word-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          articleData: articleData,
          userId: user.uid,
          articleId: id,
          keywordId: keywordId || title?.trim(),
          image_url: firestoreImageUrl || generatedImageUrl || null  // Prefer Firestore image URL, fallback to local state
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to convert to Google Docs');
      }

      const result = await response.json();

      if (result.success && result.data.documentUrl) {
        setGoogleDocUrl(result.data.documentUrl);

        // Store the Google Docs data for the modal
        setGoogleDocsData({
          url: result.data.documentUrl,
          title: result.data.documentTitle,
          id: result.data.documentId,
          createdAt: result.data.createdAt || new Date().toISOString()
        });

        // Save Google Docs data to Firestore
        try {
          const updateData = {
            googleDocsUrl: result.data.documentUrl,
            googleDocsTitle: result.data.documentTitle,
            googleDocsId: result.data.documentId,
            googleDocsCreatedAt: result.data.createdAt || new Date().toISOString(),
            lastModified: new Date().toISOString()
          };

          await updateArticle(
            user.uid,
            id,
            updateData,
            source,
            keywordId
          );

          console.log('✅ Google Docs data saved to Firestore');
        } catch (firestoreError) {
          console.error('Failed to save Google Docs data to Firestore:', firestoreError);
          // Don't throw here - we still want to show success to user
        }

        // Modal is already open, just update with the data
        console.log('Google Docs conversion completed:', result.data.documentUrl);
      } else {
        throw new Error('Invalid response from word document service');
      }

    } catch (error) {
      console.error('Google Docs conversion failed:', error);

      // Set error state for display in modal
      setGoogleDocsError({
        message: error.message,
        type: error.message.includes('auth') || error.message.includes('permission') ? 'auth' :
              error.message.includes('network') || error.message.includes('fetch') ? 'network' :
              error.message.includes('quota') || error.message.includes('limit') ? 'quota' : 'general'
      });
      // Don't set global error - handle it in modal

      // Refund credits on failure
      console.log('🔄 Google Docs conversion failed, attempting to refund credits...');
      try {
        const refundResult = await refundCredits(user.uid, 1);
        if (refundResult.success) {
          console.log('✅ Credits refunded successfully');
          refetchSubscription();
        } else {
          console.error('❌ Failed to refund credits:', refundResult.error);
        }
      } catch (refundError) {
        console.error('❌ Critical error during credit refund:', refundError);
      }
    } finally {
      setIsConvertingToDocs(false);
      setInfo('');
      // Keep modal open on error to show the error state
    }
  };

  // Handler for Google Docs conversion
  const handleGoogleDocsConversion = async (skipCreditCheck = false) => {
    const creditsRequired = 1; // For Google Docs conversion
    if (!user) {
      setError('Please log in to convert to Google Docs');
      return;
    }

    setIsConvertingToDocs(true);
    setShowActionsMenu(false);
    setShowGoogleDocsModal(true);  // Show modal immediately
    setGoogleDocsData(null);  // Clear any previous data

    if (!skipCreditCheck) {
      // Check credits
      if (!validateCredits(creditsRemaining, creditsRequired)) {
        setCreditErrorMessage(`Insufficient credits. You need ${creditsRequired} credit${creditsRequired > 1 ? 's' : ''} to convert to Google Docs. You have ${creditsRemaining || 0} credits remaining.`);
        setShowCreditErrorModal(true);
        setIsConvertingToDocs(false);
        return;
      }

      // Deduct credits atomically
      console.log(`🔒 Attempting atomic credit deduction for Google Docs conversion (${creditsRequired} credits)...`);
      const creditResult = await deductCreditsAtomic(user.uid, creditsRequired);

      if (!creditResult.success) {
        throw new Error(creditResult.error || 'Failed to deduct credits');
      }

      console.log('✅ Credits deducted successfully, proceeding with Google Docs conversion...');
      refetchSubscription();
    }

    // Perform the conversion
    await performGoogleDocsConversion();
  };

  // Handler for Download Word Doc button
  const handleDownloadWordDoc = async () => {
    try {
      setIsDownloading(true);
      setError('');
      setInfo('Generating Word document...');
      
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      
      // Call the Word generation endpoint
      const response = await fetch(`${ENV.API.baseUrl}/generate-word`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title || 'Document',
          content: html,
          articleId: id,
          format: 'docx'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate Word document');
      }
      
      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setInfo('Word document downloaded successfully!');
      setTimeout(() => setInfo(''), 3000);
      
    } catch (error) {
      console.error('Word document generation error:', error);
      setError(`Failed to generate Word document: ${error.message}`);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsDownloading(false);
    }
  };
  
  // Handler for fetching WordPress categories
  const fetchCategories = async () => {
    if (!wpUrl || !wpUser || !wpPass) {
      setWpError('Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.');
      return;
    }

    setLoadingCategories(true);
    setWpError(''); // Clear any previous errors
    setCategoryError(null); // Clear category errors
    
    try {
      const token = await user.getIdToken();
      
      const response = await fetch(`${ENV.API.baseUrl}/wordpress/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          siteUrl: wpUrl,
          username: wpUser,
          applicationPassword: wpPass
        })
      });

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to fetch categories');
      }

      // Always include "Uncategorized" as first option, then add fetched categories
      const allCategories = [
        { id: 1, name: 'Uncategorized' },
        ...(result.categories || []).filter(cat => cat.id !== 1) // Avoid duplicates
      ];

      setWpCategories(allCategories);
      setCategoriesLoaded(true);
      
      console.log(`✅ Loaded ${result.categories?.length || 0} categories from WordPress`);
      
    } catch (error) {
      console.error('Categories fetch error:', error);
      
      // Use consistent error message for category loading issues
      const standardErrorMessage = 'Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.';
      
      // Show a more user-friendly message for categories
      console.warn('Categories could not be loaded:', error.message);
      
      // Set category-specific error instead of main error
      setCategoryError(standardErrorMessage);
      
      // Keep default "Uncategorized" option even on error
      setWpCategories([{ id: 1, name: 'Uncategorized' }]);
      setCategoriesLoaded(false);
      
    } finally {
      setLoadingCategories(false);
    }
  };

  // Handler for Quick Connect dropdown selection
  const handleQuickConnect = async (e) => {
    const connectionId = e.target.value;
    setSelectedConnectionId(connectionId);
    
    if (!connectionId) return;
    
    try {
      setWpError('');
      const connection = await loadConnection(connectionId);
      
      // Auto-fill form
      setWpUrl(connection.siteUrl);
      setWpUser(connection.username);
      setWpPass(connection.password);
      
      // Auto-load cached categories
      if (connection.categories?.length > 0) {
        setWpCategories([
          { id: 1, name: 'Uncategorized' },
          ...connection.categories
        ]);
        setCategoriesLoaded(true);
      }
      
      // Update last used
      await updateLastUsed(connectionId);
      
      setInfo('Connection loaded successfully!');
      setTimeout(() => setInfo(''), 3000);
      
    } catch (error) {
      console.error('Failed to load connection:', error);
      
      // Handle re-authentication errors more gracefully
      if (error.message.includes('re-authenticated')) {
        setWpError('This saved connection needs to be re-authenticated. Please enter your credentials manually.');
        setInfo('Your session has changed. Please enter your WordPress credentials again.');
        setTimeout(() => setInfo(''), 5000);
      } else {
        setWpError('Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.');
      }
    }
  };

  // Handler for saving WordPress connection
  const handleSaveConnection = async () => {
    try {
      setWpError('');
      
      const connectionData = {
        name: connectionName || WordPressConnectionService.extractSiteName(wpUrl),
        siteUrl: wpUrl,
        username: wpUser,
        password: wpPass,
        categories: wpCategories.filter(cat => cat.id !== 1) // Exclude "Uncategorized"
      };
      
      await saveConnection(connectionData);
      
      setShowSaveConnectionModal(false);
      setInfo('WordPress connection saved! 🎉');
      setTimeout(() => setInfo(''), 3000);
      
      // Reset connection state
      setConnectionName('');
      setSelectedConnectionId('');
      
    } catch (error) {
      console.error('Failed to save connection:', error);
      setWpError('Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.');
    }
  };

  // Reset connection state when modal closes
  const resetConnectionState = () => {
    setSelectedConnectionId('');
    setConnectionName('');
    setShowSaveConnectionModal(false);
    setShowWpPassword(false);
  };

  // Handler for Continue button: call /wordpress/publish endpoint
  const handleUploadContinue = async () => {
    try {
      setWpError(''); // Clear WordPress error
      setInfo('Publishing to WordPress...');
      setIsUploading(true);

      if (!user) throw new Error('Not authenticated');

      // Get credits required based on article source
      const creditsRequired = getCreditsRequired();
      
      // Check if user has enough credits
      if (!validateCredits(creditsRemaining, creditsRequired)) {
        throw new Error(`Insufficient credits. You need ${creditsRequired} credit${creditsRequired > 1 ? 's' : ''} to upload to WordPress. You have ${creditsRemaining || 0} credits remaining.`);
      }

      // Deduct credits atomically before upload
      console.log(`🔒 Attempting atomic credit deduction for WordPress upload (${creditsRequired} credits)...`);
      const creditResult = await deductCreditsAtomic(user.uid, creditsRequired);

      if (!creditResult.success) {
        throw new Error(creditResult.error || 'Failed to deduct credits');
      }

      console.log('✅ Credits deducted successfully, proceeding with WordPress upload...');

      // Refresh subscription data to update UI immediately
      refetchSubscription();

      const token = await user.getIdToken();
      // Prepare content for WordPress using DOM-based neutralizer to remove image src
      let contentForWp = neutralizeInContentFeaturedImage(
        stripTitleForWordPress(html, title)
      );
      
      // Add Author Bio section before branding
      if (authorProfile && authorProfile.body) {
        const authorBioHtml = `
<div style="margin: 3rem 0 2rem 0; text-align: left;">
  <h2 style="font-size: 1.5rem; font-weight: 700; color: #000; margin: 0 0 1.5rem 0; text-align: left;">Author Bio</h2>
  <div style="display: flex; gap: 1.5rem; align-items: flex-start; text-align: left;">
    <img src="${authorProfile.image || '/images/default-avatar.png'}" alt="${authorProfile.name || 'Author'}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />
    <div style="flex: 1; text-align: left;">
      <p style="color: #000; font-size: 1rem; line-height: 1.8; margin: 0; text-align: left;">${formatBioHtml(authorProfile.body)}</p>
    </div>
  </div>
</div>`;
        contentForWp = contentForWp + authorBioHtml;
      }
      
      // Add branding if required
      contentForWp = appendBrandingToContent(contentForWp, tier, userBrandingSettings);

      // Extract featured image from HTML if present
      let featuredImageData = null;
      
      // Look for the featured image in the HTML
      const imgMatch = html.match(/<div class="article-featured-image"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>/i);
      
      if (imgMatch && imgMatch[1]) {
        const imageUrl = imgMatch[1];
        console.log('Found featured image URL:', imageUrl);
        
        // Pass Firebase Storage URL directly
        featuredImageData = imageUrl;
      }

      // Build postOptions with featured image and category if available
      const postOptions = {
        status: 'publish'
      };
      
      if (featuredImageData) {
        postOptions.featuredImageData = featuredImageData;
        console.log('Including featured image in WordPress upload');
      }

      // Add selected category if not default "Uncategorized"
      if (selectedCategory && selectedCategory !== 1) {
        postOptions.categoryId = selectedCategory;
        const categoryName = wpCategories.find(cat => cat.id === selectedCategory)?.name || 'Unknown';
        console.log('Including category in WordPress upload:', { categoryId: selectedCategory, categoryName });
      }

      // Extract meta description from current HTML (works with version restores)
      const extractMetaDescriptionFromHtml = (htmlContent) => {
        try {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = htmlContent || '';
          
          // Try multiple selectors to find the meta description
          const metaSection = tempDiv.querySelector('.meta-description-section p') ||
                             tempDiv.querySelector('div[class*="meta-description"] p') ||
                             tempDiv.querySelector('h3:contains("Article Summary") + p');
          
          // Also check if there's any element with "Article Summary" text
          const allDivs = tempDiv.querySelectorAll('div');
          let foundMetaDiv = null;
          for (let div of allDivs) {
            if (div.innerHTML && div.innerHTML.includes('Article Summary')) {
              const p = div.querySelector('p');
              if (p) {
                foundMetaDiv = p;
                break;
              }
            }
          }
          
          const finalMetaSection = metaSection || foundMetaDiv;
          
          // Debug: Log what we found
          console.log('Meta Description Extraction Debug:', {
            hasHtml: !!htmlContent,
            htmlLength: htmlContent?.length || 0,
            hasMetaSection: !!finalMetaSection,
            metaSectionText: finalMetaSection?.textContent || null,
            htmlContainsArticleSummary: htmlContent?.includes('Article Summary') || false,
            htmlContainsMetaClass: htmlContent?.includes('meta-description-section') || false,
            htmlSnippet: htmlContent?.substring(0, 1000) || 'No HTML'
          });
          
          return finalMetaSection ? finalMetaSection.textContent.trim() : null;
        } catch (error) {
          console.warn('Failed to extract meta description from HTML:', error);
          return null;
        }
      };

      // Use meta description from current HTML first (version-aware), then fallback to saved/original
      const currentMetaDescription = extractMetaDescriptionFromHtml(html);
      const excerptValue = currentMetaDescription || 
                          articleData?.meta_description || 
                          articleData?.metadata?.meta_description || 
                          '';
      
      console.log('WordPress Upload Debug:', {
        currentMetaFromHtml: currentMetaDescription,
        savedMetaDescription: articleData?.meta_description,
        originalMetaDescription: articleData?.metadata?.meta_description,
        finalExcerptValue: excerptValue,
        excerptLength: excerptValue.length,
        source: currentMetaDescription ? 'current-html' : 
                articleData?.meta_description ? 'saved-field' : 
                articleData?.metadata?.meta_description ? 'original' : 'none'
      });

      const response = await fetch(`${ENV.API.baseUrl}/wordpress/publish-direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          siteUrl: wpUrl,
          username: wpUser,
          applicationPassword: wpPass,
          articleData: {
            title: title || 'Sample Post from Queryfuel',
            content: contentForWp || '<p>Hello from Queryfuel!</p>',
            excerpt: excerptValue,
            brandVoice: brandVoiceData // Include brand voice metadata
          },
          postOptions: postOptions
        })
      });
      
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to publish to WordPress');
      }
      
      // Save WordPress publication info to Firestore
      if (result.url) {
        try {
          const updateData = {
            wordpressUrl: result.url,
            wordpressEditUrl: result.editUrl || null,
            wordpressPostId: result.postId || null,
            wordpressSiteUrl: wpUrl,
            wordpressPublishedAt: new Date().toISOString(),
            wordpressStatus: result.status || 'published'
          };
          
          // Update the article document with WordPress info
          await updateArticle(
            user.uid,
            id,
            updateData,
            source,
            keywordId
          );
          
          console.log('WordPress publication info saved to Firestore');
        } catch (saveError) {
          console.error('Failed to save WordPress info to Firestore:', saveError);
          // Don't fail the whole operation if saving to Firestore fails
        }
      }
      
      // Show a prominent success banner with link
      setSuccessUrl(result.url || result.editUrl || null);
      setInfo('');
      setWpError(''); // Clear any WordPress errors on success
      setShowWpModal(false);
      setIsUploading(false);
      
      // Check if we should prompt to save connection
      if (!isConnectionSaved(wpUrl, wpUser)) {
        const suggestedName = WordPressConnectionService.extractSiteName(wpUrl);
        setConnectionName(suggestedName);
        setShowSaveConnectionModal(true);
      }
      
    } catch (error) {
      console.error('WordPress direct publish error:', error);

      // Refund credits if upload failed
      console.log('🔄 WordPress upload failed, attempting to refund credits...');
      try {
        const refundResult = await refundCredits(user.uid, 1);
        if (refundResult.success) {
          console.log('✅ Credits refunded successfully');
          // Refresh subscription data to show refunded credits
          refetchSubscription();
        } else {
          console.error('❌ Failed to refund credits:', refundResult.error);
        }
      } catch (refundError) {
        console.error('❌ Critical error during credit refund:', refundError);
      }

      // Extract more meaningful error messages
      let errorMessage = error.message || 'Failed to publish to WordPress';

      // Use consistent error message for all WordPress connection issues
      const standardErrorMessage = 'Please Check Your Credentials and Try Again. If you are confident your credentials are correct, please contact us so we can fix the issue.';
      
      setWpError(standardErrorMessage); // Set WordPress-specific error
      setIsUploading(false);
      setInfo(''); // Clear info message on error
      
      // Refund credits on failure
      const creditsRequired = getCreditsRequired();
      if (creditsRequired) {
        try {
          console.log(`🔄 Refunding ${creditsRequired} credits due to WordPress upload failure...`);
          await refundCredits(user.uid, creditsRequired);
          refetchSubscription();
          console.log('✅ Credits refunded successfully');
        } catch (refundError) {
          console.error('Failed to refund credits:', refundError);
        }
      }
      // Keep modal open so user can see error and retry
    }
  };

  // Handler to load and show version history
  const handleShowVersions = async () => {
    try {
      versioningActions.setLoading(true);
      setShowActionsMenu(false);

      // Get version history
      const versionHistory = await getArticleVersionHistory(user.uid, id, source, keywordId);

      // Get current version info
      const currentVersionInfo = await getCurrentArticleContent(user.uid, id, source, keywordId);

      // Filter and deduplicate versions
      const processedVersions = [];
      const seenVersionNumbers = new Set();

      versionHistory.forEach((version) => {
        // Skip auto-saved duplicates
        if (version.note?.includes('Auto-saved before restoring')) {
          return;
        }

        // Skip if we've already seen this version number (keep the most recent)
        if (version.versionNumber && seenVersionNumbers.has(version.versionNumber)) {
          return;
        }

        if (version.versionNumber) {
          seenVersionNumbers.add(version.versionNumber);
        }

        processedVersions.push(version);
      });

      // Sort by version number (descending) for clarity
      processedVersions.sort((a, b) => {
        const aNum = a.versionNumber || 0;
        const bNum = b.versionNumber || 0;
        return bNum - aNum;
      });

      versioningActions.setVersions(processedVersions);
      versioningActions.setCurrentVersion(currentVersionInfo);
      versioningActions.showModal();

    } catch (error) {
      console.error('Error loading versions:', error);
      versioningActions.setError('Failed to load version history');
    }
  };
  
  // Handler to switch to a different version
  const handleSwitchVersion = async (versionId, versionNumber) => {
    try {
      versioningActions.setLoading(true);

      // Use smart restore to avoid version loops
      const result = await smartRestoreVersion(user.uid, id, versionId, source, keywordId);

      // Show success message
      setInfo(result.message || `Restored to Version ${versionNumber}`);
      versioningActions.hideModal();

      // Reload after a short delay to show the message
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('Error switching version:', error);
      versioningActions.setError('Failed to switch version');
    }
  };

  // Handler for Shopify upload
  const handleShopifyUpload = async () => {
    try {
      setShopifyError(''); // Clear Shopify error
      setInfo('Publishing to Shopify...');
      setIsShopifyUploading(true);

      if (!user) throw new Error('Not authenticated');
      
      // Get credits required based on article source
      const creditsRequired = getCreditsRequired();
      
      // Check if user has enough credits
      if (!validateCredits(creditsRemaining, creditsRequired)) {
        throw new Error(`Insufficient credits. You need ${creditsRequired} credit${creditsRequired > 1 ? 's' : ''} to upload to Shopify. You have ${creditsRemaining || 0} credits remaining.`);
      }

      // Deduct credits atomically before upload
      console.log(`🔒 Attempting atomic credit deduction for Shopify upload (${creditsRequired} credits)...`);
      const creditResult = await deductCreditsAtomic(user.uid, creditsRequired);

      if (!creditResult.success) {
        throw new Error(creditResult.error || 'Failed to deduct credits');
      }

      console.log('✅ Credits deducted successfully, proceeding with Shopify upload...');

      // Refresh subscription data to update UI immediately
      refetchSubscription();

      const token = await user.getIdToken();

      // Prepare content for Shopify
      let contentForShopify = html; // Shopify accepts HTML directly
      
      // Add branding if required
      contentForShopify = appendBrandingToContent(contentForShopify, tier, userBrandingSettings);

      // Extract meta description from current HTML (version-aware)
      const extractMetaDescriptionFromHtml = (htmlContent) => {
        try {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = htmlContent || '';
          const metaSection = tempDiv.querySelector('.meta-description-section p');
          return metaSection ? metaSection.textContent.trim() : null;
        } catch (error) {
          return null;
        }
      };

      const currentMetaDescription = extractMetaDescriptionFromHtml(html);
      const summaryValue = currentMetaDescription || 
                          articleData?.meta_description || 
                          articleData?.metadata?.meta_description || 
                          '';

      const response = await fetch(`${ENV.API.baseUrl}/shopify/publish-direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          storeUrl: shopifyUrl,
          apiKey: shopifyApiKey,
          apiSecret: shopifyApiSecret,
          articleData: {
            title: title || 'Sample Post from Queryfuel',
            body_html: contentForShopify || '<p>Hello from Queryfuel!</p>',
            summary_html: summaryValue
          }
        })
      });

      const result = await response.json();
      console.log('🔍 Shopify API Response:', result); // Debug log
      
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to publish to Shopify');
      }

      // Save Shopify publication info to Firestore
      console.log('🔍 Checking result.url:', result.url); // Debug log
      if (result.url) {
        try {
          const updateData = {
            shopifyUrl: result.url,
            shopifyBlogId: result.blogId || null,
            shopifyArticleId: result.articleId || null,
            shopifyPublishedAt: new Date().toISOString(),
            shopifyStatus: result.status || 'published'
          };

          // Update the article document with Shopify info
          console.log('🔍 Updating article with params:', {
            userId: user.uid,
            articleId: id,
            source: source,
            keywordId: keywordId,
            updateData: updateData
          });
          
          await updateArticle(
            user.uid,
            id,
            updateData,
            source,
            keywordId
          );

          console.log('✅ Shopify publication info saved to Firestore successfully!');
        } catch (saveError) {
          console.error('❌ Failed to save Shopify info to Firestore:', saveError);
          console.error('❌ Save error details:', saveError.message, saveError.stack);
          // Don't fail the whole operation if saving to Firestore fails
        }
      } else {
        console.log('⚠️ No result.url found in Shopify response - cannot save link to Firestore');
      }

      // Show a prominent success banner with link
      setSuccessUrl(result.url || null);
      setInfo('');
      setShopifyError(''); // Clear any Shopify errors on success
      setShowShopifyModal(false);
      setIsShopifyUploading(false);

    } catch (error) {
      console.error('Shopify direct publish error:', error);
      // Extract more meaningful error messages
      let errorMessage = error.message || 'Failed to publish to Shopify';

      // Check for common Shopify errors and provide helpful messages
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'Authentication failed. Please check your API key and secret.';
      } else if (errorMessage.includes('404')) {
        errorMessage = 'Store not found. Please check the store URL.';
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        errorMessage = 'API key does not have sufficient permissions.';
      } else if (errorMessage.includes('CORS') || errorMessage.includes('network')) {
        errorMessage = 'Network error. Please check your store URL and API credentials.';
      }

      setShopifyError(errorMessage); // Set Shopify-specific error
      setIsShopifyUploading(false);
      setInfo(''); // Clear info message on error
      
      // Refund credits on failure
      const creditsRequired = getCreditsRequired();
      if (creditsRequired) {
        try {
          console.log(`🔄 Refunding ${creditsRequired} credits due to Shopify upload failure...`);
          await refundCredits(user.uid, creditsRequired);
          refetchSubscription();
          console.log('✅ Credits refunded successfully');
        } catch (refundError) {
          console.error('Failed to refund credits:', refundError);
        }
      }
      // Keep modal open so user can see error and retry
    }
  };

  // Handler for loading Webflow sites
  const loadWebflowSites = async (apiToken) => {
    if (!apiToken) return;

    setIsLoadingSites(true);
    try {
      const response = await fetch(`${ENV.API.baseUrl}/webflow/sites?apiToken=${encodeURIComponent(apiToken)}`);
      const result = await response.json();

      if (result.success) {
        setWebflowSites(result.sites);
        setWebflowError(''); // Clear any previous errors
      } else {
        setWebflowError(result.error?.message || 'Failed to load sites');
        setWebflowSites([]);
      }
    } catch (error) {
      setWebflowError('Failed to connect to Webflow API');
      setWebflowSites([]);
    }
    setIsLoadingSites(false);
  };

  // Handler for Webflow upload
  const handleWebflowUpload = async () => {
    try {
      setWebflowError(''); // Clear Webflow error
      setInfo('Publishing to Webflow...');
      setIsWebflowUploading(true);

      if (!user) throw new Error('Not authenticated');
      
      // Get credits required based on article source
      const creditsRequired = getCreditsRequired();
      
      // Check if user has enough credits
      if (!validateCredits(creditsRemaining, creditsRequired)) {
        throw new Error(`Insufficient credits. You need ${creditsRequired} credit${creditsRequired > 1 ? 's' : ''} to upload to Webflow. You have ${creditsRemaining || 0} credits remaining.`);
      }

      // Deduct credits atomically before upload
      console.log(`🔒 Attempting atomic credit deduction for Webflow upload (${creditsRequired} credits)...`);
      const creditResult = await deductCreditsAtomic(user.uid, creditsRequired);

      if (!creditResult.success) {
        throw new Error(creditResult.error || 'Failed to deduct credits');
      }

      console.log('✅ Credits deducted successfully, proceeding with Webflow upload...');

      // Refresh subscription data to update UI immediately
      refetchSubscription();

      const token = await user.getIdToken();

      // Prepare content for Webflow
      let contentForWebflow = html; // Webflow accepts HTML directly
      
      // Add branding if required
      contentForWebflow = appendBrandingToContent(contentForWebflow, tier, userBrandingSettings);

      // Extract meta description from current HTML (version-aware)
      const extractMetaDescriptionFromHtml = (htmlContent) => {
        try {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = htmlContent || '';
          const metaSection = tempDiv.querySelector('.meta-description-section p');
          return metaSection ? metaSection.textContent.trim() : null;
        } catch (error) {
          return null;
        }
      };

      const currentMetaDescription = extractMetaDescriptionFromHtml(html);
      const excerptValue = currentMetaDescription || 
                          articleData?.meta_description || 
                          articleData?.metadata?.meta_description || 
                          '';

      const response = await fetch(`${ENV.API.baseUrl}/webflow/publish-direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          apiToken: webflowApiToken,
          siteId: webflowSiteId,
          collectionId: webflowCollectionId,
          articleData: {
            title: title || 'Sample Post from Queryfuel',
            // Send content with multiple field names to increase compatibility
            content: contentForWebflow || '<p>Hello from Queryfuel!</p>',
            body: contentForWebflow || '<p>Hello from Queryfuel!</p>',
            body_html: contentForWebflow || '<p>Hello from Queryfuel!</p>',
            'post-body': contentForWebflow || '<p>Hello from Queryfuel!</p>',
            excerpt: excerptValue,
            summary: excerptValue,
            author: 'QueryFuel'
          }
        })
      });

      const result = await response.json();
      console.log('🔍 Webflow API Response:', result); // Debug log
      
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to publish to Webflow');
      }

      // Save Webflow publication info to Firestore
      console.log('🔍 Checking result.item and result.previewUrl:', { item: result.item, previewUrl: result.previewUrl }); // Debug log
      if (result.item) {
        try {
          const updateData = {
            webflowItemId: result.item.id,
            webflowSiteId: webflowSiteId,
            webflowCollectionId: webflowCollectionId,
            webflowPublishedAt: new Date().toISOString(),
            webflowStatus: 'published',
            webflowPreviewUrl: result.previewUrl || null
          };

          // Update the article document with Webflow info
          console.log('🔍 Updating article with Webflow params:', {
            userId: user.uid,
            articleId: id,
            source: source,
            keywordId: keywordId,
            updateData: updateData
          });
          
          await updateArticle(
            user.uid,
            id,
            updateData,
            source,
            keywordId
          );

          console.log('✅ Webflow publication info saved to Firestore successfully!');
        } catch (saveError) {
          console.error('❌ Failed to save Webflow info to Firestore:', saveError);
          console.error('❌ Save error details:', saveError.message, saveError.stack);
          // Don't fail the whole operation if saving to Firestore fails
        }
      } else {
        console.log('⚠️ No result.item found in Webflow response - cannot save link to Firestore');
      }

      // Show a prominent success banner with link
      setSuccessUrl(result.previewUrl || null);
      setInfo('');
      setWebflowError(''); // Clear any Webflow errors on success
      setShowWebflowModal(false);
      setIsWebflowUploading(false);

    } catch (error) {
      console.error('Webflow direct publish error:', error);
      // Extract more meaningful error messages
      let errorMessage = error.message || 'Failed to publish to Webflow';

      // Check for common Webflow errors and provide helpful messages
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'Authentication failed. Please check your API token.';
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        errorMessage = 'API token does not have sufficient permissions.';
      } else if (errorMessage.includes('404')) {
        errorMessage = 'Site or collection not found. Please check your selections.';
      } else if (errorMessage.includes('CORS') || errorMessage.includes('network')) {
        errorMessage = 'Network error. Please check your API token and try again.';
      }

      setWebflowError(errorMessage); // Set Webflow-specific error
      setIsWebflowUploading(false);
      setInfo(''); // Clear info message on error
      
      // Refund credits on failure
      const creditsRequired = getCreditsRequired();
      if (creditsRequired) {
        try {
          console.log(`🔄 Refunding ${creditsRequired} credits due to Webflow upload failure...`);
          await refundCredits(user.uid, creditsRequired);
          refetchSubscription();
          console.log('✅ Credits refunded successfully');
        } catch (refundError) {
          console.error('Failed to refund credits:', refundError);
        }
      }
      // Keep modal open so user can see error and retry
    }
  };

  // Lock background scroll when modals are open
  useEffect(() => {
    if (showWpModal || showShopifyModal || showWebflowModal || versioningState.showVersionModal || showImageModal || showImageGenerationModal || showGoogleDocsModal || showWpCreditConfirmation || showGoogleDocsCreditConfirmation || showCreditErrorModal || showSaveConnectionModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [showWpModal, showShopifyModal, showWebflowModal, versioningState.showVersionModal, showImageModal, showImageGenerationModal, showGoogleDocsModal, showWpCreditConfirmation, showGoogleDocsCreditConfirmation, showSaveConnectionModal]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showActionsMenu && !event.target.closest('.actions-dropdown-container')) {
        setShowActionsMenu(false);
      }
      if (showUploadMenu && !event.target.closest('.upload-dropdown-container')) {
        setShowUploadMenu(false);
      }
    };

    if (showActionsMenu || showUploadMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showActionsMenu, showUploadMenu]);


  useEffect(() => {
    if (!user || !id) return;
    let mounted = true;
    (async () => {
      try {
        const json = await getUnifiedArticleContent(user.uid, { id, source, keywordId });
        if (!json) throw new Error('Article not found');

        // Debug logging to trace title
        console.log('View page - loaded json:', {
          rootTitle: json.title,
          jsonContentTitle: json.jsonContent?.title,
          dataTitle: json.data?.title,
          keyword: json.keyword
        });

        const base = (json && json.data && typeof json.data === 'object' && Object.keys(json.data).length)
          ? json.data
          : json;

        // Check root-level title first (saved from edit page), then fallback to other locations
        const computedTitle =
          json.title ||  // Root-level title (saved from edit page)
          base.title ||
          json.googleDocs?.documentTitle ||
          base.keyword ||
          base._keyword ||
          'Article';

        // First check if there's saved HTML content from the editor
        const savedHtmlContent = base.htmlContent || json.htmlContent || null;

        const hasConvertible = Boolean(
          (Array.isArray(base.key_takeaways) && base.key_takeaways.length) ||
          base.intro_md ||
          (Array.isArray(base.tables) && base.tables.length) ||
          (base.checklists && (Array.isArray(base.checklists.launch) || Array.isArray(base.checklists.post_contest))) ||
          (Array.isArray(base.toc) && base.toc.length) ||
          (Array.isArray(base.faqs) && base.faqs.length)
        );

        // Load custom section order from localStorage
        let sectionOrder = getDefaultSectionOrder();
        try {
          const saved = localStorage.getItem('queryfuel_section_order');
          if (saved) {
            sectionOrder = JSON.parse(saved);
          }
        } catch (e) {
          console.warn('Failed to load section order:', e);
        }

        // Use saved HTML if available, otherwise convert from JSON
        let htmlString = savedHtmlContent
          ? savedHtmlContent
          : (hasConvertible
            ? convertJsonToGutenbergHtml(base, sectionOrder)
            : '<div class="article-container"><p>No HTML-renderable content was found for this article. If this is a legacy interview article, open it via the Interview Generator to edit or export.</p></div>');

        // Hide real-results class for all articles
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlString;
        const realResultsElements = tempDiv.querySelectorAll('.real-results');
        realResultsElements.forEach(element => {
          element.style.display = 'none';
        });
        htmlString = tempDiv.innerHTML;

        if (mounted) {
          setTitle(computedTitle);
          setHtml(htmlString);
          // Preserve _source and meta_description from top-level json too
          const mergedData = { ...base };
          if (json._source && !mergedData._source) {
            mergedData._source = json._source;
          }
          
          // PRIORITY: Use saved meta_description from edit page first, then fallback to original
          // This ensures edited meta descriptions are used for WordPress excerpt
          if (json.meta_description) {
            // Use the saved meta_description from the edit page (highest priority)
            mergedData.meta_description = json.meta_description;
          } else if (!mergedData.meta_description) {
            // Fallback to original meta_description if no saved version
            mergedData.meta_description = json.meta_description || (json.metadata && json.metadata.meta_description);
          }
          
          // Also preserve the metadata object if it exists
          if (!mergedData.metadata && json.metadata) {
            mergedData.metadata = json.metadata;
          }
          
          // ✅ CRITICAL: Preserve videos from root-level json
          if (json.videos) {
            mergedData.videos = json.videos;
            console.log('✅ Preserved videos from json to mergedData:', json.videos);
          }
          
          setArticleData(mergedData); // Store the full article data for publishing logic

          // Extract brand voice data if available
          if (mergedData.brandVoice) {
            setBrandVoiceData(mergedData.brandVoice);
          }

          // Debug: Check what we received
          console.log('🔍 Article data received:', {
            hasVideos: !!mergedData.videos,
            videosKeys: mergedData.videos ? Object.keys(mergedData.videos) : [],
            videos: mergedData.videos,
            hasjsonContentVideos: !!json.videos,
            hasBaseVideos: !!base.videos
          });
          
          // Load existing FAQ videos if available
          if (mergedData.videos) {
            console.log('📹 Loading videos from article document:', mergedData.videos);
            setFaqVideos(mergedData.videos);
          }

          // Check if this is restored content
          if (base.restoredFromVersion) {
            versioningActions.setRestoredInfo({
              version: base.restoredFromVersion,
              restoredAt: base.restoredAt
            });
          }

          if (!hasConvertible && !base.htmlContent) {
            setInfo('No HTML-renderable content found. This may be a legacy interview article.');
          } else {
            setInfo('');
          }
        }
      } catch (e) {
        if (mounted) setError(e?.message || 'Failed to load article');
      }
    })();
    return () => { mounted = false; };
  }, [user, id, source, keywordId]);

  // Auto-generation effect
  useEffect(() => {
    // Only attempt auto-generation if:
    // 1. User is authenticated
    // 2. Article is loaded (has title and html)
    // 3. No existing image detected
    // 4. Auto-generation is enabled
    // 5. Not already attempted
    // 6. Not currently generating an image

    if (
      autoGenerationEnabled &&
      user &&
      id &&
      title &&
      html &&
      !hasExistingImage() &&
      !autoGenerationAttempted &&
      !isGeneratingImage
    ) {
      console.log('Auto-generating image for article:', title);
      setAutoGenerationAttempted(true);

      // Small delay to allow UI to settle
      setTimeout(() => {
        handleGenerateImage(true); // Pass true for auto-generation
      }, 1000);
    }
  }, [user, id, title, html, autoGenerationAttempted, autoGenerationEnabled, isGeneratingImage]);

  // Note: Video generation is now handled via the top button + modal
  // No need for separate mounting logic

  // Simulate progress for active video generations (OPTIMIZED)
  useEffect(() => {
    // Only run if there are processing videos
    if (processingVideoCount === 0) return;

    const interval = setInterval(() => {
      setActiveVideoGenerations(prev => {
        // Check if we still have processing videos
        const stillProcessing = prev.some(g => g.status === 'processing');
        if (!stillProcessing) return prev;
        
        return prev.map(gen => {
          if (gen.status !== 'processing') return gen;

          // Calculate elapsed time in seconds
          const elapsedSeconds = (Date.now() - gen.startTime) / 1000;
          
          // Simulate realistic progress (slower at the end)
          let newProgress = gen.progress;
          
          if (elapsedSeconds < 10) {
            newProgress = Math.min((elapsedSeconds / 10) * 30, 30);
          } else if (elapsedSeconds < 40) {
            newProgress = 30 + Math.min(((elapsedSeconds - 10) / 30) * 40, 40);
          } else if (elapsedSeconds < 80) {
            newProgress = 70 + Math.min(((elapsedSeconds - 40) / 40) * 25, 25);
          } else {
            newProgress = Math.min(95 + ((elapsedSeconds - 80) / 20) * 4, 99);
          }

          return { ...gen, progress: Math.round(newProgress) };
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [processingVideoCount]);

  // Initialize activeVideoGenerations ONCE from localStorage and faqVideos
  useEffect(() => {
    if (!id || !user || videoGenerationsInitialized.current) return;
    
    const initializeGenerations = async () => {
      try {
        // Load from localStorage
        const storageKey = `video_generations_${user.uid}_${id}`;
        const saved = localStorage.getItem(storageKey);
        
        if (saved) {
          const savedGenerations = JSON.parse(saved);
          setActiveVideoGenerations(savedGenerations);
        }
        
        videoGenerationsInitialized.current = true;
      } catch (error) {
        console.error('Failed to load video generations:', error);
        videoGenerationsInitialized.current = true;
      }
    };
    
    initializeGenerations();
  }, [id, user?.uid]);

  // Populate with completed videos from faqVideos (separate effect, runs when faqVideos loads)
  useEffect(() => {
    if (!videoGenerationsInitialized.current || Object.keys(faqVideos).length === 0) return;
    
    // Only run once when faqVideos first loads
    const hasProcessingVideos = activeVideoGenerations.some(g => g.status === 'processing');
    if (activeVideoGenerations.length > 0 && !hasProcessingVideos) return; // Already populated
    
    try {
      const extractedFAQs = extractFAQsFromArticle();
      const completedVideos = Object.entries(faqVideos)
        .filter(([faqId, videoData]) => videoData?.videoUrl || videoData?.status === 'completed')
        .map(([faqId, videoData]) => {
          const faq = extractedFAQs.find(f => f.id === faqId);
          return {
            faqId,
            faqQuestion: faq?.question || 'FAQ Question',
            progress: 100,
            status: 'completed',
            startTime: new Date(videoData.generatedAt || Date.now()).getTime(),
            videoId: videoData.heygenVideoId || videoData.videoId
          };
        });
      
      if (completedVideos.length > 0) {
        setActiveVideoGenerations(prev => {
          // Merge, avoiding duplicates
          const existingIds = new Set(prev.map(g => g.faqId));
          const newVideos = completedVideos.filter(v => !existingIds.has(v.faqId));
          if (newVideos.length === 0) return prev; // No changes
          return [...prev, ...newVideos];
        });
      }
    } catch (error) {
      console.error('Failed to populate completed videos:', error);
    }
  }, [faqVideos]); // Only when faqVideos changes

  // ✅ CACHE: Preload completed videos for offline access
  useEffect(() => {
    if (Object.keys(faqVideos).length === 0) return;
    
    const preloadCompletedVideos = async () => {
      const completedVideoUrls = Object.values(faqVideos)
        .filter(videoData => videoData?.videoUrl && videoData?.status === 'completed')
        .map(videoData => videoData.videoUrl);
      
      if (completedVideoUrls.length > 0) {
        console.log(`📦 Preloading ${completedVideoUrls.length} completed videos for cache...`);
        
        // Preload in background (don't wait)
        completedVideoUrls.forEach(url => {
          preloadVideo(url).catch(err => 
            console.warn('Failed to preload video:', url, err)
          );
        });
      }
    };
    
    preloadCompletedVideos();
  }, [Object.keys(faqVideos).length]); // Only when new videos are added

  // Debounced save to localStorage (saves max once every 2 seconds)
  useEffect(() => {
    if (!id || !user || activeVideoGenerations.length === 0) return;
    
    const now = Date.now();
    const timeSinceLastSave = now - lastLocalStorageSave.current;
    
    // If less than 2 seconds since last save, debounce
    if (timeSinceLastSave < 2000) {
      const timer = setTimeout(() => {
        try {
          const storageKey = `video_generations_${user.uid}_${id}`;
          localStorage.setItem(storageKey, JSON.stringify(activeVideoGenerations));
          lastLocalStorageSave.current = Date.now();
        } catch (error) {
          console.error('Failed to save video generations:', error);
        }
      }, 2000 - timeSinceLastSave);
      
      return () => clearTimeout(timer);
    } else {
      // Save immediately if enough time has passed
      try {
        const storageKey = `video_generations_${user.uid}_${id}`;
        localStorage.setItem(storageKey, JSON.stringify(activeVideoGenerations));
        lastLocalStorageSave.current = now;
      } catch (error) {
        console.error('Failed to save video generations:', error);
      }
    }
  }, [activeVideoGenerations, id, user?.uid]);

  // Check for completed videos and update status (OPTIMIZED)
  useEffect(() => {
    // Only check if there are processing videos
    if (processingVideoCount === 0) return;

    const checkCompletion = () => {
      setActiveVideoGenerations(prev => {
        let hasChanges = false;
        const updated = prev.map(gen => {
          if (gen.status !== 'processing') return gen;

          // Check if this FAQ has a completed video in faqVideos
          const videoData = faqVideos[gen.faqId];
          if (videoData?.videoUrl || videoData?.status === 'completed') {
            hasChanges = true;
            console.log('✅ Video completed for FAQ:', gen.faqId);
            return {
              ...gen,
              progress: 100,
              status: 'completed'
            };
          }
          
          return gen;
        });
        
        // Only update if there are actual changes
        return hasChanges ? updated : prev;
      });
    };

    // Check every 10 seconds (reduced frequency for better performance)
    const interval = setInterval(checkCompletion, 10000);
    checkCompletion(); // Check immediately

    return () => clearInterval(interval);
  }, [faqVideos, processingVideoCount]);

  // Load user branding settings
  useEffect(() => {
    if (user && tier) {
      // Load branding settings from localStorage (in a real app, this would be Firestore)
      try {
        const saved = localStorage.getItem(`branding_settings_${user.uid}`);
        if (saved) {
          const settings = JSON.parse(saved);
          setUserBrandingSettings(settings);
        } else {
          // Set default based on tier
          const defaultSetting = tier?.toLowerCase() === 'agency custom' || 
                                 tier?.toLowerCase() === 'agency';
          setUserBrandingSettings({ showBranding: defaultSetting });
        }
      } catch (error) {
        console.error('Failed to load branding settings:', error);
        // Set default based on tier
        const defaultSetting = tier?.toLowerCase() === 'agency custom' || 
                               tier?.toLowerCase() === 'agency';
        setUserBrandingSettings({ showBranding: defaultSetting });
      }
    }
  }, [user, tier]);

  // Branding preview effect - now uses user settings
  useEffect(() => {
    if (tier) {
      const preview = getBrandingPreview(tier, userBrandingSettings);
      setBrandingPreview(preview);
    }
  }, [tier, userBrandingSettings]);

  // Function to toggle branding settings
  const handleToggleBranding = async (enabled) => {
    if (!user || !tier) return;
    
    // Check if user can control branding
    const canControlBranding = ['growth', 'scale', 'agency custom', 'agency'].includes(tier.toLowerCase());
    if (!canControlBranding) return;

    setSavingBrandingSettings(true);
    try {
      const newSettings = { ...userBrandingSettings, showBranding: enabled };
      
      // Save to localStorage (in a real app, this would be Firestore)
      localStorage.setItem(`branding_settings_${user.uid}`, JSON.stringify(newSettings));
      
      setUserBrandingSettings(newSettings);
      
      // TODO: In a real implementation, save to Firestore user settings
      // await updateUserSettings(user.uid, { branding: newSettings });
      
    } catch (error) {
      console.error('Failed to save branding settings:', error);
    } finally {
      setSavingBrandingSettings(false);
    }
  };

  // Handler for FAQ video generation completion
  const handleVideoGenerated = async (faqId, videoData) => {
    const updatedVideos = {
      ...faqVideos,
      [faqId]: videoData
    };
    setFaqVideos(updatedVideos);
    console.log('📹 Video generated for FAQ:', faqId, videoData);

    // ✅ NEW: Inject video into HTML when completed
    if (videoData.status === 'completed' && videoData.videoUrl) {
      try {
        await injectVideoIntoFAQ(faqId, videoData);
        console.log('✅ Video successfully injected into article HTML');
        return; // Return early since injectVideoIntoFAQ already saves to Firestore
      } catch (error) {
        console.error('❌ Failed to inject video into HTML:', error);
        // Continue to fallback save below
      }
    }

    // Save to Firestore for persistence (fallback if injection fails or video not complete)
    try {
      console.log('💾 Saving video data to Firestore...', {
        userId: user.uid,
        articleId: id,
        source,
        keywordId,
        updatedVideos
      });
      
      const { updateArticle } = await import('../../../../services/articleService');
      await updateArticle(
        user.uid,
        id,
        {
          videos: updatedVideos,
          lastModified: new Date().toISOString()
        },
        source,
        keywordId
      );
      console.log('✅ Video data saved to article Firestore document');
    } catch (error) {
      console.error('❌ Failed to save video data to Firestore:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      // Don't throw - video still works in current session
    }
  };

  // Extract FAQs from article content (MEMOIZED for performance)
  const extractFAQsFromArticle = useMemo(() => () => {
    // Check multiple possible locations for FAQs
    let faqs = [];
    
    // Check jsonContent.faqs first
    if (articleData?.jsonContent?.faqs && Array.isArray(articleData.jsonContent.faqs)) {
      faqs = articleData.jsonContent.faqs;
    }
    // Check direct faqs property
    else if (articleData?.faqs && Array.isArray(articleData.faqs)) {
      faqs = articleData.faqs;
    }
    // Check if FAQs are in the HTML content
    else if (html && html.includes('faq')) {
      // Try to extract FAQs from HTML structure
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      const faqElements = tempDiv.querySelectorAll('h3, h4, h5, h6');
      const extractedFaqs = [];
      
      faqElements.forEach((element, index) => {
        const question = element.textContent?.trim();
        if (question && (question.includes('?') || question.toLowerCase().includes('what') || question.toLowerCase().includes('how') || question.toLowerCase().includes('why'))) {
          // Try to find the answer in the next sibling elements
          let answer = '';
          let nextElement = element.nextElementSibling;
          while (nextElement && !['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(nextElement.tagName)) {
            if (nextElement.textContent?.trim()) {
              answer += nextElement.textContent.trim() + ' ';
            }
            nextElement = nextElement.nextElementSibling;
            if (answer.length > 500) break; // Limit answer length
          }
          
          if (answer.trim()) {
            extractedFaqs.push({
              id: `extracted-faq-${index + 1}`,
              question: question,
              answer: answer.trim()
            });
          }
        }
      });
      
      faqs = extractedFaqs;
    }
    
    // If still no FAQs found, create some sample ones for testing
    if (faqs.length === 0 && title) {
      faqs = [
        {
          id: 'sample-faq-1',
          question: `What is ${title.split(' ').slice(0, 3).join(' ')}?`,
          answer: `This article covers the key aspects and important information about ${title.toLowerCase()}. It provides comprehensive insights and practical guidance on the topic.`
        },
        {
          id: 'sample-faq-2', 
          question: `How can I learn more about this topic?`,
          answer: `You can explore the detailed content in this article, which covers various aspects and provides actionable insights. The information is designed to help you understand and apply the concepts effectively.`
        }
      ];
    }
    
    return faqs.map((faq, index) => ({
      ...faq,
      id: faq.id || `faq-${index}` // Use 0-based indexing to match HTML IDs
    }));
  }, [articleData, html, title]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>;
  if (!user) return null;
  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h3>Failed to load</h3>
        <p>{error}</p>
        <button className={styles.secondaryButton} onClick={() => router.back()}>Go Back</button>
      </div>
    );
  }


  return (
    <div className={styles.generationPage} style={{ padding: 0 }}>
      <div style={{ width: '100%', margin: 0, padding: 0 }}>
        <div className={styles.generationCard} style={{ width: '100%', maxWidth: 'none', borderRadius: 0, margin: 0 }}>
          {/* Restored Version Banner */}
          {versioningState.restoredInfo && (
            <div
              style={{
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                color: '#fff',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '2px solid rgba(139, 92, 246, 0.3)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span>Viewing restored Version {versioningState.restoredInfo.version}</span>
                <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  • Edit and save to create a new version
                </span>
              </div>
              <button
                onClick={() => versioningActions.setRestoredInfo(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  opacity: 0.8
                }}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )}
          
          {/* Top Success Banner */}
          {successUrl && (
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                background: 'linear-gradient(90deg, #16a34a, #22c55e)',
                color: '#fff',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
              role="status"
              aria-live="polite"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
                <span>Published successfully!</span>
                <a
                  href={successUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: '#064e3b',
                    background: '#ecfdf5',
                    padding: '0.35rem 0.6rem',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontWeight: 700
                  }}
                >
                  Open Post
                </a>
              </div>
              <button
                onClick={() => setSuccessUrl(null)}
                aria-label="Dismiss success message"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
          )}
          <div id="top" className={styles.previewHeader}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <h1 className={styles.articleTitle} style={{ margin: 0, flex: 1 }}>{title}</h1>
              
              {/* Brand Voice Info Button */}
              {brandVoiceData && (
                <button
                  onClick={() => setShowBrandVoiceInfo(!showBrandVoiceInfo)}
                  className={styles.secondaryButton}
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.75rem',
                    background: brandVoiceData.enabled ? 'rgba(147, 51, 234, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                    border: `1px solid ${brandVoiceData.enabled ? 'rgba(147, 51, 234, 0.3)' : 'rgba(156, 163, 175, 0.3)'}`,
                    color: brandVoiceData.enabled ? '#7c3aed' : '#6b7280',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginLeft: '1rem'
                  }}
                  title={brandVoiceData.enabled ? 'View brand voice settings used for this article' : 'Brand voice was disabled for this article'}
                >
                  <span style={{ fontSize: '0.875rem' }}>🎨</span>
                  Brand Voice
                  {brandVoiceData.enabled && (
                    <span style={{ 
                      background: '#7c3aed', 
                      color: 'white', 
                      borderRadius: '50%', 
                      width: '6px', 
                      height: '6px',
                      display: 'inline-block'
                    }} />
                  )}
                </button>
              )}
            </div>

            {/* Brand Voice Info Panel */}
            {showBrandVoiceInfo && brandVoiceData && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                background: 'rgba(147, 51, 234, 0.02)',
                border: '1px solid rgba(147, 51, 234, 0.15)',
                borderRadius: '8px'
              }}>
                <BrandVoicePreview 
                  brandVoice={brandVoiceData} 
                  showTitle={false}
                  compact={false}
                />
              </div>
            )}
            
            <div className={styles.previewActions} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {/* Upload Article Dropdown */}
              <div className="upload-dropdown-container" style={{ position: 'relative' }}>
                <button
                  className={styles.primaryButton}
                  type="button"
                  title="Upload this article to various platforms"
                  onClick={() => setShowUploadMenu(!showUploadMenu)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    background: 'linear-gradient(135deg, #00D4FF 0%, #00A8CC 100%)',
                    color: '#0A0E27',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 15px rgba(0, 212, 255, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 25px rgba(0, 212, 255, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 15px rgba(0, 212, 255, 0.3)';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Upload Article
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      transform: showUploadMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {/* Upload Dropdown Menu */}
                {showUploadMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '0.5rem',
                      background: 'rgba(13, 17, 23, 0.95)',
                      border: '1px solid rgba(0, 212, 255, 0.1)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                      minWidth: '220px',
                      zIndex: 100,
                      overflow: 'hidden',
                      backdropFilter: 'blur(20px)'
                    }}
                  >
                    <div style={{ padding: '0.5rem 0' }}>
                      {/* WordPress Option */}
                      <button
                        onClick={() => {
                          setShowUploadMenu(false);
                          setShowWpModal(true);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          fontSize: '0.875rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(0, 212, 255, 0.1)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          background: 'linear-gradient(135deg, #00D4FF 0%, #00A8CC 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0A0E27' }}>W</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', marginBottom: '0.125rem' }}>WordPress</div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Upload to WordPress site</div>
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          background: 'rgba(255, 193, 7, 0.2)',
                          color: '#FFC107',
                          padding: '0.125rem 0.375rem',
                          borderRadius: '3px',
                          fontWeight: '600'
                        }}>
                          {getCreditsRequired()} Credit{getCreditsRequired() > 1 ? 's' : ''}
                        </div>
                      </button>

                      {/* Shopify Option */}
                      <button
                        onClick={() => {
                          setShowUploadMenu(false);
                          setShowShopifyModal(true);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          fontSize: '0.875rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(150, 201, 61, 0.1)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          background: 'linear-gradient(135deg, #96c93d 0%, #00a046 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>S</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', marginBottom: '0.125rem' }}>Shopify</div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Upload to Shopify blog</div>
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          background: 'rgba(255, 193, 7, 0.2)',
                          color: '#FFC107',
                          padding: '0.125rem 0.375rem',
                          borderRadius: '3px',
                          fontWeight: '600'
                        }}>
                          {getCreditsRequired()} Credit{getCreditsRequired() > 1 ? 's' : ''}
                        </div>
                      </button>

                      {/* Webflow Option */}
                      <button
                        onClick={() => {
                          setShowUploadMenu(false);
                          setShowWebflowModal(true);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          fontSize: '0.875rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(67, 83, 255, 0.1)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          background: 'linear-gradient(135deg, #4353ff 0%, #00d4ff 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>W</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', marginBottom: '0.125rem' }}>Webflow</div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Upload to Webflow CMS</div>
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          background: 'rgba(255, 193, 7, 0.2)',
                          color: '#FFC107',
                          padding: '0.125rem 0.375rem',
                          borderRadius: '3px',
                          fontWeight: '600'
                        }}>
                          {getCreditsRequired()} Credit{getCreditsRequired() > 1 ? 's' : ''}
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Insert Section Images Button */}
              <button
                className={styles.primaryButton}
                type="button"
                title="Insert images into different sections of your article"
                onClick={() => setShowInjectImagesModal(true)}
                disabled={isInjectingImages}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  background: isInjectingImages ? 'rgba(103, 58, 183, 0.3)' : 'linear-gradient(135deg, #673ab7 0%, #9c27b0 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: isInjectingImages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: isInjectingImages ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 15px rgba(103, 58, 183, 0.3)'
                }}
                onMouseOver={(e) => {
                  if (!isInjectingImages) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 25px rgba(103, 58, 183, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 15px rgba(103, 58, 183, 0.3)';
                }}
              >
                {isInjectingImages ? (
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                    Inserting...
                  </span>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    Insert Section Images
                  </>
                )}
              </button>

              {/* Generate Video Button */}
              <button
                onClick={() => setShowVideoModal(true)}
                disabled={isGeneratingVideo || !articleData?.faqs || articleData.faqs.length === 0}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  background: isGeneratingVideo ? 'rgba(128, 90, 213, 0.3)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isGeneratingVideo ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  opacity: isGeneratingVideo ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {isGeneratingVideo ? (
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                    Generating Video...
                  </span>
                ) : (
                  'Generate FAQ Video'
                )}
              </button>
              
              {/* Actions Dropdown Menu */}
              <div className="actions-dropdown-container" style={{ position: 'relative' }}>
                <button
                  className={styles.primaryButton}
                  type="button"
                  title="More actions"
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    background: 'rgba(13, 17, 23, 0.8)',
                    color: '#00D4FF',
                    border: '1px solid rgba(0, 212, 255, 0.2)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = 'rgba(0, 212, 255, 0.1)';
                    e.target.style.borderColor = '#00D4FF';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(13, 17, 23, 0.8)';
                    e.target.style.borderColor = 'rgba(0, 212, 255, 0.2)';
                  }}
                >
                  <span>Actions</span>
                  <svg 
                    width="12" 
                    height="12" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    style={{ 
                      transform: showActionsMenu ? 'rotate(180deg)' : 'rotate(0deg)', 
                      transition: 'transform 0.2s' 
                    }}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                
                {/* Dropdown Menu */}
                {showActionsMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '0.5rem',
                      background: 'rgba(13, 17, 23, 0.95)',
                      border: '1px solid rgba(0, 212, 255, 0.1)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                      minWidth: '200px',
                      zIndex: 100,
                      overflow: 'hidden',
                      backdropFilter: 'blur(20px)'
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        // Navigate to the new edit page with proper parameters
                        router.push(`/dashboard/articles/edit?id=${encodeURIComponent(id)}&source=${encodeURIComponent(source)}${keywordId ? `&keywordId=${encodeURIComponent(keywordId)}` : ''}`);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        fontSize: '0.875rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'rgba(99, 102, 241, 0.2)'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      <span>Edit Article</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        // Check credits before showing confirmation
                        const creditsRequired = 1;
                        if (!validateCredits(creditsRemaining, creditsRequired)) {
                          setCreditErrorMessage(`Insufficient credits. You need ${creditsRequired} credit${creditsRequired > 1 ? 's' : ''} to convert to Google Docs. You have ${creditsRemaining || 0} credits remaining.`);
                          setShowCreditErrorModal(true);
                          return;
                        }
                        setShowGoogleDocsCreditConfirmation(true);
                      }}
                      disabled={isConvertingToDocs}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        background: 'transparent',
                        border: 'none',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        color: isConvertingToDocs ? '#888' : '#fff',
                        fontSize: '0.875rem',
                        textAlign: 'left',
                        cursor: isConvertingToDocs ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => !isConvertingToDocs && (e.target.style.background = 'rgba(76, 175, 80, 0.2)')}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      {isConvertingToDocs ? (
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid rgba(76, 175, 80, 0.3)',
                          borderTop: '2px solid #4CAF50',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <path d="M12 11v6"/>
                          <path d="M9 14h6"/>
                        </svg>
                      )}
                      <span>{isConvertingToDocs ? 'Converting...' : 'Convert to Google Docs'}</span>
                      <div style={{
                        fontSize: '0.75rem',
                        background: 'rgba(255, 193, 7, 0.2)',
                        color: '#FFC107',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '3px',
                        fontWeight: '600'
                      }}>
                        1 Credit
                      </div>
                    </button>
                    
                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <button
                        onClick={() => {
                          handleShowVersions();
                        }}
                        disabled={versioningState.loadingVersions}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          fontSize: '0.875rem',
                          textAlign: 'left',
                          cursor: versioningState.loadingVersions ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => !versioningState.loadingVersions && (e.target.style.background = 'rgba(156, 163, 175, 0.2)')}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >
                        {versioningState.loadingVersions ? (
                          <div style={{
                            width: '16px',
                            height: '16px',
                            border: '2px solid rgba(0, 212, 255, 0.3)',
                            borderTop: '2px solid #00D4FF',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }} />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v20M2 12h20"/>
                            <path d="M5 19l7-7 7 7M5 5l7 7 7-7"/>
                          </svg>
                        )}
                        <span>{versioningState.loadingVersions ? 'Loading...' : 'Version History'}</span>
                      </button>
                      

                    </div>
                  </div>
                )}
              </div>
              
              <button
                className={styles.secondaryButton}
                onClick={() => {
                  console.time('Back to Articles Navigation');
                  console.log('Starting navigation to /dashboard/articles');
                  router.push('/dashboard/articles');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem'
                }}
              >
                ← Back to Articles
              </button>
            </div>
          </div>

          <div className={styles.previewContent} style={{ maxHeight: 'none', overflow: 'visible', background: '#fff', borderRadius: '8px', padding: '1rem' }}>
            {/* Global styles for article content */}
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              .article-featured-image {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                margin: 2rem 0;
                text-align: left !important; /* Changed from center to left */
                width: 100%;
              }
              .article-featured-image > div:first-child {
                /* The image container itself can be centered */
                margin: 0 auto;
              }
              .article-featured-image p {
                /* Caption can be centered */
                text-align: center;
              }
              .article-featured-image img {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                max-width: 100%;
                height: auto;
                margin: 0 auto;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              .article-container img {
                max-width: 100%;
                height: auto;
              }
              @keyframes docsModalSpin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              @keyframes docsModalPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
              @keyframes docsModalSlide {
                from { transform: translateX(-100%); }
                to { transform: translateX(300%); }
              }
            ` }} />
            
            {/* Render converted Gutenberg HTML with embedded FAQ Videos */}
            <div style={{ textAlign: 'left' }}>
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
            
            {/* Author Bio Preview */}
            <div style={{ marginTop: '3rem', marginBottom: '2rem', textAlign: 'left' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#000', margin: '0 0 1.5rem 0', textAlign: 'left' }}>
                Author Bio
              </h2>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', textAlign: 'left' }}>
                <img
                  src={previewBioImage}
                  alt={previewAuthorName}
                  style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div
                    style={{ color: '#000', fontSize: '1rem', lineHeight: 1.8, margin: 0, textAlign: 'left' }}
                    dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
                  />
                </div>
              </div>
            </div>

            {info && (
              <div style={{ marginTop: '1rem', color: '#555' }}>{info}</div>
            )}
          </div>
          {/* Google Docs Modal (with loading state) */}
          {showGoogleDocsModal && typeof window !== 'undefined' && createPortal(
            (
              <div className={styles.modalOverlay} onClick={() => {
                setShowGoogleDocsModal(false);
                setGoogleDocsError(null);
              }} style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(5px)'
              }}>
                <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
                  background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)',
                  border: '1px solid rgba(76, 175, 80, 0.3)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  maxWidth: '500px',
                  width: '90%'
                }}>
                  <div className={styles.modalHeader} style={{
                    borderBottom: '1px solid rgba(76, 175, 80, 0.2)',
                    paddingBottom: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <h3 className={styles.modalTitle} style={{
                      color: isConvertingToDocs ? '#FFA500' :
                             googleDocsError ? '#ff6b6b' : '#4CAF50',
                      fontSize: '1.5rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      {isConvertingToDocs ? (
                        <>Converting to Google Docs...</>
                      ) : googleDocsError ? (
                        <>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                          </svg>
                          Conversion Failed
                        </>
                      ) : (
                        <>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 11l3 3L22 4"/>
                            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                          </svg>
                          Google Doc Created Successfully!
                        </>
                      )}
                    </h3>
                    <button 
                      className={styles.secondaryButton} 
                      onClick={() => {
                        setShowGoogleDocsModal(false);
                        setIsConvertingToDocs(false);
                        setGoogleDocsError(null);
                      }}
                      disabled={isConvertingToDocs}
                      style={{
                        background: 'rgba(76, 175, 80, 0.1)',
                        border: '1px solid rgba(76, 175, 80, 0.3)',
                        color: '#4CAF50',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        cursor: isConvertingToDocs ? 'not-allowed' : 'pointer',
                        opacity: isConvertingToDocs ? 0.5 : 1,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => !isConvertingToDocs && (e.target.style.background = 'rgba(76, 175, 80, 0.2)')}
                      onMouseLeave={(e) => (e.target.style.background = 'rgba(76, 175, 80, 0.1)')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                  
                  <div className={styles.modalBody}>
                    {isConvertingToDocs ? (
                      // Loading state
                      <div style={{
                        padding: '2rem',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1.5rem'
                      }}>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          position: 'relative'
                        }}>
                          <div style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            border: '4px solid transparent',
                            borderTop: '4px solid #4CAF50',
                            borderRadius: '50%',
                            animation: 'docsModalSpin 1.2s linear infinite'
                          }} />
                        </div>
                        
                        <div>
                          <p style={{
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            color: '#fff',
                            marginBottom: '0.75rem'
                          }}>
                            Creating your Google Doc
                          </p>
                          <p style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.7)',
                            animation: 'docsModalPulse 2s ease-in-out infinite'
                          }}>
                            This may take a few moments...
                          </p>
                        </div>
                      </div>
                    ) : googleDocsError ? (
                      // Error state
                      <div style={{
                        padding: '2rem',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1.5rem'
                      }}>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.1) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <span style={{ fontSize: '20px', fontWeight: 'bold' }}>FAILED</span>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                          <p style={{
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            color: '#ff6b6b',
                            marginBottom: '0.75rem'
                          }}>
                            Conversion Failed
                          </p>
                          <p style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.7)',
                            marginBottom: '2rem',
                            lineHeight: '1.5',
                            maxWidth: '300px',
                            marginLeft: 'auto',
                            marginRight: 'auto'
                          }}>
                            {googleDocsError.message}
                          </p>
                        </div>

                        <div style={{
                          display: 'flex',
                          gap: '1rem',
                          justifyContent: 'center'
                        }}>
                          <button
                            onClick={handleRetryGoogleDocsConversion}
                            disabled={isConvertingToDocs}
                            style={{
                              padding: '0.75rem 1.5rem',
                              background: 'linear-gradient(135deg, #00D4FF 0%, #0095CC 100%)',
                              border: 'none',
                              color: 'white',
                              borderRadius: '6px',
                              fontWeight: '600',
                              cursor: isConvertingToDocs ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              opacity: isConvertingToDocs ? 0.6 : 1,
                              boxShadow: '0 4px 15px rgba(0, 212, 255, 0.3)'
                            }}
                            onMouseEnter={(e) => !isConvertingToDocs && (e.target.style.transform = 'translateY(-2px)')}
                            onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="23 4 23 10 17 10"/>
                              <polyline points="1 20 1 14 7 14"/>
                              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                            </svg>
                            Try Again
                          </button>

                          <button
                            onClick={() => {
                              setShowGoogleDocsModal(false);
                              setGoogleDocsError(null);
                            }}
                            style={{
                              padding: '0.75rem 1.5rem',
                              background: 'transparent',
                              border: '1px solid rgba(0, 212, 255, 0.3)',
                              color: '#00D4FF',
                              borderRadius: '6px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => (e.target.style.background = 'rgba(0, 212, 255, 0.1)')}
                            onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    ) : googleDocsData ? (
                      // Success state with data
                      <>
                        <div style={{
                          background: 'rgba(76, 175, 80, 0.1)',
                          border: '1px solid rgba(76, 175, 80, 0.2)',
                          borderRadius: '8px',
                          padding: '1rem',
                          marginBottom: '1.5rem'
                        }}>
                          <p style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.9)',
                            marginBottom: '0.75rem'
                          }}>
                            <strong>Document Title:</strong>
                          </p>
                          <p style={{
                            fontSize: '1rem',
                            color: '#fff',
                            marginBottom: '1rem'
                          }}>
                            {googleDocsData.title}
                          </p>
                          
                          <p style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.9)',
                            marginBottom: '0.75rem'
                          }}>
                            <strong>Document URL:</strong>
                          </p>
                          <div style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            padding: '0.75rem',
                            borderRadius: '6px',
                            wordBreak: 'break-all',
                            fontSize: '0.85rem',
                            color: '#00D4FF',
                            border: '1px solid rgba(0, 212, 255, 0.2)'
                          }}>
                            <a 
                              href={googleDocsData.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{
                                color: '#00D4FF',
                                textDecoration: 'none'
                              }}
                              onMouseEnter={(e) => (e.target.style.textDecoration = 'underline')}
                              onMouseLeave={(e) => (e.target.style.textDecoration = 'none')}
                            >
                              {googleDocsData.url}
                            </a>
                          </div>
                        </div>
                        
                        <div style={{
                          display: 'flex',
                          gap: '1rem',
                          justifyContent: 'flex-end'
                        }}>
                          <button
                            onClick={() => {
                              // Copy URL to clipboard
                              navigator.clipboard.writeText(googleDocsData.url);
                              setInfo('URL copied to clipboard!');
                              setTimeout(() => setInfo(''), 3000);
                            }}
                            style={{
                              padding: '0.75rem 1.5rem',
                              background: 'rgba(0, 212, 255, 0.1)',
                              border: '1px solid rgba(0, 212, 255, 0.3)',
                              color: '#00D4FF',
                              borderRadius: '6px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = 'rgba(0, 212, 255, 0.2)';
                              e.target.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'rgba(0, 212, 255, 0.1)';
                              e.target.style.transform = 'translateY(0)';
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                            </svg>
                            Copy URL
                          </button>
                          
                          <button
                            onClick={() => {
                              window.open(googleDocsData.url, '_blank');
                              setShowGoogleDocsModal(false);
                              setIsConvertingToDocs(false);
                              setGoogleDocsError(null);
                            }}
                            style={{
                              padding: '0.75rem 1.5rem',
                              background: 'linear-gradient(135deg, #00D4FF 0%, #0095CC 100%)',
                              border: 'none',
                              color: 'white',
                              borderRadius: '6px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              boxShadow: '0 4px 15px rgba(0, 212, 255, 0.3)'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.transform = 'translateY(-2px)';
                              e.target.style.boxShadow = '0 6px 20px rgba(0, 212, 255, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.transform = 'translateY(0)';
                              e.target.style.boxShadow = '0 4px 15px rgba(0, 212, 255, 0.3)';
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                              <polyline points="15 3 21 3 21 9"/>
                              <line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                            Open Document
                          </button>
                        </div>
                      </>
                    ) : (
                      // Error state (shouldn't happen but good to have)
                      <div style={{
                        padding: '2rem',
                        textAlign: 'center',
                        color: 'rgba(255, 255, 255, 0.7)'
                      }}>
                        <p>Something went wrong. Please try again.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ),
            document.body
          )}
          
          {/* WordPress Modal (via Portal) */}
          {showWpModal && typeof window !== 'undefined' && createPortal(
            (
              <div className={styles.modalOverlay} onClick={() => {
                if (!isUploading) {
                  setShowWpModal(false);
                  setWpError(''); // Clear error when closing modal
                  // Reset category state
                  setWpCategories([{ id: 1, name: 'Uncategorized' }]);
                  setSelectedCategory(1);
                  setCategoriesLoaded(false);
                  setLoadingCategories(false);
                  setCategoryError(null);
                  // Reset connection state
                  resetConnectionState();
                }
              }} style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(5px)'
              }}>
                <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
                  background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)',
                  border: '1px solid rgba(0, 212, 255, 0.1)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                  color: 'white'
                }}>
                  <div className={styles.modalHeader} style={{
                    borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
                    paddingBottom: '1rem'
                  }}>
                    <h3 className={styles.modalTitle} style={{ color: '#00D4FF' }}>Upload to WordPress</h3>
                    <button 
                      className={styles.secondaryButton} 
                      onClick={() => {
                        if (!isUploading) {
                          setShowWpModal(false);
                          setWpError(''); // Clear error when closing modal
                          // Reset category state
                          setWpCategories([{ id: 1, name: 'Uncategorized' }]);
                          setSelectedCategory(1);
                          setCategoriesLoaded(false);
                          setLoadingCategories(false);
                          setCategoryError(null);
                          // Reset connection state
                          resetConnectionState();
                        }
                      }}
                      disabled={isUploading}
                      style={{
                        background: 'rgba(0, 212, 255, 0.1)',
                        border: '1px solid rgba(0, 212, 255, 0.2)',
                        color: '#00D4FF',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        opacity: isUploading ? 0.3 : 1,
                        cursor: isUploading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => !isUploading && (e.target.style.background = 'rgba(0, 212, 255, 0.2)')}
                      onMouseLeave={(e) => (e.target.style.background = 'rgba(0, 212, 255, 0.1)')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                  <div className={styles.modalBody}>
                    {isUploading ? (
                      <div style={{
                        padding: '3rem 2rem',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1.5rem'
                      }}>
                        <style jsx>{`
                          @keyframes spin {
                            from { transform: rotate(0deg); }
                            to { transform: rotate(360deg); }
                          }
                        `}</style>
                        <div style={{
                          width: '60px',
                          height: '60px',
                          border: '4px solid rgba(0, 212, 255, 0.2)',
                          borderTop: '4px solid #00D4FF',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        <div>
                          <p style={{
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            color: '#00D4FF',
                            marginBottom: '0.5rem'
                          }}>
                            Publishing to WordPress...
                          </p>
                          <p style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.7)'
                          }}>
                            Please wait while we upload your article
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Compact Setup Guide */}
                        <div style={{
                          background: 'rgba(0, 212, 255, 0.08)',
                          border: '1px solid rgba(0, 212, 255, 0.2)',
                          borderRadius: '8px',
                          padding: '1rem',
                          marginBottom: '1.5rem'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.75rem'
                          }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/>
                              <path d="M12 16v-4"/>
                              <path d="M12 8h.01"/>
                            </svg>
                            <span style={{
                              fontWeight: '600',
                              color: '#00D4FF',
                              fontSize: '0.95rem'
                            }}>
                              Setup Guide
                            </span>
                          </div>
                          
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '1rem',
                            fontSize: '0.85rem'
                          }}>
                            {/* URL Format */}
                            <div>
                              <div style={{
                                fontWeight: '600',
                                color: 'rgba(255, 255, 255, 0.9)',
                                marginBottom: '0.4rem'
                              }}>
                                URL Format
                              </div>
                              <div style={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                lineHeight: '1.4',
                                marginBottom: '0.5rem'
                              }}>
                                Use base URL only:
                              </div>
                              <div style={{
                                fontFamily: 'monospace',
                                fontSize: '0.8rem',
                                background: 'rgba(0, 0, 0, 0.3)',
                                padding: '0.4rem',
                                borderRadius: '4px',
                                border: '1px solid rgba(0, 212, 255, 0.15)'
                              }}>
                                <div style={{ color: '#4ade80' }}>✓ https://yoursite.com</div>
                                <div style={{ color: '#f87171' }}>✗ .../wp-admin</div>
                              </div>
                            </div>

                            {/* Authentication */}
                            <div>
                              <div style={{
                                fontWeight: '600',
                                color: 'rgba(255, 255, 255, 0.9)',
                                marginBottom: '0.4rem'
                              }}>
                                Application Password
                              </div>
                              <div style={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                lineHeight: '1.4',
                                marginBottom: '0.5rem'
                              }}>
                                WordPress Admin → Users → Profile
                              </div>
                              <div style={{
                                background: 'rgba(255, 193, 7, 0.1)',
                                border: '1px solid rgba(255, 193, 7, 0.3)',
                                borderRadius: '4px',
                                padding: '0.4rem',
                                fontSize: '0.8rem',
                                color: '#fbbf24'
                              }}>
                                <strong>Tip:</strong> Create "QueryFuel API" password
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Quick Connect Section */}
                        {savedConnections.length > 0 && (
                          <div style={{
                            marginBottom: '1.5rem',
                            padding: '1rem',
                            background: 'rgba(34, 197, 94, 0.05)',
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                            borderRadius: '8px'
                          }}>
                            <label style={{
                              display: 'block',
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              color: 'rgba(255, 255, 255, 0.9)',
                              marginBottom: '0.5rem'
                            }}>
                              Quick Connect
                            </label>
                            <select
                              value={selectedConnectionId}
                              onChange={handleQuickConnect}
                              disabled={isUploading}
                              style={{
                                width: '100%',
                                background: 'rgba(0, 0, 0, 0.4)',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                color: 'white',
                                padding: '0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.9rem'
                              }}
                            >
                              <option value="">Choose saved connection...</option>
                              {savedConnections.map(conn => (
                                <option key={conn.id} value={conn.id}>
                                  {conn.name} ({conn.siteUrl})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Form Fields */}
                        <div style={{
                          display: 'grid',
                          gap: '1rem'
                        }}>
                          {/* Site URL */}
                          <div>
                            <label style={{
                              display: 'block',
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              color: 'rgba(255, 255, 255, 0.9)',
                              marginBottom: '0.5rem'
                            }}>
                              Site URL
                            </label>
                            <input 
                              value={wpUrl} 
                              onChange={(e) => {
                                setWpUrl(e.target.value);
                                if (wpError) setWpError('');
                              }}
                              placeholder="https://your-site.com" 
                              disabled={isUploading}
                              style={{
                                width: '100%',
                                background: 'rgba(0, 0, 0, 0.4)',
                                border: '1px solid rgba(0, 212, 255, 0.3)',
                                color: 'white',
                                padding: '0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.9rem',
                                transition: 'border-color 0.2s',
                                outline: 'none'
                              }}
                              onFocus={(e) => e.target.style.borderColor = '#00D4FF'}
                              onBlur={(e) => e.target.style.borderColor = 'rgba(0, 212, 255, 0.3)'}
                            />
                          </div>

                          {/* Credentials Row */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '1rem'
                          }}>
                            {/* Username */}
                            <div>
                              <label style={{
                                display: 'block',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: 'rgba(255, 255, 255, 0.9)',
                                marginBottom: '0.5rem'
                              }}>
                                Username
                              </label>
                              <input 
                                value={wpUser} 
                                onChange={(e) => {
                                  setWpUser(e.target.value);
                                  if (wpError) setWpError('');
                                }}
                                placeholder="your-username" 
                                disabled={isUploading}
                                style={{
                                  width: '100%',
                                  background: 'rgba(0, 0, 0, 0.4)',
                                  border: '1px solid rgba(0, 212, 255, 0.3)',
                                  color: 'white',
                                  padding: '0.75rem',
                                  borderRadius: '6px',
                                  fontSize: '0.9rem',
                                  transition: 'border-color 0.2s',
                                  outline: 'none'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#00D4FF'}
                                onBlur={(e) => e.target.style.borderColor = 'rgba(0, 212, 255, 0.3)'}
                              />
                            </div>

                            {/* Application Password */}
                            <div>
                              <label style={{
                                display: 'block',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: 'rgba(255, 255, 255, 0.9)',
                                marginBottom: '0.5rem'
                              }}>
                                Application Password
                                <span style={{
                                  fontSize: '0.75rem',
                                  color: '#4ade80',
                                  marginLeft: '0.5rem',
                                  fontWeight: '400'
                                }}>
                                  (Recommended)
                                </span>
                              </label>
                              <div style={{ position: 'relative' }}>
                                <input 
                                  type={showWpPassword ? "text" : "password"} 
                                  value={wpPass} 
                                  onChange={(e) => {
                                    setWpPass(e.target.value);
                                    if (wpError) setWpError('');
                                  }}
                                  placeholder="••••••••••••••••" 
                                  disabled={isUploading}
                                  style={{
                                    width: '100%',
                                    background: 'rgba(0, 0, 0, 0.4)',
                                    border: '1px solid rgba(0, 212, 255, 0.3)',
                                    color: 'white',
                                    padding: '0.75rem 3rem 0.75rem 0.75rem',
                                    borderRadius: '6px',
                                    fontSize: '0.9rem',
                                    transition: 'border-color 0.2s',
                                    outline: 'none'
                                  }}
                                  onFocus={(e) => e.target.style.borderColor = '#00D4FF'}
                                  onBlur={(e) => e.target.style.borderColor = 'rgba(0, 212, 255, 0.3)'}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowWpPassword(!showWpPassword)}
                                  disabled={isUploading}
                                  style={{
                                    position: 'absolute',
                                    right: '0.75rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255, 255, 255, 0.6)',
                                    cursor: isUploading ? 'not-allowed' : 'pointer',
                                    padding: '0.25rem',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'color 0.2s',
                                    fontSize: '1.1rem'
                                  }}
                                  onMouseEnter={(e) => !isUploading && (e.target.style.color = 'rgba(255, 255, 255, 0.9)')}
                                  onMouseLeave={(e) => (e.target.style.color = 'rgba(255, 255, 255, 0.6)')}
                                  title={showWpPassword ? "Hide password" : "Show password"}
                                >
                                  {showWpPassword ? (
                                    // Eye slash icon (hide password)
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                      <line x1="1" y1="1" x2="23" y2="23"/>
                                    </svg>
                                  ) : (
                                    // Eye icon (show password)
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                      <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Category Selection */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            gap: '1rem',
                            alignItems: 'end'
                          }}>
                            <div>
                              <label style={{
                                display: 'block',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: 'rgba(255, 255, 255, 0.9)',
                                marginBottom: '0.5rem'
                              }}>
                                Category
                                <span style={{
                                  fontSize: '0.75rem',
                                  color: 'rgba(255, 255, 255, 0.6)',
                                  marginLeft: '0.5rem',
                                  fontWeight: '400'
                                }}>
                                  (Optional)
                                </span>
                              </label>
                              <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(parseInt(e.target.value))}
                                disabled={isUploading}
                                style={{
                                  width: '100%',
                                  background: 'rgba(0, 0, 0, 0.4)',
                                  border: '1px solid rgba(0, 212, 255, 0.3)',
                                  color: 'white',
                                  padding: '0.75rem',
                                  borderRadius: '6px',
                                  fontSize: '0.9rem',
                                  transition: 'border-color 0.2s',
                                  outline: 'none',
                                  cursor: 'pointer'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#00D4FF'}
                                onBlur={(e) => e.target.style.borderColor = 'rgba(0, 212, 255, 0.3)'}
                              >
                                {wpCategories.map(category => (
                                  <option 
                                    key={category.id} 
                                    value={category.id}
                                    style={{ 
                                      background: '#1a1a2e', 
                                      color: 'white' 
                                    }}
                                  >
                                    {category.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <button
                                type="button"
                                onClick={fetchCategories}
                                disabled={isUploading || loadingCategories || !wpUrl || !wpUser || !wpPass}
                                style={{
                                  background: loadingCategories 
                                    ? 'rgba(0, 212, 255, 0.1)' 
                                    : categoriesLoaded 
                                      ? 'rgba(34, 197, 94, 0.1)' 
                                      : categoryError
                                        ? 'rgba(239, 68, 68, 0.1)'
                                        : 'rgba(0, 212, 255, 0.1)',
                                  border: `1px solid ${loadingCategories 
                                    ? 'rgba(0, 212, 255, 0.3)' 
                                    : categoriesLoaded 
                                      ? 'rgba(34, 197, 94, 0.3)' 
                                      : categoryError
                                        ? 'rgba(239, 68, 68, 0.3)'
                                        : 'rgba(0, 212, 255, 0.3)'}`,
                                  color: loadingCategories 
                                    ? '#00D4FF' 
                                    : categoriesLoaded 
                                      ? '#22c55e' 
                                      : categoryError
                                        ? '#ff6b6b'
                                        : '#00D4FF',
                                  padding: '0.75rem 1rem',
                                  borderRadius: '6px',
                                  fontSize: '0.85rem',
                                  fontWeight: '500',
                                  cursor: (isUploading || loadingCategories || !wpUrl || !wpUser || !wpPass) 
                                    ? 'not-allowed' 
                                    : 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  whiteSpace: 'nowrap',
                                  opacity: (isUploading || loadingCategories || !wpUrl || !wpUser || !wpPass) 
                                    ? 0.5 
                                    : 1
                                }}
                                onMouseEnter={(e) => {
                                  if (!isUploading && !loadingCategories && wpUrl && wpUser && wpPass) {
                                    e.target.style.background = categoriesLoaded 
                                      ? 'rgba(34, 197, 94, 0.2)' 
                                      : categoryError
                                        ? 'rgba(239, 68, 68, 0.2)'
                                        : 'rgba(0, 212, 255, 0.2)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.background = loadingCategories 
                                    ? 'rgba(0, 212, 255, 0.1)' 
                                    : categoriesLoaded 
                                      ? 'rgba(34, 197, 94, 0.1)' 
                                      : categoryError
                                        ? 'rgba(239, 68, 68, 0.1)'
                                        : 'rgba(0, 212, 255, 0.1)';
                                }}
                              >
                                {loadingCategories ? (
                                  <>
                                    <div style={{
                                      width: '14px',
                                      height: '14px',
                                      border: '2px solid rgba(0, 212, 255, 0.3)',
                                      borderTop: '2px solid #00D4FF',
                                      borderRadius: '50%',
                                      animation: 'spin 1s linear infinite'
                                    }} />
                                    Loading...
                                  </>
                                ) : categoriesLoaded ? (
                                  <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                    {wpCategories.length - 1} Loaded
                                  </>
                                ) : categoryError ? (
                                  <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <circle cx="12" cy="12" r="10"/>
                                      <line x1="12" y1="8" x2="12" y2="12"/>
                                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                                    </svg>
                                    Retry
                                  </>
                                ) : (
                                  <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                                    </svg>
                                    Load Categories
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Category Error Message */}
                          {categoryError && (
                            <div style={{
                              fontSize: '0.8rem',
                              color: 'rgba(239, 68, 68, 0.8)',
                              marginTop: '0.5rem',
                              padding: '0.5rem',
                              background: 'rgba(239, 68, 68, 0.05)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                              </svg>
                              <span>Categories unavailable. Article will use "Uncategorized" by default.</span>
                            </div>
                          )}
                        </div>
                        {wpError && (
                          <div style={{
                            marginTop: '1rem',
                            padding: '0.75rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem'
                          }}>
                            <svg 
                              width="16" 
                              height="16" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="#ff6b6b" 
                              strokeWidth="2"
                              style={{ flexShrink: 0, marginTop: '2px' }}
                            >
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="12" y1="8" x2="12" y2="12"/>
                              <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                fontWeight: '600', 
                                color: '#ff8a8a',
                                fontSize: '0.875rem',
                                marginBottom: '0.25rem'
                              }}>
                                Upload Failed
                              </div>
                              <div style={{ 
                                color: 'rgba(255, 255, 255, 0.8)',
                                fontSize: '0.85rem',
                                lineHeight: '1.4'
                              }}>
                                {wpError}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className={styles.modalActions} style={{
                    borderTop: '1px solid rgba(0, 212, 255, 0.1)',
                    paddingTop: '1rem'
                  }}>
                    <button 
                      className={styles.secondaryButton} 
                      onClick={() => {
                        setShowWpModal(false);
                        setWpError(''); // Clear WordPress error
                        setIsUploading(false);
                        // Reset category state
                        setWpCategories([{ id: 1, name: 'Uncategorized' }]);
                        setSelectedCategory(1);
                        setCategoriesLoaded(false);
                        setLoadingCategories(false);
                        setCategoryError(null);
                        // Reset connection state
                        resetConnectionState();
                      }}
                      disabled={isUploading}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        color: '#00D4FF',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '6px',
                        opacity: isUploading ? 0.5 : 1,
                        cursor: isUploading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => !isUploading && (e.target.style.background = 'rgba(0, 212, 255, 0.1)')}
                      onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                    >
                      Cancel
                    </button>
                    <button
                      className={styles.primaryButton}
                      type="button"
                      onClick={() => {
                        // Check credits before showing confirmation
                        const creditsRequired = getCreditsRequired();
                        if (!validateCredits(creditsRemaining, creditsRequired)) {
                          setWpError(`Insufficient credits. You need ${creditsRequired} credit${creditsRequired > 1 ? 's' : ''} to upload to WordPress. You have ${creditsRemaining || 0} credits remaining.`);
                          return;
                        }
                        setShowWpCreditConfirmation(true);
                      }}
                      disabled={isUploading || !wpUrl || !wpUser || !wpPass}
                      style={{
                        background: 'linear-gradient(135deg, #00D4FF 0%, #0095CC 100%)',
                        border: 'none',
                        color: '#0D1117',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '6px',
                        fontWeight: '600',
                        opacity: (isUploading || !wpUrl || !wpUser || !wpPass) ? 0.6 : 1,
                        cursor: (isUploading || !wpUrl || !wpUser || !wpPass) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => !(isUploading || !wpUrl || !wpUser || !wpPass) && (e.target.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
                    >
                      {isUploading ? 'Publishing...' : (wpError ? 'Try Again' : 'Continue')}
                    </button>
                  </div>
                </div>
              </div>
            ),
            document.body
          )}

          {/* Save Connection Modal */}
          {showSaveConnectionModal && typeof window !== 'undefined' && createPortal(
            <div className={styles.modalOverlay} onClick={() => setShowSaveConnectionModal(false)}>
              <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{
                background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: 'white'
              }}>
                <div className={styles.modalHeader} style={{
                  borderBottom: '1px solid rgba(34, 197, 94, 0.2)',
                  paddingBottom: '1rem'
                }}>
                  <h3 style={{ color: '#22c55e' }}>🎉 Published Successfully!</h3>
                  <button onClick={() => setShowSaveConnectionModal(false)}>✕</button>
                </div>
                
                <div className={styles.modalBody}>
                  <p style={{ marginBottom: '1.5rem' }}>
                    Your article was published to <strong>{wpUrl}</strong>
                  </p>
                  
                  <div style={{
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <h4 style={{ color: '#22c55e', marginBottom: '0.5rem' }}>
                      💾 Save this connection?
                    </h4>
                    <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                      Save your credentials to make future publishing faster and easier.
                    </p>
                  </div>
                  
                  <div className={styles.inputGroup}>
                    <label style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                      Connection Name
                    </label>
                    <input
                      type="text"
                      value={connectionName}
                      onChange={(e) => setConnectionName(e.target.value)}
                      placeholder="e.g., My Blog"
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        color: 'white',
                        padding: '0.75rem',
                        borderRadius: '6px'
                      }}
                    />
                  </div>
                  
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '1rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: 'rgba(255, 255, 255, 0.7)'
                  }}>
                    <div>✓ Site: {wpUrl}</div>
                    <div>✓ User: {wpUser}</div>
                    <div>✓ Categories: {wpCategories.length - 1} loaded</div>
                  </div>
                </div>
                
                <div className={styles.modalActions}>
                  <button 
                    onClick={() => setShowSaveConnectionModal(false)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      color: 'white',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '6px'
                    }}
                  >
                    Skip
                  </button>
                  <button 
                    onClick={handleSaveConnection}
                    style={{
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      border: 'none',
                      color: 'white',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '6px',
                      fontWeight: '600'
                    }}
                  >
                    Save Connection
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Shopify Modal */}
          {showShopifyModal && typeof window !== 'undefined' && createPortal(
            (
              <div className={styles.modalOverlay} onClick={() => {
                if (!isShopifyUploading) {
                  setShowShopifyModal(false);
                  setShopifyError(''); // Clear error when closing modal
                }
              }} style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(5px)'
              }}>
                <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
                  background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)',
                  border: '1px solid rgba(150, 201, 61, 0.1)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                  color: 'white'
                }}>
                  <div className={styles.modalHeader} style={{
                    borderBottom: '1px solid rgba(150, 201, 61, 0.1)',
                    paddingBottom: '1rem'
                  }}>
                    <h3 className={styles.modalTitle} style={{ color: '#96c93d' }}>Upload to Shopify</h3>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => {
                        if (!isShopifyUploading) {
                          setShowShopifyModal(false);
                          setShopifyError(''); // Clear error when closing modal
                        }
                      }}
                      disabled={isShopifyUploading}
                      style={{
                        background: 'rgba(150, 201, 61, 0.1)',
                        border: '1px solid rgba(150, 201, 61, 0.2)',
                        color: '#96c93d',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        opacity: isShopifyUploading ? 0.3 : 1,
                        cursor: isShopifyUploading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => !isShopifyUploading && (e.target.style.background = 'rgba(150, 201, 61, 0.2)')}
                      onMouseLeave={(e) => (e.target.style.background = 'rgba(150, 201, 61, 0.1)')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                  <div className={styles.modalBody}>
                    {isShopifyUploading ? (
                      <div style={{
                        padding: '3rem 2rem',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1.5rem'
                      }}>
                        <style jsx>{`
                          @keyframes spin {
                            from { transform: rotate(0deg); }
                            to { transform: rotate(360deg); }
                          }
                        `}</style>
                        <div style={{
                          width: '60px',
                          height: '60px',
                          border: '4px solid rgba(150, 201, 61, 0.2)',
                          borderTop: '4px solid #96c93d',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        <div>
                          <p style={{
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            color: '#96c93d',
                            marginBottom: '0.5rem'
                          }}>
                            Publishing to Shopify...
                          </p>
                          <p style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.7)'
                          }}>
                            Please wait while we upload your article
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={styles.inputGroup}>
                          <label className={styles.label} style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Store URL</label>
                          <input
                            className={styles.input}
                            value={shopifyUrl}
                            onChange={(e) => {
                              setShopifyUrl(e.target.value);
                              if (shopifyError) setShopifyError(''); // Clear Shopify error on input change
                            }}
                            placeholder="https://your-store.myshopify.com"
                            disabled={isShopifyUploading}
                            style={{
                              background: 'rgba(0, 0, 0, 0.3)',
                              border: '1px solid rgba(150, 201, 61, 0.2)',
                              color: 'white',
                              padding: '0.75rem',
                              borderRadius: '6px'
                            }}
                          />
                        </div>
                        <div className={styles.inputGroup}>
                          <label className={styles.label} style={{ color: 'rgba(255, 255, 255, 0.9)' }}>API Key</label>
                          <input
                            className={styles.input}
                            value={shopifyApiKey}
                            onChange={(e) => {
                              setShopifyApiKey(e.target.value);
                              if (shopifyError) setShopifyError(''); // Clear Shopify error on input change
                            }}
                            placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxx"
                            disabled={isShopifyUploading}
                            style={{
                              background: 'rgba(0, 0, 0, 0.3)',
                              border: '1px solid rgba(150, 201, 61, 0.2)',
                              color: 'white',
                              padding: '0.75rem',
                              borderRadius: '6px'
                            }}
                          />
                        </div>
                        <div className={styles.inputGroup}>
                          <label className={styles.label} style={{ color: 'rgba(255, 255, 255, 0.9)' }}>API Secret</label>
                          <input
                            type="password"
                            className={styles.input}
                            value={shopifyApiSecret}
                            onChange={(e) => {
                              setShopifyApiSecret(e.target.value);
                              if (shopifyError) setShopifyError(''); // Clear Shopify error on input change
                            }}
                            placeholder="••••••••••••••••••••••••••••••••••••••••"
                            disabled={isShopifyUploading}
                            style={{
                              background: 'rgba(0, 0, 0, 0.3)',
                              border: '1px solid rgba(150, 201, 61, 0.2)',
                              color: 'white',
                              padding: '0.75rem',
                              borderRadius: '6px'
                            }}
                          />
                        </div>
                        {shopifyError && (
                          <div style={{
                            padding: '1rem',
                            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: '8px',
                            color: '#ff6b6b',
                            fontSize: '0.9rem',
                            marginTop: '1rem',
                            animation: 'slideDown 0.3s ease-out',
                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)'
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.75rem'
                            }}>
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                style={{ flexShrink: 0, marginTop: '2px' }}
                              >
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                              </svg>
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  fontWeight: '600',
                                  marginBottom: '0.25rem',
                                  color: '#ff8a8a'
                                }}>
                                  Upload Failed
                                </div>
                                <div style={{
                                  lineHeight: '1.5',
                                  color: 'rgba(255, 255, 255, 0.8)'
                                }}>
                                  {shopifyError}
                                </div>
                                {(shopifyError.includes('Authentication') || shopifyError.includes('API')) && (
                                  <div style={{
                                    marginTop: '0.5rem',
                                    fontSize: '0.85rem',
                                    color: 'rgba(255, 255, 255, 0.6)',
                                    fontStyle: 'italic'
                                  }}>
                                    Tip: Make sure your API key has the correct permissions and the store URL is correct.
                                  </div>
                                )}
                              </div>
                            </div>
                            <style jsx>{`
                              @keyframes slideDown {
                                from {
                                  opacity: 0;
                                  transform: translateY(-10px);
                                }
                                to {
                                  opacity: 1;
                                  transform: translateY(0);
                                }
                              }
                            `}</style>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className={styles.modalActions} style={{
                    borderTop: '1px solid rgba(150, 201, 61, 0.1)',
                    paddingTop: '1rem'
                  }}>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => {
                        setShowShopifyModal(false);
                        setShopifyError(''); // Clear Shopify error
                        setIsShopifyUploading(false);
                      }}
                      disabled={isShopifyUploading}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(150, 201, 61, 0.3)',
                        color: '#96c93d',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '6px',
                        opacity: isShopifyUploading ? 0.5 : 1,
                        cursor: isShopifyUploading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => !isShopifyUploading && (e.target.style.background = 'rgba(150, 201, 61, 0.1)')}
                      onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                    >
                      Cancel
                    </button>
                    <button
                      className={styles.primaryButton}
                      type="button"
                      onClick={() => {
                        // Check credits before showing confirmation
                        const creditsRequired = getCreditsRequired();
                        if (!validateCredits(creditsRemaining, creditsRequired)) {
                          setShopifyError(`Insufficient credits. You need ${creditsRequired} credit${creditsRequired > 1 ? 's' : ''} to upload to Shopify. You have ${creditsRemaining || 0} credits remaining.`);
                          return;
                        }
                        setShowShopifyCreditConfirmation(true);
                      }}
                      disabled={isShopifyUploading || !shopifyUrl || !shopifyApiKey || !shopifyApiSecret}
                      style={{
                        background: 'linear-gradient(135deg, #96c93d 0%, #00a046 100%)',
                        border: 'none',
                        color: '#fff',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '6px',
                        fontWeight: '600',
                        opacity: (isShopifyUploading || !shopifyUrl || !shopifyApiKey || !shopifyApiSecret) ? 0.6 : 1,
                        cursor: (isShopifyUploading || !shopifyUrl || !shopifyApiKey || !shopifyApiSecret) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => !(isShopifyUploading || !shopifyUrl || !shopifyApiKey || !shopifyApiSecret) && (e.target.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
                    >
                      {isShopifyUploading ? 'Publishing...' : (shopifyError ? 'Try Again' : 'Continue')}
                    </button>
                  </div>
                </div>
              </div>
            ),
            document.body
          )}

          {/* Webflow Modal */}
          {showWebflowModal && typeof window !== 'undefined' && createPortal(
            (
              <div className={styles.modalOverlay} onClick={() => {
                if (!isWebflowUploading) {
                  setShowWebflowModal(false);
                  setWebflowError(''); // Clear error when closing modal
                }
              }} style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(5px)'
              }}>
                <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
                  background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.98) 0%, rgba(67, 83, 255, 0.1) 100%)',
                  border: '1px solid rgba(67, 83, 255, 0.1)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                  color: 'white'
                }}>
                  <div className={styles.modalHeader} style={{
                    borderBottom: '1px solid rgba(67, 83, 255, 0.1)',
                    paddingBottom: '1rem'
                  }}>
                    <h3 className={styles.modalTitle} style={{ color: '#4353ff' }}>Upload to Webflow</h3>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => {
                        if (!isWebflowUploading) {
                          setShowWebflowModal(false);
                          setWebflowError(''); // Clear error when closing modal
                        }
                      }}
                      disabled={isWebflowUploading}
                      style={{
                        background: 'rgba(67, 83, 255, 0.1)',
                        border: '1px solid rgba(67, 83, 255, 0.2)',
                        color: '#4353ff',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        opacity: isWebflowUploading ? 0.3 : 1,
                        cursor: isWebflowUploading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => !isWebflowUploading && (e.target.style.background = 'rgba(67, 83, 255, 0.2)')}
                      onMouseLeave={(e) => (e.target.style.background = 'rgba(67, 83, 255, 0.1)')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                  <div className={styles.modalBody}>
                    {isWebflowUploading ? (
                      <div style={{
                        padding: '3rem 2rem',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1.5rem'
                      }}>
                        <style jsx>{`
                          @keyframes spin {
                            from { transform: rotate(0deg); }
                            to { transform: rotate(360deg); }
                          }
                        `}</style>
                        <div style={{
                          width: '60px',
                          height: '60px',
                          border: '4px solid rgba(67, 83, 255, 0.2)',
                          borderTop: '4px solid #4353ff',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        <div>
                          <p style={{
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            color: '#4353ff',
                            marginBottom: '0.5rem'
                          }}>
                            Publishing to Webflow...
                          </p>
                          <p style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.7)'
                          }}>
                            Please wait while we upload your article
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={styles.inputGroup}>
                          <label className={styles.label} style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Webflow API Token</label>
                          <input
                            className={styles.input}
                            type="password"
                            value={webflowApiToken}
                            onChange={async (e) => {
                              const token = e.target.value;
                              setWebflowApiToken(token);
                              setWebflowSiteId(''); // Reset site when token changes
                              setWebflowCollectionId(''); // Reset collection when token changes
                              setWebflowSites([]); // Clear sites
                              setWebflowCollections([]); // Clear collections
                              if (webflowError) setWebflowError(''); // Clear Webflow error on input change

                              // Load sites when token is entered
                              if (token.length > 10) { // Basic validation - tokens are usually longer
                                await loadWebflowSites(token);
                              }
                            }}
                            placeholder="Enter your Webflow API token"
                            disabled={isWebflowUploading}
                            style={{
                              background: 'rgba(0, 0, 0, 0.3)',
                              border: '1px solid rgba(67, 83, 255, 0.2)',
                              color: 'white',
                              padding: '0.75rem',
                              borderRadius: '6px'
                            }}
                          />
                        </div>

                        <div className={styles.inputGroup}>
                          <label className={styles.label} style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Site</label>
                          <select
                            className={styles.input}
                            value={webflowSiteId}
                            onChange={async (e) => {
                              setWebflowSiteId(e.target.value);
                              setWebflowCollectionId(''); // Reset collection when site changes
                              if (webflowError) setWebflowError(''); // Clear Webflow error on input change

                              if (e.target.value && webflowApiToken) {
                                setIsLoadingCollections(true);
                                try {
                                  const response = await fetch(`${ENV.API.baseUrl}/webflow/collections?apiToken=${encodeURIComponent(webflowApiToken)}&siteId=${encodeURIComponent(e.target.value)}`);
                                  const result = await response.json();
                                  if (result.success) {
                                    setWebflowCollections(result.collections);
                                  } else {
                                    setWebflowError(result.error?.message || 'Failed to load collections');
                                  }
                                } catch (error) {
                                  setWebflowError('Failed to load collections');
                                }
                                setIsLoadingCollections(false);
                              }
                            }}
                            disabled={isWebflowUploading || isLoadingSites}
                            style={{
                              background: 'rgba(0, 0, 0, 0.3)',
                              border: '1px solid rgba(67, 83, 255, 0.2)',
                              color: 'white',
                              padding: '0.75rem',
                              borderRadius: '6px'
                            }}
                          >
                            <option value="">Select a site...</option>
                            {webflowSites.map(site => (
                              <option key={site.id} value={site.id}>{site.displayName || site.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className={styles.inputGroup}>
                          <label className={styles.label} style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Collection</label>
                          <select
                            className={styles.input}
                            value={webflowCollectionId}
                            onChange={(e) => {
                              setWebflowCollectionId(e.target.value);
                              if (webflowError) setWebflowError(''); // Clear Webflow error on input change
                            }}
                            disabled={isWebflowUploading || isLoadingCollections || !webflowSiteId}
                            style={{
                              background: 'rgba(0, 0, 0, 0.3)',
                              border: '1px solid rgba(67, 83, 255, 0.2)',
                              color: 'white',
                              padding: '0.75rem',
                              borderRadius: '6px'
                            }}
                          >
                            <option value="">
                              {isLoadingCollections ? 'Loading collections...' : 'Select a collection...'}
                            </option>
                            {webflowCollections.map(collection => (
                              <option key={collection.id} value={collection.id}>{collection.displayName || collection.name}</option>
                            ))}
                          </select>
                        </div>

                        {webflowError && (
                          <div style={{
                            padding: '1rem',
                            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: '8px',
                            color: '#ff6b6b',
                            fontSize: '0.9rem',
                            marginTop: '1rem',
                            animation: 'slideDown 0.3s ease-out',
                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)'
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.75rem'
                            }}>
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                style={{ flexShrink: 0, marginTop: '2px' }}
                              >
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                              </svg>
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  fontWeight: '600',
                                  marginBottom: '0.25rem',
                                  color: '#ff8a8a'
                                }}>
                                  Upload Failed
                                </div>
                                <div style={{
                                  lineHeight: '1.5',
                                  color: 'rgba(255, 255, 255, 0.8)'
                                }}>
                                  {webflowError}
                                </div>
                                {(webflowError.includes('API') || webflowError.includes('token')) && (
                                  <div style={{
                                    marginTop: '0.5rem',
                                    fontSize: '0.85rem',
                                    color: 'rgba(255, 255, 255, 0.6)',
                                    fontStyle: 'italic'
                                  }}>
                                    Tip: Make sure your API token is correct and has the necessary permissions.
                                  </div>
                                )}
                              </div>
                            </div>
                            <style jsx>{`
                              @keyframes slideDown {
                                from {
                                  opacity: 0;
                                  transform: translateY(-10px);
                                }
                                to {
                                  opacity: 1;
                                  transform: translateY(0);
                                }
                              }
                            `}</style>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className={styles.modalActions} style={{
                    borderTop: '1px solid rgba(67, 83, 255, 0.1)',
                    paddingTop: '1rem'
                  }}>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => {
                        setShowWebflowModal(false);
                        setWebflowError(''); // Clear Webflow error
                        setIsWebflowUploading(false);
                      }}
                      disabled={isWebflowUploading}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(67, 83, 255, 0.3)',
                        color: '#4353ff',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '6px',
                        opacity: isWebflowUploading ? 0.5 : 1,
                        cursor: isWebflowUploading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => !isWebflowUploading && (e.target.style.background = 'rgba(67, 83, 255, 0.1)')}
                      onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                    >
                      Cancel
                    </button>
                    <button
                      className={styles.primaryButton}
                      type="button"
                      onClick={() => {
                        // Check credits before showing confirmation
                        const creditsRequired = getCreditsRequired();
                        if (!validateCredits(creditsRemaining, creditsRequired)) {
                          setWebflowError(`Insufficient credits. You need ${creditsRequired} credit${creditsRequired > 1 ? 's' : ''} to upload to Webflow. You have ${creditsRemaining || 0} credits remaining.`);
                          return;
                        }
                        setShowWebflowCreditConfirmation(true);
                      }}
                      disabled={isWebflowUploading || !webflowApiToken || !webflowSiteId || !webflowCollectionId}
                      style={{
                        background: 'linear-gradient(135deg, #4353ff 0%, #00d4ff 100%)',
                        border: 'none',
                        color: '#0D1117',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '6px',
                        fontWeight: '600',
                        opacity: (isWebflowUploading || !webflowApiToken || !webflowSiteId || !webflowCollectionId) ? 0.6 : 1,
                        cursor: (isWebflowUploading || !webflowApiToken || !webflowSiteId || !webflowCollectionId) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => !(isWebflowUploading || !webflowApiToken || !webflowSiteId || !webflowCollectionId) && (e.target.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
                    >
                      {isWebflowUploading ? 'Publishing...' : (webflowError ? 'Try Again' : 'Continue')}
                    </button>
                  </div>
                </div>
              </div>
            ),
            document.body
          )}

          {/* WordPress Credit Confirmation Modal */}
          {showWpCreditConfirmation && typeof window !== 'undefined' && createPortal(
            (
              <div className={styles.modalOverlay} onClick={() => setShowWpCreditConfirmation(false)} style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(5px)'
              }}>
                <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
                  background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)',
                  border: '1px solid rgba(0, 212, 255, 0.1)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  maxWidth: '450px',
                  width: '90%'
                }}>
                  <div className={styles.modalHeader} style={{
                    borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
                    paddingBottom: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <h3 className={styles.modalTitle} style={{
                      color: '#00D4FF',
                      fontSize: '1.5rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9 12l2 2 4-4"/>
                      </svg>
                      Confirm WordPress Upload
                    </h3>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => setShowWpCreditConfirmation(false)}
                      style={{
                        background: 'rgba(0, 212, 255, 0.1)',
                        border: '1px solid rgba(0, 212, 255, 0.2)',
                        color: '#00D4FF',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => (e.target.style.background = 'rgba(0, 212, 255, 0.2)')}
                      onMouseLeave={(e) => (e.target.style.background = 'rgba(0, 212, 255, 0.1)')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>

                  <div className={styles.modalBody}>
                    <div style={{
                      background: 'rgba(0, 212, 255, 0.1)',
                      border: '1px solid rgba(0, 212, 255, 0.2)',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1.5rem'
                    }}>
                      <p style={{
                        fontSize: '1rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                        marginBottom: '1rem',
                        lineHeight: '1.5'
                      }}>
                        Publishing "<strong>{title}</strong>" to WordPress will consume <strong>{getCreditsRequired()} credit{getCreditsRequired() > 1 ? 's' : ''}</strong> from your account.
                      </p>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '6px',
                        marginBottom: '1rem'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>
                            Current credits:
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#00D4FF' }}>
                            {creditsRemaining || 0}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>
                            After upload:
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#ff6b6b' }}>
                            {(creditsRemaining || 0) - getCreditsRequired()}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        fontSize: '0.85rem',
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontStyle: 'italic',
                        textAlign: 'center'
                      }}>
                        Credits will be refunded if the upload fails
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '1rem',
                      justifyContent: 'flex-end'
                    }}>
                      <button
                        onClick={() => setShowWpCreditConfirmation(false)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: 'transparent',
                          border: '1px solid rgba(0, 212, 255, 0.3)',
                          color: '#00D4FF',
                          borderRadius: '6px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => (e.target.style.background = 'rgba(0, 212, 255, 0.1)')}
                        onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                      >
                        Cancel
                      </button>

                      <button
                        onClick={() => {
                          setShowWpCreditConfirmation(false);
                          handleUploadContinue();
                        }}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: 'linear-gradient(135deg, #00D4FF 0%, #0095CC 100%)',
                          border: 'none',
                          color: '#0D1117',
                          borderRadius: '6px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                        onMouseEnter={(e) => (e.target.style.transform = 'translateY(-2px)')}
                        onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                          <polyline points="10 9 9 9 8 9"/>
                        </svg>
                        Confirm & Upload
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ),
            document.body
          )}

          {/* Shopify Credit Confirmation Modal */}
          {showShopifyCreditConfirmation && typeof window !== 'undefined' && createPortal(
            (
              <div className={styles.modalOverlay} onClick={() => setShowShopifyCreditConfirmation(false)} style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(5px)'
              }}>
                <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
                  background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)',
                  border: '1px solid rgba(150, 201, 61, 0.1)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  maxWidth: '450px',
                  width: '90%'
                }}>
                  <div className={styles.modalHeader} style={{
                    borderBottom: '1px solid rgba(150, 201, 61, 0.1)',
                    paddingBottom: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <h3 className={styles.modalTitle} style={{
                      color: '#96c93d',
                      fontSize: '1.5rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9 12l2 2 4-4"/>
                      </svg>
                      Confirm Shopify Upload
                    </h3>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => setShowShopifyCreditConfirmation(false)}
                      style={{
                        background: 'rgba(150, 201, 61, 0.1)',
                        border: '1px solid rgba(150, 201, 61, 0.2)',
                        color: '#96c93d',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => (e.target.style.background = 'rgba(150, 201, 61, 0.2)')}
                      onMouseLeave={(e) => (e.target.style.background = 'rgba(150, 201, 61, 0.1)')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>

                  <div className={styles.modalBody}>
                    <div style={{
                      background: 'rgba(150, 201, 61, 0.1)',
                      border: '1px solid rgba(150, 201, 61, 0.2)',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1.5rem'
                    }}>
                      <p style={{
                        fontSize: '1rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                        marginBottom: '1rem',
                        lineHeight: '1.5'
                      }}>
                        Publishing "<strong>{title}</strong>" to Shopify will consume <strong>{getCreditsRequired()} credit{getCreditsRequired() > 1 ? 's' : ''}</strong> from your account.
                      </p>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '6px',
                        marginBottom: '1rem'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>
                            Current credits:
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#96c93d' }}>
                            {creditsRemaining || 0}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>
                            After upload:
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#ff6b6b' }}>
                            {(creditsRemaining || 0) - getCreditsRequired()}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        fontSize: '0.85rem',
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontStyle: 'italic',
                        textAlign: 'center'
                      }}>
                        Credits will be refunded if the upload fails
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '1rem',
                      justifyContent: 'flex-end'
                    }}>
                      <button
                        onClick={() => setShowShopifyCreditConfirmation(false)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: 'transparent',
                          border: '1px solid rgba(150, 201, 61, 0.3)',
                          color: '#96c93d',
                          borderRadius: '6px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => (e.target.style.background = 'rgba(150, 201, 61, 0.1)')}
                        onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                      >
                        Cancel
                      </button>

                      <button
                        onClick={() => {
                          setShowShopifyCreditConfirmation(false);
                          handleShopifyUpload();
                        }}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: 'linear-gradient(135deg, #96c93d 0%, #00a046 100%)',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '6px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                        onMouseEnter={(e) => (e.target.style.transform = 'translateY(-2px)')}
                        onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Confirm & Upload
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ),
            document.body
          )}

          {/* Webflow Credit Confirmation Modal */}
          {showWebflowCreditConfirmation && typeof window !== 'undefined' && createPortal(
            (
              <div className={styles.modalOverlay} onClick={() => setShowWebflowCreditConfirmation(false)} style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(5px)'
              }}>
                <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
                  background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.98) 0%, rgba(67, 83, 255, 0.1) 100%)',
                  border: '1px solid rgba(67, 83, 255, 0.1)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  maxWidth: '450px',
                  width: '90%'
                }}>
                  <div className={styles.modalHeader} style={{
                    borderBottom: '1px solid rgba(67, 83, 255, 0.1)',
                    paddingBottom: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <h3 className={styles.modalTitle} style={{
                      color: '#4353ff',
                      fontSize: '1.5rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9 12l2 2 4-4"/>
                      </svg>
                      Confirm Webflow Upload
                    </h3>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => setShowWebflowCreditConfirmation(false)}
                      style={{
                        background: 'rgba(67, 83, 255, 0.1)',
                        border: '1px solid rgba(67, 83, 255, 0.2)',
                        color: '#4353ff',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => (e.target.style.background = 'rgba(67, 83, 255, 0.2)')}
                      onMouseLeave={(e) => (e.target.style.background = 'rgba(67, 83, 255, 0.1)')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>

                  <div className={styles.modalBody}>
                    <div style={{
                      background: 'rgba(67, 83, 255, 0.1)',
                      border: '1px solid rgba(67, 83, 255, 0.2)',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1.5rem'
                    }}>
                      <p style={{
                        fontSize: '1rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                        marginBottom: '1rem',
                        lineHeight: '1.5'
                      }}>
                        Publishing "<strong>{title}</strong>" to Webflow will consume <strong>{getCreditsRequired()} credit{getCreditsRequired() > 1 ? 's' : ''}</strong> from your account.
                      </p>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '6px',
                        marginBottom: '1rem'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>
                            Current credits:
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#4353ff' }}>
                            {creditsRemaining || 0}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>
                            After upload:
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#ff6b6b' }}>
                            {(creditsRemaining || 0) - getCreditsRequired()}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        fontSize: '0.85rem',
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontStyle: 'italic',
                        textAlign: 'center'
                      }}>
                        Credits will be refunded if the upload fails
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '1rem',
                      justifyContent: 'flex-end'
                    }}>
                      <button
                        onClick={() => setShowWebflowCreditConfirmation(false)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: 'transparent',
                          border: '1px solid rgba(67, 83, 255, 0.3)',
                          color: '#4353ff',
                          borderRadius: '6px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => (e.target.style.background = 'rgba(67, 83, 255, 0.1)')}
                        onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                      >
                        Cancel
                      </button>

                      <button
                        onClick={() => {
                          setShowWebflowCreditConfirmation(false);
                          handleWebflowUpload();
                        }}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: 'linear-gradient(135deg, #4353ff 0%, #00d4ff 100%)',
                          border: 'none',
                          color: '#0D1117',
                          borderRadius: '6px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                        onMouseEnter={(e) => (e.target.style.transform = 'translateY(-2px)')}
                        onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                        </svg>
                        Confirm & Upload
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ),
            document.body
          )}

          {/* Credit Error Modal */}
          {showCreditErrorModal && typeof window !== 'undefined' && createPortal(
            (
              <div className={styles.modalOverlay} onClick={() => setShowCreditErrorModal(false)} style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(5px)'
              }}>
                <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
                  background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  maxWidth: '450px',
                  width: '90%'
                }}>
                  <div className={styles.modalHeader} style={{
                    borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
                    paddingBottom: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <h3 className={styles.modalTitle} style={{
                      color: '#ff6b6b',
                      fontSize: '1.5rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      Insufficient Credits
                    </h3>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => setShowCreditErrorModal(false)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ff6b6b',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => (e.target.style.background = 'rgba(239, 68, 68, 0.2)')}
                      onMouseLeave={(e) => (e.target.style.background = 'rgba(239, 68, 68, 0.1)')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>

                  <div className={styles.modalBody}>
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '8px',
                      padding: '1.5rem',
                      marginBottom: '1.5rem',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.1) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem'
                      }}>
                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff6b6b' }}>!</span>
                      </div>

                      <p style={{
                        fontSize: '1rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                        marginBottom: '1rem',
                        lineHeight: '1.5'
                      }}>
                        {creditErrorMessage}
                      </p>

                      <div style={{
                        fontSize: '0.9rem',
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontStyle: 'italic'
                      }}>
                        Purchase more credits to continue using this feature
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '1rem',
                      justifyContent: 'center'
                    }}>
                      <button
                        onClick={() => {
                          setShowCreditErrorModal(false);
                          // Navigate to pricing page
                          router.push('/pricing');
                        }}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: 'linear-gradient(135deg, #00D4FF 0%, #0095CC 100%)',
                          border: 'none',
                          color: '#0D1117',
                          borderRadius: '6px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                        onMouseEnter={(e) => (e.target.style.transform = 'translateY(-2px)')}
                        onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="9" cy="21" r="1"/>
                          <circle cx="20" cy="21" r="1"/>
                          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                        </svg>
                        Buy Credits
                      </button>

                      <button
                        onClick={() => setShowCreditErrorModal(false)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: 'transparent',
                          border: '1px solid rgba(0, 212, 255, 0.3)',
                          color: '#00D4FF',
                          borderRadius: '6px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => (e.target.style.background = 'rgba(0, 212, 255, 0.1)')}
                        onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ),
            document.body
          )}

          {/* Google Docs Credit Confirmation Modal */}
          {showGoogleDocsCreditConfirmation && typeof window !== 'undefined' && createPortal(
            (
              <div className={styles.modalOverlay} onClick={() => setShowGoogleDocsCreditConfirmation(false)} style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(5px)'
              }}>
                <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
                  background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.98) 0%, rgba(76, 175, 80, 0.1) 100%)',
                  border: '1px solid rgba(76, 175, 80, 0.1)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  maxWidth: '450px',
                  width: '90%'
                }}>
                  <div className={styles.modalHeader} style={{
                    borderBottom: '1px solid rgba(76, 175, 80, 0.1)',
                    paddingBottom: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <h3 className={styles.modalTitle} style={{
                      color: '#4CAF50',
                      fontSize: '1.5rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9 12l2 2 4-4"/>
                      </svg>
                      Confirm Google Docs Conversion
                    </h3>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => setShowGoogleDocsCreditConfirmation(false)}
                      style={{
                        background: 'rgba(76, 175, 80, 0.1)',
                        border: '1px solid rgba(76, 175, 80, 0.2)',
                        color: '#4CAF50',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => (e.target.style.background = 'rgba(76, 175, 80, 0.2)')}
                      onMouseLeave={(e) => (e.target.style.background = 'rgba(76, 175, 80, 0.1)')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>

                  <div className={styles.modalBody}>
                    <div style={{
                      background: 'rgba(76, 175, 80, 0.1)',
                      border: '1px solid rgba(76, 175, 80, 0.2)',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1.5rem'
                    }}>
                      <p style={{
                        fontSize: '1rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                        marginBottom: '1rem',
                        lineHeight: '1.5'
                      }}>
                        Converting "<strong>{title}</strong>" to Google Docs will consume <strong>1 credit</strong> from your account.
                      </p>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '6px',
                        marginBottom: '1rem'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>
                            Current credits:
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#4CAF50' }}>
                            {creditsRemaining || 0}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>
                            After conversion:
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#ff6b6b' }}>
                            {(creditsRemaining || 0) - 1}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        fontSize: '0.85rem',
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontStyle: 'italic',
                        textAlign: 'center'
                      }}>
                        Credits will be refunded if the conversion fails
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '1rem',
                      justifyContent: 'flex-end'
                    }}>
                      <button
                        onClick={() => setShowGoogleDocsCreditConfirmation(false)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: 'transparent',
                          border: '1px solid rgba(76, 175, 80, 0.3)',
                          color: '#4CAF50',
                          borderRadius: '6px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => (e.target.style.background = 'rgba(76, 175, 80, 0.1)')}
                        onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                      >
                        Cancel
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            setIsConvertingToDocs(true);
                            setShowGoogleDocsCreditConfirmation(false);
                            setShowGoogleDocsModal(true);  // Show conversion modal immediately
                            setGoogleDocsData(null);

                            // Deduct credits atomically
                            const creditsRequired = 1;
                            console.log(`🔒 Attempting atomic credit deduction for Google Docs conversion (${creditsRequired} credits)...`);
                            const creditResult = await deductCreditsAtomic(user.uid, creditsRequired);

                            if (!creditResult.success) {
                              throw new Error(creditResult.error || 'Failed to deduct credits');
                            }

                            console.log('✅ Credits deducted successfully, proceeding with Google Docs conversion...');
                            refetchSubscription();

                            // Proceed with conversion immediately
                            await performGoogleDocsConversion();
                          } catch (error) {
                            console.error('Google Docs conversion failed:', error);
                            setGoogleDocsError({
                              message: error.message,
                              type: error.message.includes('auth') || error.message.includes('permission') ? 'auth' :
                                    error.message.includes('network') || error.message.includes('fetch') ? 'network' :
                                    error.message.includes('quota') || error.message.includes('limit') ? 'quota' : 'general'
                            });
                            setIsConvertingToDocs(false);
                            // Keep modal open to show error

                            // Refund credits on failure
                            console.log('🔄 Google Docs conversion failed, attempting to refund credits...');
                            try {
                              const refundResult = await refundCredits(user.uid, 1);
                              if (refundResult.success) {
                                console.log('✅ Credits refunded successfully');
                                refetchSubscription();
                              } else {
                                console.error('❌ Failed to refund credits:', refundResult.error);
                              }
                            } catch (refundError) {
                              console.error('❌ Critical error during credit refund:', refundError);
                            }
                          }
                        }}
                        disabled={isConvertingToDocs}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: isConvertingToDocs ? '#ccc' : 'linear-gradient(135deg, #4CAF50 0%, #00a046 100%)',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '6px',
                          fontWeight: '600',
                          cursor: isConvertingToDocs ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                        onMouseEnter={(e) => !isConvertingToDocs && (e.target.style.transform = 'translateY(-2px)')}
                        onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
                      >
                        {isConvertingToDocs ? (
                          <>
                            <div style={{
                              width: '16px',
                              height: '16px',
                              border: '2px solid #fff',
                              borderTop: '2px solid transparent',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite'
                            }} />
                            Converting...
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <path d="M12 11v6"/>
                              <path d="M9 14h6"/>
                            </svg>
                            Confirm & Convert
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ),
            document.body
          )}

          {/* Version History Modal */}
          {versioningState.showVersionModal && typeof window !== 'undefined' && createPortal(
            (
              <div className={styles.modalOverlay} onClick={() => versioningActions.hideModal()} style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(5px)'
              }}>
                <div 
                  className={styles.modal} 
                  role="dialog" 
                  aria-modal="true" 
                  onClick={(e) => e.stopPropagation()}
                  style={{ 
                    maxWidth: '600px', 
                    maxHeight: '80vh', 
                    overflow: 'auto',
                    background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)',
                    border: '1px solid rgba(0, 212, 255, 0.1)',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                    color: 'white'
                  }}
                >
                  <div className={styles.modalHeader} style={{
                    borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
                    paddingBottom: '1rem'
                  }}>
                    <h3 className={styles.modalTitle} style={{ color: '#00D4FF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v20M2 12h20"/>
                        <path d="M5 19l7-7 7 7M5 5l7 7 7-7"/>
                      </svg>
                      Version History
                    </h3>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => versioningActions.hideModal()}
                      style={{
                        background: 'rgba(0, 212, 255, 0.1)',
                        border: '1px solid rgba(0, 212, 255, 0.2)',
                        color: '#00D4FF',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => (e.target.style.background = 'rgba(0, 212, 255, 0.2)')}
                      onMouseLeave={(e) => (e.target.style.background = 'rgba(0, 212, 255, 0.1)')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                  
                  <div className={styles.modalBody}>
                    {/* Current Version Info */}
                    {versioningState.currentVersion && (
                      <div style={{
                        padding: '1rem',
                        background: 'rgba(0, 212, 255, 0.1)',
                        border: '1px solid rgba(0, 212, 255, 0.2)',
                        borderRadius: '8px',
                        marginBottom: '1rem'
                      }}>
                        <h4 style={{ marginBottom: '0.5rem', color: '#00D4FF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Current Version
                        </h4>
                        <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
                          <div style={{ fontWeight: '600', fontSize: '1rem', color: 'white', marginBottom: '0.25rem' }}>Version {versioningState.currentVersion?.versionNumber || 1}</div>
                          <div style={{ fontSize: '0.85rem' }}>Last saved: {versioningState.currentVersion?.lastModified ? new Date(versioningState.currentVersion.lastModified).toLocaleString() : new Date().toLocaleString()}</div>
                        </div>
                      </div>
                    )}
                    
                    {/* Version List */}
                    <div>
                      <h4 style={{ marginBottom: '1rem', color: 'white' }}>Previous Versions</h4>
                      {versioningState.versions.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {versioningState.versions.map((version, index) => {
                            // Don't show the current version in the history list
                            if (versioningState.currentVersion && version.versionNumber === versioningState.currentVersion.versionNumber) {
                              return null;
                            }

                            const versionNum = version.versionNumber || (versioningState.versions.length - index);
                            const timeAgo = version.savedAt ? getTimeAgo(new Date(version.savedAt)) : 'Unknown time';
                            
                            return (
                              <div 
                                key={version.id}
                                style={{
                                  padding: '1rem',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: 'white', fontSize: '1rem' }}>
                                      Version {versionNum}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                                      Saved {timeAgo} • {version.savedAt ? new Date(version.savedAt).toLocaleDateString() : ''}
                                    </div>
                                  </div>
                                  <button
                                    className={styles.primaryButton}
                                    onClick={() => handleSwitchVersion(version.id, versionNum)}
                                    disabled={versioningState.loadingVersions}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: 'linear-gradient(135deg, #00D4FF 0%, #0095CC 100%)',
                                      border: 'none',
                                      color: '#0D1117',
                                      borderRadius: '6px',
                                      fontWeight: '600',
                                      opacity: versioningState.loadingVersions ? 0.5 : 1,
                                      cursor: versioningState.loadingVersions ? 'not-allowed' : 'pointer',
                                      transition: 'all 0.2s',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.25rem'
                                    }}
                                    onMouseEnter={(e) => !versioningState.loadingVersions && (e.target.style.transform = 'translateY(-2px)')}
                                    onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
                                  >
                                    {versioningState.loadingVersions ? (
                                      <div style={{
                                        width: '12px',
                                        height: '12px',
                                        border: '2px solid rgba(13, 17, 23, 0.3)',
                                        borderTop: '2px solid #0D1117',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                      }} />
                                    ) : (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="11 17 6 12 11 7"/>
                                        <path d="M18 12H6"/>
                                      </svg>
                                    )}
                                    Restore
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{
                          padding: '2rem',
                          textAlign: 'center',
                          color: 'rgba(255,255,255,0.5)'
                        }}>
                          No previous versions available yet.
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className={styles.modalActions} style={{
                    borderTop: '1px solid rgba(0, 212, 255, 0.1)',
                    paddingTop: '1rem'
                  }}>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => versioningActions.hideModal()}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        color: '#00D4FF',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '6px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => (e.target.style.background = 'rgba(0, 212, 255, 0.1)')}
                      onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            ),
            document.body
          )}
          
          {/* Image Generation Loading Modal */}
          {showImageGenerationModal && typeof window !== 'undefined' && createPortal(
            (
              <div className={styles.modalOverlay} style={{
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000
              }}>
                <div 
                  className={styles.modal}
                  style={{
                    maxWidth: '480px',
                    width: '90%',
                    background: 'linear-gradient(135deg, #1a1f2e 0%, #2d3748 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    borderRadius: '16px',
                    animation: 'slideUp 0.3s ease-out',
                    padding: '2.5rem'
                  }}
                >
                  <style jsx>{`
                    @keyframes slideUp {
                      from {
                        opacity: 0;
                        transform: translateY(20px);
                      }
                      to {
                        opacity: 1;
                        transform: translateY(0);
                      }
                    }
                    @keyframes pulse {
                      0%, 100% {
                        opacity: 1;
                      }
                      50% {
                        opacity: 0.7;
                      }
                    }
                    @keyframes gradientRotate {
                      0% {
                        transform: rotate(0deg);
                      }
                      100% {
                        transform: rotate(360deg);
                      }
                    }
                    @keyframes spin {
                      from { transform: rotate(0deg); }
                      to { transform: rotate(360deg); }
                    }
                  `}</style>
                  
                  <div style={{
                    textAlign: 'center'
                  }}>
                    {imageGenerationError ? (
                      // Error state
                      <>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.1) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 2rem'
                        }}>
                          <span style={{ fontSize: '24px', fontWeight: 'bold' }}>ERROR</span>
                        </div>

                        <h3 style={{
                          fontSize: '1.75rem',
                          fontWeight: '600',
                          color: '#ff6b6b',
                          marginBottom: '0.75rem',
                          letterSpacing: '-0.5px'
                        }}>
                          Generation Failed
                        </h3>

                        <p style={{
                          fontSize: '1rem',
                          color: 'rgba(255, 255, 255, 0.7)',
                          marginBottom: '1rem',
                          lineHeight: '1.5'
                        }}>
                          {imageGenerationError.message}
                        </p>

                        {/* Specific error messages based on type */}
                        {imageGenerationError.type === 'auth' && (
                          <div style={{
                            padding: '1rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '8px',
                            marginBottom: '2rem'
                          }}>
                            <p style={{
                              fontSize: '0.85rem',
                              color: 'rgba(255, 255, 255, 0.8)',
                              margin: 0
                            }}>
                              <strong>Authentication Issue:</strong> Please try refreshing the page or logging in again.
                            </p>
                          </div>
                        )}

                        {imageGenerationError.type === 'network' && (
                          <div style={{
                            padding: '1rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '8px',
                            marginBottom: '2rem'
                          }}>
                            <p style={{
                              fontSize: '0.85rem',
                              color: 'rgba(255, 255, 255, 0.8)',
                              margin: 0
                            }}>
                              <strong>Network Issue:</strong> Check your internet connection and try again.
                            </p>
                          </div>
                        )}

                        <div style={{
                          display: 'flex',
                          gap: '1rem',
                          justifyContent: 'center',
                          marginTop: '2rem'
                        }}>
                          <button
                            onClick={handleRetryImageGeneration}
                            disabled={isGeneratingImage}
                            style={{
                              padding: '0.75rem 1.5rem',
                              background: 'linear-gradient(135deg, #00D4FF 0%, #0095CC 100%)',
                              border: 'none',
                              color: 'white',
                              borderRadius: '6px',
                              fontWeight: '600',
                              cursor: isGeneratingImage ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              opacity: isGeneratingImage ? 0.6 : 1,
                              boxShadow: '0 4px 15px rgba(0, 212, 255, 0.3)'
                            }}
                            onMouseEnter={(e) => !isGeneratingImage && (e.target.style.transform = 'translateY(-2px)')}
                            onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="23 4 23 10 17 10"/>
                              <polyline points="1 20 1 14 7 14"/>
                              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                            </svg>
                            Try Again
                          </button>

                          <button
                            onClick={() => {
                              setShowImageGenerationModal(false);
                              setImageGenerationError(null);
                            }}
                            style={{
                              padding: '0.75rem 1.5rem',
                              background: 'transparent',
                              border: '1px solid rgba(0, 212, 255, 0.3)',
                              color: '#00D4FF',
                              borderRadius: '6px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => (e.target.style.background = 'rgba(0, 212, 255, 0.1)')}
                            onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                          >
                            Close
                          </button>
                        </div>
                      </>
                    ) : (
                      // Loading state
                      <>
                        {/* Circular Progress Indicator - Fixed */}
                        <div style={{
                          width: '100px',
                          height: '100px',
                          margin: '0 auto 2rem',
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {/* Outer gradient ring */}
                          <svg
                            style={{
                              position: 'absolute',
                              width: '100px',
                              height: '100px',
                              transform: 'rotate(-90deg)',
                              animation: 'gradientRotate 3s linear infinite'
                            }}
                          >
                            <defs>
                              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#f093fb" />
                                <stop offset="100%" stopColor="#f5576c" />
                              </linearGradient>
                            </defs>
                            <circle
                              cx="50"
                              cy="50"
                              r="45"
                              stroke="url(#progressGradient)"
                              strokeWidth="3"
                              fill="none"
                              strokeDasharray={`${2 * Math.PI * 45 * (Math.max(0, Math.min(100, imageGenerationProgress)) / 100)} ${2 * Math.PI * 45}`}
                              strokeLinecap="round"
                              style={{
                                transition: 'stroke-dasharray 0.5s ease-out'
                              }}
                            />
                          </svg>

                          {/* Background circle */}
                          <div style={{
                            position: 'absolute',
                            width: '90px',
                            height: '90px',
                            borderRadius: '50%',
                            border: '2px solid rgba(255, 255, 255, 0.05)',
                            background: 'rgba(0, 0, 0, 0.2)'
                          }} />

                          {/* Center icon container with proper background */}
                          <div style={{
                            position: 'relative',
                            width: '70px',
                            height: '70px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(240, 147, 251, 0.1) 0%, rgba(245, 87, 108, 0.1) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2
                          }}>
                            <span style={{
                              fontSize: '28px',
                              animation: 'pulse 2s ease-in-out infinite'
                            }}>
                              AI
                            </span>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 style={{
                          fontSize: '1.75rem',
                          fontWeight: '600',
                          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          marginBottom: '0.75rem',
                          letterSpacing: '-0.5px'
                        }}>
                          Generating AI Image
                        </h3>

                        {/* Status message */}
                        <p style={{
                          fontSize: '1rem',
                          color: 'rgba(255, 255, 255, 0.7)',
                          marginBottom: '2rem',
                          minHeight: '24px',
                          fontWeight: '400'
                        }}>
                          {imageGenerationStatus || 'Initializing...'}
                        </p>

                        {/* Progress bar container */}
                        <div style={{
                          width: '100%',
                          height: '6px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                          marginBottom: '0.75rem',
                          position: 'relative'
                        }}>
                          {/* Progress fill with dot at the end */}
                          <div style={{
                            height: '100%',
                            width: `${Math.max(0, Math.min(100, imageGenerationProgress))}%`,
                            background: 'linear-gradient(90deg, #f093fb, #f5576c)',
                            borderRadius: '3px',
                            transition: 'width 0.5s ease-out',
                            position: 'relative'
                          }}>
                            {/* Leading dot */}
                            {imageGenerationProgress > 0 && imageGenerationProgress < 100 && (
                              <div style={{
                                position: 'absolute',
                                right: '-4px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '12px',
                                height: '12px',
                                background: '#f5576c',
                                borderRadius: '50%',
                                boxShadow: '0 0 8px rgba(245, 87, 108, 0.8)'
                              }} />
                            )}
                          </div>
                        </div>

                        {/* Progress percentage */}
                        <div style={{
                          fontSize: '0.9rem',
                          color: 'rgba(255, 255, 255, 0.5)',
                          marginBottom: '2rem',
                          fontWeight: '500'
                        }}>
                          {Math.round(Math.max(0, Math.min(100, imageGenerationProgress)))}% Complete
                        </div>

                        {/* Info message box */}
                        <div style={{
                          padding: '1rem 1.25rem',
                          background: 'rgba(240, 147, 251, 0.08)',
                          border: '1px solid rgba(240, 147, 251, 0.15)',
                          borderRadius: '12px',
                          marginBottom: '1.5rem'
                        }}>
                          <p style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.8)',
                            margin: 0,
                            lineHeight: '1.6'
                          }}>
                            AI is creating a unique, high-quality image tailored to your article. This typically takes 10-20 seconds.
                          </p>
                        </div>

                        {/* Dynamic tip */}
                        <div style={{
                          fontSize: '0.85rem',
                          color: 'rgba(255, 255, 255, 0.4)',
                          fontStyle: 'italic',
                          minHeight: '20px'
                        }}>
                          {imageGenerationProgress < 30 && "Tip: The AI analyzes your article title to create relevant imagery"}
                          {imageGenerationProgress >= 30 && imageGenerationProgress < 60 && "Tip: Each image is unique and created just for your content"}
                          {imageGenerationProgress >= 60 && imageGenerationProgress < 90 && "Tip: The image will be automatically inserted into your article"}
                          {imageGenerationProgress >= 90 && "Almost there! Finalizing your image..."}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ),
            document.body
          )}
          
          {/* Generated Image Modal */}
          {showImageModal && generatedImageUrl && typeof window !== 'undefined' && createPortal(
            (
              <div className={styles.modalOverlay} onClick={() => setShowImageModal(false)} style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(5px)'
              }}>
                <div 
                  className={styles.modal} 
                  role="dialog" 
                  aria-modal="true" 
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    maxWidth: '800px',
                    background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)',
                    border: '1px solid rgba(0, 212, 255, 0.1)',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                    color: 'white'
                  }}
                >
                  <div className={styles.modalHeader} style={{
                    borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
                    paddingBottom: '1rem'
                  }}>
                    <h3 className={styles.modalTitle} style={{ color: '#00D4FF' }}>Generated Image</h3>
                    <button 
                      className={styles.secondaryButton} 
                      onClick={() => setShowImageModal(false)}
                      style={{
                        background: 'rgba(0, 212, 255, 0.1)',
                        border: '1px solid rgba(0, 212, 255, 0.2)',
                        color: '#00D4FF',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => (e.target.style.background = 'rgba(0, 212, 255, 0.2)')}
                      onMouseLeave={(e) => (e.target.style.background = 'rgba(0, 212, 255, 0.1)')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                  
                  <div className={styles.modalBody} style={{ textAlign: 'center', position: 'relative', minHeight: '200px' }}>
                    {/* Loading indicator - will be hidden when image loads */}
                    <div 
                      id="imageLoadingIndicator"
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1rem'
                      }}
                    >
                      <div style={{
                        width: '40px',
                        height: '40px',
                        border: '3px solid rgba(0, 212, 255, 0.2)',
                        borderTop: '3px solid #00D4FF',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      <span style={{ color: '#00D4FF', fontSize: '0.875rem' }}>Loading image...</span>
                    </div>
                    
                    <img 
                      src={generatedImageUrl} 
                      alt={title} 
                      style={{
                        maxWidth: '100%',
                        maxHeight: '400px',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        opacity: 0,
                        transition: 'opacity 0.3s ease'
                      }}
                      onLoad={(e) => {
                        // Hide loading indicator and show image
                        const loader = document.getElementById('imageLoadingIndicator');
                        if (loader) loader.style.display = 'none';
                        e.target.style.opacity = '1';
                        console.log('Image loaded successfully in modal');
                      }}
                      onError={(e) => {
                        // Only log on first attempt, not on subsequent fallback attempts
                        const attempts = parseInt(e.target.dataset.attempts || '0');
                        const currentUrl = e.target.src;
                        
                        // Check if it's a Firebase Storage URL - these should work, so just show error
                        if (currentUrl.includes('firebasestorage.googleapis.com') || currentUrl.includes('storage.googleapis.com')) {
                          console.error('Firebase Storage image failed to load:', currentUrl);
                          const loader = document.getElementById('imageLoadingIndicator');
                          if (loader) {
                            loader.innerHTML = '<div style="color: #ef4444; text-align: center;"><p style="margin: 0 0 0.5rem 0;">Failed to load image</p><p style="margin: 0; font-size: 0.875rem; color: #999;">The image was generated but cannot be displayed</p></div>';
                          }
                          e.target.style.display = 'none';
                          return;
                        }
                        
                        // Hide failed image
                        console.error('Image failed to load:', currentUrl);
                        e.target.style.display = 'none';
                        
                        // Show error message
                        const loader = document.getElementById('imageLoadingIndicator');
                        if (loader) {
                          loader.innerHTML = '<div style="color: #ef4444; text-align: center;"><p style="margin: 0 0 0.5rem 0;">Failed to load image</p><p style="margin: 0; font-size: 0.875rem; color: #999;">Please try generating again</p></div>';
                        }
                      }}
                    />
                    
                  </div>
                  
                  <div className={styles.modalActions} style={{
                    borderTop: '1px solid rgba(0, 212, 255, 0.1)',
                    paddingTop: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <button 
                      className={styles.secondaryButton} 
                      onClick={() => setShowImageModal(false)}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        color: '#00D4FF',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '6px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => (e.target.style.background = 'rgba(0, 212, 255, 0.1)')}
                      onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            ),
            document.body
          )}

          {/* Insert Section Images Modal */}
          <InsertSectionImagesModal
            isOpen={showInjectImagesModal}
            onClose={handleCloseInjectImagesModal}
            sections={extractArticleSections()}
            selectedSections={selectedSectionsForImages}
            onSelectionChange={setSelectedSectionsForImages}
            onGenerate={handleInjectSectionImages}
            customPrompt={customSectionPrompt}
            onCustomPromptChange={setCustomSectionPrompt}
            isGenerating={isInjectingImages}
            progress={injectImagesProgress}
          />

          {/* Video Generation Modal */}
          {showVideoModal && typeof window !== 'undefined' && createPortal(
            (
              <div 
                className={styles.modalOverlay} 
                onClick={() => !isGeneratingVideo && setShowVideoModal(false)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.85)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem',
                  zIndex: 9999,
                  overflowY: 'auto'
                }}
              >
                <div 
                  className={styles.modal} 
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(128, 90, 213, 0.3)',
                    borderRadius: '16px',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                    width: '100%',
                    maxWidth: '680px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    margin: 'auto'
                  }}
                >
                  <div className={styles.modalHeader} style={{
                    position: 'sticky',
                    top: 0,
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
                    backdropFilter: 'blur(20px)',
                    zIndex: 10,
                    borderBottom: '1px solid rgba(128, 90, 213, 0.2)'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1rem 1.25rem'
                    }}>
                      <h3 style={{ 
                        color: '#a78bfa',
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span>🎥</span>
                        <span>Video Generation</span>
                      </h3>
                      <button 
                        onClick={() => !isGeneratingVideo && setShowVideoModal(false)}
                        disabled={isGeneratingVideo}
                        style={{
                          background: 'rgba(128, 90, 213, 0.1)',
                          border: '1px solid rgba(128, 90, 213, 0.3)',
                          color: '#a78bfa',
                          borderRadius: '6px',
                          padding: '0.4rem',
                          cursor: isGeneratingVideo ? 'not-allowed' : 'pointer',
                          opacity: isGeneratingVideo ? 0.5 : 1,
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          width: '32px',
                          height: '32px'
                        }}
                        onMouseEnter={(e) => !isGeneratingVideo && (e.currentTarget.style.background = 'rgba(128, 90, 213, 0.2)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(128, 90, 213, 0.1)')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                    
                    {/* Tabs */}
                    <div style={{
                      display: 'flex',
                      gap: '0.5rem',
                      padding: '0 1.25rem 0.75rem 1.25rem'
                    }}>
                      <button
                        onClick={() => setVideoModalTab('generate')}
                        style={{
                          flex: 1,
                          padding: '0.625rem 1rem',
                          background: videoModalTab === 'generate' 
                            ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)'
                            : 'rgba(128, 90, 213, 0.1)',
                          border: videoModalTab === 'generate'
                            ? '1px solid rgba(167, 139, 250, 0.5)'
                            : '1px solid rgba(128, 90, 213, 0.2)',
                          borderRadius: '6px',
                          color: videoModalTab === 'generate' ? '#a78bfa' : 'rgba(167, 139, 250, 0.6)',
                          fontWeight: videoModalTab === 'generate' ? '600' : '500',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        Generate
                      </button>
                      <button
                        onClick={() => setVideoModalTab('status')}
                        style={{
                          flex: 1,
                          padding: '0.625rem 1rem',
                          background: videoModalTab === 'status'
                            ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)'
                            : 'rgba(128, 90, 213, 0.1)',
                          border: videoModalTab === 'status'
                            ? '1px solid rgba(167, 139, 250, 0.5)'
                            : '1px solid rgba(128, 90, 213, 0.2)',
                          borderRadius: '6px',
                          color: videoModalTab === 'status' ? '#a78bfa' : 'rgba(167, 139, 250, 0.6)',
                          fontWeight: videoModalTab === 'status' ? '600' : '500',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          position: 'relative'
                        }}
                      >
                        Status
                        {activeVideoGenerations.filter(g => g.status === 'processing').length > 0 && (
                          <span style={{
                            position: 'absolute',
                            top: '-4px',
                            right: '-4px',
                            background: '#a78bfa',
                            color: '#1a1a2e',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            fontSize: '0.7rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700'
                          }}>
                            {activeVideoGenerations.filter(g => g.status === 'processing').length}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className={styles.modalBody} style={{ 
                    padding: '1rem 1.25rem',
                    paddingBottom: 0
                  }}>
                    {videoModalTab === 'generate' ? (
                      // GENERATE TAB
                      <>
                    {isGeneratingVideo ? (
                      // Generating state
                      <div style={{
                        padding: '2rem',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1.5rem'
                      }}>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          border: '4px solid rgba(167, 139, 250, 0.2)',
                          borderTop: '4px solid #a78bfa',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        
                        <div>
                          <p style={{
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            color: '#a78bfa',
                            marginBottom: '0.5rem'
                          }}>
                            {videoGenerationStatus}
                          </p>
                          <div style={{
                            width: '100%',
                            height: '8px',
                            background: 'rgba(128, 90, 213, 0.2)',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            marginTop: '1rem'
                          }}>
                            <div style={{
                              width: `${videoGenerationProgress}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                          <p style={{
                            fontSize: '0.85rem',
                            color: 'rgba(255, 255, 255, 0.6)',
                            marginTop: '0.5rem'
                          }}>
                            {videoGenerationProgress}% complete
                          </p>
                        </div>
                      </div>
                    ) : (
                      // Selection state
                      <>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            color: '#a78bfa',
                            fontWeight: '600',
                            fontSize: '0.875rem'
                          }}>
                            Select FAQ
                          </label>
                          <select
                            value={selectedFaqForVideo?.id || ''}
                            onChange={(e) => {
                              const faq = extractFAQsFromArticle().find(f => f.id === e.target.value);
                              setSelectedFaqForVideo(faq);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.625rem 0.75rem',
                              background: 'rgba(0, 0, 0, 0.3)',
                              border: '1px solid rgba(128, 90, 213, 0.3)',
                              borderRadius: '6px',
                              color: 'white',
                              fontSize: '0.875rem',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="">Choose FAQ...</option>
                            {extractFAQsFromArticle().map((faq, index) => (
                              <option key={faq.id} value={faq.id}>
                                #{index + 1}: {faq.question.substring(0, 50)}...
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedFaqForVideo && (
                          <>
                            <div style={{
                              background: 'rgba(128, 90, 213, 0.08)',
                              border: '1px solid rgba(128, 90, 213, 0.15)',
                              borderRadius: '6px',
                              padding: '0.75rem',
                              marginBottom: '1rem'
                            }}>
                              <p style={{
                                fontSize: '0.8rem',
                                color: 'rgba(167, 139, 250, 0.9)',
                                marginBottom: '0.35rem',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                Preview
                              </p>
                              <p style={{
                                fontSize: '0.875rem',
                                color: 'white',
                                marginBottom: 0,
                                lineHeight: '1.4'
                              }}>
                                {selectedFaqForVideo.question}
                              </p>
                            </div>

                            <div style={{ 
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '0.75rem',
                              marginBottom: '1rem'
                            }}>
                              {/* Duration */}
                              <div>
                                <label style={{
                                  display: 'block',
                                  marginBottom: '0.5rem',
                                  color: '#a78bfa',
                                  fontWeight: '600',
                                  fontSize: '0.875rem'
                                }}>
                                  Duration: {videoDuration}s
                                </label>
                                <input
                                  type="range"
                                  min="10"
                                  max="120"
                                  value={videoDuration}
                                  onChange={(e) => setVideoDuration(parseInt(e.target.value))}
                                  style={{
                                    width: '100%',
                                    height: '6px',
                                    cursor: 'pointer',
                                    accentColor: '#a78bfa'
                                  }}
                                />
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '0.7rem',
                                  color: 'rgba(255, 255, 255, 0.4)',
                                  marginTop: '0.25rem'
                                }}>
                                  <span>10s</span>
                                  <span>120s</span>
                                </div>
                              </div>
                              
                              {/* Quality */}
                              <div>
                                <label style={{
                                  display: 'block',
                                  marginBottom: '0.5rem',
                                  color: '#a78bfa',
                                  fontWeight: '600',
                                  fontSize: '0.875rem'
                                }}>
                                  Quality
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    onClick={() => setVideoOptions({...videoOptions, quality: 'SD'})}
                                    style={{
                                      flex: 1,
                                      padding: '0.5rem',
                                      background: videoOptions.quality === 'SD' 
                                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                        : 'rgba(128, 90, 213, 0.1)',
                                      border: videoOptions.quality === 'SD'
                                        ? '1.5px solid rgba(167, 139, 250, 0.5)'
                                        : '1px solid rgba(128, 90, 213, 0.25)',
                                      color: 'white',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontWeight: '600',
                                      fontSize: '0.8rem',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    720p
                                  </button>
                                  <button
                                    onClick={() => setVideoOptions({...videoOptions, quality: 'HD'})}
                                    style={{
                                      flex: 1,
                                      padding: '0.5rem',
                                      background: videoOptions.quality === 'HD' 
                                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                        : 'rgba(128, 90, 213, 0.1)',
                                      border: videoOptions.quality === 'HD'
                                        ? '1.5px solid rgba(167, 139, 250, 0.5)'
                                        : '1px solid rgba(128, 90, 213, 0.25)',
                                      color: 'white',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontWeight: '600',
                                      fontSize: '0.8rem',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    1080p
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Emotion & Caption Row */}
                            <div style={{ 
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '0.75rem',
                              marginBottom: '1rem'
                            }}>
                              {/* Emotion */}
                              <div>
                                <label style={{
                                  display: 'block',
                                  marginBottom: '0.5rem',
                                  color: '#a78bfa',
                                  fontWeight: '600',
                                  fontSize: '0.875rem'
                                }}>
                                  Emotion
                                </label>
                                <select
                                  value={videoOptions.emotion}
                                  onChange={(e) => setVideoOptions({...videoOptions, emotion: e.target.value})}
                                  style={{
                                    width: '100%',
                                    padding: '0.625rem 0.75rem',
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    border: '1px solid rgba(128, 90, 213, 0.3)',
                                    borderRadius: '6px',
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <option value="Friendly">😊 Friendly</option>
                                  <option value="Excited">🎉 Excited</option>
                                  <option value="Serious">💼 Serious</option>
                                  <option value="Soothing">😌 Soothing</option>
                                  <option value="Broadcaster">📢 Broadcaster</option>
                                </select>
                              </div>
                              
                              {/* Caption Toggle */}
                              <div>
                                <label style={{
                                  display: 'block',
                                  marginBottom: '0.5rem',
                                  color: '#a78bfa',
                                  fontWeight: '600',
                                  fontSize: '0.875rem'
                                }}>
                                  Captions
                                </label>
                                <label style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  cursor: 'pointer',
                                  padding: '0.625rem 0.75rem',
                                  background: videoOptions.caption ? 'rgba(128, 90, 213, 0.15)' : 'rgba(128, 90, 213, 0.08)',
                                  border: '1px solid rgba(128, 90, 213, 0.25)',
                                  borderRadius: '6px',
                                  transition: 'all 0.2s'
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={videoOptions.caption}
                                    onChange={(e) => setVideoOptions({...videoOptions, caption: e.target.checked})}
                                    style={{
                                      width: '16px',
                                      height: '16px',
                                      cursor: 'pointer',
                                      accentColor: '#a78bfa'
                                    }}
                                  />
                                  <span style={{
                                    color: 'white',
                                    fontSize: '0.875rem'
                                  }}>
                                    Enable subtitles
                                  </span>
                                </label>
                              </div>
                            </div>

                            {/* Advanced Options Toggle */}
                            <button
                              onClick={() => {
                                setShowAdvancedOptions(!showAdvancedOptions);
                                if (!showAdvancedOptions && user) {
                                  fetchAvatars();
                                  fetchVoices();
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '0.625rem 0.75rem',
                                background: showAdvancedOptions 
                                  ? 'rgba(128, 90, 213, 0.15)'
                                  : 'rgba(128, 90, 213, 0.08)',
                                border: '1px solid rgba(128, 90, 213, 0.25)',
                                color: '#a78bfa',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '0.875rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                marginBottom: showAdvancedOptions ? '0.75rem' : '0',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <span style={{ fontSize: '1rem' }}>⚙️</span>
                              <span>{showAdvancedOptions ? 'Hide' : 'Show'} Advanced</span>
                              <span style={{ 
                                fontSize: '0.7rem',
                                transition: 'transform 0.2s ease',
                                display: 'inline-block',
                                transform: showAdvancedOptions ? 'rotate(180deg)' : 'rotate(0deg)'
                              }}>
                                ▼
                              </span>
                            </button>

                            {/* Advanced Options Panel */}
                            {showAdvancedOptions && (
                              <div style={{
                                background: 'rgba(0, 0, 0, 0.15)',
                                border: '1px solid rgba(128, 90, 213, 0.2)',
                                borderRadius: '6px',
                                padding: '0.75rem',
                                marginBottom: '0.75rem'
                              }}>
                                {/* Avatar Selection */}
                                <div style={{ marginBottom: '0.75rem' }}>
                                  <label style={{
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    color: '#a78bfa',
                                    fontWeight: '600',
                                    fontSize: '0.875rem'
                                  }}>
                                    Avatar {loadingAvatars && <span style={{fontWeight: 'normal', fontSize: '0.75rem'}}>(Loading...)</span>}
                                  </label>
                                  <select
                                    value={videoOptions.avatarId}
                                    onChange={(e) => setVideoOptions({...videoOptions, avatarId: e.target.value})}
                                    disabled={loadingAvatars}
                                    style={{
                                      width: '100%',
                                      padding: '0.625rem 0.75rem',
                                      background: 'rgba(0, 0, 0, 0.3)',
                                      border: '1px solid rgba(128, 90, 213, 0.3)',
                                      borderRadius: '6px',
                                      color: 'white',
                                      fontSize: '0.875rem',
                                      cursor: loadingAvatars ? 'wait' : 'pointer'
                                    }}
                                  >
                                    <option value="Daisy-inskirt-20220818">Daisy (Default)</option>
                                    {availableAvatars.map(avatar => (
                                      <option key={avatar.avatar_id} value={avatar.avatar_id}>
                                        {avatar.avatar_name} {avatar.gender ? `(${avatar.gender})` : ''}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Voice Selection */}
                                <div style={{ marginBottom: '0.75rem' }}>
                                  <label style={{
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    color: '#a78bfa',
                                    fontWeight: '600',
                                    fontSize: '0.875rem'
                                  }}>
                                    Voice {loadingVoices && <span style={{fontWeight: 'normal', fontSize: '0.75rem'}}>(Loading...)</span>}
                                  </label>
                                  <select
                                    value={videoOptions.voiceId}
                                    onChange={(e) => setVideoOptions({...videoOptions, voiceId: e.target.value})}
                                    disabled={loadingVoices}
                                    style={{
                                      width: '100%',
                                      padding: '0.625rem 0.75rem',
                                      background: 'rgba(0, 0, 0, 0.3)',
                                      border: '1px solid rgba(128, 90, 213, 0.3)',
                                      borderRadius: '6px',
                                      color: 'white',
                                      fontSize: '0.875rem',
                                      cursor: loadingVoices ? 'wait' : 'pointer'
                                    }}
                                  >
                                    <option value="1bd001e7e50f421d891986aad5158bc8">Sara - Cheerful</option>
                                    {availableVoices.map(voice => (
                                      <option key={voice.voice_id} value={voice.voice_id}>
                                        {voice.display_name || voice.name} {voice.language ? `[${voice.language}]` : ''}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Speed & Pitch Grid */}
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr',
                                  gap: '0.75rem'
                                }}>
                                  {/* Voice Speed */}
                                  <div>
                                    <label style={{
                                      display: 'block',
                                      marginBottom: '0.5rem',
                                      color: '#a78bfa',
                                      fontWeight: '600',
                                      fontSize: '0.875rem'
                                    }}>
                                      Speed: {videoOptions.speed}x
                                    </label>
                                    <input
                                      type="range"
                                      min="0.5"
                                      max="1.5"
                                      step="0.1"
                                      value={videoOptions.speed}
                                      onChange={(e) => setVideoOptions({...videoOptions, speed: parseFloat(e.target.value)})}
                                      style={{
                                        width: '100%',
                                        height: '6px',
                                        cursor: 'pointer',
                                        accentColor: '#a78bfa'
                                      }}
                                    />
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      fontSize: '0.7rem',
                                      color: 'rgba(255, 255, 255, 0.4)',
                                      marginTop: '0.25rem'
                                    }}>
                                      <span>0.5x</span>
                                      <span>1.5x</span>
                                    </div>
                                  </div>

                                  {/* Voice Pitch */}
                                  <div>
                                    <label style={{
                                      display: 'block',
                                      marginBottom: '0.5rem',
                                      color: '#a78bfa',
                                      fontWeight: '600',
                                      fontSize: '0.875rem'
                                    }}>
                                      Pitch: {videoOptions.pitch > 0 ? '+' : ''}{videoOptions.pitch}
                                    </label>
                                    <input
                                      type="range"
                                      min="-50"
                                      max="50"
                                      step="5"
                                      value={videoOptions.pitch}
                                      onChange={(e) => setVideoOptions({...videoOptions, pitch: parseInt(e.target.value)})}
                                      style={{
                                        width: '100%',
                                        height: '6px',
                                        cursor: 'pointer',
                                        accentColor: '#a78bfa'
                                      }}
                                    />
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      fontSize: '0.7rem',
                                      color: 'rgba(255, 255, 255, 0.4)',
                                      marginTop: '0.25rem'
                                    }}>
                                      <span>-50</span>
                                      <span>+50</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {/* Modal Actions for Generate Tab */}
                    {!isGeneratingVideo && (
                      <div className={styles.modalActions} style={{
                      borderTop: '1px solid rgba(128, 90, 213, 0.2)',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      gap: '0.75rem',
                      justifyContent: 'flex-end',
                      position: 'sticky',
                      bottom: 0,
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
                      backdropFilter: 'blur(20px)'
                    }}>
                      <button
                        onClick={() => setShowVideoModal(false)}
                        style={{
                          padding: '0.65rem 1.25rem',
                          background: 'transparent',
                          border: '1px solid rgba(128, 90, 213, 0.3)',
                          color: '#a78bfa',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.875rem',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(128, 90, 213, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleGenerateFaqVideo}
                        disabled={!selectedFaqForVideo}
                        style={{
                          padding: '0.65rem 1.5rem',
                          background: selectedFaqForVideo 
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : 'rgba(128, 90, 213, 0.3)',
                          border: 'none',
                          color: 'white',
                          borderRadius: '6px',
                          cursor: selectedFaqForVideo ? 'pointer' : 'not-allowed',
                          fontWeight: '600',
                          fontSize: '0.875rem',
                          opacity: selectedFaqForVideo ? 1 : 0.5,
                          transition: 'all 0.2s',
                          boxShadow: selectedFaqForVideo 
                            ? '0 4px 12px rgba(102, 126, 234, 0.3)'
                            : 'none'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedFaqForVideo) {
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedFaqForVideo) {
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                          }
                        }}
                      >
                        🎬 Generate Video
                      </button>
                    </div>
                    )}
                  </>
                  ) : (
                    // STATUS TAB
                    <div style={{ minHeight: '300px' }}>
                        {activeVideoGenerations.length === 0 ? (
                          <div style={{
                            padding: '3rem 2rem',
                            textAlign: 'center'
                          }}>
                            <div style={{
                              fontSize: '3rem',
                              marginBottom: '1rem',
                              opacity: 0.5
                            }}>
                              🎬
                            </div>
                            <p style={{
                              color: 'rgba(167, 139, 250, 0.6)',
                              fontSize: '0.95rem',
                              margin: 0
                            }}>
                              No video generations yet.<br />
                              Start generating videos from the Generate tab.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Status Tab Header with Clear Button */}
                            {activeVideoGenerations.some(g => g.status === 'completed') && (
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.5rem 0 0.75rem 0',
                                borderBottom: '1px solid rgba(128, 90, 213, 0.15)',
                                marginBottom: '0.75rem'
                              }}>
                                <span style={{
                                  fontSize: '0.875rem',
                                  color: 'rgba(167, 139, 250, 0.7)'
                                }}>
                                  {activeVideoGenerations.filter(g => g.status === 'processing').length} processing, {activeVideoGenerations.filter(g => g.status === 'completed').length} completed
                                </span>
                                <button
                                  onClick={() => {
                                    const confirmed = window.confirm('Clear all completed videos from this list? This will not delete the actual videos.');
                                    if (confirmed) {
                                      setActiveVideoGenerations(prev => prev.filter(g => g.status !== 'completed'));
                                    }
                                  }}
                                  style={{
                                    padding: '0.4rem 0.75rem',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '6px',
                                    color: '#ef4444',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                >
                                  Clear Completed
                                </button>
                              </div>
                            )}
                            
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.75rem',
                              padding: '0 0 1rem 0'
                            }}>
                            {activeVideoGenerations.map((gen, index) => (
                              <div 
                                key={gen.faqId + gen.startTime}
                                style={{
                                  background: gen.status === 'completed' 
                                    ? 'rgba(34, 197, 94, 0.1)' 
                                    : 'rgba(128, 90, 213, 0.1)',
                                  border: gen.status === 'completed'
                                    ? '1px solid rgba(34, 197, 94, 0.3)'
                                    : '1px solid rgba(128, 90, 213, 0.2)',
                                  borderRadius: '8px',
                                  padding: '1rem',
                                  transition: 'all 0.3s'
                                }}
                              >
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '0.75rem',
                                  marginBottom: '0.75rem'
                                }}>
                                  <div style={{
                                    fontSize: '1.5rem',
                                    flexShrink: 0
                                  }}>
                                    {gen.status === 'completed' ? '✅' : '⏳'}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                      color: gen.status === 'completed' ? '#4ade80' : '#a78bfa',
                                      fontWeight: '600',
                                      fontSize: '0.875rem',
                                      marginBottom: '0.25rem'
                                    }}>
                                      {gen.status === 'completed' ? 'Completed' : 'Processing'}
                                    </div>
                                    <div style={{
                                      color: 'rgba(255, 255, 255, 0.9)',
                                      fontSize: '0.875rem',
                                      lineHeight: '1.4',
                                      wordBreak: 'break-word'
                                    }}>
                                      {gen.faqQuestion}
                                    </div>
                                  </div>
                                </div>

                                {/* Progress Bar */}
                                <div style={{
                                  width: '100%',
                                  height: '6px',
                                  background: gen.status === 'completed'
                                    ? 'rgba(34, 197, 94, 0.2)'
                                    : 'rgba(128, 90, 213, 0.2)',
                                  borderRadius: '3px',
                                  overflow: 'hidden',
                                  marginBottom: '0.5rem'
                                }}>
                                  <div style={{
                                    width: `${gen.progress}%`,
                                    height: '100%',
                                    background: gen.status === 'completed'
                                      ? 'linear-gradient(90deg, #22c55e 0%, #4ade80 100%)'
                                      : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                                    transition: 'width 0.5s ease'
                                  }} />
                                </div>

                                {/* Progress Percentage */}
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    color: 'rgba(255, 255, 255, 0.5)'
                                  }}>
                                    {gen.progress}% complete
                                  </span>
                                  {gen.status === 'processing' && (
                                    <span style={{
                                      fontSize: '0.75rem',
                                      color: 'rgba(167, 139, 250, 0.7)'
                                    }}>
                                      {Math.floor((Date.now() - gen.startTime) / 1000)}s elapsed
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          </>
                        )}
                      </div>
                  )}
                  </div>
                </div>
              </div>
            ),
            document.body
          )}

          {/* Video Generation Toast Notification */}
          {showVideoToast && typeof window !== 'undefined' && createPortal(
            <div className="video-toast" style={{
              position: 'fixed',
              top: '2rem',
              right: '2rem',
              zIndex: 99999,
              maxWidth: '450px',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(167, 139, 250, 0.5)',
              borderRadius: '12px',
              padding: '1.25rem 1.5rem',
              boxShadow: '0 20px 60px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
              animation: 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem'
            }}>
              <div style={{
                fontSize: '1.75rem',
                lineHeight: 1,
                flexShrink: 0
              }}>
                🎬
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '0.35rem',
                  lineHeight: 1.4
                }}>
                  Video Generation Started!
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: 'rgba(255, 255, 255, 0.9)',
                  lineHeight: 1.5
                }}>
                  Your video is generating on the server. It will automatically appear in the FAQ when ready.
                </div>
              </div>
              <button
                onClick={() => {
                  setShowVideoToast(false);
                  setTimeout(() => setVideoToastMessage(''), 500);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '0.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  width: '28px',
                  height: '28px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>,
            document.body
          )}


        </div>
      </div>
    </div>
  );
}

export default function ArticleViewPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading article...</div>}>
      <ArticleViewContent />
    </Suspense>
  );
}
