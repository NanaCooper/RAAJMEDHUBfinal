import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory lock to prevent race conditions when scheduling reminders for the same appointment
const schedulingLocks = new Map<string, Promise<void>>();

/**
 * Notification Service for MediCare
 * Handles:
 * - Desktop/push notifications for new messages
 * - Sound alerts (optional)
 * - Badge counters on app icon
 * - User notification preferences
 */

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowList: true,
  }),
});

// Notification preferences storage key
const NOTIFICATION_PREFS_KEY = 'notificationPreferences';
const BADGE_COUNT_KEY = 'badgeCount';

export interface NotificationPreferences {
  enabled: boolean;
  soundEnabled: boolean;
  badgeEnabled: boolean;
  mutedConversations: string[]; // conversation IDs to mute
}

export const defaultNotificationPreferences: NotificationPreferences = {
  enabled: true,
  soundEnabled: true,
  badgeEnabled: true,
  mutedConversations: [],
};

/**
 * Initialize notifications
 * Call this once when app launches
 */
export async function initializeNotifications() {
  try {
    // Request permissions first
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted!');
      return false;
    }

    // Load notification preferences
    await getNotificationPreferences();

    // Set up notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });

      // High priority channel for urgent messages
      await Notifications.setNotificationChannelAsync('urgent-messages', {
        name: 'Urgent Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#FF0000',
        sound: 'default',
      });

      // Regular messages channel
      await Notifications.setNotificationChannelAsync('regular-messages', {
        name: 'Regular Messages',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }

    return true;
  } catch (error) {
    console.error('Failed to initialize notifications:', error);
    return false;
  }
}

/**
 * Get current notification preferences
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return defaultNotificationPreferences;
  } catch (error) {
    console.error('Failed to get notification preferences:', error);
    return defaultNotificationPreferences;
  }
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  updates: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  try {
    const current = await getNotificationPreferences();
    const updated = { ...current, ...updates };
    await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to update notification preferences:', error);
    const fallback = await getNotificationPreferences();
    return fallback;
  }
}

/**
 * Send a local notification for a new message
 * @param title - Notification title (sender name)
 * @param body - Notification body (message preview)
 * @param conversationId - ID of conversation
 * @param messageId - ID of message
 * @param isUrgent - Whether this is an urgent message
 * @param data - Additional data to pass with notification
 */
export async function sendMessageNotification(
  title: string,
  body: string,
  conversationId: string,
  messageId: string,
  isUrgent: boolean = false,
  data?: Record<string, string>
) {
  try {
    const prefs = await getNotificationPreferences();

    // Check if notifications are enabled
    if (!prefs.enabled) {
      return;
    }

    // Check if this conversation is muted
    if (prefs.mutedConversations.includes(conversationId)) {
      return;
    }

    // Determine notification channel and sound
    const notificationChannel = isUrgent ? 'urgent-messages' : 'regular-messages';
    const shouldPlaySound = prefs.soundEnabled && !prefs.mutedConversations.includes(conversationId);

    // Send notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: shouldPlaySound ? 'default' : undefined,
        badge: prefs.badgeEnabled ? (await getBadgeCount()) + 1 : undefined,
        data: {
          conversationId,
          messageId,
          isUrgent: isUrgent.toString(),
          ...data,
        },
      },
      trigger: notificationChannel as any, // Send immediately
    });

    // Increment badge count
    if (prefs.badgeEnabled) {
      await incrementBadgeCount();
    }
  } catch (error) {
    console.error('Failed to send message notification:', error);
  }
}

/**
 * Send urgent message notification (with higher priority)
 */
export async function sendUrgentMessageNotification(
  title: string,
  body: string,
  conversationId: string,
  messageId: string,
  urgencyReason?: string,
  data?: Record<string, string>
) {
  return sendMessageNotification(
    `🚨 ${title}`,
    `${urgencyReason ? `[${urgencyReason}] ` : ''}${body}`,
    conversationId,
    messageId,
    true,
    { urgencyReason: urgencyReason || '', ...data }
  );
}

/**
 * Get current badge count
 */
export async function getBadgeCount(): Promise<number> {
  try {
    const count = await AsyncStorage.getItem(BADGE_COUNT_KEY);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error('Failed to get badge count:', error);
    return 0;
  }
}

/**
 * Increment badge count
 */
export async function incrementBadgeCount(): Promise<void> {
  try {
    const current = await getBadgeCount();
    const newCount = current + 1;
    await AsyncStorage.setItem(BADGE_COUNT_KEY, newCount.toString());

    // Also update the app icon badge
    await Notifications.setBadgeCountAsync(newCount);
  } catch (error) {
    console.error('Failed to increment badge count:', error);
  }
}

