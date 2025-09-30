import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  Auth,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  Firestore,
} from "firebase/firestore";

// ✅ Config (env first, fallback defaults for dev)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ,
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN 
    ,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ,
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ,
};

// ✅ Ensure single app instance
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// ✅ Services
const auth: Auth = getAuth(app);
// Note: Firestore supports multiple DBs, here we specify "queryfuel"
const db: Firestore = getFirestore(app, "queryfuel");

// ✅ Emulator (optional)
if (
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_USE_FIRESTORE_EMULATOR === "true"
) {
  try {
    connectFirestoreEmulator(db, "localhost", 8080);
    console.log("[Firestore] Connected to emulator");
  } catch (err) {
    console.log("[Firestore] Emulator skipped:", (err as Error).message);
  }
}

// ✅ Debug Info
if (process.env.NODE_ENV !== "production") {
  console.log("[Firebase] Initialized", {
    projectId: firebaseConfig.projectId,
    databaseId: "queryfuel",
  });
}

// ---------------------------
// 🔐 Auth helper functions
// ---------------------------
export const signUp = async (email: string, password: string) => {
  if (!auth) return { user: null, error: "Firebase not initialized" };

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    return { user: userCredential.user, error: null };
  } catch (err: any) {
    return { user: null, error: err.message };
  }
};

export const signIn = async (email: string, password: string) => {
  if (!auth) return { user: null, error: "Firebase not initialized" };

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    return { user: userCredential.user, error: null };
  } catch (err: any) {
    return { user: null, error: err.message };
  }
};

export const logOut = async () => {
  if (!auth) return { error: "Firebase not initialized" };

  try {
    await signOut(auth);
    return { error: null };
  } catch (err: any) {
    return { error: err.message };
  }
};

export const onAuthStateChange = (callback: (user: any) => void) => {
  if (!auth) {
    console.warn("Firebase auth not initialized");
    return () => {}; // noop unsubscribe
  }
  return onAuthStateChanged(auth, callback);
};

// ---------------------------
// 📦 Exports
// ---------------------------
export { app, auth, db };
export default app;
