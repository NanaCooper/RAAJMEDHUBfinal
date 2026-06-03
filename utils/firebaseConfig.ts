import { getApp, getApps, initializeApp } from '@react-native-firebase/app';
import { 
  getFirestore, 
  collection as firestoreCollection, 
  doc as firestoreDoc, 
  getDoc as firestoreGetDoc, 
  getDocs as firestoreGetDocs, 
  setDoc as firestoreSetDoc, 
  updateDoc as firestoreUpdateDoc, 
  addDoc as firestoreAddDoc, 
  deleteDoc as firestoreDeleteDoc, 
  onSnapshot as firestoreOnSnapshot, 
  query as firestoreQuery, 
  where as firestoreWhere, 
  orderBy as firestoreOrderBy, 
  serverTimestamp as firestoreServerTimestamp, 
  increment as firestoreIncrement, 
  arrayUnion as firestoreArrayUnion, 
  deleteField as firestoreDeleteField 
} from '@react-native-firebase/firestore';
import { 
  getAuth as firebaseGetAuth, 
  onAuthStateChanged as firebaseOnAuthStateChanged, 
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword, 
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  signInWithCredential as firebaseSignInWithCredential, 
  GoogleAuthProvider as firebaseGoogleAuthProvider 
} from '@react-native-firebase/auth';
import { getFunctions } from '@react-native-firebase/functions';
import { getStorage } from '@react-native-firebase/storage';
import { 
  FIREBASE_API_KEY, 
  FIREBASE_APP_ID, 
  FIREBASE_PROJECT_ID, 
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID
} from '../constants/Config';
import { Platform } from 'react-native';

// In React Native, the app is usually auto-initialized from google-services.json / GoogleService-Info.plist.
// IMPORTANT: Never throw during module import (release builds may show a black screen).
let app: any = null;
export let enabled = true;
export let initError: string | null = null;

function hasEnvFirebaseConfig() {
  return Boolean(FIREBASE_API_KEY && FIREBASE_APP_ID && FIREBASE_PROJECT_ID);
}

// Skip Firebase initialization entirely during server-side rendering (eas update export).
const isServerEnv = typeof window === 'undefined' || Platform.OS === 'web';

if (!isServerEnv) {
  try {
    // Prefer the default app created natively.
    try {
      app = getApp();
    } catch (_e) {
      // If getApp() fails, check if any apps are registered.
      const apps = getApps();
      if (apps.length > 0) {
        app = apps[0];
      } else if (hasEnvFirebaseConfig()) {
        // Fall back to JS initialization (for environments that don't bundle native config).
        app = initializeApp({
          apiKey: FIREBASE_API_KEY as string,
          appId: FIREBASE_APP_ID as string,
          projectId: FIREBASE_PROJECT_ID as string,
          storageBucket: FIREBASE_STORAGE_BUCKET as string,
          databaseURL: `https://${FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
          messagingSenderId: FIREBASE_MESSAGING_SENDER_ID as string,
        });
      } else {
        enabled = false;
        initError =
          'Firebase is not initialized. Ensure android/google-services.json and iOS/GoogleService-Info.plist are included in the build, or configure EXPO_PUBLIC_FIREBASE_* environment variables for EAS builds.';
      }
    }
  } catch (e: any) {
    enabled = false;
    initError = `Firebase init failed: ${e?.message || String(e)}`;
  }
} else {
  // Server / EAS export environment — Firebase is not available.
  enabled = false;
}

export const appInstance = app;
export const db = enabled && app ? getFirestore(app) : (null as any);
export const auth = enabled && app ? firebaseGetAuth(app) : (null as any);
export const functions = enabled && app ? getFunctions(app) : (null as any);
export const storage = enabled && app ? getStorage(app) : (null as any);

// --- Auth Exports ---
export const onAuthStateChanged = (authInstance: any, observer: any) => firebaseOnAuthStateChanged(authInstance, observer);
export const signInWithEmailAndPassword = (authInstance: any, email: string, pass: string) => firebaseSignInWithEmailAndPassword(authInstance, email, pass);
export const createUserWithEmailAndPassword = (authInstance: any, email: string, pass: string) => firebaseCreateUserWithEmailAndPassword(authInstance, email, pass);
export const signOut = (authInstance: any) => firebaseSignOut(authInstance);
export const getAuth = () => auth;
export const GoogleAuthProvider = firebaseGoogleAuthProvider;
export const signInWithCredential = (authInstance: any, credential: any) => firebaseSignInWithCredential(authInstance, credential);

export async function getAuthInstance() {
  return auth;
}

// --- Firestore Helper Wrappers (Modular First to Silence Warnings) ---
export const collection = (dbOrDoc: any, ...pathSegments: string[]) => {
  return firestoreCollection(dbOrDoc as any, pathSegments.join('/'));
};

export const doc = (collectionOrDb: any, ...pathSegments: string[]) => {
  return firestoreDoc(collectionOrDb as any, pathSegments.join('/'));
};

export const getDoc = (docRef: any) => {
  return firestoreGetDoc(docRef);
};

export const getDocs = (queryOrCol: any) => {
  return firestoreGetDocs(queryOrCol);
};

export const setDoc = (docRef: any, data: any, options?: any) => {
  return firestoreSetDoc(docRef, data, options);
};

export const updateDoc = (docRef: any, data: any) => {
  return firestoreUpdateDoc(docRef, data);
};

export const addDoc = (colRef: any, data: any) => {
  return firestoreAddDoc(colRef, data);
};

export const deleteDoc = (docRef: any) => {
  return firestoreDeleteDoc(docRef);
};

export const onSnapshot = (ref: any, callback: any, errorCallback?: any) => {
  return firestoreOnSnapshot(ref, callback, errorCallback || ((err: any) => console.log(err)));
};

export const serverTimestamp = firestoreServerTimestamp;
export const increment = firestoreIncrement;
export const arrayUnion = firestoreArrayUnion;
export const deleteField = firestoreDeleteField;

export const query = (queryOrCol: any, ...queryConstraints: any[]) => {
  // Standalone query function doesn't exist in same way as Web, 
  // but RN Firebase modular exports 'query'
  return firestoreQuery(queryOrCol, ...queryConstraints);
};

export const where = (field: string, op: string, value: any) => {
  return firestoreWhere(field, (op === '==' ? '==' : op) as any, value);
};

export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc') => {
  return firestoreOrderBy(field, dir);
};
