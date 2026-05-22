import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { doc, getDoc, setDoc, updateDoc, db, appInstance, enabled, initError } from "../../utils/firebaseConfig";
import { FIREBASE_PROJECT_ID } from "../../constants/Config";
import * as ImagePicker from 'expo-image-picker';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  LayoutAnimation,
  UIManager,
} from "react-native";
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import { listHospitals, upsertHospital, HospitalOption } from "../../services/hospitals";

// Enable LayoutAnimation on Android for the legacy renderer only.
const isNewArchitecture =
  typeof global !== 'undefined' &&
  (((global as any).nativeFabricUIManager != null) || ((global as any).__turboModuleProxy != null));

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental && !isNewArchitecture) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- 🎨 Ultra-Premium Theme ---
const COLORS = {
  bg: "#F4F7FA",        
  card: "#FFFFFF",
  primary: "#4F46E5",   // Deep Indigo
  primaryLight: "#EEF2FF",
  primaryMuted: "#C7D2FE",
  textMain: "#0F172A",  
  textSec: "#64748B",   
  inputBg: "#F8FAFC",
  inputBorder: "#E2E8F0",
  success: "#10B981",
  danger: "#EF4444",
  dangerBg: "#FEF2F2",
};

const SHADOW = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.03,
  shadowRadius: 24,
  elevation: 4,
};

const BUTTON_SHADOW = {
  shadowColor: COLORS.primary,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.25,
  shadowRadius: 15,
  elevation: 8,
};

const REGION_OPTIONS = ['Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern', 'Other'];

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const makeLocalHospitalId = (name: string, region: string) =>
  `${normalizeText(name)}_${normalizeText(region || 'unknown')}`;

const calculateAge = (dobValue: string) => {
  if (!dobValue) return '';
  const birthDate = dayjs(dobValue);
  if (!birthDate.isValid()) return '';
  return String(dayjs().diff(birthDate, 'year'));
};

