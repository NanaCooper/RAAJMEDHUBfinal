import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from "expo-router";

type Params = { id?: string };

export default function DoctorProfilePublic() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const id = params.id ?? "unknown";
  const [doctor, setDoctor] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { getDoctor } = await import('../../services/doctors');
        const d = await getDoctor(id);
        if (!mounted) return;
        setDoctor(d);
      } catch (e) {
        console.error('Failed to load doctor', e);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  const handleBook = () => {
    if (!doctor) return;
    router.push(`/booking/${doctor.id}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
  <Text style={styles.name}>{doctor?.fullName || doctor?.name || 'Doctor'}</Text>
  <Text style={styles.spec}>{doctor?.specialization || 'Specialization'} • {doctor?.rating ?? 4.5}★</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>About</Text>
  <Text style={styles.text}>{doctor?.bio || ''}</Text>

        <Text style={[styles.label, { marginTop: 12 }]}>Consultation Fee</Text>
  <Text style={styles.text}>{doctor?.fee || '-'}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.bookBtn} onPress={handleBook}>
            <Text style={styles.bookText}>Book Appointment</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.messageBtn} onPress={() => router.push(`/doctor-messages/${id}`)}>
            <Text style={styles.messageText}>Message</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  header: { marginBottom: 12 },
  name: { fontSize: 20, fontWeight: "700" },
  spec: { color: "#666", marginTop: 4 },

  card: { backgroundColor: "#fafafa", padding: 14, borderRadius: 10 },
  label: { color: "#666", fontSize: 13 },
  text: { marginTop: 6, color: "#333" },

  actions: { flexDirection: "row", marginTop: 18, justifyContent: "space-between" },
  bookBtn: { backgroundColor: "#0b6efd", padding: 12, borderRadius: 8 },
  bookText: { color: "#fff", fontWeight: "700" },
  messageBtn: { borderWidth: 1, borderColor: "#0b6efd", padding: 12, borderRadius: 8 },
  messageText: { color: "#0b6efd", fontWeight: "700" },
});