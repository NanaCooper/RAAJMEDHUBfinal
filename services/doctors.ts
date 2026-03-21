import { db, collection, doc, getDoc, getDocs, query, where } from '../utils/firebaseConfig';

// Simple in-memory cache to prevent redundant fetches/errors
const doctorCache: { [key: string]: any } = {};

export async function getDoctor(doctorId: string) {
  try {
    if (!doctorId) return null;
    
    // Ensure doctorId is a string (handle potential object/reference)
    const idStr = typeof doctorId === 'object' && (doctorId as any).id ? (doctorId as any).id : String(doctorId);

    // Return cached result if available
    if (doctorCache[idStr]) {
      return doctorCache[idStr];
    }

    // 1. Try /doctors/{id} first — readable by all signed-in users per rules
    const doctorRef = doc(db, 'doctors', idStr);
    const doctorSnap = await getDoc(doctorRef);
    if (doctorSnap.exists()) {
      const data = { id: doctorSnap.id, ...(doctorSnap.data() as any) };
      doctorCache[idStr] = data;
      return data;
    }

    // 2. Fall back to /users/{id} — only works if patient has permission
    //    (e.g. the target user's role is 'doctor', which the rule allows)
    const userRef = doc(db, 'users', idStr);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return null;

    const doctorData = { id: userSnap.id, ...(userSnap.data() as any) };
    doctorCache[idStr] = doctorData;
    return doctorData;

  } catch (err: any) {
    // Silently swallow permission errors — not a code bug, just a rules boundary
    if (
      err?.code === 'permission-denied' ||
      err?.code === 'firestore/permission-denied' ||
      err?.message?.includes('permission') ||
      err?.message?.includes('Missing or insufficient')
    ) {
      return null;
    }
    console.warn('getDoctor error', err);
    return null;
  }
}


export async function listDoctors() {
  try {
    const usersCol = collection(db, 'users');
    const q = query(usersCol, where('role', '==', 'doctor'));
    const snaps = await getDocs(q);
    return snaps.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
  } catch (err) {
    console.error('listDoctors error', err);
    throw err;
  }
}