/**
 * Decrement badge count
 */
export async function decrementBadgeCount(): Promise<void> {
  try {
    const current = Math.max(0, await getBadgeCount() - 1);
    await AsyncStorage.setItem(BADGE_COUNT_KEY, current.toString());

    // Also update the app icon badge
    await Notifications.setBadgeCountAsync(current);
  } catch (error) {
    console.error('Failed to decrement badge count:', error);
  }
}

/**
 * Clear all badge counts
 */
export async function clearBadgeCount(): Promise<void> {
  try {
    await AsyncStorage.setItem(BADGE_COUNT_KEY, '0');
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.error('Failed to clear badge count:', error);
  }
}

/**
 * Mute notifications for a specific conversation
 */
export async function muteConversation(conversationId: string): Promise<void> {
  try {
    const prefs = await getNotificationPreferences();
    if (!prefs.mutedConversations.includes(conversationId)) {
      prefs.mutedConversations.push(conversationId);
      await updateNotificationPreferences(prefs);
    }
  } catch (error) {
    console.error('Failed to mute conversation:', error);
  }
}

/**
 * Unmute notifications for a specific conversation
 */
export async function unmuteConversation(conversationId: string): Promise<void> {
  try {
    const prefs = await getNotificationPreferences();
    prefs.mutedConversations = prefs.mutedConversations.filter(id => id !== conversationId);
    await updateNotificationPreferences(prefs);
  } catch (error) {
    console.error('Failed to unmute conversation:', error);
  }
}

/**
 * Check if a conversation is muted
 */
export async function isConversationMuted(conversationId: string): Promise<boolean> {
  try {
    const prefs = await getNotificationPreferences();
    return prefs.mutedConversations.includes(conversationId);
  } catch (error) {
    console.error('Failed to check if conversation is muted:', error);
    return false;
  }
}

/**
 * Set up notification response listener
 * Call this in your app root to handle notification taps
 */
export function setupNotificationResponseListener(
  onNotificationResponse: (conversationId?: string, messageId?: string, data?: any) => void
) {
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as Record<string, any>;
    const conversationId = data.conversationId as string;
    const messageId = data.messageId as string;

    onNotificationResponse(conversationId, messageId, data);
  });

  return subscription; // Return subscription so it can be removed later
}

/**
 * Clean up resources when conversation is opened
 * (notification was handled by user)
 */
export async function handleConversationOpened(conversationId: string): Promise<void> {
  try {
    // Decrement badge count
    await decrementBadgeCount();

    // Could add more cleanup logic here if needed
  } catch (error) {
    console.error('Failed to handle conversation opened:', error);
  }
}

/**
 * Get unread message count for a conversation
 * (can be stored in Firestore or local state)
 */
export async function getUnreadCount(conversationId: string): Promise<number> {
  // This should be implemented based on your Firestore structure
  // For now, returning a placeholder
  return 0;
}

/**
 * Mark conversation as read (clear badge for that conversation)
 */
export async function markConversationAsRead(conversationId: string): Promise<void> {
  try {
    await decrementBadgeCount();
    // You might also want to update Firestore here
  } catch (error) {
    console.error('Failed to mark conversation as read:', error);
  }
}

/**
 * Send a local notification for an appointment
 */
export async function sendAppointmentNotification(
  title: string,
  body: string,
  appointmentId: string,
  data?: Record<string, string>
) {
  try {
    console.log('[NotificationService] Sending appointment notification:', title);
    const prefs = await getNotificationPreferences();

    // Check if notifications are enabled
    if (!prefs.enabled) {
      console.log('[NotificationService] Notifications disabled in preferences');
      return;
    }

    // Send notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: prefs.soundEnabled ? 'default' : undefined,
        badge: prefs.badgeEnabled ? (await getBadgeCount()) + 1 : undefined,
        data: {
          type: 'appointment',
          appointmentId,
          ...data,
        },
      },
      trigger: null, // Send immediately
    });

    // Increment badge count
    if (prefs.badgeEnabled) {
      await incrementBadgeCount();
    }
  } catch (error) {
    console.error('Failed to send appointment notification:', error);
  }
}

/**
 * Send a notification that a doctor has been assigned
 */
export async function sendDoctorAssignedNotification(
  doctorName: string,
  date: Date,
  appointmentId: string
) {
  try {
    const prefs = await getNotificationPreferences();
    if (!prefs.enabled) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Appointment Approved',
        body: 'Wait for confirmation from RAAJ Medhub',
        sound: prefs.soundEnabled ? 'default' : undefined,
        data: { type: 'doctor_assigned', appointmentId },
      },
      trigger: null,
    });

    if (prefs.badgeEnabled) await incrementBadgeCount();
  } catch (error) {
    console.error('Failed to send doctor assigned notification:', error);
  }
}

