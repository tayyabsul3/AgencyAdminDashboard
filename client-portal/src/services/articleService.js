/**
 * Article Service for Firestore Operations
 * Handles all CRUD operations for keyword-based articles in Firestore
 * New structure: /users/{userId}/Key-word/{keyword}/json/{articleId}
 */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
  limit,
  collectionGroup
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Create a safe document ID from keyword
 * Preserves original keyword while ensuring Firestore compatibility
 * @param {string} keyword - The original keyword
 * @returns {string} - Safe document ID
 */
export const createSafeKeywordId = (keyword) => {
  if (!keyword || typeof keyword !== 'string') {
    throw new Error('Keyword must be a non-empty string');
  }
  
  // Firestore document IDs can contain Unicode characters
  // Just trim whitespace and ensure it's not empty
  const trimmed = keyword.trim();
  if (trimmed.length === 0) {
    throw new Error('Keyword cannot be empty or only whitespace');
  }
  
  return trimmed;
};

/**
 * Get a legacy article by ID from customers/{userId}/articles/{id}
 * Returns the raw Firestore data with timestamps converted to JS Dates
 */
export const getLegacyArticleById = async (userId, articleId) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }
  try {
    const articleRef = doc(db, 'customers', userId, 'articles', articleId);
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) return null;
    const data = articleDoc.data();
    return {
      id: articleDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || null,
      updatedAt: data.updatedAt?.toDate() || null
    };
  } catch (e) {
    console.error('Error getting legacy article by ID:', e);
    throw new Error(`Failed to get legacy article: ${e.message}`);
  }
};

/**
 * Get a unified article content JSON suitable for rendering to HTML
 * @param {string} userId
 * @param {{ id: string, source?: 'legacy'|'keyword', keywordId?: string }} params
 * @returns {Promise<{ id: string, title?: string, subtitle?: string } & Record<string, any>>}
 */
export const getUnifiedArticleContent = async (userId, params) => {
  const { id, source, keywordId } = params || {};
  if (!userId || !id) throw new Error('User ID and Article ID are required');

  // Keyword-based article
  if (source === 'keyword') {
    if (!keywordId) throw new Error('keywordId is required for keyword articles');
    const kwArticle = await getArticleById(userId, keywordId, id);
    if (!kwArticle) return null;

    // Debug logging
    console.log('getUnifiedArticleContent - kwArticle:', {
      hasRootTitle: !!kwArticle.title,
      rootTitle: kwArticle.title,
      jsonContentTitle: kwArticle.jsonContent?.title,
      keyword: kwArticle.keyword,
      hasVideos: !!kwArticle.videos,
      videosKeys: kwArticle.videos ? Object.keys(kwArticle.videos) : []
    });

    // Include the htmlContent if it exists at the root level
    const json = kwArticle.jsonContent || kwArticle.data || kwArticle;
    // Make sure htmlContent, title, meta_description, and videos are included in the response
    const result = {
      ...json,
      htmlContent: kwArticle.htmlContent || json.htmlContent || null,
      title: kwArticle.title || json.title || null, // Include root-level title (saved from edit)
      meta_description: kwArticle.meta_description || json.meta_description || null, // Include saved meta_description (edited version)
      videos: kwArticle.videos || json.videos || null, // Include saved video data
      _source: kwArticle._source || json._source || null
    };

    console.log('getUnifiedArticleContent - returning:', {
      hasTitle: !!result.title,
      title: result.title,
      hasVideos: !!result.videos,
      videosKeys: result.videos ? Object.keys(result.videos) : [],
      videos: result.videos
    });

    return result;
  }

  // Interview-based article
  if (source === 'interview') {
    if (!keywordId) throw new Error('topicId is required for interview articles');
    const interviewArticle = await getInterviewArticleById(userId, keywordId, id);
    if (!interviewArticle) return null;

    // Debug logging
    console.log('getUnifiedArticleContent - interviewArticle:', {
      hasRootTitle: !!interviewArticle.title,
      rootTitle: interviewArticle.title,
      jsonContentTitle: interviewArticle.jsonContent?.title,
      topic: interviewArticle.topic
    });

    // Include the htmlContent if it exists at the root level
    const json = interviewArticle.jsonContent || interviewArticle.data || interviewArticle;
    // Make sure htmlContent, title, and meta_description are included in the response
    const result = {
      ...json,
      htmlContent: interviewArticle.htmlContent || json.htmlContent || null,
      title: interviewArticle.title || json.title || null, // Include root-level title (saved from edit)
      meta_description: interviewArticle.meta_description || json.meta_description || null, // Include saved meta_description (edited version)
      _source: interviewArticle._source || json._source || null
    };

    console.log('getUnifiedArticleContent - returning interview:', {
      hasTitle: !!result.title,
      title: result.title
    });

    return result;
  }

  // Legacy article fallback
  const legacy = await getLegacyArticleById(userId, id);
  if (!legacy) return null;
  // Legacy flow usually stores generated article under article field
  const json = legacy.article || legacy.jsonContent || {
    title: legacy.title,
    subtitle: legacy.subtitle,
    intro_md: '',
  };
  // Include htmlContent, title, and meta_description for legacy articles too
  return {
    ...json,
    htmlContent: legacy.htmlContent || json.htmlContent || null,
    title: legacy.title || json.title || null, // Include root-level title (saved from edit)
    meta_description: legacy.meta_description || json.meta_description || null, // Include saved meta_description (edited version)
    _source: legacy._source || json._source || null
  };
};

