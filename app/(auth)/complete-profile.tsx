import React, { useState, useEffect } from "react";
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
  Pressable,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { doc, setDoc, db } from "../../utils/firebaseConfig";
import { useAuth } from "../../hooks/useAuth";
import { Feather } from "@expo/vector-icons";
import { linkPhoneWithPassword } from "../../utils/authHelpers";

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

// Helper Component for Input Fields
const InputField = React.memo(({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default" as any,
  editable = true,
  hint = "",
  isPassword = false,
  secureTextEntry,
  onToggleSecureEntry,
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
        secureTextEntry={isPassword && secureTextEntry}
        autoCapitalize={label === "Full Name" ? "words" : "none"}
      />
      {isPassword ? (
        <Pressable onPress={onToggleSecureEntry} style={styles.eyeIcon}>
          <Feather name={secureTextEntry ? "eye-off" : "eye"} size={20} color={COLORS.textSec} />
        </Pressable>
      ) : (
        !editable && <Feather name="lock" size={16} color={COLORS.textSec} />
      )}
    </View>
    {hint ? <Text style={styles.hintText}>{hint}</Text> : null}
  </View>
));

InputField.displayName = "InputField";

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { session, reloadUser, signOut } = useAuth();
  const authSession = session as any;

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [contact, setContact] = useState(""); // Secondary contact or Phone
  const [emailInput, setEmailInput] = useState(""); // For phone users to add email

  // Password fields for Phone Users
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [secure, setSecure] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBackToSignIn = async () => {
    if (loading) return;

    setError(null);
    try {
      setLoading(true);
      await signOut();
      router.replace("/login");
    } catch (err: any) {
      console.error("Back to sign in failed:", err);
      setError(err?.message || "Unable to return to sign in right now.");
    } finally {
      setLoading(false);
    }
  };

  // Determine if user is Phone Based (no email or internal email)
  // Logic: verification done, user exists. 
  // If session.email has '@medicare.internal', it is phone based.
  const isPhoneUser = !session?.email || session.email.endsWith('@medicare.internal');

  useEffect(() => {
    // Pre-fill known data
    if (authSession?.phoneNumber) {
      setContact(authSession.phoneNumber);
    }
    if (!isPhoneUser && session?.email) {
      setEmailInput(session.email);
    }
  }, [authSession, session, isPhoneUser]);

  const validate = () => {
    if (!firstName.trim()) return "Please enter your first name.";
    if (!lastName.trim()) return "Please enter your last name.";
    if (!age.trim()) return "Please enter your age.";
    const ageNum = parseInt(age.trim(), 10);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) return "Please enter a valid age (1-120).";

    if (isPhoneUser) {
      if (!password) return "Please set a password.";
      if (password.length < 6) return "Password must be at least 6 characters.";
      if (password !== confirm) return "Passwords do not match.";
      // Optional: Require email for phone users? Let's say optional or required.
      // If required: 
      // if (!emailInput || !/^\S+@\S+\.\S+$/.test(emailInput)) return "Please enter a valid email.";
    } else {
      if (!contact.trim()) return "Please enter a contact number.";
    }

    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    const v = validate();
    if (v) { setError(v); return; }

    setLoading(true);
    try {
      // 1. If Phone User, link password
      if (isPhoneUser) {
        // We use the phone number as the "email" identifier for linking in our helper
        const phoneParam = authSession?.phoneNumber || contact;
        // Logic check: Link helper uses phone + internal domain. 
        // Ensure we pass the raw phone from session if possible.

        const linkResult = await linkPhoneWithPassword(phoneParam || "", password);
        if (!linkResult.success) {
          throw new Error(linkResult.message || "Failed to set password.");
        }
      }

      // 2. Save Profile
      const fullName = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(" ");

      const updateData: any = {
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        fullName,
        age: parseInt(age.trim(), 10),
        sex: 'Unknown', // Todo: Add sex selection
        authMethod: isPhoneUser ? 'phone' : 'email',
        profileComplete: true,
        updatedAt: new Date().toISOString()
      };

      if (isPhoneUser) {
        updateData.phone = authSession?.phoneNumber;
        updateData.email = emailInput.trim() || null; // Optional email
        updateData.phoneVerified = true;
      } else {
        updateData.email = session?.email;
        updateData.contact = contact.trim();
        updateData.emailVerified = true;
      }

      await setDoc(doc(db, "users", session?.uid || ""), updateData, { merge: true });

      await reloadUser();
      router.replace("/user-type-selection");

    } catch (err: any) {
      console.error('Profile save error:', err);
      setError(err.message || "Failed to save profile.");
    } finally {
      setLoading(false);
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
            <TouchableOpacity
              style={styles.backLink}
              onPress={handleBackToSignIn}
              disabled={loading}
            >
              <Feather name="arrow-left" size={16} color={COLORS.primary} />
              <Text style={styles.backLinkText}>Back to Sign In</Text>
            </TouchableOpacity>
            <View style={styles.progressPill}>
              <Text style={styles.progressText}>Step 2 of 3</Text>
            </View>
            <Text style={styles.title}>Complete Profile</Text>
            <Text style={styles.subtitle}>Let&apos;s get to know you better</Text>
          </View>

          {/* --- Form Card --- */}
          <View style={styles.card}>
            {error && (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={16} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {isPhoneUser ? (
              <>
                <Text style={styles.sectionHeader}>Set Password</Text>
                <Text style={styles.sectionSub}>You will use this to sign in later.</Text>
                <InputField
                  label="Password"
                  icon="lock"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 6 characters"
                  isPassword
                  secureTextEntry={secure}
                  onToggleSecureEntry={() => setSecure(!secure)}
                />
                <InputField
                  label="Confirm Password"
                  icon="lock"
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Repeat password"
                  isPassword
                  secureTextEntry={secure}
                  onToggleSecureEntry={() => setSecure(!secure)}
                />
                <View style={styles.divider} />
                <InputField
                  label="Email Address (Optional)"
                  icon="mail"
                  value={emailInput}
                  onChangeText={setEmailInput}
                  placeholder="For notifications"
                  keyboardType="email-address"
                />
              </>
            ) : (
              <InputField
                label="Email Address"
                icon="mail"
                value={emailInput}
                editable={false}
              />
            )}

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <InputField
                  label="First Name"
                  icon="user"
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="John"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <InputField
                  label="Last Name"
                  icon="user"
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Doe"
                />
              </View>
            </View>

            <InputField
              label="Middle Name (Optional)"
              icon="user"
              value={middleName}
              onChangeText={setMiddleName}
              placeholder="Kwame"
            />

            <InputField
              label="Age"
              icon="user"
              value={age}
              onChangeText={setAge}
              placeholder="e.g. 25"
              keyboardType="numeric"
            />

            {!isPhoneUser && (
              <InputField
                label="Contact Number"
                icon="phone"
                value={contact}
                onChangeText={setContact}
                placeholder="+1 (555) 000-0000"
                keyboardType="phone-pad"
              />
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Complete Setup</Text>
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
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 18,
    paddingVertical: 8,
    gap: 6,
  },
  backLinkText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  progressPill: {
    backgroundColor: "#E3F2FD", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 16,
  },
  progressText: { color: COLORS.primary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.textMain, marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.textSec },

  // --- Card ---
  card: {
    backgroundColor: COLORS.surface, borderRadius: 24, padding: 24, ...SHADOW,
  },

  sectionHeader: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: COLORS.textSec, marginBottom: 16 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  row: { flexDirection: 'row' },

  // --- Inputs ---
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.primary, marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg,
    borderRadius: 12, height: 56, paddingHorizontal: 16, borderWidth: 1, borderColor: "transparent",
  },
  inputDisabled: {
    backgroundColor: COLORS.inputDisabled, borderColor: COLORS.border, borderWidth: 1,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: COLORS.textMain, height: '100%' },
  inputTextDisabled: { color: COLORS.textSec, fontWeight: '500' },
  hintText: { fontSize: 12, color: COLORS.textSec, marginTop: 6, marginLeft: 4 },
  eyeIcon: { padding: 8 },

  // --- Error ---
  errorContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5F5',
    borderRadius: 12, padding: 12, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: COLORS.danger,
  },
  errorText: { color: COLORS.danger, fontSize: 13, marginLeft: 8, flex: 1 },

  // --- Buttons ---
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, height: 56, borderRadius: 14, marginTop: 8, gap: 8, ...SHADOW, shadowOpacity: 0.15,
  },
  btnDisabled: { opacity: 0.7, backgroundColor: COLORS.textSec },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // --- Footer ---
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 32, gap: 8, opacity: 0.7,
  },
  footerText: { color: COLORS.textSec, fontSize: 12, fontWeight: '500' },
});
