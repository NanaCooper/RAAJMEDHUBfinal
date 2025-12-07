import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import moment from 'moment';
import { updateAppointmentStatus } from '../../services/appointments';

// --- Theme ---
const COLORS = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  primary: "#4F46E5",
  textMain: "#1E293B",
  textSec: "#64748B",
  border: "#E2E8F0",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
};

const SHADOW = {
  shadowColor: "#64748B",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

const AppointmentDetailScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const appointment = JSON.parse(params.appointment as string);

  const handleCancel = async () => {
    Alert.alert(
      "Cancel Appointment",
      "Are you sure you want to cancel this appointment?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await updateAppointmentStatus(appointment.id, 'cancelled');
              Alert.alert("Success", "Your appointment has been cancelled.", [
                { text: "OK", onPress: () => router.back() }
              ]);
            } catch (error) {
              console.error("Failed to cancel appointment:", error);
              Alert.alert("Error", "Could not cancel the appointment. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleReschedule = () => {
    // Navigate to the booking tab, passing appointment data to pre-fill the form
    router.push({
      pathname: '/(patient)/appointments',
      params: {
        tab: 'book',
        rescheduleData: JSON.stringify(appointment)
      }
    });
  };

  const renderStatusBadge = () => {
    const statusStyles = {
      upcoming: { bg: '#EFF6FF', text: '#2563EB' },
      completed: { bg: '#F1F5F9', text: '#475569' },
      cancelled: { bg: '#FEF2F2', text: '#DC2626' },
    };
    const style = statusStyles[appointment.status as keyof typeof statusStyles] || statusStyles.upcoming;
    return (
      <View style={[styles.statusBadge, { backgroundColor: style.bg }]}>
        <Text style={[styles.statusText, { color: style.text }]}>{appointment.status}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointment Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{appointment.scanType?.name || 'Consultation'}</Text>
            {renderStatusBadge()}
          </View>
          <Text style={styles.cardSubtitle}>
            {appointment.doctor ? `with Dr. ${appointment.doctor}` : 'Doctor to be assigned soon'}
          </Text>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Feather name="calendar" size={20} color={COLORS.primary} />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{moment(appointment.date).format("dddd, MMMM D, YYYY")}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Feather name="clock" size={20} color={COLORS.primary} />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{moment(appointment.time, "HH:mm").format("h:mm A")}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Feather name="map-pin" size={20} color={COLORS.primary} />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>MediCare Central Clinic</Text>
            </View>
          </View>
        </View>

        {appointment.status === 'upcoming' && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.outlineBtn} onPress={handleReschedule}>
              <Feather name="refresh-cw" size={16} color={COLORS.textSec} />
              <Text style={styles.outlineBtnText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.destructiveBtn} onPress={handleCancel}>
              <Feather name="x-circle" size={16} color={COLORS.error} />
              <Text style={styles.destructiveBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    ...SHADOW,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  cardSubtitle: {
    fontSize: 16,
    color: COLORS.textSec,
    marginTop: 4,
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  detailTextContainer: {
    marginLeft: 16,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textSec,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMain,
  },
  actionsContainer: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 12,
  },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  outlineBtnText: {
    color: COLORS.textSec,
    fontWeight: '700',
    fontSize: 16,
  },
  destructiveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
  },
  destructiveBtnText: {
    color: COLORS.error,
    fontWeight: '700',
    fontSize: 16,
  },
});

export default AppointmentDetailScreen;
