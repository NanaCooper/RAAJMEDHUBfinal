import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Switch, 
  TouchableOpacity, 
  Alert, 
  TextInput, 
  ActivityIndicator, 
  StatusBar,
  Platform,
  Image,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'expo-router';
import { 
  updateUserProfile, 
  updateUserPassword, 
  deleteUserAccount 
} from '../../services/users';
import { updateNotificationPreferences } from '../../services/notifications';
import { getAuthInstance } from '../../utils/firebaseConfig';

// --- Premium Palette ---
const COLORS = {
  bg: "#F8FAFC",        // Slate 50
  card: "#FFFFFF",
  primary: "#4F46E5",   // Indigo 600
  primaryDark: "#312E81", // Indigo 900
  textMain: "#1E293B",  // Slate 800
  textSec: "#64748B",   // Slate 500
  input: "#F1F5F9",     // Slate 100
  border: "#E2E8F0",
  success: "#10B981",
  danger: "#EF4444",
  warning: "#F59E0B",
  surface: "#FFFFFF",
};

const SHADOW = {
  shadowColor: "#64748B",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 4,
};

// --- Sub-Components ---

const SectionHeader = ({ title, icon }: { title: string; icon: any }) => (
  <View style={styles.sectionHeaderRow}>
    <View style={styles.sectionIconBox}>
      <Feather name={icon} size={16} color={COLORS.primary} />
    </View>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

const SettingItem = ({ 
  label, 
  value, 
  icon, 
  onPress, 
  isSwitch, 
  switchValue, 
  onSwitchToggle,
  isDangerous,
  isLast
}: any) => (
  <TouchableOpacity 
    style={[styles.settingItem, isLast && styles.noBorder]} 
    onPress={onPress}
    disabled={isSwitch}
    activeOpacity={0.7}
  >
    <View style={styles.settingItemLeft}>
      {icon && <Feather name={icon} size={18} color={isDangerous ? COLORS.danger : COLORS.textSec} style={{marginRight: 12}} />}
      <Text style={[styles.settingLabel, isDangerous && { color: COLORS.danger, fontWeight: '700' }]}>{label}</Text>
    </View>
    <View style={styles.settingItemRight}>
      {isSwitch ? (
        <Switch 
          value={switchValue} 
          onValueChange={onSwitchToggle} 
          trackColor={{ false: COLORS.border, true: COLORS.primary }} 
          thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
        />
      ) : (
        <View style={styles.rowCenter}>
          {value && <Text style={styles.settingValue}>{value}</Text>}
          {!isDangerous && <Feather name="chevron-right" size={18} color={COLORS.border} />}
        </View>
      )}
    </View>
  </TouchableOpacity>
);

const DoctorSettingsScreen = () => {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  
  // States
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phone: '',
    specialization: '',
    qualifications: '',
    bio: '',
    photoURL: '',
  });

  const [notificationPrefs, setNotificationPrefs] = useState({
    push: true,
    email: true,
    newAppointment: true,
  });

  const [passwordData, setPasswordData] = useState({ current: '', new: '' });
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [tempProfileData, setTempProfileData] = useState(profileData);
  const [showPassword, setShowPassword] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteNeedsPassword, setDeleteNeedsPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileData({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || user.contact || '',
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
      { text: "Sign Out", style: "destructive", onPress: async () => {
          try {
            await signOut();
            router.replace('/login');
          } catch(err){
            console.error("Logout error", err);
          }
      }},
    ]);
  };

  const performDelete = async (password?: string) => {
    setLoading(true);
    try {
      await deleteUserAccount(password);
      router.replace('/login');
    } catch (error: any) {
      if (error.message === 'PASSWORD_REQUIRED') {
        setDeleteNeedsPassword(true);
        setDeleteModalVisible(true);
      } else if (error.message === 'REQUIRES_REAUTH') {
        Alert.alert("Session Expired", "Please sign out and sign back in, then try deleting your account again.");
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        Alert.alert("Wrong Password", "The password you entered is incorrect. Please try again.");
      } else if (error.message === 'GOOGLE_REAUTH_FAILED') {
        Alert.alert("Verification Failed", "Could not confirm your Google sign-in. Please try again.");
      } else {
        Alert.alert("Error", "Failed to delete account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    // Step 1: First confirmation
    Alert.alert(
      "Delete Account",
      "This action is permanent and cannot be undone. All your professional records and schedule will be deleted. Are you absolutely sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: async () => {
            try {
              const auth = await getAuthInstance();
              const providers: string[] = (auth.currentUser?.providerData || []).map((p: any) => p.providerId).filter(Boolean);
              const hasPasswordProvider = providers.includes('password');

              if (hasPasswordProvider) {
                setDeleteNeedsPassword(true);
                setDeleteModalVisible(true);
              } else {
                setDeleteNeedsPassword(false);
                await performDelete();
              }
            } catch {
              // Fallback: attempt delete (service will decide if password/reauth is required)
              await performDelete();
            }
          },
        },
      ]
    );
  };

  const toggleNotification = async (key: keyof typeof notificationPrefs) => {
    const newVal = !notificationPrefs[key];
    setNotificationPrefs(prev => ({ ...prev, [key]: newVal }));
    
    if (key === 'push') {
      await updateNotificationPreferences({ enabled: newVal });
    }

    if (user) {
      try {
        await updateUserProfile(user.uid, { 
          notificationPrefs: { ...notificationPrefs, [key]: newVal } 
        });
      } catch (err) {
        console.error("Failed to save pref", err);
      }
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwordData.current || !passwordData.new) {
      Alert.alert("Missing Info", "Please provide both current and new passwords.");
      return;
    }
    setLoading(true);
    try {
      await updateUserPassword(passwordData.current, passwordData.new);
      Alert.alert("Success", "Your password has been updated.");
      setPasswordData({ current: '', new: '' });
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateUserProfile(user.uid, tempProfileData);
      setProfileData(tempProfileData);
      setIsEditModalVisible(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch {
      Alert.alert("Error", "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* --- Profile Preview --- */}
        <View style={styles.profileHero}>
           <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                {profileData.photoURL ? (
                  <Image source={{ uri: profileData.photoURL }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>
                    {profileData.fullName ? profileData.fullName.charAt(0).toUpperCase() : 'D'}
                  </Text>
                )}
              </View>
              <View style={styles.onlineBadge} />
           </View>
           <Text style={styles.heroName}>{profileData.fullName || 'MediCare Doctor'}</Text>
           <Text style={styles.heroEmail}>{profileData.email}</Text>
           <Text style={styles.heroSub}>{profileData.specialization || 'Professional Specialist'}</Text>
           
           <TouchableOpacity 
              style={styles.editProfileBtn}
              onPress={() => {
                setTempProfileData(profileData);
                setIsEditModalVisible(true);
              }}
            >
             <Feather name="edit-3" size={14} color={COLORS.primary} />
             <Text style={styles.editProfileText}>Edit Profile</Text>
           </TouchableOpacity>
        </View>

        {/* --- Settings Groups --- */}
        
        <View style={styles.card}>
          <SectionHeader title="Professional Profile" icon="briefcase" />
          <SettingItem 
            label="Specialization" 
            value={profileData.specialization || 'Not set'} 
            onPress={() => { setTempProfileData(profileData); setIsEditModalVisible(true); }} 
          />
          <SettingItem 
            label="Qualifications" 
            value={profileData.qualifications || 'Not set'} 
            onPress={() => { setTempProfileData(profileData); setIsEditModalVisible(true); }} 
            isLast
          />
        </View>

        <View style={styles.card}>
          <SectionHeader title="Account Settings" icon="user" />
          <SettingItem 
            label="Phone Number" 
            value={profileData.phone || 'Add phone'} 
            onPress={() => router.push('/(doctor)/profile')} 
            isLast
          />
        </View>

        <View style={styles.card}>
          <SectionHeader title="Notifications" icon="bell" />
          <SettingItem 
            label="Push Notifications" 
            isSwitch 
            switchValue={notificationPrefs.push} 
            onSwitchToggle={() => toggleNotification('push')} 
          />
          <SettingItem 
            label="New Appointments" 
            isSwitch 
            switchValue={notificationPrefs.newAppointment} 
            onSwitchToggle={() => toggleNotification('newAppointment')} 
            isLast
          />
        </View>

        <View style={styles.card}>
          <SectionHeader title="Security" icon="shield" />
          
          <View style={styles.passChangeBox}>
            <Text style={styles.passLabel}>Change Password</Text>
            
            <View style={styles.inputWrapper}>
              <View style={styles.inputIcon}>
                <Feather name="lock" size={18} color={COLORS.textSec} />
              </View>
              <TextInput 
                style={styles.enhancedInput}
                placeholder="Current Password"
                secureTextEntry={!showPassword}
                value={passwordData.current}
                onChangeText={t => setPasswordData(p => ({...p, current: t}))}
              />
            </View>

            <View style={styles.inputWrapper}>
              <View style={styles.inputIcon}>
                <Feather name="key" size={18} color={COLORS.textSec} />
              </View>
              <TextInput 
                style={styles.enhancedInput}
                placeholder="New Password"
                secureTextEntry={!showPassword}
                value={passwordData.new}
                onChangeText={t => setPasswordData(p => ({...p, new: t}))}
              />
              <TouchableOpacity 
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={COLORS.textSec} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.premiumPassBtn, (!passwordData.current || !passwordData.new) && { opacity: 0.6 }]}
              onPress={handleUpdatePassword}
              disabled={loading || !passwordData.current || !passwordData.new}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="refresh-cw" size={16} color="#fff" style={{marginRight: 8}} />
                  <Text style={styles.passBtnText}>Update Password</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <SectionHeader title="App Info & Privacy" icon="info" />
          <SettingItem 
            label="Privacy Policy" 
            onPress={() => router.push('/(modals)/terms')} 
            isLast
          />
        </View>

        {/* --- Action Center --- */}
        <View style={styles.actionCenter}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Feather name="log-out" size={18} color={COLORS.primary} />
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
             <Text style={styles.deleteBtnText}>Permanent Account Deletion</Text>
          </TouchableOpacity>
          
          <Text style={styles.versionText}>Medicare v2.5.0 (Doctor build)</Text>
        </View>

      </ScrollView>

      {/* --- Delete Account Modal --- */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setDeleteModalVisible(false);
          setDeletePassword('');
        }}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>Confirm Account Deletion</Text>
            {deleteNeedsPassword ? (
              <>
                <Text style={styles.deleteModalText}>
                  For security, enter your password to permanently delete your account.
                </Text>
                <TextInput
                  style={styles.deletePasswordInput}
                  placeholder="Password"
                  placeholderTextColor={COLORS.textSec}
                  secureTextEntry
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            ) : (
              <Text style={styles.deleteModalText}>
                For security, you may be asked to confirm your sign-in provider before deletion.
              </Text>
            )}

            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalCancelBtn]}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setDeletePassword('');
                }}
                disabled={loading}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalDeleteBtn, loading && { opacity: 0.7 }]}
                onPress={async () => {
                  if (deleteNeedsPassword && !deletePassword) return;
                  setDeleteModalVisible(false);
                  const pwd = deleteNeedsPassword ? deletePassword : undefined;
                  setDeletePassword('');
                  await performDelete(pwd);
                }}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteModalDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- Edit Profile Modal --- */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity 
                style={styles.closeBtn}
                onPress={() => setIsEditModalVisible(false)}
              >
                <Feather name="x" size={24} color={COLORS.textMain} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>Full Name</Text>
                <TextInput
                  style={styles.editInput}
                  value={tempProfileData.fullName}
                  onChangeText={t => setTempProfileData(p => ({...p, fullName: t}))}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Specialization</Text>
                <TextInput
                  style={styles.editInput}
                  value={tempProfileData.specialization}
                  onChangeText={t => setTempProfileData(p => ({...p, specialization: t}))}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Qualifications</Text>
                <TextInput
                  style={[styles.editInput, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                  multiline
                  value={tempProfileData.qualifications}
                  onChangeText={t => setTempProfileData(p => ({...p, qualifications: t}))}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Phone Number</Text>
                <TextInput
                  style={styles.editInput}
                  keyboardType="phone-pad"
                  value={tempProfileData.phone}
                  onChangeText={t => setTempProfileData(p => ({...p, phone: t}))}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Professional Bio</Text>
                <TextInput
                  style={[styles.editInput, { height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
                  multiline
                  value={tempProfileData.bio}
                  onChangeText={t => setTempProfileData(p => ({...p, bio: t}))}
                />
              </View>

              <TouchableOpacity 
                style={[styles.saveBtn, loading && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  scrollContent: { padding: 20, paddingBottom: 60 },
  
  // Profile Hero
  profileHero: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 10,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    ...SHADOW,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.success,
    borderWidth: 3,
    borderColor: '#fff',
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  heroEmail: {
    fontSize: 14,
    color: COLORS.textSec,
    marginTop: 4,
  },
  heroSub: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  editProfileText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 6,
  },

  // Cards
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...SHADOW,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textMain,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.input,
  },
  noBorder: { borderBottomWidth: 0 },
  settingItemLeft: { flexDirection: 'row', alignItems: 'center' },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMain,
  },
  settingItemRight: { flexDirection: 'row', alignItems: 'center' },
  settingValue: {
    fontSize: 14,
    color: COLORS.textSec,
    marginRight: 8,
  },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },

  // Pass Box / Security UI Upgrades
  passChangeBox: {
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },
  passLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  inputIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  enhancedInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 14,
    color: COLORS.textMain,
  },
  eyeBtn: {
    paddingHorizontal: 16,
    height: 48,
    justifyContent: 'center',
  },
  premiumPassBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...SHADOW,
    shadowColor: COLORS.primary,
  },
  passBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Delete modal
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW,
  },
  deleteModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textMain,
    textAlign: 'center',
    marginBottom: 8,
  },
  deleteModalText: {
    fontSize: 13,
    color: COLORS.textSec,
    textAlign: 'center',
    marginBottom: 12,
  },
  deletePasswordInput: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textMain,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  deleteModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  deleteModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalCancelBtn: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 10,
  },
  deleteModalDeleteBtn: {
    backgroundColor: COLORS.danger,
  },
  deleteModalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  deleteModalDeleteText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },

  // Edit Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '90%',
    ...SHADOW,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editField: {
    marginBottom: 20,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSec,
    marginBottom: 8,
    marginLeft: 4,
  },
  editInput: {
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textMain,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
    ...SHADOW,
    shadowColor: COLORS.primary,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  // Actions
  actionCenter: {
    alignItems: 'center',
    marginTop: 10,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...SHADOW,
    marginBottom: 24,
  },
  logoutBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    marginLeft: 10,
  },
  deleteBtn: {
    padding: 10,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.danger,
    textDecorationLine: 'underline',
  },
  versionText: {
    fontSize: 12,
    color: COLORS.textSec,
    marginTop: 20,
    opacity: 0.6,
  },
});

export default DoctorSettingsScreen;
