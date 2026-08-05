import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { MEDICATION_LABEL, PRESCRIPTION_LABEL } from '../../constants/AppStrings';
import { Fonts } from "../../constants/theme";

interface PrescriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: (medication: string, dosage: string, frequency: string, duration: string, instructions: string) => void;
}

export const PrescriptionModal: React.FC<PrescriptionModalProps> = ({
  visible,
  onClose,
  onSend,
}) => {
  const [medication, setMedication] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [instructions, setInstructions] = useState("");

  const handleSend = () => {
    onSend(medication, dosage, frequency, duration, instructions);
    setMedication("");
    setDosage("");
    setFrequency("");
    setDuration("");
    setInstructions("");
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
          <Text style={styles.title}>Send {PRESCRIPTION_LABEL}</Text>
          <Text style={styles.description}>Create and send to the client</Text>
          <ScrollView style={styles.form}>
            <Text style={styles.label}>{MEDICATION_LABEL}</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Amoxicillin"
              placeholderTextColor="#999"
              value={medication}
              onChangeText={setMedication}
            />
            <Text style={styles.label}>Dosage</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 500mg"
              placeholderTextColor="#999"
              value={dosage}
              onChangeText={setDosage}
            />
            <Text style={styles.label}>Frequency</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 3 times daily"
              placeholderTextColor="#999"
              value={frequency}
              onChangeText={setFrequency}
            />
            <Text style={styles.label}>Duration</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 7 days"
              placeholderTextColor="#999"
              value={duration}
              onChangeText={setDuration}
            />
            <Text style={styles.label}>Instructions</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Take with food, avoid dairy..."
              placeholderTextColor="#999"
              value={instructions}
              onChangeText={setInstructions}
              multiline
            />
          </ScrollView>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={onClose}
            >
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleSend}
            >
              <Text style={styles.buttonText}>Send Prescription</Text>
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
    paddingTop: 24,
    paddingBottom: 32,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f1724",
    paddingHorizontal: 20,
    marginBottom: 6,
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
    maxHeight: 280,
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
  input: {
    borderWidth: 1.5,
    borderColor: "#e8ecf1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    backgroundColor: "#f8f9fa",
    color: "#0f1724",
    fontWeight: "500",
    marginBottom: 16,
  },
  textarea: {
    minHeight: 90,
    textAlignVertical: "top",
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
