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
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from "expo-router";
import { saveMedicalRecord, getMedicalRecordByAppointmentId } from '../../services/medical-records';
import { getAppointment } from '../../services/appointments';

export default function MedicalNotesModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ appointmentId: string }>();
  const appointmentId = params.appointmentId;

  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appointmentData, setAppointmentData] = useState<any>(null);

  useEffect(() => {
    const onBackPress = () => {
      router.back();
      return true;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (!appointmentId) {
      console.warn("No appointmentId provided to MedicalNotesModal");
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        // Fetch appointment details to get patientId and doctorId
        const apt = await getAppointment(appointmentId);
        if (!apt) {
          Alert.alert("Error", "Appointment not found.");
          router.back();
          return;
        }
        setAppointmentData(apt);

        // Fetch existing medical record
        const record = await getMedicalRecordByAppointmentId(appointmentId);
        if (record) {
          setDiagnosis(record.diagnosis || "");
          setTreatment(record.treatment || "");
          setFollowUp(record.followUp || "");
        }
      } catch (error) {
        console.error("Error loading medical notes:", error);
        Alert.alert("Error", "Failed to load medical notes.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [appointmentId, router]);

  const handleSave = async () => {
    if (!appointmentId) {
        Alert.alert("Error", "Missing appointment ID.");
        return;
    }
    if (!appointmentData) {
        Alert.alert("Error", "Missing appointment data.");
        return;
    }
    if (!diagnosis.trim() && !treatment.trim()) {
        Alert.alert("Validation", "Please enter at least a diagnosis or treatment plan.");
        return;
    }

    try {
      setSaving(true);
      await saveMedicalRecord({
        appointmentId: appointmentId,
        patientId: appointmentData.patientId,
        doctorId: appointmentData.doctorId || "", 
        diagnosis,
        treatment,
        followUp
      });
      Alert.alert("Success", "Medical notes saved successfully.");
      router.back();
    } catch (error) {
      console.error("Error saving medical notes:", error);
      Alert.alert("Error", "Failed to save medical notes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
     return (
        <SafeAreaView style={styles.wrapper}>
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => router.back()} />
            <View style={[styles.card, { justifyContent: 'center', alignItems: 'center', height: 200 }]}>
                <ActivityIndicator size="large" color="#0b6efd" />
                <Text style={{ marginTop: 10 }}>Loading notes...</Text>
            </View>
        </SafeAreaView>
     );
  }

  return (
    <SafeAreaView style={styles.wrapper}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => router.back()} />

      <View style={styles.card}>
        <ScrollView>
          <Text style={styles.title}>Medical Notes</Text>
          {appointmentId && <Text style={styles.subtitle}>For Appointment ID: {appointmentId.substring(0, 8)}...</Text>}

          <Text style={styles.label}>Diagnosis</Text>
          <TextInput 
            value={diagnosis} 
            onChangeText={setDiagnosis} 
            style={[styles.input, { height: 80 }]} 
            multiline 
            placeholder="Enter diagnosis..."
            textAlignVertical="top"
          />

          <Text style={styles.label}>Treatment Plan</Text>
          <TextInput 
            value={treatment} 
            onChangeText={setTreatment} 
            style={[styles.input, { height: 100 }]} 
            multiline 
            placeholder="Enter treatment plan..."
            textAlignVertical="top"
          />

          <Text style={styles.label}>Follow-up</Text>
          <TextInput 
            value={followUp} 
            onChangeText={setFollowUp} 
            style={styles.input} 
            placeholder="e.g. 2 weeks"
          />

          <View style={styles.actions}>
            <TouchableOpacity 
                style={[styles.primaryBtn, saving && styles.disabledBtn]} 
                onPress={handleSave}
                disabled={saving}
            >
              {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
              ) : (
                  <Text style={styles.primaryBtnText}>Save Session Notes</Text>
              )}
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
  title: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 12, color: "#999", marginBottom: 12 },
  label: { color: "#666", marginTop: 12, fontWeight: '600' },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 10,
    backgroundColor: "#fafafa",
    marginTop: 6,
  },
  actions: { marginTop: 24, alignItems: "flex-end" },
  primaryBtn: { backgroundColor: "#0b6efd", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  disabledBtn: { opacity: 0.7 }
});