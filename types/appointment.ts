import { Timestamp } from 'firebase/firestore';

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'requested';

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
    [key: string]: any;
  };
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}
