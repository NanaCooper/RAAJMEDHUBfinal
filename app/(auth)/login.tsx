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
  Pressable,
  ScrollView,
  Image,
} from "react-native";
import {
  Feather,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { GoogleSignInButton } from '../../components/GoogleSignInButton';

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

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleSignIn = async () => {
    setError(null);

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      console.log("Sign in error:", err);
      const errorMessage = err.message.includes('auth/') 
        ? err.message.split('auth/')[1].replace(/\([^)]+\)/g, '').replace(/-/g, ' ').trim()
        : "Sign in failed. Check credentials.";
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
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
        >
          {/* --- Brand Header --- */}
          <View style={styles.header}>
            <View style={styles.logoIcon}>
              <MaterialCommunityIcons name="hospital-box" size={32} color={COLORS.surface} />
            </View>
            <Text style={styles.appName}>RAAJ MedHub<Text style={styles.appNameDot}>.</Text></Text>
            <Text style={styles.tagline}>Professional Healthcare Management</Text>
          </View>

          {/* --- Login Card --- */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Securely access your patient portal</Text>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={16} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputContainer}>
                <Feather name="mail" size={20} color={COLORS.textSec} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor="#ADB5BD"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  editable={!overallLoading}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <Pressable onPress={() => router.push("/forgot-password")}>
                  <Text style={styles.forgotLink}>Forgot?</Text>
                </Pressable>
              </View>
              <View style={styles.inputContainer}>
                <Feather name="lock" size={20} color={COLORS.textSec} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#ADB5BD"
                  secureTextEntry={secure}
                  value={password}
                  onChangeText={setPassword}
                  editable={!overallLoading}
                />
                <Pressable onPress={() => setSecure(!secure)} style={styles.eyeIcon}>
                  <Feather name={secure ? "eye-off" : "eye"} size={20} color={COLORS.textSec} />
                </Pressable>
              </View>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.primaryBtn, overallLoading && styles.btnDisabled]}
              onPress={handleSignIn}
              disabled={overallLoading}
            >
              {overallLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Sign In</Text>
                  <Feather name="arrow-right" size={20} color="#FFF" />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.orText}>OR CONTINUE WITH</Text>
              <View style={styles.line} />
            </View>

            {/* Google Button */}
            <GoogleSignInButton />
          </View>

          {/* --- Footer --- */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>New to MedHub?</Text>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text style={styles.createLink}>Create Account</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  // --- Header ---
  header: { alignItems: 'center', marginBottom: 32 },
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
  appName: { fontSize: 32, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.5 },
  appNameDot: { color: COLORS.primary },
  tagline: { fontSize: 14, color: COLORS.textSec, marginTop: 8, fontWeight: '500' },

  // --- Card ---
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    ...SHADOW,
  },
  cardHeader: { marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textMain, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSec },

  // --- Inputs ---
  inputGroup: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.primary, marginBottom: 8 },
  forgotLink: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  
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

  // --- Errors ---
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
    marginBottom: 24,
    gap: 8,
    ...SHADOW,
    shadowOpacity: 0.15,
  },
  btnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  googleBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.textMain },

  // --- Divider ---
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  line: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText: { marginHorizontal: 16, fontSize: 12, color: COLORS.textSec, fontWeight: '600' },

  // --- Footer ---
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32, gap: 6 },
  footerText: { color: COLORS.textSec, fontSize: 14 },
  createLink: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
});