/**
 * Get all user articles from both legacy and keyword-based structures and normalize them
 * - Legacy path: customers/{userId}/articles
 * - Keyword path: users/{userId}/Key-word/{keywordId}/json/{articleId}
 * Returns a unified array suitable for the dashboard list cards
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export const getAllArticlesUnified = async (userId) => {
   if (!userId) {
     throw new Error('User ID is required');
   }

   // Helper functions defined at the top to avoid hoisting issues
   const getLengthFromMaybeArray = (val) => {
     if (!val) return 0;
     if (Array.isArray(val)) return val.length;
     if (typeof val === 'object' && typeof val._length === 'number') return val._length;
     return 0;
   };

   const getQuestionCountFallback = (jc) => {
     if (!jc || typeof jc !== 'object') return 0;
     // Prefer FAQs length
     const faqsLen = getLengthFromMaybeArray(jc.faqs);
     if (faqsLen > 0) return faqsLen;
     // Otherwise compute from toc questions
     const toc = jc.toc;
     if (Array.isArray(toc)) {
       return toc.reduce((sum, sec) => sum + getLengthFromMaybeArray(sec?.questions), 0);
     }
     if (toc && typeof toc === 'object' && typeof toc._length === 'number') {
       let total = 0;
       const len = toc._length;
       for (let i = 0; i < len; i++) {
         const sec = toc[`item_${i}`];
         if (sec && typeof sec === 'object') {
           total += getLengthFromMaybeArray(sec.questions);
         }
       }
       return total;
     }
     return 0;
   };

   const getSectionCountFallback = (jc) => {
     if (!jc || typeof jc !== 'object') return 0;
     const tocLen = getLengthFromMaybeArray(jc.toc);
     return tocLen;
   };

   try {
     // 1) Load all articles from the unified storage path (includes both legacy and interview-based)
     const allArticles = await getUserArticles(userId);

     // Separate legacy articles from interview-based articles
     const legacyArticles = allArticles.filter(a => !a._source || a._source === 'legacy');
     const interviewArticles = allArticles.filter(a => a._source === 'interview' || a._source === 'voice' || a._source === 'text');

     const normalizedLegacy = legacyArticles.map(a => ({
       ...a,
       _source: 'legacy'
     }));

     const normalizedInterview = interviewArticles.map(a => ({
       ...a,
       // Keep the original _source (voice/text) or default to interview for legacy
       _source: a._source || 'interview'
       // Preserve actual status and journeyStatus from Firestore
     }));

     // 2) Load keyword-based articles across ALL keywords using a collectionGroup query
     //    This avoids relying on parent keyword docs existing, which can cause older
     //    articles (that lack parent docs) to disappear from the list once a new
     //    keyword doc is created.
     const allKeywordArticles = [];
     const allInterviewArticles = []; // Declare variable before use
     const cgSnapshot = await getDocs(collectionGroup(db, 'json'));
     cgSnapshot.forEach((docSnap) => {
       const path = docSnap.ref.path; // users/{uid}/Key-word/{keywordId}/json/{articleId} or users/{uid}/Interviews/{topicId}/json/{articleId}
       if (path.startsWith(`users/${userId}/Key-word/`)) {
         const data = docSnap.data();
         allKeywordArticles.push({
           id: docSnap.id,
           ...data,
           // Convert Firestore timestamps to JS Date
           createdAt: data.createdAt?.toDate() || null,
           updatedAt: data.updatedAt?.toDate() || null,
           _keywordId: path.split('/')[3] || null,
           _keyword: data.keyword || path.split('/')[3] || ''
         });
       } else if (path.startsWith(`users/${userId}/Interviews/`)) {
         const data = docSnap.data();
         allInterviewArticles.push({
           id: docSnap.id,
           ...data,
           // Convert Firestore timestamps to JS Date
           createdAt: data.createdAt?.toDate() || null,
           updatedAt: data.updatedAt?.toDate() || null,
           _topicId: path.split('/')[3] || null,
           _topic: data.topic || path.split('/')[3] || ''
         });
       }
     });

     // Normalize interview articles from the new Interviews collection
     const normalizedInterviewArticles = allInterviewArticles.map(item => {
       // Title can live in several places depending on how the doc was created
       // Check root level title first (where we save it when editing)
       const title =
         item.title ||  // Check root level title FIRST (saved from edit page)
         item.jsonContent?.title ||
         item.jsonContent?.data?.title ||
         item.googleDocs?.documentTitle ||
         item.topic ||
         item._topic ||
         'Untitled Interview Article';

       const topic =
         item._topic ||
         item.topic ||
         item.jsonContent?.topic ||
         item.jsonContent?.data?.topic ||
         '';

       const status = item.status || 'completed';
       const wordCount = item.metadata?.wordCount || item.jsonContent?.metadata?.wordCount || 0;
       let questionCount = item.metadata?.faqCount ?? item.jsonContent?.metadata?.faqCount ?? 0;
       let tocSectionCount = item.metadata?.tocSectionCount ?? item.jsonContent?.metadata?.tocSectionCount ?? 0;
       if (!questionCount) questionCount = getQuestionCountFallback(item.jsonContent);
       if (!tocSectionCount) tocSectionCount = getSectionCountFallback(item.jsonContent);

      // Build a shape compatible with ArticleList rendering
      return {
        id: item.id,
        title,
        topic,
        status,
        // progress is optional; interview-based flow may not have questions
        progress: undefined,
        questions: [],
        article: {
          metadata: { wordCount, questionCount, tocSectionCount }
        },
        // getInterviewTopicArticles converts to JS Date already
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null,
        // WordPress metadata fields (if they exist)
        wordpressUrl: item.wordpressUrl || null,
        wordpressEditUrl: item.wordpressEditUrl || null,
        wordpressPostId: item.wordpressPostId || null,
        wordpressSiteUrl: item.wordpressSiteUrl || null,
        wordpressPublishedAt: item.wordpressPublishedAt || null,
        wordpressStatus: item.wordpressStatus || null,
        // Shopify metadata fields (if they exist)
        shopifyUrl: item.shopifyUrl || null,
        shopifyBlogId: item.shopifyBlogId || null,
        shopifyArticleId: item.shopifyArticleId || null,
        shopifyPublishedAt: item.shopifyPublishedAt || null,
        shopifyStatus: item.shopifyStatus || null,
        // Webflow metadata fields (if they exist)
        webflowItemId: item.webflowItemId || null,
        webflowSiteId: item.webflowSiteId || null,
        webflowCollectionId: item.webflowCollectionId || null,
        webflowPublishedAt: item.webflowPublishedAt || null,
        webflowStatus: item.webflowStatus || null,
        webflowPreviewUrl: item.webflowPreviewUrl || null,
        // Google Docs metadata fields (if they exist)
        googleDocsUrl: item.googleDocsUrl || null,
        googleDocsTitle: item.googleDocsTitle || null,
        googleDocsId: item.googleDocsId || null,
        googleDocsCreatedAt: item.googleDocsCreatedAt || null,
        // Other metadata fields
        featuredImage: item.featuredImage || null,
        // Internal flags to help UI decide on actions/routing
        _source: item._source || 'interview',
        _topicId: item._topicId || null
      };
    });
    cgSnapshot.forEach((docSnap) => {
      const path = docSnap.ref.path; // users/{uid}/Key-word/{keywordId}/json/{articleId} or users/{uid}/Interviews/{topicId}/json/{articleId}
      if (path.startsWith(`users/${userId}/Key-word/`)) {
        const data = docSnap.data();
        allKeywordArticles.push({
          id: docSnap.id,
          ...data,
          // Convert Firestore timestamps to JS Date
          createdAt: data.createdAt?.toDate() || null,
          updatedAt: data.updatedAt?.toDate() || null,
          _keywordId: path.split('/')[3] || null,
          _keyword: data.keyword || path.split('/')[3] || ''
        });
      } else if (path.startsWith(`users/${userId}/Interviews/`)) {
        const data = docSnap.data();
        allInterviewArticles.push({
          id: docSnap.id,
          ...data,
          // Convert Firestore timestamps to JS Date
          createdAt: data.createdAt?.toDate() || null,
          updatedAt: data.updatedAt?.toDate() || null,
          _topicId: path.split('/')[3] || null,
          _topic: data.topic || path.split('/')[3] || ''
        });
      }
    });

    const normalizedKeyword = allKeywordArticles.map(item => {
      // Title can live in several places depending on how the doc was created
      // Check root level title first (where we save it when editing)
      const title =
        item.title ||  // Check root level title FIRST (saved from edit page)
        item.jsonContent?.title ||
        item.jsonContent?.data?.title ||
        item.googleDocs?.documentTitle ||
        item.keyword ||
        item._keyword ||
        'Untitled';

      const topic =
        item._keyword ||
        item.keyword ||
        item.jsonContent?.topic ||
        item.jsonContent?.data?.topic ||
        item.topic ||
        '';

      const status = item.status || 'completed';
      const wordCount = item.metadata?.wordCount || item.jsonContent?.metadata?.wordCount || 0;
      let questionCount = item.metadata?.faqCount ?? item.jsonContent?.metadata?.faqCount ?? 0;
      let tocSectionCount = item.metadata?.tocSectionCount ?? item.jsonContent?.metadata?.tocSectionCount ?? 0;
      if (!questionCount) questionCount = getQuestionCountFallback(item.jsonContent);
      if (!tocSectionCount) tocSectionCount = getSectionCountFallback(item.jsonContent);

      // Build a shape compatible with ArticleList rendering
      // IMPORTANT: Preserve all original fields including WordPress metadata
      return {
        id: item.id,
        title,
        topic,
        status,
        // progress is optional; keyword-based flow may not have questions
        progress: undefined,
        questions: [],
        article: {
          metadata: { wordCount, questionCount, tocSectionCount }
        },
        // getKeywordArticles converts to JS Date already
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null,
        // WordPress metadata fields (if they exist)
        wordpressUrl: item.wordpressUrl || null,
        wordpressEditUrl: item.wordpressEditUrl || null,
        wordpressPostId: item.wordpressPostId || null,
        wordpressSiteUrl: item.wordpressSiteUrl || null,
        wordpressPublishedAt: item.wordpressPublishedAt || null,
        wordpressStatus: item.wordpressStatus || null,
        // Shopify metadata fields (if they exist)
        shopifyUrl: item.shopifyUrl || null,
        shopifyBlogId: item.shopifyBlogId || null,
        shopifyArticleId: item.shopifyArticleId || null,
        shopifyPublishedAt: item.shopifyPublishedAt || null,
        shopifyStatus: item.shopifyStatus || null,
        // Webflow metadata fields (if they exist)
        webflowItemId: item.webflowItemId || null,
        webflowSiteId: item.webflowSiteId || null,
        webflowCollectionId: item.webflowCollectionId || null,
        webflowPublishedAt: item.webflowPublishedAt || null,
        webflowStatus: item.webflowStatus || null,
        webflowPreviewUrl: item.webflowPreviewUrl || null,
        // Google Docs metadata fields (if they exist)
        googleDocsUrl: item.googleDocsUrl || null,
        googleDocsTitle: item.googleDocsTitle || null,
        googleDocsId: item.googleDocsId || null,
        googleDocsCreatedAt: item.googleDocsCreatedAt || null,
        // Other metadata fields
        featuredImage: item.featuredImage || null,
        // Internal flags to help UI decide on actions/routing
        _source: 'keyword',
        _keywordId: item._keywordId || null
      };
    });

    // 3) Merge all sources and deduplicate by ID, then sort by updatedAt desc
    // Note: Interview articles are excluded from main list until completed
    const allArticlesMap = new Map();

    // Add articles to map, using ID as key (later articles with same ID will overwrite earlier ones)
    // Exclude interview articles that are not completed
    [...normalizedLegacy, ...normalizedInterview, ...normalizedKeyword].forEach(article => {
      if (article && article.id) {
        allArticlesMap.set(article.id, article);
      }
    });

    // Only include completed interview articles in the main list
    normalizedInterviewArticles.forEach(article => {
      if (article && article.id && article.status === 'completed') {
        allArticlesMap.set(article.id, article);
      }
    });

    // Convert map back to array
    const merged = Array.from(allArticlesMap.values());

    // Sort by updatedAt desc
    merged.sort((a, b) => {
      const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : (a.updatedAt?.toMillis?.() || 0);
      const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : (b.updatedAt?.toMillis?.() || 0);
      return bTime - aTime;
    });

    return merged;
  } catch (error) {
    console.error('Error getting unified articles:', error);
    throw new Error(`Failed to get articles: ${error.message}`);
  }
};

/**
 * Generate a unique article ID
 * @param {string} keyword - The keyword for the article
 * @returns {string} - Unique article ID
 */
const generateArticleId = (keyword) => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const keywordSlug = keyword.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
  return `article_${timestamp}_${keywordSlug}_${randomSuffix}`;
};

/**
 * Recursively flatten all nested arrays in an object to make it Firestore-compatible
 * @param {any} obj - The object to flatten
 * @param {string} path - Current path for debugging
 * @returns {any} - Firestore-compatible data
 */
const deepFlattenForFirestore = (obj, path = '') => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    // Convert array to object with indexed keys to avoid nested arrays
    const flattened = {};
    obj.forEach((item, index) => {
      flattened[`item_${index}`] = deepFlattenForFirestore(item, `${path}[${index}]`);
    });
    flattened._isArray = true; // Mark as originally an array
    flattened._length = obj.length;
    return flattened;
  }

  if (typeof obj === 'object') {
    const flattened = {};
    Object.keys(obj).forEach(key => {
      flattened[key] = deepFlattenForFirestore(obj[key], `${path}.${key}`);
    });
    return flattened;
  }

  return obj;
};

/**
 * Recursively restore nested arrays from Firestore-flattened data
 * @param {any} obj - The flattened object to restore
 * @returns {any} - Original structure with nested arrays restored
 */
const deepRestoreFromFirestore = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'object' && obj._isArray === true) {
    // Restore array from flattened object
    const restored = [];
    const length = obj._length || 0;
    for (let i = 0; i < length; i++) {
      const key = `item_${i}`;
      if (key in obj) {
        restored[i] = deepRestoreFromFirestore(obj[key]);
      }
    }
    return restored;
  }

  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const restored = {};
    Object.keys(obj).forEach(key => {
      if (key !== '_isArray' && key !== '_length') {
        restored[key] = deepRestoreFromFirestore(obj[key]);
      }
    });
    return restored;
  }

  return obj;
};

/**
 * Flatten nested arrays in article data to make it Firestore-compatible
 * @param {Object} jsonArticle - The article JSON with potential nested arrays
 * @returns {Object} - Firestore-compatible article data
 */
const flattenArticleForFirestore = (jsonArticle) => {
  if (!jsonArticle || typeof jsonArticle !== 'object') {
    return jsonArticle;
  }

  console.log('🔧 Flattening article data for Firestore...');
  console.log('📊 Original structure keys:', Object.keys(jsonArticle));
  
  // Use deep flattening to handle all nested arrays
  const flattened = deepFlattenForFirestore(jsonArticle);
  
  console.log('✅ Article data flattened successfully');
  return flattened;
};

/**
 * Restore nested arrays from Firestore-flattened data
 * @param {Object} firestoreData - The flattened data from Firestore
 * @returns {Object} - Original article structure with nested arrays restored
 */
const restoreArticleFromFirestore = (firestoreData) => {
  if (!firestoreData || typeof firestoreData !== 'object') {
    return firestoreData;
  }

  console.log('🔧 Restoring article data from Firestore...');
  
  // Use deep restoration to handle all flattened arrays
  const restored = deepRestoreFromFirestore(firestoreData);
  
  console.log('✅ Article data restored successfully');
  return restored;
};

/**
 * Save article to Firestore using keyword-organized structure
 * Path: /users/{userId}/Key-word/{keyword}/json/{articleId}
 * @param {string} userId - The authenticated user's ID
 * @param {string} keyword - The keyword for the article
 * @param {Object} jsonArticle - The generated article JSON
 * @param {Object} options - Additional options
 * @param {Object} options.brandVoiceSettings - Brand voice settings used for generation
 * @returns {Promise<string>} - The created article ID
 */
