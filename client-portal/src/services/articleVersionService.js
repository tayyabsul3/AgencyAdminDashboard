/**
 * Article Version Service
 * Handles versioning, saving, and retrieving article content with history tracking
 */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
  limit,
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase.js';

/**
 * Save a new version of the article
 * @param {string} userId 
 * @param {string} articleId 
 * @param {Object} versionData 
 * @param {string} source 
 * @param {string|null} keywordId 
 */
export const saveArticleVersion = async (userId, articleId, versionData, source = 'legacy', keywordId = null) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  try {
    let articleRef;
    let versionsCollectionRef;
    
    if (source === 'keyword' && keywordId) {
      // Keyword-based article
      articleRef = doc(db, 'users', userId, 'Key-word', keywordId, 'json', articleId);
      versionsCollectionRef = collection(db, 'users', userId, 'Key-word', keywordId, 'json', articleId, 'versions');
    } else if (source === 'interview' && keywordId) {
      // Interview-based article
      articleRef = doc(db, 'users', userId, 'Interviews', keywordId, 'json', articleId);
      versionsCollectionRef = collection(db, 'users', userId, 'Interviews', keywordId, 'json', articleId, 'versions');
    } else {
      // Legacy article
      articleRef = doc(db, 'customers', userId, 'articles', articleId);
      versionsCollectionRef = collection(db, 'customers', userId, 'articles', articleId, 'versions');
    }
    
    // Check if article exists
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      throw new Error('Article not found');
    }
    
    const currentData = articleDoc.data();
    
    // Save current content as a version before updating
    // Only if content has actually changed
    if (currentData.htmlContent && currentData.htmlContent !== versionData.htmlContent) {
      await addDoc(versionsCollectionRef, {
        htmlContent: currentData.htmlContent,
        title: (typeof currentData.title === 'string' && currentData.title.trim().length > 0)
          ? currentData.title
          : 'Untitled',
        savedAt: currentData.updatedAt || serverTimestamp(),
        savedBy: currentData.modifiedBy || userId,
        versionNumber: currentData.versionNumber || 1,
        isAutoSave: false
      });
    }
    
    // Update the main article with new content
    // If this is being saved after a restore, we increment version
    // If it's a normal edit, we also increment
    const newVersionNumber = currentData.restoredFromId && !currentData.hasEdits
      ? (currentData.versionNumber || 1) + 1  // First save after restore gets new version
      : (currentData.versionNumber || 1) + 1; // Normal save increments
    
    // Build update payload without undefined fields (Firestore does not allow undefined)
    const updatePayload = {
      htmlContent: versionData.htmlContent,
      lastModified: versionData.lastModified || serverTimestamp(),
      modifiedBy: versionData.modifiedBy || currentData.modifiedBy || null,
      versionNumber: newVersionNumber,
      hasEdits: true,
      restoredFromId: null,
      updatedAt: serverTimestamp()
    };

    const candidateTitle = (versionData.title ?? currentData.title);
    if (typeof candidateTitle === 'string') {
      const trimmed = candidateTitle.trim();
      if (trimmed.length > 0) {
        updatePayload.title = trimmed;
      }
    }

    // Include meta_description if provided
    if (versionData.meta_description && typeof versionData.meta_description === 'string') {
      const trimmedMetaDesc = versionData.meta_description.trim();
      if (trimmedMetaDesc.length > 0) {
        updatePayload.meta_description = trimmedMetaDesc;
      }
    }

    await updateDoc(articleRef, updatePayload);
    
    return {
      success: true,
      versionNumber: newVersionNumber
    };
    
  } catch (error) {
    console.error('Error saving article version:', error);
    throw new Error(`Failed to save article version: ${error.message}`);
  }
};

/**
 * Get the current/latest version of the article
 * This always returns the most recently saved HTML content
 */
