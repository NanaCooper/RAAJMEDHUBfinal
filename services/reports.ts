import {
  db,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from '../utils/firebaseConfig';

export interface Report {
  id?: string;
  patientId: string;
  appointmentId?: string;
  /** Display title e.g. "Abdominal Ultrasound" */
  title: string;
  /** Category key matching the booking scan type: Ultrasound | X-Ray | MRI | CT Scan | Mammogram | Other */
  category: string;
  doctorName?: string;
  branch?: string;
  /** 'ready' once the radiologist has uploaded the result, 'processing' otherwise */
  status: 'ready' | 'processing';
  /** Firebase Storage download URL for the report file (mobile field) */
  fileUrl?: string;
  /** Firebase Storage download URL for the report file (web portal field) */
  reportUrl?: string;
  /** Whether the report has been shared with the patient (web portal field) */
  sharedWithPatient?: boolean;
  fileSize?: string;
  createdAt?: any;
  updatedAt?: any;
}

const COL = 'reports';

/** Normalise a raw Firestore doc into a Report, bridging web-portal field names. */
function normaliseReport(id: string, data: any): Report {
  return {
    ...data,
    id,
    // Web portal saves the URL as `reportUrl`; mobile uses `fileUrl` — accept both
    fileUrl: data.fileUrl || data.reportUrl || undefined,
    reportUrl: data.reportUrl || data.fileUrl || undefined,
    // Web portal marks availability via `sharedWithPatient`; map to status
    status: data.status || (data.sharedWithPatient ? 'ready' : 'processing'),
    title: data.title || data.scanType || data.category || 'Report',
    category: data.category || data.scanType || 'Other',
  } as Report;
}

/** Build a Report from an appointment doc that has reportUrl set. */
function reportFromAppointment(id: string, data: any): Report {
  const scanName = Array.isArray(data.scanTypes) && data.scanTypes.length > 0
    ? data.scanTypes.map((s: any) => s.name || s).join(', ')
    : (data.scanType?.name || data.scanType || 'Scan');
  return {
    id,
    patientId: data.patientId,
    appointmentId: id,
    title: data.reportName || scanName,
    category: scanName,
    doctorName: data.doctorName || undefined,
    branch: data.branch || undefined,
    status: 'ready',
    fileUrl: data.reportUrl,
    reportUrl: data.reportUrl,
    sharedWithPatient: data.sharedWithPatient,
    createdAt: data.uploadedAt || data.createdAt || data.startAt || undefined,
  } as Report;
}

export async function getPatientReports(patientId: string): Promise<Report[]> {
  const results: Report[] = [];

  // 1) Try the dedicated `reports` collection
  try {
    const q = query(
      collection(db, COL),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d: any) => results.push(normaliseReport(d.id, d.data())));
  } catch (err: any) {
    // Fallback without orderBy
    if (err?.code === 'firestore/failed-precondition' || err?.message?.includes('index')) {
      try {
        const q2 = query(collection(db, COL), where('patientId', '==', patientId));
        const snap2 = await getDocs(q2);
        snap2.docs.forEach((d: any) => results.push(normaliseReport(d.id, d.data())));
      } catch (_e) { /* ignore */ }
    }
  }

  // 2) Also check appointments that have a reportUrl (web portal stores reports on the appointment doc)
  try {
    const apptQ = query(
      collection(db, 'appointments'),
      where('patientId', '==', patientId),
    );
    const apptSnap = await getDocs(apptQ);
    console.log('[reports] Appointments found for patient:', apptSnap.size);
    apptSnap.docs.forEach((d: any) => {
      const data = d.data();
      console.log('[reports] Appt:', d.id, 'reportUrl:', data.reportUrl, 'sharedWithPatient:', data.sharedWithPatient, 'status:', data.status);
      if (data.reportUrl && data.sharedWithPatient) {
        // Avoid duplicates if the same appointmentId is already in results
        if (!results.find(r => r.appointmentId === d.id)) {
          results.push(reportFromAppointment(d.id, data));
        }
      }
    });
  } catch (err: any) {
    console.warn('[reports] Error fetching appointment reports:', err?.message);
  }

  // Sort newest first
  results.sort((a, b) => {
    const ta = a.createdAt?.seconds ?? a.createdAt?.getTime?.() ?? 0;
    const tb = b.createdAt?.seconds ?? b.createdAt?.getTime?.() ?? 0;
    return tb - ta;
  });

  return results;
}

/** Fetch all reports for a specific doctor name. */
export async function getDoctorReports(doctorName: string, doctorId: string): Promise<Report[]> {
  const results: Report[] = [];

  // 1) Try the dedicated `reports` collection
  try {
    const q = query(
      collection(db, COL),
      where('doctorName', '==', doctorName)
      // Can't orderBy yet without a composite index, handled manually below
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d: any) => results.push(normaliseReport(d.id, d.data())));
  } catch (err: any) {
    console.warn('[reports] Error fetching doctor reports:', err?.message);
  }

  // 2) Also check appointments that have a reportUrl and were mapped to this doctor
  try {
    const apptQ = query(
      collection(db, 'appointments'),
      where('doctorId', '==', doctorId) // Query by doctorId to pass Firestore rules
    );
    const apptSnap = await getDocs(apptQ);
    apptSnap.docs.forEach((d: any) => {
      const data = d.data();
      // Ensure it was actually for this doctor if we want to be strict, but the ID match is enough
      if (data.reportUrl && data.sharedWithPatient) {
        if (!results.find(r => r.appointmentId === d.id)) {
          results.push(reportFromAppointment(d.id, data));
        }
      }
    });
  } catch (err: any) {
    console.warn('[reports] Error fetching doctor appointments for reports:', err?.message);
  }

  // Sort newest first
  results.sort((a, b) => {
    const ta = a.createdAt?.seconds ?? a.createdAt?.getTime?.() ?? 0;
    const tb = b.createdAt?.seconds ?? b.createdAt?.getTime?.() ?? 0;
    return tb - ta;
  });

  return results;
}


/** Create a new report document (typically called by admin/radiologist). */
export async function createReport(data: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>): Promise<Report> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...data };
}

/** Update an existing report (e.g. mark as ready, add fileUrl). */
export async function updateReport(reportId: string, patch: Partial<Report>): Promise<void> {
  await updateDoc(doc(db, COL, reportId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}
