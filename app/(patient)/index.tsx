import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Dimensions,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { Feather } from "@expo/vector-icons";
import { subscribeToAppointments } from "../../services/appointments";
import type { Appointment } from "../../types/appointment";
import { getDoctor } from "../../services/doctors";
import dayjs from "dayjs";

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

  const doctorsRef = useRef<any>({});

  // --- Data Loading Logic (Kept Original) ---
  useEffect(() => {
    if (!session?.uid) return;

    const unsubAppointments = subscribeToAppointments(session.uid, 'patient', async (appts: Appointment[]) => {
      console.log(`[Dashboard] Received ${appts.length} appointments`);
      const startOfDay = dayjs().startOf('day').toDate();

      const getDate = (a: any) => {
        try {
          if (a.startAt) {
            if (a.startAt.toDate) return a.startAt.toDate();
            if (typeof a.startAt === 'string') {
              const m = dayjs(a.startAt);
              if (m.isValid()) return m.toDate();
            }
          }
          if (a.date) {
            const m = dayjs(a.date + (a.time ? ' ' + a.time : ''), 'YYYY-MM-DD HH:mm');
            if (m.isValid()) return m.toDate();
            // Fallback for date string only
            const mDate = dayjs(a.date, 'YYYY-MM-DD');
            if (mDate.isValid()) return mDate.toDate();
          }
        } catch {
          console.warn("Invalid date for appt", a.id);
        }
        return new Date(0); // Epoch for invalid
      };

      // Filter and Sort: Closest Future/Today first
      const upcomingAppts = appts
        .filter(a => {
          const d = getDate(a);
          // Include today's appointments
          return d >= startOfDay && a.status !== 'pending' && a.status !== 'requested';
        })
        .sort((a, b) => {
          const dateA = getDate(a).getTime();
          const dateB = getDate(b).getTime();
          return dateA - dateB; // Ascending: Earliest date first
        });

      console.log(`[Dashboard] Upcoming appointments count: ${upcomingAppts.length}`);

      // Helper to map appointments
      const mapUpcoming = (list: any[], docMap: any = {}) => {
        return list.slice(0, 5).map((a: any) => {
          let doctorName = docMap[a.doctorId]?.fullName || a.doctorName;
          if (doctorName === 'null' || doctorName === 'undefined') doctorName = "Assigned soon";

          // Date & Time Logic
          let date = "";
          let time = "";
          const d = getDate(a);

          if (!isNaN(d.getTime()) && d.getTime() !== 0) {
            date = d.toISOString();
            // Only format time if it exists
            if (a.time) time = dayjs(a.time, 'HH:mm').format('h:mm A');
            else if (dayjs(d).isValid()) time = dayjs(d).format('h:mm A');
          } else {
            date = a.date || "";
            if (a.time) time = a.time;
          }

          // STRICT TIME VISIBILITY: Only show time if approved/upcoming/confirmed
          const isApproved = a.status === 'upcoming' || a.status === 'confirmed' || a.status === 'approved';
          if (!isApproved) time = ""; // Hide time if not approved

          // Handle Scan Type
          let scanName = 'Scan';
          if (a.specificScan) {
            scanName = a.specificScan;
          } else if (a.scanType) {
            scanName = a.scanType.name || a.scanType;
            if (scanName === 'General') scanName = 'Scan';
          } else if (Array.isArray(a.scanTypes) && a.scanTypes.length > 0) {
            scanName = a.scanTypes.map((s: any) => s.name).filter(Boolean).join(', ');
          }

          return {
            id: a.id,
            date,
            time, // Will be empty string if not approved
            doctorId: a.doctorId,
            doctor: doctorName,
            status: a.status, // Pass status
            location: a.branch || a.location || "RAAJ MEDHUB Clinic",
            branch: a.branch || "",
            scanType: scanName,
            phone: docMap[a.doctorId]?.contact,
          };
        });
      };

      // 1. Immediate Render (Optimistic)
      setUpcoming(mapUpcoming(upcomingAppts, doctorsRef.current));

      // 2. Fetch missing doctors (skip already fetched or failed)
      const doctorIds = [...new Set(upcomingAppts.map(a => a.doctorId).filter(id => id && !(id in doctorsRef.current)))] as string[];
      if (doctorIds.length > 0) {
        // Mark as fetching to prevent duplicate fetches on future subscription updates
        doctorIds.forEach(id => { doctorsRef.current[id] = null; });

        const fetchedDoctors = await Promise.all(doctorIds.map(id => getDoctor(id!).catch(() => null)));
        fetchedDoctors.forEach(doc => {
          if (doc) doctorsRef.current[doc.id] = doc;
        });

        // 3. Final Render with fetched doctors
        setUpcoming(mapUpcoming(upcomingAppts, doctorsRef.current));
      }

    }, (err) => console.error(err), session.email);

    return () => {
      unsubAppointments();
    };
  }, [session?.uid, session?.email]);

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
          {user?.fullName ? user.fullName.split(" ")[0] : (user?.name ? user.name.split(" ")[0] : "Patient")}
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

    const isCapeCoast = (item.location || '').toLowerCase().includes('cape coast');

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
                if (item.doctorId && isCapeCoast) {
                  router.push({ pathname: "/(patient)/doctor-details", params: { id: item.doctorId } });
                }
              }}
              disabled={!isCapeCoast}
            >
              <Text style={styles.heroDoctor}>{item.scanType}</Text>
              <Text style={styles.heroSpecialty}>{item.location}</Text>

              {/* Conditional Doctor Display */}
              {isCapeCoast && item.doctor && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
                  <Feather name="user" size={12} color="rgba(255,255,255,0.7)" />
                  <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: '500' }}>
                    {item.doctor}
                  </Text>
                </View>
              )}

            </TouchableOpacity>
            {isCapeCoast && (
              <TouchableOpacity style={styles.heroIconBox} onPress={handleCall}>
                <Feather name="phone" size={20} color="white" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.heroBottom}>
            <View style={styles.rowCenter}>
              <Feather name="clock" size={14} color="#CBD5E1" />
              <Text style={styles.heroMetaText}>{item.time || 'TBD'}</Text>
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
          label: "Find Locations",
          icon: "map-pin",
          color: COLORS.success,
          route: "/(patient)/branches",
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


