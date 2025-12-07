import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from '../../hooks/useAuth';
import { Feather } from "@expo/vector-icons";

type Params = { id?: string };

export default function AppointmentDetails() {
  const router = useRouter();
  const { userType } = useAuth();
  const params = useLocalSearchParams<Params>();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : (rawId ?? "unknown");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [appointment, setAppointment] = useState<any>(null);
  const [doctor, setDoctor] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const isDoctor = userType === 'doctor';

  const formatDate = (dateVal: any) => {
    if (!dateVal) return 'N/A';
    try {
      const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
      if (isNaN(d.getTime())) return 'Invalid Date';
      return d.toLocaleDateString(undefined, { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Date Error';
    }
  };

  const calculateAge = (dob: any) => {
    if (!dob) return null;
    try {
      let birthDate: Date;
      if (dob && typeof dob === 'object' && dob.toDate) {
          birthDate = dob.toDate();
      } else {
          birthDate = new Date(dob);
      }
      if (isNaN(birthDate.getTime())) return 'N/A';
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch (e) {
      return 'N/A';
    }
  };

  useEffect(() => {
    let mounted = true;
    console.log("AppointmentDetails mounted with id:", id);
    
    if (!id || id === 'unknown') {
        console.warn("Invalid appointment ID received");
        setLoading(false);
        return;
    }

    (async () => {
      try {
        setLoading(true);
        const { getAppointment } = await import('../../services/appointments');
        console.log("Fetching appointment...");
        const apt = await getAppointment(id);
        console.log("Appointment fetched:", apt ? "Found" : "Not Found");
        
        if (!mounted) return;
        setAppointment(apt as any);
        
        if (apt?.doctorId) {
          const { getDoctor } = await import('../../services/doctors');
          const d = await getDoctor(apt.doctorId);
          if (mounted) setDoctor(d);
        }

        if (apt?.patientId) {
          const { getUserProfile } = await import('../../services/users');
          const p = await getUserProfile(apt.patientId);
          if (mounted) setPatient(p);
        }

      } catch (e) {
        console.error('Failed to load appointment details', e);
        Alert.alert("Error", "Failed to load appointment details.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  const handleApprove = async () => {
    if (!appointment) return;
    try {
      setUpdating(true);
      const { updateAppointment } = await import('../../services/appointments');
      await updateAppointment(id, { status: 'completed' });
      Alert.alert("Success", "Appointment marked as completed.");
      setAppointment({ ...appointment, status: 'completed' });
    } catch (e) {
      console.error('Failed to update appointment', e);
      Alert.alert("Error", "Failed to mark appointment as completed.");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = () => {
    console.log("Cancel appointment", id);
    Alert.alert("Cancelled (mock)", "Appointment cancelled (mock).");
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(doctor)/schedule");
    }
  };

  const handleReschedule = () => {
    console.log("Reschedule appointment", id);
    if (!doctor) return;
    router.push(`/booking/${doctor.id}`);
  };

  const handleStartConsultation = async () => {
    if (!appointment || !doctor) {
      Alert.alert("Error", "Appointment or doctor details are missing.");
      return;
    }
    try {
      setUpdating(true);
      const { findOrCreateConversation } = await import('../../services/conversations');
      const conversation = await findOrCreateConversation(appointment.patientId, doctor.id);
      if (conversation && conversation.id) {
        // Use object syntax for safer navigation
        router.push({ pathname: '/(doctor)/_doctor-messages/[id]', params: { id: conversation.id } } as any);
      } else {
        throw new Error("Failed to get a valid conversation ID.");
      }
    } catch (e) {
      console.error('Failed to start consultation', e);
      Alert.alert("Error", "Could not start or find the conversation.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0b6efd" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.title}>Appointment Details</Text>
        <View style={{width: 24}} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Appointment Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Appointment Info</Text>
          
          <View style={styles.row}>
            <Feather name="activity" size={18} color="#64748b" style={styles.icon} />
            <View style={styles.rowContent}>
              <Text style={styles.label}>Service Type</Text>
              <Text style={styles.value}>
                {appointment?.scanType?.name || (typeof appointment?.scanType === 'string' ? appointment?.scanType : 'General Consultation')}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Feather name="calendar" size={18} color="#64748b" style={styles.icon} />
            <View style={styles.rowContent}>
              <Text style={styles.label}>Date & Time</Text>
              <Text style={styles.value}>
                {formatDate(appointment?.startAt)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Feather name="file-text" size={18} color="#64748b" style={styles.icon} />
            <View style={styles.rowContent}>
              <Text style={styles.label}>Notes</Text>
              <Text style={styles.value}>{appointment?.notes || 'No additional notes.'}</Text>
            </View>
          </View>

           <View style={styles.divider} />

          <View style={styles.row}>
            <Feather name="info" size={18} color="#64748b" style={styles.icon} />
            <View style={styles.rowContent}>
              <Text style={styles.label}>Status</Text>
              <View style={[styles.statusBadge, { 
                backgroundColor: appointment?.status === 'completed' ? '#dcfce7' : 
                               appointment?.status === 'cancelled' ? '#fee2e2' : '#fef9c3' 
              }]}>
                <Text style={[styles.statusText, { 
                  color: appointment?.status === 'completed' ? '#166534' : 
                         appointment?.status === 'cancelled' ? '#991b1b' : '#854d0e' 
                }]}>
                  {appointment?.status?.toUpperCase() || 'PENDING'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Patient Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Patient Details</Text>
          {patient ? (
            <>
              <View style={styles.row}>
                <Feather name="user" size={18} color="#64748b" style={styles.icon} />
                <View style={styles.rowContent}>
                  <Text style={styles.label}>Name</Text>
                  <Text style={styles.value}>{patient.fullName || patient.name || 'Unknown'}</Text>
                </View>
              </View>
              
              {patient.dob && (
                <View style={[styles.row, { marginTop: 12 }]}>
                  <Feather name="gift" size={18} color="#64748b" style={styles.icon} />
                  <View style={styles.rowContent}>
                    <Text style={styles.label}>Age</Text>
                    <Text style={styles.value}>{calculateAge(patient.dob)} years old</Text>
                  </View>
                </View>
              )}

              <TouchableOpacity 
                style={styles.viewProfileBtn}
                onPress={() => router.push(`/patients/${patient.id}`)}
              >
                <Text style={styles.viewProfileText}>View Full Patient Profile</Text>
                <Feather name="chevron-right" size={16} color="#4f46e5" />
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.value}>Patient information unavailable</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  backBtn: { padding: 8, marginLeft: -8 },
  title: { fontSize: 18, fontWeight: "700", color: "#1e293b", flex: 1, textAlign: 'center' },
  
  content: { padding: 20, paddingBottom: 40 },
  
  card: { 
    backgroundColor: "#fff", 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 20,
    shadowColor: "#64748b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b", marginBottom: 16 },
  
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  icon: { marginTop: 2, marginRight: 12 },
  rowContent: { flex: 1 },
  label: { fontSize: 13, color: "#64748b", marginBottom: 4, fontWeight: '500' },
  value: { fontSize: 15, color: "#1e293b", fontWeight: "600", lineHeight: 22 },
  
  divider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 16 },
  
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 12, fontWeight: "700" },
  
  viewProfileBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  viewProfileText: { fontSize: 14, fontWeight: "600", color: "#4f46e5" },

  actions: { gap: 12 },
  btn: { 
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  consult: { backgroundColor: "#4f46e5" },
  consultText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  
  approved: { backgroundColor: "#10b981" },
  approvedText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  
  outline: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  outlineText: { color: "#1e293b", fontWeight: "600", fontSize: 16 },
  
  negative: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fee2e2" },
  negativeText: { color: "#ef4444", fontWeight: "600", fontSize: 16 },
  
  btnDisabled: { opacity: 0.7 },
});