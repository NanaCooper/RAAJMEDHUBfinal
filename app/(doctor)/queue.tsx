import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToAppointments } from '../../services/appointments';
import { getUserProfile } from '../../services/users';
import { Feather } from "@expo/vector-icons";
import { Appointment } from "../../types/appointment";

// --- 🎨 Unified Premium Theme ---
const COLORS = {
  bg: "#F8FAFC",        // Slate 50
  surface: "#FFFFFF",
  primary: "#4F46E5",   // Indigo 600
  primarySoft: "#EEF2FF",
  textMain: "#1E293B",  // Slate 800
  textSec: "#64748B",   // Slate 500
  border: "#E2E8F0",
  success: "#10B981",   // Emerald
  warning: "#F59E0B",   // Amber
  danger: "#EF4444",
};

const SHADOW = {
  shadowColor: "#64748B",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

export default function DoctorQueue() {
  const router = useRouter();
  const { session } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.uid) return;
    const unsub = subscribeToAppointments(session.uid, 'doctor', async (items) => {
      // Fetch patient details for each appointment
      const enrichedItems = await Promise.all(items.map(async (item) => {
        let details = null;
        if (item.patientId) {
            try {
                details = await getUserProfile(item.patientId);
            } catch (e) {
                console.error("Failed to fetch patient", item.patientId);
            }
        }
        return { ...item, patientDetails: details } as any;
      }));

      // Sort by time
      const sorted = enrichedItems.sort((a: any, b: any) => {
        const tA = a.startAt?.toMillis ? a.startAt.toMillis() : (a.startAt ? new Date(a.startAt).getTime() : 0);
        const tB = b.startAt?.toMillis ? b.startAt.toMillis() : (b.startAt ? new Date(b.startAt).getTime() : 0);
        return tA - tB;
      });
      setAppointments(sorted);
      setLoading(false);
    });
    return () => { try { unsub(); } catch {} };
  }, [session?.uid]);

  // --- Handlers ---
  const handleStart = (appt: Appointment) => router.push(`/consultation/${appt.id}`);
  
  const handleCall = (appt: Appointment) => {
    // Use 'contact' or 'phone' depending on your user schema. 
    // Based on patients/[id].tsx, 'contact' seems to be the field.
    const details = (appt as any).patientDetails;
    const phoneNumber = details?.contact || details?.phone;
    if (phoneNumber) {
      const url = `tel:${phoneNumber}`;
      // Directly try to open the URL. canOpenURL can be flaky on Android 11+ without queries.
      Linking.openURL(url).catch(err => {
        console.error('An error occurred', err);
        Alert.alert("Error", "Could not open phone app.");
      });
    } else {
      Alert.alert("No Phone Number", "This patient does not have a phone number on file.");
    }
  };

  // --- Helper: Status Badge ---
  const getStatusConfig = (status?: string) => {
    switch (status) {
      case 'in-consultation':
      case 'in_consultation': return { color: COLORS.primary, bg: COLORS.primarySoft, label: 'In Progress', icon: 'play-circle' };
      case 'checked-in':
      case 'checked_in': return { color: COLORS.success, bg: '#ECFDF5', label: 'Checked In', icon: 'check-circle' };
      case 'waiting': return { color: COLORS.warning, bg: '#FFFBEB', label: 'Waiting', icon: 'clock' };
      default: return { color: COLORS.textSec, bg: COLORS.bg, label: status || 'Pending', icon: 'circle' };
    }
  };

  // --- Components ---

  const StatBadge = ({ label, count, color }: { label: string, count: number, color: string }) => (
    <View style={styles.statItem}>
      <Text style={[styles.statNumber, { color }]}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const renderAppointment = ({ item }: { item: Appointment }) => {
    const statusConfig = getStatusConfig(item.status);
    const pd = (item as any).patientDetails || {};
    const patientName = pd.fullName || pd.name || (pd.firstName || pd.lastName ? `${pd.firstName} ${pd.lastName}` : ((item as any).patient || 'Unknown Patient'));

    // Extract time properly
    let displayTime = (item as any).time;
    if (!displayTime && item.startAt) {
       const d = typeof item.startAt === 'string' ? new Date(item.startAt) : item.startAt.toDate();
       displayTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return (
      <View style={styles.card}>
        {/* Left Side: Time & Vertical Line */}
        <View style={styles.timeColumn}>
          <Text style={styles.timeText}>{displayTime}</Text>
          <View style={styles.timelineLine} />
        </View>

        {/* Right Side: Patient Card */}
        <View style={styles.cardContent}>

          {/* Header: Status & Name */}
          <View style={styles.cardHeader}>
            <View style={[styles.statusPill, { backgroundColor: statusConfig.bg }]}>
               <Feather name={statusConfig.icon as any} size={12} color={statusConfig.color} />
               <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push(`/patients/${item.patientId || ''}`)}
          >
            <Text style={styles.patientName}>{patientName}</Text>
            <Text style={styles.reasonText} numberOfLines={1}>
              {item.notes ?? "General Consultation"}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Action Row */}
          <View style={styles.actionsRow}>
            

            <View style={styles.iconActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => handleCall(item)}>
                <Feather name="phone" size={20} color={COLORS.success} />
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      

      {/* --- Stats Summary --- */}
      <View style={styles.statsContainer}>
        <StatBadge label="Total" count={appointments.length} color={COLORS.textMain} />
        <View style={styles.statDivider} />
        <StatBadge
          label="Checked In"
          count={appointments.filter(a => a.status?.includes('checked')).length}
          color={COLORS.success}
        />
        <View style={styles.statDivider} />
        <StatBadge
          label="Waiting"
          count={appointments.filter(a => (a.status || '').includes('waiting') || !a.status).length}
          color={COLORS.warning}
        />
      </View>

      {/* --- List --- */}
      <FlatList
        data={appointments}
        keyExtractor={(i) => i.id || Math.random().toString()}
        renderItem={renderAppointment}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
             <Feather name="coffee" size={40} color={COLORS.textSec} />
             <Text style={styles.emptyText}>No patients in queue.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 10,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textMain, letterSpacing: -0.5 },
  headerDate: { fontSize: 14, fontWeight: '600', color: COLORS.textSec, marginBottom: 6 },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
    ...SHADOW,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 12, color: COLORS.textSec, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  // List
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Card Structure
  card: { flexDirection: 'row', marginBottom: 20 },

  // Time Column
  timeColumn: { width: 60, alignItems: 'center', paddingTop: 4 },
  timeText: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  timelineLine: { flex: 1, width: 2, backgroundColor: COLORS.border, marginTop: 8, borderRadius: 1 },

  // Card Content
  cardContent: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  patientName: { fontSize: 18, fontWeight: '700', color: COLORS.textMain, marginBottom: 4 },
  reasonText: { fontSize: 14, color: COLORS.textSec },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },

  // Actions
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  primaryAction: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryActionText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  iconActions: { flexDirection: 'row', gap: 12 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: COLORS.textSec, marginTop: 12, fontSize: 16 },
});