/* eslint-disable @typescript-eslint/no-var-requires */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Toggle to disable real Firebase and use a local shim with mock data.
const DISABLE_FIREBASE = false;

// Detect Expo Go (standard client) — @react-native-firebase native modules are
// NOT available in Expo Go and will crash if required.  We force the Web SDK
// fallback whenever we are running inside the Expo Go sandbox.
const IS_EXPO_GO =
  Constants.appOwnership === 'expo' ||
  (Constants.executionEnvironment as string) === 'storeClient';

// Toggle to use Firebase Emulators
const USE_EMULATOR = false;

export let appInstance: any = null;
export let db: any = null; // Native Firestore or Web Firestore instance
export let auth: any = null; // Native Auth or Web Auth instance
export let functions: any = null; // Native Functions or Web Functions instance
export let storage: any = null;
export let enabled: boolean = false;

// Internal delegates
// Internal delegates (Auth)
export let onAuthStateChanged: any;
export let signInWithEmailAndPassword: any;
export let createUserWithEmailAndPassword: any;
export let signOut: any;
export let getAuth: any;
export let GoogleAuthProvider: any;
export let signInWithCredential: any;

// Internal delegates (Firestore)
let _collection: any;
let _doc: any;
let _getDoc: any;
let _getDocs: any;
let _setDoc: any;
let _updateDoc: any;
let _addDoc: any;
let _deleteDoc: any;
let _onSnapshot: any;
let _serverTimestamp: any;
let _query: any;
let _where: any;
let _orderBy: any;
let _arrayUnion: any;
let _deleteField: any;
let _increment: any;

// --- Exported Helper Wrappers ---
// These adapt the differences between Web SDK (v9 modular) and Native SDK (v8 OO style)

export const collection = (...args: any[]) => {
  if (_collection) return _collection(...args);
  throw new Error('Firestore helper `collection` not initialized');
};
export const doc = (...args: any[]) => {
  if (_doc) return _doc(...args);
  throw new Error('Firestore helper `doc` not initialized');
};
export const getDoc = (...args: any[]) => {
  if (_getDoc) return _getDoc(...args);
  throw new Error('Firestore helper `getDoc` not initialized');
};
export const getDocs = (...args: any[]) => {
  if (_getDocs) return _getDocs(...args);
  throw new Error('Firestore helper `getDocs` not initialized');
};
export const setDoc = (...args: any[]) => {
  if (_setDoc) return _setDoc(...args);
  throw new Error('Firestore helper `setDoc` not initialized');
};
export const updateDoc = (...args: any[]) => {
  if (_updateDoc) return _updateDoc(...args);
  throw new Error('Firestore helper `updateDoc` not initialized');
};
export const addDoc = (...args: any[]) => {
  if (_addDoc) return _addDoc(...args);
  throw new Error('Firestore helper `addDoc` not initialized');
};
export const deleteDoc = (...args: any[]) => {
  if (_deleteDoc) return _deleteDoc(...args);
  throw new Error('Firestore helper `deleteDoc` not initialized');
};
export const onSnapshot = (...args: any[]) => {
  if (_onSnapshot) return _onSnapshot(...args);
  throw new Error('Firestore helper `onSnapshot` not initialized');
};
export const serverTimestamp = (...args: any[]) => {
  if (_serverTimestamp) return _serverTimestamp(...args);
  throw new Error('Firestore helper `serverTimestamp` not initialized');
};
export const query = (...args: any[]) => {
  if (_query) return _query(...args);
  throw new Error('Firestore helper `query` not initialized');
};
export const where = (...args: any[]) => {
  if (_where) return _where(...args);
  throw new Error('Firestore helper `where` not initialized');
};
export const orderBy = (...args: any[]) => {
  if (_orderBy) return _orderBy(...args);
  throw new Error('Firestore helper `orderBy` not initialized');
};
export const arrayUnion = (...args: any[]) => {
  if (_arrayUnion) return _arrayUnion(...args);
  throw new Error('Firestore helper `arrayUnion` not initialized');
};
export const deleteField = (...args: any[]) => {
  if (_deleteField) return _deleteField(...args);
  throw new Error('Firestore helper `deleteField` not initialized');
};
export const increment = (...args: any[]) => {
  if (_increment) return _increment(...args);
  throw new Error('Firestore helper `increment` not initialized');
};

let authReadyResolve: ((a: any) => void) | null = null;
const authReady = new Promise<any>((resolve) => {
  authReadyResolve = resolve;
});

export async function getAuthInstance() {
  if (auth) return auth;
  return authReady;
}

