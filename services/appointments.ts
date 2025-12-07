import { db, collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp } from '../utils/firebaseConfig';
import type { Appointment } from '../types/appointment';

// Use a lazy accessor for the appointments collection so we don't call
// `collection(db, ...)` at module initialization before `db` is ready.
const appointmentsCol = () => collection(db, 'appointments');

export async function createAppointment(appointment: Appointment) {
  try {
    const payload = {
      ...appointment,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as any;
    const ref = await addDoc(appointmentsCol(), payload);
    const snap = await getDoc(ref);
    return { id: snap.id, ...(snap.data() as any) } as Appointment;
  } catch (err) {
    console.error('createAppointment error', err);
    throw err;
  }
}

export async function getAppointment(appointmentId: string) {
  try {
    const ref = doc(db, 'appointments', appointmentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) } as Appointment;
  } catch (err) {
    console.error('getAppointment error', err);
    throw err;
  }
}

export async function updateAppointment(appointmentId: string, patch: Partial<Appointment>) {
  try {
    const ref = doc(db, 'appointments', appointmentId);
    await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() } as any);
    return await getAppointment(appointmentId);
  } catch (err) {
    console.error('updateAppointment error', err);
    throw err;
  }
}

export async function updateAppointmentStatus(appointmentId: string, status: 'upcoming' | 'completed' | 'cancelled' | 'pending') {
  try {
    const ref = doc(db, 'appointments', appointmentId);
    await updateDoc(ref, { status, updatedAt: serverTimestamp() });
    return await getAppointment(appointmentId);
  } catch (err) {
    console.error('updateAppointmentStatus error', err);
    throw err;
  }
}

export async function deleteAppointment(appointmentId: string) {
  try {
    const ref = doc(db, 'appointments', appointmentId);
    await deleteDoc(ref);
    return true;
  } catch (err) {
    console.error('deleteAppointment error', err);
    throw err;
  }
}

export async function listAppointmentsByUser(userId: string, role: 'patient' | 'doctor') {
  try {
    const field = role === 'patient' ? 'patientId' : 'doctorId';
    const q = query(appointmentsCol(), where(field, '==', userId), orderBy('startAt', 'desc'));
    const snaps = await getDocs(q);
    return snaps.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) } as Appointment));
  } catch (err) {
    console.error('listAppointmentsByUser error', err);
    // If Firestore requires a composite index for this query, fall back to a no-order query
    // and sort client-side to avoid breaking the dashboard while the index is created.
    try {
      const msg = (err && (err as any).message) || '';
      // Be tolerant: some SDKs or locales may word this differently; check for 'index' keyword
      if (typeof msg === 'string' && msg.toLowerCase().includes('index')) {
        const field = role === 'patient' ? 'patientId' : 'doctorId';
        const q2 = query(appointmentsCol(), where(field, '==', userId));
        const snaps2 = await getDocs(q2);
        const items = snaps2.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) } as Appointment));
        // sort by startAt desc (handle Timestamp or numeric)
        items.sort((a: any, b: any) => {
          const aVal = a.startAt && typeof a.startAt.toMillis === 'function' ? a.startAt.toMillis() : (a.startAt || 0);
          const bVal = b.startAt && typeof b.startAt.toMillis === 'function' ? b.startAt.toMillis() : (b.startAt || 0);
          return bVal - aVal;
        });
        return items;
      }
    } catch (err2) {
      console.error('listAppointmentsByUser fallback error', err2);
    }
    throw err;
  }
}

export function subscribeToAppointments(
  userId: string,
  role: 'patient' | 'doctor',
  cb: (appointments: Appointment[]) => void,
  onError?: (err: any) => void,
) {
  const field = role === 'patient' ? 'patientId' : 'doctorId';
  let unsub: () => void = () => {};
  const makeSorted = (docs: any[]) => {
    const items = docs.map((d: any) => ({ id: d.id, ...(d.data() as any) } as Appointment));
    items.sort((a: any, b: any) => {
      const aVal = a.startAt && typeof a.startAt.toMillis === 'function' ? a.startAt.toMillis() : (a.startAt || 0);
      const bVal = b.startAt && typeof b.startAt.toMillis === 'function' ? b.startAt.toMillis() : (b.startAt || 0);
      return bVal - aVal;
    });
    return items;
  };

  // Use a real-time listener without server-side ordering to avoid requiring a composite index.
  // We'll sort client-side which avoids the 'create index' error and keeps the UI real-time.
  const qNoOrder = query(appointmentsCol(), where(field, '==', userId));
  try {
    unsub = onSnapshot(
      qNoOrder,
      (snapshot: any) => {
        cb(makeSorted(snapshot.docs));
      },
      (err: any) => {
        console.error('subscribeToAppointments error (realtime)', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.error('subscribeToAppointments setup error', err);
    if (onError) onError(err);
    // As a last resort, return a no-op unsub so callers won't crash
    unsub = () => {};
  }

  return () => {
    try { unsub(); } catch { /* ignore */ }
  };
}
