import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '../../hooks/useAuth';
import { listHospitals, upsertHospital, HospitalOption } from '../../services/hospitals';
import { updateUserProfile } from '../../services/users';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- 🎨 Ultra-Premium Theme ---
const COLORS = {
  bg: "#F4F7FA",
  card: "#FFFFFF",
  primary: "#4F46E5",
  primaryLight: "#EEF2FF",
  textMain: "#1E293B",  // Softened from pure dark slate 
  textSec: "#64748B",
  inputBg: "#F8FAFC",
  inputBorder: "#E2E8F0",
  danger: "#EF4444",
  dangerBg: "#FEF2F2",
};

const SHADOW = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.03,
  shadowRadius: 16,
  elevation: 3,
};

const BUTTON_SHADOW = {
  shadowColor: COLORS.primary,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.2,
  shadowRadius: 12,
  elevation: 6,
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

  // UI States
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // --- Smooth Animation Helper ---
  const animateLayout = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listHospitals()
      .then((items) => {
        if (mounted) {
          animateLayout();
          setHospitals(items);
        }
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
    animateLayout();
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
          setError('Please enter your facility region.');
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
        setError('Please select or enter your facility.');
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
    if (session?.uid) {
      try {
        setSaving(true);
        await updateUserProfile(session.uid, {
          hospitalId: 'skipped',
          hospitalName: '',
          hospitalRegion: '',
        });
        await reloadUser();
        router.replace('/(doctor)');
      } catch (err) {
        console.error('[doctor-hospital] skip failed', err);
        router.replace('/(doctor)');
      } finally {
        setSaving(false);
      }
    } else {
      router.replace('/(doctor)');
    }
  };

  const handleBack = () => {
    router.replace('/user-type-selection');
  };

  // UI Helpers
  const getBorderColor = (field: string) => focusedInput === field ? COLORS.primary : COLORS.inputBorder;
  const getIconColor = (field: string) => focusedInput === field ? COLORS.primary : COLORS.textSec;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* --- Header --- */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={handleBack}>
          <Feather name="chevron-left" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Facility Setup</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <View style={styles.header}>
            <View style={styles.iconRing}>
              <Feather name="map-pin" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Where do you practice?</Text>
            <Text style={styles.subtitle}>Choose from the list or add your primary facility to help {Platform.OS === 'android' ? 'clients' : 'patients'} find you.</Text>
          </View>

          {/* --- Search Bar --- */}
          <View style={[styles.inputContainer, { borderColor: getBorderColor('search'), marginBottom: 24 }]}>
            <Feather name="search" size={16} color={getIconColor('search')} style={styles.inputIconPrefix} />
            <TextInput
              value={search}
              onChangeText={(val) => { animateLayout(); setSearch(val); }}
              onFocus={() => setFocusedInput('search')}
              onBlur={() => setFocusedInput(null)}
              placeholder="Search facility or region..."
              placeholderTextColor={COLORS.textSec}
              style={styles.inputText}
            />
          </View>

          {/* --- Hospital List --- */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : (
            <>
              {Object.keys(grouped).length === 0 ? (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconBox}>
                    <Feather name="search" size={20} color={COLORS.textSec} />
                  </View>
                  <Text style={styles.emptyTitle}>No facilities found</Text>
                  <Text style={styles.emptySub}>Try a different search term or add your custom facility below.</Text>
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
                          activeOpacity={0.7}
                        >
                          <View style={styles.hospitalRowContent}>
                            <Text style={[styles.hospitalName, isSelected && styles.hospitalNameSelected]}>
                              {hospital.name}
                            </Text>
                            <Text style={[styles.hospitalRegion, isSelected && styles.hospitalRegionSelected]}>
                              {hospital.region}
                            </Text>
                          </View>
                          {isSelected && <Feather name="check-circle" size={18} color={COLORS.primary} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))
              )}
            </>
          )}

          {/* --- Custom Hospital Card --- */}
          <View style={styles.customCard}>
            <View style={styles.customCardHeader}>
              <Feather name="plus-square" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
              <Text style={styles.customTitle}>Can’t find your facility?</Text>
            </View>

            <View style={[styles.inputContainer, { borderColor: getBorderColor('customName') }]}>
              <Feather name="edit-3" size={16} color={getIconColor('customName')} style={styles.inputIconPrefix} />
              <TextInput
                value={customName}
                onChangeText={(value) => {
                  animateLayout();
                  setCustomName(value);
                  if (value.trim()) setSelectedHospital(null);
                }}
                onFocus={() => setFocusedInput('customName')}
                onBlur={() => setFocusedInput(null)}
                placeholder="Type your facility name"
                placeholderTextColor={COLORS.textSec}
                style={styles.inputText}
              />
            </View>

            {customName.length > 0 && (
              <View style={styles.regionSelectorBox}>
                <Text style={styles.helperText}>Select Region:</Text>
                <View style={styles.chipRow}>
                  {REGION_OPTIONS.map((region) => {
                    const active = customRegion === region;
                    return (
                      <TouchableOpacity
                        key={region}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => { animateLayout(); setCustomRegion(region); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{region}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {customRegion === 'Other' && (
                  <View style={[styles.inputContainer, { marginTop: 12, borderColor: getBorderColor('customReg') }]}>
                    <Feather name="map" size={16} color={getIconColor('customReg')} style={styles.inputIconPrefix} />
                    <TextInput
                      value={customRegionOther}
                      onChangeText={setCustomRegionOther}
                      onFocus={() => setFocusedInput('customReg')}
                      onBlur={() => setFocusedInput(null)}
                      placeholder="Specify custom region"
                      placeholderTextColor={COLORS.textSec}
                      style={styles.inputText}
                    />
                  </View>
                )}
              </View>
            )}
          </View>

          {/* --- Error Display --- */}
          {error && (
            <View style={styles.errorBanner}>
              <View style={styles.errorIconBox}>
                <Feather name="alert-triangle" size={16} color={COLORS.danger} />
              </View>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- Action Footer --- */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          disabled={saving}
          activeOpacity={0.7}
        >
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.saveBtnText}>Save & Continue</Text>
              <Feather name="arrow-right" size={16} color="#fff" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: COLORS.bg,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, letterSpacing: -0.1 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    ...SHADOW,
    shadowOpacity: 0.01,
  },

  content: { padding: 20, paddingBottom: 60 },

  header: { marginBottom: 24, alignItems: 'center' },
  iconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textMain, letterSpacing: -0.3, textAlign: 'center' },
  subtitle: { fontSize: 13, fontWeight: '400', color: COLORS.textSec, marginTop: 6, textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  inputIconPrefix: { marginRight: 10 },
  inputText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textMain,
    fontWeight: '500',
  },

  groupSection: { marginBottom: 20 },
  groupTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textSec, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  hospitalRow: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOW,
    shadowOpacity: 0.02,
  },
  hospitalRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  hospitalRowContent: { flex: 1 },
  hospitalName: { fontSize: 15, fontWeight: '600', color: COLORS.textMain, marginBottom: 2 },
  hospitalNameSelected: { color: COLORS.primary },
  hospitalRegion: { fontSize: 12, fontWeight: '500', color: COLORS.textSec },
  hospitalRegionSelected: { color: COLORS.primary },

  customCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    padding: 20,
    marginTop: 8,
    ...SHADOW,
  },
  customCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  customTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textMain, letterSpacing: -0.1 },

  regionSelectorBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  helperText: { fontSize: 12, fontWeight: '600', color: COLORS.textMain, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.inputBg,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSec },
  chipTextActive: { color: '#FFFFFF' },

  emptyWrap: { paddingVertical: 30, alignItems: 'center' },
  emptyIconBox: { backgroundColor: COLORS.inputBg, padding: 14, borderRadius: 16, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.textSec, textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 },
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerBg,
    padding: 14,
    borderRadius: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  errorIconBox: { backgroundColor: '#FEE2E2', padding: 6, borderRadius: 8, marginRight: 10 },
  errorText: { color: COLORS.danger, fontSize: 13, fontWeight: '600', flex: 1 },

  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.inputBorder,
    gap: 12,
  },
  skipBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.card,
  },
  skipBtnText: { color: COLORS.textMain, fontSize: 14, fontWeight: '600' },
  saveBtn: {
    flex: 1.5,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    ...BUTTON_SHADOW,
  },
  saveBtnDisabled: { opacity: 0.7, shadowOpacity: 0, elevation: 0 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});