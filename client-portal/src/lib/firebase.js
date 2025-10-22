import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';

// Read config strictly from env vars to avoid falling back to the old project
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_MEASUREMENT_ID,
};

// Validate required fields early for clearer errors
const requiredKeys = ['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId'];
for (const key of requiredKeys) {
  if (!firebaseConfig[key]) {
    // Surface a descriptive error to aid migration/setup issues
    console.error(`Missing Firebase config: ${key}. Check your .env.local values for NEXT_PUBLIC_FIREBASE_*`);
  }
}

// Initialize Firebase (guard against re-initialization in Fast Refresh)
let app;
let auth;
let db;

try {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app, 'queryfuel'); // Use the queryfuel database
  
  // Connect to Firestore emulator in development if available
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIRESTORE_EMULATOR === 'true') {
    try {
      connectFirestoreEmulator(db, 'localhost', 8080);
    } catch (error) {
      // Emulator already connected or not available
      console.log('Firestore emulator connection skipped:', error.message);
    }
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
}

export { auth, db };

// Authentication functions
export const signUp = async (email, password, name) => {
  if (!auth) {
    return { user: null, error: 'Firebase not initialized' };
  }

  try {
    // Set session-only persistence before signing up
    await setPersistence(auth, browserSessionPersistence);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Create free credits subscription for new user
    try {
      const subscriptionRef = doc(db, 'subscriptions', userCredential.user.uid);
      await setDoc(subscriptionRef, {
        userId: userCredential.user.uid,
        tier: 'Free',
        status: 'active',
        credits: 2, // 2 free credits for new users
        creditsUsed: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('Free credits subscription created for new user:', userCredential.user.uid);
    } catch (subscriptionError) {
      // Don't fail the signup if subscription creation fails
    }

    // Save user email and UID in email collection
    try {
      const userRef = doc(db, 'email', userCredential.user.uid);
      await setDoc(userRef, {
        email: userCredential.user.email,
        uid: userCredential.user.uid,
        name: name,
        createdAt: serverTimestamp()
      });
      console.log('User email and UID saved in Email collection for new user:', userCredential.user.uid);
    } catch (userError) {
      console.error('Failed to save user email and UID:', userError);
      // Don't fail the signup if saving fails
    }

    return { user: userCredential.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
};

export const signIn = async (email, password) => {
  if (!auth) {
    return { user: null, error: 'Firebase not initialized' };
  }

  try {
    // Set session-only persistence before signing in
    await setPersistence(auth, browserSessionPersistence);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
};

export const logOut = async () => {
  if (!auth) {
    return { error: 'Firebase not initialized' };
  }
  
  try {
    await signOut(auth);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
};

// Auth state observer
export const onAuthStateChange = (callback) => {
  if (!auth) {
    console.warn('Firebase auth not initialized');
    return () => {}; // Return empty unsubscribe function
  }
  return onAuthStateChanged(auth, callback);
};

// Export Firebase app instance
export { app };
export default app;