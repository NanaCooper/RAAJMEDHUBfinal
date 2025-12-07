import React, { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { doc, getDoc, db } from "../../utils/firebaseConfig";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

// --- 🎨 Unified Premium Theme ---
const COLORS = {
  bg: "#F8F9FA",
  surface: "#FFFFFF",
  primary: "#0A2463",
  primarySoft: "#E9ECEF",
  secondary: "#00A896",
  textMain: "#212529",
  textSec: "#6C757D",
  border: "#E9ECEF",
  success: "#28A745",
  danger: "#FF6B6B",
};

const SHADOW = {
  shadowColor: "#64748B",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 16,
  elevation: 4,
};

export default function DoctorProfile(): React.ReactElement {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (!session?.uid) return;
      setProfileLoading(true);
      setProfileError(null);
      try {
        const userRef = doc(db, "users", session.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setProfile(userSnap.data());
        } else {
          setProfile(null);
        }
      } catch {
        setProfileError("Failed to load profile");
      } finally {
        setProfileLoading(false);
      }
    }
    fetchProfile();
  }, [session?.uid]);

  // --- Helper Components ---

  const InfoField = ({ label, value, icon }: { label: string, value: string, icon: any }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldContainer}>
        <Feather name={icon} size={18} color={COLORS.textSec} style={styles.fieldIcon} />
        <Text style={styles.fieldValue}>{value || "Not provided"}</Text>
      </View>
    </View>
  );

  // --- Render States ---

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </SafeAreaView>
    );
  }

  if (profileError) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Feather name="alert-triangle" size={40} color={COLORS.danger} />
        <Text style={styles.errorText}>{profileError}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

     

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* --- Profile Header --- */}
        <View style={styles.headerCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : "D"}
            </Text>
            <View style={styles.verifiedBadge}>
              <MaterialCommunityIcons name="check-decagram" size={22} color={COLORS.primary} />
            </View>
          </View>

          <Text style={styles.nameText}>{profile?.fullName || "Doctor"}</Text>

          <View style={styles.specBadge}>
            <Text style={styles.specText}>{profile?.specialization || "General Practitioner"}</Text>
          </View>
        </View>

        {/* --- Professional Info --- */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Professional Credentials</Text>
          <View style={styles.card}>
             <InfoField
               label="Qualifications"
               value={profile?.qualifications}
               icon="award"
             />
             <View style={styles.divider} />
             <InfoField
               label="License / ID"
               value={session?.uid?.substring(0, 8).toUpperCase() || "N/A"}
               icon="hash"
             />
          </View>
        </View>

        {/* --- Personal Info --- */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.card}>
            <InfoField
              label="Email Address"
              value={profile?.email}
              icon="mail"
            />
            <View style={styles.divider} />
            <InfoField
              label="Phone Number"
              value={profile?.contact}
              icon="phone"
            />
            <View style={styles.divider} />
            <InfoField
              label="Date of Birth"
              value={profile?.dob}
              icon="calendar"
            />
          </View>
        </View>

        {/* --- Actions --- */}
        <TouchableOpacity style={styles.logoutBtn} onPress={() => signOut()}>
          <Feather name="log-out" size={18} color={COLORS.danger} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  scrollContent: { padding: 20, paddingBottom: 40 },

  loadingText: { marginTop: 16, color: COLORS.textSec, fontSize: 14, fontWeight: '500' },
  errorText: { marginTop: 16, color: COLORS.danger, fontSize: 14, fontWeight: '600' },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  screenTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textMain },
  settingsBtn: { padding: 8, backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },

  // Header Card
  headerCard: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: COLORS.surface,
    ...SHADOW,
  },
  avatarText: { fontSize: 40, fontWeight: '800', color: COLORS.primary },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 2,
  },
  nameText: { fontSize: 22, fontWeight: '800', color: COLORS.textMain, marginBottom: 8 },
  specBadge: {
    backgroundColor: COLORS.primary + '15', // 15% opacity
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  specText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },

  // Sections
  sectionContainer: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textSec, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW,
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },

  // Fields
  fieldGroup: {},
  fieldLabel: { fontSize: 13, color: COLORS.textSec, marginBottom: 6, fontWeight: '600' },
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.input,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  fieldIcon: { marginRight: 12 },
  fieldValue: { fontSize: 16, color: COLORS.textMain, fontWeight: '500', flex: 1 },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: { color: COLORS.danger, fontWeight: '700', fontSize: 15, marginLeft: 8 },
});