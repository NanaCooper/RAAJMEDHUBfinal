import React, { useState } from 'react';
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

const COLORS = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  primary: "#4F46E5",
  textMain: "#1E293B",
  textSec: "#64748B",
  border: "#E2E8F0",
  success: "#10B981",
};

export default function DoctorSecurityScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  });

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

    setLoading(true);
    try {
      await updateUserPassword(passwordData.current, passwordData.new);
      Alert.alert("Success", "Professional credentials updated successfully.");
      setPasswordData({ current: '', new: '', confirm: '' });
      router.back();
    } catch (err: any) {
      Alert.alert("Security Error", err.message || "Failed to update password. Please check your current password.");
    } finally {
      setLoading(false);
    }
  };

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
            <Text style={styles.infoSub}>Regularly updating your password helps protect patient data and your professional profile.</Text>
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
              />
            </View>

            <TouchableOpacity 
              style={[styles.saveBtn, loading && { opacity: 0.7 }]} 
              onPress={handleUpdatePassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Update Credentials</Text>
              )}
            </TouchableOpacity>
          </View>

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
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
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
