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

// ─────────────────────────────────────────────────────────────────────────────
// Referral Fee Tables (GHS) — fixed per-procedure commissions
// ─────────────────────────────────────────────────────────────────────────────

export const REFERRAL_FEES_GHS: Record<ReferralProcedureKey, { label: string; amountGhs: number }> = {
  xray:            { label: 'X-Ray',           amountGhs: 15  },
  ct_head:         { label: 'CT Head',          amountGhs: 50  },
  ct_chest:        { label: 'CT Chest',         amountGhs: 50  },
  hsg:             { label: 'HSG',              amountGhs: 50  },
  mammography:     { label: 'Mammography',      amountGhs: 50  },
  endoscopy:       { label: 'Endoscopy',        amountGhs: 50  },
  ct_abdomen:      { label: 'CT Abdomen',       amountGhs: 70  },
  ct_angiography:  { label: 'CT Angiography',   amountGhs: 70  },
  echocardiogram:  { label: 'Echocardiogram',   amountGhs: 50  },
  ecg:             { label: 'ECG',              amountGhs: 20  },
  ct_generic:      { label: 'CT Scan',          amountGhs: 50  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Commission Cache from Firestore
// ─────────────────────────────────────────────────────────────────────────────
let commissionCache: Record<string, { priceGhs: number; commissionGhs: number }> = {};
let commissionsLoaded = false;

export async function loadProcedureCommissions() {
  if (commissionsLoaded) return;
  try {
    const q = query(collection(db, 'procedure_commissions'));
    const snaps = await getDocs(q);
    const newCache: Record<string, { priceGhs: number; commissionGhs: number }> = {};
    snaps.forEach(doc => {
      const data = doc.data();
      if (data.procedureName && data.branch) {
        // Key format: 'takoradi_ct scan - head (trauma)'
        const key = `${normalizeText(data.branch)}_${normalizeText(data.procedureName)}`;
        newCache[key] = { priceGhs: Number(data.priceGhs), commissionGhs: Number(data.commissionGhs) };
      }
    });
    commissionCache = newCache;
    commissionsLoaded = true;
    console.log('[Referrals] Loaded', Object.keys(commissionCache).length, 'commission records from Firestore');
  } catch (err) {
    console.error('[Referrals] Failed to load procedure commissions', err);
  }
}

/**
 * Looks up specific procedure commission by name and branch from cache.
 * It will first look for an exact branch match, and if not found, fallback to the 'All' branch.
 * Returns the commission in GHS or null if not found.
 */
export function lookupProcedureCommission(text: string, branch: string): { priceGhs: number, commissionGhs: number } | null {
  const t = normalizeText(text);
  const b = normalizeText(branch);
  if (!t) return null;

  // Function to search within a specific branch
  const searchForBranch = (searchBranch: string) => {
    // 1. Exact match
    const exactKey = `${searchBranch}_${t}`;
    if (commissionCache[exactKey] !== undefined) {
      return commissionCache[exactKey];
    }

    // 2. Starts-with / contains match (longest key wins)
    let bestMatch: { priceGhs: number, commissionGhs: number } | null = null;
    let bestKeyLen = 0;
    for (const [key, data] of Object.entries(commissionCache)) {
      const [cacheBranch, cacheProc] = key.split('_');
      if (cacheBranch === searchBranch) {
        if (t.includes(cacheProc) || cacheProc.includes(t)) {
          if (cacheProc.length > bestKeyLen) {
            bestKeyLen = cacheProc.length;
            bestMatch = data;
          }
        }
      }
    }
    return bestMatch;
  };

  // 1. Check exact branch
  let match = searchForBranch(b);
  // 2. If no match and branch is not 'all', check 'all'
  if (!match && b !== 'all') {
    match = searchForBranch('all');
  }

  return match;
}

const referralsCol = () => collection(db, 'referrals');

function normalizeText(input: string) {
  return (input || '')
    .toLowerCase()
    .replace(/x-ray/g, 'xray')
    .replace(/x ray/g, 'xray')
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

// Minimum fallback commission when procedure cannot be identified (GHS)
const MINIMUM_REFERRAL_COMMISSION = 15;

/**
 * Calculates the total payout for an appointment based on its scan types and details.
 * Shared between booking confirmation and the referrals screen.
 * Priority:
 *   1. Named procedure fee lookup (REFERRAL_FEES_GHS)
 *   2. Dynamic commission lookup from Firestore cache
 *   3. Explicit price field on appointment → 7% commission
 */
export function calculateReferralPayout(appointment: any): { total: number; items: { label: string; amountGhs: number; key: string }[] } {
  if (!appointment) return { total: 0, items: [] };

  const branch = (appointment.branch || '').toLowerCase();

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
      // Try branch-specific dynamic commission lookup
      if (branch) {
        const commissionMatch = lookupProcedureCommission(textToMatch, branch);
        if (commissionMatch && commissionMatch.commissionGhs > 0) {
          amount = commissionMatch.commissionGhs;
          label = appointment.specificProcedure || appointment.specificScan || scanName;
        }
      }

      // Try price field on the item itself → 7% commission (fallback)
      if (amount === 0) {
        let price = 0;
        if (s) {
          price = Number(s.price) || Number(s.Price) || Number(s.priceGhs) || Number(s.amount) || Number(s.cost) || 0;
        }
        if (price === 0) {
          price = Number(appointment.procedurePriceGhs) || Number(appointment.price) || Number(appointment.priceGhs) || Number(appointment.totalPrice) || Number(appointment.amount) || 0;
        }
        if (price === 0 && typeof scanName === 'string') {
          const found = scanName.match(/\d+/);
          if (found) price = Number(found[0]);
        }
        if (price > 0) {
          amount = Math.round(price * 0.07);
        }
      }

      // Fallback to minimum referral commission so it never shows GHS 0
      if (amount === 0) {
        amount = MINIMUM_REFERRAL_COMMISSION;
      }

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

    // Try dynamic commission lookup for the general procedure name
    if (mainPrice === 0 && branch) {
      const fallbackText = `${procedureName} ${specificDetails}`.trim();
      const commissionMatch = lookupProcedureCommission(fallbackText, branch);
      if (commissionMatch) mainPrice = commissionMatch.commissionGhs;
    }

    if (mainPrice > 0 || procedureName || appointment.specificProcedure) {
      // If we found an exact commission match, mainPrice is actually the commission amount.
      // We check if it matches a branch fallback. If yes, it's already the commission.
      // Otherwise we take 7%.
      let amount = 0;
      const fallbackText = `${procedureName} ${specificDetails}`.trim();
      const commissionMatch = lookupProcedureCommission(fallbackText, branch);
      
      if (commissionMatch) {
        amount = commissionMatch.commissionGhs;
      } else if (mainPrice > 0) {
        amount = Math.round(mainPrice * 0.07);
      }
      
      const label = appointment.specificProcedure || appointment.specificScan || procedureName || 'General Procedure';
      items.push({ label, amountGhs: amount, key: 'general_fallback' });
    }
  }

  const total = items.reduce((sum, i) => sum + i.amountGhs, 0);
  console.log(`[ReferralCalc] Appt: ${appointment.id}, Branch: ${branch}, Total Items: ${items.length}, Total Amount: ${total}`);
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
