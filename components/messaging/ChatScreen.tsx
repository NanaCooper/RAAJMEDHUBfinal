import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons'; 

// Mock imports - ensure these paths match your project structure
import { useConversation } from '../../hooks/useMessages';
import MessageBubble from './messageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';

// --- 🎨 Premium Theme Constants ---
const THEME = {
  primary: '#0ea5e9',       // Modern Sky Blue
  primaryDark: '#0284c7',
  bg: '#F8FAFC',            // Slate 50 (Soft White)
  surface: '#FFFFFF',
  textMain: '#0F172A',      // Slate 900
  textSec: '#64748B',       // Slate 500
  border: '#E2E8F0',
  success: '#10B981',
  danger: '#EF4444',
};

export interface ChatMessage {
  id: string;
  text?: string;
  isOwn?: boolean;
  timestamp?: string;
}

interface ChatScreenProps {
  conversationId: string;
  conversationName: string;
  currentUserId?: string;
  currentUserName?: string;
  isOnline?: boolean;
  isTyping?: boolean;
  typingUserName?: string;
  onSendMessage?: (text: string) => Promise<void> | void;
  initialMessages?: ChatMessage[];
}

export default function ChatScreen({
  conversationId,
  conversationName,
  currentUserId,
  currentUserName,
  isOnline: isProviderAvailable = true,
  isTyping = false,
  typingUserName,
  onSendMessage,
  initialMessages = [],
}: ChatScreenProps) {
  
  // --- State & Refs ---
  const router = useRouter();
  
  // FIX: Simplified useState syntax to avoid parser errors
  const { messages: hookMessages, send, setTypingState, hasMore, loadEarlier, loading, error } = useConversation(conversationId, currentUserId, { pageSize: 30 });

  const flatListRef = useRef<FlatList>(null);

  // --- Button Handlers ---
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback to messages screen based on user role
      router.replace('/(patient)/messages');
    }
  };

  const handlePhoneCall = () => {
    Alert.alert(
      'Phone Call',
      `Call ${conversationName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            // In production, use actual phone number from user profile
            const phoneNumber = 'tel:+1234567890';
            Linking.openURL(phoneNumber).catch(() => {
              Alert.alert('Error', 'Unable to make phone call');
            });
          },
        },
      ]
    );
  };

  const handleVideoCall = () => {
    Alert.alert(
      'Video Call',
      `Start video call with ${conversationName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Call',
          onPress: () => {
            // In production, integrate with video call service (Twilio, Agora, etc.)
            Alert.alert('Video Call', 'Video calling feature coming soon!');
          },
        },
      ]
    );
  };

  // --- Effects ---

  useEffect(() => {
    if (hookMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [hookMessages]);

  // subscription handled by hook

  // --- Handlers ---

  const sendPayload = async (payload: { text?: string; attachments?: any[] }) => {
    const text = (payload.text || '').trim();
    if (!text) return;
    try { await send(text); } catch { try { await onSendMessage?.(text); } catch {} }
  };

  const handleRetry = (message: any) => {
    if (!message) return;
    sendPayload({ text: message.text, attachments: message.attachments });
  };

  // --- Renderers ---

  const messages = hookMessages.map(m => {
    const createdAt = m.createdAt as any;
    let timestamp: string;
    if (createdAt?.toDate && typeof createdAt.toDate === 'function') {
      timestamp = createdAt.toDate().toISOString();
    } else if (typeof createdAt === 'string') {
      timestamp = createdAt;
    } else {
      timestamp = new Date().toISOString();
    }

    return {
      id: m.id,
      text: (m as any).text,
      isOwn: m.senderId === currentUserId,
      timestamp,
      type: (m as any).type,
      status: (m as any).status,
      readBy: (m as any).readBy,
    };
  });

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const messageForBubble: any = {
      id: item.id,
      text: item.text,
      senderId: item.isOwn ? (currentUserId || 'me') : 'other',
      createdAt: item.timestamp ? item.timestamp : new Date().toISOString(),
      attachments: (item as any).attachments,
      status: item.status || 'sent',
      type: item.type,
      readBy: item.readBy,
    };

    // Calculate spacing logic (grouping messages close together if from same sender)
    const prevMessage = messages[index - 1];
    const isSameSender = prevMessage && prevMessage.isOwn === item.isOwn;
    const marginTop = isSameSender ? 4 : 16;

    return (
      <View style={[
        styles.messageRow, 
        item.isOwn ? styles.rowOwn : styles.rowOther,
        { marginTop }
      ]}>
        <MessageBubble 
          message={messageForBubble} 
          currentUserId={currentUserId || ''} 
          onRetry={handleRetry} 
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.surface} />
      
      {/* --- Professional Header --- */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} accessibilityLabel="Back" onPress={handleBack}>
            <Feather name="chevron-left" size={28} color={THEME.primary} />
          </TouchableOpacity>
          
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{String(conversationName || 'D').charAt(0)}</Text>
            </View>
            <View style={[styles.statusIndicator, isProviderAvailable ? styles.online : styles.offline]} />
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{conversationName || "Dr. Elara Vance"}</Text>
            <Text style={styles.headerSubtitle}>
              {isTyping ? "Typing..." : isProviderAvailable ? "Active Now" : "Away"}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handlePhoneCall}
            accessibilityLabel="Phone call"
          >
            <Feather name="phone" size={20} color={THEME.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { marginLeft: 8 }]}
            onPress={handleVideoCall}
            accessibilityLabel="Video call"
          >
            <Feather name="video" size={20} color={THEME.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* --- Chat Area --- */}
      <KeyboardAvoidingView 
        style={styles.flex} 
        behavior={Platform.OS === "ios" ? "padding" : undefined} 
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={styles.chatBackground}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(i) => i.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            initialNumToRender={20}
            windowSize={6}
            ListHeaderComponent={hasMore ? (
              <TouchableOpacity style={styles.loadEarlierBtn} onPress={() => loadEarlier()} disabled={loading}>
                <Text style={styles.loadEarlierText}>{loading ? 'Loading…' : 'Load earlier messages'}</Text>
              </TouchableOpacity>
            ) : null}
            ListEmptyComponent={!loading && !error ? (
              <View style={styles.emptyWrap}><Text style={styles.emptyText}>No messages yet</Text></View>
            ) : null}
          />
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>Failed to load messages.</Text>
              <TouchableOpacity onPress={() => loadEarlier()}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
            </View>
          ) : null}
          
          {/* Floating Typing Indicator */}
          {isTyping && (
            <View style={styles.typingContainer}>
              <TypingIndicator />
            </View>
          )}
        </View>

        {/* --- Input Area --- */}
        <View style={styles.inputWrapper}>
            <MessageInput
              onSend={async (payload) => sendPayload(payload as any)}
              onTyping={async (v) => { try { await setTypingState(!!v); } catch {} }}
              onAttach={async (file) => Promise.resolve(file)}
            />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.surface },
  flex: { flex: 1 },
  
  // --- Header Styles ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    zIndex: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  backButton: { marginRight: 8, padding: 4, marginLeft: -8 },
  avatarContainer: { position: 'relative', marginRight: 12 },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: THEME.primary + '20', // 20% opacity
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: THEME.primary },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: THEME.surface,
  },
  online: { backgroundColor: THEME.success },
  offline: { backgroundColor: '#94A3B8' },
  headerInfo: { justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: THEME.textMain },
  headerSubtitle: { fontSize: 12, color: THEME.textSec, marginTop: 1 },
  headerActions: { flexDirection: 'row' },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // --- Chat Area Styles ---
  chatBackground: { flex: 1, backgroundColor: THEME.bg },
  listContent: { paddingHorizontal: 16, paddingVertical: 24, paddingBottom: 40 },
  loadEarlierBtn: { alignSelf: 'center', marginBottom: 12, backgroundColor: THEME.surface, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: THEME.border },
  loadEarlierText: { fontSize: 12, color: THEME.primary, fontWeight: '600' },
  emptyWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { color: THEME.textSec },
  errorBanner: { position: 'absolute', top: 4, left: 16, right: 16, backgroundColor: '#fee2e2', padding: 10, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorText: { color: '#b91c1c', fontSize: 12, fontWeight: '600' },
  retryText: { color: THEME.primary, fontSize: 12, fontWeight: '700' },
  
  messageRow: { flexDirection: 'row', width: '100%', alignItems: 'flex-end' },
  rowOwn: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },

  // --- Typing Indicator ---
  typingContainer: {
    position: 'absolute',
    bottom: 10,
    left: 20,
    backgroundColor: THEME.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // --- Input Styles ---
  inputWrapper: {
    backgroundColor: THEME.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    paddingBottom: Platform.OS === 'ios' ? 0 : 0,
  },
});