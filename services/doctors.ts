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

    const ref = doc(db, 'users', idStr);
    const snap = await getDoc(ref);
    
    if (!snap.exists()) {
      return null;
    }

    const doctorData = { id: snap.id, ...(snap.data() as any) };
    doctorCache[idStr] = doctorData; // Cache the result
    return doctorData;

  } catch (err: any) {
    // Suppress permission errors completely to avoid console noise
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
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
