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

  // Non-CT procedures
  if (t.includes('xray') || t.includes('x-ray') || t.includes('x ray')) return { key: 'xray', ...REFERRAL_FEES_GHS.xray };
  if (t.includes('hsg')) return { key: 'hsg', ...REFERRAL_FEES_GHS.hsg };
  if (t.includes('mammography') || t.includes('mammogram')) return { key: 'mammography', ...REFERRAL_FEES_GHS.mammography };
  if (t.includes('endoscopy')) return { key: 'endoscopy', ...REFERRAL_FEES_GHS.endoscopy };

  // CT procedures
  const isCT = t.includes('ct') || t.includes('c t') || t.includes('computed tomography');
  if (!isCT) return null;

  if (t.includes('angiography') || t.includes('angio')) return { key: 'ct_angiography', ...REFERRAL_FEES_GHS.ct_angiography };
  if (t.includes('abdomen') || t.includes('abdominal')) return { key: 'ct_abdomen', ...REFERRAL_FEES_GHS.ct_abdomen };
  if (t.includes('chest') || t.includes('thorax') || t.includes('thoracic')) return { key: 'ct_chest', ...REFERRAL_FEES_GHS.ct_chest };
  if (t.includes('head') || t.includes('brain') || t.includes('skull')) return { key: 'ct_head', ...REFERRAL_FEES_GHS.ct_head };

  // Unknown CT subtype → no payout mapping configured
  return null;
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
