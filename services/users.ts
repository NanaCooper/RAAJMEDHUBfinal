import { 
  db, doc, getDoc, setDoc, serverTimestamp, 
  onSnapshot, addDoc, collection, deleteDoc,
  getAuthInstance, GoogleAuthProvider 
} from '../utils/firebaseConfig';
import { EmailAuthProvider, reauthenticateWithCredential, deleteUser, updatePassword } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import type { AppUser } from '../types/user';

export async function createUserProfile(user: AppUser) {
  try {
    const userRef = doc(db, 'users', user.id);
    await setDoc(userRef, {
      ...user,
      createdAt: serverTimestamp(),
    });
    return await getUserProfile(user.id);
  } catch (err) {
    console.error('createUserProfile error', err);
    throw err;
  }
}

export async function getUserProfile(userId: string): Promise<AppUser | null> {
  try {
    // 1. Try to fetch from 'users' collection
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return { id: snap.id, ...(snap.data() as any) } as AppUser;
    }

    // 2. If not found in 'users', fallback to 'patients' collection
    const patientRef = doc(db, 'patients', userId);
    const patientSnap = await getDoc(patientRef);
    if (patientSnap.exists()) {
      const data = patientSnap.data() as any;
      
      // Parse full name into components for compatibility with the AppUser fields
      const fullName = data.name || data.fullName || '';
      const nameParts = fullName.trim().split(/\s+/);
      let firstName = data.firstName || '';
      let lastName = data.lastName || '';
      let middleName = data.middleName || '';
      
      if (!firstName && nameParts.length > 0) {
        firstName = nameParts[0];
        if (nameParts.length > 2) {
          middleName = nameParts.slice(1, -1).join(' ');
          lastName = nameParts[nameParts.length - 1];
        } else if (nameParts.length === 2) {
          lastName = nameParts[1];
        }
      }

      return {
        id: patientSnap.id,
        email: data.email || '',
        fullName: fullName,
        firstName: firstName,
        middleName: middleName,
        lastName: lastName,
        role: 'patient',
        contact: data.contact || data.phone || '',
        phone: data.phone || data.contact || '',
        dob: data.dob || '',
        gender: data.gender || data.sex || '',
        sex: data.sex || data.gender || '',
        age: data.age || '',
        patientNumber: data.patientNumber || '',
        insuranceId: data.insuranceId || '',
        status: 'online',
        createdAt: data.createdAt || '',
      } as AppUser;
    }

    return null;
  } catch (err) {
    console.error('getUserProfile error', err);
    throw err;
  }
}

export async function updateUserProfile(userId: string, patch: Partial<AppUser>) {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...patch,
      updatedAt: serverTimestamp(),
    } as any, { merge: true });
    return await getUserProfile(userId);
  } catch (err) {
    console.error('updateUserProfile error', err);
    throw err;
  }
}

export async function updateUserPassword(currentPassword: string, newPassword: string) {
  const auth = await getAuthInstance();
  const user = auth.currentUser;

  if (user && user.email) {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    try {
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
    } catch (error) {
      console.error("Error updating password:", error);
      throw error;
    }
  } else {
    throw new Error("User not found or email not available.");
  }
}

async function reauthenticateWithGoogleIfPossible(user: any) {
  // Requires that GoogleSignin.configure(...) has run (done in AuthProvider).
  await GoogleSignin.hasPlayServices();

  let idToken: string | null | undefined;
  try {
    const silent = await GoogleSignin.signInSilently();
    idToken = silent?.data?.idToken;
  } catch {
    // ignore
  }

  if (!idToken) {
    const interactive = await GoogleSignin.signIn();
    idToken = interactive?.data?.idToken;
  }

  if (!idToken) {
    throw new Error('GOOGLE_REAUTH_FAILED');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  await reauthenticateWithCredential(user, credential);
}

export async function requestDataExport(userId: string) {
  try {
    await addDoc(collection(db, 'data-exports'), {
      userId,
      requestedAt: serverTimestamp(),
      status: 'pending',
    });
  } catch (err) {
    console.error('requestDataExport error', err);
    throw err;
  }
}

// Real-time online status indicator
export function subscribeToUserStatus(userId: string, cb: (status: { online: boolean, lastActive?: string }) => void) {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(userRef, (snap: any) => {
    if (!snap.exists()) return cb({ online: false });
    const data = snap.data();
    cb({ online: data.status === 'online', lastActive: data.lastActive });
  });
}

export async function setUserOnlineStatus(userId: string, online: boolean) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    status: online ? 'online' : 'offline',
    lastActive: serverTimestamp(),
  });
}
export async function deleteUserAccount(password?: string) {
  const auth = await getAuthInstance();
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user found.");

  try {
    // Step 1: Re-authenticate (required for sensitive ops like account deletion)
    const providers: string[] = (user.providerData || []).map((p: any) => p.providerId).filter(Boolean);
    const hasPasswordProvider = providers.includes('password');
    const hasGoogleProvider = providers.includes('google.com');

    if (password) {
      if (!user.email) throw new Error('User email not available.');
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    } else if (hasPasswordProvider) {
      // Email/password account: require password confirmation.
      throw new Error('PASSWORD_REQUIRED');
    } else if (hasGoogleProvider) {
      // Google-first account: confirm by reauth with Google.
      await reauthenticateWithGoogleIfPossible(user);
    }

    const uid = user.uid;

    // Step 2: Delete all Firestore documents for this user
    const deletions: Promise<void>[] = [
      deleteDoc(doc(db, 'users', uid)),
      deleteDoc(doc(db, 'patients', uid)),
      deleteDoc(doc(db, 'doctors', uid)),
    ];
    // Run all deletions in parallel (ignore errors if docs don't exist)
    await Promise.allSettled(deletions);

    // Step 3: Delete the Firebase Auth account itself
    await deleteUser(user);
  } catch (error: any) {
    console.error("Account deletion error:", error);
    // Surface a human-readable message for the UI
    if (error?.code === 'auth/requires-recent-login') {
      throw new Error("REQUIRES_REAUTH");
    }
    throw error;
  }
}
