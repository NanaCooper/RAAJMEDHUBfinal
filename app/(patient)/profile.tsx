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

export default function PatientProfile(): React.ReactElement {
  const { session, reloadUser } = useAuth();
  const router = useRouter();
  
  // --- State Management (Logic Intact) ---
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [role, setRole] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  
  // Editable fields
  const [phone, setPhone] = useState("");
  const [preferences, setPreferences] = useState("");
  const [photoURL, setPhotoURL] = useState<string | undefined>(undefined);
  
  // Date Picker State
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [originalProfile, setOriginalProfile] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Snackbar animation
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

  // Fetch profile
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
          setDob(data.dob || "");
          setRole(data.role || "");
          setCreatedAt(data.createdAt ? new Date(data.createdAt.toDate?.() ?? data.createdAt).toLocaleDateString() : "");
          setPhone(data.phone || data.contact || "");
          setPreferences(data.preferences || "");
          // Use photoURL if available, fallback to avatarUri for migration
          setPhotoURL(data.photoURL || data.avatarUri || undefined);
          setOriginalProfile({
            fullName: data.fullName || "",
            dob: data.dob || "",
            phone: data.phone || data.contact || "",
            preferences: data.preferences || "",
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

  const isValidPhone = (v: string) => {
    if (!v.trim()) return true; // Allow empty
    return /^[+\d][\d\s\-().]{6,}$/.test(v.trim());
  };

  const validationError = useMemo(() => {
    if (phone.trim() && !isValidPhone(phone)) return "Please enter a valid phone number.";
    return null;
  }, [phone]);

  const dirty = useMemo(() => {
    if (!originalProfile) return false;
    return (
      fullName !== (originalProfile.fullName || "") ||
      dob !== (originalProfile.dob || "") ||
      phone !== (originalProfile.phone || "") ||
      preferences !== (originalProfile.preferences || "") ||
      (photoURL || "") !== (originalProfile.photoURL || "")
    );
  }, [fullName, dob, phone, preferences, photoURL, originalProfile]);

  const handleSave = async () => {
    setError(null);
    Keyboard.dismiss();
    
    // Basic validation: only require a name
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    setLoading(true);
    try {
      if (!session?.uid) throw new Error("No active session found.");
      
      const nameParts = fullName.trim().split(/\s+/);
      const fName = nameParts[0] || "";
      const lName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

      const updateData: any = {
        fullName: fullName.trim(),
        firstName: fName,
        lastName: lName,
        dob: dob || "",
        phone: phone.trim(),
        preferences: preferences.trim(),
      };

      // Only include photoURL if it's defined
      if (photoURL !== undefined) {
        updateData.photoURL = photoURL;
      }

      await setDoc(doc(db, "users", session.uid), updateData, { merge: true });
      
      // CRITICAL: Refresh the global user state so changes reflect in Drawer/Settings immediately
      await reloadUser();
      
      setSavedMsg("Profile updated successfully");
      setOriginalProfile({ fullName, dob, phone, preferences, photoURL });
      setError(null);
    } catch (err: any) {
      console.error("Save Error:", err);
      setError(err.message || "Unable to save changes. Please check your connection.");
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

  const age = dob ? dayjs().diff(dayjs(dob, 'YYYY-MM-DD'), 'years') : undefined;

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
          onPress={() => router.push('/(patient)/settings')}
        >
          <Feather name="arrow-left" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
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
                <Text style={styles.avatarInitial}>{(fullName.charAt(0) || "U").toUpperCase()}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.cameraBadge} onPress={handleChangePhoto}>
              <Feather name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.profileName}>{fullName || "User"}</Text>
          <Text style={styles.profileRole}>{role ? role.toUpperCase() : "MEMBER"}</Text>
        </View>

        {/* --- Account Info (Read Only) --- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Security</Text>
          
          <View style={styles.row}>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Email Address</Text>
              <Text style={styles.value}>{email || "—"}</Text>
            </View>
            <Feather name="lock" size={16} color={COLORS.textSec} />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
             <View style={styles.fieldContainer}>
               <Text style={styles.label}>Member Since</Text>
               <Text style={styles.value}>{createdAt || "—"}</Text>
             </View>
          </View>
        </View>

        {/* --- Editable Form --- */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Personal Information</Text>
            <Feather name="edit-2" size={16} color={COLORS.primary} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              style={styles.input}
              placeholder="Your full name"
              placeholderTextColor={COLORS.textSec}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Date of Birth</Text>
              {age !== undefined && <View style={styles.pill}><Text style={styles.pillText}>{age} yrs</Text></View>}
            </View>
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
            <Text style={styles.label}>Mobile Number</Text>
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
            <Text style={styles.label}>Communication Preferences</Text>
            <TextInput
              value={preferences}
              onChangeText={setPreferences}
              style={[styles.input, styles.textArea]}
              placeholder="E.g. Prefer email over calls..."
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
             style={[styles.saveBtn, (!dirty || !!validationError || loading) && styles.saveBtnDisabled]}
             onPress={handleSave}
             disabled={!dirty || !!validationError || loading}
           >
             {loading ? (
               <ActivityIndicator color="#fff" />
             ) : (
               <Text style={styles.saveBtnText}>{dirty ? "Save Changes" : "Up to Date"}</Text>
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
  
  // Header
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

  // Avatar
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

  // Cards
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
  
  pill: { backgroundColor: COLORS.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  pillText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },

  // Inputs
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

  // Footer / Actions
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
  saveBtnText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700', 
    // when disabled, switch text color
  },

  // Snackbar
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