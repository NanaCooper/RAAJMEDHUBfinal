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
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

  const handleSendReset = async () => {
    setError(null);

    if (!email) {
      setError("Please enter the email address associated with your account.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      // mock network delay
      await new Promise((res) => setTimeout(res, 900));

      // Mock sending reset link (replace with real API call)
      console.log("Send password reset link to:", email.trim());

      Alert.alert(
        "Reset Link Sent",
        `If ${email.trim()} is registered, you'll receive a reset link shortly.`,
        [
          {
            text: "Back to Sign In",
            onPress: () => router.replace("/login"),
          },
        ],
        { cancelable: true }
      );
    } catch (err) {
      console.error("Reset error:", err);
      setError("Unable to send reset link. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

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
          keyboardShouldPersistTaps="handled"
        >
          {/* --- Brand Header --- */}
          <View style={styles.header}>
            <View style={styles.logoIcon}>
              <MaterialCommunityIcons name="hospital-box" size={32} color={COLORS.surface} />
            </View>
            <Text style={styles.appName}>RAAJ MedHub<Text style={styles.dot}>.</Text></Text>
            <Text style={styles.tagline}>Secure · Private · Trusted</Text>
          </View>

          {/* --- Reset Card --- */}
          <View style={styles.card}>
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>
              Enter your email and we will send a secure link to reset your password.
            </Text>

            {error && (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={16} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputContainer, error ? styles.inputError : null]}>
                <Feather name="mail" size={20} color={COLORS.textSec} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="you@medicare.com"
                  placeholderTextColor="#ADB5BD"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  editable={!loading}
                  returnKeyType="send"
                  onSubmitEditing={handleSendReset}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (!isValidEmail(email) || loading) && styles.btnDisabled,
              ]}
              onPress={handleSendReset}
              disabled={!isValidEmail(email) || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Send Reset Link</Text>
                  <Feather name="send" size={20} color="#FFF" />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.replace("/login")}
              disabled={loading}
            >
              <Feather name="arrow-left" size={20} color={COLORS.primary} />
              <Text style={styles.secondaryBtnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>

          {/* --- Footer --- */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              If you do not receive an email within a few minutes, check your spam folder or contact support.
            </Text>
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
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textMain, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSec, marginBottom: 24, lineHeight: 20 },

  // --- Input ---
  inputGroup: { marginBottom: 24 },
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
  inputError: {
    borderColor: COLORS.danger,
    backgroundColor: '#FFF5F5',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: COLORS.textMain, height: '100%' },

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
    gap: 8,
    ...SHADOW,
    shadowOpacity: 0.15,
    marginBottom: 16,
  },
  btnDisabled: { opacity: 0.7, backgroundColor: COLORS.textSec },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    gap: 8,
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 15 },

  // --- Footer ---
  footer: { marginTop: 32, paddingHorizontal: 16 },
  footerText: { color: COLORS.textSec, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});