export const getCurrentArticleContent = async (userId, articleId, source = 'legacy', keywordId = null) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  try {
    let articleRef;
    
    if (source === 'keyword' && keywordId) {
      articleRef = doc(db, 'users', userId, 'Key-word', keywordId, 'json', articleId);
    } else if (source === 'interview' && keywordId) {
      articleRef = doc(db, 'users', userId, 'Interviews', keywordId, 'json', articleId);
    } else {
      articleRef = doc(db, 'customers', userId, 'articles', articleId);
    }
    
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      return null;
    }
    
    const data = articleDoc.data();
    
    // Return the current HTML content and metadata
    return {
      htmlContent: data.htmlContent || null,
      title: data.title || null, // Include title in the returned data
      meta_description: data.meta_description || null, // Include saved meta_description
      versionNumber: data.versionNumber || 1,
      lastModified: data.lastModified || data.updatedAt?.toDate() || null,
      modifiedBy: data.modifiedBy || null,
      originalData: data // Keep original data for reference
    };
    
  } catch (error) {
    console.error('Error getting current article content:', error);
    throw new Error(`Failed to get current article content: ${error.message}`);
  }
};

/**
 * Get all versions of an article (history)
 */
export const getArticleVersionHistory = async (userId, articleId, source = 'legacy', keywordId = null) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  try {
    let versionsCollectionRef;
    
    if (source === 'keyword' && keywordId) {
      versionsCollectionRef = collection(db, 'users', userId, 'Key-word', keywordId, 'json', articleId, 'versions');
    } else if (source === 'interview' && keywordId) {
      versionsCollectionRef = collection(db, 'users', userId, 'Interviews', keywordId, 'json', articleId, 'versions');
    } else {
      versionsCollectionRef = collection(db, 'customers', userId, 'articles', articleId, 'versions');
    }
    
    const q = query(versionsCollectionRef, orderBy('savedAt', 'desc'));
    const versionsSnapshot = await getDocs(q);
    
    const versions = [];
    versionsSnapshot.forEach((doc) => {
      const data = doc.data();
      versions.push({
        id: doc.id,
        ...data,
        savedAt: data.savedAt?.toDate() || null
      });
    });
    
    return versions;
    
  } catch (error) {
    console.error('Error getting article version history:', error);
    // Return empty array if versions collection doesn't exist yet
    return [];
  }
};

/**
 * View a specific version of the article (read-only, no restoration)
 */
export const viewArticleVersion = async (userId, articleId, versionId, source = 'legacy', keywordId = null) => {
  if (!userId || !articleId || !versionId) {
    throw new Error('User ID, Article ID, and Version ID are required');
  }

  try {
    let versionDocRef;
    
    if (source === 'keyword' && keywordId) {
      versionDocRef = doc(db, 'users', userId, 'Key-word', keywordId, 'json', articleId, 'versions', versionId);
    } else if (source === 'interview' && keywordId) {
      versionDocRef = doc(db, 'users', userId, 'Interviews', keywordId, 'json', articleId, 'versions', versionId);
    } else {
      versionDocRef = doc(db, 'customers', userId, 'articles', articleId, 'versions', versionId);
    }
    
    // Get the version to view
    const versionDoc = await getDoc(versionDocRef);
    if (!versionDoc.exists()) {
      throw new Error('Version not found');
    }
    
    const versionData = versionDoc.data();
    
    return {
      htmlContent: versionData.htmlContent,
      versionNumber: versionData.versionNumber,
      savedAt: versionData.savedAt?.toDate() || null,
      savedBy: versionData.savedBy,
      isHistorical: true // Flag to indicate this is a historical version
    };
    
  } catch (error) {
    console.error('Error viewing article version:', error);
    throw new Error(`Failed to view article version: ${error.message}`);
  }
};

/**
 * Smart restore that doesn't create loops
 * Only updates the main content, doesn't increment version until actual edit
 */
