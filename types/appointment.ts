import { Timestamp } from 'firebase/firestore';

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'requested'
  | 'denied'
  | 'approved'
  | 'scheduled'
  | 'rescheduled'
  | 'in_progress'
  | 'past_due'
  | 'procedure_done'
  | 'report_uploaded'
  | 'Approved'
  | 'Scheduled'
  | 'Rescheduled'
  | 'In_Progress'
  | 'Past_Due'
  | 'Procedure_Done'
  | 'Report_Uploaded';

export interface ScanType {
  id: string;
  name: string;
}

export interface Appointment {
  id?: string;
  patientId: string;
  doctorId?: string | null; // Optional - admin will assign
  startAt: Timestamp | string; // Firestore Timestamp or ISO string
  endAt?: Timestamp | string;
  status?: AppointmentStatus;
  notes?: string;
  branch?: 'Koforidua' | 'Takoradi' | 'Cape Coast';
  scanType?: ScanType;
  procedureName?: string;
  serviceName?: string;
  specificProcedure?: string;
  patientName?: string;
  patientDetails?: {
    firstName: string;
    middleName?: string;
    lastName: string;
    phone: string;
    dob: string;
    sex?: string;
    weight?: string;
    weightUnit?: string;
    age?: number;
    fullName?: string;
    [key: string]: any;
  };
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}