export const saveArticleToFirestore = async (userId, keyword, jsonArticle, options = {}) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  if (!keyword) {
    throw new Error('Keyword is required');
  }
  
  if (!jsonArticle) {
    throw new Error('Article JSON is required');
  }
  
  try {
    const safeKeywordId = createSafeKeywordId(keyword);
    const articleId = generateArticleId(keyword);
    
    // Create document reference using the new path structure
    const keywordDocRef = doc(db, 'users', userId, 'Key-word', safeKeywordId);
    const articleRef = doc(db, 'users', userId, 'Key-word', safeKeywordId, 'json', articleId);
    
    // Flatten the article data to make it Firestore-compatible
    const flattenedArticle = flattenArticleForFirestore(jsonArticle);
    
    const articleData = {
      id: articleId,
      keyword: keyword, // Store original keyword
      keywordId: safeKeywordId, // Store safe ID for reference
      jsonContent: flattenedArticle,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'completed',
      metadata: {
        wordCount: calculateWordCount(jsonArticle),
        tocSectionCount: jsonArticle.toc?.length || 0,
        faqCount: jsonArticle.faqs?.length || 0,
        tableCount: jsonArticle.tables?.length || 0,
        checklistCount: Object.keys(jsonArticle.checklists || {}).length,
        keyTakeawayCount: jsonArticle.key_takeaways?.length || 0
      },
      // Store brand voice settings used for generation
      brandVoiceSettings: options.brandVoiceSettings || null,
      brandVoiceUsed: !!(options.brandVoiceSettings && options.brandVoiceSettings.enabled)
    };
    
    // Ensure parent keyword document exists for listing
    await setDoc(
      keywordDocRef,
      {
        keyword: keyword,
        keywordId: safeKeywordId,
        lastUpdated: serverTimestamp(),
        articleCountIncrement: 1 // placeholder field to ensure doc presence; not relied upon
      },
      { merge: true }
    );

    await setDoc(articleRef, articleData);
    
    console.log(`Article saved successfully: ${articleId} for keyword: ${keyword}`);
    return articleId;
    
  } catch (error) {
    console.error('Error saving article to Firestore:', error);
    throw new Error(`Failed to save article: ${error.message}`);
  }
};

/**
 * Get all keywords for a user
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<Array>} - Array of keywords with article counts
 */
export const getUserKeywords = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  try {
    const keywordsRef = collection(db, 'users', userId, 'Key-word');
    const querySnapshot = await getDocs(keywordsRef);
    
    const keywords = [];
    
    for (const keywordDoc of querySnapshot.docs) {
      const keywordId = keywordDoc.id;
      
      // Get articles count for this keyword
      const articlesRef = collection(db, 'users', userId, 'Key-word', keywordId, 'json');
      const articlesSnapshot = await getDocs(articlesRef);
      
      // Get the most recent article to extract the original keyword
      let originalKeyword = keywordId;
      let lastUpdated = null;
      
      if (!articlesSnapshot.empty) {
        const articles = [];
        articlesSnapshot.forEach(doc => {
          const data = doc.data();
          articles.push({
            ...data,
            updatedAt: data.updatedAt?.toDate() || new Date(0)
          });
        });
        
        // Sort by updatedAt and get the most recent
        articles.sort((a, b) => b.updatedAt - a.updatedAt);
        const mostRecent = articles[0];
        
        originalKeyword = mostRecent.keyword || keywordId;
        lastUpdated = mostRecent.updatedAt;
      }
      
      keywords.push({
        keywordId: keywordId,
        keyword: originalKeyword,
        articleCount: articlesSnapshot.size,
        lastUpdated: lastUpdated
      });
    }
    
    // Sort by last updated (most recent first)
    keywords.sort((a, b) => {
      if (!a.lastUpdated && !b.lastUpdated) return 0;
      if (!a.lastUpdated) return 1;
      if (!b.lastUpdated) return -1;
      return b.lastUpdated - a.lastUpdated;
    });
    
    return keywords;
    
  } catch (error) {
    console.error('Error getting user keywords:', error);
    throw new Error(`Failed to get user keywords: ${error.message}`);
  }
};

/**
 * Get all articles for a specific keyword
 * @param {string} userId - The authenticated user's ID
 * @param {string} keywordId - The keyword ID (safe document ID)
 * @returns {Promise<Array>} - Array of articles for the keyword
 */
export const getKeywordArticles = async (userId, keywordId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  if (!keywordId) {
    throw new Error('Keyword ID is required');
  }
  
  try {
    const articlesRef = collection(db, 'users', userId, 'Key-word', keywordId, 'json');
    const q = query(articlesRef, orderBy('updatedAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const articles = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Restore nested arrays in the jsonContent if it exists
      const restoredData = {
        ...data,
        jsonContent: data.jsonContent ? restoreArticleFromFirestore(data.jsonContent) : data.jsonContent
      };
      
      articles.push({
        id: doc.id,
        ...restoredData,
        // Convert Firestore timestamps to JavaScript dates for easier handling
        createdAt: data.createdAt?.toDate() || null,
        updatedAt: data.updatedAt?.toDate() || null
      });
    });
    
    return articles;
    
  } catch (error) {
    console.error('Error getting keyword articles:', error);
    throw new Error(`Failed to get articles for keyword: ${error.message}`);
  }
};

/**
 * Get a specific article by ID
 * @param {string} userId - The authenticated user's ID
 * @param {string} keywordId - The keyword ID (safe document ID)
 * @param {string} articleId - The article ID
 * @returns {Promise<Object|null>} - The article data or null if not found
 */
export const getArticleById = async (userId, keywordId, articleId) => {
  if (!userId || !keywordId || !articleId) {
    throw new Error('User ID, Keyword ID, and Article ID are required');
  }
  
  try {
    const articleRef = doc(db, 'users', userId, 'Key-word', keywordId, 'json', articleId);
    const articleDoc = await getDoc(articleRef);
    
    if (!articleDoc.exists()) {
      return null;
    }
    
    const data = articleDoc.data();
    
    // Restore nested arrays in the jsonContent if it exists
    const restoredData = {
      ...data,
      jsonContent: data.jsonContent ? restoreArticleFromFirestore(data.jsonContent) : data.jsonContent
    };
    
    return {
      id: articleDoc.id,
      ...restoredData,
      // Convert Firestore timestamps to JavaScript dates
      createdAt: data.createdAt?.toDate() || null,
      updatedAt: data.updatedAt?.toDate() || null
    };
    
  } catch (error) {
    console.error('Error getting article by ID:', error);
    throw new Error(`Failed to get article: ${error.message}`);
  }
};
/**
 * Save interview article to Firestore using interview-organized structure
 * Path: /users/{userId}/Interviews/{topic}/json/{articleId}
 * @param {string} userId - The authenticated user's ID
 * @param {string} topic - The interview topic
 * @param {Object} jsonArticle - The generated article JSON
 * @returns {Promise<string>} - The created article ID
 */
export const saveInterviewArticleToFirestore = async (userId, topic, jsonArticle, source = 'interview') => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!topic) {
    throw new Error('Topic is required');
  }

  if (!jsonArticle) {
    throw new Error('Article JSON is required');
  }

  try {
    const safeTopicId = createSafeKeywordId(topic);
    const articleId = generateArticleId(topic);

    // Create document reference using the interview path structure
    const topicDocRef = doc(db, 'users', userId, 'Interviews', safeTopicId);
    const articleRef = doc(db, 'users', userId, 'Interviews', safeTopicId, 'json', articleId);

    // Flatten the article data to make it Firestore-compatible
    const flattenedArticle = flattenArticleForFirestore(jsonArticle);

    const articleData = {
      id: articleId,
      topic: topic, // Store original topic
      topicId: safeTopicId, // Store safe ID for reference
      jsonContent: flattenedArticle,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'completed',
      _source: source || 'interview', // Mark as interview article (voice|text|interview)
      metadata: {
        wordCount: calculateWordCount(jsonArticle),
        tocSectionCount: jsonArticle.toc?.length || 0,
        faqCount: jsonArticle.faqs?.length || 0,
        tableCount: jsonArticle.tables?.length || 0,
        checklistCount: Object.keys(jsonArticle.checklists || {}).length,
        keyTakeawayCount: jsonArticle.key_takeaways?.length || 0
      }
    };

    // Ensure parent topic document exists for listing
    await setDoc(
      topicDocRef,
      {
        topic: topic,
        topicId: safeTopicId,
        lastUpdated: serverTimestamp(),
        articleCountIncrement: 1 // placeholder field to ensure doc presence; not relied upon
      },
      { merge: true }
    );

    await setDoc(articleRef, articleData);

    console.log(`Interview article saved successfully: ${articleId} for topic: ${topic}`);
    return articleId;

  } catch (error) {
    console.error('Error saving interview article to Firestore:', error);
    throw new Error(`Failed to save interview article: ${error.message}`);
  }
};

/**
 * Get all interview topics for a user
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<Array>} - Array of interview topics with article counts
 */
export const getUserInterviewTopics = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const topicsRef = collection(db, 'users', userId, 'Interviews');
    const querySnapshot = await getDocs(topicsRef);

    const topics = [];

    for (const topicDoc of querySnapshot.docs) {
      const topicId = topicDoc.id;

      // Get articles count for this topic
      const articlesRef = collection(db, 'users', userId, 'Interviews', topicId, 'json');
      const articlesSnapshot = await getDocs(articlesRef);

      // Get the most recent article to extract the original topic
      let originalTopic = topicId;
      let lastUpdated = null;

      if (!articlesSnapshot.empty) {
        const articles = [];
        articlesSnapshot.forEach(doc => {
          const data = doc.data();
          articles.push({
            ...data,
            updatedAt: data.updatedAt?.toDate() || new Date(0)
          });
        });

        // Sort by updatedAt and get the most recent
        articles.sort((a, b) => b.updatedAt - a.updatedAt);
        const mostRecent = articles[0];

        originalTopic = mostRecent.topic || topicId;
        lastUpdated = mostRecent.updatedAt;
      }

      topics.push({
        topicId: topicId,
        topic: originalTopic,
        articleCount: articlesSnapshot.size,
        lastUpdated: lastUpdated
      });
    }

    // Sort by last updated (most recent first)
    topics.sort((a, b) => {
      if (!a.lastUpdated && !b.lastUpdated) return 0;
      if (!a.lastUpdated) return 1;
      if (!b.lastUpdated) return -1;
      return b.lastUpdated - a.lastUpdated;
    });

    return topics;

  } catch (error) {
    console.error('Error getting user interview topics:', error);
    throw new Error(`Failed to get user interview topics: ${error.message}`);
  }
};

/**
 * Get all articles for a specific interview topic
 * @param {string} userId - The authenticated user's ID
 * @param {string} topicId - The topic ID (safe document ID)
 * @returns {Promise<Array>} - Array of articles for the topic
 */
