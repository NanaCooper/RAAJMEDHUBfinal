import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { sendPasswordResetEmail } from '@react-native-firebase/auth';
import { auth } from "../../utils/firebaseConfig";
import { APP_NAME } from "../../constants/AppStrings";
import { canSendVerification, recordVerificationSent, getRemainingCooldown } from "../../utils/rateLimiter";
import {
  isEmail,
  formatPhoneNumber,
  sendPhoneVerificationCode,
  verifyPhoneCode,
  resetPasswordWithPhoneSession,
} from "../../utils/authHelpers";

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

type Step = "identifier" | "otp" | "newPassword";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState(""); // Email or Phone
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Countdown state so the user sees how long they must wait before resending
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Phone OTP flow state
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Tick the cooldown down every second
  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown]);

  // Check if the user already has an active cooldown on mount (e.g. they navigated back)
  useEffect(() => {
    const check = async () => {
      if (!identifier) return;
      const key = isEmail(identifier) ? identifier.trim().toLowerCase() : formatPhoneNumber(identifier);
      const result = await canSendVerification(key, isEmail(identifier) ? 'email' : 'phone');
      if (!result.allowed) setCooldown(result.remainingSeconds);
    };
    check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

  const handleSendEmailReset = async (email: string) => {
    const rateLimitResult = await canSendVerification(email.trim().toLowerCase(), 'email');
    if (!rateLimitResult.allowed) {
      setCooldown(rateLimitResult.remainingSeconds);
      setError(`You recently requested a reset link. Please wait ${rateLimitResult.remainingSeconds}s before trying again.`);
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email.trim());
      await recordVerificationSent(email.trim().toLowerCase(), 'email');
      setCooldown(60);

      Alert.alert(
        "Reset Link Sent",
        `If ${email.trim()} is registered, you'll receive a reset link shortly. Check your spam folder if you don't see it.`,
        [{ text: "Back to Sign In", onPress: () => router.replace("/login") }],
        { cancelable: true }
      );
    } catch (err: any) {
      console.error("Reset error:", err);
      // Firebase returns auth/user-not-found for unknown emails — we intentionally
      // show a generic message to avoid leaking which accounts exist.
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        await recordVerificationSent(email.trim().toLowerCase(), 'email');
        setCooldown(60);
        Alert.alert(
          "Reset Link Sent",
          `If ${email.trim()} is registered, you'll receive a reset link shortly.`,
          [{ text: "Back to Sign In", onPress: () => router.replace("/login") }],
          { cancelable: true }
        );
      } else if (err.code === 'auth/too-many-requests') {
        setError("Too many reset attempts. Please wait a few minutes and try again.");
      } else {
        setError("Unable to send reset link. Please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOtp = async (phone: string) => {
    const formatted = formatPhoneNumber(phone);
    const rateLimitResult = await canSendVerification(formatted, 'phone');
    if (!rateLimitResult.allowed) {
      setCooldown(rateLimitResult.remainingSeconds);
      setError(`You recently requested a code. Please wait ${rateLimitResult.remainingSeconds}s before trying again.`);
      return;
    }

    setLoading(true);
    try {
      const result = await sendPhoneVerificationCode(formatted);
      if (!result.success || !result.confirmationResult) {
        setError(result.message || "Unable to send verification code.");
        return;
      }
      setConfirmationResult(result.confirmationResult);
      const remaining = await getRemainingCooldown(formatted, 'phone');
      setCooldown(remaining || 60);
      setStep("otp");
    } catch (err: any) {
      console.error("Phone reset error:", err);
      setError("Unable to send verification code. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    setError(null);

    if (!identifier) {
      setError("Please enter the email or phone number associated with your account.");
      return;
    }

    if (isEmail(identifier)) {
      if (!isValidEmail(identifier)) {
        setError("Please enter a valid email address.");
        return;
      }
      await handleSendEmailReset(identifier);
    } else {
      await handleSendPhoneOtp(identifier);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6 || !confirmationResult) return;
    setLoading(true);
    setError(null);
    try {
      const result = await verifyPhoneCode(confirmationResult, otpCode);
      if (!result.success || !result.user) {
        setError(result.message || "Invalid code. Please try again.");
        return;
      }
      // signInWithPhoneNumber on an already-registered number signs back into that
      // SAME account. A phone number with no prior account lands here with only a
      // 'phone' provider and no linked password — that's not a valid reset target.
      const hasPasswordProvider = result.user.providerData.some((p: any) => p.providerId === 'password');
      if (!hasPasswordProvider) {
        await auth.signOut();
        setError("No account was found registered with this phone number.");
        setStep("identifier");
        setConfirmationResult(null);
        setOtpCode("");
        return;
      }
      setStep("newPassword");
    } catch (err: any) {
      console.error("OTP verify error:", err);
      setError("Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async () => {
    setError(null);
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await resetPasswordWithPhoneSession(newPassword);
      if (!result.success) {
        setError(result.message || "Failed to update password.");
        return;
      }
      Alert.alert(
        "Password Updated",
        "Your password has been changed. Please sign in with your new password.",
        [{ text: "Back to Sign In", onPress: () => router.replace("/login") }],
        { cancelable: true }
      );
    } catch (err: any) {
      console.error("Set new password error:", err);
      setError("Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError(null);
    if (isEmail(identifier)) {
      await handleSendEmailReset(identifier);
    } else {
      await handleSendPhoneOtp(identifier);
    }
  };

  const isDisabled = !identifier.trim() || loading || (step === 'identifier' && cooldown > 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

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
              <MaterialCommunityIcons name="office-building" size={32} color={COLORS.surface} />
            </View>
            <Text style={styles.appName}>{APP_NAME}<Text style={styles.dot}>.</Text></Text>
            <Text style={styles.tagline}>Secure · Private · Trusted</Text>
          </View>

          {/* --- Reset Card --- */}
          <View style={styles.card}>
            {step === "identifier" && (
              <>
                <Text style={styles.title}>Forgot Password</Text>
                <Text style={styles.subtitle}>
                  Enter your email or phone number. Email accounts get a reset link;
                  phone accounts get a verification code by SMS.
                </Text>

                {error && (
                  <View style={styles.errorContainer}>
                    <Feather name="alert-circle" size={16} color={COLORS.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email or Phone Number</Text>
                  <View style={[styles.inputContainer, error ? styles.inputError : null]}>
                    <Feather name={isEmail(identifier) ? "mail" : "phone"} size={20} color={COLORS.textSec} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="you@medicare.com or +233XXXXXXXXX"
                      placeholderTextColor="#ADB5BD"
                      autoCapitalize="none"
                      autoComplete="email"
                      value={identifier}
                      onChangeText={setIdentifier}
                      editable={!loading}
                      returnKeyType="send"
                      onSubmitEditing={handleSend}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, isDisabled && styles.btnDisabled]}
                  onPress={handleSend}
                  disabled={isDisabled}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : cooldown > 0 ? (
                    <>
                      <Feather name="clock" size={20} color="#FFF" />
                      <Text style={styles.primaryBtnText}>Resend in {cooldown}s</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>{isEmail(identifier) ? "Send Reset Link" : "Send Code"}</Text>
                      <Feather name="send" size={20} color="#FFF" />
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {step === "otp" && (
              <>
                <Text style={styles.title}>Enter Verification Code</Text>
                <Text style={styles.subtitle}>
                  We sent a 6-digit code to {formatPhoneNumber(identifier)}.
                </Text>

                {error && (
                  <View style={styles.errorContainer}>
                    <Feather name="alert-circle" size={16} color={COLORS.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Verification Code</Text>
                  <View style={styles.inputContainer}>
                    <Feather name="key" size={20} color={COLORS.textSec} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, styles.otpInput]}
                      placeholder="123456"
                      placeholderTextColor="#ADB5BD"
                      keyboardType="number-pad"
                      value={otpCode}
                      onChangeText={(t) => { if (t.length <= 6 && /^\d*$/.test(t)) setOtpCode(t); }}
                      editable={!loading}
                      maxLength={6}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, (otpCode.length !== 6 || loading) && styles.btnDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={otpCode.length !== 6 || loading}
                >
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Verify Code</Text>}
                </TouchableOpacity>

                <View style={styles.resendContainer}>
                  <Text style={styles.resendLabel}>Didn't receive the code?</Text>
                  <TouchableOpacity onPress={handleResend} disabled={cooldown > 0 || loading}>
                    <Text style={[styles.resendLink, cooldown > 0 && styles.disabledLink]}>
                      {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === "newPassword" && (
              <>
                <Text style={styles.title}>Set New Password</Text>
                <Text style={styles.subtitle}>Phone verified. Choose a new password.</Text>

                {error && (
                  <View style={styles.errorContainer}>
                    <Feather name="alert-circle" size={16} color={COLORS.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>New Password</Text>
                  <View style={styles.inputContainer}>
                    <Feather name="lock" size={20} color={COLORS.textSec} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="New password"
                      placeholderTextColor="#ADB5BD"
                      secureTextEntry
                      value={newPassword}
                      onChangeText={setNewPassword}
                      editable={!loading}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm New Password</Text>
                  <View style={styles.inputContainer}>
                    <Feather name="lock" size={20} color={COLORS.textSec} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm new password"
                      placeholderTextColor="#ADB5BD"
                      secureTextEntry
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                      editable={!loading}
                      returnKeyType="send"
                      onSubmitEditing={handleSetNewPassword}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={handleSetNewPassword}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Update Password</Text>}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                if (step !== "identifier") {
                  setStep("identifier");
                  setError(null);
                  setOtpCode("");
                  setConfirmationResult(null);
                } else {
                  router.replace("/login");
                }
              }}
              disabled={loading}
            >
              <Feather name="arrow-left" size={20} color={COLORS.primary} />
              <Text style={styles.secondaryBtnText}>{step === "identifier" ? "Back to Sign In" : "Start Over"}</Text>
            </TouchableOpacity>
          </View>

          {/* --- Footer --- */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              If you do not receive a code or email within a few minutes, check your spam folder or contact support.
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
  otpInput: { letterSpacing: 8, fontWeight: '700' },

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

  // --- Resend ---
  resendContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 8 },
  resendLabel: { color: COLORS.textSec, fontSize: 13 },
  resendLink: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  disabledLink: { color: COLORS.textSec },

  // --- Footer ---
  footer: { marginTop: 32, paddingHorizontal: 16 },
  footerText: { color: COLORS.textSec, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
