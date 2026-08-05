import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SECURITY_DESCRIPTION } from '../../constants/AppStrings';
import { updateUserPassword } from '../../services/users';
import { useAuth } from '../../hooks/useAuth';
import { canPerformAction, recordAction } from '../../utils/rateLimiter';

const COLORS = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  primary: "#4F46E5",
  textMain: "#1E293B",
  textSec: "#64748B",
  border: "#E2E8F0",
  success: "#10B981",
  warning: "#F59E0B",
};

export default function DoctorSecurityScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  // Cooldown state for the update button
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  // Tick cooldown down every second
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

  // Check if there's already an active cooldown when the screen mounts
  useEffect(() => {
    const checkCooldown = async () => {
      if (!session?.uid) return;
      const result = await canPerformAction(session.uid, 'password_change');
      if (!result.allowed) {
        setCooldown(result.remainingSeconds);
      }
    };
    checkCooldown();
  }, [session?.uid]);

  const handleUpdatePassword = async () => {
    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      Alert.alert("Missing Fields", "Please fill in all password fields.");
      return;
    }
    if (passwordData.new !== passwordData.confirm) {
      Alert.alert("Match Error", "New password and confirmation do not match.");
      return;
    }
    if (passwordData.new.length < 6) {
      Alert.alert("Password Strength", "New password must be at least 6 characters long.");
      return;
    }

    // Rate limit check
    if (!session?.uid) {
      Alert.alert("Error", "No active session found.");
      return;
    }

    const rateLimitResult = await canPerformAction(session.uid, 'password_change');
    if (!rateLimitResult.allowed) {
      setCooldown(rateLimitResult.remainingSeconds);
      Alert.alert(
        "Please Wait",
        `You recently changed your credentials. Please wait ${rateLimitResult.remainingSeconds}s before trying again.`
      );
      return;
    }

    setLoading(true);
    try {
      await updateUserPassword(passwordData.current, passwordData.new);

      // Record this action to start the cooldown
      await recordAction(session.uid, 'password_change');
      setCooldown(60);

      Alert.alert("Success", "Professional credentials updated successfully.");
      setPasswordData({ current: '', new: '', confirm: '' });
      router.back();
    } catch (err: any) {
      Alert.alert("Security Error", err.message || "Failed to update password. Please check your current password.");
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || cooldown > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={COLORS.textMain} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Security Settings</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.infoCard}>
            <Feather name="shield" size={32} color={COLORS.primary} />
            <Text style={styles.infoTitle}>Secure Your Practice</Text>
            <Text style={styles.infoSub}>{SECURITY_DESCRIPTION}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Current Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput 
                style={styles.input}
                secureTextEntry={!showCurrent}
                value={passwordData.current}
                onChangeText={t => setPasswordData(p => ({...p, current: t}))}
                placeholder="Enter current password"
                placeholderTextColor={COLORS.textSec}
                editable={!isDisabled}
              />
              <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                <Feather name={showCurrent ? "eye-off" : "eye"} size={20} color={COLORS.textSec} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>New Professional Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput 
                style={styles.input}
                secureTextEntry={!showNew}
                value={passwordData.new}
                onChangeText={t => setPasswordData(p => ({...p, new: t}))}
                placeholder="Minimum 6 characters"
                placeholderTextColor={COLORS.textSec}
                editable={!isDisabled}
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                <Feather name={showNew ? "eye-off" : "eye"} size={20} color={COLORS.textSec} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>Confirm New Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput 
                style={styles.input}
                secureTextEntry={!showNew}
                value={passwordData.confirm}
                onChangeText={t => setPasswordData(p => ({...p, confirm: t}))}
                placeholder="Repeat new password"
                placeholderTextColor={COLORS.textSec}
                editable={!isDisabled}
              />
            </View>

            <TouchableOpacity 
              style={[styles.saveBtn, isDisabled && styles.saveBtnDisabled]} 
              onPress={handleUpdatePassword}
              disabled={isDisabled}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : cooldown > 0 ? (
                <>
                  <Feather name="clock" size={18} color="#fff" />
                  <Text style={[styles.saveBtnText, { marginLeft: 8 }]}>Wait {cooldown}s</Text>
                </>
              ) : (
                <Text style={styles.saveBtnText}>Update Credentials</Text>
              )}
            </TouchableOpacity>
          </View>

          {cooldown > 0 && (
            <View style={styles.cooldownNote}>
              <Feather name="clock" size={14} color={COLORS.warning} />
              <Text style={styles.cooldownText}>
                Credential change cooldown: {cooldown}s remaining.
              </Text>
            </View>
          )}

          <View style={styles.securityNote}>
            <Feather name="lock" size={14} color={COLORS.textSec} />
            <Text style={styles.noteText}>
              All password changes are logged for security audits. Use a strong password with a mix of letters, numbers, and symbols.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textMain, letterSpacing: -0.5 },
  content: { padding: 20 },
  
  infoCard: {
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 10,
  },
  infoTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textMain, marginTop: 16 },
  infoSub: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
  },
  input: { flex: 1, fontSize: 16, color: COLORS.textMain },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 16,
    marginTop: 32,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.6, shadowOpacity: 0 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cooldownNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 4,
    gap: 6,
  },
  cooldownText: { fontSize: 13, color: COLORS.warning, fontWeight: '600' },
  securityNote: {
    flexDirection: 'row',
    marginTop: 30,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },
  noteText: {
    fontSize: 12,
    color: COLORS.textSec,
    marginLeft: 10,
    lineHeight: 18,
    flex: 1,
  },
});
