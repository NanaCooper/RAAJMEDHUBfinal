import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Drawer } from "expo-router/drawer";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeToAppointments } from "../../services/appointments";
import { sendAppointmentNotification } from "../../services/notifications";
import { getDoctor } from "../../services/doctors";

// --- Light Theme Colors ---
const DRAWER_BG = "#f7f9fc";
const TEXT_COLOR = "#1d2b3e";
const MUTED_COLOR = "#6a788e";
const ACTIVE_BG = "#eaf4ff";
const ACTIVE_TINT = "#0b6efd";
const BORDER_COLOR = "#e1e6f0";

const menuItems = [
  { label: "Dashboard", route: "/(patient)/", icon: "home" },
  { label: "Appointments", route: "/(patient)/appointments", icon: "calendar" },
  { label: "My Profile", route: "/(patient)/profile", icon: "user" },
  { label: "Our Branches", route: "/(patient)/branches", icon: "map-pin" },
  { label: "Settings", route: "/(patient)/settings", icon: "settings" },
  { label: "Logout", route: "/login", icon: "log-out" },
];

  function CustomDrawerContent(props: any) {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.drawerContainer}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerTitle}>MediCare Patient</Text>
      </View>

      {/* Search removed per UX request - kept drawer compact */}

      <ScrollView style={styles.drawerMenu}>
        {menuItems.map((item) => {
          const isActive = pathname === item.route;
          return (
            <TouchableOpacity
              key={item.label}
              style={[styles.drawerItem, isActive && styles.drawerItemActive]}
              onPress={async () => {
                props.navigation.closeDrawer();
                if (item.route === '/login') {
                  try { await signOut(); } catch (e) {}
                  router.replace('/login');
                } else {
                  router.push(item.route as any);
                }
              }}
            >
              <Feather name={item.icon as any} size={20} color={isActive ? ACTIVE_TINT : MUTED_COLOR} />
              <Text style={[styles.drawerLabel, isActive && { color: ACTIVE_TINT }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function PatientLayout() {
  const { session } = useAuth();
  const notifiedAppointmentsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!session?.uid) return;

    // Load notified appointments from storage
    const loadNotified = async () => {
      try {
        const stored = await AsyncStorage.getItem('notified_assignments');
        if (stored) {
          notifiedAppointmentsRef.current = new Set(JSON.parse(stored));
        }
      } catch (e) { console.error("Failed to load notified appointments", e); }
    };
    loadNotified();

    const unsubscribe = subscribeToAppointments(session.uid, 'patient', async (appointments) => {
      let newNotified = false;
      
      for (const appt of appointments) {
        // Check if doctor is assigned and we haven't notified yet
        if (appt.doctorId && appt.id && !notifiedAppointmentsRef.current.has(appt.id) && appt.status !== 'cancelled') {
          
          let doctorName = 'A doctor';
          // Try to get doctor name from appointment or fetch it
          if ((appt as any).doctorName) {
             doctorName = (appt as any).doctorName;
          } else {
             const docProfile = await getDoctor(appt.doctorId);
             if (docProfile && (docProfile as any).fullName) {
                doctorName = (docProfile as any).fullName;
             } else if (docProfile && (docProfile as any).name) {
                doctorName = (docProfile as any).name;
             }
          }

          // Send notification
          await sendAppointmentNotification(
            "Doctor Assigned",
            `${doctorName} has been assigned to you on this day`,
            appt.id
          );

          // Mark as notified
          notifiedAppointmentsRef.current.add(appt.id);
          newNotified = true;
        }
      }

      if (newNotified) {
        await AsyncStorage.setItem('notified_assignments', JSON.stringify(Array.from(notifiedAppointmentsRef.current)));
      }
    });

    return () => unsubscribe();
  }, [session?.uid]);

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerStyle: { width: "80%", backgroundColor: DRAWER_BG },
        drawerType: "front",
        headerShown: true,
        headerStyle: { backgroundColor: "#fff", elevation: 0, shadowOpacity: 0 },
        headerTitleStyle: { fontWeight: "bold" },
        
      }}
    >
      <Drawer.Screen name="index" options={{ title: "Dashboard" }} />
      <Drawer.Screen name="appointments" options={{ title: "Appointments" }} />
      <Drawer.Screen name="profile" options={{ title: "My Profile" }} />
      <Drawer.Screen name="branches" options={{ title: "Our Branches" }} />
      <Drawer.Screen name="settings" options={{ title: "Settings" }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawerContainer: { flex: 1, backgroundColor: DRAWER_BG },
  drawerHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  drawerTitle: { color: TEXT_COLOR, fontSize: 22, fontWeight: "bold" },
  // searchSection removed
  drawerMenu: { marginTop: 10 },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    borderRadius: 10,
  },
  drawerItemActive: { backgroundColor: ACTIVE_BG },
  drawerLabel: { marginLeft: 20, color: TEXT_COLOR, fontSize: 16, fontWeight: "500" },
});
