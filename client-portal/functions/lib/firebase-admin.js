const admin = require('firebase-admin');

// Singleton pattern for Firebase Admin initialization
let db = null;

/**
 * Initialize Firebase Admin and Firestore with proper singleton pattern
 * This ensures Firebase is only initialized once across all modules
 */
const initializeFirebaseAdmin = () => {
  // Return existing instance if already initialized
  if (db) {
    return db;
  }

  try {
    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      const serviceAccount = require('../api/new-service-account-key.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'lead-generation-6cf0f',
        storageBucket: 'lead-generation-6cf0f.firebasestorage.app'
      });
      console.log('✅ Firebase Admin initialized successfully');
    } else {
      console.log('✅ Firebase Admin already initialized, reusing existing instance');
    }

    // Initialize Firestore - use the exact same pattern as Stripe (which works)
    db = admin.firestore();
    
    // Apply settings only once, with error handling for multiple calls
    if (!db._settingsApplied) {
      try {
        db.settings({
          ignoreUndefinedProperties: true,
          databaseId: 'queryfuel'
        });
        db._settingsApplied = true;
        console.log('✅ Firestore settings applied: databaseId = queryfuel');
      } catch (settingsError) {
        // Settings already applied by another instance
        console.log('✅ Firestore settings already configured');
      }
    } else {
      console.log('✅ Firestore settings already applied, skipping');
    }

    return db;
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
    throw error;
  }
};

/**
 * Get Firestore database instance
 * @returns {FirebaseFirestore.Firestore} Firestore database instance
 */
const getFirestore = () => {
  if (!db) {
    return initializeFirebaseAdmin();
  }
  return db;
};

/**
 * Get Firebase Auth instance
 * @returns {admin.auth.Auth} Firebase Auth instance
 */
const getAuth = () => {
  // Ensure admin is initialized
  if (!admin.apps.length) {
    initializeFirebaseAdmin();
  }
  return admin.auth();
};

module.exports = {
  initializeFirebaseAdmin,
  getFirestore,
  getAuth,
  admin
};