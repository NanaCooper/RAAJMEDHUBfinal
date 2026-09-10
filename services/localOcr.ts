/**
 * localOcr.ts
 *
 * On-device OCR + rule-based field extraction.
 * Uses Google ML Kit Text Recognition (@react-native-ml-kit/text-recognition)
 * which runs 100% on the device — NO external API key required.
 *
 * Extracts the same fields as the old Gemini service:
 *   patientName, age, sex, patientPhone, doctorName,
 *   referralSource, scanTypes (array), specificScan, reasonForVisit, date
 */

import TextRecognition from '@react-native-ml-kit/text-recognition';

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface ExtractedFormData {
  patientName:    string;
  age:            string;
  sex:            string;
  patientPhone:   string;
  doctorName:     string;
  referralSource: string;
  scanTypes:      string[];
  specificScan:   string;
  reasonForVisit: string;
  date:           string;
}

// ─── Scan Type Keyword Maps ──────────────────────────────────────────────────

const SCAN_KEYWORDS: { pattern: RegExp; canonical: string }[] = [
  { pattern: /\b(ct|cat|computed.?tomography)\b/i,  canonical: 'CT Scan'    },
  { pattern: /\b(x.?ray|xray|radiograph)\b/i,        canonical: 'X-Ray'     },
  { pattern: /\b(usg?|u\/s|ultrasound|sonograph)\b/i, canonical: 'Ultrasound' },
  { pattern: /\b(mri|magnetic.?resonance)\b/i,       canonical: 'MRI'       },
  { pattern: /\b(mammogram|mammograph|mammo)\b/i,    canonical: 'Mammogram'  },
  { pattern: /\b(ecg|electrocardiogram|ekg)\b/i,     canonical: 'ECG'       },
  { pattern: /\b(echo|echocardiogram)\b/i,           canonical: 'Echocardiogram' },
  { pattern: /\b(endoscopy|upper.?gi|lower.?gi)\b/i, canonical: 'Endoscopy' },
  { pattern: /\b(hsg|hysterosalpingograph)\b/i,      canonical: 'HSG'       },
  { pattern: /\b(blood.?test|lab|haematology|fbc|rbs|bmp|cmp)\b/i, canonical: 'Blood Test' },
];

// ─── Gender patterns ─────────────────────────────────────────────────────────

const MALE_PATTERN   = /\b(m|male|gentleman|man|boy|mr\.?)\b/i;
const FEMALE_PATTERN = /\b(f|female|lady|woman|girl|mrs\.?|ms\.?|miss)\b/i;

// ─── Date patterns ───────────────────────────────────────────────────────────

