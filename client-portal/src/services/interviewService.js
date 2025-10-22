 /**
 * Interview Service for Firestore Operations
 * Handles all CRUD operations for interview-based content in Firestore
 * New structure: /users/{userId}/interviews/{interviewId}/
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
 * Generate a unique interview ID
 * @param {string} topic - The interview topic
 * @returns {string} - Unique interview ID
 */
const generateInterviewId = (topic) => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const topicSlug = topic.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
  return `interview_${timestamp}_${topicSlug}_${randomSuffix}`;
};

/**
 * Save interview setup data to Firestore
 * Path: /users/{userId}/interviews/{interviewId}/setup/
 * @param {string} userId - The authenticated user's ID
 * @param {Object} setupData - Interview setup data
 * @param {string} setupData.topic - Interview topic
 * @param {string} setupData.mode - Interview mode ('text' or 'voice')
 * @param {number} setupData.questionCount - Number of questions
 * @param {Object} setupData.expertIntro - Expert introduction data
 * @returns {Promise<string>} - The created interview ID
 */
export const saveInterviewSetup = async (userId, setupData) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!setupData.topic) {
    throw new Error('Interview topic is required');
  }

  if (!setupData.mode || !['text', 'voice'].includes(setupData.mode)) {
    throw new Error('Valid interview mode is required');
  }

  try {
    const interviewId = generateInterviewId(setupData.topic);

    // Use the same path as articleService.js for unified storage
    const interviewRef = doc(db, 'customers', userId, 'articles', interviewId);

    const interviewData = {
      id: interviewId,
      title: `Expert Guide: ${setupData.topic}`,
      topic: setupData.topic,
      mode: setupData.mode,
      questionCount: setupData.questionCount || 15,
      // Use the journey status system for proper ArticleList integration
      status: setupData.status || setupData.journeyStatus || 'in_progress',
      journeyStatus: setupData.journeyStatus || 'in_progress',
      createdAt: setupData.createdAt || serverTimestamp(),
      updatedAt: setupData.updatedAt || serverTimestamp(),
      setup: {
        topic: setupData.topic,
        mode: setupData.mode,
        questionCount: setupData.questionCount || 15,
        expertIntro: setupData.expertIntro || {}
      },
      // Initialize empty arrays for questions and article (compatible with articleService)
      questions: [],
      article: null,
      // Add progress field for ArticleList compatibility
      progress: 0,
      // Mark as interview-based for identification
      _source: 'interview',
      // Store brand voice settings used for this interview
      brandVoice: setupData.brandVoice || null
    };

    await setDoc(interviewRef, interviewData);

    console.log(`Interview setup saved successfully: ${interviewId} for topic: ${setupData.topic}`);
    return interviewId;

  } catch (error) {
    console.error('Error saving interview setup to Firestore:', error);
    throw new Error(`Failed to save interview setup: ${error.message}`);
  }
};

/**
 * Save interview content (questions and answers) to Firestore
 * Path: /users/{userId}/interviews/{interviewId}/content/
 * @param {string} userId - The authenticated user's ID
 * @param {string} interviewId - The interview ID
 * @param {Object} contentData - Interview content data
 * @param {Array} contentData.questions - Array of questions with answers
 * @param {Object} contentData.generatedArticle - Generated article data
 * @param {string} contentData.mode - Interview mode
 * @returns {Promise<void>}
 */
export const saveInterviewContent = async (userId, interviewId, contentData) => {
  if (!userId || !interviewId) {
    throw new Error('User ID and Interview ID are required');
  }

  if (!contentData) {
    throw new Error('Content data is required');
  }

  try {
    // Use the same path as articleService.js for unified storage
    const interviewRef = doc(db, 'customers', userId, 'articles', interviewId);

    // Check if interview exists
    const interviewDoc = await getDoc(interviewRef);
    if (!interviewDoc.exists()) {
      throw new Error('Interview not found');
    }

    const contentUpdate = {
      questions: contentData.questions || [],
      generatedArticle: contentData.generatedArticle || null,
      article: contentData.generatedArticle || null, // For articleService compatibility
      mode: contentData.mode,
      // Set _source based on interview mode
      _source: contentData.mode === 'voice' ? 'voice' : 'text',
      // Calculate progress based on questions
      progress: contentData.questions && contentData.questions.length > 0 ?
        Math.round((contentData.questions.filter(q => q.answered).length / contentData.questions.length) * 100) : 0,
      // Update brand voice settings if provided
      ...(contentData.brandVoice && { brandVoice: contentData.brandVoice })
    };

    // Keep interview articles as in_progress until article generation is implemented
    contentUpdate.status = 'in_progress';
    contentUpdate.journeyStatus = 'in_progress';

    await updateDoc(interviewRef, {
      ...contentUpdate,
      updatedAt: serverTimestamp()
    });

    console.log(`Interview content saved successfully: ${interviewId}`);

  } catch (error) {
    console.error('Error saving interview content to Firestore:', error);
    throw new Error(`Failed to save interview content: ${error.message}`);
  }
};

