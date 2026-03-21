import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Animated, Image, ScrollView, Modal } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import moment from 'moment-timezone';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { subscribeToAppointments } from '../../services/appointments';
import ScaleButton from '../../components/ui/ScaleButton';
import BookingForm from '../../components/appointment/BookingForm';

// --- THEME ENGINE ---
const COLORS = {
  primary: "#4F46E5",    // Indigo 600
  primaryLight: "#818CF8", // Indigo 400
  primarySoft: "#EEF2FF", // Indigo 50
  bg: "#F8FAFC",         // Slate 50
  textMain: "#0F172A",   // Slate 900
  textSub: "#64748B",    // Slate 500
  success: "#10B981",    // Emerald
  successSoft: "#D1FAE5",
  error: "#EF4444",      // Red
  errorSoft: "#FEE2E2",
  warning: "#F59E0B",    // Amber
  warningSoft: "#FEF3C7",
  border: "#E2E8F0",
};

const SHADOW = {
  shadowColor: "#4F46E5",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 5,
};

const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
};

export default function Appointments() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session } = useAuth();

  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'book'>('upcoming');
  const [bookingMethod, setBookingMethod] = useState<'upload' | 'manual' | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [extractedNotes, setExtractedNotes] = useState<string>('');

  // Parse extracted data
  const extractedDataParam = React.useMemo(() => {
    if (params.extractedData) {
      try {
        return typeof params.extractedData === 'string' ? JSON.parse(params.extractedData) : params.extractedData;
      } catch (e) { console.error("Failed to parse extracted data", e); return null; }
    }
    return null;
  }, [params.extractedData]);

  const [selectedAppointment, setSelectedAppointment] = useState<any>(null); // For details modal

  // --- EFFECTS ---
  useEffect(() => {
    if (params?.tab) setActiveTab(params.tab as any);
    if (extractedDataParam || params.extractedNotes) {
      setBookingMethod('manual');
      if (params.extractedNotes) setExtractedNotes(params.extractedNotes as string);
    }
  }, [params?.tab, extractedDataParam, params.extractedNotes]);

  useEffect(() => {
    if (!session?.uid) return;
    const unsubscribe = subscribeToAppointments(session.uid, 'doctor', async (appts) => {
      const mapped = appts.map((a: any) => {
        const rawDate = a.startAt && a.startAt.toDate ? a.startAt.toDate() : a.startAt;

        // Handle Scan Type
        let scanName = 'Scan';
        if (a.scanType) {
          scanName = a.scanType.name || a.scanType;
          if (scanName === 'General') scanName = 'Scan';
        } else if (Array.isArray(a.scanTypes) && a.scanTypes.length > 0) {
          scanName = a.scanTypes.map((s: any) => s.name).join(', ');
        }

        return {
          id: a.id,
          date: rawDate ? moment(rawDate).format('YYYY-MM-DD') : (a.date || null), // Allow null for TBD
          time: rawDate ? moment(rawDate).format('HH:mm') : (a.time || ''),
          doctor: a.doctorName || 'Assigned soon',
          patientName: a.patientDetails ? `${a.patientDetails.firstName} ${a.patientDetails.lastName}` : (a.patientName || 'Guest Patient'), // Try a.patientName too as simple fallback
          status: a.status || 'upcoming',
          scanType: { name: scanName },
          branch: a.branch,
          // Full details for modal - ensure patientDetails is safe
          patientDetails: a.patientDetails || {},
          specificScan: a.specificScan || '',
          notes: a.notes || '',
          reason: a.reason || '',
        };
      });

      const validNodes = mapped.filter((m: any) => {
        // Ensure we have at least a name or ID to show
        const hasName = m.patientName && m.patientName !== 'Guest Patient' && m.patientName !== 'Unknown Patient';
        const hasDetails = m.patientDetails && (m.patientDetails.id || m.patientDetails.firstName);
        return hasName || hasDetails;
      });

      setAppointments(validNodes);
      // console.log("Mapped Appointments Sample:", mapped.length > 0 ? mapped[0] : "Empty");
    });
    return () => unsubscribe();
  }, [session?.uid]);

  // --- HANDLERS ---
  const handleNavigateToUpload = () => {
    router.push('/(doctor)/upload-request');
  };

  // --- RENDERERS ---

  const renderAppointmentCard = ({ item }: { item: any }) => {
    const isPast = item.status === 'completed' || item.status === 'cancelled';
    const statusConfig = {
      upcoming: { color: COLORS.primary, bg: COLORS.primarySoft, icon: 'calendar' },
      pending: { color: COLORS.warning, bg: COLORS.warningSoft, icon: 'clock' },
      completed: { color: COLORS.success, bg: COLORS.successSoft, icon: 'check-circle' },
      cancelled: { color: COLORS.error, bg: COLORS.errorSoft, icon: 'x-circle' },
    }[item.status] || { color: COLORS.textSub, bg: COLORS.border, icon: 'info' };

    const hasDate = item.date && moment(item.date).isValid();

    return (
      <ScaleButton
        style={[styles.card, isPast && { opacity: 0.7 }]}
        onPress={() => setSelectedAppointment(item)}
      >
        {/* Gradient Accent */}
        <LinearGradient
          colors={[statusConfig.color + '15', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.cardDateBox, { backgroundColor: statusConfig.bg }]}>
          <Text style={[styles.cardDay, { color: statusConfig.color, fontSize: hasDate ? 20 : 16 }]}>
            {hasDate ? moment(item.date).format('DD') : 'TBD'}
          </Text>
          <Text style={[styles.cardMonth, { color: statusConfig.color }]}>
            {hasDate ? moment(item.date).format('MMM') : 'DATE'}
          </Text>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.scanType?.name || 'Consultation'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Feather name={statusConfig.icon as any} size={12} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>{item.status}</Text>
            </View>
          </View>

          <View style={styles.cardDoctor}>
            <Feather name="user" size={14} color={COLORS.textSub} />
            <Text style={styles.cardDoctorText}>{item.patientName}</Text>
          </View>

          <View style={styles.cardMeta}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={14} color={COLORS.textSub} />
              <Text style={styles.cardMetaText}>{hasDate ? moment(item.date + ' ' + item.time).format('h:mm A') : 'Time TBD'}</Text>
            </View>
            {item.branch && (
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={14} color={COLORS.textSub} />
                <Text style={styles.cardMetaText}>{item.branch}</Text>
              </View>
            )}
          </View>
        </View>

        <Feather name="chevron-right" size={20} color={COLORS.border} />
      </ScaleButton>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Enhanced Header */}


      {/* TABS */}
      <View style={styles.tabContainer}>
        {[
          { key: 'upcoming', label: 'Upcoming', icon: 'calendar' },
          { key: 'past', label: 'Past', icon: 'archive' },
          { key: 'book', label: 'New', icon: 'plus' }
        ].map((t) => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => {
                setActiveTab(t.key as any);
                if (t.key !== 'book') setBookingMethod(null);
              }}
            >
              {active && (
                <LinearGradient
                  colors={[COLORS.primary, COLORS.primaryLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Feather name={t.icon as any} size={16} color={active ? '#FFF' : COLORS.textSub} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* CONTENT */}
      <View style={styles.content}>
        {activeTab === 'book' ? (
          !bookingMethod ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
              <View style={styles.methodContainer}>
                <Text style={styles.methodHeader}>Schedule Appointment</Text>
                <Text style={styles.methodSubheader}>Select a method to proceed with your booking</Text>

                <ScaleButton style={styles.methodCard} onPress={handleNavigateToUpload}>
                  <LinearGradient
                    colors={[COLORS.primary + '10', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[styles.methodIconBox, { backgroundColor: COLORS.primarySoft }]}>
                    <Feather name="camera" size={28} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodTitle}>Smart Scan</Text>
                    <Text style={styles.methodSub}>Upload your doctor's referral letter for automatic detail extraction</Text>
                    <View style={styles.aiPill}>
                      <Feather name="zap" size={12} color={COLORS.primary} />
                      <Text style={styles.aiPillText}>AI Analysis</Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={24} color={COLORS.primary} />
                </ScaleButton>

                <ScaleButton style={styles.methodCard} onPress={() => { setExtractedNotes(''); setBookingMethod('manual'); }}>
                  <LinearGradient
                    colors={[COLORS.success + '10', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[styles.methodIconBox, { backgroundColor: COLORS.successSoft }]}>
                    <Feather name="edit-3" size={28} color={COLORS.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodTitle}>Manual Input</Text>
                    <Text style={styles.methodSub}>Enter appointment details manually without scanning</Text>
                  </View>
                  <Feather name="chevron-right" size={24} color={COLORS.success} />
                </ScaleButton>
              </View>
            </ScrollView>
          ) : (
            <BookingForm
              onCancel={() => {
                setBookingMethod(null);
                router.setParams({ extractedData: undefined, extractedNotes: undefined });
              }}
              extractedData={extractedDataParam || (extractedNotes ? { notes: extractedNotes } : undefined)}
              isDoctorBooking={true}
            />
          )
        ) : (
          <FlatList
            data={appointments.filter(a => {
              if (activeTab === 'upcoming') {
                return !a.date || moment(a.date).isSameOrAfter(moment(), 'day');
              }
              return a.date && moment(a.date).isBefore(moment(), 'day');
            })}
            keyExtractor={i => i.id}
            renderItem={renderAppointmentCard}
            contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Feather name="calendar" size={48} color={COLORS.textSub} />
                </View>
                <Text style={styles.emptyText}>No {activeTab} appointments</Text>
                <Text style={styles.emptySubtext}>
                  {activeTab === 'upcoming' ? 'Book a new appointment to get started' : 'Your past appointments will appear here'}
                </Text>
              </View>
            }
          />
        )}
        {/* Details Modal */}
        <Modal visible={!!selectedAppointment} transparent animationType="slide" onRequestClose={() => setSelectedAppointment(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Appointment Details</Text>
                <TouchableOpacity onPress={() => setSelectedAppointment(null)} style={styles.closeBtn}>
                  <Feather name="x" size={24} color={COLORS.textMain} />
                </TouchableOpacity>
              </View>

              {selectedAppointment && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Patient Info */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>PATIENT</Text>
                    <View style={styles.patientRow}>
                      <View style={styles.patientAvatar}>
                        <Feather name="user" size={24} color={COLORS.primary} />
                      </View>
                      <View>
                        <Text style={styles.detailValueLg}>{selectedAppointment.patientName}</Text>
                        <Text style={styles.detailSub}>{selectedAppointment.patientDetails?.phone || 'No phone'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Appointment Info */}
                  <View style={styles.detailGrid}>
                    <View style={styles.gridItem}>
                      <Text style={styles.detailLabel}>DATE</Text>
                      <Text style={styles.detailValue}>
                        {(selectedAppointment.date && moment(selectedAppointment.date).isValid())
                          ? moment(selectedAppointment.date).format('MMM DD, YYYY')
                          : 'Pending Scheduling'}
                      </Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.detailLabel}>TIME</Text>
                      <Text style={styles.detailValue}>{selectedAppointment.time || 'TBD'}</Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>SCAN TYPE</Text>
                    <Text style={styles.detailValue}>{selectedAppointment.scanType?.name}</Text>
                  </View>


                  {selectedAppointment.specificScan && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>SPECIFIC DETAILS</Text>
                      <Text style={styles.detailValue}>{selectedAppointment.specificScan}</Text>
                    </View>
                  )}

                  {/* Notes/Reason */}
                  {(selectedAppointment.notes || selectedAppointment.reason) && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>REASON / NOTES</Text>
                      <Text style={styles.detailBody}>{selectedAppointment.notes || selectedAppointment.reason}</Text>
                    </View>
                  )}

                  {/* Status */}
                  <View style={[styles.statusBanner, {
                    backgroundColor:
                      selectedAppointment.status === 'confirmed' ? COLORS.successSoft :
                        selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'denied' ? COLORS.errorSoft :
                          COLORS.warningSoft
                  }]}>
                    <Feather name={
                      selectedAppointment.status === 'confirmed' ? 'check-circle' :
                        selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'denied' ? 'x-circle' : 'clock'
                    } size={20} color={
                      selectedAppointment.status === 'confirmed' ? COLORS.success :
                        selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'denied' ? COLORS.error : COLORS.warning
                    } />
                    <Text style={[styles.statusBannerText, {
                      color:
                        selectedAppointment.status === 'confirmed' ? COLORS.success :
                          selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'denied' ? COLORS.error : COLORS.warning
                    }]}>
                      {selectedAppointment.status.toUpperCase()}
                    </Text>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    padding: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textMain,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: COLORS.textSub,
    fontWeight: '600',
    marginTop: 2,
  },

  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 12
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tabItemActive: {
    borderColor: 'transparent',
    ...SHADOW,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSub
  },
  tabTextActive: {
    color: '#FFF'
  },

  content: { flex: 1 },

  // Enhanced Cards
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    ...CARD_SHADOW,
    overflow: 'hidden',
  },
  cardDateBox: {
    borderRadius: 12,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  cardDay: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  cardMonth: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  cardContent: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  cardDoctor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cardDoctorText: {
    fontSize: 13,
    color: COLORS.textSub,
    fontWeight: '500',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontSize: 12,
    color: COLORS.textSub,
    fontWeight: '500'
  },

  // Method Selection
  methodContainer: { padding: 24 },
  methodHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  methodSubheader: {
    fontSize: 13,
    color: COLORS.textSub,
    marginBottom: 20,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    ...CARD_SHADOW,
    overflow: 'hidden',
  },
  methodIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 2,
  },
  methodSub: {
    fontSize: 13,
    color: COLORS.textSub,
    lineHeight: 18,
  },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  aiPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...CARD_SHADOW,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMain,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, paddingBottom: 40, maxHeight: '80%', ...SHADOW
  },
  modalHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center'
  },
  detailSection: { marginBottom: 16 },
  detailLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSub, marginBottom: 4, letterSpacing: 0.5 },
  detailValue: { fontSize: 14, fontWeight: '600', color: COLORS.textMain },
  detailValueLg: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  detailSub: { fontSize: 12, color: COLORS.textSub, marginTop: 1 },
  detailBody: { fontSize: 13, color: COLORS.textMain, lineHeight: 20 },

  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  patientAvatar: {
    width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center'
  },

  detailGrid: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  gridItem: { flex: 1 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: 12, borderRadius: 12, marginTop: 8
  },
  statusBannerText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
});