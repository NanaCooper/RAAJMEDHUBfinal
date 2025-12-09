import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'expo-router';
import { updateUserProfile, updateUserPassword, requestDataExport } from '../../services/users';
import { updateNotificationPreferences } from '../../services/notifications';

const COLORS = {
  bg: "#F8FAFC",        // Slate 50
  card: "#FFFFFF",
  primary: "#4F46E5",   // Indigo 600
  primaryDark: "#4338ca",
  textMain: "#1E293B",  // Slate 800
  textSec: "#64748B",   // Slate 500
  input: "#F1F5F9",     // Slate 100
  border: "#E2E8F0",
  success: "#10B981",
  danger: "#EF4444",
  overlay: "rgba(0,0,0,0.05)",
};

const SHADOW = {
  shadowColor: "#64748B",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 16,
  elevation: 4,
};

const Section = ({ title, children, actionButton }: { title: string; children: React.ReactNode; actionButton?: React.ReactNode }) => (
  <View style={styles.sectionBody}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionButton}
    </View>
    {children}
  </View>
);

const EditableInfoRow = ({ label, value, onChange, isEditing, placeholder }: { label: string; value: string; onChange: (text: string) => void; isEditing: boolean; placeholder?: string }) => {
  if (isEditing) {
    return (
      <View style={styles.editRow}>
        <Text style={styles.label}>{label}</Text>
        <TextInput 
          style={styles.input} 
          value={value} 
          onChangeText={onChange} 
          placeholder={placeholder}
          placeholderTextColor={COLORS.textSec}
        />
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );
};

const SettingRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    {children}
  </View>
);

const PasswordInput = ({ 
  value, 
  onChangeText, 
  placeholder 
}: { 
  value: string; 
  onChangeText: (text: string) => void; 
  placeholder: string; 
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.passwordContainer}>
      <TextInput
        style={styles.passwordInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSec}
        secureTextEntry={!visible}
      />
      <TouchableOpacity onPress={() => setVisible(!visible)} style={styles.eyeIcon}>
        <Feather name={visible ? "eye" : "eye-off"} size={20} color={COLORS.textSec} />
      </TouchableOpacity>
    </View>
  );
};

