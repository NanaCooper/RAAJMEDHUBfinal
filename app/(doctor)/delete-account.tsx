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
import { deleteUserAccount } from '../../services/users';

const COLORS = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  primary: "#4F46E5",
  textMain: "#1E293B",
  textSec: "#64748B",
  border: "#E2E8F0",
  danger: "#EF4444",
};

export default function DoctorDeleteAccountScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleDelete = async () => {
    if (!confirmed) {
      Alert.alert("Final Check", "Please check the box to confirm you understand that all professional data will be permanently removed.");
      return;
    }

    setLoading(true);
    try {
      // Re-auth is handled inside deleteUserAccount service
      await deleteUserAccount(password || undefined);
      Alert.alert("Account Deleted", "Your professional profile has been removed. We're sorry to see you go.");
      router.replace('/login');
    } catch (err: any) {
      if (err.message === 'PASSWORD_REQUIRED') {
        setShowPassword(true);
        Alert.alert("Security Verification", "Please enter your password to confirm account deletion.");
      } else {
        Alert.alert("Deletion Failed", err.message || "Could not delete account. Please try again or contact support.");
      }
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
          <Text style={styles.headerTitle}>Delete Account</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.warningCard}>
            <View style={styles.warningIcon}>
              <Feather name="alert-octagon" size={40} color={COLORS.danger} />
            </View>
            <Text style={styles.warningTitle}>Professional Data Removal</Text>
            <Text style={styles.warningSub}>
              This action is permanent and cannot be undone. You will lose access to:
            </Text>
            
            <View style={styles.list}>
              <View style={styles.listItem}>
                <Feather name="x-circle" size={16} color={COLORS.danger} />
                <Text style={styles.listText}>Your verified doctor profile</Text>
              </View>
              <View style={styles.listItem}>
                <Feather name="x-circle" size={16} color={COLORS.danger} />
                <Text style={styles.listText}>All assigned patient appointments</Text>
              </View>
              <View style={styles.listItem}>
                <Feather name="x-circle" size={16} color={COLORS.danger} />
                <Text style={styles.listText}>Service notes and report history</Text>
              </View>
              <View style={styles.listItem}>
                <Feather name="x-circle" size={16} color={COLORS.danger} />
                <Text style={styles.listText}>Active availability schedules</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            {showPassword && (
              <View style={styles.passwordSection}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput 
                  style={styles.input}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your account password"
                  placeholderTextColor={COLORS.textSec}
                />
              </View>
            )}

            <TouchableOpacity 
              style={styles.confirmRow} 
              onPress={() => setConfirmed(!confirmed)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, confirmed && styles.checkboxActive]}>
                {confirmed && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={styles.confirmText}>
                I understand that account deletion is irreversible and I wish to proceed.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.deleteBtn, (!confirmed || (showPassword && !password) || loading) && styles.deleteBtnDisabled]} 
              onPress={handleDelete}
              disabled={!confirmed || (showPassword && !password) || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.deleteBtnText}>Permanently Delete My Practice</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>Keep My Account</Text>
          </TouchableOpacity>
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

  warningCard: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  warningIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  warningTitle: { fontSize: 20, fontWeight: '800', color: COLORS.danger },
  warningSub: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },

  list: { marginTop: 24, alignSelf: 'stretch', paddingHorizontal: 20 },
  listItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  listText: { fontSize: 14, color: COLORS.textMain, marginLeft: 12, fontWeight: '500' },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  passwordSection: {
    marginBottom: 20,
  },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    fontSize: 16,
    color: COLORS.textMain,
    marginBottom: 24,
  },
  confirmRow: { flexDirection: 'row', alignItems: 'flex-start' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  confirmText: { flex: 1, fontSize: 14, color: COLORS.textSec, lineHeight: 20 },

  deleteBtn: {
    backgroundColor: COLORS.danger,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  deleteBtnDisabled: { backgroundColor: COLORS.border },
  deleteBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  cancelBtn: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 12,
  },
  cancelBtnText: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
});
