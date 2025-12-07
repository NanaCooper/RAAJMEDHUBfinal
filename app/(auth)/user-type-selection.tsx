import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../hooks/useAuth";

// --- 🏥 Premium Healthcare Theme ---
const COLORS = {
  primary: "#0A2463",    // Deep navy
  secondary: "#00A896",  // Medical teal
  accent: "#FF6B6B",     // Coral
  background: "#F8F9FA", // Clean white/gray
  surface: "#FFFFFF",    // Card surface
  textMain: "#212529",
  textSec: "#6C757D",
  border: "#E9ECEF",
  selectedBg: "#E6F7F5", // Light teal bg for selection
};

const SHADOW = {
  shadowColor: "#0A2463",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 6,
};

export default function UserTypeSelection() {
  const { setUserType, reloadUser } = useAuth();
  const [selection, setSelection] = useState<"patient" | "doctor" | null>(null);

  const handleContinue = async () => {
    if (!selection) return;

    // Persist user type and reload the user session
    await setUserType(selection);
    await reloadUser();

    // Navigation will now be handled automatically by the useProtectedRoute hook
  };

  const SelectionCard = ({
    type,
    title,
    description,
    iconName,
  }: {
    type: "patient" | "doctor";
    title: string;
    description: string;
    iconName: React.ComponentProps<typeof Feather>["name"];
  }) => {
    const isSelected = selection === type;
    
    return (
      <TouchableOpacity
        style={[
          styles.card, 
          isSelected && styles.cardSelected
        ]}
        onPress={() => setSelection(type)}
        activeOpacity={0.9}
      >
        <View style={[
          styles.iconContainer, 
          isSelected ? styles.iconContainerSelected : null
        ]}>
          <Feather
            name={iconName}
            size={28}
            color={isSelected ? COLORS.secondary : COLORS.textSec}
          />
        </View>
        
        <View style={styles.cardTextContainer}>
          <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
            {title}
          </Text>
          <Text style={styles.cardDescription}>{description}</Text>
        </View>

        <View style={[
          styles.radioCircle, 
          isSelected && styles.radioCircleSelected
        ]}>
          {isSelected && <View style={styles.radioInner} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <View style={styles.content}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.brandIcon}>
            <MaterialCommunityIcons name="account-group-outline" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Select Your Role</Text>
          <Text style={styles.subtitle}>
            How will you be using MediCare today?
          </Text>
        </View>

        {/* Selection Cards */}
        <View style={styles.selectionContainer}>
          <SelectionCard
            type="patient"
            title="I am a Patient"
            description="Book appointments, view records, and manage your personal health journey."
            iconName="user"
          />
          
          <SelectionCard
            type="doctor"
            title="I am a Provider"
            description="Manage patient queues, schedules, and conduct consultations."
            iconName="briefcase"
          />
        </View>
      </View>

      {/* Footer Action */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, !selection && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!selection}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Continue</Text>
          <Feather name="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  
  // --- Header Styles ---
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  brandIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.selectedBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.primary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSec,
    textAlign: "center",
    maxWidth: "80%",
    lineHeight: 22,
  },

  // --- Card Styles ---
  selectionContainer: {
    gap: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent", // Default border hidden
    ...SHADOW,
  },
  cardSelected: {
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.surface, // Keep white surface for contrast
  },
  
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconContainerSelected: {
    backgroundColor: COLORS.selectedBg,
  },
  
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textMain,
    marginBottom: 4,
  },
  cardTitleSelected: {
    color: COLORS.primary,
  },
  cardDescription: {
    fontSize: 13,
    color: COLORS.textSec,
    lineHeight: 18,
  },

  // --- Radio Button Styles ---
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  radioCircleSelected: {
    borderColor: COLORS.secondary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.secondary,
  },

  // --- Footer/Button Styles ---
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 20,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    flexDirection: 'row',
    justifyContent: 'center',
    ...SHADOW,
    shadowOpacity: 0.2, // Slightly stronger shadow for button
  },
  buttonDisabled: {
    backgroundColor: COLORS.textSec,
    opacity: 0.5,
    shadowOpacity: 0,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginRight: 8,
  },
});