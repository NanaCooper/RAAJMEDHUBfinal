import { Timestamp } from 'firebase/firestore';

export type ReferralProcedureKey =
  | 'xray'
  | 'ct_head'
  | 'ct_chest'
  | 'hsg'
  | 'mammography'
  | 'endoscopy'
  | 'ct_abdomen'
  | 'ct_angiography'
  | 'echocardiogram'
  | 'ecg'
  | 'ct_generic';

export interface Referral {
  id?: string;
  doctorId: string;
  appointmentId?: string;
  patientName?: string;
  procedureKey: ReferralProcedureKey;
  procedureLabel: string;
  amountGhs: number;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}
