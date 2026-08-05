import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Fonts } from "../../constants/theme";

interface UrgentMessageModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: (reason: string) => void;
}

export const UrgentMessageModal: React.FC<UrgentMessageModalProps> = ({
  visible,
  onClose,
  onSend,
}) => {
  const [urgentReason, setUrgentReason] = useState("");

  const handleSend = () => {
    onSend(urgentReason);
    setUrgentReason("");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        onPress={onClose}
        activeOpacity={1}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.icon}>🚨</Text>
            <Text style={styles.title}>Mark as Urgent</Text>
          </View>
          <Text style={styles.description}>
            This message will be flagged as urgent and notify the recipient immediately
          </Text>
          <View style={styles.form}>
            <Text style={styles.label}>Reason for Urgency</Text>
            <View style={styles.reasonButtons}>
              {["Severe Condition", "Follow-up Required", "Critical Result", "Action Required"].map(
                (reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonButton,
                      urgentReason === reason && styles.reasonButtonSelected,
                    ]}
                    onPress={() => setUrgentReason(reason)}
                  >
                    <Text
                      style={[
                        styles.reasonText,
                        urgentReason === reason && styles.reasonTextSelected,
                      ]}
                    >
                      {reason}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
            <Text style={styles.warning}>
              ⚠️ Only use urgent flag for truly time-sensitive matters to avoid notification fatigue
            </Text>
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={onClose}
            >
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonDanger]}
              onPress={handleSend}
              disabled={!urgentReason}
            >
              <Text style={styles.buttonText}>Send Urgent</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 12,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f1724",
    fontFamily: Fonts.interBold,
  },
  description: {
    fontSize: 14,
    color: "#666",
    paddingHorizontal: 20,
    marginBottom: 18,
    fontWeight: "500",
    lineHeight: 20,
  },
  form: {
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f1724",
    marginBottom: 8,
    letterSpacing: 0.3,
    fontFamily: Fonts.interSemiBold,
  },
  reasonButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  reasonButton: {
    flex: 1,
    minWidth: "45%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: "#e8ecf1",
    borderRadius: 10,
    backgroundColor: "#f8f9fa",
    alignItems: "center",
  },
  reasonButtonSelected: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  reasonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f1724",
  },
  reasonTextSelected: {
    color: "#fff",
  },
  warning: {
    fontSize: 12,
    color: "#b91c1c",
    backgroundColor: "#fee2e2",
    borderLeftWidth: 3,
    borderLeftColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 10,
    fontWeight: "600",
    lineHeight: 17,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#e8ecf1",
  },
  button: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: "#0b6efd",
    shadowColor: "#0b6efd",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDanger: {
    backgroundColor: "#ef4444",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonSecondary: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1.5,
    borderColor: "#e8ecf1",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  buttonSecondaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f1724",
    letterSpacing: 0.3,
  },
});
