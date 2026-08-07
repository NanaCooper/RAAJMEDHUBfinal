import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  UIManager,
  LayoutAnimation
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

import { useAuth } from '../../hooks/useAuth';
import { subscribeToAppointments } from '../../services/appointments';
import { calculateReferralPayout } from '../../services/referrals';
import type { Appointment } from '../../types/appointment';
import { APPOINTMENTS_COMING_SOON } from '../../constants/AppStrings';

// Enable LayoutAnimation on Android for smooth tab switching
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

dayjs.extend(isSameOrAfter);

// --- 🎨 Ultra-Premium Financial Theme ---
const COLORS = {
  bg: '#F4F7FA',
  surface: '#FFFFFF',
  primary: '#4F46E5',
  primarySoft: '#EEF2FF',
  success: '#10B981',
  successSoft: '#D1FAE5',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  textMain: '#1E293B',
  textSub: '#64748B',
  border: '#E2E8F0',
};

const SHADOW = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.04,
  shadowRadius: 12,
  elevation: 3,
};

const CARD_SHADOW = {
  shadowColor: COLORS.primary,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 5,
};

function toDateSafe(value: any): Date | null {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

const normalizeStatus = (value?: string) =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const COMPLETED_STATUSES = new Set([
  'completed',
  'procedure_done',
  'report_uploaded',
]);
const CANCELLED_STATUSES = new Set(['cancelled', 'denied']);

type TimeFilter = 'day' | 'week' | 'month' | 'year' | 'all';

export default function ReferralsScreen() {
  const { session } = useAuth();

  // Base States
  const [items, setItems] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  // New State for Completed Time Filter
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  const animateLayout = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const handleTabChange = (tab: 'pending' | 'completed') => {
    animateLayout();
    setActiveTab(tab);
  };

  const handleFilterChange = (filter: TimeFilter) => {
    animateLayout();
    setTimeFilter(filter);
  };

  useEffect(() => {
    if (!session?.uid) return;
    const unsub = subscribeToAppointments(session.uid, 'doctor', setItems, (err) => {
      console.log('[referrals] subscribe error', err);
    });
    return () => unsub && unsub();
  }, [session?.uid]);

  // Original Logic + New Time-Based Grouping
  const {
    pendingTotal,
    pendingReferrals,
    completedReferrals,
    totalsByTime
  } = useMemo(() => {
    const norm = items
      .map((appt) => {
        const status = appt.status || 'pending';
        const statusKey = normalizeStatus(status);
        const isCompleted = COMPLETED_STATUSES.has(statusKey);
        const isCancelled = CANCELLED_STATUSES.has(statusKey);
        const isPending = !isCompleted && !isCancelled;

        let patientName = appt.patientDetails?.fullName ||
          (appt.patientDetails?.firstName && appt.patientDetails?.lastName
            ? `${appt.patientDetails.firstName} ${appt.patientDetails.lastName}`
            : (appt.patientDetails?.firstName || appt.patientDetails?.lastName || 'Client'));

        if (patientName === 'Client' && (appt as any).patientName) {
          patientName = (appt as any).patientName;
        }

        const { total, items: payoutItems } = calculateReferralPayout(appt);

        return {
          id: appt.id,
          patientName,
          procedureLabel: payoutItems.length > 0 ? payoutItems.map(i => i.label).join(', ') : (appt.procedureName || appt.serviceName || appt.specificProcedure || 'General Referral'),
          amountGhs: total,
          _createdAt: toDateSafe(appt.createdAt || appt.startAt) || new Date(),
          status,
          activationStatus: (appt as any).activationStatus || 'ACTIVATED',
          isCompleted,
          isPending,
        };
      })
      .sort((a, b) => b._createdAt.getTime() - a._createdAt.getTime());

    const pending = norm.filter((r) => r.isPending);
    const completed = norm.filter((r) => r.isCompleted);

    const pendingSum = pending.reduce((sum, r) => sum + (Number(r.amountGhs) || 0), 0);
    const completedSum = completed.reduce((sum, r) => sum + (Number(r.amountGhs) || 0), 0);

    // Calculate totals for our new horizontal swipe cards
    const now = dayjs();
    let dayTotal = 0, weekTotal = 0, monthTotal = 0, yearTotal = 0;

    completed.forEach((r) => {
      const amt = Number(r.amountGhs) || 0;
      if (dayjs(r._createdAt).isSame(now, 'day')) dayTotal += amt;
      if (dayjs(r._createdAt).isSame(now, 'week')) weekTotal += amt;
      if (dayjs(r._createdAt).isSame(now, 'month')) monthTotal += amt;
      if (dayjs(r._createdAt).isSame(now, 'year')) yearTotal += amt;
    });

    return {
      pendingTotal: pendingSum,
      completedTotal: completedSum,
      pendingReferrals: pending,
      completedReferrals: completed,
      totalsByTime: { day: dayTotal, week: weekTotal, month: monthTotal, year: yearTotal, all: completedSum }
    };
  }, [items]);

  // Filter completed referrals based on selected swipe card
  const displayedCompleted = useMemo(() => {
    if (timeFilter === 'all') return completedReferrals;
    const now = dayjs();
    return completedReferrals.filter(r => dayjs(r._createdAt).isSame(now, timeFilter));
  }, [completedReferrals, timeFilter]);

  if (APPOINTMENTS_COMING_SOON) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconBox}>
            <Feather name="lock" size={24} color={COLORS.textSub} />
          </View>
          <Text style={styles.emptyTitle}>Coming Soon</Text>
          <Text style={styles.emptySub}>The referrals feature will be available shortly.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session?.uid) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconBox}>
            <Feather name="lock" size={24} color={COLORS.textSub} />
          </View>
          <Text style={styles.emptyTitle}>Sign in required</Text>
          <Text style={styles.emptySub}>Please sign in as a doctor to view referrals and payouts.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* --- Top Bar & Segmented Control --- */}
      <View style={styles.topRow}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'pending' && styles.tabPillActive]}
            onPress={() => handleTabChange('pending')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>Pending</Text>
            <View style={[styles.tabCount, activeTab === 'pending' && styles.tabCountActive]}>
              <Text style={[styles.tabCountText, activeTab === 'pending' && styles.tabCountTextActive]}>{pendingReferrals.length}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'completed' && styles.tabPillActive]}
            onPress={() => handleTabChange('completed')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>Completed</Text>
            <View style={[styles.tabCount, activeTab === 'completed' && styles.tabCountActive]}>
              <Text style={[styles.tabCountText, activeTab === 'completed' && styles.tabCountTextActive]}>{completedReferrals.length}</Text>
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.helpBtn} onPress={() => setShowInfo(true)} activeOpacity={0.7}>
          <Feather name="info" size={18} color={COLORS.textMain} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeTab === 'pending' ? pendingReferrals : displayedCompleted}
        keyExtractor={(item: any) => item.id || `${item.patientName}_${item._createdAt.getTime()}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          activeTab === 'pending' ? (
            // --- Single "Wallet" Summary Card for Pending ---
            <View style={styles.summaryCardSingle}>
              <View style={styles.summaryTopRow}>
                <View style={styles.summaryIconRing}>
                  <Feather name="clock" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.summaryBadge}>
                  <Text style={styles.summaryNote}>Estimated Value</Text>
                </View>
              </View>

              <View style={styles.summaryBalanceRow}>
                <Text style={styles.summaryCurrency}>GHS</Text>
                <Text style={styles.summaryValue}>{pendingTotal.toFixed(2)}</Text>
              </View>
            </View>
          ) : (
            // --- Swipeable Horizontal Cards for Completed ---
            <View style={styles.horizontalCardsWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalCardsScroll}
                decelerationRate="fast"
                snapToInterval={140 + 12} // Card width + gap
              >
                {[
                  { id: 'day', label: 'Today', amount: totalsByTime.day },
                  { id: 'week', label: 'This Week', amount: totalsByTime.week },
                  { id: 'month', label: 'This Month', amount: totalsByTime.month },
                  { id: 'year', label: 'This Year', amount: totalsByTime.year },
                  { id: 'all', label: 'All Time', amount: totalsByTime.all },
                ].map((filter) => {
                  const isActive = timeFilter === filter.id;
                  return (
                    <TouchableOpacity
                      key={filter.id}
                      activeOpacity={0.8}
                      onPress={() => handleFilterChange(filter.id as TimeFilter)}
                      style={[styles.timeCard, isActive && styles.timeCardActive]}
                    >
                      <View style={styles.timeCardHeader}>
                        <Feather
                          name={isActive ? "check-circle" : "bar-chart-2"}
                          size={14}
                          color={isActive ? COLORS.success : COLORS.textSub}
                        />
                        <Text style={[styles.timeCardLabel, isActive && styles.timeCardLabelActive]}>
                          {filter.label}
                        </Text>
                      </View>
                      <View style={styles.timeCardAmountRow}>
                        <Text style={[styles.timeCardCurrency, isActive && styles.timeCardCurrencyActive]}>GHS</Text>
                        <Text style={[styles.timeCardAmount, isActive && styles.timeCardAmountActive]} numberOfLines={1}>
                          {filter.amount.toFixed(2)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>
          )
        }
        renderItem={({ item }: { item: any }) => (
          // --- Financial List Item ---
          <TouchableOpacity
            style={styles.rowCard}
            activeOpacity={0.7}
            onPress={() => setSelectedAppointment(items.find(a => a.id === item.id) || null)}
          >
            <View style={styles.rowAvatar}>
              <Text style={styles.rowAvatarText}>{(item.patientName?.charAt(0) || 'P').toUpperCase()}</Text>
            </View>

            <View style={styles.rowContent}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.patientName}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>{item.procedureLabel}</Text>
              <View style={styles.rowMetaRow}>
                <Feather name="calendar" size={12} color={COLORS.textSub} style={{ marginRight: 4 }} />
                <Text style={styles.rowDate}>{dayjs(item._createdAt).format('MMM D, YYYY')}</Text>
              </View>
            </View>

            <View style={styles.rowRight}>
              <Text style={[styles.amountText, activeTab === 'completed' && { color: COLORS.success }]}>
                +{(Number(item.amountGhs) || 0).toFixed(2)}
              </Text>
              {activeTab === 'pending' ? (
                <View style={styles.pendingPill}>
                  <Text style={styles.pendingText}>Pending</Text>
                </View>
              ) : (
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>Paid</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconBox}>
              <Feather name={activeTab === 'pending' ? "inbox" : "award"} size={22} color={COLORS.textSub} />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === 'pending' ? 'No pending referrals' : `No completed payouts for ${timeFilter}`}
            </Text>
            <Text style={styles.emptySub}>
              {activeTab === 'pending' ? 'New patient referrals will appear here.' : 'Completed procedures will move here for payout.'}
            </Text>
          </View>
        }
      />

      {/* --- Appointment Details Modal --- */}
      <Modal visible={!!selectedAppointment} transparent animationType="slide" onRequestClose={() => setSelectedAppointment(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Referral Details</Text>
              <TouchableOpacity onPress={() => setSelectedAppointment(null)} style={styles.closeBtn}>
                <Feather name="x" size={20} color={COLORS.textMain} />
              </TouchableOpacity>
            </View>

            {selectedAppointment && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

                {/* Financial Status Banner */}
                {(() => {
                  const statusKey = normalizeStatus(selectedAppointment.status);
                  const isComp = COMPLETED_STATUSES.has(statusKey);
                  const isCanc = CANCELLED_STATUSES.has(statusKey);
                  const isPendAct = (selectedAppointment as any).activationStatus === 'PENDING';

                  let bgColor = COLORS.warningSoft;
                  let iconColor = COLORS.warning;
                  let iconName = 'clock';
                  let textStr = 'PAYMENT PENDING';

                  if (isPendAct) {
                    bgColor = COLORS.warningSoft;
                    iconColor = COLORS.warning;
                    iconName = 'clock';
                    textStr = 'AWAITING ARRIVAL';
                  } else if (isComp) {
                    bgColor = COLORS.successSoft;
                    iconColor = COLORS.success;
                    iconName = 'check-circle';
                    textStr = 'PAYOUT CONFIRMED';
                  } else if (isCanc) {
                    bgColor = COLORS.dangerSoft;
                    iconColor = COLORS.danger;
                    iconName = 'x-circle';
                    textStr = 'CANCELLED';
                  }

                  return (
                    <View style={[styles.statusBanner, { backgroundColor: bgColor }]}>
                      <Feather name={iconName as any} size={16} color={iconColor} />
                      <Text style={[styles.statusBannerText, { color: iconColor }]}>{textStr}</Text>
                    </View>
                  );
                })()}

                {/* Patient Info */}
                <View style={styles.detailCard}>
                  <Text style={styles.detailLabel}>CLIENT INFO</Text>
                  <View style={styles.patientRow}>
                    <View style={styles.patientAvatarLg}>
                      <Feather name="user" size={18} color={COLORS.primary} />
                    </View>
                    <View>
                      <Text style={styles.detailValueLg}>
                        {selectedAppointment.patientDetails?.fullName ||
                          `${selectedAppointment.patientDetails?.firstName || ''} ${selectedAppointment.patientDetails?.lastName || ''}`.trim() ||
                          'Client'}
                      </Text>
                      <Text style={styles.detailSub}>{selectedAppointment.patientDetails?.phone || 'No contact provided'}</Text>
                    </View>
                  </View>
                </View>

                {/* Appointment Info */}
                <View style={styles.detailGrid}>
                  <View style={styles.detailCardHalf}>
                    <Text style={styles.detailLabel}>DATE</Text>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.createdAt ? dayjs(toDateSafe(selectedAppointment.createdAt)).format('MMM DD, YYYY') : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.detailCardHalf}>
                    <Text style={styles.detailLabel}>TIME</Text>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.createdAt ? dayjs(toDateSafe(selectedAppointment.createdAt)).format('h:mm A') : 'N/A'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailCard}>
                  <Text style={styles.detailLabel}>REQUESTED PROCEDURE</Text>
                  <Text style={styles.detailValue}>
                    {selectedAppointment.specificProcedure || selectedAppointment.procedureName || 'General Procedure'}
                  </Text>
                </View>

                {(selectedAppointment.notes || (selectedAppointment as any).reason) && (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>SERVICE NOTES</Text>
                    <Text style={styles.detailBody}>{selectedAppointment.notes || (selectedAppointment as any).reason}</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* --- Info Modal --- */}
      <Modal visible={showInfo} transparent animationType="fade" onRequestClose={() => setShowInfo(false)}>
        <View style={styles.infoOverlay}>
          <TouchableOpacity style={styles.infoBackdrop} activeOpacity={1} onPress={() => setShowInfo(false)} />
          <View style={styles.infoSheet}>
            <View style={styles.modalDragHandle} />
            <View style={styles.infoHeader}>
              <Text style={styles.infoTitle}>How payouts work</Text>
              <TouchableOpacity onPress={() => setShowInfo(false)} style={styles.closeBtn}>
                <Feather name="x" size={18} color={COLORS.textMain} />
              </TouchableOpacity>
            </View>

            <View style={styles.infoStepBox}>
              <View style={styles.infoStep}>
                <View style={styles.infoIconRing}><Feather name="send" size={14} color={COLORS.primary} /></View>
                <Text style={styles.infoText}>You submit a referral with the requested procedure for the patient.</Text>
              </View>
              <View style={styles.infoStepLine} />
              <View style={styles.infoStep}>
                <View style={styles.infoIconRing}><Feather name="clock" size={14} color={COLORS.primary} /></View>
                <Text style={styles.infoText}>Pending referrals show your estimated payout based on standard procedure rates.</Text>
              </View>
              <View style={styles.infoStepLine} />
              <View style={styles.infoStep}>
                <View style={styles.infoIconRing}><Feather name="check-circle" size={14} color={COLORS.primary} /></View>
                <Text style={styles.infoText}>Once the facility marks the procedure as completed, it moves to the Completed tab.</Text>
              </View>
              <View style={styles.infoStepLine} />
              <View style={styles.infoStep}>
                <View style={[styles.infoIconRing, { backgroundColor: COLORS.successSoft }]}>
                  <Feather name="dollar-sign" size={14} color={COLORS.success} />
                </View>
                <Text style={styles.infoText}>Completed referrals count toward your official confirmed payout total.</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  helpBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
    shadowOpacity: 0.02,
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabPillActive: {
    backgroundColor: COLORS.primary,
    ...CARD_SHADOW,
    shadowOpacity: 0.15,
    elevation: 3,
  },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.textSub },
  tabTextActive: { color: '#FFFFFF' },
  tabCount: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabCountActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tabCountText: { fontSize: 11, fontWeight: '700', color: COLORS.textSub },
  tabCountTextActive: { color: '#FFFFFF' },

  listContent: { paddingHorizontal: 16, paddingBottom: 30, paddingTop: 8 },

  // Wallet Summary Card (Pending)
  summaryCardSingle: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 20,
    ...CARD_SHADOW,
  },
  summaryTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  summaryIconRing: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBadge: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  summaryNote: { fontSize: 10, fontWeight: '700', color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryBalanceRow: { flexDirection: 'row', alignItems: 'flex-start' },
  summaryCurrency: { fontSize: 15, fontWeight: '700', color: COLORS.textSub, marginTop: 4, marginRight: 4 },
  summaryValue: { fontSize: 28, fontWeight: '800', color: COLORS.textMain, letterSpacing: -0.5 },

  // Swipeable Time Cards (Completed)
  horizontalCardsWrapper: {
    marginHorizontal: -16,
    marginBottom: 20,
  },
  horizontalCardsScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  timeCard: {
    width: 140,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOW,
    shadowOpacity: 0.02,
  },
  timeCardActive: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.successSoft,
  },
  timeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  timeCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSub,
    textTransform: 'uppercase',
  },
  timeCardLabelActive: {
    color: COLORS.success,
  },
  timeCardAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timeCardCurrency: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSub,
    marginTop: 2,
    marginRight: 4,
  },
  timeCardCurrencyActive: {
    color: COLORS.success,
  },
  timeCardAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: -0.5,
    flex: 1,
  },
  timeCardAmountActive: {
    color: COLORS.success,
  },

  // List Rows
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
    ...SHADOW,
    shadowOpacity: 0.02,
  },
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowAvatarText: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  rowContent: { flex: 1, marginRight: 8 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 2 },
  rowSub: { fontSize: 12, fontWeight: '500', color: COLORS.textSub, marginBottom: 4 },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center' },
  rowDate: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },

  rowRight: { alignItems: 'flex-end', justifyContent: 'center' },
  amountText: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginBottom: 6 },

  statusPill: { backgroundColor: COLORS.successSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '800', color: COLORS.success, textTransform: 'uppercase', letterSpacing: 0.5 },
  pendingPill: { backgroundColor: COLORS.warningSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pendingText: { fontSize: 10, fontWeight: '800', color: COLORS.warning, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Empty State
  emptyWrap: { paddingVertical: 40, alignItems: 'center', paddingHorizontal: 20 },
  emptyIconBox: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border, ...SHADOW },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textMain, textAlign: 'center', marginBottom: 6 },
  emptySub: { fontSize: 13, fontWeight: '500', color: COLORS.textSub, textAlign: 'center', lineHeight: 20 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingTop: 12,
    maxHeight: '85%',
    ...CARD_SHADOW
  },
  modalDragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain, letterSpacing: -0.2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border
  },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: 12, borderRadius: 14, marginBottom: 16
  },
  statusBannerText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  detailCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  detailCardHalf: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  detailLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textSub, marginBottom: 6, letterSpacing: 0.5 },
  detailValue: { fontSize: 13, fontWeight: '600', color: COLORS.textMain },
  detailValueLg: { fontSize: 15, fontWeight: '700', color: COLORS.textMain, marginBottom: 2 },
  detailSub: { fontSize: 12, color: COLORS.textSub },
  detailBody: { fontSize: 13, color: COLORS.textMain, lineHeight: 20 },

  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  patientAvatarLg: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center'
  },

  // Info Modal
  infoOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.5)' },
  infoBackdrop: { flex: 1 },
  infoSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingTop: 12,
    paddingBottom: 40,
    ...CARD_SHADOW,
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  infoTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain },

  infoStepBox: { backgroundColor: COLORS.bg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  infoStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoIconRing: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, fontSize: 12, fontWeight: '500', color: COLORS.textMain, lineHeight: 18, marginTop: 4 },
  infoStepLine: { width: 2, height: 16, backgroundColor: COLORS.border, marginLeft: 12, marginVertical: 4 },
});