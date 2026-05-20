import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'expo-router';
import { db, doc, getDoc } from '../../utils/firebaseConfig';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { subscribeToAppointments } from '../../services/appointments';

// --- Premium Palette ---
const COLORS = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  primary: "#4F46E5",
  primarySoft: "#EEF2FF",
  textMain: "#1E293B",
  textSec: "#64748B",
  border: "#E2E8F0",
  danger: "#EF4444",
  success: "#10B981",
};

const MenuOption = ({ icon, title, subtitle, onPress, color = COLORS.primary, isLast = false }: any) => (
  <TouchableOpacity 
    style={[styles.menuItem, isLast && styles.noBorder]} 
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
      <Feather name={icon} size={20} color={color} />
    </View>
    <View style={styles.menuText}>
      <Text style={styles.menuTitle}>{title}</Text>
      <Text style={styles.menuSubtitle}>{subtitle}</Text>
    </View>
    <Feather name="chevron-right" size={20} color={COLORS.border} />
  </TouchableOpacity>
);

const DoctorSettingsScreen = () => {
  const { session, user, signOut } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ completed: 0, upcoming: 0 });

  useEffect(() => {
    if (!session?.uid) return;
    const unsub = subscribeToAppointments(session.uid, 'doctor', (appts) => {
      const upcoming = appts.filter(a => a.status !== 'cancelled' && a.status !== 'completed').length;
      const completed = appts.filter(a => a.status === 'completed').length;
      setStats({ completed, upcoming });
    });
    return () => unsub();
  }, [session?.uid]);

  const handleExportData = async () => {
    if (!user || !session) return;

    try {
      Alert.alert(
        "Practice Data Export",
        "Generate a professional summary of your practice, including profile details and appointment statistics. Proceed?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Generate Report", 
            onPress: async () => {
              try {
                // Prepare HTML Web Report
                const htmlContent = `
                  <html>
                    <head>
                      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                      <style>
                        body { font-family: sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
                        .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
                        .brand { font-size: 24px; font-weight: 800; color: #4f46e5; }
                        .section { margin-bottom: 25px; }
                        .section-title { font-size: 18px; font-weight: 700; color: #4f46e5; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 15px; }
                        .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 10px; }
                        .stat-box { background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
                        .stat-val { font-size: 24px; font-weight: 800; color: #4f46e5; }
                        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #94a3b8; }
                      </style>
                    </head>
                    <body>
                      <div class="header">
                        <div class="brand">RAAJ MEDHUB PROFESSIONAL</div>
                        <div style="color: #64748b; margin-top: 5px;">Practice Activity Report</div>
                        <div style="font-size: 12px; margin-top: 10px;">Exported: ${new Date().toLocaleString()}</div>
                      </div>

                      <div class="section">
                        <div class="section-title">Professional Profile</div>
                        <div><strong>Name:</strong> Dr. ${user.fullName || 'N/A'}</div>
                        <div><strong>Specialization:</strong> ${user.specialization || user.specialty || 'N/A'}</div>
                        <div><strong>Professional Email:</strong> ${session.email}</div>
                        <div><strong>Member Since:</strong> ${user.createdAt ? new Date(user.createdAt.toDate?.() || user.createdAt).toLocaleDateString() : 'N/A'}</div>
                      </div>

                      <div class="section">
                        <div class="section-title">Practice Statistics</div>
                        <div class="stat-grid">
                          <div class="stat-box">
                            <div class="stat-val">${stats.completed}</div>
                            <div style="font-size: 12px; color: #64748b;">Completed Consultations</div>
                          </div>
                          <div class="stat-box">
                            <div class="stat-val">${stats.upcoming}</div>
                            <div style="font-size: 12px; color: #64748b;">Pending/Upcoming</div>
                          </div>
                        </div>
                      </div>

                      <div class="section">
                        <div class="section-title">Qualifications</div>
                        <p>${user.qualifications || 'No qualifications listed.'}</p>
                      </div>

                      <div class="footer">
                        This document is a professional summary of activity on the Raaj Medhub platform.
                      </div>
                    </body>
                  </html>
                `;

                const fileName = `Practice_Report_${session.uid.slice(0,5)}.html`;
                const fileUri = (FileSystem as any).cacheDirectory + fileName;
                await FileSystem.writeAsStringAsync(fileUri, htmlContent, {
                  encoding: (FileSystem as any).EncodingType?.UTF8 || 'utf8',
                });

                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(fileUri, {
                    mimeType: 'text/html',
                    dialogTitle: 'Export Practice Data',
                  });
                } else {
                  Alert.alert("Not Supported", "Sharing files isn't available on this device.");
                }
              } catch (err) {
                console.error("Export error:", err);
                Alert.alert("Export Failed", "We couldn't generate your report. Please try again.");
              }
            }
          }
        ]
      );
    } catch (err) {
      console.error("Export handler error:", err);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out of your professional account?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Sign Out", 
        style: "destructive", 
        onPress: async () => {
          try {
            await signOut();
            router.replace('/login');
          } catch(err){
            console.error("Logout error", err);
          }
        }
      },
    ]);
  };

  const displayName = user?.fullName || (session as any)?.displayName || 'Doctor';
  const displayEmail = session?.email || '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* --- Profile Overview --- */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {user?.photoURL || (session as any)?.photoURL ? (
              <Image source={{ uri: user?.photoURL || (session as any)?.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.badge}>
              <Feather name="shield" size={10} color="#fff" />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>Dr. {displayName}</Text>
            <Text style={styles.userEmail}>{displayEmail}</Text>
            <View style={styles.specTag}>
              <Text style={styles.specTagText}>{user?.specialization || user?.specialty || 'General Practitioner'}</Text>
            </View>
          </View>
        </View>

        {/* --- Main Menu --- */}
        <Text style={styles.sectionTitle}>General Settings</Text>
        <View style={styles.card}>
          <MenuOption 
            icon="user" 
            title="Professional Profile" 
            subtitle="Clinical credentials and bio"
            onPress={() => router.push('/(doctor)/profile')}
          />
          <MenuOption 
            icon="shield" 
            title="Security & Password" 
            subtitle="Secure your professional account"
            onPress={() => router.push('/(doctor)/security')}
          />
          <MenuOption 
            icon="bell" 
            title="Alert Settings" 
            subtitle="Assignments and emergency alerts"
            onPress={() => router.push('/(doctor)/notifications')}
          />
          <MenuOption 
            icon="help-circle" 
            title="Help & FAQs" 
            subtitle="App guide for practitioners"
            onPress={() => router.push('/(doctor)/faqs')}
            isLast
          />
        </View>

        <Text style={styles.sectionTitle}>Practice Management</Text>
        <View style={styles.card}>
          <MenuOption 
            icon="file-text" 
            title="Practice Data Export" 
            subtitle="Generate professional activity report"
            onPress={handleExportData}
          />
          <MenuOption 
            icon="trash-2" 
            title="Delete Account" 
            subtitle="Remove professional profile"
            color={COLORS.danger}
            onPress={() => router.push('/(doctor)/delete-account')}
            isLast
          />
        </View>

        {/* --- Actions --- */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <View style={styles.logoutIcon}>
            <Feather name="log-out" size={20} color={COLORS.primary} />
          </View>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Raaj Medhub v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  
  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarContainer: { position: 'relative' },
  avatar: { width: 70, height: 70, borderRadius: 35 },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: { marginLeft: 16, flex: 1 },
  userName: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  userEmail: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },
  specTag: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  specTagText: { color: COLORS.primary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  // Sections
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textSec,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 8,
    marginBottom: 24,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bg,
  },
  noBorder: { borderBottomWidth: 0 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuText: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textMain },
  menuSubtitle: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },

  // Sign Out
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  logoutIcon: { marginRight: 12 },
  logoutText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },

  versionText: {
    fontSize: 12,
    color: COLORS.textSec,
    textAlign: 'center',
    marginTop: 30,
    opacity: 0.6,
  },
});

export default DoctorSettingsScreen;
