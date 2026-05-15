import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ActivityIndicator,
  Modal
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { deleteUserAccount } from '../../services/users';
import { getAuthInstance } from '../../utils/firebaseConfig';

const COLORS = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  primary: "#4F46E5",
  textMain: "#1E293B",
  textSec: "#64748B",
  border: "#E2E8F0",
  danger: "#EF4444",
};

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    async function checkProvider() {
      try {
        const auth = await getAuthInstance();
        const providers = (auth.currentUser?.providerData || []).map((p: any) => p.providerId);
        setNeedsPassword(providers.includes('password'));
      } catch (e) {
        console.error(e);
      }
    }
    checkProvider();
  }, []);

  const performDelete = async (pwd?: string) => {
    setLoading(true);
    try {
      await deleteUserAccount(pwd);
      router.replace('/login');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        Alert.alert("Incorrect Password", "The password you entered is incorrect.");
      } else if (error.message === 'REQUIRES_REAUTH') {
        Alert.alert("Session Expired", "Please sign out and sign back in to delete your account.");
      } else {
        Alert.alert("Error", "Failed to delete account. Please contact support.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (confirmText.toLowerCase() !== 'delete') {
      Alert.alert("Confirmation Required", "Please type 'DELETE' in the input field to confirm.");
      return;
    }

    Alert.alert(
      "Final Confirmation",
      "This will permanently delete all your medical records and appointments. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete My Account", 
          style: "destructive", 
          onPress: () => performDelete(needsPassword ? password : undefined) 
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(patient)/settings')}>
          <Feather name="arrow-left" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Account</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.warningBox}>
          <Feather name="alert-triangle" size={48} color={COLORS.danger} />
          <Text style={styles.warningTitle}>Wait! Are you sure?</Text>
          <Text style={styles.warningText}>
            Deleting your account is permanent and will result in the loss of:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• All appointment history</Text>
            <Text style={styles.bulletItem}>• All medical reports and scans</Text>
            <Text style={styles.bulletItem}>• Your profile and preferences</Text>
            <Text style={styles.bulletItem}>• Communication history with providers</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Type "DELETE" to confirm</Text>
          <TextInput
            style={styles.input}
            placeholder='Type "DELETE" here'
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
          />

          {needsPassword && (
            <>
              <Text style={[styles.formLabel, { marginTop: 20 }]}>Enter your password</Text>
              <TextInput
                style={styles.input}
                placeholder="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </>
          )}

          <TouchableOpacity 
            style={[styles.deleteBtn, (confirmText !== 'DELETE' || (needsPassword && !password)) && styles.disabledBtn]} 
            onPress={handleDelete}
            disabled={loading || confirmText !== 'DELETE' || (needsPassword && !password)}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteBtnText}>Delete Permanently</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.keepBtn} onPress={() => router.push('/(patient)/settings')}>
          <Text style={styles.keepBtnText}>I want to keep my account</Text>
        </TouchableOpacity>
      </ScrollView>
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
  warningBox: {
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FECDD3',
    marginBottom: 24,
  },
  warningTitle: { fontSize: 20, fontWeight: '800', color: COLORS.danger, marginTop: 16 },
  warningText: { fontSize: 14, color: '#9F1239', textAlign: 'center', marginTop: 12, lineHeight: 20 },
  bulletList: { alignSelf: 'flex-start', marginTop: 16, marginLeft: 20 },
  bulletItem: { fontSize: 14, color: '#9F1239', marginBottom: 6, fontWeight: '600' },
  formCard: {
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  formLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 12 },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.textMain,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  deleteBtn: {
    backgroundColor: COLORS.danger,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 30,
  },
  disabledBtn: { opacity: 0.5 },
  deleteBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  keepBtn: {
    alignItems: 'center',
    marginTop: 24,
    padding: 12,
  },
  keepBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
});
