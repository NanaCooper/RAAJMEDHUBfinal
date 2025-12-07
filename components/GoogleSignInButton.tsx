import React from "react";
import { Text, StyleSheet, TouchableOpacity } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useAuth } from "../hooks/useAuth";

export function GoogleSignInButton() {
  const { promptGoogleSignIn, googleAuthRequest } = useAuth();

  return (
    <TouchableOpacity
      style={[styles.button, !googleAuthRequest && styles.buttonDisabled]}
      disabled={!googleAuthRequest}
      onPress={() => {
        console.log("Google Sign In button pressed");
        promptGoogleSignIn();
      }}
      activeOpacity={0.8}
    >
      <FontAwesome name="google" size={20} color="#FFF" style={styles.icon} />
      <Text style={styles.buttonText}>
        {!googleAuthRequest ? "Loading..." : "Sign in with Google"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#4285F4", // Google's blue
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 8,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      buttonDisabled: {
        backgroundColor: "#A0C1F7", // Lighter blue
        elevation: 0,
      },
      icon: {
        marginRight: 12,
      },
      buttonText: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "600",
      },
});
