import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, FlatList, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import moment from 'moment-timezone';
import { useAuth } from '../../hooks/useAuth';
import { subscribeToAppointments } from '../../services/appointments';
import { getUserProfile } from '../../services/users';
import { doc, getDoc, db } from '../../utils/firebaseConfig';
import { Feather, MaterialIcons } from '@expo/vector-icons';

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
  danger: "#EF4444",    // Red
  warning: "#F59E0B",   // Amber
};

const SHADOW = {
  shadowColor: "#64748B",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

interface ApptItem {
  id: string;
  startAt?: any;
  patientDetails?: any;
  status?: string;
  scanType?: string;
  notes?: string;
  patientId?: string;
}

export default function DoctorSchedule() {
  const router = useRouter();
  const { session } = useAuth();
  const [appointments, setAppointments] = useState<ApptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctorKey, setDoctorKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Logic to find correct doctor ID/Code
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!session?.uid) return;
      try {
        const userRef = doc(db, 'users', session.uid);
        const snap = await getDoc(userRef);
        if (mounted && snap.exists()) {
          const data: any = snap.data();
          const code = data?.doctorCode || data?.code || null;
          setDoctorKey(code || session.uid);
        } else if (mounted) {
          setDoctorKey(session.uid);
        }
      } catch {
        if (mounted) setDoctorKey(session.uid);
      }
    })();
    return () => { mounted = false; };
  }, [session?.uid]);

  // Subscription
  useEffect(() => {
    if (!doctorKey) return;
    setLoading(true);
    const unsub = subscribeToAppointments(
      doctorKey,
      'doctor',
      async (items: any[]) => {
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
        setAppointments(enrichedItems as ApptItem[]);
        setLoading(false);
        if (error) setError(null);
      },
      (err) => {
        setLoading(false);
        const code = err?.code || '';
        if (code === 'permission-denied') {
          setError('You do not have permission to view these appointments. Ensure your doctor profile code matches the appointment doctorId and your role is set to doctor.');
        } else {
          setError('Failed to load appointments. Please try again.');
        }
      }
    );
    return () => { try { unsub(); } catch {} };
  }, [doctorKey, error]);

  // Sorting & Grouping
  const sections = useMemo(() => {
    const sorted = [...appointments].sort((a: any, b: any) => {
      const av = a.startAt?.toMillis ? a.startAt.toMillis() : (a.startAt || 0);
      const bv = b.startAt?.toMillis ? b.startAt.toMillis() : (b.startAt || 0);
      return av - bv;
    });

    const map: Record<string, ApptItem[]> = {};
    sorted.forEach((a) => {
      const d = a.startAt?.toDate ? a.startAt.toDate() : new Date(a.startAt || Date.now());
      const key = moment(d).format('YYYY-MM-DD');
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [appointments]);

  // Helpers
  const formatTime = (startAt: any) => {
    if (!startAt) return '--:--';
    const d = startAt?.toDate ? startAt.toDate() : new Date(startAt);
    return moment(d).format('h:mm A');
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return { text: COLORS.success, bg: '#ECFDF5', icon: 'check-circle' };
      case 'cancelled': return { text: COLORS.danger, bg: '#FEF2F2', icon: 'x-circle' };
      case 'checked-in': return { text: COLORS.primary, bg: COLORS.primarySoft, icon: 'user-check' };
      default: return { text: COLORS.warning, bg: '#FFFBEB', icon: 'clock' }; // Pending/Waiting
    }
  };

  // Render Items
  const renderAppt = ({ item }: { item: ApptItem }) => {
    const pd = item.patientDetails || {};
    const name = pd.fullName || pd.name || (pd.firstName || pd.lastName ? `${pd.firstName} ${pd.lastName}` : 'Unknown Patient');
    
    // Calculate status based on date if pending
    let status = (item.status || 'pending');
    if (status.toLowerCase() === 'pending') {
      const apptDate = item.startAt?.toDate ? item.startAt.toDate() : new Date(item.startAt || Date.now());
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const apptDay = new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate());
      
      if (apptDay < today) {
        status = 'completed';
      }
    }

    const statusConfig = getStatusColor(status);
    const scanInfo = typeof item.scanType === 'object' ? (item.scanType as any).name : item.scanType;

    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => router.push(`/patients/${item.patientId || pd.id}`)}
      >
        {/* Header: Time & Status */}
        <View style={styles.cardHeader}>
          <View style={styles.timeBadge}>
            <Feather name="clock" size={14} color={COLORS.textMain} />
            <Text style={styles.timeText}>{formatTime(item.startAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Feather name={statusConfig.icon as any} size={12} color={statusConfig.text} />
            <Text style={[styles.statusText, { color: statusConfig.text }]}>{status}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Body: Patient Info */}
        <View style={styles.cardBody}>
          <View style={styles.patientRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{name.charAt(0)}</Text>
            </View>
            <View>
              <Text style={styles.patientName}>{name}</Text>
              <Text style={styles.patientId}>ID: {pd.id?.substring(0,6).toUpperCase() || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.infoGrid}>
            {scanInfo && (
              <View style={styles.infoItem}>
                <MaterialIcons name="medical-services" size={16} color={COLORS.textSec} />
                <Text style={styles.infoText} numberOfLines={1}>{scanInfo}</Text>
              </View>
            )}
            {pd.phone && (
              <TouchableOpacity 
                style={styles.infoItem}
                onPress={() => Linking.openURL(`tel:${pd.phone}`)}
              >
                <Feather name="phone" size={16} color={COLORS.primary} />
                <Text style={[styles.infoText, { color: COLORS.primary }]}>{pd.phone}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Footer: Quick Actions */}
        <View style={styles.cardFooter}>
          <TouchableOpacity 
            style={styles.footerAction} 
            onPress={() => router.push({ pathname: '/appointments/[id]', params: { id: item.id } })}
          >
            <Text style={styles.actionText}>View Details</Text>
            <Feather name="chevron-right" size={16} color={COLORS.primary} />
          </TouchableOpacity>
          
          
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = ({ item }: { item: [string, ApptItem[]] }) => {
    const [dateStr, appts] = item;
    const niceDate = moment(dateStr).format('dddd, MMM Do');
    const isToday = dateStr === moment().format('YYYY-MM-DD');

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, isToday && styles.todayTitle]}>
            {isToday ? 'Today' : niceDate}
          </Text>
          {!isToday && <Text style={styles.sectionSub}>{moment(dateStr).fromNow()}</Text>}
        </View>
        {appts.map(a => <View key={a.id}>{renderAppt({ item: a })}</View>)}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      
      

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-triangle" size={48} color={COLORS.danger} />
          <Text style={styles.errorTitle}>Access Restricted</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setLoading(true);
              setError(null);
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item[0]}
          renderItem={renderSection}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
               <Feather name="calendar" size={48} color={COLORS.textSec} />
               <Text style={styles.emptyText}>No upcoming appointments.</Text>
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.bg,
  },
  headerRight: { flexDirection: 'row', gap: 12 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // List
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  
  // Sections
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textSec },
  todayTitle: { color: COLORS.primary, fontWeight: '800' },
  sectionSub: { fontSize: 13, color: COLORS.textSec, fontWeight: '500' },

  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timeText: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  
  divider: { height: 1, backgroundColor: COLORS.border },

  cardBody: { padding: 16 },
  patientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  patientName: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  patientId: { fontSize: 12, color: COLORS.textSec },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, color: COLORS.textSec, maxWidth: 120 },

  // Footer
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.bg,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  iconAction: { padding: 4 },

  // Empty
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 16, color: COLORS.textSec, marginTop: 12 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: COLORS.danger, marginTop: 16 },
  errorText: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', marginTop: 8, paddingHorizontal: 32 },
  retryBtn: { marginTop: 20, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  retryText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});