/**
 * Send a notification that an appointment has been rescheduled/approved with a date
 */
export async function sendAppointmentRescheduledNotification(
  date: Date,
  appointmentId: string
) {
  try {
    const prefs = await getNotificationPreferences();
    if (!prefs.enabled) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Appointment Approved',
        body: `Your appointment has been approved, you have an appointment on ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        sound: prefs.soundEnabled ? 'default' : undefined,
        data: { type: 'appointment_rescheduled', appointmentId },
      },
      trigger: null,
    });

    if (prefs.badgeEnabled) await incrementBadgeCount();
  } catch (error) {
    console.error('Failed to send appointment rescheduled notification:', error);
  }
}

/**
 * Send a notification to doctor that a patient has been assigned
 */
export async function sendPatientAssignedNotification(
  patientName: string,
  date: Date,
  appointmentId: string
) {
  try {
    const prefs = await getNotificationPreferences();
    if (!prefs.enabled) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New Patient Assigned',
        body: `Patient ${patientName} has been assigned to you for ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        sound: prefs.soundEnabled ? 'default' : undefined,
        data: { type: 'patient_assigned', appointmentId },
      },
      trigger: null,
    });

    if (prefs.badgeEnabled) await incrementBadgeCount();
  } catch (error) {
    console.error('Failed to send patient assigned notification:', error);
  }
}

/**
 * Schedule reminders for an appointment
 * - 1 day before
 * - 2 hours before
 * Uses AsyncStorage to prevent duplicate scheduling
 */
export async function scheduleAppointmentReminders(
  appointmentId: string,
  startAt: Date,
  otherPartyName?: string, // Doctor name for patient, Patient name for doctor
  role: 'patient' | 'doctor' = 'patient'
) {
  // Prevent race conditions for the same appointment
  if (schedulingLocks.has(appointmentId)) {
    return schedulingLocks.get(appointmentId);
  }

  const task = (async () => {
    try {
      const prefs = await getNotificationPreferences();
      if (!prefs.enabled) return;

      const now = new Date();
      const oneDayBefore = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
      const twoHoursBefore = new Date(startAt.getTime() - 2 * 60 * 60 * 1000);

      const partyLabel = role === 'patient' ? (otherPartyName ? ` with Dr. ${otherPartyName}` : '') : (otherPartyName ? ` with ${otherPartyName}` : '');

      // Helper to manage duplicate scheduling
      const scheduleUnique = async (triggerDate: Date, type: '1day' | '2hour', title: string, body: string) => {
        const storageKey = `reminder_${appointmentId}_${type}`;
        const triggerTime = triggerDate.getTime();

        // 1. Check existing
        const storedData = await AsyncStorage.getItem(storageKey);
        if (storedData) {
          try {
            const { id, time } = JSON.parse(storedData);
            // If scheduled for the exact same time, skip
            if (time === triggerTime) {
              return;
            }
            // If time changed, cancel old one
            await Notifications.cancelScheduledNotificationAsync(id);
          } catch (e) {
            // If legacy format (just ID string), try to cancel it
            await Notifications.cancelScheduledNotificationAsync(storedData);
          }
        }

        // 2. Schedule new if in future
        if (triggerDate > now) {
          const newId = await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              sound: prefs.soundEnabled ? 'default' : undefined,
              data: { type: 'appointment_reminder', appointmentId },
            },
            trigger: { type: 'date', date: triggerDate } as any,
          });

          // 3. Save new ID and Time
          await AsyncStorage.setItem(storageKey, JSON.stringify({ id: newId, time: triggerTime }));
          console.log(`[NotificationService] Scheduled ${type} reminder for: ${triggerDate.toISOString()} (Appt: ${startAt.toISOString()})`);
        }
      };

      // Schedule 1 day before reminder
      if (oneDayBefore > now) {
        await scheduleUnique(
          oneDayBefore,
          '1day',
          'Upcoming Appointment Reminder',
          `You have an appointment tomorrow at ${startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${partyLabel}.`
        );
      }

      // Schedule 2 hours before reminder
      if (twoHoursBefore > now) {
        await scheduleUnique(
          twoHoursBefore,
          '2hour',
          'Appointment Starting Soon',
          `Your appointment is in 2 hours at ${startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Please be ready.`
        );
      }

    } catch (error) {
      console.error('Failed to schedule appointment reminders:', error);
    }
  })();

  schedulingLocks.set(appointmentId, task);
  try {
    await task;
  } finally {
    schedulingLocks.delete(appointmentId);
  }
}
