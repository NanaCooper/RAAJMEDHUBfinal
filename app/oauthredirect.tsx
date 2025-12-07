import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

// This route handles the redirect from Google Sign-In (and other OAuth providers).
// It prevents the "Unmatched Route" error in Expo Router.
// The actual auth logic is handled by the useAuthRequest hook in the AuthProvider.
// Once the sign-in completes, the AuthProvider will redirect the user to the appropriate screen.
export default function OAuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    const checkUrl = async () => {
      const url = await Linking.getInitialURL();
      console.log("OAuthRedirect mounted. Initial URL:", url);
    };
    checkUrl();
  }, []);
  
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0A2463" />
      <Text style={styles.text}>Completing Sign In...</Text>
      <TouchableOpacity onPress={() => router.replace('/login')} style={styles.button}>
         <Text style={styles.buttonText}>Stuck? Go back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    color: '#0A2463',
    fontWeight: '600',
  },
  button: {
    marginTop: 30,
    padding: 10,
  },
  buttonText: {
    color: '#0A2463',
    textDecorationLine: 'underline',
  }
});