export const getInterviewTopicArticles = async (userId, topicId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!topicId) {
    throw new Error('Topic ID is required');
  }

  try {
    const articlesRef = collection(db, 'users', userId, 'Interviews', topicId, 'json');
    const q = query(articlesRef, orderBy('updatedAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const articles = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();

      // Restore nested arrays in the jsonContent if it exists
      const restoredData = {
        ...data,
        jsonContent: data.jsonContent ? restoreArticleFromFirestore(data.jsonContent) : data.jsonContent
      };

      articles.push({
        id: doc.id,
        ...restoredData,
        // Convert Firestore timestamps to JavaScript dates for easier handling
        createdAt: data.createdAt?.toDate() || null,
        updatedAt: data.updatedAt?.toDate() || null
      });
    });

    return articles;

  } catch (error) {
    console.error('Error getting interview topic articles:', error);
    throw new Error(`Failed to get articles for interview topic: ${error.message}`);
  }
};

/**
 * Get a specific interview article by ID
 * @param {string} userId - The authenticated user's ID
 * @param {string} topicId - The topic ID (safe document ID)
 * @param {string} articleId - The article ID
 * @returns {Promise<Object|null>} - The article data or null if not found
 */
export const getInterviewArticleById = async (userId, topicId, articleId) => {
  if (!userId || !topicId || !articleId) {
    throw new Error('User ID, Topic ID, and Article ID are required');
  }

  try {
    const articleRef = doc(db, 'users', userId, 'Interviews', topicId, 'json', articleId);
    const articleDoc = await getDoc(articleRef);

    if (!articleDoc.exists()) {
      return null;
    }

    const data = articleDoc.data();

    // Restore nested arrays in the jsonContent if it exists
    const restoredData = {
      ...data,
      jsonContent: data.jsonContent ? restoreArticleFromFirestore(data.jsonContent) : data.jsonContent
    };

    return {
      id: articleDoc.id,
      ...restoredData,
      // Convert Firestore timestamps to JavaScript dates
      createdAt: data.createdAt?.toDate() || null,
      updatedAt: data.updatedAt?.toDate() || null
    };

  } catch (error) {
    console.error('Error getting interview article by ID:', error);
    throw new Error(`Failed to get interview article: ${error.message}`);
  }
};

/**
 * Update interview article with new content (used by the article editor)
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article ID
 * @param {Object} updateData - Data to update (including htmlContent)
 * @param {string} topicId - Required topic ID for interview articles
 * @returns {Promise<void>}
 */
export const updateInterviewArticle = async (userId, articleId, updateData, topicId) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  if (!topicId) {
    throw new Error('Topic ID is required for interview articles');
  }

  if (!updateData || typeof updateData !== 'object') {
    throw new Error('Update data must be an object');
  }

  try {
    const articleRef = doc(db, 'users', userId, 'Interviews', topicId, 'json', articleId);

    // Check if article exists
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Interview article not found');
    }

    // Build update data, filtering out undefined values
    const dataToUpdate = {
      updatedAt: serverTimestamp()
    };

    // Only include fields that are defined in updateData
    if (updateData.htmlContent !== undefined) {
      dataToUpdate.htmlContent = updateData.htmlContent;
    }
    if (updateData.lastModified !== undefined) {
      dataToUpdate.lastModified = updateData.lastModified;
    }
    if (updateData.modifiedBy !== undefined) {
      dataToUpdate.modifiedBy = updateData.modifiedBy;
    }

    // Handle WordPress metadata fields
    if (updateData.wordpressUrl !== undefined) {
      dataToUpdate.wordpressUrl = updateData.wordpressUrl;
    }
    if (updateData.wordpressEditUrl !== undefined) {
      dataToUpdate.wordpressEditUrl = updateData.wordpressEditUrl;
    }
    if (updateData.wordpressPostId !== undefined) {
      dataToUpdate.wordpressPostId = updateData.wordpressPostId;
    }
    if (updateData.wordpressSiteUrl !== undefined) {
      dataToUpdate.wordpressSiteUrl = updateData.wordpressSiteUrl;
    }
    if (updateData.wordpressPublishedAt !== undefined) {
      dataToUpdate.wordpressPublishedAt = updateData.wordpressPublishedAt;
    }
    if (updateData.wordpressStatus !== undefined) {
      dataToUpdate.wordpressStatus = updateData.wordpressStatus;
    }

    // For interview articles, update the jsonContent.htmlContent if needed
    if (updateData.htmlContent !== undefined) {
      const currentData = articleDoc.data();
      if (currentData.jsonContent) {
        // Flatten the jsonContent if needed before updating
        const flattenedJsonContent = flattenArticleForFirestore(currentData.jsonContent);
        dataToUpdate.jsonContent = {
          ...flattenedJsonContent,
          htmlContent: updateData.htmlContent
        };
      }
    }

    await updateDoc(articleRef, dataToUpdate);

  } catch (error) {
    console.error('Error updating interview article:', error);
    throw new Error(`Failed to update interview article: ${error.message}`);
  }
};

/**
 * Save Google Docs conversion data to interview article
 * @param {string} userId - The authenticated user's ID
 * @param {string} topicId - The topic ID (safe document ID)
 * @param {string} articleId - The article ID
 * @param {Object} googleDocsData - Google Docs conversion data
 * @param {string} googleDocsData.documentUrl - URL of the created Google Doc
 * @param {string} googleDocsData.documentTitle - Title of the created Google Doc
 * @param {string} googleDocsData.documentId - Google Docs document ID
 * @returns {Promise<void>}
 */
export const saveInterviewGoogleDocsData = async (userId, topicId, articleId, googleDocsData) => {
  if (!userId || !topicId || !articleId) {
    throw new Error('User ID, Topic ID, and Article ID are required');
  }

  if (!googleDocsData || !googleDocsData.documentUrl) {
    throw new Error('Google Docs data with document URL is required');
  }

  try {
    const articleRef = doc(db, 'users', userId, 'Interviews', topicId, 'json', articleId);

    // Check if article exists
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Interview article not found');
    }

    const googleDocsMetadata = {
      documentUrl: googleDocsData.documentUrl,
      documentTitle: googleDocsData.documentTitle || 'Untitled Document',
      documentId: googleDocsData.documentId || null,
      convertedAt: serverTimestamp(),
      conversionStatus: 'completed'
    };

    await updateDoc(articleRef, {
      googleDocs: googleDocsMetadata,
      updatedAt: serverTimestamp()
    });

    console.log(`Google Docs data saved for interview article: ${articleId}`);

  } catch (error) {
    console.error('Error saving Google Docs data to interview article:', error);
    throw new Error(`Failed to save Google Docs data to interview article: ${error.message}`);
  }
};

/**
 * Get all interview articles for a user (unified with keyword articles)
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<Array>} - Array of all interview articles
 */
export const getAllInterviewArticles = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const allInterviewArticles = [];
    const cgSnapshot = await getDocs(collectionGroup(db, 'json'));
    cgSnapshot.forEach((docSnap) => {
      const path = docSnap.ref.path; // users/{uid}/Interviews/{topicId}/json/{articleId}
      if (path.startsWith(`users/${userId}/Interviews/`)) {
        const data = docSnap.data();
        allInterviewArticles.push({
          id: docSnap.id,
          ...data,
          // Convert Firestore timestamps to JS Date
          createdAt: data.createdAt?.toDate() || null,
          updatedAt: data.updatedAt?.toDate() || null,
          _topicId: path.split('/')[3] || null,
          _topic: data.topic || path.split('/')[3] || '',
          _source: 'interview'
        });
      }
    });

    return allInterviewArticles;

  } catch (error) {
    console.error('Error getting all interview articles:', error);
    throw new Error(`Failed to get interview articles: ${error.message}`);
  }
};

/**
 * Update article with new content (used by the article editor)
 * Handles both legacy and keyword-based articles
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article ID
 * @param {Object} updateData - Data to update (including htmlContent)
 * @param {string} source - 'legacy' or 'keyword'
 * @param {string} keywordId - Required if source is 'keyword'
 * @returns {Promise<void>}
 */
export const updateArticle = async (userId, articleId, updateData, source = 'legacy', keywordId = null) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }
  
  if (!updateData || typeof updateData !== 'object') {
    throw new Error('Update data must be an object');
  }
  
  try {
    let articleRef;

    if (source === 'keyword') {
      // Keyword-based article
      if (!keywordId) {
        throw new Error('Keyword ID is required for keyword articles');
      }
      articleRef = doc(db, 'users', userId, 'Key-word', keywordId, 'json', articleId);
    } else if (source === 'interview') {
      // Interview-based article
      if (!keywordId) {
        throw new Error('Topic ID is required for interview articles');
      }
      articleRef = doc(db, 'users', userId, 'Interviews', keywordId, 'json', articleId);
    } else {
      // Legacy article
      articleRef = doc(db, 'customers', userId, 'articles', articleId);
    }
    
    // Check if article exists
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Article not found');
    }
    
    // Build update data, filtering out undefined values
    const dataToUpdate = {
      updatedAt: serverTimestamp()
    };
    
    // Only include fields that are defined in updateData
    if (updateData.htmlContent !== undefined) {
      dataToUpdate.htmlContent = updateData.htmlContent;
    }
    if (updateData.lastModified !== undefined) {
      dataToUpdate.lastModified = updateData.lastModified;
    }
    if (updateData.modifiedBy !== undefined) {
      dataToUpdate.modifiedBy = updateData.modifiedBy;
    }
    
    // Handle WordPress metadata fields
    if (updateData.wordpressUrl !== undefined) {
      dataToUpdate.wordpressUrl = updateData.wordpressUrl;
    }
    if (updateData.wordpressEditUrl !== undefined) {
      dataToUpdate.wordpressEditUrl = updateData.wordpressEditUrl;
    }
    if (updateData.wordpressPostId !== undefined) {
      dataToUpdate.wordpressPostId = updateData.wordpressPostId;
    }
    if (updateData.wordpressSiteUrl !== undefined) {
      dataToUpdate.wordpressSiteUrl = updateData.wordpressSiteUrl;
    }
    if (updateData.wordpressPublishedAt !== undefined) {
      dataToUpdate.wordpressPublishedAt = updateData.wordpressPublishedAt;
    }
    if (updateData.wordpressStatus !== undefined) {
      dataToUpdate.wordpressStatus = updateData.wordpressStatus;
    }
    
    // Handle Shopify metadata fields
    if (updateData.shopifyUrl !== undefined) {
      dataToUpdate.shopifyUrl = updateData.shopifyUrl;
    }
    if (updateData.shopifyBlogId !== undefined) {
      dataToUpdate.shopifyBlogId = updateData.shopifyBlogId;
    }
    if (updateData.shopifyArticleId !== undefined) {
      dataToUpdate.shopifyArticleId = updateData.shopifyArticleId;
    }
    if (updateData.shopifyPublishedAt !== undefined) {
      dataToUpdate.shopifyPublishedAt = updateData.shopifyPublishedAt;
    }
    if (updateData.shopifyStatus !== undefined) {
      dataToUpdate.shopifyStatus = updateData.shopifyStatus;
    }
    
    // Handle Webflow metadata fields
    if (updateData.webflowItemId !== undefined) {
      dataToUpdate.webflowItemId = updateData.webflowItemId;
    }
    if (updateData.webflowSiteId !== undefined) {
      dataToUpdate.webflowSiteId = updateData.webflowSiteId;
    }
    if (updateData.webflowCollectionId !== undefined) {
      dataToUpdate.webflowCollectionId = updateData.webflowCollectionId;
    }
    if (updateData.webflowPublishedAt !== undefined) {
      dataToUpdate.webflowPublishedAt = updateData.webflowPublishedAt;
    }
    if (updateData.webflowStatus !== undefined) {
      dataToUpdate.webflowStatus = updateData.webflowStatus;
    }
    if (updateData.webflowPreviewUrl !== undefined) {
      dataToUpdate.webflowPreviewUrl = updateData.webflowPreviewUrl;
    }
    
    // Handle Google Docs metadata fields
    if (updateData.googleDocsUrl !== undefined) {
      dataToUpdate.googleDocsUrl = updateData.googleDocsUrl;
    }
    if (updateData.googleDocsTitle !== undefined) {
      dataToUpdate.googleDocsTitle = updateData.googleDocsTitle;
    }
    if (updateData.googleDocsId !== undefined) {
      dataToUpdate.googleDocsId = updateData.googleDocsId;
    }
    if (updateData.googleDocsCreatedAt !== undefined) {
      dataToUpdate.googleDocsCreatedAt = updateData.googleDocsCreatedAt;
    }
    
    // Handle other metadata fields
    if (updateData.featuredImage !== undefined) {
      dataToUpdate.featuredImage = updateData.featuredImage;
    }
    if (updateData.title !== undefined) {
      dataToUpdate.title = updateData.title;
    }
    if (updateData.meta_description !== undefined) {
      dataToUpdate.meta_description = updateData.meta_description;
    }
    if (updateData.videos !== undefined) {
      dataToUpdate.videos = updateData.videos;
    }
    
    // For keyword articles, update the jsonContent.htmlContent if needed
    if (source === 'keyword' && updateData.htmlContent !== undefined) {
      const currentData = articleDoc.data();
      if (currentData.jsonContent) {
        // Flatten the jsonContent if needed before updating
        const flattenedJsonContent = flattenArticleForFirestore(currentData.jsonContent);
        dataToUpdate.jsonContent = {
          ...flattenedJsonContent,
          htmlContent: updateData.htmlContent
        };
      }
    }
    
    await updateDoc(articleRef, dataToUpdate);
    
  } catch (error) {
    console.error('Error updating article:', error);
    throw new Error(`Failed to update article: ${error.message}`);
  }
};