// Initialization Logic
(async () => {
  if (DISABLE_FIREBASE) {
    // Shim implementation
    const shim = require('./firebaseShim');
    appInstance = null;
    db = shim.db;
    auth = shim.auth;

    _collection = shim.collection;
    _doc = shim.doc;
    _getDoc = shim.getDoc;
    _getDocs = shim.getDocs;
    _setDoc = shim.setDoc;
    _updateDoc = shim.updateDoc;
    _addDoc = shim.addDoc;
    _deleteDoc = shim.deleteDoc;
    _onSnapshot = shim.onSnapshot;
    _serverTimestamp = shim.serverTimestamp;
    _query = shim.query;
    _where = shim.where;
    _orderBy = shim.orderBy;
    _arrayUnion = shim.arrayUnion;
    _deleteField = shim.deleteField;
    _increment = shim.increment;

    enabled = false;
    (authReadyResolve as any)?.(auth);
    return;
  }

  // Check for Native SDK availability (React Native Firebase)
  // This works in Development Builds but NOT in Expo Go (standard)
  // We prefer this if available.
  let nativeFirebaseAvailable = false;
  if (IS_EXPO_GO) {
    console.log("[Firebase] Running in Expo Go — skipping native SDK, using Web SDK.");
  } else {
    try {
      const rnFirebase = require('@react-native-firebase/app');
      // Use modular getApps() — avoids the deprecated namespaced .apps property
      const _getApps = rnFirebase.getApps || (() => rnFirebase.default.apps);
      _getApps(); // just probe — auto-init happens via google-services.json
      nativeFirebaseAvailable = true;
      console.log("[Firebase] Native SDK detected.");
    } catch (e) {
      console.log("[Firebase] Native SDK not found, falling back to Web SDK.");
    }
  }

  if (nativeFirebaseAvailable && Platform.OS !== 'web') {
    // --- NATIVE SDK ADAPTER (modular v22 API) ---
    const rnFirestoreModule = require('@react-native-firebase/firestore');
    const rnAuthModule = require('@react-native-firebase/auth');
    const rnFunctionsModule = require('@react-native-firebase/functions');
    const rnStorageModule = require('@react-native-firebase/storage');
    const rnAppModule = require('@react-native-firebase/app');

    // Use modular getX() functions — avoids deprecated namespaced API
    appInstance = rnAppModule.getApp();
    auth = rnAuthModule.getAuth();
    db = rnFirestoreModule.getFirestore();
    functions = rnFunctionsModule.getFunctions();
    storage = rnStorageModule.getStorage();

    // --- AUTH ADAPTERS ---
    getAuth = () => auth;

    onAuthStateChanged = (authInstance: any, observer: any) => {
      if (rnAuthModule.onAuthStateChanged) return rnAuthModule.onAuthStateChanged(authInstance, observer);
      return authInstance.onAuthStateChanged(observer);
    };

    signInWithEmailAndPassword = (authInstance: any, email: string, pass: string) => {
      if (rnAuthModule.signInWithEmailAndPassword) return rnAuthModule.signInWithEmailAndPassword(authInstance, email, pass);
      return authInstance.signInWithEmailAndPassword(email, pass);
    };

    createUserWithEmailAndPassword = (authInstance: any, email: string, pass: string) => {
      if (rnAuthModule.createUserWithEmailAndPassword) return rnAuthModule.createUserWithEmailAndPassword(authInstance, email, pass);
      return authInstance.createUserWithEmailAndPassword(email, pass);
    };

    signOut = (authInstance: any) => {
      if (rnAuthModule.signOut) return rnAuthModule.signOut(authInstance);
      return authInstance.signOut();
    };

    GoogleAuthProvider = rnAuthModule.GoogleAuthProvider;
    signInWithCredential = (authInstance: any, credential: any) => {
      if (rnAuthModule.signInWithCredential) return rnAuthModule.signInWithCredential(authInstance, credential);
      return authInstance.signInWithCredential(credential);
    };

    // Adapter Functions: Map modular V9 style to Native Modular (v15+) or Fallback
    // RNF v14+ supports functional API for Firestore if imported correctly or used from the module

    _collection = (dbInstance: any, ...pathSegments: string[]) => {
      // dbInstance is the firestore instance.
      // RNF Modular: collection(db, 'path')
      if (rnFirestoreModule.collection) {
        return rnFirestoreModule.collection(dbInstance, pathSegments.join('/'));
      }
      // Fallback to namespaced if modular not found (should not happen in v23)
      return dbInstance.collection(pathSegments.join('/'));
    };

    _doc = (collectionOrDb: any, ...pathSegments: string[]) => {
      // RNF Modular: doc(db, 'path') or doc(coll, 'path')
      if (rnFirestoreModule.doc) {
        if (collectionOrDb === db) {
          return rnFirestoreModule.doc(db, pathSegments.join('/'));
        }
        return rnFirestoreModule.doc(collectionOrDb, pathSegments[0]);
      }

      // Fallback
      if (collectionOrDb === db) return db.doc(pathSegments.join('/'));
      return collectionOrDb.doc(pathSegments[0]);
    };

    _getDoc = (docRef: any) => {
      return rnFirestoreModule.getDoc ? rnFirestoreModule.getDoc(docRef) : docRef.get();
    };

    _getDocs = (queryOrCol: any) => {
      return rnFirestoreModule.getDocs ? rnFirestoreModule.getDocs(queryOrCol) : queryOrCol.get();
    };

    _setDoc = (docRef: any, data: any, options?: any) => {
      return rnFirestoreModule.setDoc ? rnFirestoreModule.setDoc(docRef, data, options) : docRef.set(data, options);
    };

    _updateDoc = (docRef: any, data: any) => {
      return rnFirestoreModule.updateDoc ? rnFirestoreModule.updateDoc(docRef, data) : docRef.update(data);
    };

    _addDoc = (colRef: any, data: any) => {
      return rnFirestoreModule.addDoc ? rnFirestoreModule.addDoc(colRef, data) : colRef.add(data);
    };

    _deleteDoc = (docRef: any) => {
      return rnFirestoreModule.deleteDoc ? rnFirestoreModule.deleteDoc(docRef) : docRef.delete();
    };

    _onSnapshot = (ref: any, callback: any, errorCallback?: any) => {
      if (rnFirestoreModule.onSnapshot) {
        return rnFirestoreModule.onSnapshot(ref, callback, errorCallback || ((err: any) => console.log(err)));
      }
      return ref.onSnapshot(callback, errorCallback || ((err: any) => console.log(err)));
    };

    _serverTimestamp = rnFirestoreModule.serverTimestamp;
    _increment = rnFirestoreModule.increment;
    _arrayUnion = rnFirestoreModule.arrayUnion;
    _deleteField = rnFirestoreModule.deleteField;

    _query = (queryOrCol: any, ...queryConstraints: any[]) => {
      if (rnFirestoreModule.query) {
        return rnFirestoreModule.query(queryOrCol, ...queryConstraints);
      }
      // Fallback to chaining
      let q = queryOrCol;
      for (const constraint of queryConstraints) {
        if (typeof constraint === 'function') {
          q = constraint(q);
        }
      }
      return q;
    };

    _where = (field: string, op: string, value: any) => {
      if (rnFirestoreModule.where) {
        return rnFirestoreModule.where(field, op, value);
      }
      return (q: any) => q.where(field, op === '==' ? '==' : op, value);
    };

    _orderBy = (field: string, dir: 'asc' | 'desc' = 'asc') => {
      if (rnFirestoreModule.orderBy) {
        return rnFirestoreModule.orderBy(field, dir);
      }
      return (q: any) => q.orderBy(field, dir);
    };

    enabled = true;
    (authReadyResolve as any)?.(auth);
    console.log("[Firebase] Initialized Native SDKs (Modular Adapter)");

  } else {
    // --- WEB SDK FALLBACK ---
    console.log("[Firebase] Initializing Web SDK...");
    const { initializeApp } = await import('firebase/app');
    const { getFirestore } = await import('firebase/firestore');
    const { getFunctions } = await import('firebase/functions');

    // Auth imports
    const authModule: any = await import('firebase/auth');
    const { initializeAuth, getReactNativePersistence } = authModule;
    const AsyncStorageModule = await import('@react-native-async-storage/async-storage');
    const ReactNativeAsyncStorage = AsyncStorageModule.default || AsyncStorageModule;

    const firebaseConfig = {
      apiKey: "AIzaSyAcWRxjAp5nEmd_PCkQrSwdKIywS1hxlpw",
      authDomain: "medicareapp-f0dc0.firebaseapp.com",
      projectId: "medicareapp-f0dc0",
      storageBucket: "medicareapp-f0dc0.firebasestorage.app",
      messagingSenderId: "631948568273",
      appId: "1:631948568273:web:7be567104ec9f4593507f0",
      measurementId: "G-XZVM0ZY349"
    };

    const app = initializeApp(firebaseConfig);
    appInstance = app;
    db = getFirestore(app);
    functions = getFunctions(app);

    // Initialize Auth with Persistence
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage),
      });
    } catch (e: any) {
      if (e.code === 'auth/already-initialized') {
        auth = authModule.getAuth(app);
      } else {
        console.warn("Auth init error:", e);
        auth = authModule.getAuth(app);
      }
    }

    // Re-export named firestore helpers
    const firestore: any = await import('firebase/firestore');
    _collection = firestore.collection;
    _doc = firestore.doc;
    _getDoc = firestore.getDoc;
    _getDocs = firestore.getDocs;
    _setDoc = firestore.setDoc;
    _updateDoc = firestore.updateDoc;
    _addDoc = firestore.addDoc;
    _deleteDoc = firestore.deleteDoc;
    _onSnapshot = firestore.onSnapshot;
    _serverTimestamp = firestore.serverTimestamp;
    _query = firestore.query;
    _where = firestore.where;
    _orderBy = firestore.orderBy;
    _arrayUnion = firestore.arrayUnion;
    _deleteField = firestore.deleteField;
    _increment = firestore.increment;

    // Auth Adapters (Web)
    const authMod = await import('firebase/auth');
    onAuthStateChanged = authMod.onAuthStateChanged;
    signInWithEmailAndPassword = authMod.signInWithEmailAndPassword;
    createUserWithEmailAndPassword = authMod.createUserWithEmailAndPassword;
    signOut = authMod.signOut;
    getAuth = authMod.getAuth;
    GoogleAuthProvider = authMod.GoogleAuthProvider;
    signInWithCredential = authMod.signInWithCredential;

    enabled = true;
    (authReadyResolve as any)?.(auth);
    console.log("[Firebase] Initialized Web SDK");
  }

})();

