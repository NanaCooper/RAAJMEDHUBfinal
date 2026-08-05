import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  BackHandler,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from '../../hooks/useAuth';
import { PRESCRIPTION_LABEL, MED_RECORD_LABEL, MEDICATION_LABEL } from '../../constants/AppStrings';

export default function PrescriptionModal() {
  const router = useRouter();

  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [instructions, setInstructions] = useState("");
  const { session } = useAuth();
  const params = useLocalSearchParams() as any;
  const [doctorSignature, setDoctorSignature] = useState('');

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // If current user is a doctor, use their name
        if (session?.uid) {
          const { doc, getDoc, db } = await import('../../utils/firebaseConfig');
          const userRef = doc(db, 'users', session.uid);
          const snap = await getDoc(userRef);
          if (mounted && snap.exists()) {
            const data = snap.data() as any;
            if (data.role === 'doctor' && (data.fullName || data.name)) {
              setDoctorSignature(data.fullName || data.name);
              return;
            }
          }
        }
        // Otherwise, if doctorId param present, fetch that doctor's name
        if (params?.doctorId) {
          const { getDoctor } = await import('../../services/doctors');
          const d = await getDoctor(params.doctorId as string);
          if (mounted) setDoctorSignature(d?.fullName || d?.name || 'Doctor');
          return;
        }
        // fallback
        if (mounted) setDoctorSignature('Doctor');
      } catch (e) {
        console.error('Failed to resolve doctor signature', e);
        if (mounted) setDoctorSignature('Doctor');
      }
    })();
    return () => { mounted = false; };
  }, [session?.uid, params]);

  useEffect(() => {
    const onBackPress = () => {
      router.back();
      return true;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [router]);

  const handleSave = () => {
    const payload = { drugName, dosage, frequency, duration, instructions, doctorSignature };
    console.log("Save prescription (mock):", payload);
    Alert.alert("Saved", `${PRESCRIPTION_LABEL} saved to ${MED_RECORD_LABEL.toLowerCase()} (mock).`);
    router.back();
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => router.back()} />

      <View style={styles.card}>
        <ScrollView>
          <Text style={styles.title}>{PRESCRIPTION_LABEL}</Text>

          <Text style={styles.label}>{MEDICATION_LABEL}</Text>
          <TextInput value={drugName} onChangeText={setDrugName} style={styles.input} />

          <Text style={styles.label}>Dosage</Text>
          <TextInput value={dosage} onChangeText={setDosage} style={styles.input} />

          <Text style={styles.label}>Frequency</Text>
          <TextInput value={frequency} onChangeText={setFrequency} style={styles.input} />

          <Text style={styles.label}>Duration</Text>
          <TextInput value={duration} onChangeText={setDuration} style={styles.input} />

          <Text style={styles.label}>Instructions</Text>
          <TextInput
            value={instructions}
            onChangeText={setInstructions}
            style={[styles.input, { height: 100 }]}
            multiline
          />

          <View style={styles.signatureRow}>
            <Text style={styles.sigLabel}>{process.env.EXPO_PUBLIC_APP_MODE === 'android' ? 'Recommended by' : 'Prescribed by'}</Text>
            <Text style={styles.sigValue}>{doctorSignature}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSave}>
              <Text style={styles.primaryBtnText}>Save to Records</Text>
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
  title: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  label: { color: "#666", marginTop: 8 },
  input: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    paddingHorizontal: 10,
    backgroundColor: "#fafafa",
    marginTop: 6,
  },
  signatureRow: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#f2f2f2", paddingTop: 12 },
  sigLabel: { color: "#666", fontSize: 13 },
  sigValue: { fontWeight: "700", marginTop: 6 },
  actions: { marginTop: 16, alignItems: "flex-end" },
  primaryBtn: { backgroundColor: "#0b6efd", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
});