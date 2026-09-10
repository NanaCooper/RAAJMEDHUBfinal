require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query, where, writeBatch, doc } = require('firebase/firestore');

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

const koforiduaCommissions = [
  {"procedureName": "Xray", "commissionGhs": 60},
  {"procedureName": "Mammo", "commissionGhs": 100},
  {"procedureName": "HSG", "commissionGhs": 100},
  {"procedureName": "Echo", "commissionGhs": 100},
  {"procedureName": "Barium", "commissionGhs": 100},
  {"procedureName": "Fistulogram", "commissionGhs": 100},
  {"procedureName": "RUG", "commissionGhs": 100},
  {"procedureName": "MCUG", "commissionGhs": 100},
  {"procedureName": "ECG", "commissionGhs": 30},
  {"procedureName": "Pelvic USG", "commissionGhs": 30},
  {"procedureName": "Breast USG", "commissionGhs": 30},
  {"procedureName": "Neck / thyroid USG", "commissionGhs": 30},
  {"procedureName": "Pap smear", "commissionGhs": 40},
  {"procedureName": "Abdpelvic USG", "commissionGhs": 40},
  {"procedureName": "Soft tissue", "commissionGhs": 40},
  {"procedureName": "Scrotal", "commissionGhs": 40},
  {"procedureName": "TVS", "commissionGhs": 40},
  {"procedureName": "Anomaly", "commissionGhs": 40},
  {"procedureName": "Arterial doppler", "commissionGhs": 50},
  {"procedureName": "Venous doppler", "commissionGhs": 50}
];

async function run() {
  console.log('Migrating Takoradi commissions to All...');
  const commsRef = collection(db, 'procedure_commissions');
  const q = query(commsRef, where('branch', '==', 'Takoradi'));
  const snaps = await getDocs(q);
  
  const batch = writeBatch(db);
  snaps.forEach(d => {
    batch.update(doc(db, 'procedure_commissions', d.id), { branch: 'All' });
  });
  await batch.commit();
  console.log(`Migrated ${snaps.size} records to branch 'All'.`);

  console.log('Seeding Koforidua specific commissions...');
  let count = 0;
  for (const proc of koforiduaCommissions) {
    try {
      await addDoc(commsRef, {
        procedureName: proc.procedureName,
        branch: 'Koforidua',
        priceGhs: 0, // Using 0 because price wasn't specified, we just want commission
        commissionGhs: proc.commissionGhs
      });
      count++;
    } catch (err) {
      console.error(`Failed to add ${proc.procedureName}`, err);
    }
  }
  console.log(`Successfully seeded ${count} Koforidua records.`);
  process.exit(0);
}

run();
