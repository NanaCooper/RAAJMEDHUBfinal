import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { AuthProvider } from '../hooks/useAuth';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { initializeNotifications, setupNotificationResponseListener } from '../services/notifications';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = React.useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          // 'Inter': require('../assets/fonts/Inter-Regular.ttf'),
        });
      } catch (e) {
        console.warn('Font loading skipped or failed (using system fonts):', e);
      } finally {
        setFontsLoaded(true);
        await SplashScreen.hideAsync();
      }
    }

    async function checkForUpdates() {
      if (__DEV__) return; // Don't check in dev mode
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            'Update Available',
            'A new version of the app is ready. Restart now to apply?',
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Restart',
                onPress: async () => {
                  try {
                    await Updates.reloadAsync();
                  } catch (e) {
                    console.error('Failed to reload:', e);
                  }
                },
              },
            ]
          );
        }
      } catch (error) {
        // Silently fail or log
        console.log(`Error checking for updates: ${error}`);
      }
    }

    loadFonts();
    checkForUpdates();

    // Initialize notifications
    initializeNotifications();

    // Handle notification taps
    const subscription = setupNotificationResponseListener((conversationId, messageId, data) => {
      // Handle different notification types
      if (data?.type === 'appointment_reminder' || data?.type === 'doctor_assigned' || data?.type === 'patient_assigned') {
        // Navigate to appointments tab
        // We need to determine if user is patient or doctor, but for now we can try generic routing
        // or just let the user navigate manually. 
        // Ideally, we'd check the user role here or in the listener.
        // For now, let's assume patient view for appointment details if possible, or just open app.
        // router.push('/(patient)/appointments'); 
      } else if (conversationId) {
        // Navigate to the conversation
        router.push({
          pathname: '/(patient)/messages/[id]',
          params: { id: conversationId }
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
