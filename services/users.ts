import { db, doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot, addDoc, collection, deleteDoc } from '../utils/firebaseConfig';
import { getAuth, updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth';
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
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) } as AppUser;
  } catch (err) {
    console.error('getUserProfile error', err);
    throw err;
  }
}

export async function updateUserProfile(userId: string, patch: Partial<AppUser>) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...patch,
      updatedAt: serverTimestamp(),
    } as any);
    return await getUserProfile(userId);
  } catch (err) {
    console.error('updateUserProfile error', err);
    throw err;
  }
}

export async function updateUserPassword(currentPassword: string, newPassword: string) {
  const auth = getAuth();
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
export async function deleteUserAccount() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user found.");

  try {
    // 1. Delete user data from Firestore
    const userRef = doc(db, 'users', user.uid);
    await deleteDoc(userRef);

    // 2. Delete the auth account
    await deleteUser(user);
  } catch (error) {
    console.error("Account deletion error:", error);
    throw error;
  }
}
