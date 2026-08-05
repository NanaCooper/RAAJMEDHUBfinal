import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import dayjs from "dayjs";
import { subscribeToAppointments } from '../../services/appointments';
import { NAV_MY_PATIENTS, isAndroidBuild } from "../../constants/AppStrings";

// --- 🎨 Unified Premium Theme ---
const COLORS = {
  bg: "#F8FAFC",        // Slate 50
  surface: "#FFFFFF",
  primary: "#4F46E5",   // Indigo 600
  primaryDark: "#312E81",
  primarySoft: "#EEF2FF", // Indigo 50
  textMain: "#1E293B",  // Slate 800
  textSec: "#64748B",   // Slate 500
  border: "#E2E8F0",
  success: "#10B981",   // Emerald
  accent: "#F59E0B",    // Amber
};

const SHADOW = {
  shadowColor: "#64748B",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 16,
  elevation: 4,
};

export default function DoctorDashboard() {
  const router = useRouter();
  const { session, user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);

  // --- Logic (Preserved) ---
  useEffect(() => {
    if (!session?.uid) return;
    const unsubAppts = subscribeToAppointments(session.uid, 'doctor', (items: any) => setAppointments(items));
    return () => { try { unsubAppts(); } catch { } };
  }, [session?.uid]);

  const totalReferrals = appointments.length;

  const patientsSeenThisWeek = appointments.filter(a => {
    const status = a.status || '';
    if (status !== 'completed') return false;
    if (!a.startAt) return false;
    const date = typeof a.startAt === 'string' ? a.startAt.split(' ')[0] : (a.startAt?.toDate ? a.startAt.toDate() : new Date(a.startAt));
    return dayjs(date).isAfter(dayjs().subtract(7, 'days'));
  }).length;







  if (!session) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      {/* --- Header Section --- */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.dateText}>{dayjs().format("dddd, MMMM DD")}</Text>
          <Text style={styles.greetingText} numberOfLines={2}>
            Dr. {user?.fullName || user?.name || "Doctor"}
          </Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push("/(doctor)/profile")}>
          <Text style={styles.profileInitial}>{(user?.fullName || "D").charAt(0)}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >

        {/* --- Quick Stats Overview --- */}


        {/* --- Quick Actions --- */}


        <View style={styles.actionGrid}>
          {/* Appointments Button */}
          {/* Appointments Button */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: COLORS.primarySoft }]}
            onPress={() => router.push("/(doctor)/appointments")}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.primary }]}>
              <Feather name="calendar" size={24} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Appointments</Text>
              <Text style={styles.actionSub}>View upcoming & manage schedule</Text>
            </View>
          </TouchableOpacity>

          {/* Patients Button */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#ECFDF5' }]} // Emerald Soft
            onPress={() => router.push("/(doctor)/patients")}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.success }]}>
              <Feather name="users" size={24} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{NAV_MY_PATIENTS}</Text>
              <Text style={styles.actionSub}>{isAndroidBuild ? 'Client list & history' : 'Assigned patient list & history'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Keeping secondary stats as mini-summary if needed, or removing as per request. 
            User said "remove the appointment card", implies the big hero one. 
            I'll keep a small queue summary below appropriately spaced. */}

        <View style={styles.secondaryStatsRow}>
          <View style={styles.secondaryCard}>
            <View style={[styles.iconBox, { backgroundColor: '#F1F5F9' }]}>
              <Feather name="trending-up" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.secondaryNumber}>{totalReferrals}</Text>
            <Text style={styles.secondaryLabel}>Total Referrals</Text>
          </View>

          <View style={styles.secondaryCard}>
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.secondaryNumber}>{patientsSeenThisWeek}</Text>
            <Text style={styles.secondaryLabel}>Seen This Week</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: COLORS.bg,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.textSec,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  greetingText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textMain,
    marginTop: 4,
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
  },
  profileInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },

  scrollView: { flex: 1, paddingHorizontal: 24 },

  // Titles
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 16,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Action Grid
  actionGrid: {
    gap: 16,
    marginBottom: 24,
  },
  actionCard: {
    padding: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    ...SHADOW,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  actionSub: {
    fontSize: 13,
    color: COLORS.textSec,
    marginTop: 2,
  },

  // Adjusted Secondary
  secondaryStatsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  secondaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    ...SHADOW,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  secondaryNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  secondaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSec,
    marginTop: 4,
  },

  // Empty State
  emptyState: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.textSec,
    marginTop: 8,
    fontSize: 14,
  },
});