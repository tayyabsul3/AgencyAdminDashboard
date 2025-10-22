// Database migration utilities for subscription management
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  writeBatch,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { tierConfigurations } from './subscriptionSchema';

/**
 * Migration utilities for updating existing subscription documents
 */
export class SubscriptionMigrations {

  /**
   * Migration 1: Add cancellation tracking fields
   * Adds cancelledAt, cancellationReason, cancellationFeedback, cancelAtPeriodEnd fields
   */
  static async migration001_addCancellationTracking() {
    console.log('Starting Migration 001: Add cancellation tracking fields');
    
    try {
      const subscriptionsRef = collection(db, 'subscriptions');
      const snapshot = await getDocs(subscriptionsRef);
      const batch = writeBatch(db);
      let updateCount = 0;

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const docRef = doc(db, 'subscriptions', docSnapshot.id);
        
        // Only update if cancellation fields don't exist
        if (!data.hasOwnProperty('cancelAtPeriodEnd')) {
          batch.update(docRef, {
            cancelAtPeriodEnd: false,
            cancellationReason: null,
            cancellationFeedback: null,
            // Only set cancelledAt if status is cancelled and field doesn't exist
            ...(data.status === 'cancelled' && !data.cancelledAt ? {
              cancelledAt: data.updatedAt || serverTimestamp()
            } : {})
          });
          updateCount++;
        }
      });

      if (updateCount > 0) {
        await batch.commit();
        console.log(`Migration 001 completed: Updated ${updateCount} documents`);
      } else {
        console.log('Migration 001: No documents needed updating');
      }