/**
 * Update article metadata
 * @param {string} userId - The authenticated user's ID
 * @param {string} keywordId - The keyword ID (safe document ID)
 * @param {string} articleId - The article ID
 * @param {Object} metadata - Metadata to update
 * @returns {Promise<void>}
 */
export const updateArticleMetadata = async (userId, keywordId, articleId, metadata) => {
  if (!userId || !keywordId || !articleId) {
    throw new Error('User ID, Keyword ID, and Article ID are required');
  }
  
  if (!metadata || typeof metadata !== 'object') {
    throw new Error('Metadata must be an object');
  }
  
  try {
    const articleRef = doc(db, 'users', userId, 'Key-word', keywordId, 'json', articleId);
    
    // Check if article exists
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Article not found');
    }
    
    await updateDoc(articleRef, {
      ...metadata,
      updatedAt: serverTimestamp()
    });
    
  } catch (error) {
    console.error('Error updating article metadata:', error);
    throw new Error(`Failed to update article metadata: ${error.message}`);
  }
};

/**
 * Calculate word count from article JSON
 * @param {Object} jsonArticle - The article JSON
 * @returns {number} - Estimated word count
 */
const calculateWordCount = (jsonArticle) => {
  if (!jsonArticle || typeof jsonArticle !== 'object') {
    return 0;
  }
  
  let wordCount = 0;
  
  // Count words in title and subtitle
  if (jsonArticle.title) {
    wordCount += jsonArticle.title.split(/\s+/).length;
  }
  if (jsonArticle.subtitle) {
    wordCount += jsonArticle.subtitle.split(/\s+/).length;
  }
  
  // Count words in intro
  if (jsonArticle.intro_md) {
    wordCount += jsonArticle.intro_md.split(/\s+/).length;
  }
  
  // Count words in key takeaways
  if (Array.isArray(jsonArticle.key_takeaways)) {
    jsonArticle.key_takeaways.forEach(takeaway => {
      if (typeof takeaway === 'string') {
        wordCount += takeaway.split(/\s+/).length;
      }
    });
  }
  
  // Count words in FAQs
  if (Array.isArray(jsonArticle.faqs)) {
    jsonArticle.faqs.forEach(faq => {
      if (faq.question) wordCount += faq.question.split(/\s+/).length;
      if (faq.answer_md) wordCount += faq.answer_md.split(/\s+/).length;
      if (faq.real_results) wordCount += faq.real_results.split(/\s+/).length;
      if (faq.takeaway) wordCount += faq.takeaway.split(/\s+/).length;
    });
  }
  
  // Count words in checklists
  if (jsonArticle.checklists && typeof jsonArticle.checklists === 'object') {
    Object.values(jsonArticle.checklists).forEach(checklist => {
      if (Array.isArray(checklist)) {
        checklist.forEach(item => {
          if (typeof item === 'string') {
            wordCount += item.split(/\s+/).length;
          }
        });
      }
    });
  }
  
  return wordCount;
};

/**
 * Save Google Docs conversion data to Firestore
 * @param {string} userId - The authenticated user's ID
 * @param {string} keywordId - The keyword ID (safe document ID)
 * @param {string} articleId - The article ID
 * @param {Object} googleDocsData - Google Docs conversion data
 * @param {string} googleDocsData.documentUrl - URL of the created Google Doc
 * @param {string} googleDocsData.documentTitle - Title of the created Google Doc
 * @param {string} googleDocsData.documentId - Google Docs document ID
 * @returns {Promise<void>}
 */
export const saveGoogleDocsData = async (userId, keywordId, articleId, googleDocsData) => {
  if (!userId || !keywordId || !articleId) {
    throw new Error('User ID, Keyword ID, and Article ID are required');
  }
  
  if (!googleDocsData || !googleDocsData.documentUrl) {
    throw new Error('Google Docs data with document URL is required');
  }
  
  try {
    const articleRef = doc(db, 'users', userId, 'Key-word', keywordId, 'json', articleId);
    
    // Check if article exists
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Article not found');
    }
    
    const googleDocsMetadata = {
      documentUrl: googleDocsData.documentUrl,
      documentTitle: googleDocsData.documentTitle || 'Untitled Document',
      documentId: googleDocsData.documentId || null,
      convertedAt: serverTimestamp(),
      conversionStatus: 'completed'
    };
    
    await updateDoc(articleRef, {
      googleDocs: googleDocsMetadata,
      updatedAt: serverTimestamp()
    });
    
    console.log(`Google Docs data saved for article: ${articleId}`);
    
  } catch (error) {
    console.error('Error saving Google Docs data:', error);
    throw new Error(`Failed to save Google Docs data: ${error.message}`);
  }
};

/**
 * Search articles across all keywords for a user
 * @param {string} userId - The authenticated user's ID
 * @param {string} searchTerm - The search term
 * @param {number} limitResults - Maximum number of results (default: 20)
 * @returns {Promise<Array>} - Array of matching articles
 */
export const searchUserArticles = async (userId, searchTerm, limitResults = 20) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  if (!searchTerm || typeof searchTerm !== 'string') {
    throw new Error('Search term is required');
  }
  
  try {
    const keywords = await getUserKeywords(userId);
    const allArticles = [];
    
    // Search through all keywords
    for (const keywordData of keywords) {
      const articles = await getKeywordArticles(userId, keywordData.keywordId);
      
      // Filter articles that match the search term
      const matchingArticles = articles.filter(article => {
        const searchLower = searchTerm.toLowerCase();
        
        // Search in keyword, title, and content
        return (
          article.keyword?.toLowerCase().includes(searchLower) ||
          article.jsonContent?.title?.toLowerCase().includes(searchLower) ||
          article.jsonContent?.subtitle?.toLowerCase().includes(searchLower) ||
          JSON.stringify(article.jsonContent).toLowerCase().includes(searchLower)
        );
      });
      
      allArticles.push(...matchingArticles);
    }
    
    // Sort by relevance (keyword matches first, then by update date)
    allArticles.sort((a, b) => {
      const searchLower = searchTerm.toLowerCase();
      const aKeywordMatch = a.keyword?.toLowerCase().includes(searchLower);
      const bKeywordMatch = b.keyword?.toLowerCase().includes(searchLower);
      
      if (aKeywordMatch && !bKeywordMatch) return -1;
      if (!aKeywordMatch && bKeywordMatch) return 1;
      
      // If both or neither match keyword, sort by update date
      return (b.updatedAt || new Date(0)) - (a.updatedAt || new Date(0));
    });
    
    return allArticles.slice(0, limitResults);
    
  } catch (error) {
    console.error('Error searching user articles:', error);
    throw new Error(`Failed to search articles: ${error.message}`);
  }
};

/**
 * Create a new article with initial setup data
 * @param {string} userId - The authenticated user's ID
 * @param {Object} setupData - Initial setup data
 * @param {string} setupData.topic - Article topic
 * @param {number} setupData.questionCount - Number of questions to generate
 * @param {Object} setupData.expertIntro - Expert introduction Q&A pairs
 * @returns {Promise<string>} - The created article ID (slug)
 */
export const createArticle = async (userId, setupData) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!setupData.topic) {
    throw new Error('Topic is required');
  }

  if (!setupData.questionCount || setupData.questionCount < 5 || setupData.questionCount > 40) {
    throw new Error('Question count must be between 5 and 40');
  }

  try {
    const articleSlug = generateArticleSlug(setupData.topic);
    const articleRef = doc(db, 'customers', userId, 'articles', articleSlug);

    const articleData = {
      // Article metadata
      title: `Expert Guide: ${setupData.topic}`,
      topic: setupData.topic,
      status: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),

      // Setup phase data
      setup: {
        topic: setupData.topic,
        questionCount: setupData.questionCount,
        expertIntro: setupData.expertIntro || {}
      },

      // Initialize empty arrays for questions and article
      questions: [],
      article: null
    };

    await setDoc(articleRef, articleData);

    return articleSlug;
  } catch (error) {
    console.error('Error creating article:', error);
    throw new Error(`Failed to create article: ${error.message}`);
  }
};

/**
 * Save introduction questions and answers to an existing article
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @param {Object} introData - Introduction questions and answers
 * @returns {Promise<void>}
 */
export const saveIntroData = async (userId, articleId, introData) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  if (!introData) {
    throw new Error('Introduction data is required');
  }

  try {
    const articleRef = doc(db, 'customers', userId, 'articles', articleId);

    // Check if article exists
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Article not found');
    }

    await updateDoc(articleRef, {
      'setup.expertIntro': introData,
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    console.error('Error saving intro data:', error);
    throw new Error(`Failed to save introduction data: ${error.message}`);
  }
};

