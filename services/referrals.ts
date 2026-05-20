import {
  db,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from '../utils/firebaseConfig';
import type { Referral, ReferralProcedureKey } from '../types/referral';

export const REFERRAL_FEES_GHS: Record<ReferralProcedureKey, { label: string; amountGhs: number }> = {
  xray: { label: 'X-Ray', amountGhs: 15 },
  ct_head: { label: 'CT Head', amountGhs: 50 },
  ct_chest: { label: 'CT Chest', amountGhs: 50 },
  hsg: { label: 'HSG', amountGhs: 50 },
  mammography: { label: 'Mammography', amountGhs: 50 },
  endoscopy: { label: 'Endoscopy', amountGhs: 50 },
  ct_abdomen: { label: 'CT Abdomen', amountGhs: 70 },
  ct_angiography: { label: 'CT Angiography', amountGhs: 70 },
  echocardiogram: { label: 'Echocardiogram', amountGhs: 50 },
  ecg: { label: 'ECG', amountGhs: 20 },
  ct_generic: { label: 'CT Scan', amountGhs: 50 },
};

const referralsCol = () => collection(db, 'referrals');

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Attempts to infer a referral procedure from free text (scan type name + specific details).
 * Returns null when we can't confidently map to one of the configured fee buckets.
 */
export function inferReferralProcedure(text: string): { key: ReferralProcedureKey; label: string; amountGhs: number } | null {
  const t = normalizeText(text);
  if (!t) return null;

  // 1. Fixed Price Anomalies (Anomalies take precedence)
  
  // X-Rays (Any type) -> 15 GHS
  if (t.includes('xray') || t.includes('x-ray') || t.includes('x ray')) {
    return { key: 'xray', ...REFERRAL_FEES_GHS.xray };
  }

  // Echocardiogram -> 50 GHS
  if (t.includes('echocardiogram') || t.includes('echocardiography') || t.includes('echo')) {
    return { key: 'echocardiogram', ...REFERRAL_FEES_GHS.echocardiogram };
  }

  // ECG -> 20 GHS
  if (t.includes('ecg') || t.includes('electrocardiogram') || t.includes('electrocardiography')) {
    return { key: 'ecg', ...REFERRAL_FEES_GHS.ecg };
  }

  // CT Head, CT Chest, HSG, Mammography, Endoscopy -> 50 GHS
  if (t.includes('hsg')) return { key: 'hsg', ...REFERRAL_FEES_GHS.hsg };
  if (t.includes('mammography') || t.includes('mammogram')) return { key: 'mammography', ...REFERRAL_FEES_GHS.mammography };
  if (t.includes('endoscopy')) return { key: 'endoscopy', ...REFERRAL_FEES_GHS.endoscopy };
  
  // CT Specifics
  const isCT = /\bct\b/.test(t) || t.includes('computed tomography') || t.includes('c t');
  
  if (isCT) {
    // CT Abdomen, CT Angiography -> 70 GHS
    if (t.includes('abdomen') || t.includes('abdominal')) return { key: 'ct_abdomen', ...REFERRAL_FEES_GHS.ct_abdomen };
    if (t.includes('angiography') || t.includes('angio')) return { key: 'ct_angiography', ...REFERRAL_FEES_GHS.ct_angiography };
    
    // CT Head, CT Chest -> 50 GHS
    if (t.includes('head') || t.includes('brain') || t.includes('skull')) return { key: 'ct_head', ...REFERRAL_FEES_GHS.ct_head };
    if (t.includes('chest') || t.includes('thorax') || t.includes('thoracic')) return { key: 'ct_chest', ...REFERRAL_FEES_GHS.ct_chest };

    // Default for any CT scan -> 50 GHS
    return { key: 'ct_generic', ...REFERRAL_FEES_GHS.ct_generic };
  }

  return null;
}

/**
 * Calculates the total payout for an appointment based on its scan types and details.
 * Shared between booking confirmation and the referrals screen.
 */
export function calculateReferralPayout(appointment: any): { total: number; items: { label: string; amountGhs: number; key: string }[] } {
  if (!appointment) return { total: 0, items: [] };

  // 1. Gather all possible scan/service sources
  let scanTypesArr: any[] = [];
  if (Array.isArray(appointment.services)) {
    scanTypesArr = appointment.services;
  } else if (Array.isArray(appointment.scanTypes)) {
    scanTypesArr = appointment.scanTypes;
  } else if (appointment.scanType) {
    scanTypesArr = [appointment.scanType];
  } else if (appointment.scans && Array.isArray(appointment.scans)) {
    scanTypesArr = appointment.scans;
  }

  const specificDetails = appointment.specificProcedure || appointment.specificScan || appointment.specificScanDetails || appointment.notes || '';
  const procedureName = appointment.procedureName || appointment.serviceName || '';
  
  const matchedKeys = new Set<string>();
  const items: { label: string; amountGhs: number; key: string }[] = [];

  // 2. Process explicit scan/service types
  for (const s of scanTypesArr) {
    const scanName = s?.name || s?.id || s?.label || s?.serviceName || 'Procedure';
    const textToMatch = `${scanName} ${specificDetails} ${procedureName}`.trim();
    
    const match = inferReferralProcedure(textToMatch);
    let amount = 0;
    let label = scanName;
    let key = s?.id || scanName || Math.random().toString();

    if (match) {
      amount = match.amountGhs;
      label = match.label;
      key = match.key;
    } else {
      // EXTREMELY aggressive price extraction
      let price = 0;
      if (s) {
        price = Number(s.price) || Number(s.Price) || Number(s.priceGhs) || Number(s.amount) || Number(s.cost) || 0;
      }
      
      // If s didn't have it, look at the main appointment object for this item
      if (price === 0) {
        price = Number(appointment.procedurePriceGhs) || Number(appointment.price) || Number(appointment.priceGhs) || Number(appointment.totalPrice) || Number(appointment.amount) || 0;
      }
      
      // If price is still 0, try to extract from string
      if (price === 0 && typeof scanName === 'string') {
        const found = scanName.match(/\d+/);
        if (found) price = Number(found[0]);
      }

      amount = Math.round(price * 0.07);
      
      // Prioritize the specific procedure/scan name for the UI label
      label = appointment.specificProcedure || appointment.specificScan || appointment.specificScanDetails || scanName;
    }

    if (!matchedKeys.has(key)) {
      matchedKeys.add(key);
      items.push({ label, amountGhs: amount, key });
    }
  }

  // 3. Fallback: If no items found yet
  if (items.length === 0) {
    let mainPrice = Number(appointment.procedurePriceGhs) || Number(appointment.price) || Number(appointment.priceGhs) || Number(appointment.totalPrice) || Number(appointment.amount) || 0;
    
    if (mainPrice === 0) {
      const fallbackText = `${procedureName} ${specificDetails}`.trim();
      const found = fallbackText.match(/\d+/);
      if (found) mainPrice = Number(found[0]);
    }

    if (mainPrice > 0 || procedureName || appointment.specificProcedure) {
      const amount = Math.round(mainPrice * 0.07);
      const label = appointment.specificProcedure || appointment.specificScan || procedureName || 'General Procedure';
      items.push({ label, amountGhs: amount, key: 'general_fallback' });
    }
  }

  const total = items.reduce((sum, i) => sum + i.amountGhs, 0);
  console.log(`[ReferralCalc] Appt: ${appointment.id}, Total Items: ${items.length}, Total Amount: ${total}`);
  return { total, items };
}

export async function createReferral(referral: Omit<Referral, 'id' | 'createdAt' | 'updatedAt'>) {
  const payload = {
    ...referral,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as any;
  const ref = await addDoc(referralsCol(), payload);
  return ref.id;
}

export async function listReferralsByDoctor(doctorId: string) {
  try {
    const q = query(referralsCol(), where('doctorId', '==', doctorId), orderBy('createdAt', 'desc'));
    const snaps = await getDocs(q);
    return snaps.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) } as Referral));
  } catch (err: any) {
    // If Firestore requires a composite index, fall back to an unordered query and sort client-side.
    const msg = err?.message || '';
    if (typeof msg === 'string' && msg.toLowerCase().includes('index')) {
      const q2 = query(referralsCol(), where('doctorId', '==', doctorId));
      const snaps2 = await getDocs(q2);
      const items = snaps2.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) } as Referral));
      items.sort((a: any, b: any) => {
        const aVal = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const bVal = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return bVal - aVal;
      });
      return items;
    }
    throw err;
  }
}

export function subscribeToReferralsByDoctor(
  doctorId: string,
  cb: (items: Referral[]) => void,
  onError?: (err: any) => void
) {
  // Avoid composite-index requirements by sorting client-side.
  const q = query(referralsCol(), where('doctorId', '==', doctorId));
  return onSnapshot(
    q,
    (snap: any) => {
      const items = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) } as Referral));
      items.sort((a: any, b: any) => {
        const aVal = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const bVal = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return bVal - aVal;
      });
      cb(items);
    },
    onError
  );
}
