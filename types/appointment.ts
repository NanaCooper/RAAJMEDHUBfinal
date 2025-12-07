import { Timestamp } from 'firebase/firestore';

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

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
  scanType?: ScanType;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}
