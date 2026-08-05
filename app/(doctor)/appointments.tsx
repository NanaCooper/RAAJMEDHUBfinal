import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { subscribeToAppointments, updateAppointment } from '../../services/appointments';
import ScaleButton from '../../components/ui/ScaleButton';
import BookingForm from '../../components/appointment/BookingForm';
import { APPOINTMENTS_COMING_SOON, APPOINTMENTS_COMING_SOON_TITLE, APPOINTMENTS_COMING_SOON_BODY } from '../../constants/AppStrings';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

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
  const { session, user } = useAuth();

  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'book'>('upcoming');
  const [bookingMethod, setBookingMethod] = useState<'upload' | 'manual' | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [extractedNotes, setExtractedNotes] = useState<string>('');
  const [markingReportReady, setMarkingReportReady] = useState(false);

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

  const handleToggleReportReady = async (apt: any) => {
    if (!apt?.id) return;
    setMarkingReportReady(true);
    try {
      const newStatus = !apt.reportReady;
      const doctorName = (user as any)?.fullName || (user as any)?.name || 'Radiologist';
      await updateAppointment(apt.id, {
        reportReady: newStatus,
        reportReadyAt: newStatus ? new Date().toISOString() : null,
        reportReadyBy: newStatus ? doctorName : '',
      } as any);
      setSelectedAppointment((prev: any) => prev ? { ...prev, reportReady: newStatus, reportReadyBy: doctorName } : null);
      Alert.alert(
        newStatus ? "Report Marked Ready!" : "Report Status Reset",
        newStatus 
          ? "The front desk and procedure room have been notified that this report is ready." 
          : "Report status has been reset."
      );
    } catch (err: any) {
      console.error("Error updating report status", err);
      Alert.alert("Error", "Could not update report status. Please try again.");
    } finally {
      setMarkingReportReady(false);
    }
  };

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

        // Prefer explicit procedure selected by the doctor
        let scanName = a.specificProcedure || a.procedureName || a.procedureLabel || '';
        if (!scanName) {
          // Fallback to legacy scan type fields
          scanName = 'Procedure';
          if (a.scanType) {
            scanName = a.scanType.name || a.scanType;
            if (scanName === 'General') scanName = 'Procedure';
          } else if (Array.isArray(a.scanTypes) && a.scanTypes.length > 0) {
            scanName = a.scanTypes.map((s: any) => s.name).join(', ');
          }
        }

        return {
          id: a.id,
          date: rawDate ? dayjs(rawDate).format('YYYY-MM-DD') : (a.date || null), // Allow null for TBD
          time: rawDate ? dayjs(rawDate).format('HH:mm') : (a.time || ''),
          doctor: a.doctorName || 'Assigned soon',
          patientName: a.patientDetails ? `${a.patientDetails.firstName} ${a.patientDetails.lastName}` : (a.patientName || 'Guest Patient'), // Try a.patientName too as simple fallback
          status: a.status || 'upcoming',
          activationStatus: a.activationStatus || 'ACTIVATED',
          scanType: { name: scanName },
          branch: a.branch,
          // Full details for modal - ensure patientDetails is safe
          patientDetails: a.patientDetails || {},
          specificScan: a.specificScan || '',
          notes: a.notes || '',
          reason: a.reason || '',
          reportReady: a.reportReady || false,
          reportReadyAt: a.reportReadyAt || null,
          reportReadyBy: a.reportReadyBy || '',
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
    const displayStatus = item.activationStatus === 'PENDING' ? 'Awaiting Arrival' : item.status;
    
    const statusMap: Record<string, { color: string; bg: string; icon: string }> = {
      upcoming: { color: COLORS.primary, bg: COLORS.primarySoft, icon: 'calendar' },
      pending: { color: COLORS.warning, bg: COLORS.warningSoft, icon: 'clock' },
      'Awaiting Arrival': { color: COLORS.warning, bg: COLORS.warningSoft, icon: 'clock' },
      completed: { color: COLORS.success, bg: COLORS.successSoft, icon: 'check-circle' },
      cancelled: { color: COLORS.error, bg: COLORS.errorSoft, icon: 'x-circle' },
    };
    const statusConfig = statusMap[displayStatus] || { color: COLORS.textSub, bg: COLORS.border, icon: 'info' };

    const hasDate = item.date && dayjs(item.date).isValid();

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
            {hasDate ? dayjs(item.date).format('DD') : 'TBD'}
          </Text>
          <Text style={[styles.cardMonth, { color: statusConfig.color }]}>
            {hasDate ? dayjs(item.date).format('MMM') : 'DATE'}
          </Text>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.scanType?.name || 'Consultation'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Feather name={statusConfig.icon as any} size={12} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>{displayStatus}</Text>
            </View>
          </View>

          <View style={styles.cardDoctor}>
            <Feather name="user" size={14} color={COLORS.textSub} />
            <Text style={styles.cardDoctorText}>{item.patientName}</Text>
          </View>

          <View style={styles.cardMeta}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={14} color={COLORS.textSub} />
              <Text style={styles.cardMetaText}>{hasDate ? dayjs(item.date + ' ' + item.time).format('h:mm A') : 'Time TBD'}</Text>
            </View>
            {item.branch && (
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={14} color={COLORS.textSub} />
                <Text style={styles.cardMetaText}>{item.branch}</Text>
              </View>
            )}
          </View>

          {item.reportReady && (
            <View style={{ flexDirection: 'row', items: 'center', gap: 4, backgroundColor: '#F3E8FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginTop: 8 }}>
              <Feather name="check-circle" size={11} color="#7E22CE" />
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#7E22CE' }}>REPORT READY</Text>
            </View>
          )}
        </View>

        <Feather name="chevron-right" size={20} color={COLORS.border} />
      </ScaleButton>
    );
  };

  if (APPOINTMENTS_COMING_SOON) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{APPOINTMENTS_COMING_SOON_TITLE}</Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Feather name="calendar" size={48} color={COLORS.textSub} />
          </View>
          <Text style={styles.emptyText}>{APPOINTMENTS_COMING_SOON_TITLE}</Text>
          <Text style={styles.emptySubtext}>{APPOINTMENTS_COMING_SOON_BODY}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

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
                    <Text style={styles.methodSub}>Upload your doctor&apos;s referral letter for automatic detail extraction</Text>
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
                return !a.date || dayjs(a.date).isSameOrAfter(dayjs(), 'day');
              }
              return a.date && dayjs(a.date).isBefore(dayjs(), 'day');
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
                        {(selectedAppointment.date && dayjs(selectedAppointment.date).isValid())
                          ? dayjs(selectedAppointment.date).format('MMM DD, YYYY')
                          : 'Pending Scheduling'}
                      </Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.detailLabel}>TIME</Text>
                      <Text style={styles.detailValue}>{selectedAppointment.time || 'TBD'}</Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>PROCEDURE</Text>
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
                      selectedAppointment.activationStatus === 'PENDING' ? COLORS.warningSoft :
                      selectedAppointment.status === 'confirmed' ? COLORS.successSoft :
                        selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'denied' ? COLORS.errorSoft :
                          COLORS.warningSoft
                  }]}>
                    <Feather name={
                      selectedAppointment.activationStatus === 'PENDING' ? 'clock' :
                      selectedAppointment.status === 'confirmed' ? 'check-circle' :
                        selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'denied' ? 'x-circle' : 'clock'
                    } size={20} color={
                      selectedAppointment.activationStatus === 'PENDING' ? COLORS.warning :
                      selectedAppointment.status === 'confirmed' ? COLORS.success :
                        selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'denied' ? COLORS.error : COLORS.warning
                    } />
                    <Text style={[styles.statusBannerText, {
                      color:
                        selectedAppointment.activationStatus === 'PENDING' ? COLORS.warning :
                        selectedAppointment.status === 'confirmed' ? COLORS.success :
                          selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'denied' ? COLORS.error : COLORS.warning
                    }]}>
                      {selectedAppointment.activationStatus === 'PENDING' ? 'AWAITING ARRIVAL' : selectedAppointment.status.toUpperCase()}
                    </Text>
                  </View>

                  {/* Radiologist Report Ready Action */}
                  <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderColor: COLORS.border }}>
                    <Text style={styles.detailLabel}>RADIOLOGIST REPORT STATUS</Text>
                    {selectedAppointment.reportReady ? (
                      <View style={{ backgroundColor: '#F3E8FF', padding: 14, borderRadius: 16, borderLeftWidth: 4, borderColor: '#7E22CE', marginTop: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Feather name="check-circle" size={20} color="#7E22CE" />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#6B21A8' }}>Report Marked Ready</Text>
                            <Text style={{ fontSize: 11, color: '#7E22CE', marginTop: 2 }}>Front desk & procedure room notified</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleToggleReportReady(selectedAppointment)}
                          disabled={markingReportReady}
                          style={{ marginTop: 10, alignSelf: 'flex-end' }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '600', color: '#7E22CE', textDecorationLine: 'underline' }}>
                            Unmark Ready
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleToggleReportReady(selectedAppointment)}
                        disabled={markingReportReady}
                        style={{
                          backgroundColor: '#4F46E5',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          paddingVertical: 14,
                          borderRadius: 16,
                          marginTop: 8,
                          shadowColor: '#4F46E5',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.2,
                          shadowRadius: 8,
                          elevation: 3,
                        }}
                      >
                        <Feather name="file-text" size={18} color="#FFF" />
                        <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>
                          {markingReportReady ? "Notifying Front Desk..." : "Mark Report as Ready"}
                        </Text>
                      </TouchableOpacity>
                    )}
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
    paddingHorizontal: 10,
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
    fontSize: 12,
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
    fontSize: 14,
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
    fontSize: 11,
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