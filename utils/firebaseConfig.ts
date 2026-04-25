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
  FIREBASE_STORAGE_BUCKET 
} from '../constants/Config';

// In React Native, the app is auto-initialized from google-services.json / GoogleService-Info.plist
const app: any = getApps().length > 0 
  ? getApp() 
  : initializeApp({
      apiKey: FIREBASE_API_KEY as string,
      appId: FIREBASE_APP_ID as string,
      projectId: FIREBASE_PROJECT_ID as string,
      storageBucket: FIREBASE_STORAGE_BUCKET as string,
    });

export const appInstance = app;
export const db = getFirestore(app);
export const auth = firebaseGetAuth(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);
export const enabled = true;

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
