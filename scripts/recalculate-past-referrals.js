require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, updateDoc, query } = require('firebase/firestore');

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
    .replace(/x-ray/g, 'xray')
    .replace(/x ray/g, 'xray')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let commissionCache = {};

async function run() {
  console.log('Loading procedure commissions...');
  const q = query(collection(db, 'procedure_commissions'));
  const snaps = await getDocs(q);
  snaps.forEach(d => {
    const data = d.data();
    if (data.procedureName && data.branch) {
      const key = `${normalizeText(data.branch)}_${normalizeText(data.procedureName)}`;
      commissionCache[key] = { priceGhs: Number(data.priceGhs), commissionGhs: Number(data.commissionGhs) };
    }
  });
  console.log(`Loaded ${Object.keys(commissionCache).length} commissions.`);

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

  console.log('Fetching all referrals...');
  const referralsSnap = await getDocs(collection(db, 'referrals'));
  console.log(`Found ${referralsSnap.size} referrals.`);

  let updatedCount = 0;

  for (const referralDoc of referralsSnap.docs) {
    const referral = referralDoc.data();
    const appointmentId = referral.appointmentId;
    const currentAmount = referral.amountGhs;
    
    if (!appointmentId) continue;

    const apptDoc = await getDoc(doc(db, 'appointments', appointmentId));
    if (!apptDoc.exists()) {
      continue;
    }
    
    const appt = apptDoc.data();
    const branch = appt.branch || 'all';
    const price = Number(appt.priceGhs) || Number(appt.price) || 0;
    
    const match = lookupProcedureCommission(referral.procedureLabel || referral.procedureKey || '', branch);
    
    let expectedAmount = 0;
    if (match) {
      expectedAmount = match.commissionGhs;
    } else {
      expectedAmount = Math.round(price * 0.07);
    }
    
    if (expectedAmount !== currentAmount) {
      console.log(`Updating referral ${referralDoc.id}: ${currentAmount} -> ${expectedAmount} (${referral.procedureLabel}, branch: ${branch}, price: ${price})`);
      await updateDoc(doc(db, 'referrals', referralDoc.id), { amountGhs: expectedAmount });
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} referrals.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
