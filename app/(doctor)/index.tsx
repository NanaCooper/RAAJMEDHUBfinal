import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import moment from "moment-timezone";
import { subscribeToAppointments } from '../../services/appointments';

// --- 🎨 Unified Premium Theme ---
const COLORS = {
  bg: "#F8FAFC",        // Slate 50
  surface: "#FFFFFF",
  primary: "#4F46E5",   // Indigo 600
  primaryDark: "#312E81",
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
    return () => { try { unsubAppts(); } catch {} };
  }, [session?.uid]);

  const todaysAppointments = appointments.filter(a => {
    if (!a.startAt) return false;
    const date = typeof a.startAt === 'string' ? a.startAt.split(' ')[0] : (a.startAt?.toDate ? a.startAt.toDate() : new Date(a.startAt));
    const day = moment(date).format('YYYY-MM-DD');
    return day === moment().format('YYYY-MM-DD');
  }).length;

  const patientsInQueue = appointments.filter(a => ['pending','waiting','checked-in'].includes((a.status || '').toString())).length;

  const patientsSeenThisWeek = appointments.filter(a => {
    const status = a.status || '';
    if (status !== 'completed') return false;
    if (!a.startAt) return false;
    const date = typeof a.startAt === 'string' ? a.startAt.split(' ')[0] : (a.startAt?.toDate ? a.startAt.toDate() : new Date(a.startAt));
    return moment(date).isAfter(moment().subtract(7, 'days'));
  }).length;






  // --- Helper: Time of Day Greeting ---
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Welcome";
    if (hour < 18) return "Welcome";
    return "Welcome";
  };

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
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* --- Header Section --- */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dateText}>{moment().format("dddd, MMMM Do")}</Text>
          <Text style={styles.greetingText}>{getGreeting()}, Dr. {user?.fullName || "User"}</Text>
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
        <Text style={styles.sectionTitle}>Overview</Text>

        <View style={styles.statsGrid}>
          {/* Hero Card: Today */}
          <TouchableOpacity
            style={[styles.statCard, styles.heroCard]}
            onPress={() => router.push("/(doctor)/schedule")}
            activeOpacity={0.9}
          >
            <View style={styles.iconCircleLight}>
              <Feather name="calendar" size={24} color="#FFF" />
            </View>
            <View>
              <Text style={styles.heroNumber}>{todaysAppointments}</Text>
              <Text style={styles.heroLabel}>Appointments Today</Text>
            </View>
            <Feather name="arrow-right" size={20} color="#FFF" style={styles.heroArrow} />
          </TouchableOpacity>

          {/* Secondary Cards Row */}
          <View style={styles.secondaryStatsRow}>
            <TouchableOpacity
              style={styles.secondaryCard}
              onPress={() => router.push("/(doctor)/queue")}
            >
              <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
                <Feather name="users" size={20} color={COLORS.success} />
              </View>
              <Text style={styles.secondaryNumber}>{patientsInQueue}</Text>
              <Text style={styles.secondaryLabel}>Waiting Queue</Text>
            </TouchableOpacity>

            <View style={styles.secondaryCard}>
              <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                <MaterialCommunityIcons name="check-circle-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.secondaryNumber}>{patientsSeenThisWeek}</Text>
              <Text style={styles.secondaryLabel}>Seen This Week</Text>
            </View>
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

  // Stats Grid
  statsGrid: { gap: 16 },

  // Hero Card
  statCard: {
    borderRadius: 20,
    padding: 20,
    ...SHADOW,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
  },
  iconCircleLight: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  heroNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    lineHeight: 38,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  heroArrow: {
    marginLeft: 'auto',
    opacity: 0.8,
  },

  // Secondary Stats
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