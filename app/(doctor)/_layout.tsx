import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Drawer } from "expo-router/drawer";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { Feather } from "@expo/vector-icons";
import { subscribeToAppointments } from "../../services/appointments";
import { sendAppointmentNotification, scheduleAppointmentReminders } from "../../services/notifications";
import { doc, getDoc, db } from "../../utils/firebaseConfig";

// --- 🎨 Unified Premium Theme ---
const COLORS = {
  bg: "#F8FAFC",        // Slate 50
  surface: "#FFFFFF",
  primary: "#4F46E5",   // Indigo 600
  primarySoft: "#EEF2FF",
  textMain: "#1E293B",  // Slate 800
  textSec: "#64748B",   // Slate 500
  border: "#E2E8F0",
  danger: "#EF4444",
};

const MENU_ITEMS = [
  { label: "Dashboard", route: "/(doctor)/", icon: "grid" },
  { label: "Appointments", route: "/(doctor)/appointments", icon: "clipboard" },
  { label: "Referrals", route: "/(doctor)/referrals", icon: "dollar-sign" },
  { label: "Schedule", route: "/(doctor)/schedule", icon: "calendar" },
  { label: "My Patients", route: "/(doctor)/patients", icon: "file-text" },
  { label: "Reports", route: "/(doctor)/reports", icon: "folder" },
  { label: "Profile", route: "/(doctor)/profile", icon: "user" },
  { label: "Settings", route: "/(doctor)/settings", icon: "settings" },
];

function CustomDrawerContent(props: any) {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut, user } = useAuth();

  const handleNavigation = (route: string) => {
    props.navigation.closeDrawer();
    router.push(route as any);
  };

  const handleLogout = async () => {
    props.navigation.closeDrawer();
    try { await signOut(); } catch { }
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.drawerContainer}>
      {/* --- Drawer Header: Profile Summary --- */}
      <View style={styles.drawerHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{(user?.fullName || user?.name || "D").charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docName} numberOfLines={2}>
            Dr. {user?.fullName || user?.name || "Doctor"}
          </Text>
          <Text style={styles.docSpecialty} numberOfLines={1}>
            {user?.specialties?.[0] || "General Practitioner"}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* --- Navigation Menu --- */}
      <ScrollView style={styles.drawerMenu} contentContainerStyle={{ paddingTop: 10 }}>
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.route;
          return (
            <TouchableOpacity
              key={item.label}
              style={[styles.drawerItem, isActive && styles.drawerItemActive]}
              onPress={() => handleNavigation(item.route)}
              activeOpacity={0.7}
            >
              <Feather
                name={item.icon as any}
                size={20}
                color={isActive ? COLORS.primary : COLORS.textSec}
              />
              <Text style={[styles.drawerLabel, isActive && styles.drawerLabelActive]}>
                {item.label}
              </Text>
              {isActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* --- Drawer Footer: Logout --- */}
      <View style={styles.drawerFooter}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Feather name="log-out" size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

export default function DoctorLayout() {
  const { session } = useAuth();
  const knownAppointmentIds = useRef<Set<string>>(new Set());
  const scheduledAppointmentIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | undefined;

    const setupSubscription = async () => {
      if (!session?.uid) return;

      // Get doctor ID/code (sometimes stored in profile)
      let doctorId = session.uid;
      try {
        const userRef = doc(db, 'users', session.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.doctorCode) doctorId = data.doctorCode;
        }
      } catch (e) {
        console.log("Error fetching doctor profile for ID", e);
      }

      if (!mounted) return;

      unsub = subscribeToAppointments(
        doctorId,
        'doctor',
        (appointments) => {
          if (!mounted) return;

          const currentIds = new Set<string>();
          appointments.forEach(a => { if (a.id) currentIds.add(a.id); });

          // 1. Schedule reminders for all future appointments (only once per session)
          appointments.forEach(appt => {
            if (appt.id && appt.startAt && appt.status !== 'cancelled' && appt.status !== 'completed') {
              // Skip if already scheduled in this session
              if (scheduledAppointmentIds.current.has(appt.id)) return;

              let start: Date;
              const sa = appt.startAt as any;
              if (sa.toDate) {
                start = sa.toDate();
              } else {
                start = new Date(sa);
              }

              if (!isNaN(start.getTime()) && start > new Date()) {
                console.log(`[DoctorLayout] Scheduling reminders for ${appt.id} at ${start.toISOString()}`);
                scheduleAppointmentReminders(appt.id, start);
                scheduledAppointmentIds.current.add(appt.id);
              }
            }
          });

          // 2. Check for new assignments (only after first load)
          if (!isFirstLoad.current) {
            appointments.forEach(appt => {
              if (appt.id && !knownAppointmentIds.current.has(appt.id)) {
                // This is a new appointment!
                // Notify the doctor
                let dateStr = '';
                const sa = appt.startAt as any;
                if (sa) {
                  const d = sa.toDate ? sa.toDate() : new Date(sa);
                  if (!isNaN(d.getTime())) dateStr = ` on ${d.toLocaleDateString()} at ${d.toLocaleTimeString()}`;
                }

                sendAppointmentNotification(
                  "New Patient Assigned",
                  `You have been assigned a new appointment${dateStr}.`,
                  appt.id
                );
              }
            });
          }

          // Update known IDs
          knownAppointmentIds.current = currentIds;
          isFirstLoad.current = false;
        },
        (err) => console.log("Doctor appointment sub error", err)
      );
    };

    setupSubscription();

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, [session?.uid]);

  return (
    <>
      <StatusBar style="dark" />
      <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          drawerStyle: { width: "75%", backgroundColor: COLORS.surface },
          drawerType: "front",
          headerShown: true,
          headerStyle: {
            backgroundColor: COLORS.surface,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border
          },
          headerTintColor: COLORS.textMain,
          headerTitleStyle: { fontWeight: "700", fontSize: 18 },

        }}
      >
        <Drawer.Screen name="index" options={{ title: "Dashboard" }} />
        <Drawer.Screen name="profile" options={{ title: "Doctor Profile" }} />
        <Drawer.Screen name="schedule" options={{ title: "My Schedule" }} />

        <Drawer.Screen name="referrals" options={{ title: "Referrals" }} />

        <Drawer.Screen name="patients" options={{ title: "Patient List" }} />
        <Drawer.Screen name="reports" options={{ title: "Patient Reports" }} />
        <Drawer.Screen name="availability" options={{ title: "Availability Settings" }} />
        <Drawer.Screen name="settings" options={{ title: "Settings" }} />
        <Drawer.Screen name="appointments" options={{ title: "Appointments" }} />
      </Drawer>
    </>
  );
}

const styles = StyleSheet.create({
  drawerContainer: { flex: 1, backgroundColor: COLORS.surface },

  // Header
  drawerHeader: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
  },
  docName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  docSpecialty: {
    fontSize: 13,
    color: COLORS.textSec,
    marginTop: 2,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 24,
    marginBottom: 8,
  },

  // Menu
  drawerMenu: { flex: 1 },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  drawerItemActive: {
    backgroundColor: COLORS.primarySoft,
  },
  drawerLabel: {
    marginLeft: 16,
    color: COLORS.textSec,
    fontSize: 15,
    fontWeight: "500",
  },
  drawerLabelActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  activeIndicator: {
    marginLeft: 'auto',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },

  // Footer
  drawerFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutText: {
    marginLeft: 16,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.danger,
  },
  versionText: {
    marginTop: 16,
    fontSize: 12,
    color: COLORS.textSec,
    opacity: 0.6,
  },

  // Notification Dot in Header
  notificationDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
});