/**
 * Get interview by ID
 * @param {string} userId - The authenticated user's ID
 * @param {string} interviewId - The interview ID
 * @returns {Promise<Object|null>} - The interview data or null if not found
 */
export const getInterviewById = async (userId, interviewId) => {
  if (!userId || !interviewId) {
    throw new Error('User ID and Interview ID are required');
  }

  try {
    // Use the same path as articleService.js for unified storage
    const interviewRef = doc(db, 'customers', userId, 'articles', interviewId);
    const interviewDoc = await getDoc(interviewRef);

    if (!interviewDoc.exists()) {
      return null;
    }

    const data = interviewDoc.data();

    return {
      id: interviewDoc.id,
      ...data,
      // Convert Firestore timestamps to JavaScript dates
      createdAt: data.createdAt?.toDate() || null,
      updatedAt: data.updatedAt?.toDate() || null,
      completedAt: data.completedAt?.toDate() || null,
      // Add computed progress field for compatibility
      progress: data.questions && data.questions.length > 0 ?
        Math.round((data.questions.filter(q => q.answered).length / data.questions.length) * 100) : 0
    };

  } catch (error) {
    console.error('Error getting interview by ID:', error);
    throw new Error(`Failed to get interview: ${error.message}`);
  }
};

/**
 * Get all user interviews
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<Array>} - Array of user's interviews
 */
export const getUserInterviews = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Use the same path as articleService.js for unified storage
    const interviewsRef = collection(db, 'customers', userId, 'articles');
    const q = query(interviewsRef, orderBy('updatedAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const interviews = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Only include interview-based articles (filter out keyword-based ones)
      if (data._source === 'interview' || data.setup) {
        interviews.push({
          id: doc.id,
          ...data,
          // Convert Firestore timestamps to JavaScript dates
          createdAt: data.createdAt?.toDate() || null,
          updatedAt: data.updatedAt?.toDate() || null,
          completedAt: data.completedAt?.toDate() || null,
          // Add computed progress field
          progress: data.questions && data.questions.length > 0 ?
            Math.round((data.questions.filter(q => q.answered).length / data.questions.length) * 100) : 0
        });
      }
    });

    return interviews;

  } catch (error) {
    console.error('Error getting user interviews:', error);
    throw new Error(`Failed to get user interviews: ${error.message}`);
  }
};

/**
 * Update interview with new data
 * @param {string} userId - The authenticated user's ID
 * @param {string} interviewId - The interview ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<void>}
 */
