import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  BackHandler,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from "expo-router";
import dayjs from "dayjs";
import { createAppointment } from "../../services/appointments";
import { sendRequestSubmittedNotification, scheduleAppointmentReminders } from "../../services/notifications";
import { Feather } from "@expo/vector-icons";

// --- Theme ---
const COLORS = {
  primary: "#4F46E5",
  primarySoft: "#EEF2FF",
  primaryDisabled: "#A5B4FC",
  surface: "#FFFFFF",
  textMain: "#1E293B",
  textSec: "#64748B",
  border: "#E2E8F0",
  backdrop: "rgba(0,0,0,0.5)",
  success: "#10B981",
  successSoft: "#ECFDF5",
};

const SHADOW = {
  shadowColor: "#64748B",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.1,
  shadowRadius: 16,
  elevation: 5,
};


export default function BookingConfirmationModal() {
  console.log("--- [booking-confirmation.tsx] BookingConfirmationModal rendered! ---");
  const router = useRouter();
  const params = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Parse details from params once to avoid re-renders from param object identity change
  const { date, appointmentData, scanType, branch } = useMemo(() => {
    try {
      const data = JSON.parse((params.appointmentData as string) || '{}');
      console.log("--- [booking-confirmation.tsx] Params parsed: ", JSON.stringify(params, null, 2));
      return {
        date: params.date as string,
        appointmentData: data,
        scanType: data?.scanType?.name || (Array.isArray(data?.scanTypes) ? data.scanTypes.map((s: any) => s.name).join(', ') : 'Consultation'),
        branch: data?.branch || 'MediCare Central Clinic',
      };
    } catch (e) {
      console.error("--- [booking-confirmation.tsx] Failed to parse appointment data ---", e);
      Alert.alert("Error", "Could not load appointment details.", [{ text: "OK", onPress: () => router.back() }]);
      return { date: '', appointmentData: null, scanType: 'Error', branch: '' };
    }
  }, [params, router]);

  // Animation and hardware back press handling
  useEffect(() => {
    console.log("--- [booking-confirmation.tsx] Mount/Update Effect ---", { isLoading, isConfirmed });
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      useNativeDriver: true,
    }).start();

    const onBackPress = () => {
      console.log("--- [booking-confirmation.tsx] Back button pressed! ---");
      if (!isLoading) {
        router.back();
      }
      return true; // Prevent default behavior
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => {
      console.log("--- [booking-confirmation.tsx] Cleanup Effect ---");
      subscription.remove();
    }
  }, [router, scaleAnim, isLoading]);

  const handleConfirm = async () => {
    console.log("--- [booking-confirmation.tsx] handleConfirm triggered (FINAL CHECK) ---");

    if (!appointmentData) {
      console.error("[LOG] handleConfirm: Failed. appointmentData is null or undefined.");
      Alert.alert("Error", "Missing appointment data. Please try again.");
      return;
    }
    console.log("[LOG] handleConfirm: Received appointment data:", JSON.stringify(appointmentData, null, 2));

    setIsLoading(true);
    try {
      // The startAt is now an ISO string, so we can parse it directly
      const appointmentToSave = {
        ...appointmentData,
        startAt: dayjs(appointmentData.startAt).toDate(),
      };
      console.log("[LOG] handleConfirm: Final object being sent to createAppointment:", JSON.stringify(appointmentToSave, null, 2));

      console.log("--- [booking-confirmation.tsx] Attempting to call createAppointment... ---");
      const result = await createAppointment(appointmentToSave as any);
      console.log("[LOG] handleConfirm: Successfully created appointment. Firestore response:", result);

      // Send "request submitted" notification immediately
      await sendRequestSubmittedNotification(result.id || '');

      // Schedule reminders
      if (result.id && appointmentToSave.startAt) {
        await scheduleAppointmentReminders(
          result.id,
          appointmentToSave.startAt
        );
      }

      setIsConfirmed(true);
      console.log("--- [booking-confirmation.tsx] Booking Confirmation Succeeded ---");

    } catch (error) {
      console.error("--- [booking-confirmation.tsx] Booking Confirmation FAILED ---");
      console.error("[LOG] handleConfirm: An error occurred during createAppointment:", error);

      setIsLoading(false);
      Alert.alert(
        "Booking Failed",
        "We couldn't save your appointment. Please check the logs for more details and try again.",
        [{ text: "OK" }]
      );
    }
  };

  const handleFinish = () => {
    router.back();
    // Navigate to the appointments list after a short delay to allow the modal to close
    setTimeout(() => {
      router.push('/(patient)/appointments');
    }, 200);
  };

  const handleEdit = () => {
    if (isLoading) return;
    router.back();
  };

  const renderConfirmation = () => {
    console.log("--- [booking-confirmation.tsx] renderConfirmation executed (DEBUG) ---");
    console.log(`[LOG] Confirm button isLoading: ${isLoading}`);

    const DetailRow = ({ icon, label, value }: { icon: any; label: string; value: string }) => (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Feather name={icon} size={18} color={COLORS.primary} />
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.value}>{value}</Text>
      </View>
    );

    return (
      <>
        <Text style={styles.title}>Confirm Your Appointment</Text>

        <View style={styles.detailsContainer}>
          <DetailRow icon="clipboard" label="Service" value={scanType} />
          <View style={styles.divider} />
          <DetailRow icon="map-pin" label="Location" value={branch} />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.outlineBtn} onPress={handleEdit} disabled={isLoading}>
            <Text style={styles.outlineBtnText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
            onPress={() => {
              console.log("--- [booking-confirmation.tsx] Confirm & Book button pressed! (DEBUG) ---");
              handleConfirm();
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Confirm & Book</Text>
            )}
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const renderSuccess = () => (
    <View style={styles.successContainer}>
      <View style={styles.successIconCircle}>
        <Feather name="check" size={48} color={COLORS.success} />
      </View>
      <Text style={styles.successTitle}>Booking Confirmed!</Text>
      <Text style={styles.successMsg}>
        Your appointment for a {scanType} has been requested.
      </Text>
      <TouchableOpacity style={[styles.primaryBtn, { marginTop: 16 }]} onPress={handleFinish}>
        <Text style={styles.primaryBtnText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView
      style={styles.wrapper}
      edges={['bottom']}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleEdit} />

      <Animated.View
        style={[styles.card, { transform: [{ scale: scaleAnim }] }]}
      >
        {isConfirmed ? renderSuccess() : renderConfirmation()}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.backdrop,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: Platform.OS === "ios" ? 16 : 24,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    ...SHADOW,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.textMain,
    textAlign: 'center',
    marginBottom: 16,
  },
  detailsContainer: {
    backgroundColor: '#F8FAFC', // slate-50
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    marginVertical: 16,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontSize: 15,
    color: COLORS.textSec,
    fontWeight: '500',
  },
  value: {
    fontSize: 15,
    color: COLORS.textMain,
    fontWeight: "600",
    textAlign: 'right',
    flexShrink: 1,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    gap: 12,
  },
  outlineBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    color: COLORS.textSec,
    fontWeight: "700",
    fontSize: 16,
  },
  primaryBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
    shadowColor: COLORS.primary,
  },
  primaryBtnDisabled: {
    backgroundColor: COLORS.primaryDisabled,
    shadowColor: 'transparent',
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  successIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.textMain,
    marginBottom: 8,
  },
  successMsg: {
    fontSize: 15,
    color: COLORS.textSec,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
});