      return {
        success: true,
        message: `Migration 001 completed successfully. Updated ${updateCount} documents.`,
        updatedCount: updateCount
      };
    } catch (error) {
      console.error('Migration 001 failed:', error);
      return {
        success: false,
        error: { message: error.message, migration: '001' }
      };
    }
  }

  /**
   * Migration 2: Add plan change history
   * Adds planChangeHistory array and pendingPlanChange object
   */
  static async migration002_addPlanChangeHistory() {
    console.log('Starting Migration 002: Add plan change history');
    
    try {
      const subscriptionsRef = collection(db, 'subscriptions');
      const snapshot = await getDocs(subscriptionsRef);
      const batch = writeBatch(db);
      let updateCount = 0;

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const docRef = doc(db, 'subscriptions', docSnapshot.id);
        
        // Only update if plan change fields don't exist
        if (!data.hasOwnProperty('planChangeHistory')) {
          batch.update(docRef, {
            planChangeHistory: [],
            pendingPlanChange: null
          });
          updateCount++;
        }
      });

      if (updateCount > 0) {
        await batch.commit();
        console.log(`Migration 002 completed: Updated ${updateCount} documents`);
      } else {
        console.log('Migration 002: No documents needed updating');
      }

      return {
        success: true,
        message: `Migration 002 completed successfully. Updated ${updateCount} documents.`,
        updatedCount: updateCount
      };
    } catch (error) {
      console.error('Migration 002 failed:', error);
      return {
        success: false,
        error: { message: error.message, migration: '002' }
      };
    }
  }

  /**
   * Migration 3: Add payment tracking fields
   * Adds lastPaymentDate, nextPaymentDate, paymentFailureCount, graceExpiresAt
   */
  static async migration003_addPaymentTracking() {
    console.log('Starting Migration 003: Add payment tracking fields');
    
    try {
      const subscriptionsRef = collection(db, 'subscriptions');
      const snapshot = await getDocs(subscriptionsRef);
      const batch = writeBatch(db);
      let updateCount = 0;

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const docRef = doc(db, 'subscriptions', docSnapshot.id);
        
        // Only update if payment tracking fields don't exist
        if (!data.hasOwnProperty('paymentFailureCount')) {
          batch.update(docRef, {
            paymentFailureCount: 0,
            lastPaymentDate: null,
            nextPaymentDate: data.currentPeriodEnd || null,
            graceExpiresAt: null
          });
          updateCount++;
        }
      });

      if (updateCount > 0) {
        await batch.commit();
        console.log(`Migration 003 completed: Updated ${updateCount} documents`);
      } else {
        console.log('Migration 003: No documents needed updating');
      }

      return {
        success: true,
        message: `Migration 003 completed successfully. Updated ${updateCount} documents.`,
        updatedCount: updateCount
      };
    } catch (error) {
      console.error('Migration 003 failed:', error);
      return {
        success: false,
        error: { message: error.message, migration: '003' }
      };
    }
  }

  /**
   * Migration 4: Update access levels based on tier
   * Updates accessLevel object with proper features based on current tier
   */
  static async migration004_updateAccessLevels() {
    console.log('Starting Migration 004: Update access levels');
    
    try {
      const subscriptionsRef = collection(db, 'subscriptions');
      const snapshot = await getDocs(subscriptionsRef);
      const batch = writeBatch(db);
      let updateCount = 0;

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const docRef = doc(db, 'subscriptions', docSnapshot.id);
        
        // Update access level if tier exists and access level is missing or incomplete
        if (data.tier && (!data.accessLevel || !data.accessLevel.features)) {
          const tierConfig = tierConfigurations[data.tier];
          
          if (tierConfig) {
            batch.update(docRef, {
              accessLevel: {
                level: data.tier,
                features: tierConfig.features
              },
              // Also update credits if not set properly
              ...((!data.credits || data.credits === 0) ? {
                credits: tierConfig.credits
              } : {})
            });
            updateCount++;
          }
        }
      });

      if (updateCount > 0) {
        await batch.commit();
        console.log(`Migration 004 completed: Updated ${updateCount} documents`);
      } else {
        console.log('Migration 004: No documents needed updating');
      }

      return {
        success: true,
        message: `Migration 004 completed successfully. Updated ${updateCount} documents.`,
        updatedCount: updateCount
      };
    } catch (error) {
      console.error('Migration 004 failed:', error);
      return {
        success: false,
        error: { message: error.message, migration: '004' }
      };
    }
  }

  /**
   * Migration 5: Add metadata and source tracking
   * Adds source, metadata, and lastSyncedAt fields
   */
  static async migration005_addMetadataTracking() {
    console.log('Starting Migration 005: Add metadata tracking');
    
    try {
      const subscriptionsRef = collection(db, 'subscriptions');
      const snapshot = await getDocs(subscriptionsRef);
      const batch = writeBatch(db);
      let updateCount = 0;

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const docRef = doc(db, 'subscriptions', docSnapshot.id);
        
        // Only update if metadata fields don't exist
        if (!data.hasOwnProperty('source')) {
          batch.update(docRef, {
            source: 'legacy', // Mark existing subscriptions as legacy
            metadata: {},
            lastSyncedAt: data.updatedAt || serverTimestamp()
          });
          updateCount++;
        }
      });

      if (updateCount > 0) {
        await batch.commit();
        console.log(`Migration 005 completed: Updated ${updateCount} documents`);
      } else {
        console.log('Migration 005: No documents needed updating');
      }

      return {
        success: true,
        message: `Migration 005 completed successfully. Updated ${updateCount} documents.`,
        updatedCount: updateCount
      };
    } catch (error) {
      console.error('Migration 005 failed:', error);
      return {
        success: false,
        error: { message: error.message, migration: '005' }
      };
    }
  }

  /**
   * Run all migrations in sequence
   * @param {Array} migrations - Array of migration names to run (optional)
   * @returns {Promise<Object>} Migration results
   */
  static async runAllMigrations(migrations = null) {
    console.log('Starting all subscription migrations...');
    
    const allMigrations = [
      { name: '001', fn: this.migration001_addCancellationTracking },
      { name: '002', fn: this.migration002_addPlanChangeHistory },
      { name: '003', fn: this.migration003_addPaymentTracking },
      { name: '004', fn: this.migration004_updateAccessLevels },
      { name: '005', fn: this.migration005_addMetadataTracking }
    ];

    const migrationsToRun = migrations ? 
      allMigrations.filter(m => migrations.includes(m.name)) : 
      allMigrations;

    const results = [];
    let totalUpdated = 0;
    let failedMigrations = [];

    for (const migration of migrationsToRun) {
      try {
        console.log(`Running migration ${migration.name}...`);
        const result = await migration.fn.call(this);
        
        results.push({
          migration: migration.name,
          ...result
        });

        if (result.success) {
          totalUpdated += result.updatedCount || 0;
        } else {
          failedMigrations.push(migration.name);
        }
      } catch (error) {
        console.error(`Migration ${migration.name} failed:`, error);
        results.push({
          migration: migration.name,
          success: false,
          error: { message: error.message }
        });
        failedMigrations.push(migration.name);
      }
    }

    const summary = {
      success: failedMigrations.length === 0,
      totalMigrations: migrationsToRun.length,
      successfulMigrations: migrationsToRun.length - failedMigrations.length,
      failedMigrations,
      totalDocumentsUpdated: totalUpdated,
      results
    };

    console.log('Migration summary:', summary);
    return summary;
  }

  /**
   * Validate subscription data integrity
   * Checks for missing required fields and data consistency
   * @returns {Promise<Object>} Validation results
   */
  static async validateDataIntegrity() {
    console.log('Starting data integrity validation...');
    
    try {
      const subscriptionsRef = collection(db, 'subscriptions');
      const snapshot = await getDocs(subscriptionsRef);
      
      const issues = [];
      const requiredFields = [
        'stripeSubscriptionId', 'stripeCustomerId', 'status', 'tier',
        'createdAt', 'updatedAt'
      ];

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const docId = docSnapshot.id;
        
        // Check for missing required fields
        requiredFields.forEach(field => {
          if (!data.hasOwnProperty(field) || data[field] === null || data[field] === undefined) {
            issues.push({
              docId,
              type: 'missing_field',
              field,
              severity: 'error'
            });
          }
        });

        // Check for invalid status values
        const validStatuses = ['active', 'trial', 'cancelled', 'past_due', 'unpaid', 'suspended', 'expired', 'incomplete', 'incomplete_expired'];
        if (data.status && !validStatuses.includes(data.status)) {
          issues.push({
            docId,
            type: 'invalid_status',
            value: data.status,
            severity: 'error'
          });
        }

        // Check for invalid tier values
        const validTiers = ['starter', 'pro', 'business', 'enterprise', 'client'];
        if (data.tier && !validTiers.includes(data.tier)) {
          issues.push({
            docId,
            type: 'invalid_tier',
            value: data.tier,
            severity: 'error'
          });
        }

        // Check credits consistency
        if (data.creditsUsed > data.credits && data.credits > 0) {
          issues.push({
            docId,
            type: 'credits_exceeded',
            creditsUsed: data.creditsUsed,
            totalCredits: data.credits,
            severity: 'warning'
          });
        }

        // Check for missing access level
        if (!data.accessLevel || !data.accessLevel.features) {
          issues.push({
            docId,
            type: 'missing_access_level',
            severity: 'warning'
          });
        }
      });

      const summary = {
        success: true,
        totalDocuments: snapshot.size,
        totalIssues: issues.length,
        errorCount: issues.filter(i => i.severity === 'error').length,
        warningCount: issues.filter(i => i.severity === 'warning').length,
        issues
      };

      console.log('Data integrity validation completed:', summary);
      return summary;
    } catch (error) {
      console.error('Data integrity validation failed:', error);
      return {
        success: false,
        error: { message: error.message }
      };
    }
  }

  /**
   * Backup subscriptions data
   * Creates a backup of all subscription documents
   * @returns {Promise<Object>} Backup data
   */
  static async backupSubscriptions() {
    console.log('Creating subscriptions backup...');
    
    try {
      const subscriptionsRef = collection(db, 'subscriptions');
      const snapshot = await getDocs(subscriptionsRef);
      
      const backup = {
        timestamp: new Date().toISOString(),
        totalDocuments: snapshot.size,
        documents: []
      };

      snapshot.forEach((docSnapshot) => {
        backup.documents.push({
          id: docSnapshot.id,
          data: docSnapshot.data()
        });
      });

      console.log(`Backup created with ${backup.totalDocuments} documents`);
      return {
        success: true,
        backup
      };
    } catch (error) {
      console.error('Backup creation failed:', error);
      return {
        success: false,
        error: { message: error.message }
      };
    }
  }
}

export default SubscriptionMigrations;