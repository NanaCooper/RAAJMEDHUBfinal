import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

import { useAuth } from '../../hooks/useAuth';
import type { Referral } from '../../types/referral';
import { subscribeToReferralsByDoctor } from '../../services/referrals';

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
  const [items, setItems] = useState<Referral[]>([]);

  useEffect(() => {
    if (!session?.uid) return;
    const unsub = subscribeToReferralsByDoctor(session.uid, setItems, (err) => {
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
      .map((r) => ({
        ...r,
        _createdAt: toDateSafe((r as any).createdAt) || new Date(0),
      }))
      .sort((a: any, b: any) => b._createdAt.getTime() - a._createdAt.getTime());

    norm.forEach((r: any) => {
      const d = dayjs(r._createdAt);
      const amount = Number((r as any).amountGhs) || 0;
      if (d.isSameOrAfter(weekStart)) w += amount;
      if (d.isSameOrAfter(monthStart)) m += amount;
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
          <View style={styles.rowCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.procedureLabel || 'Referral'}</Text>
              <Text style={styles.rowSub}>
                {dayjs(item._createdAt).isValid() ? dayjs(item._createdAt).format('MMM D, YYYY') : '—'}
                {item.patientName ? ` • ${item.patientName}` : ''}
              </Text>
            </View>
            <View style={styles.amountPill}>
              <Text style={styles.amountText}>GHS {Number(item.amountGhs) || 0}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No referrals yet</Text>
            <Text style={styles.emptySub}>Referral payouts will appear here after you submit scan requests.</Text>
          </View>
        }
      />
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
});
