import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'expo-router';
import { db, doc, getDoc } from '../../utils/firebaseConfig';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getPatientReports } from '../../services/reports';

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

const PatientSettingsScreen = () => {
  const { session, user, signOut } = useAuth();
  const router = useRouter();

  const handleExportData = async () => {
    if (!user || !session) return;

    try {
      Alert.alert(
        "Export My Data",
        "We will generate a file containing your profile and medical report history. You can then send this file via email or save it. Proceed?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Export & Share", 
            onPress: async () => {
              try {
                // 1. Fetch all reports for the user
                const reports = await getPatientReports(session.uid);
                
                // 2. Prepare the HTML for PDF
                const htmlContent = `
                  <html>
                    <head>
                      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                      <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
                        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; }
                        .brand { font-size: 28px; font-weight: 800; color: #4f46e5; margin-bottom: 5px; }
                        .doc-type { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; }
                        .section { margin-bottom: 30px; }
                        .section-title { font-size: 16px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; color: #4f46e5; }
                        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                        .info-item { margin-bottom: 10px; }
                        .label { font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 2px; }
                        .value { font-size: 15px; font-weight: 500; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th { text-align: left; background: #f8fafc; padding: 12px; font-size: 13px; border-bottom: 2px solid #e2e8f0; }
                        td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
                        .status { display: inline-block; padding: 4px 8px; borderRadius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
                        .status-ready { background: #dcfce7; color: #15803d; }
                        .status-processing { background: #fef9c3; color: #854d0e; }
                        .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
                      </style>
                    </head>
                    <body>
                      <div class="header">
                        <div class="brand">RAAJ MEDHUB</div>
                        <div class="doc-type">Medical Data Export</div>
                        <div style="font-size: 12px; color: #94a3b8; margin-top: 10px;">Generated: ${new Date().toLocaleString()}</div>
                      </div>

                      <div class="section">
                        <div class="section-title">Personal Information</div>
                        <div class="info-grid">
                          <div class="info-item">
                            <div class="label">Full Name</div>
                            <div class="value">${user.fullName || 'N/A'}</div>
                          </div>
                          <div class="info-item">
                            <div class="label">Email Address</div>
                            <div class="value">${session.email}</div>
                          </div>
                          <div class="info-item">
                            <div class="label">Phone Number</div>
                            <div class="value">${user.phone || 'N/A'}</div>
                          </div>
                          <div class="info-item">
                            <div class="label">Member Since</div>
                            <div class="value">${user.createdAt ? new Date(user.createdAt.toDate?.() || user.createdAt).toLocaleDateString() : 'N/A'}</div>
                          </div>
                        </div>
                        <div class="info-item" style="margin-top: 15px;">
                          <div class="label">Medical Preferences</div>
                          <div class="value">${user.preferences || 'None specified'}</div>
                        </div>
                      </div>

                      <div class="section">
                        <div class="section-title">Medical Report History</div>
                        ${reports.length > 0 ? `
                          <table>
                            <thead>
                              <tr>
                                <th>Report Title</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${reports.map(r => `
                                <tr>
                                  <td style="font-weight: 600;">${r.title}</td>
                                  <td>${r.category}</td>
                                  <td><span class="status status-${r.status}">${r.status}</span></td>
                                  <td>${r.createdAt ? new Date(r.createdAt.toDate?.() || r.createdAt).toLocaleDateString() : 'N/A'}</td>
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                        ` : '<p style="font-size: 14px; color: #64748b;">No medical reports found on file.</p>'}
                      </div>

                      <div class="footer">
                        This is an official data export generated by the Raaj Medhub mobile application.<br/>
                        For verification or inquiries, contact support at raajmedhub@gmail.com
                      </div>
                    </body>
                  </html>
                `;

                // 3. Save as HTML file
                const htmlName = `Raaj_Medhub_Report_${session.uid.slice(0,5)}.html`;
                const htmlUri = (FileSystem as any).cacheDirectory + htmlName;
                
                await FileSystem.writeAsStringAsync(htmlUri, htmlContent, {
                  encoding: (FileSystem as any).EncodingType?.UTF8 || 'utf8',
                });

                // 4. Share the HTML report
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(htmlUri, {
                    mimeType: 'text/html',
                    dialogTitle: 'Export My Medical Data',
                  });
                } else {
                  Alert.alert("Not Supported", "Sharing files isn't available on this device.");
                }
              } catch (err) {
                console.error("Export error:", err);
                Alert.alert("Export Failed", "We couldn't generate your data file. Please try again.");
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
    Alert.alert("Sign Out", "Are you sure you want to sign out of your account?", [
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

  const displayName = user?.fullName || (session as any)?.displayName || 'User';
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
              <Feather name="check" size={10} color="#fff" />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail}>{displayEmail}</Text>
          </View>
        </View>

        {/* --- Main Menu --- */}
        <Text style={styles.sectionTitle}>General Settings</Text>
        <View style={styles.card}>
          <MenuOption 
            icon="user" 
            title="Personal Information" 
            subtitle="Name, phone, and medical preferences"
            onPress={() => router.push('/(patient)/profile')}
          />
          <MenuOption 
            icon="shield" 
            title="Security & Password" 
            subtitle="Update your password and secure account"
            onPress={() => router.push('/(patient)/security')}
          />
          <MenuOption 
            icon="bell" 
            title="Notifications" 
            subtitle="Alerts, reminders, and health tips"
            onPress={() => router.push('/(patient)/notifications')}
          />
          <MenuOption 
            icon="help-circle" 
            title="Help & FAQs" 
            subtitle="Common questions and app guide"
            onPress={() => router.push('/(patient)/faqs')}
            isLast
          />
        </View>

        <Text style={styles.sectionTitle}>Privacy & Data</Text>
        <View style={styles.card}>
          <MenuOption 
            icon="file-text" 
            title="Data & Export" 
            subtitle="Export your records or manage privacy"
            onPress={handleExportData}
          />
          <MenuOption 
            icon="trash-2" 
            title="Delete Account" 
            subtitle="Permanently remove your data"
            color={COLORS.danger}
            onPress={() => router.push('/(patient)/delete-account')}
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
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
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
  },
  avatarContainer: { position: 'relative' },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: '#fff' },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.success,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: { marginLeft: 16 },
  userName: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  userEmail: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },

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

export default PatientSettingsScreen;


