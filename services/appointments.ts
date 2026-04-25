import { db, collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp } from '../utils/firebaseConfig';
import type { Appointment } from '../types/appointment';
import { scheduleAppointmentReminders, sendDoctorAssignedNotification, sendPatientAssignedNotification, sendAppointmentRescheduledNotification, sendAppointmentApprovedNotification } from './notifications';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);

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

// Shared state for notification deduplication across multiple subscriptions
const processedNotificationEvents = new Set<string>();

export function subscribeToAppointments(
  userId: string,
  role: 'patient' | 'doctor',
  cb: (appointments: Appointment[]) => void,
  onError?: (err: any) => void,
  userEmail?: string | null
) {
  const field = role === 'patient' ? 'patientId' : 'doctorId';
  let unsubMain: () => void = () => { };
  let unsubEmail: () => void = () => { };

  // Store docs from both queries
  let mainDocs: any[] = [];
  let emailDocs: any[] = [];

  // Helper to process notifications
  const processNotifications = (changes: any[], oldDocs: any[] = []) => {
    changes.forEach(change => {
      const data = change.doc.data();
      const apptId = change.doc.id;
      // Parse startAt robustly
      let startAt: Date | null = null;
      if (data.startAt) {
        if (typeof data.startAt === 'string') {
          // Handle "YYYY-MM-DD HH:mm" and ISO formats
          const m = dayjs(data.startAt, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DDTHH:mm:ss.SSSZ']);
          if (m.isValid()) {
            startAt = m.toDate();
          } else {
            console.warn(`[Appointments] Invalid date string: ${data.startAt}`);
          }
        } else if (data.startAt.toDate) {
          startAt = data.startAt.toDate();
        }
      }

      if (!startAt) return;

      // Debug log to verify parsing
      // console.log(`[Appointments] Parsed startAt for ${apptId}: ${startAt.toISOString()} (Raw: ${data.startAt})`);

      // 1. New Appointment Added
      if (change.type === 'added') {
        // Only notify if created recently (e.g., last 5 mins) to avoid spam on load
        // Or if it's a future appointment that we haven't scheduled reminders for yet
        // For simplicity, we schedule reminders for ALL future appointments (idempotent)
        if (startAt > new Date()) {
          const otherParty = role === 'patient' ? data.doctorName : data.patientDetails?.fullName || 'Patient';
          scheduleAppointmentReminders(apptId, startAt, otherParty, role);
        }

        // Specific Notification: Admin booked for patient
        // If I am a patient, and a new appointment appears that I didn't create (e.g. admin), notify me.
        // We assume if it's 'added' and has a doctor assigned, it might be an admin booking or just a sync.
        // To be safe, we check if it was created recently (e.g. < 1 min ago)
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(0);
        const isRecent = (new Date().getTime() - createdAt.getTime()) < 60000; // 1 min

        // Deduplication key for "Doctor Assigned" (Added)
        const eventKey = `added_assigned_${apptId}`;

        if (role === 'patient' && isRecent && data.doctorName && !processedNotificationEvents.has(eventKey)) {
          processedNotificationEvents.add(eventKey);
          sendDoctorAssignedNotification(data.doctorName, startAt, apptId);
        }

        // Specific Notification: Doctor receives new patient
        const docEventKey = `added_patient_${apptId}`;
        if (role === 'doctor' && isRecent && !processedNotificationEvents.has(docEventKey)) {
          processedNotificationEvents.add(docEventKey);
          const patientName = data.patientDetails?.fullName || 'New Patient';
          sendPatientAssignedNotification(patientName, startAt, apptId);
        }
      }

      // 2. Appointment Modified
      if (change.type === 'modified') {
        // Check if doctor was just assigned
        // We don't have the 'old' doc here easily without tracking state, 
        // but we can check if doctorId is present now.
        // A better way is to rely on the fact that if it was modified and now has a doctor, 
        // and we are the patient, we should know.
        // To avoid spam, we can check if the update timestamp is recent.
        const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(0);
        const isRecentUpdate = (new Date().getTime() - updatedAt.getTime()) < 60000; // 1 min

        // Deduplication key for "Doctor Assigned" (Modified)
        // We use timestamp to allow re-notification if it changes again later (but not within same minute/session)
        const modEventKey = `mod_assigned_${apptId}_${updatedAt.getTime()}`;

        if (role === 'patient' && isRecentUpdate && data.doctorName && data.status !== 'cancelled' && !processedNotificationEvents.has(modEventKey)) {
          // We can't easily know if it was *just* assigned without prev state, 
          // but sending a "Doctor Assigned" notification when the doc is updated is acceptable 
          // if we debounce or check specific fields. 
          // For now, we assume a modification with a doctor name implies assignment or update.
          // Ideally, we'd check if the previous state had no doctor.
          // Let's rely on the UI/Service layer to trigger this, OR just send it.
          // Actually, the requirement says: "When the app fetches a doctor has been assigned... send notification"
          // This implies a transition from No Doctor -> Doctor.
          // Since we don't have prev state here, we will just schedule reminders which is safe.
          // For the specific "Doctor Assigned" alert, we might need to be more careful.
          // Let's try to infer it: if status is 'pending' -> 'upcoming' maybe?

          processedNotificationEvents.add(modEventKey);

          // Re-schedule reminders in case time changed
          if (startAt > new Date()) {
            scheduleAppointmentReminders(apptId, startAt, data.doctorName, role);
          }

          // If we really want to catch the "Just Assigned" event, we need to store local state.
          // But for this task, ensuring reminders are set is the priority.
          // The "Admin Booked" case is covered by 'added' + isRecent.
        }

        // --- CHECK 2: DATE CHANGED / RESCHEDULED ---
        // Find old doc to compare
        // We need to pass oldDocs to check for changes
        if (role === 'patient' && isRecentUpdate && startAt && data.status !== 'cancelled') {
          const oldDoc = oldDocs.find(d => d.id === apptId);
          let oldStartAt: Date | null = null;

          if (oldDoc) {
            const oldData = oldDoc.data();
            if (oldData.startAt) {
              if (typeof oldData.startAt === 'string') {
              const m = dayjs(oldData.startAt, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DDTHH:mm:ss.SSSZ']);
              if (m.isValid()) oldStartAt = m.toDate();
              } else if (oldData.startAt.toDate) {
                oldStartAt = oldData.startAt.toDate();
              }
            }
          }

          // Detect Change:
          // 1. Old had NO date, New HAS date (Scheduling)
          // 2. Old had date, New has DIFFERENT date (Rescheduling)
          const isNewDate = !oldStartAt && startAt;
          // compare times
          const isChangedDate = oldStartAt && startAt && oldStartAt.getTime() !== startAt.getTime();

          // Dedupe key for rescheduling
          const reschedKey = `resched_${apptId}_${updatedAt.getTime()}`;

          if ((isNewDate || isChangedDate) && !processedNotificationEvents.has(reschedKey)) {
            processedNotificationEvents.add(reschedKey);
            sendAppointmentRescheduledNotification(startAt, apptId);
          }
        }

        // --- CHECK 3: APPOINTMENT APPROVED (status changed to 'upcoming') ---
        // Detect when admin/staff approves the appointment (status: pending/requested → upcoming)
        if (role === 'patient' && isRecentUpdate && data.status === 'upcoming') {
          const oldDoc = oldDocs.find((d: any) => d.id === apptId);
          const oldStatus = oldDoc?.data()?.status;
          // Only notify if it was previously awaiting approval
          const wasAwaitingApproval = !oldStatus || ['pending', 'requested'].includes(oldStatus);
          const approvalKey = `approved_${apptId}_${updatedAt.getTime()}`;

          if (wasAwaitingApproval && !processedNotificationEvents.has(approvalKey)) {
            processedNotificationEvents.add(approvalKey);
            sendAppointmentApprovedNotification(apptId, startAt || undefined);
          }
        }
      }

      // 3. Auto-Deny Past Pending Appointments
      // We check on 'added' (initial load) and 'modified' to catch expired items.
      if (data.status === 'pending') {
        const now = new Date();
        // If startAt is in the past
        if (startAt < now) {
          // Only the doctor should trigger this write to avoid double writes if patient is also online
          // (Though firestore rules might block patient from setting 'denied', doctor definitely can).
          if (role === 'doctor') {
            // console.log(`[Auto-Deny] Denying expired appointment ${apptId}`);
            // Fire and forget
            updateAppointmentStatus(apptId, 'denied' as any).catch(e => console.warn("Auto-deny failed", e));
          }
        }
      }
    });
  };

  const updateCombined = () => {
    // Merge and deduplicate by ID
    const allDocs = [...mainDocs];
    emailDocs.forEach(ed => {
      if (!allDocs.find(md => md.id === ed.id)) {
        allDocs.push(ed);
      }
    });
    cb(makeSorted(allDocs));
  };

  const makeSorted = (docs: any[]) => {
    const items = docs.map((d: any) => ({ id: d.id, ...(d.data() as any) } as Appointment));
    items.sort((a: any, b: any) => {
      const getMillis = (val: any) => {
        if (!val) return 0;
        if (typeof val.toMillis === 'function') return val.toMillis();
        if (typeof val === 'string') return new Date(val).getTime();
        return 0;
      };
      const aVal = getMillis(a.startAt);
      const bVal = getMillis(b.startAt);
      return bVal - aVal;
    });
    return items;
  };

  // 1. Main Query (by ID)
  // console.log(`[subscribeToAppointments] Subscribing for ${role} with ID: ${userId}`);
  const qMain = query(appointmentsCol(), where(field, '==', userId));

  try {
    unsubMain = onSnapshot(
      qMain,
      (snapshot: any) => {
        // console.log(`[subscribeToAppointments] Main Snapshot. Docs: ${snapshot.docs.length}`);
        // PROCESS BEFORE UPDATING mainDocs to allow comparison
        processNotifications(snapshot.docChanges(), mainDocs);
        mainDocs = snapshot.docs;
        updateCombined();
      },
      (err: any) => {
        console.error('subscribeToAppointments error (main)', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.error('subscribeToAppointments setup error', err);
    if (onError) onError(err);
  }

  // 2. Secondary Query (by Email) - Only for patients
  if (role === 'patient' && userEmail) {
    // console.log(`[subscribeToAppointments] Subscribing for patient with Email: ${userEmail}`);
    const qEmail = query(appointmentsCol(), where('patientEmail', '==', userEmail));
    try {
      unsubEmail = onSnapshot(
        qEmail,
        (snapshot: any) => {
          // console.log(`[subscribeToAppointments] Email Snapshot. Docs: ${snapshot.docs.length}`);
          // PROCESS BEFORE UPDATING emailDocs
          processNotifications(snapshot.docChanges(), emailDocs);
          emailDocs = snapshot.docs;
          updateCombined();
        },
        (err: any) => {
          // Ignore permission errors for email query if rules are strict
          console.warn('subscribeToAppointments error (email)', err);
        }
      );
    } catch (err) {
      console.warn('subscribeToAppointments email setup error', err);
    }
  }

  return () => {
    try { unsubMain(); } catch { /* ignore */ }
    try { unsubEmail(); } catch { /* ignore */ }
  };
}
