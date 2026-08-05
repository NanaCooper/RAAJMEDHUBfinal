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

export default function SecurityScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Missing Information", "Please fill in all three password fields before continuing.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords Don't Match", "Your new password and the confirmation don't match. Please try again.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Password Too Short", "Your new password needs to be at least 6 characters long.");
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
        `You recently changed your password. Please wait ${rateLimitResult.remainingSeconds}s before trying again.`
      );
      return;
    }

    setLoading(true);
    try {
      await updateUserPassword(currentPassword, newPassword);

      // Record this action to start the cooldown
      await recordAction(session.uid, 'password_change');
      setCooldown(60);

      Alert.alert("Password Updated", "Your password has been changed successfully.");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      router.back();
    } catch (err: any) {
      Alert.alert("Couldn't Update Password", "The current password you entered is incorrect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || cooldown > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(patient)/settings')}>
          <Feather name="arrow-left" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.infoBox}>
            <Feather name="shield" size={32} color={COLORS.primary} />
            <Text style={styles.infoTitle}>Secure Your Account</Text>
            <Text style={styles.infoText}>Regularly updating your password helps keep your account data safe.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter current password"
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              editable={!isDisabled}
            />

            <Text style={[styles.label, { marginTop: 20 }]}>New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              editable={!isDisabled}
            />

            <Text style={[styles.label, { marginTop: 20 }]}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!isDisabled}
            />

            <TouchableOpacity 
              style={[styles.updateBtn, isDisabled && styles.updateBtnDisabled]} 
              onPress={handleUpdatePassword}
              disabled={isDisabled}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : cooldown > 0 ? (
                <>
                  <Feather name="clock" size={18} color="#fff" />
                  <Text style={styles.updateBtnText}>  Wait {cooldown}s</Text>
                </>
              ) : (
                <Text style={styles.updateBtnText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>

          {cooldown > 0 && (
            <View style={styles.cooldownNote}>
              <Feather name="clock" size={14} color={COLORS.warning} />
              <Text style={styles.cooldownText}>
                Password change cooldown: {cooldown}s remaining.
              </Text>
            </View>
          )}

          <View style={styles.footerInfo}>
            <Feather name="info" size={16} color={COLORS.textSec} />
            <Text style={styles.footerText}>
              If you signed in with Google, you can manage your security settings through your Google Account.
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
  infoBox: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  infoTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textMain, marginTop: 16 },
  infoText: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', marginTop: 8, paddingHorizontal: 30 },
  card: {
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 10 },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.textMain,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  updateBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    alignSelf: 'stretch',
    marginTop: 30,
  },
  updateBtnDisabled: { opacity: 0.6 },
  updateBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cooldownNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 4,
    gap: 6,
  },
  cooldownText: { fontSize: 13, color: COLORS.warning, fontWeight: '600' },
  footerInfo: {
    flexDirection: 'row',
    marginTop: 24,
    paddingHorizontal: 10,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textSec,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
});
