import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToAppointments } from '../../services/appointments';
import { db, doc, getDoc } from '../../utils/firebaseConfig';
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

// --- 🎨 Unified Premium Theme ---
const COLORS = {
  bg: "#F8FAFC",        // Slate 50
  surface: "#FFFFFF",
  primary: "#4F46E5",   // Indigo 600
  primarySoft: "#EEF2FF",
  textMain: "#1E293B",  // Slate 800
  textSec: "#64748B",   // Slate 500
  border: "#E2E8F0",
  success: "#10B981",
  input: "#F1F5F9",     // Slate 100
};

const SHADOW = {
  shadowColor: "#64748B",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

type Patient = {
  id: string;
  name: string;
  lastVisit: string;
  nextAppointment?: string;
  conditions: string[];
  avatarColor?: string;
};

export default function MyPatients() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { session } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientCache, setPatientCache] = useState<Record<string, string>>({});

  const fetchPatientName = React.useCallback(async (pid: string) => {
    if (patientCache[pid]) return; // Already cached
    try {
      const snap = await getDoc(doc(db, 'users', pid));
      if (snap.exists()) {
        const data = snap.data();
        const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Patient';
        setPatientCache(prev => ({ ...prev, [pid]: name }));
      } else {
        const pSnap = await getDoc(doc(db, 'patients', pid));
        if (pSnap.exists()) {
          const data = pSnap.data();
          const name = data.name || data.fullName || 'Patient';
          setPatientCache(prev => ({ ...prev, [pid]: name }));
        }
      }
    } catch (e) {
      console.warn("Failed to fetch patient name", pid, e);
    }
  }, [patientCache]);

  useEffect(() => {
    if (!session?.uid) return;
    const unsub = subscribeToAppointments(session.uid, 'doctor', (items) => {
      const map: Record<string, any> = {};
      items.forEach((it: any) => {
        const pid = it.patientId || it.patientDetails?.id;
        if (!pid) return;
        // Logic to keep the latest appointment info for the patient
        if (!map[pid] || (map[pid].startAt || 0) < (it.startAt || 0)) {
          const firstName = it.patientDetails?.firstName || '';
          const lastName = it.patientDetails?.lastName || '';
          // Use cached name if available, otherwise fallback to details or "Patient"
          let fullName = `${firstName} ${lastName}`.trim();

          if (!fullName && patientCache[pid]) {
            fullName = patientCache[pid];
          } else if (!fullName) {
            fullName = 'Patient';
            // Trigger fetch if we don't have a name and haven't cached it (or it's "Patient")
            // We check cache existence to avoid loop.
            // But here we rely on the fact that if it's 'Patient', we might want to try fetching.
            // However, to avoid infinite re-renders or calls, we should only call this if we haven't tried yet.
            // A better way is to do it in a separate effect or just fire-and-forget here carefully.
            fetchPatientName(pid);
          }

          let dateStr = '';
          if (it.startAt) {
            const d = typeof it.startAt === 'string' ? new Date(it.startAt) : it.startAt.toDate();
            dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          }

          map[pid] = {
            id: pid,
            name: fullName,
            lastVisit: dateStr,
            nextAppointment: dateStr, // simplified logic
            conditions: it.patientDetails?.conditions || [],
            avatarColor: COLORS.primarySoft
          };
        }
      });
      setPatients(Object.values(map));
      setLoading(false);
    });
    return () => { try { unsub(); } catch { } };
  }, [session?.uid, patientCache, fetchPatientName]); // Re-run when cache updates to refresh names

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.conditions.join(" ").toLowerCase().includes(q)
    );
  }, [query, patients]);

  const openPatient = (id: string) => router.push(`/patients/${id}` as any);

  // --- Renderers ---

  const renderPatientCard = ({ item }: { item: Patient }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => openPatient(item.id)}
      activeOpacity={0.9}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.patientName}>{item.name}</Text>
          {/* Last Visit Removed */}
        </View>
      </View>

      {item.conditions.length > 0 && (
        <View style={styles.conditionsRow}>
          {item.conditions.slice(0, 3).map((c, index) => (
            <View key={index} style={styles.conditionPill}>
              <Text style={styles.conditionText}>{c}</Text>
            </View>
          ))}
          {item.conditions.length > 3 && (
            <Text style={styles.moreText}>+{item.conditions.length - 3}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      {/* Header */}


      {/* Search */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color={COLORS.textSec} style={styles.searchIcon} />
        <TextInput
          placeholder="Search by name or condition..."
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={COLORS.textSec}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")} style={{ padding: 4 }}>
            <Feather name="x-circle" size={18} color={COLORS.textSec} />
          </Pressable>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderPatientCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="account-group-outline" size={48} color={COLORS.textSec} />
              <Text style={styles.emptyText}>No patients found</Text>
              <Text style={styles.emptySub}>Patients will appear here after appointments.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.bg,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textMain, letterSpacing: -0.5 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
    shadowColor: COLORS.primary,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 16, color: COLORS.textMain, height: '100%' },

  // List
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  infoContainer: { flex: 1 },
  patientName: { fontSize: 17, fontWeight: '700', color: COLORS.textMain, marginBottom: 4 },

  chatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  conditionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  conditionPill: {
    backgroundColor: COLORS.input,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  conditionText: { fontSize: 12, fontWeight: '600', color: COLORS.textSec },
  moreText: { fontSize: 12, color: COLORS.textSec, alignSelf: 'center' },

  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 12 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.textMain, marginTop: 16 },
  emptySub: { fontSize: 14, color: COLORS.textSec, marginTop: 4 },
});