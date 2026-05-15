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

export default function SecurityScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await updateUserPassword(currentPassword, newPassword);
      Alert.alert("Success", "Your password has been updated successfully.");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update password. Please check your current password.");
    } finally {
      setLoading(false);
    }
  };

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
            <Text style={styles.infoText}>Regularly updating your password helps keep your medical data safe.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter current password"
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <Text style={[styles.label, { marginTop: 20 }]}>New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <Text style={[styles.label, { marginTop: 20 }]}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity 
              style={[styles.updateBtn, loading && { opacity: 0.7 }]} 
              onPress={handleUpdatePassword}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.updateBtnText}>Update Password</Text>}
            </TouchableOpacity>
          </View>

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
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 30,
  },
  updateBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
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