export const smartRestoreVersion = async (userId, articleId, versionId, source = 'legacy', keywordId = null) => {
  if (!userId || !articleId || !versionId) {
    throw new Error('User ID, Article ID, and Version ID are required');
  }

  try {
    let articleRef;
    let versionDocRef;
    
    if (source === 'keyword' && keywordId) {
      articleRef = doc(db, 'users', userId, 'Key-word', keywordId, 'json', articleId);
      versionDocRef = doc(db, 'users', userId, 'Key-word', keywordId, 'json', articleId, 'versions', versionId);
    } else if (source === 'interview' && keywordId) {
      articleRef = doc(db, 'users', userId, 'Interviews', keywordId, 'json', articleId);
      versionDocRef = doc(db, 'users', userId, 'Interviews', keywordId, 'json', articleId, 'versions', versionId);
    } else {
      articleRef = doc(db, 'customers', userId, 'articles', articleId);
      versionDocRef = doc(db, 'customers', userId, 'articles', articleId, 'versions', versionId);
    }
    
    // Get the version to restore
    const versionDoc = await getDoc(versionDocRef);
    if (!versionDoc.exists()) {
      throw new Error('Version not found');
    }
    
    const versionData = versionDoc.data();
    
    // Get current article data
    const articleDoc = await getDoc(articleRef);
    const currentData = articleDoc.data();
    
    // Check if we need to save the current version
    // Only save if it's different from what we're restoring and not already saved
    const isDifferent = currentData.htmlContent !== versionData.htmlContent;
    const isUnsaved = !currentData.restoredFromId || currentData.hasEdits;
    
    if (isDifferent && isUnsaved && currentData.htmlContent) {
      // Save current as a version only if it has unique changes
      const versionsCollectionRef = source === 'keyword' && keywordId
        ? collection(db, 'users', userId, 'Key-word', keywordId, 'json', articleId, 'versions')
        : source === 'interview' && keywordId
        ? collection(db, 'users', userId, 'Interviews', keywordId, 'json', articleId, 'versions')
        : collection(db, 'customers', userId, 'articles', articleId, 'versions');
        
      await addDoc(versionsCollectionRef, {
        htmlContent: currentData.htmlContent,
        savedAt: currentData.updatedAt || serverTimestamp(),
        savedBy: currentData.modifiedBy || userId,
        versionNumber: currentData.versionNumber || 1,
        autoSaved: true,
        note: `Auto-saved before restoring to Version ${versionData.versionNumber || 'historical'}`
      });
    }
    
    // Restore without incrementing version - just swap the content
    // Version will only increment when user actually edits and saves
    await updateDoc(articleRef, {
      htmlContent: versionData.htmlContent,
      lastModified: new Date().toISOString(),
      modifiedBy: userId,
      // Keep the same version number - don't increment
      versionNumber: versionData.versionNumber || currentData.versionNumber || 1,
      // Track that this is restored content
      restoredFromId: versionId,
      restoredFromVersion: versionData.versionNumber,
      restoredAt: serverTimestamp(),
      hasEdits: false, // Reset edit flag
      updatedAt: serverTimestamp()
    });
    
    return {
      success: true,
      restoredVersion: versionData.versionNumber || 'Unknown',
      message: `Restored to Version ${versionData.versionNumber}. Edit and save to create a new version.`
    };
    
  } catch (error) {
    console.error('Error restoring article version:', error);
    throw new Error(`Failed to restore article version: ${error.message}`);
  }
};

/**
 * Get the original (first) version of the article
 */
export const getOriginalArticleContent = async (userId, articleId, source = 'legacy', keywordId = null) => {
  if (!userId || !articleId) {
    throw new Error('User ID and Article ID are required');
  }

  try {
    let articleRef;
    
    if (source === 'keyword' && keywordId) {
      articleRef = doc(db, 'users', userId, 'Key-word', keywordId, 'json', articleId);
    } else if (source === 'interview' && keywordId) {
      articleRef = doc(db, 'users', userId, 'Interviews', keywordId, 'json', articleId);
    } else {
      articleRef = doc(db, 'customers', userId, 'articles', articleId);
    }
    
    const articleDoc = await getDoc(articleRef);
    if (!articleDoc.exists()) {
      return null;
    }
    
    const data = articleDoc.data();
    
    // Return the original JSON content (not the edited HTML)
    if (source === 'keyword' || source === 'interview') {
      return data.jsonContent || data;
    } else {
      return data.article || data.jsonContent || data;
    }
    
  } catch (error) {
    console.error('Error getting original article content:', error);
    throw new Error(`Failed to get original article content: ${error.message}`);
  }
};
