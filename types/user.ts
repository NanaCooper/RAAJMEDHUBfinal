export type UserRole = 'patient' | 'doctor' | 'admin';

export interface AppUser {
  id: string;
  email: string;
  name?: string; // Deprecated, use fullName
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  role: UserRole;
  avatarUrl?: string | null;
  bio?: string | null;
  specialties?: string[]; // for doctors
  createdAt?: string; // ISO string or Firestore timestamp serialized as string
  status?: 'online' | 'offline';
  lastActive?: string; // ISO string or Firestore timestamp
  [key: string]: any;
}