export const updateInterview = async (userId, interviewId, updateData) => {
  if (!userId || !interviewId) {
    throw new Error('User ID and Interview ID are required');
  }

  if (!updateData || typeof updateData !== 'object') {
    throw new Error('Update data must be an object');
  }

  try {
    // Use the same path as articleService.js for unified storage
    const interviewRef = doc(db, 'customers', userId, 'articles', interviewId);

    // Check if interview exists
    const interviewDoc = await getDoc(interviewRef);
    if (!interviewDoc.exists()) {
      throw new Error('Interview not found');
    }

    // Calculate progress if questions are being updated
    const finalUpdateData = { ...updateData };
    if (updateData.questions && Array.isArray(updateData.questions)) {
      finalUpdateData.progress = updateData.questions.length > 0 ?
        Math.round((updateData.questions.filter(q => q.answered).length / updateData.questions.length) * 100) : 0;

      // Do NOT auto-update status based on answered questions.
      // Leave status/journeyStatus unchanged unless explicitly provided in updateData.
    }

    await updateDoc(interviewRef, {
      ...finalUpdateData,
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    console.error('Error updating interview:', error);
    throw new Error(`Failed to update interview: ${error.message}`);
  }
};

/**
 * Delete an interview
 * @param {string} userId - The authenticated user's ID
 * @param {string} interviewId - The interview ID
 * @returns {Promise<void>}
 */
export const deleteInterview = async (userId, interviewId) => {
  if (!userId || !interviewId) {
    throw new Error('User ID and Interview ID are required');
  }

  try {
    // Use the same path as articleService.js for unified storage
    const interviewRef = doc(db, 'customers', userId, 'articles', interviewId);

    // Check if interview exists
    const interviewDoc = await getDoc(interviewRef);
    if (!interviewDoc.exists()) {
      throw new Error('Interview not found');
    }

    await deleteDoc(interviewRef);

    console.log(`Interview deleted successfully: ${interviewId}`);

  } catch (error) {
    console.error('Error deleting interview:', error);
    throw new Error(`Failed to delete interview: ${error.message}`);
  }
};

/**
 * Save Google Docs data for an interview
 * @param {string} userId - The authenticated user's ID
 * @param {string} interviewId - The interview ID
 * @param {Object} googleDocsData - Google Docs conversion data
 * @param {string} googleDocsData.documentUrl - URL of the created Google Doc
 * @param {string} googleDocsData.documentTitle - Title of the created Google Doc
 * @param {string} googleDocsData.documentId - Google Docs document ID
 * @returns {Promise<void>}
 */
export const saveInterviewGoogleDocsData = async (userId, interviewId, googleDocsData) => {
  if (!userId || !interviewId) {
    throw new Error('User ID and Interview ID are required');
  }

  if (!googleDocsData || !googleDocsData.documentUrl) {
    throw new Error('Google Docs data with document URL is required');
  }

  try {
    // Use the same path as articleService.js for unified storage
    const interviewRef = doc(db, 'customers', userId, 'articles', interviewId);

    // Check if interview exists
    const interviewDoc = await getDoc(interviewRef);
    if (!interviewDoc.exists()) {
      throw new Error('Interview not found');
    }

    const googleDocsMetadata = {
      documentUrl: googleDocsData.documentUrl,
      documentTitle: googleDocsData.documentTitle || 'Untitled Document',
      documentId: googleDocsData.documentId || null,
      convertedAt: serverTimestamp(),
      conversionStatus: 'completed'
    };

    await updateDoc(interviewRef, {
      googleDocs: googleDocsMetadata,
      updatedAt: serverTimestamp()
    });

    console.log(`Google Docs data saved for interview: ${interviewId}`);

  } catch (error) {
    console.error('Error saving Google Docs data for interview:', error);
    throw new Error(`Failed to save Google Docs data: ${error.message}`);
  }
};

/**
 * Get interview statistics for dashboard
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<Object>} - Interview statistics
 */
export const getInterviewStats = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const interviews = await getUserInterviews(userId);

    const stats = {
      total: interviews.length,
      completed: interviews.filter(i => i.status === 'completed').length,
      textMode: interviews.filter(i => i.mode === 'text').length,
      voiceMode: interviews.filter(i => i.mode === 'voice').length,
      recentActivity: []
    };

    // Get recent activity (last 5 updated interviews)
    stats.recentActivity = [...interviews]
      .sort((a, b) => (b.updatedAt || new Date(0)) - (a.updatedAt || new Date(0)))
      .slice(0, 5)
      .map(interview => ({
        id: interview.id,
        title: interview.topic,
        mode: interview.mode,
        status: interview.status,
        timestamp: interview.updatedAt
      }));

    return stats;
  } catch (error) {
    console.error('Error getting interview stats:', error);
    throw new Error(`Failed to get interview statistics: ${error.message}`);
  }
};

/**
 * Search interviews for a user
 * @param {string} userId - The authenticated user's ID
 * @param {string} searchTerm - The search term
 * @param {number} limitResults - Maximum number of results (default: 20)
 * @returns {Promise<Array>} - Array of matching interviews
 */
export const searchUserInterviews = async (userId, searchTerm, limitResults = 20) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!searchTerm || typeof searchTerm !== 'string') {
    throw new Error('Search term is required');
  }

  try {
    const interviews = await getUserInterviews(userId);

    // Filter interviews that match the search term
    const matchingInterviews = interviews.filter(interview => {
      const searchLower = searchTerm.toLowerCase();

      // Search in topic and content
      return (
        interview.topic?.toLowerCase().includes(searchLower) ||
        interview.generatedArticle?.title?.toLowerCase().includes(searchLower) ||
        JSON.stringify(interview.questions || []).toLowerCase().includes(searchLower)
      );
    });

    // Sort by relevance and recency
    matchingInterviews.sort((a, b) => {
      const searchLower = searchTerm.toLowerCase();
      const aTopicMatch = a.topic?.toLowerCase().includes(searchLower);
      const bTopicMatch = b.topic?.toLowerCase().includes(searchLower);

      if (aTopicMatch && !bTopicMatch) return -1;
      if (!aTopicMatch && bTopicMatch) return 1;

      // If both or neither match topic, sort by update date
      return (b.updatedAt || new Date(0)) - (a.updatedAt || new Date(0));
    });

    return matchingInterviews.slice(0, limitResults);

  } catch (error) {
    console.error('Error searching user interviews:', error);
    throw new Error(`Failed to search interviews: ${error.message}`);
  }
};