const DATE_PATTERNS = [
  /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/, // DD/MM/YYYY or MM/DD/YYYY
  /\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/,   // YYYY-MM-DD
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Clean a captured group value. Strip leading labels and punctuation. */
const cleanCapture = (raw: string): string =>
  raw.replace(/^[:\s\-]+/, '').trim();

/** Deduplicate arrays preserving order. */
const unique = <T>(arr: T[]): T[] => [...new Set(arr)];

/** Normalize text for searching. */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Extract patient name. Looks for common form labels:
 * "Name:", "Patient:", "Pt:", "Full Name:", "Mr/Mrs/Ms/Miss <Name>"
 */
function extractName(lines: string[]): string {
  const nameLabelRe  = /(?:patient|pt|full.?name|name)\s*:?\s*(.+)/i;
  const titleRe      = /\b(?:mr|mrs|ms|miss|dr)\b\.?\s+([A-Za-z]+(?: [A-Za-z]+){1,3})/i;

  for (const line of lines) {
    const m = line.match(nameLabelRe);
    if (m && m[1] && cleanCapture(m[1]).length > 2) {
      return cleanCapture(m[1]).replace(/\s+/g, ' ').substring(0, 60);
    }
  }
  for (const line of lines) {
    const m = line.match(titleRe);
    if (m && m[1] && m[1].trim().length > 2) {
      return m[1].trim().replace(/\s+/g, ' ');
    }
  }
  return '';
}

/**
 * Extract age. Patterns: "Age: 34", "34 yrs", "34y", "34years", DOB → calculate.
 */
function extractAge(lines: string[]): string {
  const ageLabelRe = /\bage\s*:?\s*(\d{1,3})\b/i;
  const ageInlineRe = /\b(\d{1,3})\s*(?:yrs?|years?|y\/o|yo)\b/i;
  const dobRe       = /\b(?:dob|date.?of.?birth)\s*:?\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i;

  for (const line of lines) {
    let m = line.match(ageLabelRe);
    if (m) return m[1];

    m = line.match(ageInlineRe);
    if (m) return m[1];

    m = line.match(dobRe);
    if (m) {
      const yearRaw = m[3];
      const year = yearRaw.length === 2 ? 2000 + parseInt(yearRaw) : parseInt(yearRaw);
      const age = new Date().getFullYear() - year;
      if (age > 0 && age < 130) return String(age);
    }
  }
  return '';
}

/**
 * Extract sex/gender from lines.
 */
function extractSex(lines: string[]): string {
  const genderLabelRe = /\b(?:sex|gender)\s*:?\s*(m|f|male|female|other)/i;
  for (const line of lines) {
    const m = line.match(genderLabelRe);
    if (m) {
      const raw = norm(m[1]);
      if (raw.startsWith('f')) return 'Female';
      if (raw.startsWith('m')) return 'Male';
    }
  }
  // scan all lines for isolated tokens
  for (const line of lines) {
    if (FEMALE_PATTERN.test(line)) return 'Female';
    if (MALE_PATTERN.test(line))   return 'Male';
  }
  return '';
}

/**
 * Extract phone. Ghana: 10-digit starting 0, or +233.
 */
function extractPhone(lines: string[]): string {
  const ghanaRe    = /(?:\+233|0)(\d{9})/;
  const genericRe  = /\b(\d{10,13})\b/;
  const phoneLabelRe = /\b(?:phone|tel|contact|mobile|cel)\s*:?\s*([\d\s\(\)\+\-]+)/i;

  for (const line of lines) {
    const labelMatch = line.match(phoneLabelRe);
    if (labelMatch) {
      const digits = labelMatch[1].replace(/\D/g, '');
      if (digits.length >= 10) return digits.substring(0, 13);
    }
  }
  for (const line of lines) {
    let m = line.match(ghanaRe);
    if (m) return '0' + m[1];
    m = line.match(genericRe);
    if (m && m[1].length >= 10) return m[1];
  }
  return '';
}

/**
 * Extract the referring doctor name. Looks for "Dr." patterns,
 * "Requested by", "Ref. by", "Referred by", "Attending".
 */
function extractDoctorName(lines: string[]): string {
  const drLabelRe  = /\b(?:ref(?:erred)?.?by|requested.?by|attending|physician|referred|consultant)\s*:?\s*(dr\.?\s*[A-Za-z]+(?: [A-Za-z]+){0,3})/i;
  const drInlineRe = /\b(dr\.?\s+[A-Za-z]+(?: [A-Za-z]+){0,3})/i;

  for (const line of lines) {
    const m = line.match(drLabelRe);
    if (m && m[1]) return m[1].trim();
  }
  for (const line of lines) {
    const m = line.match(drInlineRe);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

/**
 * Extract referral source (hospital/clinic name).
 */
function extractReferralSource(lines: string[]): string {
  const refLabelRe  = /\b(?:from|referral|referred.?from|clinic|hospital|facility)\s*:?\s*(.+)/i;
  const letterheadRe = /\b(?:hospital|clinic|centre|center|health|medical|diagnostic)\b/i;

  for (const line of lines) {
    const m = line.match(refLabelRe);
    if (m && m[1] && cleanCapture(m[1]).length > 2) {
      return cleanCapture(m[1]).substring(0, 80);
    }
  }
  // First line with a healthcare-facility keyword is often the letterhead
  for (const line of lines.slice(0, 6)) {
    if (letterheadRe.test(line) && line.trim().length > 4) {
      return line.trim().substring(0, 80);
    }
  }
  return '';
}

/**
 * Detect all scan types mentioned across the full text.
 */
function extractScanTypes(text: string): string[] {
  const found: string[] = [];
  for (const { pattern, canonical } of SCAN_KEYWORDS) {
    if (pattern.test(text)) found.push(canonical);
  }
  return unique(found);
}

/**
 * Extract the specific scan / procedure detail.
 * E.g. "CT Scan — Head with contrast", "USG Abdomen & Pelvis".
 */
function extractSpecificScan(lines: string[]): string {
  const specLabelRe = /\b(?:procedure|investigation|scan|study|for|request(?:ed)?)\s*:?\s*(.+)/i;
  for (const line of lines) {
    const m = line.match(specLabelRe);
    if (m && m[1] && cleanCapture(m[1]).length > 3) {
      return cleanCapture(m[1]).substring(0, 120);
    }
  }
  // Fallback: first line that contains a scan keyword + body part word
  const bodyPartRe = /\b(head|brain|chest|abdomen|pelvis|neck|spine|knee|shoulder|hip|liver|thyroid|breast|anomaly)\b/i;
  for (const line of lines) {
    if (SCAN_KEYWORDS.some(({ pattern }) => pattern.test(line)) && bodyPartRe.test(line)) {
      return line.trim().substring(0, 120);
    }
  }
  return '';
}

/**
 * Extract reason / clinical indication.
 */
function extractReason(lines: string[]): string {
  const reasonLabelRe = /\b(?:reason|indication|clinical|history|diagnosis|complaint|c\/o|h\/o|impression)\s*:?\s*(.+)/i;
  for (const line of lines) {
    const m = line.match(reasonLabelRe);
    if (m && m[1] && cleanCapture(m[1]).length > 2) {
      return cleanCapture(m[1]).substring(0, 200);
    }
  }
  return '';
}

/**
 * Extract date from text.
 */
function extractDate(lines: string[]): string {
  const dateLabelRe = /\b(?:date|request.?date|referral.?date)\s*:?\s*([\d\/\-\.]+)/i;
  for (const line of lines) {
    const m = line.match(dateLabelRe);
    if (m && m[1]) {
      return m[1].trim();
    }
  }
  for (const line of lines) {
    for (const pat of DATE_PATTERNS) {
      const m = line.match(pat);
      if (m) return m[0];
    }
  }
  return '';
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Runs Google ML Kit on-device OCR on the given image URI,
 * then parses the extracted text into structured form fields.
 *
 * @param imageUri  Local file URI (e.g., from expo-image-picker)
 * @returns         Structured ExtractedFormData object
 */
export async function extractDetailsFromImageLocal(imageUri: string): Promise<ExtractedFormData> {
  // 1. Run ML Kit OCR (on-device, no network required)
  const result = await TextRecognition.recognize(imageUri);

  // 2. Get all text as a flat string and as individual lines
  const fullText = result.text || '';
  const lines    = fullText.split('\n').map(l => l.trim()).filter(Boolean);

  console.log('[LocalOCR] Recognized', lines.length, 'lines of text');

  // 3. Parse each field using the rule-based extractors
  return {
    patientName:    extractName(lines),
    age:            extractAge(lines),
    sex:            extractSex(lines),
    patientPhone:   extractPhone(lines),
    doctorName:     extractDoctorName(lines),
    referralSource: extractReferralSource(lines),
    scanTypes:      extractScanTypes(fullText),
    specificScan:   extractSpecificScan(lines),
    reasonForVisit: extractReason(lines),
    date:           extractDate(lines),
  };
}
