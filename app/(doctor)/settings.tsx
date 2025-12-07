import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert, TextInput, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'expo-router';
import { updateUserProfile, updateUserPassword } from '../../services/users';
import { updateNotificationPreferences } from '../../services/notifications';

// --- 🎨 Unified Premium Theme ---
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

const EditableInfoRow = ({ label, value, onChange, isEditing, placeholder, multiline = false }: { label: string; value: string; onChange: (text: string) => void; isEditing: boolean; placeholder?: string; multiline?: boolean }) => {
  if (isEditing) {
    return (
      <View style={styles.editRow}>
        <Text style={styles.label}>{label}</Text>
        <TextInput 
          style={[styles.input, multiline && styles.textArea]} 
          value={value} 
          onChangeText={onChange} 
          placeholder={placeholder}
          placeholderTextColor={COLORS.textSec}
          multiline={multiline}
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

const DoctorSettingsScreen = () => {
  const { user, signOut, reloadUser } = useAuth();
  const router = useRouter();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Profile Data State
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phone: '', 
    dob: '',
    specialization: '',
    qualifications: '',
    bio: '',
    photoURL: '',
  });

  // Notification Preferences State
  const [notificationPrefs, setNotificationPrefs] = useState({
    push: true,
    sms: false,
    email: true,
    newAppointment: true,
    appointmentCancellations: true,
    newMessageAlerts: true,
  });

  const [passwordData, setPasswordData] = useState({ current: '', new: '' });

  useEffect(() => {
    if (user) {
      setProfileData({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || user.contact || '',
        dob: user.dob || user.dateOfBirth || '',
        specialization: user.specialization || user.specialty || '',
        qualifications: user.qualifications || '',
        bio: user.bio || '',
        photoURL: user.photoURL || '',
      });
      
      if (user.notificationPrefs) {
        setNotificationPrefs(prev => ({ ...prev, ...user.notificationPrefs }));
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
        // Normalize fields
        phone: profileData.phone,
        dob: profileData.dob,
        specialization: profileData.specialization,
        notificationPrefs 
      });
      await reloadUser();
      Alert.alert("Success", "Profile updated successfully.");
      setIsEditingProfile(false);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to update profile.");
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
    } catch (error: any) {
        console.error("Password change error:", error);
        let msg = error.message;
        if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
            msg = "The current password you entered is incorrect.";
        } else if (msg.includes('auth/requires-recent-login')) {
            msg = "For security, please sign out and sign back in before changing your password.";
        }
        Alert.alert("Error", msg);
    } finally {
        setLoading(false);
    }
  };

  const onSave = () => {
    if (isEditingProfile) {
        handleProfileUpdate();
    } else {
        setIsEditingProfile(true);
    }
  }

  const toggleNotification = async (key: keyof typeof notificationPrefs) => {
      const newVal = !notificationPrefs[key];
      setNotificationPrefs(prev => ({ ...prev, [key]: newVal }));
      
      // Sync with local notification service for relevant keys
      if (key === 'push') {
        await updateNotificationPreferences({ enabled: newVal });
      }

      if (user) {
          try {
              // Optimistic update
              await updateUserProfile(user.uid, { 
                  notificationPrefs: { ...notificationPrefs, [key]: newVal } 
              });
          } catch (e) {
              console.error("Failed to save pref", e);
          }
      }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.headerTitle}>Settings</Text>

        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {profileData.photoURL ? (
                <Image source={{ uri: profileData.photoURL }} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitial}>{(profileData.fullName?.charAt(0) || 'D').toUpperCase()}</Text>
                </View>
            )}
          </View>
          <Text style={styles.profileName}>{profileData.fullName}</Text>
          <Text style={styles.profileEmail}>{profileData.email}</Text>
        </View>

        <Section 
          title="Professional Information"
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
            label="Specialization" 
            value={profileData.specialization} 
            onChange={text => setProfileData(p => ({ ...p, specialization: text }))} 
            isEditing={isEditingProfile} 
            placeholder="e.g. Cardiologist"
          />
          <EditableInfoRow 
            label="Qualifications" 
            value={profileData.qualifications} 
            onChange={text => setProfileData(p => ({ ...p, qualifications: text }))} 
            isEditing={isEditingProfile} 
            placeholder="e.g. MBBS, MD"
          />
          <EditableInfoRow 
            label="Bio" 
            value={profileData.bio} 
            onChange={text => setProfileData(p => ({ ...p, bio: text }))} 
            isEditing={isEditingProfile} 
            placeholder="Tell patients about yourself..."
            multiline
          />
        </Section>

        <Section title="Personal Information">
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
          <SettingRow label="Email Notifications">
            <Switch 
                value={notificationPrefs.email} 
                onValueChange={() => toggleNotification('email')} 
                trackColor={{ false: COLORS.border, true: COLORS.primary }} 
            />
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow label="New Appointments">
            <Switch 
                value={notificationPrefs.newAppointment} 
                onValueChange={() => toggleNotification('newAppointment')} 
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

export default DoctorSettingsScreen;

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
  rowValue: { fontSize: 16, color: COLORS.textSec, fontWeight: '500', flex: 1, textAlign: 'right' },
  
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSec, marginBottom: 8 },
  input: { 
    backgroundColor: COLORS.input, 
    borderRadius: 12, 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    fontSize: 16, 
    color: COLORS.textMain 
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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

  actionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
  },
  actionRowText: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.textMain,
  },
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
