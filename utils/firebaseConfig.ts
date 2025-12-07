/* eslint-disable @typescript-eslint/no-var-requires */
// Toggle to disable real Firebase and use a local shim with mock data.
// Set to false to enable real Firebase (native Android config required).
const DISABLE_FIREBASE = false;

// Toggle to use Firebase Emulators for local testing
// Set to true to connect to local emulators, false to use production Firebase
const USE_EMULATOR = false;

// Exported placeholders (will be assigned below)
export let appInstance: any = null;
export let db: any = null;
export let auth: any = null;
export let enabled: boolean = false;

// Firestore helper exports (compatibility with code importing named helpers)
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

// Exported accessor functions that delegate to the real SDK once initialized.
export const collection = (...args: any[]) => {
  if (typeof _collection === 'function') return _collection(...args);
  throw new Error('Firestore helper `collection` not initialized yet');
};
export const doc = (...args: any[]) => {
  if (typeof _doc === 'function') return _doc(...args);
  throw new Error('Firestore helper `doc` not initialized yet');
};
export const getDoc = (...args: any[]) => {
  if (typeof _getDoc === 'function') return _getDoc(...args);
  throw new Error('Firestore helper `getDoc` not initialized yet');
};
export const getDocs = (...args: any[]) => {
  if (typeof _getDocs === 'function') return _getDocs(...args);
  throw new Error('Firestore helper `getDocs` not initialized yet');
};
export const setDoc = (...args: any[]) => {
  if (typeof _setDoc === 'function') return _setDoc(...args);
  throw new Error('Firestore helper `setDoc` not initialized yet');
};
export const updateDoc = (...args: any[]) => {
  if (typeof _updateDoc === 'function') return _updateDoc(...args);
  throw new Error('Firestore helper `updateDoc` not initialized yet');
};
export const addDoc = (...args: any[]) => {
  if (typeof _addDoc === 'function') return _addDoc(...args);
  throw new Error('Firestore helper `addDoc` not initialized yet');
};
export const deleteDoc = (...args: any[]) => {
  if (typeof _deleteDoc === 'function') return _deleteDoc(...args);
  throw new Error('Firestore helper `deleteDoc` not initialized yet');
};
export const onSnapshot = (...args: any[]) => {
  if (typeof _onSnapshot === 'function') return _onSnapshot(...args);
  throw new Error('Firestore helper `onSnapshot` not initialized yet');
};
export const serverTimestamp = (...args: any[]) => {
  if (typeof _serverTimestamp === 'function') return _serverTimestamp(...args);
  throw new Error('Firestore helper `serverTimestamp` not initialized yet');
};
export const query = (...args: any[]) => {
  if (typeof _query === 'function') return _query(...args);
  throw new Error('Firestore helper `query` not initialized yet');
};
export const where = (...args: any[]) => {
  if (typeof _where === 'function') return _where(...args);
  throw new Error('Firestore helper `where` not initialized yet');
};
export const orderBy = (...args: any[]) => {
  if (typeof _orderBy === 'function') return _orderBy(...args);
  throw new Error('Firestore helper `orderBy` not initialized yet');
};
export const arrayUnion = (...args: any[]) => {
  if (typeof _arrayUnion === 'function') return _arrayUnion(...args);
  throw new Error('Firestore helper `arrayUnion` not initialized yet');
};
export const deleteField = (...args: any[]) => {
  if (typeof _deleteField === 'function') return _deleteField(...args);
  throw new Error('Firestore helper `deleteField` not initialized yet');
};
export const increment = (...args: any[]) => {
  if (typeof _increment === 'function') return _increment(...args);
  throw new Error('Firestore helper `increment` not initialized yet');
};

let authReadyResolve: ((a: any) => void) | null = null;
const authReady = new Promise<any>((resolve) => {
  authReadyResolve = resolve;
});

export async function getAuthInstance() {
  if (auth) return auth;
  return authReady;
}

if (DISABLE_FIREBASE) {
  // Use the shim
  const shim = require('./firebaseShim');
  appInstance = null;
  db = shim.db;
  auth = shim.auth;
  enabled = false;

  // Named helpers (assign to internal delegates)
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

  (authReadyResolve as any)?.(auth);

} else {
  // Initialize real Firebase lazily
  (async () => {
    const { initializeApp } = await import('firebase/app');
    const { getFirestore } = await import('firebase/firestore');

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

    // Connect to emulators in development mode
    if (__DEV__ && USE_EMULATOR) {
      console.log('[EMULATOR] Connecting to local Firebase emulators...');
      // Make sure to use your machine's actual IP for Android emulator
      const host = '10.234.93.250'; 
      // const host = 'localhost'; // Use this for iOS simulator
      
      try {
        const { connectFirestoreEmulator } = await import('firebase/firestore');
        connectFirestoreEmulator(db, host, 8080);
        console.log('[EMULATOR] Firestore connected.');
      } catch (e) {
        console.error('[EMULATOR] Error connecting to Firestore emulator:', e);
      }
    }

    // Init auth
    const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
    try {
      if (isReactNative) {
        try {
          const AsyncStorageModule = await import('@react-native-async-storage/async-storage');
          const ReactNativeAsyncStorage = AsyncStorageModule.default || AsyncStorageModule;
          const authModule: any = await import('firebase/auth');
          const { initializeAuth, getReactNativePersistence } = authModule;
          auth = initializeAuth(app, {
            persistence: getReactNativePersistence(ReactNativeAsyncStorage),
          });

          if (__DEV__ && USE_EMULATOR) {
            try {
              const { connectAuthEmulator } = await import('firebase/auth');
              const host = '10.234.93.250'; // Android
              // const host = 'localhost'; // iOS
              connectAuthEmulator(auth, `http://${host}:9099`);
              console.log('[EMULATOR] Auth connected.');
            } catch (e) {
              console.error('[EMULATOR] Error connecting to Auth emulator:', e);
            }
          }

          (authReadyResolve as any)?.(auth);
        } catch {
          // fallthrough to getAuth
        }
      }

      if (!auth) {
        const authModule: any = await import('firebase/auth');
        const { getAuth } = authModule;
        auth = getAuth(app);

        if (__DEV__ && USE_EMULATOR) {
          try {
            const { connectAuthEmulator } = await import('firebase/auth');
            const host = '10.234.93.250'; // Android
            // const host = 'localhost'; // iOS
            connectAuthEmulator(auth, `http://${host}:9099`);
            console.log('[EMULATOR] Auth connected (fallback).');
          } catch (e) {
            console.error('[EMULATOR] Error connecting to Auth emulator (fallback):', e);
          }
        }

        (authReadyResolve as any)?.(auth);
      }
    } catch {
      // ignore
    }

    // Re-export named firestore helpers from the real SDK for compatibility
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

    enabled = true;
  })();
}
