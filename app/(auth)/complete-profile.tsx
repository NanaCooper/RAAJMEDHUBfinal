import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { doc, setDoc, db } from "../../utils/firebaseConfig";
import { useAuth } from "../../hooks/useAuth";
import { Feather } from "@expo/vector-icons";

// --- 🏥 Premium Healthcare Theme ---
const COLORS = {
  bg: "#F8FAFC",        // Slate 50
  surface: "#FFFFFF",
  primary: "#4F46E5",   // Indigo 600
  primarySoft: "#EEF2FF",
  textMain: "#1E293B",  // Slate 800
  textSec: "#64748B",   // Slate 500
  border: "#E2E8F0",
  success: "#10B981",   // Emerald
  danger: "#EF4444",    // Red
  warning: "#F59E0B",   // Amber
  inputBg: "#F1F5F9",   // Slate 100
  inputDisabled: "#E2E8F0",
};

const SHADOW = {
  shadowColor: "#64748B",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

// Helper Component for Input Fields - Moved outside and memoized
const InputField = React.memo(({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default" as any,
  editable = true,
  hint = ""
}: any) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputContainer, !editable && styles.inputDisabled]}>
      <Feather
        name={icon}
        size={20}
        color={editable ? COLORS.textSec : COLORS.primary}
        style={styles.inputIcon}
      />
      <TextInput
        style={[styles.input, !editable && styles.inputTextDisabled]}
        placeholder={placeholder}
        placeholderTextColor="#ADB5BD"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        editable={editable}
        autoCapitalize={label === "Full Name" ? "words" : "none"}
      />
      {!editable && <Feather name="lock" size={16} color={COLORS.textSec} />}
    </View>
    {hint ? <Text style={styles.hintText}>{hint}</Text> : null}
  </View>
));

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { session, reloadUser } = useAuth();
  
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = session?.email || "";

  const validate = () => {
    if (!fullName.trim()) return "Please enter your full name.";
    if (!dob.trim()) return "Please enter your date of birth.";
    if (!contact.trim()) return "Please enter a contact number.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob.trim())) return "Date of birth must be in YYYY-MM-DD format.";
    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setLoading(true);
    console.log("--- [complete-profile.tsx] Attempting to save profile... ---");
    try {
      await setDoc(doc(db, "users", session?.uid || ""), {
        fullName: fullName.trim(),
        dob: dob.trim(),
        contact: contact.trim(),
        email,
        profileComplete: true,
      }, { merge: true });
      console.log("--- [complete-profile.tsx] Profile saved successfully! ---");
      
      // Reload the user data to trigger the protected route hook
      await reloadUser();
      
      console.log("--- [complete-profile.tsx] User reloaded. Navigation will be handled by AuthProvider. ---");
    } catch (err: any) {
      console.error('--- [complete-profile.tsx] Complete profile save error ---', err);
      if (err && typeof err === 'object' && (err as any).message) {
        console.error("[LOG] Error message:", (err as any).message);
      }
      if (err && typeof err === 'object' && (err as any).code) {
        console.error("[LOG] Error code:", (err as any).code);
      }
      if (err && typeof err === 'object') {
        console.error("[LOG] Full error object:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      }
      setError("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
      console.log("--- [complete-profile.tsx] handleSubmit finished. ---");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* --- Header --- */}
          <View style={styles.header}>
            <View style={styles.progressPill}>
              <Text style={styles.progressText}>Step 2 of 3</Text>
            </View>
            <Text style={styles.title}>Complete Profile</Text>
            <Text style={styles.subtitle}>Let's get to know you better</Text>
          </View>

          {/* --- Avatar Placeholder --- */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {(fullName || (email).charAt(0) || 'U').charAt(0).toUpperCase()}
              </Text>
              <View style={styles.editBadge}>
                <Feather name="camera" size={14} color="#FFF" />
              </View>
            </View>
          </View>

          {/* --- Form Card --- */}
          <View style={styles.card}>
            {error && (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={16} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <InputField
              label="Email Address"
              icon="mail"
              value={email}
              editable={false}
            />

            <InputField
              label="Full Name"
              icon="user"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Dr. John Doe"
            />

            <InputField
              label="Date of Birth"
              icon="calendar"
              value={dob}
              onChangeText={setDob}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              hint="Format: YYYY-MM-DD"
            />

            <InputField
              label="Contact Number"
              icon="phone"
              value={contact}
              onChangeText={setContact}
              placeholder="+1 (555) 000-0000"
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Continue</Text>
                  <Feather name="arrow-right" size={20} color="#FFF" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* --- Footer --- */}
          <View style={styles.footer}>
            <Feather name="lock" size={14} color={COLORS.textSec} />
            <Text style={styles.footerText}>Your information is securely stored.</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, paddingBottom: 40 },

  // --- Header ---
  header: { alignItems: 'center', marginBottom: 24 },
  progressPill: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  progressText: { color: COLORS.primary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.textMain, marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.textSec },

  // --- Avatar ---
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primarySoft, // Light indigo bg
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
    shadowRadius: 16,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: COLORS.primary },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.bg,
  },

  // --- Card ---
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    ...SHADOW,
  },

  // --- Inputs ---
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.primary, marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputDisabled: {
    backgroundColor: COLORS.inputDisabled,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: COLORS.textMain, height: '100%' },
  inputTextDisabled: { color: COLORS.textSec, fontWeight: '500' },
  hintText: { fontSize: 12, color: COLORS.textSec, marginTop: 6, marginLeft: 4 },

  // --- Error ---
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  errorText: { color: COLORS.danger, fontSize: 13, marginLeft: 8, flex: 1 },

  // --- Buttons ---
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 14,
    marginTop: 8,
    gap: 8,
    ...SHADOW,
    shadowOpacity: 0.15,
  },
  btnDisabled: { opacity: 0.7, backgroundColor: COLORS.textSec },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // --- Footer ---
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    gap: 8,
    opacity: 0.7,
  },
  footerText: { color: COLORS.textSec, fontSize: 12, fontWeight: '500' },
});
