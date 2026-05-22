const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const PROJECT_ID = 'medicareapp-f0dc0';

// Initialize Firebase Admin SDK.
// Prefer a local service account when available, otherwise fall back to application default credentials.
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
  });
} else {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const db = admin.firestore();

const DEFAULT_HOSPITALS = [
  // Greater Accra
  { name: 'Korle-Bu Teaching Hospital (Korle-Gonno)', region: 'Greater Accra' },
  { name: 'Greater Accra Regional Hospital / Ridge Hospital (Ridge)', region: 'Greater Accra' },
  { name: '37 Military Hospital (Neghelli Barracks)', region: 'Greater Accra' },
  { name: 'University of Ghana Medical Centre (UGMC) (Legon)', region: 'Greater Accra' },
  { name: 'Nyaho Medical Centre (Airport Residential Area)', region: 'Greater Accra' },
  { name: 'The Trust Hospital / SSNIT Hospital (Osu)', region: 'Greater Accra' },
  { name: 'Lister Hospital (Airport Hills)', region: 'Greater Accra' },
  { name: 'Police Hospital (Cantonments)', region: 'Greater Accra' },
  { name: 'Akai House Clinic (Cantonments)', region: 'Greater Accra' },
  { name: 'Accra Psychiatric Hospital (Adabraka)', region: 'Greater Accra' },
  { name: 'La General Hospital (La)', region: 'Greater Accra' },
  { name: 'LEKMA Hospital (Teshie)', region: 'Greater Accra' },
  { name: 'Lapaz Community Hospital (Lapaz)', region: 'Greater Accra' },
  { name: 'Medifem Hospital & Fertility Centre (Westlands/Legon)', region: 'Greater Accra' },
  { name: 'Achimota Hospital (Achimota)', region: 'Greater Accra' },
  { name: "Airport Women's Hospital (Airport Residential Area)", region: 'Greater Accra' },
  { name: 'West African Rescue Association (WARA) Clinic (Abufun)', region: 'Greater Accra' },
  { name: 'Del International Hospital (East Legon)', region: 'Greater Accra' },
  { name: 'Rabito Clinic (Osu)', region: 'Greater Accra' },
  { name: 'Finney Hospital and Fertility Centre (Weija)', region: 'Greater Accra' },
  { name: 'Adabraka Polyclinic (Adabraka)', region: 'Greater Accra' },
  { name: 'Madina Polyclinic (Madina)', region: 'Greater Accra' },
  { name: 'The Bank Hospital (Cantonments)', region: 'Greater Accra' },
  { name: 'Egon German Clinic (Abelemkpe)', region: 'Greater Accra' },
  { name: 'Impact Medical and Diagnostic Centre (Asylum Down)', region: 'Greater Accra' },

  // Ashanti
  { name: 'Komfo Anokye Teaching Hospital (KATH) (Bantama)', region: 'Ashanti' },
  { name: 'Kwame Nkrumah University of Science and Technology (KNUST) Hospital (Campus)', region: 'Ashanti' },
  { name: 'Asafo-Agyei Hospital (Daaban)', region: 'Ashanti' },
  { name: 'County Hospital (Abrepo)', region: 'Ashanti' },
  { name: 'HopeXchange Medical Centre (Santasi)', region: 'Ashanti' },
  { name: 'Manhyia Hospital (Manhyia)', region: 'Ashanti' },
  { name: 'Suntresu Government Hospital (Suntresu)', region: 'Ashanti' },
  { name: 'Tafo Government Hospital (Old Tafo)', region: 'Ashanti' },
  { name: 'City Hospital (Asokwa / Stadium)', region: 'Ashanti' },
  { name: 'West End Hospital (Kumasi Central)', region: 'Ashanti' },
  { name: 'Seventh-Day Adventist (SDA) Hospital (Kwadaso)', region: 'Ashanti' },
  { name: 'TrustCare Specialist Hospital (Amakom)', region: 'Ashanti' },
  { name: 'Peace & Love Hospital (Oduom)', region: 'Ashanti' },
  { name: 'Adiebeba Hospital (Ahodwo)', region: 'Ashanti' },
  { name: 'Pima Hospital (Buokrom Estate)', region: 'Ashanti' },
  { name: 'McKenzie Health Services (Ahinsan Estate)', region: 'Ashanti' },
  { name: 'Maternal and Child Health Hospital (Pampaso)', region: 'Ashanti' },

  // Western
  { name: 'Effia Nkwanta Regional Hospital (Sekondi)', region: 'Western' },
  { name: 'Takoradi Hospital / European Hospital (Takoradi)', region: 'Western' },
  { name: 'Ghana Ports and Harbour Authority (GPHA) Hospital (Takoradi)', region: 'Western' },
  { name: 'Kwesimintsim Polyclinic (Kwesimintsim)', region: 'Western' },
  { name: 'West African Rescue Association (WARA) Clinic (Dixcove Hill)', region: 'Western' },
  { name: 'UQ Specialist Medical Centre (Takoradi)', region: 'Western' },
  { name: 'New Crystal Hospital (Takoradi)', region: 'Western' },
  { name: 'Ahmadiyya Muslim Hospital (Takoradi)', region: 'Western' },
  { name: 'St. Francis Clinic (Takoradi)', region: 'Western' },
  { name: 'The Physio Niche (Effia)', region: 'Western' },
  { name: 'Essikado Hospital (Essikado)', region: 'Western' },

  // Central
  { name: 'Cape Coast Teaching Hospital (CCTH) (Abura)', region: 'Central' },
  { name: 'University of Cape Coast (UCC) Hospital (UCC Campus)', region: 'Central' },
  { name: 'Ankaful Psychiatric Hospital (Ankaful)', region: 'Central' },
  { name: 'Ankaful Leprosy & General Hospital (Ankaful)', region: 'Central' },
  { name: 'Doctors-In-Service (DIS) Clinic (Abura)', region: 'Central' },
  { name: 'Baiden Ghartey Memorial Hospital (Pedu)', region: 'Central' },
  { name: 'Ewim Polyclinic (Ewim)', region: 'Central' },
  { name: 'Sanford World Clinic (Cape Coast)', region: 'Central' },
  { name: 'Oak Tree Medical Service (Ameen Sangari Area)', region: 'Central' },
  { name: 'Adisadel Urban Health Centre (Adisadel)', region: 'Central' },

  // Eastern
  { name: 'Eastern Regional Hospital (Koforidua Central)', region: 'Eastern' },
  { name: "St. Joseph's Orthopaedic Hospital (Effiduase)", region: 'Eastern' },
  { name: 'Seventh-Day Adventist (SDA) Hospital (Koforidua)', region: 'Eastern' },
  { name: 'Koforidua Polyclinic (Koforidua)', region: 'Eastern' },
  { name: 'Koforidua Technical University Clinic (KTU Campus)', region: 'Eastern' },
  { name: 'Oti Yeboah Hospital (Koforidua)', region: 'Eastern' },
  { name: 'Adweso Health Centre (Adweso)', region: 'Eastern' },
];

const normalizeText = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const makeHospitalId = (name, region) =>
  `${normalizeText(name)}_${normalizeText(region || 'unknown')}`;

async function seedHospitals() {
  try {
    console.log('🏥 Starting hospital seeding...\n');
    
    for (const hospital of DEFAULT_HOSPITALS) {
      const id = makeHospitalId(hospital.name, hospital.region);
      const docRef = db.collection('hospitals').doc(id);
      
      await docRef.set({
        name: hospital.name,
        region: hospital.region,
        normalizedName: normalizeText(hospital.name),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Added: ${hospital.name} (${hospital.region})`);
    }

    console.log('\n✨ All hospitals seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding hospitals:', error);
    process.exit(1);
  }
}

seedHospitals();
