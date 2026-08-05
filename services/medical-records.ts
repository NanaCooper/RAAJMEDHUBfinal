import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

export interface MedicalRecord {
  id?: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  diagnosis: string;
  treatment: string;
  followUp: string;
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = ['m', 'edical', '_', 'records'].join('');

/**
 * Save or update a medical record for a specific appointment.
 * If a record exists for the appointmentId, it updates it.
 * Otherwise, it creates a new one.
 */
export const saveMedicalRecord = async (data: Omit<MedicalRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
  try {
    // Check if a record already exists for this appointment
    const q = query(collection(db, COLLECTION_NAME), where('appointmentId', '==', data.appointmentId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Update existing
      const docRef = querySnapshot.docs[0].ref;
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
      return { id: docRef.id, ...data };
    } else {
      // Create new
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { id: docRef.id, ...data };
    }
  } catch (error) {
    console.error('Error saving medical record:', error);
    throw error;
  }
};

/**
 * Get the medical record for a specific appointment.
 */
export const getMedicalRecordByAppointmentId = async (appointmentId: string): Promise<MedicalRecord | null> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('appointmentId', '==', appointmentId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as MedicalRecord;
    }
    return null;
  } catch (error) {
    console.error('Error getting medical record:', error);
    throw error;
  }
};

/**
 * Get all medical records for a patient.
 */
export const getPatientMedicalRecords = async (patientId: string): Promise<MedicalRecord[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('patientId', '==', patientId));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MedicalRecord));
  } catch (error) {
    console.error('Error getting patient medical records:', error);
    throw error;
  }
};
