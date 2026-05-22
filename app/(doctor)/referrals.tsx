import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

import { useAuth } from '../../hooks/useAuth';
import { subscribeToAppointments } from '../../services/appointments';
import { calculateReferralPayout } from '../../services/referrals';
import type { Appointment } from '../../types/appointment';

dayjs.extend(isSameOrAfter);

const COLORS = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  primary: '#4F46E5',
  primarySoft: '#EEF2FF',
  textMain: '#0F172A',
  textSub: '#64748B',
  border: '#E2E8F0',
};

const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
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

export default function ReferralsScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  useEffect(() => {
    if (!session?.uid) return;
    const unsub = subscribeToAppointments(session.uid, 'doctor', setItems, (err) => {
      console.log('[referrals] subscribe error', err);
    });
    return () => unsub && unsub();
  }, [session?.uid]);

  const { pendingTotal, completedTotal, pendingReferrals, completedReferrals } = useMemo(() => {
    const norm = items
      .map((appt) => {
        const status = appt.status || 'pending';
        const statusKey = normalizeStatus(status);
        const isCompleted = COMPLETED_STATUSES.has(statusKey);
        const isCancelled = CANCELLED_STATUSES.has(statusKey);
        const isPending = !isCompleted && !isCancelled;
        // Find best patient name
        let patientName = appt.patientDetails?.fullName || 
                         (appt.patientDetails?.firstName && appt.patientDetails?.lastName 
                           ? `${appt.patientDetails.firstName} ${appt.patientDetails.lastName}` 
                           : (appt.patientDetails?.firstName || appt.patientDetails?.lastName || 'Patient'));
        
        if (patientName === 'Patient' && (appt as any).patientName) {
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
          isCompleted,
          isPending,
        };
      })
      .sort((a, b) => b._createdAt.getTime() - a._createdAt.getTime());

    const pending = norm.filter((r) => r.isPending);
    const completed = norm.filter((r) => r.isCompleted);

    const pendingSum = pending.reduce((sum, r) => sum + (Number(r.amountGhs) || 0), 0);
    const completedSum = completed.reduce((sum, r) => sum + (Number(r.amountGhs) || 0), 0);

    return {
      pendingTotal: pendingSum,
      completedTotal: completedSum,
      pendingReferrals: pending,
      completedReferrals: completed,
    };
  }, [items]);

  if (!session?.uid) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Sign in required</Text>
          <Text style={styles.emptySub}>Please sign in as a doctor to view referrals.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topRow}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'pending' && styles.tabPillActive]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>Pending</Text>
            <View style={[styles.tabCount, activeTab === 'pending' && styles.tabCountActive]}>
              <Text style={[styles.tabCountText, activeTab === 'pending' && styles.tabCountTextActive]}>{pendingReferrals.length}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'completed' && styles.tabPillActive]}
            onPress={() => setActiveTab('completed')}
          >
            <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>Completed</Text>
            <View style={[styles.tabCount, activeTab === 'completed' && styles.tabCountActive]}>
              <Text style={[styles.tabCountText, activeTab === 'completed' && styles.tabCountTextActive]}>{completedReferrals.length}</Text>
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.helpBtn} onPress={() => setShowInfo(true)}>
          <Feather name="help-circle" size={18} color={COLORS.textSub} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeTab === 'pending' ? pendingReferrals : completedReferrals}
        keyExtractor={(item: any) => item.id || `${item.patientName}_${item._createdAt.getTime()}`}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.summaryCardSingle}>
            <Text style={styles.summaryLabel}>{activeTab === 'pending' ? 'Pending value' : 'Completed payout'}</Text>
            <Text style={styles.summaryValue}>GHS {activeTab === 'pending' ? pendingTotal : completedTotal}</Text>
            <Text style={styles.summaryNote}>{activeTab === 'pending' ? 'Estimated' : 'Confirmed'}</Text>
          </View>
        }
        renderItem={({ item }: { item: any }) => (
          <TouchableOpacity
            style={styles.rowCard}
            activeOpacity={0.7}
            onPress={() => {
              const fullAppt = items.find(a => a.id === item.id);
              if (fullAppt) setSelectedAppointment(fullAppt);
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.patientName}</Text>
              <Text style={styles.rowSub}>{item.procedureLabel} • {dayjs(item._createdAt).format('MMM D, YYYY')}</Text>
            </View>
            <View style={styles.amountPill}>
              <Text style={styles.amountText}>GHS {Number(item.amountGhs) || 0}</Text>
            </View>
            {activeTab === 'pending' ? (
              <View style={styles.pendingPill}>
                <Text style={styles.pendingText}>Estimated</Text>
              </View>
            ) : (
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>Completed</Text>
              </View>
            )}
            <Feather name="chevron-right" size={16} color={COLORS.border} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{activeTab === 'pending' ? 'No pending referrals' : 'No completed referrals yet'}</Text>
            <Text style={styles.emptySub}>{activeTab === 'pending' ? 'New referrals appear here.' : 'Payouts appear after completion.'}</Text>
          </View>
        }
      />
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
                      <Text style={styles.detailValueLg}>
                        {selectedAppointment.patientDetails?.fullName || 
                         `${selectedAppointment.patientDetails?.firstName || ''} ${selectedAppointment.patientDetails?.lastName || ''}`.trim() || 
                         'Patient'}
                      </Text>
                      <Text style={styles.detailSub}>{selectedAppointment.patientDetails?.phone || 'No phone'}</Text>
                    </View>
                  </View>
                </View>

                {/* Appointment Info */}
                <View style={styles.detailGrid}>
                  <View style={styles.gridItem}>
                    <Text style={styles.detailLabel}>BOOKING DATE</Text>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.createdAt ? dayjs(toDateSafe(selectedAppointment.createdAt)).format('MMM DD, YYYY') : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.detailLabel}>BOOKING TIME</Text>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.createdAt ? dayjs(toDateSafe(selectedAppointment.createdAt)).format('h:mm A') : 'N/A'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>STATUS</Text>
                  <View style={[styles.statusBanner, {
                    backgroundColor:
                      selectedAppointment.status === 'completed' ? '#D1FAE5' :
                        selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'denied' ? '#FEE2E2' :
                          '#FEF3C7',
                    marginTop: 0,
                    justifyContent: 'flex-start',
                    paddingHorizontal: 0,
                  }]}>
                    <Text style={[styles.detailValue, {
                      color:
                        selectedAppointment.status === 'completed' ? '#10B981' :
                          selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'denied' ? '#EF4444' : '#F59E0B',
                      textTransform: 'uppercase'
                    }]}>
                      {selectedAppointment.status || 'PENDING'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>PROCEDURE</Text>
                  <Text style={styles.detailValue}>
                    {selectedAppointment.specificProcedure || selectedAppointment.procedureName || 'General Procedure'}
                  </Text>
                </View>

                {(selectedAppointment.notes || (selectedAppointment as any).reason) && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>NOTES</Text>
                    <Text style={styles.detailBody}>{selectedAppointment.notes || (selectedAppointment as any).reason}</Text>
                  </View>
                )}

                {/* Status removed from here as it is now at the top */}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showInfo} transparent animationType="slide" onRequestClose={() => setShowInfo(false)}>
        <View style={styles.infoOverlay}>
          <TouchableOpacity style={styles.infoBackdrop} activeOpacity={1} onPress={() => setShowInfo(false)} />
          <View style={styles.infoSheet}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoTitle}>How referral payouts work</Text>
              <TouchableOpacity onPress={() => setShowInfo(false)} style={styles.closeBtn}>
                <Feather name="x" size={22} color={COLORS.textMain} />
              </TouchableOpacity>
            </View>
            <View style={styles.infoStep}>
              <View style={styles.infoDot} />
              <Text style={styles.infoText}>You submit a referral with the requested procedure.</Text>
            </View>
            <View style={styles.infoStep}>
              <View style={styles.infoDot} />
              <Text style={styles.infoText}>Pending referrals show the estimated payout based on procedure rates.</Text>
            </View>
            <View style={styles.infoStep}>
              <View style={styles.infoDot} />
              <Text style={styles.infoText}>Once the procedure is marked completed, it moves to Completed.</Text>
            </View>
            <View style={styles.infoStep}>
              <View style={styles.infoDot} />
              <Text style={styles.infoText}>Completed referrals count toward your payout total.</Text>
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
    paddingTop: 4,
    paddingBottom: 8,
  },
  helpBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: { fontSize: 13, fontWeight: '800', color: COLORS.textSub },
  tabTextActive: { color: '#FFFFFF' },
  tabCount: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  tabCountActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  tabCountText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  tabCountTextActive: { color: '#FFFFFF' },

  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  summaryCardSingle: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 10,
    ...SHADOW,
  },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },
  summaryValue: { fontSize: 22, fontWeight: '900', color: COLORS.primary, marginTop: 6 },
  summaryNote: { fontSize: 11, fontWeight: '700', color: COLORS.textSub, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.6 },

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
  },
  rowTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textMain },
  rowSub: { fontSize: 12, fontWeight: '600', color: COLORS.textSub, marginTop: 4 },
  amountPill: { backgroundColor: COLORS.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 12 },
  amountText: { fontSize: 12, fontWeight: '900', color: COLORS.primary },
  statusPill: { backgroundColor: '#D1FAE5', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  statusText: { fontSize: 11, fontWeight: '800', color: '#10B981' },
  pendingPill: { backgroundColor: '#FEF3C7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  pendingText: { fontSize: 11, fontWeight: '800', color: '#B45309' },

  emptyWrap: { padding: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain, textAlign: 'center' },
  emptySub: { fontSize: 13, fontWeight: '600', color: COLORS.textSub, textAlign: 'center', marginTop: 8 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, paddingBottom: 40, maxHeight: '80%', ...SHADOW
  },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
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
  statusBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12, marginTop: 8 },
  statusBannerText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  infoOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2, 6, 23, 0.55)' },
  infoBackdrop: { flex: 1 },
  infoSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 28,
    ...SHADOW,
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  infoTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain },
  infoStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  infoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 6 },
  infoText: { flex: 1, fontSize: 13, color: COLORS.textSub, lineHeight: 20 },
});
