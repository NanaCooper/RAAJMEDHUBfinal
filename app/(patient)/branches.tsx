import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from "@expo/vector-icons";

// --- Theme Constants ---
const COLORS = {
  bg: "#F8FAFC",        // Slate 50
  card: "#FFFFFF",
  primary: "#4F46E5",   // Indigo 600
  primarySoft: "#EEF2FF",
  textMain: "#1E293B",  // Slate 800
  textSec: "#64748B",   // Slate 500
  success: "#10B981",
  successSoft: "#ECFDF5",
  danger: "#F43F5E", // Rose 500
  dangerSoft: "#FFF1F2", // Rose 50
  border: "#E2E8F0",
};

const SHADOW = {
  shadowColor: "#64748B",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 4,
};

type Branch = {
  id: string;
  name: string;
  address: string;
  mapQuery: string;
  phone: string;
  hours: string;
};

const getBranchStatus = (hours: string) => {
  try {
    if (hours === "24/7") return { isOpen: true, text: "Open" };

    const now = new Date();
    const currentDay = now.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6
    const currentTime = now.getHours() * 100 + now.getMinutes(); // e.g., 13:45 becomes 1345

    const parts = hours.split(' ');
    if (parts.length < 2) return { isOpen: false, text: "Closed" };

    const daysPart = parts[0]; // "Mon-Sat"
    const timePart = parts[1]; // "08:00-17:30"

    // --- Day Check ---
    const dayMapping: { [key: string]: number } = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const [startDayStr, endDayStr] = daysPart.split('-');
    const startDay = dayMapping[startDayStr];
    const endDay = dayMapping[endDayStr];

    if (currentDay < startDay || currentDay > endDay) {
      return { isOpen: false, text: "Closed Now" };
    }

    // --- Time Check ---
    const [startTimeStr, endTimeStr] = timePart.split('-');
    const [startHour, startMinute] = startTimeStr.split(':').map(Number);
    const [endHour, endMinute] = endTimeStr.split(':').map(Number);

    const startTime = startHour * 100 + startMinute;
    const endTime = endHour * 100 + endMinute;

    if (currentTime >= startTime && currentTime < endTime) {
      return { isOpen: true, text: "Open Now" };
    }

    return { isOpen: false, text: "Closed Now" };
  } catch (e) {
    console.error("Error parsing branch hours:", e);
    return { isOpen: false, text: "Status Unavailable" };
  }
};


export default function Branches() {

  const branches: Branch[] = [
    { id: "b1", name: "RAAJ MedHub - Koforidua", address: "N991 Old Estate Rd, Koforidua", mapQuery: "https://maps.app.goo.gl/VduixvoNpLRxaoga7", phone: "0249419970", hours: "24/7" },
    { id: "b2", name: "RAAJ MedHub - Cape Coast", address: "Pedu, Cape Coast", mapQuery: "https://maps.app.goo.gl/qMxrxCP76Qrf7ZaL9", phone: "0257351887", hours: "24/7" },
    { id: "b3", name: "RAAJ MedHub - Takoradi", address: "Kojo Kum Avenue, Takoradi", mapQuery: "https://maps.app.goo.gl/vgiZ7qFn9kN3dB5h6", phone: "0257351887", hours: "24/7" },
  ];

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleMap = (mapQuery: string) => {
    let url: string | undefined;

    if (mapQuery.startsWith('http')) {
        // It's a direct URL
        url = mapQuery;
    } else {
        // It's an address, encode it for map search
        const encodedAddress = encodeURIComponent(mapQuery);
        url = Platform.select({
          ios: `maps:0,0?q=${encodedAddress}`,
          android: `geo:0,0?q=${encodedAddress}`,
          default: `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
        });
    }

    if (url) {
        Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    }
  };

  const renderBranch = ({ item }: { item: Branch }) => {
    const status = getBranchStatus(item.hours);

    return (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.9}
      onPress={() => handleMap(item.mapQuery)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconBox}>
          <MaterialIcons name="location-city" size={24} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.isOpen ? COLORS.successSoft : COLORS.dangerSoft }]}>
            <View style={[styles.statusDot, { backgroundColor: status.isOpen ? COLORS.success : COLORS.danger }]} />
            <Text style={[styles.statusText, { color: status.isOpen ? COLORS.success : COLORS.danger }]}>{status.text}</Text>
          </View>
        </View>
        <View style={styles.chevronBox}>
          <Feather name="chevron-right" size={20} color={COLORS.textSec} />
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.infoRow}>
        <Feather name="map-pin" size={16} color={COLORS.textSec} />
        <Text style={styles.address}>{item.address}</Text>
      </View>

      <View style={styles.infoRow}>
        <Feather name="clock" size={16} color={COLORS.textSec} />
        <Text style={styles.hours}>{item.hours}</Text>
      </View>

      <TouchableOpacity 
        style={styles.callButton} 
        activeOpacity={0.8}
        onPress={() => handleCall(item.phone)}
      >
        <Feather name="phone-call" size={16} color={COLORS.primary} />
        <Text style={styles.callButtonText}>Call Clinic</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )};

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      

      <FlatList
        data={branches}
        keyExtractor={(i) => i.id}
        renderItem={renderBranch}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.bg 
  },
  
  // Header
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.bg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.textMain,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: COLORS.textSec,
    marginTop: 4,
  },

  // List
  listContent: { 
    padding: 20,
    paddingTop: 10, 
  },

  // Card
  card: { 
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  name: { 
    fontSize: 16, 
    fontWeight: "700", 
    color: COLORS.textMain,
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: 'flex-start',
    backgroundColor: COLORS.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.success,
  },
  chevronBox: {
    marginLeft: 8,
  },

  // Content
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  address: { 
    fontSize: 14, 
    color: COLORS.textMain, 
    marginLeft: 10,
    flex: 1,
  },
  hours: { 
    fontSize: 14, 
    color: COLORS.textSec,
    marginLeft: 10,
  },

  // Actions
  callButton: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9", // Light gray background
    paddingVertical: 12,
    borderRadius: 12,
  },
  callButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
});