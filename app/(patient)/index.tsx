import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  ScrollView,
  Dimensions,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { Feather, MaterialIcons, Ionicons } from "@expo/vector-icons";
import { subscribeToAppointments } from "../../services/appointments";
import type { Appointment } from "../../types/appointment";
import { getDoctor } from "../../services/doctors";
import moment from "moment";

// --- Theme Constants ---
const COLORS = {
  bg: "#F8FAFC", // Slate-50
  card: "#FFFFFF",
  primary: "#4F46E5", // Indigo-600
  primaryDark: "#312E81", // Indigo-900
  textMain: "#1E293B", // Slate-800
  textSec: "#64748B", // Slate-500
  accent: "#EEF2FF", // Indigo-50
  success: "#10B981",
  warning: "#F59E0B",
  border: "#E2E8F0",
};

const SPACING = 20;
const { width } = Dimensions.get("window");



export default function PatientDashboard(): React.ReactElement {
  const router = useRouter();
  const { session, user } = useAuth();

  // State
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [stats, setStats] = useState({
    appointmentsThisMonth: 0,
    prescriptions: 0,
    labResults: 0,
  });

  const [doctors, setDoctors] = useState<any>({});

  // --- Data Loading Logic (Kept Original) ---
  useEffect(() => {
    if (!session?.uid) return;

    const unsubAppointments = subscribeToAppointments(session.uid, 'patient', async (appts: Appointment[]) => {
      const now = new Date();
      const startOfMonth = moment().startOf('month').toDate();

      const upcomingAppts = appts
        .filter(a => a.startAt && (typeof a.startAt === 'string' ? new Date(a.startAt) : a.startAt.toDate()) > now)
        .sort((a, b) => (a.startAt > b.startAt ? 1 : -1));

      const doctorIds = [...new Set(upcomingAppts.map(a => a.doctorId).filter(id => id && !doctors[id]))];
      if (doctorIds.length > 0) {
        const fetchedDoctors = await Promise.all(doctorIds.map(id => getDoctor(id!)));
        const newDoctors: any = {};
        fetchedDoctors.forEach(doc => {
          if (doc) newDoctors[doc.id] = doc;
        });
        setDoctors((prev: any) => ({ ...prev, ...newDoctors }));
      }

      const upcomingMapped = upcomingAppts.slice(0, 5).map((a: any) => ({
        id: a.id,
        date: a.startAt ? (typeof a.startAt === 'string' ? a.startAt : a.startAt.toDate().toISOString()) : "",
        time: a.startAt
          ? (typeof a.startAt === 'string' ? new Date(a.startAt) : a.startAt.toDate()).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        doctorId: a.doctorId,
        doctor: doctors[a.doctorId]?.fullName || a.doctorName || "Dr. to be assigned",
        location: doctors[a.doctorId]?.specialization || a.location || "RAAJ MEDHUB Clinic",
        phone: doctors[a.doctorId]?.contact,
      }));
      setUpcoming(upcomingMapped);

      const appointmentsThisMonth = appts.filter(a => {
        const apptDate = a.startAt && (typeof a.startAt === 'string' ? new Date(a.startAt) : a.startAt.toDate());
        return apptDate && apptDate >= startOfMonth;
      }).length;

      setStats(prev => ({ ...prev, appointmentsThisMonth, prescriptions: 0, labResults: 0 }));


    });

    return () => {
      unsubAppointments();
    };
  }, [session?.uid, doctors]);

  // --- Helper for Date Formatting ---
  const getDayDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return {
        day: d.getDate(),
        month: d.toLocaleString("default", { month: "short" }),
        full: d.toLocaleDateString(),
      };
    } catch {
      return { day: "--", month: "---", full: "" };
    }
  };

  // --- Render Components ---

  const renderHeader = () => (
    <View style={styles.header}>
      <View>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.username}>
          {user?.fullName ? user.fullName.split(" ")[0] : "Patient"}
        </Text>
      </View>

      <View style={styles.headerRight}>
        
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => router.push("/(patient)/profile")}
        >
          <Text style={styles.profileInitial}>
            {user?.fullName ? user.fullName.charAt(0) : "P"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Featured "Hero" Appointment Card
  const renderHeroAppointment = () => {
    if (upcoming.length === 0) return null;
    const item = upcoming[0];
    const { day, month } = getDayDate(item.date);

    const handleCall = () => {
      if (item.phone) {
        Linking.openURL(`tel:${item.phone}`);
      }
    };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Next Appointment</Text>
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.heroCard}
          onPress={() => router.push("/(patient)/appointments?tab=upcoming")}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroDateBox}>
              <Text style={styles.heroDay}>{day}</Text>
              <Text style={styles.heroMonth}>{month}</Text>
            </View>
            <TouchableOpacity 
              style={{ flex: 1, marginLeft: 12 }} 
              onPress={() => {
                if (item.doctorId) {
                  router.push({ pathname: "/(patient)/doctor-details", params: { id: item.doctorId } });
                }
              }}
            >
              <Text style={styles.heroDoctor}>{item.doctor}</Text>
              <Text style={styles.heroSpecialty}>{item.location}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroIconBox} onPress={handleCall}>
              <Feather name="phone" size={20} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.heroBottom}>
            <View style={styles.rowCenter}>
              <Feather name="clock" size={14} color="#CBD5E1" />
              <Text style={styles.heroMetaText}>{item.time}</Text>
            </View>
            <View style={[styles.rowCenter, { marginLeft: 16 }]}>
              <Feather name="map-pin" size={14} color="#CBD5E1" />
              <Text style={styles.heroMetaText}>{item.location}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderQuickActions = () => (
    <View style={styles.gridContainer}>
      {[
        {
          label: "Book New",
          icon: "calendar",
          color: COLORS.primary,
          route: "/(patient)/appointments",
        },
        {
          label: "My Doctors",
          icon: "users",
          color: COLORS.success,
          route: "/(patient)/doctors",
        },
        {
          label: "Profile",
          icon: "user",
          color: COLORS.primaryDark,
          route: "/(patient)/profile",
        },
      ].map((action, index) => (
        <TouchableOpacity
          key={index}
          style={styles.actionBtn}
          onPress={() => router.push(action.route as any)}
        >
          <View style={[styles.actionIcon, { backgroundColor: action.color + "15" }]}>
            <Feather name={action.icon as any} size={22} color={action.color} />
          </View>
          <Text style={styles.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );



  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      
      {renderHeader()}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        {renderHeroAppointment()}

        {/* Quick Stats / Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          {renderQuickActions()}
        </View>

        


      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingHorizontal: SPACING,
    paddingBottom: 40,
  },
  
  // --- Header ---
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING,
    paddingVertical: 15,
    backgroundColor: COLORS.bg,
  },
  greeting: {
    fontSize: 14,
    color: COLORS.textSec,
    fontWeight: "500",
  },
  username: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textMain,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "red",
    zIndex: 10,
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  profileInitial: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  // --- Sections ---
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textMain,
    marginBottom: 12,
  },
  seeAll: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
  },

  // --- Hero Card ---
  heroCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 24,
    padding: 20,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroDateBox: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  heroDay: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  heroMonth: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    textTransform: "uppercase",
  },
  heroDoctor: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  heroSpecialty: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 2,
  },
  heroIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 16,
  },
  heroBottom: {
    flexDirection: "row",
  },
  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroMetaText: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "500",
  },

  // --- Quick Actions Grid ---
  gridContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionBtn: {
    width: (width - SPACING * 2 - 27) / 3, // fit 3 in a row
    alignItems: "center",
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: COLORS.textMain,
    fontWeight: "600",
  },

  // --- Stats Row ---
  statsRow: {
    flexDirection: "row",
    marginTop: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  statNum: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.textMain,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSec,
    fontWeight: "500",
  },

  // --- Activity List ---
  cardContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
  },
  timelineContainer: {
    width: 30,
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    zIndex: 2,
  },
  timelineLine: {
    position: "absolute",
    top: "50%",
    bottom: -30, // Extend to next item
    width: 2,
    backgroundColor: "#F1F5F9",
    zIndex: 1,
  },
  activityContent: {
    flex: 1,
    marginLeft: 8,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textMain,
  },
  activityTime: {
    fontSize: 12,
    color: COLORS.textSec,
    marginTop: 2,
  },
  emptyText: {
    textAlign: "center",
    color: COLORS.textSec,
    padding: 20,
    fontStyle: "italic",
  },
});