export default function DoctorProfile(): React.ReactElement {
  const { session, reloadUser } = useAuth();
  const router = useRouter();
  
  // --- State Management ---
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  
  // Editable fields
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [age, setAge] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState<string | undefined>(undefined);
  const [hospitalId, setHospitalId] = useState<string | undefined>(undefined);
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalRegion, setHospitalRegion] = useState("");
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [hospitalSearch, setHospitalSearch] = useState("");
  const [selectedHospital, setSelectedHospital] = useState<HospitalOption | null>(null);
  const [customHospitalName, setCustomHospitalName] = useState("");
  const [customHospitalRegion, setCustomHospitalRegion] = useState("Greater Accra");
  const [customHospitalRegionOther, setCustomHospitalRegionOther] = useState("");
  
  // UI States
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [originalProfile, setOriginalProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const snackAnim = useRef(new Animated.Value(0)).current;

  // --- Smooth Animation Helper ---
  const animateLayout = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  useEffect(() => {
    if (!savedMsg) return;
    Animated.timing(snackAnim, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }).start();

    const t = setTimeout(() => {
      Animated.timing(snackAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setSavedMsg(null));
    }, 3000);

    return () => clearTimeout(t);
  }, [savedMsg, snackAnim]);

  useEffect(() => {
    console.log('[doctor-profile] Firebase config', {
      enabled,
      initError,
      envProjectId: FIREBASE_PROJECT_ID || null,
      appProjectId: (appInstance as any)?.options?.projectId || null,
    });
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      if (!session?.uid) {
        setLoadingProfile(false);
        return;
      }
      setLoadingProfile(true);
      try {
        const userRef = doc(db, "users", session.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          console.log('[doctor-profile] Loaded profile data', {
            uid: session.uid,
            hasFullName: Boolean(data.fullName || data.name),
            hasDob: Boolean(data.dob),
            hasHospital: Boolean(data.hospitalName),
          });
          const resolvedFullName = data.fullName || data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim();
          setFullName(resolvedFullName);
          setEmail(data.email || "");
          setCreatedAt(data.createdAt ? new Date(data.createdAt.toDate?.() ?? data.createdAt).toLocaleDateString() : "");
          setPhone(data.phone || data.contact || "");
          const resolvedDob = data.dob || "";
          setDob(resolvedDob);
          const resolvedAge = data.age ? String(data.age) : calculateAge(resolvedDob);
          setAge(resolvedAge);
          setSpecialization(data.specialization || data.specialty || "");
          setQualifications(data.qualifications || "");
          setBio(data.bio || "");
          setPhotoURL(data.photoURL || data.avatarUri || undefined);
          setHospitalId(data.hospitalId || undefined);
          setHospitalName(data.hospitalName || "");
          setHospitalRegion(data.hospitalRegion || data.hospitalCity || "");
          
          setOriginalProfile({
            fullName: resolvedFullName,
            phone: data.phone || data.contact || "",
            dob: resolvedDob,
            specialization: data.specialization || data.specialty || "",
            qualifications: data.qualifications || "",
            bio: data.bio || "",
            photoURL: data.photoURL || data.avatarUri || "",
            hospitalId: data.hospitalId || "",
            hospitalName: data.hospitalName || "",
            hospitalRegion: data.hospitalRegion || data.hospitalCity || "",
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchProfile();
  }, [session?.uid]);

  useEffect(() => {
    let mounted = true;
    listHospitals().then((items) => { if (mounted) setHospitals(items); }).catch(console.error);
    return () => { mounted = false; };
  }, []);

  const dirty = useMemo(() => {
    if (!originalProfile) return false;
    return (
      fullName !== (originalProfile.fullName || "") ||
      phone !== (originalProfile.phone || "") ||
      dob !== (originalProfile.dob || "") ||
      specialization !== (originalProfile.specialization || "") ||
      qualifications !== (originalProfile.qualifications || "") ||
      bio !== (originalProfile.bio || "") ||
      (photoURL || "") !== (originalProfile.photoURL || "") ||
      (hospitalId || "") !== (originalProfile.hospitalId || "") ||
      (hospitalName || "") !== (originalProfile.hospitalName || "") ||
      (hospitalRegion || "") !== (originalProfile.hospitalRegion || "")
    );
  }, [fullName, phone, dob, specialization, qualifications, bio, photoURL, hospitalId, hospitalName, hospitalRegion, originalProfile]);

  const canSave = useMemo(() => {
    const hasHospitalSelection = Boolean(selectedHospital) || customHospitalName.trim().length > 0;
    return !loading && (dirty || hasHospitalSelection);
  }, [dirty, loading, selectedHospital, customHospitalName]);

  const handleSave = async () => {
    setError(null);
    Keyboard.dismiss();
    
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    setLoading(true);
    console.log('[doctor-profile] Save started', {
      uid: session?.uid,
      dirty,
      selectedHospital: selectedHospital?.id || null,
      customHospitalName: customHospitalName.trim() || null,
    });
    try {
      if (!session?.uid) throw new Error("No session");
      
      const nameParts = fullName.trim().split(/\s+/);
        const updateData: any = {
        fullName: fullName.trim(),
        firstName: nameParts[0] || "",
        lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : "",
        phone: phone.trim(),
        dob,
        specialization: specialization.trim(),
        qualifications: qualifications.trim(),
        bio: bio.trim(),
      };

      const numericAge = Number(age);
      if (!Number.isNaN(numericAge) && age) {
        updateData.age = numericAge;
      }

      let nextHospitalId = hospitalId;
      let nextHospitalName = hospitalName;
      let nextHospitalRegion = hospitalRegion;

      if (selectedHospital) {
        nextHospitalId = selectedHospital.id;
        nextHospitalName = selectedHospital.name;
        nextHospitalRegion = selectedHospital.region;
      } else if (customHospitalName.trim()) {
        const region = customHospitalRegion === 'Other' ? customHospitalRegionOther.trim() : customHospitalRegion;
        if (!region) {
          setError('Please enter your hospital region.');
          setLoading(false);
          return;
        }
        try {
          const created = await upsertHospital(customHospitalName.trim(), region);
          nextHospitalId = created.id;
          nextHospitalName = created.name;
          nextHospitalRegion = created.region;
        } catch (_err) {
          nextHospitalId = makeLocalHospitalId(customHospitalName.trim(), region);
          nextHospitalName = customHospitalName.trim();
          nextHospitalRegion = region;
        }
      }

      updateData.hospitalId = nextHospitalId || '';
      updateData.hospitalName = nextHospitalName || '';
      updateData.hospitalRegion = nextHospitalRegion || '';
      if (photoURL !== undefined) updateData.photoURL = photoURL;

      const userRef = doc(db, "users", session.uid);
      try {
        const existingSnap = await getDoc(userRef);
        console.log('[doctor-profile] Existing user doc', {
          exists: existingSnap.exists(),
          role: existingSnap.exists() ? existingSnap.data()?.role || null : null,
        });
      } catch (err) {
        console.warn('[doctor-profile] Unable to read user doc before save', err);
      }
      console.log('[doctor-profile] Saving user profile patch', updateData);
      console.log('[doctor-profile] Write target', {
        uid: session.uid,
        path: userRef.path,
      });
      try {
        await updateDoc(userRef, updateData);
      } catch (err: any) {
        if (err?.code === 'firestore/not-found') {
          await setDoc(userRef, updateData, { merge: true });
        } else {
          throw err;
        }
      }
      await reloadUser();
      
      setSavedMsg("Profile updated");
      setHospitalId(nextHospitalId);
      setHospitalName(nextHospitalName || '');
      setHospitalRegion(nextHospitalRegion || '');
      setSelectedHospital(null);
      setCustomHospitalName('');
      setCustomHospitalRegionOther('');

      setOriginalProfile({
        ...updateData,
        hospitalId: nextHospitalId || '',
        hospitalName: nextHospitalName || '',
        hospitalRegion: nextHospitalRegion || '',
        photoURL,
      });
    } catch (err: any) {
      console.error('[doctor-profile] Save failed', err);
      setError(err.message || "Failed to save changes.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setPhotoURL(result.assets[0].uri);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      animateLayout();
      const nextDob = dayjs(selectedDate).format('YYYY-MM-DD');
      setDob(nextDob);
      setAge(calculateAge(nextDob));
    }
  };

  const hospitalFiltered = useMemo(() => {
    const term = hospitalSearch.trim().toLowerCase();
    if (!term) return hospitals;
    return hospitals.filter(item => item.name.toLowerCase().includes(term) || item.region.toLowerCase().includes(term));
  }, [hospitalSearch, hospitals]);

  const handleSelectHospital = (hospital: HospitalOption) => {
    animateLayout();
    setSelectedHospital(hospital);
    setCustomHospitalName('');
    setCustomHospitalRegionOther('');
  };

  // UI Helper for Focus State
  const getBorderColor = (field: string) => focusedInput === field ? COLORS.primary : COLORS.inputBorder;
  const getIconColor = (field: string) => focusedInput === field ? COLORS.primary : COLORS.textSec;

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      
      {/* --- Header --- */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(doctor)/settings')}>
          <Feather name="chevron-left" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          {/* --- Avatar Section --- */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarOuterRing}>
              <View style={styles.avatarContainer}>
                {photoURL ? (
                  <Image style={styles.avatarImage} source={{ uri: photoURL }} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>{(fullName.charAt(0) || "D").toUpperCase()}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.cameraBadge} onPress={handleChangePhoto} activeOpacity={0.8}>
                  <Feather name="camera" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            
            <Text style={styles.profileName}>Dr. {fullName || "Doctor"}</Text>
            <View style={styles.roleBadge}>
              <View style={styles.roleDot} />
              <Text style={styles.profileRole}>{specialization ? specialization.toUpperCase() : "MEDICAL PROFESSIONAL"}</Text>
            </View>
          </View>

          {/* --- Account Info (Read Only) --- */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
               <View style={styles.cardIconWrapper}>
                  <Feather name="shield" size={16} color={COLORS.primary} />
               </View>
               <Text style={styles.cardTitle}>Account Security</Text>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Professional Email</Text>
                <Text style={styles.value}>{email || "—"}</Text>
              </View>
              <View style={styles.lockedIconBadge}>
                <Feather name="lock" size={14} color={COLORS.textSec} />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
               <View style={styles.fieldContainer}>
                 <Text style={styles.label}>Platform Member Since</Text>
                 <Text style={styles.value}>{createdAt || "—"}</Text>
               </View>
            </View>
          </View>

          {/* --- Editable Clinical Profile --- */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
               <View style={styles.cardIconWrapper}>
                  <Feather name="activity" size={16} color={COLORS.primary} />
               </View>
               <Text style={styles.cardTitle}>Clinical Information</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={[styles.inputContainer, { borderColor: getBorderColor('fullName') }]}>
                <Feather name="user" size={18} color={getIconColor('fullName')} style={styles.inputIconPrefix} />
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  onFocus={() => setFocusedInput('fullName')}
                  onBlur={() => setFocusedInput(null)}
                  style={styles.inputText}
                  placeholder="Dr. Full Name"
                  placeholderTextColor={COLORS.textSec}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Primary Specialization</Text>
              <View style={[styles.inputContainer, { borderColor: getBorderColor('spec') }]}>
                <Feather name="award" size={18} color={getIconColor('spec')} style={styles.inputIconPrefix} />
                <TextInput
                  value={specialization}
                  onChangeText={setSpecialization}
                  onFocus={() => setFocusedInput('spec')}
                  onBlur={() => setFocusedInput(null)}
                  style={styles.inputText}
                  placeholder="e.g. Cardiologist"
                  placeholderTextColor={COLORS.textSec}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hospital Assignment</Text>
              <View style={styles.hospitalStatusBox}>
                  <Feather name="map-pin" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.hospitalStatusText} numberOfLines={1}>
                    {selectedHospital 
                      ? `Selected: ${selectedHospital.name}`
                      : hospitalName 
                        ? `${hospitalName}${hospitalRegion ? `, ${hospitalRegion}` : ''}`
                        : 'No hospital assigned'}
                  </Text>
              </View>
              
              <View style={[styles.inputContainer, { borderColor: getBorderColor('hosp') }]}>
                <Feather name="search" size={18} color={getIconColor('hosp')} style={styles.inputIconPrefix} />
                <TextInput
                  value={hospitalSearch}
                  onChangeText={(val) => { animateLayout(); setHospitalSearch(val); }}
                  onFocus={() => setFocusedInput('hosp')}
                  onBlur={() => setFocusedInput(null)}
                  style={styles.inputText}
                  placeholder="Search to assign hospital..."
                  placeholderTextColor={COLORS.textSec}
                />
              </View>

              {hospitalSearch.trim().length > 0 && (
                hospitalFiltered.slice(0, 4).map((hospital) => {
                  const isSelected = selectedHospital?.id === hospital.id || (!selectedHospital && hospitalId === hospital.id);
                  return (
                    <TouchableOpacity
                      key={hospital.id}
                      style={[styles.hospitalRow, isSelected && styles.hospitalRowSelected]}
                      onPress={() => handleSelectHospital(hospital)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.hospitalRowContent}>
                        <Text style={[styles.hospitalName, isSelected && styles.hospitalNameSelected]}>{hospital.name}</Text>
                        <Text style={[styles.hospitalRegion, isSelected && styles.hospitalRegionSelected]}>{hospital.region}</Text>
                      </View>
                      {isSelected && <Feather name="check-circle" size={20} color={COLORS.primary} />}
                    </TouchableOpacity>
                  );
                })
              )}

              <View style={styles.customHospitalSection}>
                <Text style={styles.subLabel}>Not listed? Add a custom hospital</Text>
                <View style={[styles.inputContainer, { borderColor: getBorderColor('customHosp') }]}>
                   <Feather name="plus-square" size={18} color={getIconColor('customHosp')} style={styles.inputIconPrefix} />
                   <TextInput
                     value={customHospitalName}
                     onChangeText={(value) => {
                       animateLayout();
                       setCustomHospitalName(value);
                       if (value.trim()) setSelectedHospital(null);
                     }}
                     onFocus={() => setFocusedInput('customHosp')}
                     onBlur={() => setFocusedInput(null)}
                     style={styles.inputText}
                     placeholder="Enter hospital name"
                     placeholderTextColor={COLORS.textSec}
                   />
                </View>
                
                {customHospitalName.length > 0 && (
                  <View style={styles.regionSelectorBox}>
                    <Text style={styles.helperText}>Select Region:</Text>
                    <View style={styles.chipRow}>
                      {REGION_OPTIONS.map((region) => {
                        const active = customHospitalRegion === region;
                        return (
                          <TouchableOpacity
                            key={region}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => { animateLayout(); setCustomHospitalRegion(region); }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{region}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {customHospitalRegion === 'Other' && (
                      <View style={[styles.inputContainer, { marginTop: 12, borderColor: getBorderColor('customReg') }]}>
                         <Feather name="map" size={18} color={getIconColor('customReg')} style={styles.inputIconPrefix} />
                         <TextInput
                           value={customHospitalRegionOther}
                           onChangeText={setCustomHospitalRegionOther}
                           onFocus={() => setFocusedInput('customReg')}
                           onBlur={() => setFocusedInput(null)}
                           style={styles.inputText}
                           placeholder="Specify region"
                           placeholderTextColor={COLORS.textSec}
                         />
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Qualifications</Text>
              <View style={[styles.inputContainer, styles.textAreaContainer, { borderColor: getBorderColor('qual') }]}>
                <Feather name="book-open" size={18} color={getIconColor('qual')} style={[styles.inputIconPrefix, { marginTop: 2 }]} />
                <TextInput
                  value={qualifications}
                  onChangeText={setQualifications}
                  onFocus={() => setFocusedInput('qual')}
                  onBlur={() => setFocusedInput(null)}
                  style={[styles.inputText, styles.textArea]}
                  placeholder="e.g. MD, Ph.D in Internal Medicine"
                  multiline
                  placeholderTextColor={COLORS.textSec}
                />
              </View>
            </View>
          </View>

          {/* --- Contact & Biography --- */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
               <View style={styles.cardIconWrapper}>
                  <Feather name="message-circle" size={16} color={COLORS.primary} />
               </View>
               <Text style={styles.cardTitle}>Contact & Biography</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Professional Mobile</Text>
              <View style={[styles.inputContainer, { borderColor: getBorderColor('phone') }]}>
                <Feather name="phone" size={18} color={getIconColor('phone')} style={styles.inputIconPrefix} />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  onFocus={() => setFocusedInput('phone')}
                  onBlur={() => setFocusedInput(null)}
                  style={styles.inputText}
                  placeholder="+1 234 567 890"
                  keyboardType="phone-pad"
                  placeholderTextColor={COLORS.textSec}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date of Birth</Text>
              <TouchableOpacity 
                style={[styles.inputContainer, showDatePicker && { borderColor: COLORS.primary }]} 
                onPress={() => { animateLayout(); setShowDatePicker(true); }}
                activeOpacity={0.7}
              >
                <Feather name="calendar" size={18} color={showDatePicker ? COLORS.primary : COLORS.textSec} style={styles.inputIconPrefix} />
                <Text style={[styles.inputText, !dob && { color: COLORS.textSec }]}>
                  {dob ? dayjs(dob).format('MMMM DD, YYYY') : "Select your birth date"}
                </Text>
                <Feather name="chevron-down" size={18} color={COLORS.textSec} />
              </TouchableOpacity>
              {showDatePicker && (
                <View style={styles.datePickerWrapper}>
                  <DateTimePicker
                    value={dob ? new Date(dob) : new Date()}
                    mode="date"
                    display="spinner"
                    maximumDate={new Date()}
                    onChange={onDateChange}
                  />
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Age</Text>
              <View style={[styles.inputContainer, { borderColor: COLORS.inputBorder }]}
              >
                <Feather name="user" size={18} color={COLORS.textSec} style={styles.inputIconPrefix} />
                <Text style={[styles.inputText, !age && { color: COLORS.textSec }]}>
                  {age || "Auto-calculated"}
                </Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Professional Biography</Text>
              <View style={[styles.inputContainer, styles.textAreaContainer, { borderColor: getBorderColor('bio') }]}>
                <Feather name="align-left" size={18} color={getIconColor('bio')} style={[styles.inputIconPrefix, { marginTop: 2 }]} />
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  onFocus={() => setFocusedInput('bio')}
                  onBlur={() => setFocusedInput(null)}
                  style={[styles.inputText, styles.textArea]}
                  placeholder="Tell patients about your background and experience..."
                  multiline
                  placeholderTextColor={COLORS.textSec}
                />
              </View>
            </View>
          </View>

          {/* --- Action Area --- */}
          <View style={styles.footer}>
             {error && (
               <View style={styles.errorBanner}>
                 <View style={styles.errorIconBox}>
                   <Feather name="alert-triangle" size={18} color={COLORS.danger} />
                 </View>
                 <Text style={styles.errorText}>{error}</Text>
               </View>
             )}
             
             <TouchableOpacity
               style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
               onPress={handleSave}
               disabled={!canSave}
               activeOpacity={0.8}
             >
               {loading ? (
                 <ActivityIndicator color="#fff" />
               ) : (
                 <>
                   <Feather name="save" size={20} color={!canSave ? COLORS.textSec : "#fff"} style={{ marginRight: 10 }} />
                   <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>
                      {canSave ? "Save Profile Changes" : "Profile Up to Date"}
                   </Text>
                 </>
               )}
             </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- Animated Snackbar --- */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.snackbar,
          {
            transform: [{ translateY: snackAnim.interpolate({ inputRange: [0, 1], outputRange: [120, 0] }) }],
            opacity: snackAnim
          }
        ]}
      >
        <View style={styles.snackContent}>
          <View style={styles.snackIconRing}>
            <Feather name="check" size={16} color={COLORS.success} />
          </View>
          <Text style={styles.snackText}>{savedMsg}</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 8,
    backgroundColor: COLORS.bg,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textMain, letterSpacing: -0.2 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    ...SHADOW,
    shadowOpacity: 0.01,
  },

  scrollContent: { padding: 20, paddingBottom: 140 },

  avatarSection: { alignItems: 'center', marginBottom: 32, marginTop: 10 },
  avatarOuterRing: {
    padding: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.bg,
    marginBottom: 16,
    ...SHADOW,
    shadowOpacity: 0.05,
  },
  avatarContainer: { 
    position: 'relative', 
    backgroundColor: COLORS.card,
    borderRadius: 99,
    padding: 3,
  },
  avatarImage: { width: 110, height: 110, borderRadius: 55 },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 40, fontWeight: '900', color: COLORS.primary },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: COLORS.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.card,
  },
  profileName: { fontSize: 26, fontWeight: '800', color: COLORS.textMain, letterSpacing: -0.5 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, marginRight: 6 },
  profileRole: { fontSize: 11, fontWeight: '800', color: COLORS.primary, letterSpacing: 1.2 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.5)',
    ...SHADOW,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  cardIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain, letterSpacing: -0.2 },
  
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  fieldContainer: { flex: 1 },
  label: { fontSize: 12, fontWeight: '800', color: COLORS.textSec, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  subLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textMain, marginBottom: 12, marginTop: 16 },
  helperText: { fontSize: 12, fontWeight: '600', color: COLORS.textSec, marginBottom: 8 },
  value: { fontSize: 16, fontWeight: '600', color: COLORS.textMain },
  lockedIconBadge: { backgroundColor: COLORS.inputBg, padding: 8, borderRadius: 10 },
  
  divider: { height: 1, backgroundColor: COLORS.inputBg, marginVertical: 16 },
  
  inputGroup: { marginBottom: 24 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  textAreaContainer: {
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  inputIconPrefix: { marginRight: 12 },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textMain,
    fontWeight: '600',
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  
  hospitalStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  hospitalStatusText: { fontSize: 14, fontWeight: '700', color: COLORS.primary, flex: 1 },

  hospitalRow: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hospitalRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  hospitalRowContent: { flex: 1 },
  hospitalName: { fontSize: 15, fontWeight: '700', color: COLORS.textMain },
  hospitalNameSelected: { color: COLORS.primary },
  hospitalRegion: { fontSize: 13, fontWeight: '500', color: COLORS.textSec, marginTop: 4 },
  hospitalRegionSelected: { color: COLORS.primary },
  
  customHospitalSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  regionSelectorBox: {
    marginTop: 16,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.inputBg,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: COLORS.textSec },
  chipTextActive: { color: '#FFFFFF' },

  datePickerWrapper: {
    marginTop: 10,
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 10,
  },

  footer: { marginTop: 10 },
  errorBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.dangerBg, 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  errorIconBox: { backgroundColor: '#FEE2E2', padding: 6, borderRadius: 8, marginRight: 12 },
  errorText: { color: COLORS.danger, fontSize: 14, fontWeight: '700', flex: 1 },
  
  saveBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: 'center',
    ...BUTTON_SHADOW,
  },
  saveBtnDisabled: { 
    backgroundColor: COLORS.inputBorder, 
    elevation: 0, 
    shadowOpacity: 0 
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  saveBtnTextDisabled: { color: COLORS.textSec },

  snackbar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 45 : 30,
    alignSelf: 'center',
    zIndex: 999,
  },
  snackContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 100,
    ...SHADOW,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    elevation: 12,
  },
  snackIconRing: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    padding: 6,
    borderRadius: 20,
  },
  snackText: { color: '#fff', fontWeight: '700', marginLeft: 12, fontSize: 15, letterSpacing: 0.3 },
});