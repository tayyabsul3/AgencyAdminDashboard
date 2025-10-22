/**
 * Batch operations utility for Firestore performance optimization
 * Handles batched writes, reads, and transaction management
 */

import { 
  writeBatch, 
  doc, 
  collection, 
  getDoc, 
  getDocs, 
  query, 
  where,
  runTransaction 
} from 'firebase/firestore';
import { db } from '../lib/config';

/**
 * Firestore batch operations manager
 */
export class FirestoreBatchManager {
  constructor() {
    this.maxBatchSize = 500; // Firestore limit
    this.currentBatch = null;
    this.batchOperations = [];
  }

  /**
   * Create a new batch
   */
  createBatch() {
    this.currentBatch = writeBatch(db);
    this.batchOperations = [];
    return this.currentBatch;
  }

  /**
   * Add a set operation to the current batch
   */
  batchSet(collectionName, docId, data, options = {}) {
    if (!this.currentBatch) {
      this.createBatch();
    }

    const docRef = doc(db, collectionName, docId);
    
    if (options.merge) {
      this.currentBatch.set(docRef, data, { merge: true });
    } else {
      this.currentBatch.set(docRef, data);
    }

    this.batchOperations.push({
      type: 'set',
      collection: collectionName,
      docId,
      data
    });

    return this;
  }

  /**
   * Add an update operation to the current batch
   */
  batchUpdate(collectionName, docId, data) {
    if (!this.currentBatch) {
      this.createBatch();
    }

    const docRef = doc(db, collectionName, docId);
    this.currentBatch.update(docRef, data);

    this.batchOperations.push({
      type: 'update',
      collection: collectionName,
      docId,
      data
    });

    return this;
  }

  /**
   * Add a delete operation to the current batch
   */
  batchDelete(collectionName, docId) {
    if (!this.currentBatch) {
      this.createBatch();
    }

    const docRef = doc(db, collectionName, docId);
    this.currentBatch.delete(docRef);

    this.batchOperations.push({
      type: 'delete',
      collection: collectionName,
      docId
    });

    return this;
  }

  /**
   * Commit the current batch
   */
  async commit() {
    if (!this.currentBatch || this.batchOperations.length === 0) {
      return { success: true, operations: 0 };
    }

    try {
      await this.currentBatch.commit();
      const operationCount = this.batchOperations.length;
      
      // Reset batch
      this.currentBatch = null;
      this.batchOperations = [];

      return { 
        success: true, 
        operations: operationCount 
      };
    } catch (error) {
      console.error('Batch commit failed:', error);
      throw new Error(`Batch operation failed: ${error.message}`);
    }
  }

  /**
   * Get current batch size
   */
  getBatchSize() {
    return this.batchOperations.length;
  }

  /**
   * Check if batch is at capacity
   */
  isBatchFull() {
    return this.batchOperations.length >= this.maxBatchSize;
  }

  /**
   * Auto-commit if batch is full
   */
  async autoCommitIfFull() {
    if (this.isBatchFull()) {
      await this.commit();
    }
  }
}

/**
 * Batch write multiple documents with automatic chunking
 */
export async function batchWriteDocuments(operations) {
  const batchManager = new FirestoreBatchManager();
  const results = [];
  
  try {
    for (const operation of operations) {
      const { type, collection: collectionName, docId, data, options } = operation;
      
      switch (type) {
        case 'set':
          batchManager.batchSet(collectionName, docId, data, options);
          break;
        case 'update':
          batchManager.batchUpdate(collectionName, docId, data);
          break;
        case 'delete':
          batchManager.batchDelete(collectionName, docId);
          break;
        default:
          throw new Error(`Unknown operation type: ${type}`);
      }

      // Auto-commit if batch is full
      if (batchManager.isBatchFull()) {
        const result = await batchManager.commit();
        results.push(result);
      }
    }

    // Commit remaining operations
    if (batchManager.getBatchSize() > 0) {
      const result = await batchManager.commit();
      results.push(result);
    }

    return {
      success: true,
      batches: results.length,
      totalOperations: results.reduce((sum, r) => sum + r.operations, 0)
    };
  } catch (error) {
    console.error('Batch write failed:', error);
    throw error;
  }
}

/**
 * Batch read multiple documents
 */