/**
 * Save generated interview questions to an article
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @param {Array} questions - Array of structured questions
 * @returns {Promise<void>}
 */
export const saveQuestions = async (userId, articleId, questions) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Questions array is required and cannot be empty');
  }

  try {
    const articleRef = doc(db, 'customers', userId, 'articles', articleId);

    // Check if article exists
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Article not found');
    }

    // Transform questions to include required fields with voice support
    // and enforce unique IDs while preserving the original provided ID
    const idCounts = {};
    const formattedQuestions = questions.map((question, index) => {
      const baseId = (question.id !== undefined && question.id !== null)
        ? String(question.id)
        : String(index + 1);
      idCounts[baseId] = (idCounts[baseId] || 0) + 1;
      const uniqueId = idCounts[baseId] > 1 ? `${baseId}-${idCounts[baseId]}` : baseId;

      return {
        // Unique ID used by UI anchors and update functions
        id: uniqueId,
        // Preserve original/base ID for reference or display needs
        originalId: baseId,
        // Preserve section title regardless of field name used by generator/UI
        sectionTitle: question.sectionTitle || question.section || 'General',
        question: question.question,
        answered: false,
        answer: '',
        timestamp: null,
        // Voice response fields (optional, for backward compatibility)
        voiceResponse: {
          transcription: '',
          confidence: 0,
          audioUrl: null,
          suggestions: []
        },
        // Conversational context for voice interviews
        conversationalContext: {
          followUpCount: 0,
          lastAIResponse: '',
          needsFollowUp: false
        }
      };
    });

    await updateDoc(articleRef, {
      questions: formattedQuestions,
      status: 'in_progress',
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    console.error('Error saving questions:', error);
    throw new Error(`Failed to save questions: ${error.message}`);
  }
};

/**
 * Save or update a single answer (for auto-save functionality)
 * Enhanced to handle both text and voice responses
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @param {number} questionId - The question ID to update
 * @param {string} answer - The answer text
 * @param {Object} voiceData - Optional voice response data
 * @param {string} voiceData.transcription - Voice transcription
 * @param {number} voiceData.confidence - Transcription confidence (0-1)
 * @param {string} voiceData.audioUrl - URL to audio recording (optional)
 * @param {Array} voiceData.suggestions - Suggestions shown to user
 * @returns {Promise<void>}
 */
export const saveAnswer = async (userId, articleId, questionId, answer, voiceData = null) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  if (questionId === undefined || questionId === null) {
    throw new Error('Question ID is required');
  }

  if (typeof answer !== 'string') {
    throw new Error('Answer must be a string');
  }

  try {
    const articleRef = doc(db, 'customers', userId, 'articles', articleId);

    // Get current article data
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Article not found');
    }

    const articleData = articleDoc.data();
    const questions = articleData.questions || [];

    // Find and update the specific question (tolerate string/number id mismatches)
    const questionIndex = questions.findIndex(q => {
      const qid = q && (q.id !== undefined && q.id !== null) ? String(q.id) : '';
      const oid = q && (q.originalId !== undefined && q.originalId !== null) ? String(q.originalId) : '';
      const target = String(questionId);
      return qid === target || oid === target;
    });
    if (questionIndex === -1) {
      throw new Error(`Question with ID ${questionId} not found`);
    }

    const currentQuestion = questions[questionIndex];

    // Update the question with new answer and optional voice data
    questions[questionIndex] = {
      ...currentQuestion,
      answer: answer,
      answered: answer.trim().length > 0,
      timestamp: new Date(), // Use regular Date instead of serverTimestamp in arrays
      // Update voice response if provided, otherwise preserve existing
      voiceResponse: voiceData ? {
        transcription: voiceData.transcription || answer,
        confidence: voiceData.confidence || 0,
        audioUrl: voiceData.audioUrl || null,
        suggestions: voiceData.suggestions || []
      } : (currentQuestion.voiceResponse || {
        transcription: '',
        confidence: 0,
        audioUrl: null,
        suggestions: []
      })
    };

    await updateDoc(articleRef, {
      questions: questions,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error saving answer:', error);
    throw new Error(`Failed to save answer: ${error.message}`);
  }
};

/**
 * Save voice response data for a specific question
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @param {number} questionId - The question ID to update
 * @param {Object} voiceData - Voice response data
 * @param {string} voiceData.transcription - Voice transcription
 * @param {number} voiceData.confidence - Transcription confidence (0-1)
 * @param {string} voiceData.audioUrl - URL to audio recording (optional)
 * @param {Array} voiceData.suggestions - Suggestions shown to user
 * @param {Object} conversationalContext - Conversational context data
 * @param {number} conversationalContext.followUpCount - Number of follow-ups
 * @param {string} conversationalContext.lastAIResponse - Last AI response
 * @param {boolean} conversationalContext.needsFollowUp - Whether follow-up is needed
 * @returns {Promise<void>}
 */
export const saveVoiceResponse = async (userId, articleId, questionId, voiceData, conversationalContext = {}) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  if (questionId === undefined || questionId === null) {
    throw new Error('Question ID is required');
  }

  if (!voiceData || !voiceData.transcription) {
    throw new Error('Voice data with transcription is required');
  }

  try {
    const articleRef = doc(db, 'customers', userId, 'articles', articleId);

    // Get current article data
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Article not found');
    }

    const articleData = articleDoc.data();
    const questions = articleData.questions || [];

    // Find and update the specific question (tolerate string/number id mismatches)
    const questionIndex = questions.findIndex(q => {
      const qid = q && (q.id !== undefined && q.id !== null) ? String(q.id) : '';
      const oid = q && (q.originalId !== undefined && q.originalId !== null) ? String(q.originalId) : '';
      const target = String(questionId);
      return qid === target || oid === target;
    });
    if (questionIndex === -1) {
      throw new Error(`Question with ID ${questionId} not found`);
    }

    const currentQuestion = questions[questionIndex];

    // Update the question with voice response data
    questions[questionIndex] = {
      ...currentQuestion,
      // Use transcription as the main answer for compatibility
      answer: voiceData.transcription,
      answered: voiceData.transcription.trim().length > 0,
      timestamp: new Date(),
      // Voice-specific data
      voiceResponse: {
        transcription: voiceData.transcription,
        confidence: voiceData.confidence || 0,
        audioUrl: voiceData.audioUrl || null,
        suggestions: voiceData.suggestions || []
      },
      // Conversational context for voice interviews
      conversationalContext: {
        followUpCount: conversationalContext.followUpCount || 0,
        lastAIResponse: conversationalContext.lastAIResponse || '',
        needsFollowUp: conversationalContext.needsFollowUp || false
      }
    };

    await updateDoc(articleRef, {
      questions: questions,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error saving voice response:', error);
    throw new Error(`Failed to save voice response: ${error.message}`);
  }
};

/**
 * Save the final generated article
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @param {Object} articleData - The generated article data
 * @returns {Promise<void>}
 */
export const saveFinalArticle = async (userId, articleId, articleData) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  if (!articleData) {
    throw new Error('Article data is required');
  }

  try {
    const articleRef = doc(db, 'customers', userId, 'articles', articleId);

    // Check if article exists
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Article not found');
    }

    // Validate article data structure
    if (!articleData.title || !articleData.sections) {
      throw new Error('Article must have title and sections');
    }

    const finalArticle = {
      metadata: {
        title: articleData.metadata?.title || articleData.title,
        description: articleData.metadata?.description || '',
        keywords: articleData.metadata?.keywords || [],
        readingTime: articleData.metadata?.readingTime || 0,
        wordCount: articleData.metadata?.wordCount || 0
      },
      title: articleData.title,
      sections: articleData.sections,
      keyTakeaways: articleData.keyTakeaways || [],
      authorBio: articleData.authorBio || '',
      generatedAt: serverTimestamp()
    };

    await updateDoc(articleRef, {
      article: finalArticle,
      status: 'completed',
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    console.error('Error saving final article:', error);
    throw new Error(`Failed to save final article: ${error.message}`);
  }
};

/**
 * Retrieve article data for resuming or viewing
 * Enhanced to return both text and voice responses
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @returns {Promise<Object|null>} - The article data or null if not found
 */
export const getArticle = async (userId, articleId) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  try {
    const articleRef = doc(db, 'customers', userId, 'articles', articleId);
    const articleDoc = await getDoc(articleRef);

    if (!articleDoc.exists()) {
      return null;
    }

    const data = articleDoc.data();

    // Migrate questions to include voice fields if they don't exist
    const migratedQuestions = (data.questions || []).map(question => ({
      ...question,
      // Ensure voice response fields exist for backward compatibility
      voiceResponse: question.voiceResponse || {
        transcription: '',
        confidence: 0,
        audioUrl: null,
        suggestions: []
      },
      // Ensure conversational context exists
      conversationalContext: question.conversationalContext || {
        followUpCount: 0,
        lastAIResponse: '',
        needsFollowUp: false
      }
    }));

    // Return article data with computed fields and voice support
    return {
      id: articleId,
      ...data,
      questions: migratedQuestions,
      // Add computed progress field (works with both text and voice)
      progress: migratedQuestions.length > 0 ?
        Math.round((migratedQuestions.filter(q => q.answered).length / migratedQuestions.length) * 100) : 0,
      // Add voice-specific metadata
      hasVoiceResponses: migratedQuestions.some(q => 
        q.voiceResponse && q.voiceResponse.transcription && q.voiceResponse.transcription.trim().length > 0
      ),
      voiceResponseCount: migratedQuestions.filter(q => 
        q.voiceResponse && q.voiceResponse.transcription && q.voiceResponse.transcription.trim().length > 0
      ).length
    };

  } catch (error) {
    console.error('Error getting article:', error);
    throw new Error(`Failed to retrieve article: ${error.message}`);
  }
};

/**
 * Get all articles for a user
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<Array>} - Array of user's articles
 */
export const getUserArticles = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const articlesRef = collection(db, 'customers', userId, 'articles');
    const querySnapshot = await getDocs(articlesRef);

    const articles = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      articles.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to JavaScript dates
        createdAt: data.createdAt?.toDate() || null,
        updatedAt: data.updatedAt?.toDate() || null,
        // Add computed progress field
        progress: data.questions && data.questions.length > 0 ?
          Math.round((data.questions.filter(q => q.answered).length / data.questions.length) * 100) : 0
        // Preserve actual status and journeyStatus from Firestore
      });
    });

    // Sort by updatedAt descending (most recent first)
    articles.sort((a, b) => {
      const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : (a.updatedAt?.toMillis?.() || 0);
      const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : (b.updatedAt?.toMillis?.() || 0);
      return bTime - aTime;
    });

    return articles;

  } catch (error) {
    console.error('Error getting user articles:', error);
    throw new Error(`Failed to retrieve user articles: ${error.message}`);
  }
};

/**
 * Delete an article (handles both legacy and keyword-based articles)
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @param {string} keywordId - Optional keyword ID for keyword-based articles
 * @returns {Promise<void>}
 */
