import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
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

export default function ReferralsScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    if (!session?.uid) return;
    const unsub = subscribeToAppointments(session.uid, 'doctor', setItems, (err) => {
      console.log('[referrals] subscribe error', err);
    });
    return () => unsub && unsub();
  }, [session?.uid]);

  const { weekTotal, monthTotal, normalized } = useMemo(() => {
    const now = dayjs();
    const weekStart = now.startOf('week');
    const monthStart = now.startOf('month');

    let w = 0;
    let m = 0;

    const norm = items
      .map((appt) => {
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
        };
      })
      // Keep everything for now so the doctor sees the list
      .sort((a, b) => b._createdAt.getTime() - a._createdAt.getTime());

    norm.forEach((r) => {
      const d = dayjs(r._createdAt);
      if (d.isSameOrAfter(weekStart)) w += r.amountGhs;
      if (d.isSameOrAfter(monthStart)) m += r.amountGhs;
    });

    return { weekTotal: w, monthTotal: m, normalized: norm };
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
      <View style={styles.header}>
        <Text style={styles.title}>Referrals</Text>
        <Text style={styles.subtitle}>Weekly and monthly referral payouts</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>This Week</Text>
          <Text style={styles.summaryValue}>GHS {weekTotal}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>This Month</Text>
          <Text style={styles.summaryValue}>GHS {monthTotal}</Text>
        </View>
      </View>

      <Text style={styles.listHeader}>Recent referrals</Text>

      <FlatList
        data={normalized as any[]}
        keyExtractor={(r: any) => r.id || `${r.doctorId}_${r.appointmentId}_${r.procedureKey}_${r._createdAt.getTime()}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
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
            <Feather name="chevron-right" size={16} color={COLORS.border} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No referrals yet</Text>
            <Text style={styles.emptySub}>Referral payouts will appear here after you submit scan requests.</Text>
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
                      {selectedAppointment.createdAt ? dayjs(selectedAppointment.createdAt.toDate ? selectedAppointment.createdAt.toDate() : selectedAppointment.createdAt).format('MMM DD, YYYY') : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.detailLabel}>BOOKING TIME</Text>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.createdAt ? dayjs(selectedAppointment.createdAt.toDate ? selectedAppointment.createdAt.toDate() : selectedAppointment.createdAt).format('h:mm A') : 'N/A'}
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
                    backgroundColor: 'transparent'
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textMain },
  subtitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSub, marginTop: 4 },

  summaryRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    ...SHADOW,
  },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },
  summaryValue: { fontSize: 20, fontWeight: '900', color: COLORS.primary, marginTop: 6 },

  listHeader: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 13, fontWeight: '800', color: COLORS.textMain },

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
});
