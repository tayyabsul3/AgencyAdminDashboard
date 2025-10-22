/**
 * Video Cache Utility using IndexedDB
 * Stores video blobs locally for faster access and offline support
 */

const DB_NAME = 'QueryFuelVideoCache';
const STORE_NAME = 'videos';
const DB_VERSION = 1;
const MAX_CACHE_SIZE_MB = 500; // Maximum cache size in MB

/**
 * Initialize IndexedDB
 */
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('size', 'size', { unique: false });
      }
    };
  });
};

/**
 * Get cached video blob
 */
export const getCachedVideo = async (url) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(url);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          console.log('✅ Video loaded from cache:', url);
          resolve(URL.createObjectURL(result.blob));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting cached video:', error);
    return null;
  }
};

/**
 * Cache video blob
 */
export const cacheVideo = async (url, blob) => {
  try {
    const db = await initDB();
    
    // Check cache size
    const currentSize = await getCacheSize();
    const blobSizeMB = blob.size / (1024 * 1024);
    
    if (currentSize + blobSizeMB > MAX_CACHE_SIZE_MB) {
      console.warn('Cache size limit reached, clearing old videos...');
      await clearOldestVideos(blobSizeMB);
    }
    
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const videoData = {
      url,
      blob,
      timestamp: Date.now(),
      size: blobSizeMB
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(videoData);
      request.onsuccess = () => {
        console.log('✅ Video cached:', url, `(${blobSizeMB.toFixed(2)}MB)`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error caching video:', error);
  }
};

/**
 * Get total cache size in MB
 */
const getCacheSize = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const totalSize = request.result.reduce((sum, item) => sum + (item.size || 0), 0);
        resolve(totalSize);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting cache size:', error);
    return 0;
  }
};

/**
 * Clear oldest videos to make space
 */
const clearOldestVideos = async (spaceNeededMB) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor();
      let freedSpace = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && freedSpace < spaceNeededMB) {
          const video = cursor.value;
          freedSpace += video.size || 0;
          cursor.delete();
          cursor.continue();
        } else {
          console.log(`🗑️ Freed ${freedSpace.toFixed(2)}MB of cache space`);
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error clearing old videos:', error);
  }
};

/**
 * Preload and cache video
 */
export const preloadVideo = async (url) => {
  try {
    // Check if already cached
    const cached = await getCachedVideo(url);
    if (cached) {
      return cached;
    }
    
    // Fetch and cache
    console.log('📥 Downloading video for cache:', url);
    const response = await fetch(url);
    const blob = await response.blob();
    
    await cacheVideo(url, blob);
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error preloading video:', error);
    return url; // Fallback to original URL
  }
};

/**
 * Clear all cached videos
 */
export const clearVideoCache = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => {
        console.log('🗑️ Video cache cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const videos = request.result;
        const totalSize = videos.reduce((sum, item) => sum + (item.size || 0), 0);
        resolve({
          count: videos.length,
          totalSizeMB: totalSize.toFixed(2),
          maxSizeMB: MAX_CACHE_SIZE_MB,
          percentUsed: ((totalSize / MAX_CACHE_SIZE_MB) * 100).toFixed(1)
        });
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return null;
  }
};