export const deleteArticle = async (userId, articleId, keywordId = null) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  try {
    // First, try to determine the article source if keywordId not provided
    if (!keywordId) {
      // Check if it's a legacy article
      const legacyRef = doc(db, 'customers', userId, 'articles', articleId);
      const legacyDoc = await getDoc(legacyRef);
      
      if (legacyDoc.exists()) {
        // It's a legacy article, delete it
        await deleteDoc(legacyRef);
        console.log('✅ Deleted legacy article:', articleId);
        return;
      }
      
      // If not legacy, try to find it in keyword-based or interview structure
      // Use collectionGroup to search across all keyword and interview subcollections
      const cgSnapshot = await getDocs(collectionGroup(db, 'json'));
      let found = false;

      for (const docSnap of cgSnapshot.docs) {
        if (docSnap.id === articleId) {
          const path = docSnap.ref.path;
          // Check if it belongs to this user
          if (path.startsWith(`users/${userId}/Key-word/`)) {
            // Delete the keyword-based article
            await deleteDoc(docSnap.ref);
            console.log('✅ Deleted keyword-based article:', articleId);
            found = true;
            break;
          } else if (path.startsWith(`users/${userId}/Interviews/`)) {
            // Delete the interview-based article
            await deleteDoc(docSnap.ref);
            console.log('✅ Deleted interview-based article:', articleId);
            found = true;
            break;
          }
        }
      }
      
      if (!found) {
        throw new Error('Article not found');
      }
    } else {
      // KeywordId provided, delete from keyword-based path directly
      const keywordArticleRef = doc(db, 'users', userId, 'Key-word', keywordId, 'json', articleId);
      
      // Check if it exists
      const keywordDoc = await getDoc(keywordArticleRef);
      if (!keywordDoc.exists()) {
        // Fallback to legacy path
        const legacyRef = doc(db, 'customers', userId, 'articles', articleId);
        const legacyDoc = await getDoc(legacyRef);
        
        if (legacyDoc.exists()) {
          await deleteDoc(legacyRef);
          console.log('✅ Deleted legacy article (fallback):', articleId);
        } else {
          throw new Error('Article not found in either location');
        }
      } else {
        await deleteDoc(keywordArticleRef);
        console.log('✅ Deleted keyword-based article:', articleId, 'from keyword:', keywordId);
      }
    }

  } catch (error) {
    console.error('Error deleting article:', error);
    throw new Error(`Failed to delete article: ${error.message}`);
  }
};

/**
 * Batch update multiple answers (for bulk operations)
 * Enhanced to handle both text and voice responses
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @param {Array} answers - Array of {questionId, answer, voiceData} objects
 * @returns {Promise<void>}
 */
export const batchSaveAnswers = async (userId, articleId, answers) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  if (!Array.isArray(answers) || answers.length === 0) {
    throw new Error('Answers array is required and cannot be empty');
  }

  try {
    const articleRef = doc(db, 'customers', userId, 'articles', articleId);

    // Get current article data
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Article not found');
    }

    const articleData = articleDoc.data();
    const questions = [...(articleData.questions || [])];

    // Update multiple questions with voice support
    answers.forEach(({ questionId, answer, voiceData, conversationalContext }) => {
      const questionIndex = questions.findIndex(q => String(q.id) === String(questionId));
      if (questionIndex !== -1) {
        const currentQuestion = questions[questionIndex];
        
        questions[questionIndex] = {
          ...currentQuestion,
          answer: answer,
          answered: answer.trim().length > 0,
          timestamp: new Date(), // Use regular Date instead of serverTimestamp in arrays
          // Update voice response if provided
          voiceResponse: voiceData ? {
            transcription: voiceData.transcription || answer,
            confidence: voiceData.confidence || 0,
            audioUrl: voiceData.audioUrl || null,
            suggestions: voiceData.suggestions || []
          } : (currentQuestion.voiceResponse || {
            transcription: '',
            confidence: 0,
            audioUrl: null,
            suggestions: []
          }),
          // Update conversational context if provided
          conversationalContext: conversationalContext ? {
            followUpCount: conversationalContext.followUpCount || 0,
            lastAIResponse: conversationalContext.lastAIResponse || '',
            needsFollowUp: conversationalContext.needsFollowUp || false
          } : (currentQuestion.conversationalContext || {
            followUpCount: 0,
            lastAIResponse: '',
            needsFollowUp: false
          })
        };
      }
    });

    await updateDoc(articleRef, {
      questions: questions,
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    console.error('Error batch saving answers:', error);
    throw new Error(`Failed to batch save answers: ${error.message}`);
  }
};

/**
 * Validate article data structure and migrate if necessary
 * @param {Object} articleData - Article data to validate
 * @returns {Object} - Validated and potentially migrated article data
 */
export const validateAndMigrateArticleData = (articleData) => {
  if (!articleData || typeof articleData !== 'object') {
    throw new Error('Invalid article data: must be an object');
  }

  // Create a copy to avoid mutating original data
  const validatedData = { ...articleData };

  // Validate and set required fields with defaults
  if (!validatedData.title || typeof validatedData.title !== 'string') {
    validatedData.title = validatedData.topic ? `Expert Guide: ${validatedData.topic}` :
      validatedData.setup?.topic ? `Expert Guide: ${validatedData.setup.topic}` :
        'Untitled Article';
  }

  if (!validatedData.topic || typeof validatedData.topic !== 'string') {
    validatedData.topic = validatedData.setup?.topic || 'General';
  }

  if (!validatedData.status || !['draft', 'in_progress', 'completed'].includes(validatedData.status)) {
    // Determine status based on data completeness
    if (validatedData.article && validatedData.article.title) {
      validatedData.status = 'completed';
    } else if (validatedData.questions && validatedData.questions.length > 0) {
      validatedData.status = 'in_progress';
    } else {
      validatedData.status = 'draft';
    }
  }

  // Validate and migrate setup data
  if (!validatedData.setup || typeof validatedData.setup !== 'object') {
    validatedData.setup = {
      topic: validatedData.topic,
      questionCount: 15,
      expertIntro: {}
    };
  }

  // Ensure setup has required fields
  if (!validatedData.setup.topic) {
    validatedData.setup.topic = validatedData.topic;
  }
  if (!validatedData.setup.questionCount || typeof validatedData.setup.questionCount !== 'number') {
    validatedData.setup.questionCount = validatedData.questions?.length || 15;
  }
  if (!validatedData.setup.expertIntro || typeof validatedData.setup.expertIntro !== 'object') {
    validatedData.setup.expertIntro = {};
  }

  // Validate and migrate questions array with voice support
  if (!Array.isArray(validatedData.questions)) {
    validatedData.questions = [];
  } else {
    // Validate each question and add missing fields including voice support
    validatedData.questions = validatedData.questions
      .filter(question => question && typeof question === 'object') // Filter out null/invalid questions
      .map((question, index) => ({
        id: (typeof question.id === 'number' && question.id > 0) ? question.id : index + 1,
        sectionTitle: question.sectionTitle || 'General',
        question: question.question || '',
        answered: typeof question.answered === 'boolean' ? question.answered : Boolean(question.answer && question.answer && question.answer.trim()),
        answer: question.answer || '',
        timestamp: question.timestamp || null,
        // Voice response fields with validation and defaults
        voiceResponse: question.voiceResponse && typeof question.voiceResponse === 'object' ? {
          transcription: question.voiceResponse.transcription || '',
          confidence: typeof question.voiceResponse.confidence === 'number' ? 
            Math.max(0, Math.min(1, question.voiceResponse.confidence)) : 0,
          audioUrl: question.voiceResponse.audioUrl || null,
          suggestions: Array.isArray(question.voiceResponse.suggestions) ? 
            question.voiceResponse.suggestions : []
        } : {
          transcription: '',
          confidence: 0,
          audioUrl: null,
          suggestions: []
        },
        // Conversational context fields with validation and defaults
        conversationalContext: question.conversationalContext && typeof question.conversationalContext === 'object' ? {
          followUpCount: typeof question.conversationalContext.followUpCount === 'number' ? 
            Math.max(0, question.conversationalContext.followUpCount) : 0,
          lastAIResponse: question.conversationalContext.lastAIResponse || '',
          needsFollowUp: typeof question.conversationalContext.needsFollowUp === 'boolean' ? 
            question.conversationalContext.needsFollowUp : false
        } : {
          followUpCount: 0,
          lastAIResponse: '',
          needsFollowUp: false
        }
      }));
  }

  // Validate timestamps
  if (!validatedData.createdAt) {
    validatedData.createdAt = serverTimestamp();
  }
  if (!validatedData.updatedAt) {
    validatedData.updatedAt = serverTimestamp();
  }

  return validatedData;
};

/**
 * Update article status
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @param {string} status - New status ('draft', 'in_progress', 'completed')
 * @returns {Promise<void>}
 */
export const updateArticleStatus = async (userId, articleId, status) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  if (!['draft', 'in_progress', 'completed'].includes(status)) {
    throw new Error('Status must be one of: draft, in_progress, completed');
  }

  try {
    const articleRef = doc(db, 'customers', userId, 'articles', articleId);

    // Check if article exists
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Article not found');
    }

    await updateDoc(articleRef, {
      status: status,
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    console.error('Error updating article status:', error);
    throw new Error(`Failed to update article status: ${error.message}`);
  }
};

/**
 * Get articles by status for a user
 * @param {string} userId - The authenticated user's ID
 * @param {string} status - Status to filter by ('draft', 'in_progress', 'completed')
 * @returns {Promise<Array>} - Array of articles with the specified status
 */
export const getArticlesByStatus = async (userId, status) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!['draft', 'in_progress', 'completed'].includes(status)) {
    throw new Error('Status must be one of: draft, in_progress, completed');
  }

  try {
    const articles = await getUserArticles(userId);
    return articles.filter(article => article.status === status);
  } catch (error) {
    console.error('Error getting articles by status:', error);
    throw new Error(`Failed to get articles by status: ${error.message}`);
  }
};

/**
 * Get resumable articles (draft or in_progress) for a user
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<Array>} - Array of resumable articles
 */
export const getResumableArticles = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const articles = await getUserArticles(userId);
    return articles.filter(article =>
      article.status === 'draft' || article.status === 'in_progress'
    ).map(article => ({
      ...article,
      canResume: true,
      resumeStep: determineResumeStep(article)
    }));
  } catch (error) {
    console.error('Error getting resumable articles:', error);
    throw new Error(`Failed to get resumable articles: ${error.message}`);
  }
};

/**
 * Determine which step a user should resume from
 * @param {Object} articleData - Article data
 * @returns {string} - Resume step ('setup', 'questions', 'generation')
 */
