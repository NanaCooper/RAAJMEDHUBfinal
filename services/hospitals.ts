import {
  db,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from '../utils/firebaseConfig';

export interface HospitalOption {
  id: string;
  name: string;
  region: string;
  normalizedName: string;
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const hospitalsCol = () => collection(db, 'hospitals');

const makeHospitalId = (name: string, region: string) =>
  `${normalizeText(name)}_${normalizeText(region || 'unknown')}`;

export async function listHospitals(): Promise<HospitalOption[]> {
  const q = query(hospitalsCol(), orderBy('name', 'asc'));
  const snaps = await getDocs(q);
  return snaps.docs.map((docSnap: any) => {
    const data = docSnap.data() as any;
    return {
      id: docSnap.id,
      name: data.name || '',
      region: data.region || '',
      normalizedName: data.normalizedName || normalizeText(data.name || ''),
    } as HospitalOption;
  });
}

export async function upsertHospital(name: string, region: string): Promise<HospitalOption> {
  const trimmedName = name.trim();
  const trimmedRegion = region.trim();
  const id = makeHospitalId(trimmedName, trimmedRegion);
  const normalizedName = normalizeText(trimmedName);

  await setDoc(
    doc(db, 'hospitals', id),
    {
      name: trimmedName,
      region: trimmedRegion,
      normalizedName,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    id,
    name: trimmedName,
    region: trimmedRegion,
    normalizedName,
  };
}
