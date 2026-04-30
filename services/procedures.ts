import { db, collection, getDocs } from '../utils/firebaseConfig';

export interface ProcedureItem {
  id: string;
  name: string;
  price: number | null;
  category?: string;
}

let procedureCache: ProcedureItem[] | null = null;

/**
 * Maps our internal scan-card IDs to the category strings stored in Firestore.
 * Adjust these strings to match exactly what is stored in your `procedures`
 * collection's `category` field.
 */
const CATEGORY_MAP: Record<string, string[]> = {
  ultrasound: ['ultrasound'],
  mammogram: ['mammogram'],
  ct: ['ct scan', 'ct_scan', 'ct-scan', 'ctscan'],
  xray: ['x-ray', 'x_ray', 'xray', 'x ray'],
  mri: ['mri'],
  others: ['others', 'other'],
};

export interface ProcedurePriceRange {
  min: number | null;
  max: number | null;
}

export interface ProcedureMinPrices {
  [scanId: string]: ProcedurePriceRange;
}

/**
 * Fetches all documents from the `procedures` collection in Firestore and
 * returns the **lowest and highest price** found for each scan-card category.
 *
 * Each procedure document is expected to have at least:
 *   - `category` : string  (e.g. "ultrasound", "ct scan", "mri" …)
 *   - `price`    : number  (in GHS)
 *
 * Falls back gracefully — if a category has no matching procedures both values
 * remain `null` so the UI can display hardcoded fallbacks.
 */
export async function fetchMinPricesPerCategory(): Promise<ProcedureMinPrices> {
  const prices: ProcedureMinPrices = {
    ultrasound: { min: null, max: null },
    mammogram:  { min: null, max: null },
    ct:         { min: null, max: null },
    xray:       { min: null, max: null },
    mri:        { min: null, max: null },
    others:     { min: null, max: null },
  };

  try {
    const proceduresCol = collection(db, 'procedures');
    const snap = await getDocs(proceduresCol);

    if (snap.empty) return prices;

    snap.forEach((docSnap: any) => {
      const data = docSnap.data();
      const rawCategory: string = (data.category ?? '').toLowerCase().trim();
      const price: number = Number(data.price);

      if (!rawCategory || isNaN(price) || price <= 0) return;

      // Match the raw category to one of our scan-card IDs
      for (const [scanId, aliases] of Object.entries(CATEGORY_MAP)) {
        if (aliases.some((alias) => rawCategory.includes(alias) || alias.includes(rawCategory))) {
          const range = prices[scanId];
          if (range.min === null || price < range.min) range.min = price;
          if (range.max === null || price > range.max) range.max = price;
          break;
        }
      }
    });
  } catch (err) {
    console.warn('[procedures] Failed to fetch procedure prices:', err);
  }

  return prices;
}

/**
 * Fetches all procedures from Firestore `procedures` collection for pickers/search.
 * The data model in Firestore can vary; we normalize to {id, name, price, category}.
 */
