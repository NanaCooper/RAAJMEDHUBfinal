import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Switch, 
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { updateUserProfile } from '../../services/users';
import { updateNotificationPreferences } from '../../services/notifications';

const COLORS = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  primary: "#4F46E5",
  textMain: "#1E293B",
  textSec: "#64748B",
  border: "#E2E8F0",
  success: "#10B981",
};

const NotificationItem = ({ label, description, icon, value, onToggle }: any) => (
  <View style={styles.item}>
    <View style={styles.itemLeft}>
      <View style={styles.iconBox}>
        <Feather name={icon} size={20} color={COLORS.primary} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
    <Switch 
      value={value} 
      onValueChange={onToggle}
      trackColor={{ false: COLORS.border, true: COLORS.primary }}
    />
  </View>
);

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState({
    push: true,
    appointmentReminders: true,
    newMessageAlerts: true,
  });

  useEffect(() => {
    if (user?.notificationPrefs) {
      setPrefs(prev => ({ ...prev, ...user.notificationPrefs }));
    }
  }, [user]);

  const togglePref = async (key: keyof typeof prefs) => {
    const newVal = !prefs[key];
    setPrefs(prev => ({ ...prev, [key]: newVal }));
    
    if (user) {
      try {
        if (key === 'push') {
          await updateNotificationPreferences({ enabled: newVal });
        }
        await updateUserProfile(user.uid, { 
          notificationPrefs: { ...prefs, [key]: newVal } 
        });
      } catch (err) {
        console.error("Failed to update notification prefs:", err);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(patient)/settings')}>
          <Feather name="arrow-left" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Alert Settings</Text>
        <View style={styles.card}>
          <NotificationItem 
            label="Push Notifications"
            description="Receive alerts on your device for important updates."
            icon="bell"
            value={prefs.push}
            onToggle={() => togglePref('push')}
          />
          <View style={styles.divider} />
          <NotificationItem 
            label="Appointment Reminders"
            description="Get notified about upcoming consultations."
            icon="calendar"
            value={prefs.appointmentReminders}
            onToggle={() => togglePref('appointmentReminders')}
          />
          <View style={styles.divider} />
          <NotificationItem 
            label="Messages"
            description="Alerts for new messages from your providers."
            icon="message-square"
            value={prefs.newMessageAlerts}
            onToggle={() => togglePref('newMessageAlerts')}
          />
        </View>
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textSec,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 10,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textContainer: { flex: 1 },
  label: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  description: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.bg, marginVertical: 4 },
});
