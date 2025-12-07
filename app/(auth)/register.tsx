import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

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
};

const SHADOW = {
  shadowColor: "#64748B",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

// Helper Component for Input Fields - moved outside and memoized
const InputField = React.memo(({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  isPassword = false,
  keyboardType = "default" as any,
  secureTextEntry,
  onToggleSecureEntry,
  editable,
}: any) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputContainer}>
      <Feather name={icon} size={20} color={COLORS.textSec} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#ADB5BD"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={isPassword && secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        editable={editable}
      />
      {isPassword && (
        <Pressable onPress={onToggleSecureEntry} style={styles.eyeIcon}>
          <Feather name={secureTextEntry ? "eye-off" : "eye"} size={20} color={COLORS.textSec} />
        </Pressable>
      )}
    </View>
  </View>
));

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, isLoading: authLoading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [secure, setSecure] = useState(true); // State for password visibility
  const [loading, setLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidEmail = (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim().toLowerCase());

  const validate = () => {
    if (!fullName.trim()) return "Please enter your full name.";
    if (!email.trim()) return "Please enter your email address.";
    if (!isValidEmail(email)) return "Please enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters long.";
    if (password !== confirm) return "Passwords do not match.";
    if (!agreeTerms) return "You must agree to the Terms & Privacy Policy.";
    return null;
  };

  const handleCreateAccount = async () => {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim(), password);
      // Navigation handled by auth listener
    } catch (err: any) {
      console.error("Registration error:", err);
      const errorMessage = err.message.includes('auth/') 
        ? err.message.split('auth/')[1].replace(/\([^)]+\)/g, '').replace(/-/g, ' ').trim()
        : "Registration failed. Please try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const overallLoading = loading || authLoading;

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
          {/* --- Brand Header --- */}
          <View style={styles.header}>
            <View style={styles.logoIcon}>
              <MaterialCommunityIcons name="hospital-box" size={32} color={COLORS.surface} />
            </View>
            <Text style={styles.appName}>MediCare<Text style={styles.dot}>.</Text></Text>
            <Text style={styles.tagline}>Join our secure healthcare network</Text>
          </View>

          {/* --- Registration Card --- */}
          <View style={styles.card}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Start your health journey today</Text>

            {error && (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={16} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <InputField 
              label="Full Name" 
              icon="user" 
              value={fullName} 
              onChangeText={setFullName} 
              placeholder="Dr. Jane Doe" 
              editable={!overallLoading}
            />

            <InputField 
              label="Email Address" 
              icon="mail" 
              value={email} 
              onChangeText={setEmail} 
              placeholder="you@medicare.com" 
              keyboardType="email-address"
              editable={!overallLoading}
            />

            <InputField 
              label="Password" 
              icon="lock" 
              value={password} 
              onChangeText={setPassword} 
              placeholder="Min. 8 characters" 
              isPassword
              secureTextEntry={secure}
              onToggleSecureEntry={() => setSecure(!secure)}
              editable={!overallLoading}
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
              editable={!overallLoading}
            />

            {/* Terms Checkbox */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAgreeTerms(!agreeTerms)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
                {agreeTerms && <Feather name="check" size={14} color="#FFF" />}
              </View>
              <Text style={styles.termsText}>
                I agree to the <Text style={styles.link}>Terms</Text> and <Text style={styles.link}>Privacy Policy</Text>.
              </Text>
            </TouchableOpacity>

            {/* Actions */}
            <TouchableOpacity
              style={[styles.primaryBtn, (!agreeTerms || overallLoading) && styles.btnDisabled]}
              onPress={handleCreateAccount}
              disabled={!agreeTerms || overallLoading}
            >
              {overallLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Create Account</Text>
                  <Feather name="arrow-right" size={20} color="#FFF" />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.line} />
            </View>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.replace("/login")}
              disabled={overallLoading}
            >
              <Text style={styles.secondaryBtnText}>Already have an account? Sign In</Text>
            </TouchableOpacity>
          </View>

          {/* --- Footer --- */}
          <View style={styles.footer}>
            <Feather name="shield" size={14} color={COLORS.textSec} />
            <Text style={styles.footerText}>HIPAA Compliant & Secure Encryption</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 },

  // --- Header ---
  header: { alignItems: 'center', marginBottom: 24 },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...SHADOW,
    shadowColor: COLORS.primary,
  },
  appName: { fontSize: 28, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.5 },
  dot: { color: COLORS.primary },
  tagline: { fontSize: 14, color: COLORS.textSec, marginTop: 4, fontWeight: '500' },

  // --- Card ---
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    ...SHADOW,
  },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textMain, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textSec, marginBottom: 24 },

  // --- Inputs ---
  inputGroup: { marginBottom: 16 },
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
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: COLORS.textMain, height: '100%' },
  eyeIcon: { padding: 8 },

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

  // --- Terms ---
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
    marginTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.textSec,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  termsText: { flex: 1, color: COLORS.textSec, fontSize: 13, lineHeight: 20 },
  link: { color: COLORS.primary, fontWeight: "700" },

  // --- Buttons ---
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 14,
    gap: 8,
    ...SHADOW,
    shadowOpacity: 0.15,
  },
  btnDisabled: { opacity: 0.7, backgroundColor: COLORS.textSec },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 15 },

  // --- Divider ---
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  line: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText: { marginHorizontal: 16, fontSize: 12, color: COLORS.textSec, fontWeight: '600' },

  // --- Footer ---
  footer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 32, 
    gap: 8,
    opacity: 0.7
  },
  footerText: { color: COLORS.textSec, fontSize: 12, fontWeight: '500' },
});