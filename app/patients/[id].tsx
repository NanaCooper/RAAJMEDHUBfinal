import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { getUserProfile } from "../../services/users";
import { AppUser } from "../../types/user";

// --- 🎨 Unified Premium Theme ---
const COLORS = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  primary: "#4F46E5",
  primarySoft: "#EEF2FF",
  textMain: "#1E293B",
  textSec: "#64748B",
  border: "#E2E8F0",
  accent: "#F59E0B", // Amber for highlights
};

const SHADOW = {
  shadowColor: "#64748B",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

// --- Helper function to calculate age ---
const calculateAge = (dob: string) => {
  if (!dob) return "N/A";
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export default function PatientRecordScreen() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const [patient, setPatient] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("No patient ID provided.");
      setLoading(false);
      return;
    }

    const fetchPatient = async () => {
      try {
        setLoading(true);
        const userProfile = await getUserProfile(id);
        if (userProfile) {
          setPatient(userProfile);
        } else {
          setError("Patient not found.");
        }
      } catch (err) {
        console.error("Failed to fetch patient:", err);
        setError("An error occurred while fetching patient data.");
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [id]);

  const InfoRow = ({ icon, label, value }: { icon: any; label: string; value: string | number }) => (
    <View style={styles.infoRow}>
      <Feather name={icon} size={18} color={COLORS.primary} style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'N/A'}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Feather name="alert-triangle" size={48} color={COLORS.accent} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="chevron-left" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{patient?.fullName || "Patient Record"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Patient Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Patient Information</Text>
          <InfoRow icon="user" label="Full Name" value={patient?.fullName || 'N/A'} />
          <InfoRow icon="mail" label="Email" value={patient?.email || 'N/A'} />
          <InfoRow icon="phone" label="Contact" value={patient?.contact || 'N/A'} />
          <InfoRow icon="calendar" label="Age" value={calculateAge(patient?.dob)} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { justifyContent: "center", alignItems: "center", padding: 20 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textMain,
    flex: 1,
    textAlign: 'center',
  },

  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...SHADOW,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textMain,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
  },

  // Info Row
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoIcon: {
    marginRight: 12,
    backgroundColor: COLORS.primarySoft,
    padding: 6,
    borderRadius: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSec,
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textMain,
    flex: 1,
  },

  // Mock Data & Notes
  mockDataText: {
    fontSize: 12,
    color: COLORS.accent,
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    textAlign: 'center',
  },
  noteText: {
    fontSize: 14,
    color: COLORS.textSec,
    lineHeight: 20,
  },

  // Actions
  actionContainer: { marginTop: 16, gap: 12 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    ...SHADOW,
    shadowColor: COLORS.primary,
    gap: 10,
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "700",
  },

  // Error State
  errorText: {
    fontSize: 16,
    color: COLORS.textSec,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backButtonText: {
    color: "#FFF",
    fontWeight: "600",
  },
});
