import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '../../hooks/useAuth';
import { listHospitals, upsertHospital, HospitalOption } from '../../services/hospitals';

const COLORS = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  primary: '#4F46E5',
  primarySoft: '#EEF2FF',
  textMain: '#1E293B',
  textSec: '#64748B',
  border: '#E2E8F0',
  danger: '#EF4444',
};

const REGION_OPTIONS = ['Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern', 'Other'];

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const makeLocalHospitalId = (name: string, region: string) =>
  `${normalizeText(name)}_${normalizeText(region || 'unknown')}`;

export default function DoctorHospitalScreen() {
  const router = useRouter();
  const { session, reloadUser } = useAuth();

  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [search, setSearch] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<HospitalOption | null>(null);
  const [customName, setCustomName] = useState('');
  const [customRegion, setCustomRegion] = useState('Greater Accra');
  const [customRegionOther, setCustomRegionOther] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listHospitals()
      .then((items) => {
        if (mounted) setHospitals(items);
      })
      .catch((err) => {
        console.error('[doctor-hospital] listHospitals failed', err);
        if (mounted) setError('Failed to load hospitals.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return hospitals;
    return hospitals.filter((h) =>
      h.name.toLowerCase().includes(term) || h.region.toLowerCase().includes(term)
    );
  }, [hospitals, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, HospitalOption[]> = {};
    filtered.forEach((item) => {
      const region = item.region || 'Other';
      if (!groups[region]) groups[region] = [];
      groups[region].push(item);
    });
    return groups;
  }, [filtered]);

  const handleSelectHospital = (hospital: HospitalOption) => {
    setSelectedHospital(hospital);
    setCustomName('');
    setCustomRegionOther('');
    setError(null);
  };

  const handleSave = async () => {
    if (!session?.uid) return;

    setError(null);
    setSaving(true);
    try {
      let hospitalToSave: HospitalOption | null = selectedHospital;

      const trimmedCustom = customName.trim();
      if (!hospitalToSave && trimmedCustom) {
        const region = customRegion === 'Other' ? customRegionOther.trim() : customRegion;
        if (!region) {
          setError('Please enter your hospital region.');
          setSaving(false);
          return;
        }
        try {
          hospitalToSave = await upsertHospital(trimmedCustom, region);
        } catch (err) {
          console.error('[doctor-hospital] upsertHospital failed', err);
          hospitalToSave = {
            id: makeLocalHospitalId(trimmedCustom, region),
            name: trimmedCustom,
            region,
            normalizedName: normalizeText(trimmedCustom),
          };
        }
      }

      if (!hospitalToSave) {
        setError('Please select or enter your hospital.');
        setSaving(false);
        return;
      }

      await updateUserProfile(session.uid, {
        hospitalId: hospitalToSave.id,
        hospitalName: hospitalToSave.name,
        hospitalRegion: hospitalToSave.region,
      });

      await reloadUser();
      router.replace('/(doctor)');
    } catch (err: any) {
      console.error('[doctor-hospital] save failed', err);
      setError(err?.message || 'Unable to save hospital.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    router.replace('/(doctor)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={18} color={COLORS.textMain} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Select your hospital</Text>
          <Text style={styles.subtitle}>Choose from the list or add your hospital to help others.</Text>
        </View>

        <View style={styles.searchRow}>
          <Feather name="search" size={18} color={COLORS.textSec} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search hospital or region"
            placeholderTextColor={COLORS.textSec}
            style={styles.searchInput}
          />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : (
          <>
            {Object.keys(grouped).length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No hospitals found</Text>
                <Text style={styles.emptySub}>Try a different search or add your hospital below.</Text>
              </View>
            ) : (
              Object.keys(grouped).map((region) => (
                <View key={region} style={styles.groupSection}>
                  <Text style={styles.groupTitle}>{region}</Text>
                  {grouped[region].map((hospital) => {
                    const isSelected = selectedHospital?.id === hospital.id;
                    return (
                      <TouchableOpacity
                        key={hospital.id}
                        style={[styles.hospitalRow, isSelected && styles.hospitalRowSelected]}
                        onPress={() => handleSelectHospital(hospital)}
                        activeOpacity={0.8}
                      >
                        <View>
                          <Text style={[styles.hospitalName, isSelected && styles.hospitalNameSelected]}>
                            {hospital.name}
                          </Text>
                          <Text style={styles.hospitalRegion}>{hospital.region}</Text>
                        </View>
                        {isSelected && <Feather name="check" size={16} color={COLORS.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))
            )}
          </>
        )}

        <View style={styles.customCard}>
          <Text style={styles.customTitle}>Can’t find your hospital?</Text>
          <TextInput
            value={customName}
            onChangeText={(value) => {
              setCustomName(value);
              if (value.trim()) setSelectedHospital(null);
            }}
            placeholder="Type your hospital name"
            placeholderTextColor={COLORS.textSec}
            style={styles.customInput}
          />

          <View style={styles.chipRow}>
            {REGION_OPTIONS.map((region) => {
              const active = customRegion === region;
              return (
                <TouchableOpacity
                  key={region}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCustomRegion(region)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{region}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {customRegion === 'Other' && (
            <TextInput
              value={customRegionOther}
              onChangeText={setCustomRegionOther}
              placeholder="Enter region"
              placeholderTextColor={COLORS.textSec}
              style={styles.customInput}
            />
          )}
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={16} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={saving}>
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save hospital</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backBtnText: { color: COLORS.textMain, fontSize: 13, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 120 },
  header: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textMain },
  subtitle: { fontSize: 13, color: COLORS.textSec, marginTop: 6 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textMain },
  groupSection: { marginBottom: 18 },
  groupTitle: { fontSize: 12, fontWeight: '800', color: COLORS.textSec, marginBottom: 8, textTransform: 'uppercase' },
  hospitalRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hospitalRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  hospitalName: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  hospitalNameSelected: { color: COLORS.primary },
  hospitalRegion: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },
  customCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginTop: 6,
  },
  customTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 10 },
  customInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textMain,
    marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.textSec },
  chipTextActive: { color: '#FFFFFF' },
  emptyWrap: { padding: 16, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  emptySub: { fontSize: 12, color: COLORS.textSec, marginTop: 4, textAlign: 'center' },
  loadingWrap: { paddingVertical: 20 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    marginTop: 16,
  },
  errorText: { color: COLORS.danger, fontSize: 12, fontWeight: '600' },
  footer: {
    padding: 16,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  skipBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  skipBtnText: { color: COLORS.textSec, fontSize: 14, fontWeight: '700' },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
