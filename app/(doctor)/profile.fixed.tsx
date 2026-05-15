import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { doc, getDoc, setDoc, db } from "../../utils/firebaseConfig";
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
} from "react-native";
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import dayjs from "dayjs";

// --- 🎨 Unified Premium Theme ---
const COLORS = {
  bg: "#F8FAFC",        // Slate 50
  card: "#FFFFFF",
  primary: "#4F46E5",   // Indigo 600
  primaryDark: "#4338ca",
  textMain: "#1E293B",  // Slate 800
  textSec: "#64748B",   // Slate 500
  input: "#F1F5F9",     // Slate 100
  border: "#E2E8F0",
  success: "#10B981",
  danger: "#EF4444",
  overlay: "rgba(0,0,0,0.05)",
};

const SHADOW = {
  shadowColor: "#64748B",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 16,
  elevation: 4,
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
  const [specialization, setSpecialization] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState<string | undefined>(undefined);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [originalProfile, setOriginalProfile] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const snackAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!savedMsg) return;
    Animated.timing(snackAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const t = setTimeout(() => {
      Animated.timing(snackAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setSavedMsg(null));
    }, 2500);

    return () => clearTimeout(t);
  }, [savedMsg, snackAnim]);

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
          setFullName(data.fullName || "");
          setEmail(data.email || "");
          setCreatedAt(data.createdAt ? new Date(data.createdAt.toDate?.() ?? data.createdAt).toLocaleDateString() : "");
          setPhone(data.phone || data.contact || "");
          setDob(data.dob || "");
          setSpecialization(data.specialization || data.specialty || "");
          setQualifications(data.qualifications || "");
          setBio(data.bio || "");
          setPhotoURL(data.photoURL || data.avatarUri || undefined);
          
          setOriginalProfile({
            fullName: data.fullName || "",
            phone: data.phone || data.contact || "",
            dob: data.dob || "",
            specialization: data.specialization || data.specialty || "",
            qualifications: data.qualifications || "",
            bio: data.bio || "",
            photoURL: data.photoURL || data.avatarUri || "",
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

  const dirty = useMemo(() => {
    if (!originalProfile) return false;
    return (
      fullName !== (originalProfile.fullName || "") ||
      phone !== (originalProfile.phone || "") ||
      dob !== (originalProfile.dob || "") ||
      specialization !== (originalProfile.specialization || "") ||
      qualifications !== (originalProfile.qualifications || "") ||
      bio !== (originalProfile.bio || "") ||
      (photoURL || "") !== (originalProfile.photoURL || "")
    );
  }, [fullName, phone, dob, specialization, qualifications, bio, photoURL, originalProfile]);

  const handleSave = async () => {
    setError(null);
    Keyboard.dismiss();
    
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    setLoading(true);
    try {
      if (!session?.uid) throw new Error("No session");
      
      const nameParts = fullName.trim().split(/\s+/);
      const fName = nameParts[0] || "";
      const lName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

      const updateData: any = {
        fullName: fullName.trim(),
        firstName: fName,
        lastName: lName,
        phone: phone.trim(),
        dob: dob,
        specialization: specialization.trim(),
        qualifications: qualifications.trim(),
        bio: bio.trim(),
      };

      if (photoURL !== undefined) updateData.photoURL = photoURL;

      await setDoc(doc(db, "users", session.uid), updateData, { merge: true });
      
      // CRITICAL: Refresh the global user state so changes reflect in Drawer/Settings immediately
      await reloadUser();
      
      setSavedMsg("Professional profile updated");
      setOriginalProfile({ fullName, phone, dob, specialization, qualifications, bio, photoURL });
      setError(null);
    } catch (err: any) {
      console.error(err);
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
      quality: 1,
    });

    if (!result.canceled) {
      setPhotoURL(result.assets[0].uri);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDob(dayjs(selectedDate).format('YYYY-MM-DD'));
    }
  };

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
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={() => router.push('/(doctor)/settings')}
        >
          <Feather name="arrow-left" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Professional Profile</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* --- Avatar Section --- */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {photoURL ? (
              <Image style={styles.avatarImage} source={{ uri: photoURL }} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{(fullName.charAt(0) || "D").toUpperCase()}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.cameraBadge} onPress={handleChangePhoto}>
              <Feather name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.profileName}>Dr. {fullName || "Doctor"}</Text>
          <Text style={styles.profileRole}>{specialization ? specialization.toUpperCase() : "PROFESSIONAL"}</Text>
        </View>

        {/* --- Account Info (Read Only) --- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Details</Text>
          
          <View style={styles.row}>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Professional Email</Text>
              <Text style={styles.value}>{email || "—"}</Text>
            </View>
            <Feather name="lock" size={16} color={COLORS.textSec} />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
             <View style={styles.fieldContainer}>
               <Text style={styles.label}>Platform Member Since</Text>
               <Text style={styles.value}>{createdAt || "—"}</Text>
             </View>
          </View>
        </View>

        {/* --- Editable Clinical Profile --- */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Clinical Information</Text>
            <Feather name="edit-2" size={16} color={COLORS.primary} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              style={styles.input}
              placeholder="Dr. Full Name"
              placeholderTextColor={COLORS.textSec}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Primary Specialization</Text>
            <TextInput
              value={specialization}
              onChangeText={setSpecialization}
              style={styles.input}
              placeholder="e.g. Cardiologist"
              placeholderTextColor={COLORS.textSec}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Qualifications</Text>
            <TextInput
              value={qualifications}
              onChangeText={setQualifications}
              style={[styles.input, styles.textArea]}
              placeholder="e.g. MD, Ph.D in Internal Medicine"
              multiline
              placeholderTextColor={COLORS.textSec}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact & Biography</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Professional Mobile</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              placeholder="+1 234 567 890"
              keyboardType="phone-pad"
              placeholderTextColor={COLORS.textSec}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Birth</Text>
            <TouchableOpacity 
              style={styles.input} 
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.inputValue, !dob && { color: COLORS.textSec }]}>
                {dob ? dayjs(dob).format('MMMM DD, YYYY') : "Select Date"}
              </Text>
              <Feather name="calendar" size={16} color={COLORS.primary} style={styles.inputIcon} />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={dob ? new Date(dob) : new Date()}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={onDateChange}
              />
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Professional Biography</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              style={[styles.input, styles.textArea]}
              placeholder="Tell patients about your experience..."
              multiline
              placeholderTextColor={COLORS.textSec}
            />
          </View>
        </View>

        {/* --- Action Area --- */}
        <View style={styles.footer}>
           {error && (
             <View style={styles.errorBanner}>
               <Feather name="alert-circle" size={16} color={COLORS.danger} />
               <Text style={styles.errorText}>{error}</Text>
             </View>
           )}
           
           <TouchableOpacity
             style={[styles.saveBtn, (!dirty || loading) && styles.saveBtnDisabled]}
             onPress={handleSave}
             disabled={!dirty || loading}
           >
             {loading ? (
               <ActivityIndicator color="#fff" />
             ) : (
               <Text style={styles.saveBtnText}>{dirty ? "Save Profile" : "Up to Date"}</Text>
             )}
           </TouchableOpacity>
        </View>

      </ScrollView>

      {/* --- Animated Snackbar --- */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.snackbar,
          {
            transform: [{ 
              translateY: snackAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) 
            }],
            opacity: snackAnim
          }
        ]}
      >
        <View style={styles.snackContent}>
          <Feather name="check" size={20} color="#fff" />
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
    paddingVertical: 10,
    backgroundColor: COLORS.bg,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textMain, letterSpacing: -0.5 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  scrollContent: { padding: 20, paddingBottom: 100 },

  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 40, fontWeight: '800', color: COLORS.primary },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.bg,
  },
  profileName: { fontSize: 22, fontWeight: '800', color: COLORS.textMain },
  profileRole: { fontSize: 12, fontWeight: '700', color: COLORS.textSec, letterSpacing: 1, marginTop: 4 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  
  fieldContainer: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSec, marginBottom: 6 },
  value: { fontSize: 16, fontWeight: '600', color: COLORS.textMain },
  
  divider: { height: 1, backgroundColor: COLORS.input, marginVertical: 12 },
  
  inputGroup: { marginBottom: 16 },
  input: {
    backgroundColor: COLORS.input,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textMain,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputValue: { fontSize: 16, color: COLORS.textMain, fontWeight: '600' },
  inputIcon: { marginLeft: 10 },
  textArea: { minHeight: 100, textAlignVertical: 'top', alignItems: 'flex-start' },

  footer: { marginTop: 10 },
  errorBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FEF2F2', 
    padding: 12, 
    borderRadius: 12, 
    marginBottom: 16 
  },
  errorText: { color: COLORS.danger, fontSize: 13, marginLeft: 8, flex: 1 },
  
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    ...SHADOW,
    shadowColor: COLORS.primary,
  },
  saveBtnDisabled: { backgroundColor: COLORS.input, shadowOpacity: 0 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  snackbar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  snackContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.textMain,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  snackText: { color: '#fff', fontWeight: '600', marginLeft: 10, fontSize: 14 },
});