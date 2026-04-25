import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Animated, Modal, ScrollView, LayoutAnimation } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { subscribeToAppointments } from '../../services/appointments';
import BookingForm from '../../components/appointment/BookingForm';

dayjs.extend(customParseFormat);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// --- THEME ENGINE ---
const COLORS = {
  primary: "#6366F1",    // Indigo 500
  primaryDark: "#4338CA", // Indigo 700
  primaryLight: "#818CF8", // Indigo 400
  primarySoft: "#EEF2FF", // Indigo 50
  bg: "#F8FAFC",         // Slate 50 (Lighter, cleaner background)
  textMain: "#0F172A",   // Slate 900
  textSub: "#64748B",    // Slate 500
  textMuted: "#94A3B8",  // Slate 400
  success: "#10B981",    // Emerald
  successSoft: "#ECFDF5",
  error: "#EF4444",      // Red
  errorSoft: "#FEF2F2",
  warning: "#F59E0B",    // Amber
  warningSoft: "#FFFBEB",
  border: "#E2E8F0",
  surface: "#FFFFFF",
};

const SHADOW = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.05,
  shadowRadius: 12,
  elevation: 3,
};

export default function Appointments() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session } = useAuth();
  const listRef = useRef<FlatList>(null);

  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'book'>('upcoming');
  const [upcomingFilter, setUpcomingFilter] = useState<'approved' | 'pending'>('approved');
  const [bookingMethod, setBookingMethod] = useState<'upload' | 'manual' | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [extractedNotes, setExtractedNotes] = useState<string>('');
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Parse extracted data
  const extractedDataParam = React.useMemo(() => {
    if (params.extractedData) {
      try {
        return typeof params.extractedData === 'string' ? JSON.parse(params.extractedData) : params.extractedData;
      } catch (e) { console.error("Failed to parse extracted data", e); return null; }
    }
    return null;
  }, [params.extractedData]);


  // --- EFFECTS ---
  useEffect(() => {
    if (params?.tab) setActiveTab(params.tab as any);
    if (extractedDataParam || params.extractedNotes) {
      if (extractedDataParam) {
        setShowReviewModal(true);
      } else {
        setBookingMethod('manual');
      }
      if (params.extractedNotes) setExtractedNotes(params.extractedNotes as string);
    }
  }, [params?.tab, extractedDataParam, params.extractedNotes]);

  useEffect(() => {
    if (!session?.uid) return;
    const unsubscribe = subscribeToAppointments(session.uid, 'patient', async (appts) => {
      const mapped = appts.map((a: any) => {
        // Handle Firestore Timestamp or standard Date/String
        const rawDate = a.startAt && a.startAt.toDate ? a.startAt.toDate() : a.startAt;

        // Handle Scan Type — prefer the actual procedure type over free-text specificScan
        let scanName = 'Scan';
        if (a.scanType) {
          scanName = (typeof a.scanType === 'string' ? a.scanType : a.scanType.name) || 'Scan';
          if (scanName === 'General') scanName = 'Scan';
        } else if (Array.isArray(a.scanTypes) && a.scanTypes.length > 0) {
          scanName = a.scanTypes.map((s: any) => s.name).filter(Boolean).join(', ');
        } else if (a.specificScan) {
          scanName = a.specificScan;
        }

          return {
            id: a.id,
            date: rawDate ? dayjs(rawDate).format('YYYY-MM-DD') : (a.date || null),
            time: rawDate ? dayjs(rawDate).format('HH:mm') : (a.time || ''),
            doctor: a.doctorName || 'Assigned soon',
            status: a.status || 'upcoming',
            scanType: { name: scanName },
            branch: a.branch,
            createdAt: a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt,
            priceGHS: a.priceGHS || null,
            price: a.price ?? null,
          };
      });
      setAppointments(mapped);
    });
    return () => unsubscribe();
  }, [session?.uid]);

  // --- HANDLERS ---
  const handleNavigateToUpload = () => {
    router.push('/(patient)/upload-request');
  };

  const handleTabChange = (tab: 'upcoming' | 'past' | 'book') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    if (tab !== 'book') setBookingMethod(null);
  };

  const upcomingData = React.useMemo(() => {
    if (activeTab !== 'upcoming') return [];
    
    return appointments.filter(a => {
      // EXCLUDE explicitly ended states
      if (['cancelled', 'denied', 'completed'].includes(a.status)) return false;
      
      const isPending = ['pending', 'requested'].includes(a.status);
      if (upcomingFilter === 'pending') return isPending;
      
      // If we made it here, filter is 'approved'
      if (isPending) return false;
      
      if (!a.date) return true;
      const mDate = dayjs(a.date, 'YYYY-MM-DD');
      return mDate.isValid() && mDate.isSameOrAfter(dayjs(), 'day');
    });
  }, [appointments, activeTab, upcomingFilter]);


  // --- COMPONENT: TAB BAR ---
  const TabBar = () => (
    <View style={styles.tabContainer}>
      <View style={styles.tabWrapper}>
        {[
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'past', label: 'History' },
          { key: 'book', label: 'New Request' }
        ].map((t) => {
          const isActive = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabItem]}
              onPress={() => handleTabChange(t.key as any)}
              activeOpacity={0.8}
            >
              {isActive && (
                <Animated.View style={[StyleSheet.absoluteFill, styles.activeTabBg]} />
              )}
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  );

  // --- RENDERERS ---
  const renderAppointmentCard = ({ item }: { item: any }) => {
    const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
      approved: { color: COLORS.success, bg: COLORS.successSoft, label: 'Approved' },
      pending: { color: COLORS.warning, bg: COLORS.warningSoft, label: 'Pending' },
      requested: { color: COLORS.warning, bg: COLORS.warningSoft, label: 'Requested' },
      cancelled: { color: COLORS.error, bg: COLORS.errorSoft, label: 'Cancelled' },
      denied: { color: COLORS.error, bg: COLORS.errorSoft, label: 'Denied' },
      completed: { color: COLORS.textSub, bg: COLORS.border, label: 'Completed' },
    };
    const cfg = statusConfig[item.status] || { color: COLORS.textSub, bg: COLORS.border, label: item.status };
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push({
          pathname: '/(patient)/appointment-details',
          params: { appointment: JSON.stringify(item) },
        })}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.cardTitle}>{item.scanType?.name || 'Scan'}</Text>
              <View style={styles.dateTimeRow}>
                <Feather name="calendar" size={14} color={COLORS.textSub} />
                <Text style={styles.dateTimeText}>{item.date || 'Date TBD'}</Text>
                {item.time ? (
                  <>
                    <Feather name="clock" size={14} color={COLORS.textSub} />
                    <Text style={styles.dateTimeText}>{item.time}</Text>
                  </>
                ) : null}
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.cardFooter}>
            <View style={styles.detailItem}>
              <View style={styles.iconBox}>
                <Feather name="user" size={14} color={COLORS.primary} />
              </View>
              <Text style={styles.detailText}>{item.doctor}</Text>
            </View>
            {item.branch ? (
              <View style={styles.detailItem}>
                <View style={styles.iconBox}>
                  <Feather name="map-pin" size={14} color={COLORS.primary} />
                </View>
                <Text style={styles.detailText}>{item.branch}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // --- MAIN RENDER ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* HEADER */}
      <View style={styles.header}>
        
      </View>

      {/* TAB BAR */}
      <TabBar />

      {/* CONTENT */}
      <View style={styles.content}>
        {activeTab === 'book' ? (
          bookingMethod === 'manual' ? (
            <BookingForm
              onCancel={() => setBookingMethod(null)}
              extractedData={extractedDataParam || (extractedNotes ? { notes: extractedNotes } : undefined)}
            />
          ) : (
            <ScrollView style={styles.methodContainer} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>How would you like to book?</Text>

              {/* Upload Referral - Hero Card */}
              <TouchableOpacity
                style={styles.heroCard}
                onPress={handleNavigateToUpload}
                activeOpacity={0.92}
              >
                <LinearGradient
                  colors={[COLORS.primary, COLORS.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ borderRadius: 28, overflow: 'hidden' }}
                >
                  <View style={styles.circle1} />
                  <View style={styles.circle2} />
                  <View style={styles.heroContent}>
                    <View style={styles.heroTop}>
                      <View style={styles.idIcon}>
                        <Feather name="file-text" size={26} color="#FFF" />
                      </View>
                      <View style={styles.heroBadge}>
                        <Text style={styles.heroBadgeText}>RECOMMENDED</Text>
                      </View>
                    </View>
                    <Text style={styles.heroTitle}>Upload Referral</Text>
                    <Text style={styles.heroDesc}>
                      Snap a photo of your doctor&apos;s referral letter. Our AI will automatically extract the details for you.
                    </Text>
                    <View style={styles.heroArrow}>
                      <Text style={styles.heroArrowText}>Upload Now</Text>
                      <Feather name="arrow-right" size={18} color={COLORS.primaryDark} />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Manual Entry */}
              <TouchableOpacity
                style={styles.manualCard}
                onPress={() => setBookingMethod('manual')}
                activeOpacity={0.85}
              >
                <View style={styles.manualIcon}>
                  <Feather name="edit-3" size={22} color={COLORS.primary} />
                </View>
                <View style={styles.manualContent}>
                  <Text style={styles.manualTitle}>Fill in Manually</Text>
                  <Text style={styles.manualDesc}>Enter your appointment details yourself without a referral.</Text>
                </View>
                <Feather name="chevron-right" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>

              {/* Info box */}
              <View style={styles.infoBox}>
                <Feather name="info" size={20} color={COLORS.primaryDark} />
                <Text style={styles.infoText}>
                  All appointment requests are reviewed and confirmed by our staff. You&apos;ll receive a notification once approved.
                </Text>
              </View>
            </ScrollView>
          )
        ) : (
          activeTab === 'upcoming' ? (
            <View style={{ flex: 1 }}>
              <View style={styles.subTabContainer}>
                <TouchableOpacity 
                  style={[styles.subTabItem, upcomingFilter === 'approved' && styles.subTabItemActive]} 
                  onPress={() => setUpcomingFilter('approved')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.subTabText, upcomingFilter === 'approved' && styles.subTabTextActive]}>Approved</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.subTabItem, upcomingFilter === 'pending' && styles.subTabItemActive]} 
                  onPress={() => setUpcomingFilter('pending')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.subTabText, upcomingFilter === 'pending' && styles.subTabTextActive]}>Pending</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                ref={listRef}
                data={upcomingData}
                keyExtractor={i => i.id}
                renderItem={renderAppointmentCard}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIconBg}>
                      <Feather name="calendar" size={48} color={COLORS.textMuted} />
                    </View>
                    <Text style={styles.emptyText}>No {upcomingFilter} appointments</Text>
                    <Text style={styles.emptySubtext}>
                      {upcomingFilter === 'approved' 
                        ? 'You have no upcoming approved appointments.' 
                        : 'You have no pending appointment requests.'}
                    </Text>
                  </View>
                }
              />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={appointments.filter(a => {
                const isPastDate = a.date && dayjs(a.date, 'YYYY-MM-DD').isBefore(dayjs(), 'day');
                const isEndedStatus = ['cancelled', 'denied', 'completed'].includes(a.status);
                return isPastDate || isEndedStatus;
              })}
              keyExtractor={i => i.id}
              renderItem={renderAppointmentCard}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconBg}>
                    <Feather name="check-circle" size={48} color={COLORS.textMuted} />
                  </View>
                  <Text style={styles.emptyText}>No past visits</Text>
                  <Text style={styles.emptySubtext}>
                    Your past appointment history will appear here once you complete a visit.
                  </Text>
                </View>
              }
            />
          )
        )}
      </View>

      {/* VERIFICATION MODAL */}
      <Modal visible={showReviewModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewIconBox}>
                <Feather name="check" size={32} color={COLORS.success} />
              </View>
              <Text style={styles.reviewTitle}>Analysis Complete</Text>
              <Text style={styles.reviewSub}>Please review the extracted details below</Text>
            </View>

            <ScrollView style={styles.reviewContent} contentContainerStyle={{ gap: 16 }} showsVerticalScrollIndicator={false}>
              {extractedDataParam && (
                <>
                  <View style={styles.reviewSection}>
                    <Text style={styles.reviewSectionTitle}>Patient</Text>
                    <View style={styles.reviewRow}>
                      <View style={styles.reviewField}>
                        <Text style={styles.reviewLabel}>Name</Text>
                        <Text style={styles.reviewValue}>{extractedDataParam.patientName || 'Not detected'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.reviewSection}>
                    <Text style={styles.reviewSectionTitle}>Request</Text>
                    <View style={styles.reviewField}>
                      <Text style={styles.reviewLabel}>Type</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {extractedDataParam.scanTypes?.length > 0 ? (
                          extractedDataParam.scanTypes.map((t: string, i: number) => (
                            <View key={i} style={styles.tagPill}>
                              <Text style={styles.tagText}>{t}</Text>
                            </View>
                          ))
                        ) : <Text style={styles.reviewValue}>General</Text>}
                      </View>
                    </View>
                    <View style={styles.reviewField}>
                      <Text style={styles.reviewLabel}>Referral Source</Text>
                      <Text style={styles.reviewValue}>{extractedDataParam.referral || 'Not detected'}</Text>
                    </View>
                    <View style={styles.reviewField}>
                      <Text style={styles.reviewLabel}>Notes</Text>
                      <Text style={styles.reviewValue}>{extractedDataParam.reason || extractedDataParam.notes || 'None'}</Text>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.reviewActions}>
              <TouchableOpacity
                style={styles.reviewBtnSecondary}
                onPress={() => { setShowReviewModal(false); router.setParams({ extractedData: undefined }); }}
              >
                <Text style={styles.reviewBtnTextSecondary}>Discard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.reviewBtnPrimary}
                onPress={() => { setShowReviewModal(false); setBookingMethod('manual'); }}
              >
                <Text style={styles.reviewBtnTextPrimary}>Continue</Text>
                <Feather name="arrow-right" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  headerTitle: { fontSize: 32, fontWeight: '800', color: COLORS.textMain, letterSpacing: -1, lineHeight: 40 },
  headerSub: { fontSize: 15, color: COLORS.textSub, fontWeight: '500' },
  headerProfile: { ...SHADOW, shadowOpacity: 0.15 },
  profileGradient: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  profileInitials: { fontSize: 20, fontWeight: '700', color: '#FFF' },

  // Tabs
  tabContainer: { paddingHorizontal: 24, marginBottom: 24 },
  tabWrapper: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 20,
    padding: 4,
    height: 56,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    zIndex: 1,
  },
  activeTabBg: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    margin: 4,
    ...SHADOW,
    shadowOpacity: 0.1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSub,
  },
  tabTextActive: {
    color: COLORS.textMain,
    fontWeight: '700',
  },

  // Sub Tabs
  subTabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 12,
  },
  subTabItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  subTabItemActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primaryLight,
  },
  subTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSub,
  },
  subTabTextActive: {
    color: COLORS.primaryDark,
  },

  // Content
  content: { flex: 1 },
  listContainer: { paddingHorizontal: 24, paddingBottom: 100, paddingTop: 4 },

  // Updated Card Styles
  card: {
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    ...SHADOW,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.surface, // Cleaner border
  },
  placeholderCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderStyle: 'dashed'
  },
  placeholderText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
    fontStyle: 'italic'
  },
  cardContent: { padding: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerLeft: { flex: 1, marginRight: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textMain, marginBottom: 6 },
  dateTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateTimeText: { fontSize: 14, color: COLORS.textSub, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  cardDivider: { height: 1, backgroundColor: COLORS.border, marginBottom: 16, opacity: 0.6 },

  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  detailText: { fontSize: 14, color: COLORS.textMain, fontWeight: '500' },

  // Booking Method
  methodContainer: { padding: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textMain, marginBottom: 20 },

  heroCard: {
    borderRadius: 28,
    marginBottom: 20,
    ...SHADOW,
    shadowColor: COLORS.primary,
  },
  circle1: { position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.1)' },
  circle2: { position: 'absolute', bottom: -50, left: -20, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' },

  heroContent: { padding: 28, gap: 24 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  idIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  heroBadge: { backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  heroBadgeText: { color: COLORS.primaryDark, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#FFF' },
  heroDesc: { fontSize: 14, color: 'rgba(255,255,255,0.9)', maxWidth: '90%', lineHeight: 20, fontWeight: '500' },
  heroArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 12,
    ...SHADOW,
    shadowOpacity: 0.2
  },
  heroArrowText: {
    color: COLORS.primaryDark,
    fontWeight: '800',
    fontSize: 14
  },

  manualCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 24,
    ...SHADOW,
    shadowOpacity: 0.03
  },
  manualIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', marginRight: 18 },
  manualContent: { flex: 1 },
  manualTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textMain, marginBottom: 4 },
  manualDesc: { fontSize: 13, color: COLORS.textSub, lineHeight: 18 },

  infoBox: { flexDirection: 'row', gap: 14, backgroundColor: COLORS.primarySoft, padding: 20, borderRadius: 20, alignItems: 'center' },
  infoText: { flex: 1, fontSize: 14, color: COLORS.primaryDark, lineHeight: 20, fontWeight: '500' },

  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIconBg: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', marginBottom: 24, opacity: 0.5 },
  emptyText: { fontSize: 20, fontWeight: '800', color: COLORS.textMain, marginBottom: 12 },
  emptySubtext: { fontSize: 15, color: COLORS.textSub, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  emptyAction: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 28, backgroundColor: COLORS.primary, borderRadius: 16, ...SHADOW, shadowColor: COLORS.primary },
  emptyActionText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  // Section Header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 24, paddingHorizontal: 4 },
  sectionIndicator: { width: 4, height: 18, borderRadius: 2, marginRight: 8 },
  sectionTitleText: { fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Review Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'center', padding: 20 },
  reviewCard: { backgroundColor: '#FFF', borderRadius: 32, padding: 28, maxHeight: '85%', ...SHADOW },
  reviewHeader: { alignItems: 'center', marginBottom: 24 },
  reviewIconBox: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.successSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 4, borderColor: '#F0FDF4' },
  reviewTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textMain, marginBottom: 6 },
  reviewSub: { fontSize: 15, color: COLORS.textSub },
  reviewContent: { marginBottom: 28 },

  reviewSection: { marginBottom: 20, backgroundColor: COLORS.bg, padding: 16, borderRadius: 20 },
  reviewSectionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.textSub, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
  reviewRow: { flexDirection: 'row', gap: 16, marginBottom: 0 },
  reviewField: { flex: 1 },
  reviewLabel: { fontSize: 11, color: COLORS.textSub, fontWeight: '600', marginBottom: 4 },
  reviewValue: { fontSize: 15, color: COLORS.textMain, fontWeight: '700' },

  tagPill: { backgroundColor: COLORS.primarySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, alignSelf: 'flex-start' },
  tagText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  reviewActions: { flexDirection: 'row', gap: 12 },
  reviewBtnSecondary: { flex: 1, padding: 18, borderRadius: 20, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  reviewBtnTextSecondary: { color: COLORS.textMain, fontWeight: '700', fontSize: 15 },
  reviewBtnPrimary: { flex: 2, flexDirection: 'row', gap: 8, padding: 18, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', ...SHADOW },
  reviewBtnTextPrimary: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});