export async function listAllProcedures(forceRefresh = false): Promise<ProcedureItem[]> {
  if (!forceRefresh && Array.isArray(procedureCache)) return procedureCache;

  const out: ProcedureItem[] = [];

  const parsePrice = (value: any): number | null => {
    if (value == null) return null;
    if (typeof value === 'number') return isFinite(value) && value > 0 ? value : null;
    if (typeof value === 'string') {
      const s = value.trim();
      // Accept strings like "1200", "1,200", "GHS 1,200"
      const cleaned = s.replace(/[^0-9.]/g, '');
      if (!cleaned) return null;
      const n = Number(cleaned);
      return isFinite(n) && n > 0 ? n : null;
    }
    if (typeof value === 'object') {
      // Common nested formats: { ghs: 50 } or { amount: 50 }
      const nestedCandidates = [value.ghs, value.amount, value.value, value.price];
      for (const c of nestedCandidates) {
        const parsed = parsePrice(c);
        if (parsed != null) return parsed;
      }
    }
    return null;
  };

  const pickPrice = (data: any): number | null => {
    const candidates = [
      data.price,
      data.amount,
      data.cost,
      data.fee,
      data.rate,
      data.priceGhs,
      data.procedurePrice,
      data.procedurePriceGhs,
      data.ghs,
    ];
    for (const c of candidates) {
      const parsed = parsePrice(c);
      if (parsed != null) return parsed;
    }
    return null;
  };

  try {
    const proceduresCol = collection(db, 'procedures');
    const snap = await getDocs(proceduresCol);
    snap.forEach((docSnap: any) => {
      const data = docSnap.data();
      const price = pickPrice(data);
      const name =
        (data.name || data.procedureName || data.type || data.specificScan || docSnap.id || '')
          .toString()
          .trim();
      const category = (data.category ?? '').toString().trim() || undefined;

      if (!name) return;

      out.push({
        id: docSnap.id,
        name,
        price,
        category,
      });
    });
  } catch (err) {
    console.warn('[procedures] listAllProcedures error:', err);
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  procedureCache = out;
  return out;
}

/**
 * Looks up the actual price for a specific procedure name from Firestore.
 * Tries to match the given name against the `name`, `specificScan`, and `category`
 * fields of every document in the `procedures` collection.
 *
 * Strategy:
 *  1. Exact name match (case-insensitive)
 *  2. The document name is contained in the search term (handles long specific names)
 *  3. The search term is contained in the document name
 *  4. Word-level overlap (≥ 2 shared words)
 *
 * Returns a formatted string like "GHS 1,200" or null if nothing matches.
 */
export async function fetchProcedurePrice(scanName: string): Promise<string | null> {
  try {
    const proceduresCol = collection(db, 'procedures');
    const snap = await getDocs(proceduresCol);
    if (snap.empty) return null;

    const needle = scanName.toLowerCase().trim();
    // Include words of length >= 2 so short but important words like "ct" and "mr" are not dropped
    const needleWords = needle.split(/[\s\-\/,()]+/).filter(w => w.length >= 2);
    // Stop words to exclude from scoring (they're too common and cause false positives)
    const STOP = new Set(['and', 'the', 'for', 'with', 'of', 'in', 'to', 'a', 'an', 'or']);
    const meaningfulNeedle = needleWords.filter(w => !STOP.has(w));

    let bestPrice: number | null = null;
    let bestScore = 0;
    let fallbackPrice: number | null = null; // category-level fallback

    snap.forEach((docSnap: any) => {
      const data = docSnap.data();
      const price = Number(data.price);
      if (isNaN(price) || price <= 0) return;

      // Build a list of text fields to try
      const candidates: string[] = [
        data.name,
        data.specificScan,
        data.category,
        data.type,
        data.procedureName,
        docSnap.id,           // document ID sometimes holds the name
      ]
        .filter(Boolean)
        .map((s: string) => s.toLowerCase().trim());

      for (const candidate of candidates) {
        let score = 0;

        if (candidate === needle) {
          score = 100; // exact match
        } else if (needle.includes(candidate) || candidate.includes(needle)) {
          score = 80;
        } else {
          const candidateWords = candidate.split(/[\s\-\/,()]+/).filter(w => w.length >= 2);
          const meaningfulCandidate = candidateWords.filter(w => !STOP.has(w));
          const shared = meaningfulNeedle.filter(w => meaningfulCandidate.includes(w)).length;
          // Require at least 1 shared meaningful word for a match
          if (shared >= 1) score = shared * 15;
        }

        if (score > bestScore) {
          bestScore = score;
          bestPrice = price;
        }
      }

      // Category fallback: if the procedure's category is a broad match
      // (e.g. "ct scan" matches an appointment name that starts with "ct scan")
      const rawCategory = (data.category ?? '').toLowerCase().trim();
      if (rawCategory && needle.startsWith(rawCategory)) {
        if (fallbackPrice === null) fallbackPrice = price;
      }
    });

    // Use specific match if found (score > 0), otherwise try category fallback
    const finalPrice = bestScore > 0 ? bestPrice : fallbackPrice;
    if (finalPrice === null) return null;
    return `GHS ${(finalPrice as number).toLocaleString()}`;
  } catch (err) {
    console.warn('[procedures] fetchProcedurePrice error:', err);
    return null;
  }
}
