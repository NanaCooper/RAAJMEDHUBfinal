require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function normalizeText(input) {
  return (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let commissionCache = {};

async function load() {
  const q = query(collection(db, 'procedure_commissions'));
  const snaps = await getDocs(q);
  snaps.forEach(doc => {
    const data = doc.data();
    if (data.procedureName && data.branch) {
      const key = `${normalizeText(data.branch)}_${normalizeText(data.procedureName)}`;
      commissionCache[key] = { priceGhs: Number(data.priceGhs), commissionGhs: Number(data.commissionGhs) };
    }
  });
  console.log('Loaded', Object.keys(commissionCache).length, 'records');
  
  // Test lookup
  console.log('Test 1:', lookupProcedureCommission('Xray', 'Koforidua'));
  console.log('Test 2:', lookupProcedureCommission('CT Brain', 'Takoradi'));
  console.log('Test 3:', lookupProcedureCommission('chest x-ray', 'Takoradi'));
  console.log('Test 4:', lookupProcedureCommission('CT Head', 'All'));
  
  process.exit(0);
}

function lookupProcedureCommission(text, branch) {
  const t = normalizeText(text);
  const b = normalizeText(branch);
  if (!t) return null;

  const searchForBranch = (searchBranch) => {
    const exactKey = `${searchBranch}_${t}`;
    if (commissionCache[exactKey] !== undefined) {
      return commissionCache[exactKey];
    }
    let bestMatch = null;
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

  let match = searchForBranch(b);
  if (!match && b !== 'all') {
    match = searchForBranch('all');
  }
  return match;
}

load();
