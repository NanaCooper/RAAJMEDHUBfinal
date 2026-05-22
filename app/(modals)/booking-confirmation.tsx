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
  Modal,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from "expo-router";
import dayjs from "dayjs";
import { createAppointment } from "../../services/appointments";
import { createReferral, inferReferralProcedure } from "../../services/referrals";
import { 
  sendRequestSubmittedNotification, 
  scheduleAppointmentReminders,
  sendReferralSubmittedNotification
} from "../../services/notifications";
import { Feather, Ionicons } from "@expo/vector-icons";

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
  textSub: "#94A3B8", // Slate 400
  bg: "#F8FAFC",      // Slate 50
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
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [referralPayout, setReferralPayout] = useState<{ total: number; breakdown: string } | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Parse details from params once to avoid re-renders from param object identity change
  const { appointmentData, scanType, branch } = useMemo(() => {
    try {
      const data = JSON.parse((params.appointmentData as string) || '{}');
      console.log("--- [booking-confirmation.tsx] Params parsed: ", JSON.stringify(params, null, 2));
      let displayScanType = 'Consultation';
      if (data?.specificProcedure || data?.procedureName) {
        displayScanType = data.specificProcedure || data.procedureName;
      } else if (data?.scanType?.name) {
        displayScanType = data.scanType.name;
      } else if (Array.isArray(data?.scanTypes) && data.scanTypes.length > 0) {
        displayScanType = data.scanTypes.map((s: any) => s.name).join(', ');
      }

      return {
        appointmentData: data,
        scanType: displayScanType,
        branch: data?.branch || 'RAAJ MedHub Clinic',
      };
    } catch (e) {
      console.error("--- [booking-confirmation.tsx] Failed to parse appointment data ---", e);
      Alert.alert("Error", "Could not load appointment details.", [{ text: "OK", onPress: () => router.back() }]);
      return { appointmentData: null, scanType: 'Error', branch: '' };
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
  }, [router, scaleAnim, isLoading, isConfirmed]);

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

      // --- Doctor Referrals (payout tracking) ---
      const isDoctorCreated = appointmentToSave?.createdByRole === 'doctor' || !!appointmentToSave?.doctorId;
      if (isDoctorCreated && appointmentToSave?.doctorId && result?.id) {
        try {
          const patientName = `${appointmentToSave?.patientDetails?.firstName || ''} ${appointmentToSave?.patientDetails?.lastName || ''}`.trim() || 'Patient';
          const selectedProcedureName =
            (appointmentToSave as any)?.specificProcedure ||
            (appointmentToSave as any)?.procedureName ||
            '';

          const specificDetails =
            (appointmentToSave as any)?.specificProcedure ||
            (appointmentToSave as any)?.specificScan ||
            (appointmentToSave as any)?.specificScanDetails ||
            '';

          const scanTypesArr: any[] = Array.isArray((appointmentToSave as any)?.scanTypes)
            ? (appointmentToSave as any).scanTypes
            : (appointmentToSave as any)?.scanType
              ? [(appointmentToSave as any).scanType]
              : [];

          const matchedKeys = new Set<string>();
          const createdItems: { label: string; amountGhs: number }[] = [];

          // 1. Process explicit scan types (best for price-based 10% fallback)
          if (scanTypesArr.length > 0) {
            for (const s of scanTypesArr) {
              const scanName = s?.name || s?.id || 'Procedure';
              const textToMatch = `${scanName} ${specificDetails}`.trim();
              
              const match = inferReferralProcedure(textToMatch);
              let amount = 0;
              let label = scanName;
              let key = s?.id || scanName;

              if (match) {
                amount = match.amountGhs;
                label = match.label;
                key = match.key;
              } else {
                // Fallback to 7% of actual price
                const price = Number(s?.price) || Number(s?.priceGhs) || 0;
                amount = Math.round(price * 0.07);
                label = scanName;
              }

              if (amount > 0 && !matchedKeys.has(key)) {
                matchedKeys.add(key);
                await createReferral({
                  doctorId: appointmentToSave.doctorId,
                  appointmentId: result.id,
                  patientName,
                  procedureKey: key,
                  procedureLabel: label,
                  amountGhs: amount,
                } as any);
                createdItems.push({ label, amountGhs: amount });
              }
            }
          } 
          
          // 2. Fallback: If no scan types but we have a specific procedure name
          if (createdItems.length === 0 && selectedProcedureName) {
            const match = inferReferralProcedure(selectedProcedureName);
            if (match) {
              await createReferral({
                doctorId: appointmentToSave.doctorId,
                appointmentId: result.id,
                patientName,
                procedureKey: match.key,
                procedureLabel: match.label,
                amountGhs: match.amountGhs,
              } as any);
              createdItems.push({ label: match.label, amountGhs: match.amountGhs });
            }
          }

          if (createdItems.length > 0) {
            const total = createdItems.reduce((sum, i) => sum + i.amountGhs, 0);
            const breakdown = createdItems.map(i => `${i.label}: GHS ${i.amountGhs}`).join('\n');
            setReferralPayout({ total, breakdown });
            setShowPayoutModal(true);

            const labelSummary = createdItems.map(i => i.label).join(', ');
            await sendReferralSubmittedNotification(patientName, labelSummary);
          }
        } catch (e) {
          console.log('[booking-confirmation] Referral tracking failed', e);
        }
      }

      // Send "request submitted" notification immediately for patient-initiated bookings
      if (!isDoctorCreated) {
        await sendRequestSubmittedNotification(result.id || '');
      }

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
        "We weren't able to save your appointment. Please check your internet connection and try again. If the problem continues, contact support.",
        [{ text: "OK" }]
      );
    }
  };

  const handleFinish = () => {
    router.back();
    // Navigate to the appointments list after a short delay to allow the modal to close
    setTimeout(() => {
      const createdByRole = (appointmentData as any)?.createdByRole;
      router.push(createdByRole === 'doctor' ? '/(doctor)/appointments' : '/(patient)/appointments');
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
      <TouchableOpacity 
        style={[styles.primaryBtn, { marginTop: 24, width: '100%', flex: 0 }]} 
        onPress={handleFinish}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryBtnText}>OK</Text>
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
      {/* Referral Payout Modal */}
      <Modal
        visible={showPayoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPayoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.payoutModalContent}>
            <View style={styles.payoutIconContainer}>
              <Ionicons name="gift-outline" size={40} color={COLORS.primary} />
            </View>
            
            <Text style={styles.payoutTitle}>Referral Earnings</Text>
            <Text style={styles.payoutSub}>This booking has earned you a referral commission.</Text>
            
            <View style={styles.payoutAmountBox}>
              <Text style={styles.payoutAmountLabel}>Total Payout</Text>
              <Text style={styles.payoutAmountValue}>GHS {referralPayout?.total}</Text>
            </View>

            <View style={styles.payoutBreakdownBox}>
              <Text style={styles.breakdownLabel}>Breakdown</Text>
              <Text style={styles.breakdownText}>{referralPayout?.breakdown}</Text>
            </View>

            <TouchableOpacity 
              style={styles.payoutButton}
              onPress={() => setShowPayoutModal(false)}
            >
              <Text style={styles.payoutButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#F8FAFC',
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
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
    shadowColor: COLORS.primary,
  },
  primaryBtnDisabled: {
    backgroundColor: COLORS.primaryDisabled,
  },
  primaryBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.textMain,
    marginBottom: 12,
  },
  successMsg: {
    fontSize: 15,
    color: COLORS.textSec,
    textAlign: 'center',
    lineHeight: 22,
  },
  successText: { color: "#FFF", fontSize: 18, fontWeight: "700" },

  // --- Payout Modal Styles ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  payoutModalContent: {
    backgroundColor: '#FFF',
    width: '100%',
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    ...SHADOW,
  },
  payoutIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  payoutTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: 8,
  },
  payoutSub: {
    fontSize: 14,
    color: COLORS.textSub,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  payoutAmountBox: {
    width: '100%',
    backgroundColor: COLORS.bg,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  payoutAmountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSub,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  payoutAmountValue: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.primary,
  },
  payoutBreakdownBox: {
    width: '100%',
    marginBottom: 24,
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSub,
    marginBottom: 8,
  },
  breakdownText: {
    fontSize: 14,
    color: COLORS.textMain,
    lineHeight: 20,
  },
  payoutButton: {
    backgroundColor: COLORS.primary,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    ...SHADOW,
    shadowColor: COLORS.primary,
  },
  payoutButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});