const determineResumeStep = (articleData) => {
  if (!articleData) return 'setup';

  // If article is completed, no resume needed
  if (articleData.status === 'completed') {
    return 'completed';
  }

  // If no questions generated yet, resume at setup
  if (!articleData.questions || articleData.questions.length === 0) {
    return 'setup';
  }

  // If questions exist but not all answered, resume at questions
  const answeredQuestions = articleData.questions.filter(q => q.answered).length;
  const totalQuestions = articleData.questions.length;

  if (answeredQuestions < totalQuestions) {
    return 'questions';
  }

  // If all questions answered but no final article, resume at generation
  if (!articleData.article || !articleData.article.title) {
    return 'generation';
  }

  // Otherwise, article is complete
  return 'completed';
};

/**
 * Update conversational context for a question
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @param {number} questionId - The question ID to update
 * @param {Object} contextData - Conversational context data
 * @param {number} contextData.followUpCount - Number of follow-ups
 * @param {string} contextData.lastAIResponse - Last AI response
 * @param {boolean} contextData.needsFollowUp - Whether follow-up is needed
 * @returns {Promise<void>}
 */
export const updateConversationalContext = async (userId, articleId, questionId, contextData) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  if (questionId === undefined || questionId === null) {
    throw new Error('Question ID is required');
  }

  if (!contextData || typeof contextData !== 'object') {
    throw new Error('Context data is required');
  }

  try {
    const articleRef = doc(db, 'customers', userId, 'articles', articleId);

    // Get current article data
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Article not found');
    }

    const articleData = articleDoc.data();
    const questions = articleData.questions || [];

    // Find and update the specific question
    const questionIndex = questions.findIndex(q => q.id === questionId);
    if (questionIndex === -1) {
      throw new Error(`Question with ID ${questionId} not found`);
    }

    const currentQuestion = questions[questionIndex];

    // Update conversational context
    questions[questionIndex] = {
      ...currentQuestion,
      conversationalContext: {
        followUpCount: contextData.followUpCount || 0,
        lastAIResponse: contextData.lastAIResponse || '',
        needsFollowUp: contextData.needsFollowUp || false
      }
    };

    await updateDoc(articleRef, {
      questions: questions,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating conversational context:', error);
    throw new Error(`Failed to update conversational context: ${error.message}`);
  }
};

/**
 * Get questions that need follow-up in voice interviews
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @returns {Promise<Array>} - Array of questions needing follow-up
 */
export const getQuestionsNeedingFollowUp = async (userId, articleId) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  try {
    const article = await getArticle(userId, articleId);
    if (!article) {
      throw new Error('Article not found');
    }

    return article.questions.filter(question => 
      question.conversationalContext && 
      question.conversationalContext.needsFollowUp === true
    );
  } catch (error) {
    console.error('Error getting questions needing follow-up:', error);
    throw new Error(`Failed to get questions needing follow-up: ${error.message}`);
  }
};

/**
 * Get voice response statistics for an article
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @returns {Promise<Object>} - Voice response statistics
 */
export const getVoiceResponseStats = async (userId, articleId) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  try {
    const article = await getArticle(userId, articleId);
    if (!article) {
      throw new Error('Article not found');
    }

    const voiceResponses = article.questions.filter(q => 
      q.voiceResponse && q.voiceResponse.transcription && q.voiceResponse.transcription.trim().length > 0
    );

    const stats = {
      totalQuestions: article.questions.length,
      voiceResponses: voiceResponses.length,
      textResponses: article.questions.filter(q => 
        q.answered && (!q.voiceResponse || !q.voiceResponse.transcription)
      ).length,
      averageConfidence: 0,
      totalFollowUps: 0,
      questionsWithAudio: voiceResponses.filter(q => q.voiceResponse.audioUrl).length
    };

    if (voiceResponses.length > 0) {
      const totalConfidence = voiceResponses.reduce((sum, q) => 
        sum + (q.voiceResponse.confidence || 0), 0
      );
      stats.averageConfidence = totalConfidence / voiceResponses.length;

      stats.totalFollowUps = voiceResponses.reduce((sum, q) => 
        sum + (q.conversationalContext?.followUpCount || 0), 0
      );
    }

    return stats;
  } catch (error) {
    console.error('Error getting voice response stats:', error);
    throw new Error(`Failed to get voice response statistics: ${error.message}`);
  }
};

/**
 * Get article statistics for dashboard
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<Object>} - Article statistics
 */
export const getArticleStats = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Use unified loader so stats include both legacy and keyword-based articles
    const articles = await getAllArticlesUnified(userId);

    // Exclude 'view' status from total and other counts, but include in drafts
    const totalArticles = articles.filter(a => a.status !== 'view');

    const stats = {
      total: totalArticles.length,
      completed: totalArticles.filter(a => a.status === 'completed').length,
      inProgress: totalArticles.filter(a => a.status === 'in_progress').length,
      drafts: totalArticles.filter(a => a.status === 'draft').length + articles.filter(a => a.status === 'view').length,
      totalWords: 0,
      averageProgress: 0,
      recentActivity: []
    };

    // Calculate total words and average progress
    let totalProgress = 0;
    articles.forEach(article => {
      // Prefer explicit metadata from normalized article shape
      const wc = article?.article?.metadata?.wordCount
        ?? article?.metadata?.wordCount
        ?? 0;
      stats.totalWords += Number.isFinite(wc) ? wc : 0;

      // Progress may be undefined for keyword-based items; treat as 0
      totalProgress += article.progress || 0;
    });

    if (articles.length > 0) {
      stats.averageProgress = Math.round(totalProgress / articles.length);
    }

    const toTime = (ts) => {
      try {
        if (!ts) return 0;
        if (ts instanceof Date) return ts.getTime();
        if (typeof ts.toDate === 'function') return ts.toDate().getTime();
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        const n = new Date(ts).getTime();
        return Number.isFinite(n) ? n : 0;
      } catch {
        return 0;
      }
    };

    // Get recent activity (last 5 updated articles)
    stats.recentActivity = [...articles]
      .sort((a, b) => toTime(b?.updatedAt) - toTime(a?.updatedAt))
      .slice(0, 5)
      .map(article => ({
        id: article.id,
        title: article.title,
        action: getLastAction(article),
        timestamp: article.updatedAt
      }));

    return stats;
  } catch (error) {
    console.error('Error getting article stats:', error);
    throw new Error(`Failed to get article statistics: ${error.message}`);
  }
};

/**
 * Determine the last action performed on an article
 * Enhanced to recognize voice interview actions
 * @param {Object} article - Article data
 * @returns {string} - Last action description
 */
const getLastAction = (article) => {
  if (article.status === 'completed') {
    return 'Article completed';
  }

  if (article.questions && article.questions.length > 0) {
    const answeredCount = article.questions.filter(q => q.answered).length;
    const voiceResponseCount = article.questions.filter(q => 
      q.voiceResponse && q.voiceResponse.transcription && q.voiceResponse.transcription.trim().length > 0
    ).length;
    
    if (answeredCount > 0) {
      if (voiceResponseCount > 0) {
        return `Voice interview: ${voiceResponseCount}/${article.questions.length} questions`;
      } else {
        return `Answered ${answeredCount}/${article.questions.length} questions`;
      }
    } else {
      return 'Questions generated';
    }
  }

  if (article.setup && article.setup.expertIntro) {
    return 'Setup completed';
  }

  return 'Article created';
};

/**
 * Check if an article has mixed response types (both text and voice)
 * @param {Object} article - Article data
 * @returns {boolean} - True if article has both text and voice responses
 */
export const hasMixedResponseTypes = (article) => {
  if (!article || !article.questions || article.questions.length === 0) {
    return false;
  }

  const hasTextResponses = article.questions.some(q => 
    q.answered && (!q.voiceResponse || !q.voiceResponse.transcription)
  );
  
  const hasVoiceResponses = article.questions.some(q => 
    q.voiceResponse && q.voiceResponse.transcription && q.voiceResponse.transcription.trim().length > 0
  );

  return hasTextResponses && hasVoiceResponses;
};

/**
 * Get the interview mode used for an article
 * @param {Object} article - Article data
 * @returns {string} - 'text', 'voice', 'mixed', or 'unknown'
 */
export const getInterviewMode = (article) => {
  if (!article || !article.questions || article.questions.length === 0) {
    return 'unknown';
  }

  const hasTextResponses = article.questions.some(q => 
    q.answered && (!q.voiceResponse || !q.voiceResponse.transcription)
  );
  
  const hasVoiceResponses = article.questions.some(q => 
    q.voiceResponse && q.voiceResponse.transcription && q.voiceResponse.transcription.trim().length > 0
  );

  if (hasTextResponses && hasVoiceResponses) {
    return 'mixed';
  } else if (hasVoiceResponses) {
    return 'voice';
  } else if (hasTextResponses) {
    return 'text';
  } else {
    return 'unknown';
  }
};

/**
 * Save a processed insight string per question
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @param {number} questionId - The question ID to update
 * @param {string} processedText - The processed insight text
 * @returns {Promise<void>}
 */
export const saveProcessedInsight = async (userId, articleId, questionId, processedText) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }
  if (questionId === undefined || questionId === null) {
    throw new Error('Question ID is required');
  }
  try {
    const articleRef = doc(db, 'customers', userId, 'articles', articleId);
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Article not found');
    }
    const articleData = articleDoc.data();
    const questions = articleData.questions || [];

    const idx = questions.findIndex(q => String(q.id) === String(questionId));
    if (idx === -1) {
      throw new Error(`Question with ID ${questionId} not found`);
    }

    const current = questions[idx];
    questions[idx] = {
      ...current,
      processedInsight: typeof processedText === 'string' ? processedText : ''
    };

    await updateDoc(articleRef, {
      questions,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error saving processed insight:', error);
    throw new Error(`Failed to save processed insight: ${error.message}`);
  }
};

/**
 * Batch save processed insights for multiple questions
 * @param {string} userId - The authenticated user's ID
 * @param {string} articleId - The article slug/ID
 * @param {Object} insightsMap - Map of question IDs to processed insights
 * @returns {Promise<void>}
 */
export const batchSaveProcessedInsights = async (userId, articleId, insightsMap) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }
  if (!insightsMap || typeof insightsMap !== 'object') {
    throw new Error('insightsMap is required');
  }
  try {
    const articleRef = doc(db, 'customers', userId, 'articles', articleId);
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Article not found');
    }
    const articleData = articleDoc.data();
    const questions = articleData.questions || [];

    const updated = questions.map(q => {
      const key = String(q.id);
      if (insightsMap.hasOwnProperty(key)) {
        const newInsight = String(insightsMap[key] || '').trim();
        const existingInsight = (q.processedInsight || '').trim();

        // Safeguard: Do not overwrite a valid, existing insight with "N/A" or an empty string.
        if (existingInsight && newInsight === 'N/A') {
          return q; // Keep the existing insight
        }
        
        // Update with the new insight
        return { ...q, processedInsight: newInsight };
      }
      return q; // No update for this question
    });

    await updateDoc(articleRef, {
      questions: updated,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error batch-saving processed insights:', error);
    throw new Error(`Failed to save processed insights: ${error.message}`);
  }
};