import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import DoctorDropdown from "../../components/DoctorDropdown";

type DayAvailability = {
  day: string;
  enabled: boolean;
  start: string;
  end: string;
};

const initialWeek: DayAvailability[] = [
  { day: "Mon", enabled: true, start: "09:00", end: "17:00" },
  { day: "Tue", enabled: true, start: "09:00", end: "17:00" },
  { day: "Wed", enabled: true, start: "09:00", end: "17:00" },
  { day: "Thu", enabled: true, start: "09:00", end: "17:00" },
  { day: "Fri", enabled: true, start: "09:00", end: "17:00" },
  { day: "Sat", enabled: false, start: "09:00", end: "12:00" },
  { day: "Sun", enabled: false, start: "00:00", end: "00:00" },
];

const COLORS = {
  primary: "#0A2463", 
  secondary: "#00A896", 
  accent: "#FF6B6B", 
  success: "#28A745", 
  warning: "#FFC107", 
  bg: "#F8F9FA", 
  surface: "#FFFFFF", 
  textMain: "#212529",
  textSec: "#6C757D",
  border: "#E9ECEF",
};

export default function AvailabilityManagement() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [week, setWeek] = useState<DayAvailability[]>(initialWeek);

  const menuItems = [
    { label: "Dashboard", route: "/doctor", icon: "🏠" },
    { label: "Schedule", route: "/doctor/schedule", icon: "🗓️" },
    { label: "Patient Queue", route: "/doctor/queue", icon: "👥" },
    { label: "Messages", route: "/doctor/messages", icon: "💬" },
    { label: "My Patients", route: "/doctor/my-patients", icon: "📋" },
    { label: "Availability", route: "/doctor/availability", icon: "⏰" },
    { label: "Profile", route: "/doctor/profile", icon: "👩‍⚕️" },
    { label: "Logout", route: "/login", icon: "🚪" },
  ];

  const toggleDay = (index: number) => {
    setWeek((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], enabled: !copy[index].enabled };
      return copy;
    });
  };

  const setTime = (index: number, field: "start" | "end", value: string) => {
    setWeek((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSave = () => {
    console.log("Saved availability:", week);
    Alert.alert("Saved", "Availability settings saved (mock).");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setMenuVisible((v) => !v)}
          style={styles.hamburger}
        >
          <Text style={styles.hamburgerIcon}>☰</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Availability</Text>

        <TouchableOpacity style={styles.profileBtn}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>D</Text>
          </View>
        </TouchableOpacity>
      </View>

      <DoctorDropdown
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={menuItems}
        offsetY={Platform.OS === "ios" ? 88 : 72}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Set your weekly availability. Toggle a day on and edit start / end
          times. 
        </Text>

        {week.map((d, i) => (
          <View key={d.day} style={styles.dayRow}>
            <View style={styles.dayLeft}>
              <Text style={styles.dayLabel}>{d.day}</Text>
              <Switch value={d.enabled} onValueChange={() => toggleDay(i)} />
            </View>

            <View style={styles.dayRight}>
              <TextInput
                style={[styles.timeInput, !d.enabled && styles.disabledInput]}
                value={d.start}
                onChangeText={(val) => setTime(i, "start", val)}
                editable={d.enabled}
              />
              <Text style={styles.toText}>to</Text>
              <TextInput
                style={[styles.timeInput, !d.enabled && styles.disabledInput]}
                value={d.end}
                onChangeText={(val) => setTime(i, "end", val)}
                editable={d.enabled}
              />
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Availability</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    height: 72,
    paddingTop: Platform.OS === "ios" ? 24 : 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  hamburger: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  hamburgerIcon: { fontSize: 22, color: COLORS.textMain },
  title: { fontSize: 18, fontWeight: "600", color: COLORS.textMain },
  profileBtn: { padding: 6 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700" },

  content: { padding: 16 },
  description: { color: COLORS.textSec, marginBottom: 20, textAlign: 'center', fontSize: 14 },

  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayLeft: { width: 120, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayLabel: { fontWeight: "700", fontSize: 16, color: COLORS.textMain },

  dayRight: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  timeInput: {
    width: 85,
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    backgroundColor: COLORS.bg,
    textAlign: "center",
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textMain,
  },
  disabledInput: {
    backgroundColor: '#f0f0f0',
    color: '#999',
    opacity: 0.7,
  },
  toText: { marginHorizontal: 10, color: COLORS.textSec, fontWeight: '500' },

  saveBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});