export async function batchReadDocuments(documentRefs) {
  const chunks = chunkArray(documentRefs, 10); // Firestore getAll limit
  const results = [];

  try {
    for (const chunk of chunks) {
      const promises = chunk.map(async (ref) => {
        const { collection: collectionName, docId } = ref;
        const docRef = doc(db, collectionName, docId);
        const docSnap = await getDoc(docRef);
        
        return {
          id: docId,
          exists: docSnap.exists(),
          data: docSnap.exists() ? docSnap.data() : null
        };
      });

      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
    }

    return results;
  } catch (error) {
    console.error('Batch read failed:', error);
    throw error;
  }
}

/**
 * Batch update user articles with optimistic updates
 */
export async function batchUpdateUserArticles(userId, articleUpdates) {
  const operations = articleUpdates.map(update => ({
    type: 'update',
    collection: 'articles',
    docId: update.id,
    data: {
      ...update.data,
      updatedAt: new Date(),
      updatedBy: userId
    }
  }));

  return await batchWriteDocuments(operations);
}

/**
 * Batch save interview questions with metadata
 */
export async function batchSaveInterviewQuestions(interviewId, questions, metadata = {}) {
  const operations = [];

  // Update interview document
  operations.push({
    type: 'update',
    collection: 'interviews',
    docId: interviewId,
    data: {
      questionCount: questions.length,
      lastUpdated: new Date(),
      ...metadata
    }
  });

  // Batch save questions
  questions.forEach((question, index) => {
    operations.push({
      type: 'set',
      collection: 'interview_questions',
      docId: `${interviewId}_${question.id || index}`,
      data: {
        interviewId,
        questionIndex: index,
        ...question,
        createdAt: new Date()
      },
      options: { merge: true }
    });
  });

  return await batchWriteDocuments(operations);
}

/**
 * Transaction-based batch operations for complex updates
 */
export async function transactionBatchUpdate(updateFunction) {
  try {
    return await runTransaction(db, async (transaction) => {
      return await updateFunction(transaction);
    });
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}

/**
 * Batch delete with cascade operations
 */
export async function batchDeleteWithCascade(collectionName, docId, cascadeRules = []) {
  const operations = [];

  // Add main document deletion
  operations.push({
    type: 'delete',
    collection: collectionName,
    docId
  });

  // Add cascade deletions
  for (const rule of cascadeRules) {
    const { collection: cascadeCollection, field, value } = rule;
    
    // Query for related documents
    const q = query(
      collection(db, cascadeCollection),
      where(field, '==', value || docId)
    );
    
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      operations.push({
        type: 'delete',
        collection: cascadeCollection,
        docId: doc.id
      });
    });
  }

  return await batchWriteDocuments(operations);
}

/**
 * Utility function to chunk arrays
 */
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Performance monitoring for batch operations
 */
export class BatchPerformanceMonitor {
  constructor() {
    this.metrics = {
      totalBatches: 0,
      totalOperations: 0,
      totalTime: 0,
      errors: 0
    };
  }

  async monitorBatch(batchFunction, ...args) {
    const startTime = Date.now();
    
    try {
      const result = await batchFunction(...args);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.metrics.totalBatches++;
      this.metrics.totalOperations += result.totalOperations || 1;
      this.metrics.totalTime += duration;
      
      return {
        ...result,
        duration,
        performance: {
          operationsPerSecond: (result.totalOperations || 1) / (duration / 1000),
          averageTimePerOperation: duration / (result.totalOperations || 1)
        }
      };
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      averageBatchTime: this.metrics.totalTime / this.metrics.totalBatches,
      averageOperationsPerBatch: this.metrics.totalOperations / this.metrics.totalBatches,
      errorRate: this.metrics.errors / this.metrics.totalBatches
    };
  }

  reset() {
    this.metrics = {
      totalBatches: 0,
      totalOperations: 0,
      totalTime: 0,
      errors: 0
    };
  }
}

// Export singleton instance
export const batchMonitor = new BatchPerformanceMonitor();

const batchOperations = {
  FirestoreBatchManager,
  batchWriteDocuments,
  batchReadDocuments,
  batchUpdateUserArticles,
  batchSaveInterviewQuestions,
  transactionBatchUpdate,
  batchDeleteWithCascade,
  batchMonitor
};

export default batchOperations;