const PatientSettingsScreen = () => {
  const { user, signOut, reloadUser } = useAuth();
  const router = useRouter();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Profile Data State
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phone: '', // Changed from phoneNumber to phone to match profile.tsx
    dob: '',   // Changed from dateOfBirth to dob to match profile.tsx
    emergencyContact: { name: '', phone: '' },
    photoURL: '',
  });

  // Notification Preferences State
  const [notificationPrefs, setNotificationPrefs] = useState({
    push: true,
    sms: false,
    email: true,
    appointmentReminders: true, // Changed to boolean for switch
    newMessageAlerts: true,
    testResultNotifications: true,
    paymentReminders: true,
  });

  const [passwordData, setPasswordData] = useState({ current: '', new: '' });

  useEffect(() => {
    if (user) {
      setProfileData({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || user.contact || '', // Handle both fields
        dob: user.dob || user.dateOfBirth || '', // Handle both fields
        emergencyContact: user.emergencyContact || { name: '', phone: '' },
        photoURL: user.photoURL || '',
      });
      
      if (user.notificationPrefs) {
        // Ensure we handle the case where appointmentReminders might be a string in DB
        const prefs = { ...user.notificationPrefs };
        if (typeof prefs.appointmentReminders === 'string') {
            prefs.appointmentReminders = true; // Default to true if it was set to a string previously
        }
        setNotificationPrefs(prev => ({ ...prev, ...prefs }));
      }
    }
  }, [user]);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => {
          signOut();
          router.replace('/login');
      }},
    ]);
  };

  const handleProfileUpdate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateUserProfile(user.uid, { 
        ...profileData, 
        // Map back to schema if needed, but we are standardizing on phone/dob
        phone: profileData.phone,
        dob: profileData.dob,
        notificationPrefs 
      });
      await reloadUser();
      Alert.alert("Success", "Settings updated successfully.");
      setIsEditingProfile(false);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to update settings.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordData.current || !passwordData.new) {
        Alert.alert("Error", "Please fill in both password fields.");
        return;
    }
    setLoading(true);
    try {
      await updateUserPassword(passwordData.current, passwordData.new);
      Alert.alert("Success", "Password changed successfully.");
      setPasswordData({ current: '', new: '' });
    } catch (error) {
        const err = error as Error;
        Alert.alert("Error", err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleDataExport = async () => {
    if (!user) return;
    try {
      await requestDataExport(user.uid);
      Alert.alert("Request Received", "Your data export request has been received. You will receive an email with your data within 24 hours.");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to request data export.");
    }
  };

  const onSave = () => {
    if (isEditingProfile) {
        handleProfileUpdate();
    } else {
        setIsEditingProfile(true);
    }
  }

  // Auto-save notification prefs when toggled? 
  // Or save all at once? The current pattern implies "Edit" -> "Save" for personal info.
  // But switches usually act immediately. Let's make switches save immediately or have a global save?
  // The original code had a "Save" button only for the Personal Info section.
  // Let's keep the "Edit/Save" for Personal Info, but maybe add a "Save Preferences" or just save on toggle.
  // For simplicity and better UX, let's save notification prefs immediately when changed.
  
  const toggleNotification = async (key: keyof typeof notificationPrefs) => {
      const newVal = !notificationPrefs[key];
      setNotificationPrefs(prev => ({ ...prev, [key]: newVal }));
      
      // Sync with local notification service for relevant keys
      if (key === 'push') {
        await updateNotificationPreferences({ enabled: newVal });
      } else if (key === 'newMessageAlerts') {
        // Assuming newMessageAlerts maps to enabled or maybe we need a specific key in the service
        // For now, let's just ensure the service knows notifications are enabled/disabled
        // If we want granular control, we might need to update the service interface
      }

      if (user) {
          try {
              // Optimistic update
              await updateUserProfile(user.uid, { 
                  notificationPrefs: { ...notificationPrefs, [key]: newVal } 
              });
          } catch (e) {
              console.error("Failed to save pref", e);
              // Revert on error?
          }
      }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.headerTitle}>Settings</Text>

        <View style={styles.profileHeader}>
          <Text style={styles.profileName}>{profileData.fullName}</Text>
          <Text style={styles.profileEmail}>{profileData.email}</Text>
        </View>

        <Section 
          title="Personal Information"
          actionButton={
            <TouchableOpacity onPress={onSave} disabled={loading}>
              {loading && isEditingProfile ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                  <Text style={{ color: COLORS.primary, fontWeight: '600' }}>{isEditingProfile ? 'Save' : 'Edit'}</Text>
              )}
            </TouchableOpacity>
          }
        >
          <EditableInfoRow 
            label="Phone" 
            value={profileData.phone} 
            onChange={text => setProfileData(p => ({ ...p, phone: text }))} 
            isEditing={isEditingProfile} 
            placeholder="+1 234 567 890"
          />
          <EditableInfoRow 
            label="Date of Birth" 
            value={profileData.dob} 
            onChange={text => setProfileData(p => ({ ...p, dob: text }))} 
            isEditing={isEditingProfile} 
            placeholder="YYYY-MM-DD"
          />
        </Section>

        

        <Section title="Notification Preferences">
          <SettingRow label="Push Notifications">
            <Switch 
                value={notificationPrefs.push} 
                onValueChange={() => toggleNotification('push')} 
                trackColor={{ false: COLORS.border, true: COLORS.primary }} 
            />
          </SettingRow>
          
          
          <View style={styles.divider} />
          <SettingRow label="Appointment Reminders">
            <Switch 
                value={notificationPrefs.appointmentReminders as boolean} 
                onValueChange={() => toggleNotification('appointmentReminders')} 
                trackColor={{ false: COLORS.border, true: COLORS.primary }} 
            />
          </SettingRow>
          
        </Section>

        <Section title="Security">
            <View style={styles.editRow}>
                <Text style={styles.label}>Current Password</Text>
                <PasswordInput 
                    placeholder="Enter current password" 
                    value={passwordData.current} 
                    onChangeText={t => setPasswordData(p => ({...p, current: t}))} 
                />
            </View>
            <View style={styles.editRow}>
                <Text style={styles.label}>New Password</Text>
                <PasswordInput 
                    placeholder="Enter new password" 
                    value={passwordData.new} 
                    onChangeText={t => setPasswordData(p => ({...p, new: t}))} 
                />
            </View>
            <TouchableOpacity style={styles.button} onPress={handlePasswordChange} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Change Password</Text>}
            </TouchableOpacity>
        </Section>
        <TouchableOpacity style={[styles.button, { backgroundColor: COLORS.danger, marginTop: 20 }]} onPress={handleLogout}>
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

export default PatientSettingsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { padding: 20, paddingBottom: 100 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textMain, marginBottom: 24, letterSpacing: -0.5 },
  
  profileHeader: { alignItems: 'center', marginBottom: 32 },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { backgroundColor: COLORS.primary + '20', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 40, fontWeight: '800', color: COLORS.primary },
  cameraIcon: { 
    position: 'absolute', 
    bottom: 0, 
    right: 0, 
    backgroundColor: COLORS.primary, 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 3, 
    borderColor: COLORS.bg 
  },
  profileName: { fontSize: 22, fontWeight: '800', color: COLORS.textMain },
  profileEmail: { fontSize: 16, color: COLORS.textSec, marginTop: 4 },
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  sectionBody: { 
    backgroundColor: COLORS.card, 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 24,
    borderWidth: 1, 
    borderColor: COLORS.border, 
    ...SHADOW 
  },
  
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.input },
  editRow: { marginBottom: 16 },
  
  rowLabel: { fontSize: 16, color: COLORS.textMain, fontWeight: '500' },
  rowValue: { fontSize: 16, color: COLORS.textSec, fontWeight: '500' },
  
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSec, marginBottom: 8 },
  input: { 
    backgroundColor: COLORS.input, 
    borderRadius: 12, 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    fontSize: 16, 
    color: COLORS.textMain 
  },
  
  button: { 
    backgroundColor: COLORS.primary, 
    paddingVertical: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    ...SHADOW,
    shadowColor: COLORS.primary,
    marginTop: 16
  },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.input,
    borderRadius: 12,
    paddingHorizontal: 16,
    flex: 1,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textMain,
  },
  eyeIcon: {
    padding: 4,
  },
});
