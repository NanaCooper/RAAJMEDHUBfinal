import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { APP_NAME, DOCTOR_LABEL_PLURAL } from "../../constants/AppStrings";

export default function BranchInfoModal() {
  const router = useRouter();
  const [doctors, setDoctors] = React.useState<string[]>([]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { listDoctors } = await import('../../services/doctors');
        const list = await listDoctors();
        if (!mounted) return;
        setDoctors(list.map((d: any) => d.fullName || d.name || 'Doctor'));
      } catch (e) {
        console.error('Failed to load doctors for branch', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const branch = {
    name: `${APP_NAME} Central`,
    address: "123 Main St, Springfield",
    phone: "+1 555-0101",
    hours: "Mon-Fri 08:00-17:00",
    services: ["General Consultation", "Lab Tests", "Pediatrics"],
    doctors,
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => router.back()} />

      <View style={styles.card}>
        <ScrollView>
          <Text style={styles.title}>{branch.name}</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Address</Text>
            <Text style={styles.value}>{branch.address}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{branch.phone}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Hours</Text>
            <Text style={styles.value}>{branch.hours}</Text>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.sectionTitle}>Services</Text>
            {branch.services.map((s) => (
              <Text key={s} style={styles.listItem}>
                • {s}
              </Text>
            ))}
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.sectionTitle}>{DOCTOR_LABEL_PLURAL}</Text>
            {branch.doctors.map((d) => (
              <Text key={d} style={styles.listItem}>
                • {d}
              </Text>
            ))}
          </View>

          <View style={{ marginTop: 14 }}>
            <Text style={styles.sectionTitle}>Map</Text>
            <View style={styles.mapPlaceholder}>
              <Text style={{ color: "#999" }}>[Map placeholder]</Text>
            </View>
          </View>

          <View style={{ marginTop: 16, alignItems: "flex-end" }}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
              <Text style={styles.primaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 40,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    zIndex: 1001,
    maxHeight: "80%",
  },
  title: { fontSize: 18, fontWeight: "700" },
  row: { marginTop: 8, flexDirection: "row", justifyContent: "space-between" },
  label: { color: "#666" },
  value: { fontWeight: "700" },

  sectionTitle: { fontWeight: "700", marginBottom: 8 },
  listItem: { color: "#444", marginTop: 6 },

  mapPlaceholder: {
    height: 140,
    borderRadius: 8,
    backgroundColor: "#fafafa",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#f1f1f1",
  },

  primaryBtn: { backgroundColor: "#0b6efd", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
});