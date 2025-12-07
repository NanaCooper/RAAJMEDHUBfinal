import React, { useState, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { doc, getDoc, db, onSnapshot } from "../../utils/firebaseConfig";
import * as ChatScreenModule from "../../components/messaging/ChatScreen";
// Support both CommonJS and ES module default interop in runtime bundlers
const ChatScreen: any = (ChatScreenModule as any)?.default ?? ChatScreenModule;

export default function PatientConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { session } = useAuth();
  const currentUserId = session?.uid;
  const [conversationName, setConversationName] = useState<string>("Loading...");
  const [isTyping, setIsTyping] = useState(false);

  // Fetch conversation title and monitor typing state from Firestore
  useEffect(() => {
    if (!conversationId || !currentUserId) return;
    
    const convRef = doc(db, 'conversations', conversationId as string);
    const unsub = onSnapshot(convRef, async (snap: any) => {
      if (!snap.exists()) return;
      const data: any = snap.data();
      
      // Set conversation title
      if (data.title) {
        setConversationName(data.title);
      } else if (data.participants && Array.isArray(data.participants)) {
        // Find other participant and fetch their name
        const otherId = data.participants.find((p: string) => p !== currentUserId);
        if (otherId) {
          try {
            const userSnap = await getDoc(doc(db, 'users', otherId));
            if (userSnap.exists()) {
              const userData: any = userSnap.data();
              setConversationName(userData.name || userData.fullName || userData.email || 'User');
            }
          } catch {}
        }
      }
      
      // Check typing state
      if (data.typing) {
        const typingUsers = Object.entries(data.typing)
          .filter(([uid, ts]: [string, any]) => {
            if (uid === currentUserId) return false;
            if (!ts) return false;
            // Consider typing active if timestamp is within last 5 seconds
            const now = Date.now();
            const tsMillis = ts?.toMillis ? ts.toMillis() : (ts?.seconds ? ts.seconds * 1000 : 0);
            return (now - tsMillis) < 5000;
          });
        setIsTyping(typingUsers.length > 0);
      } else {
        setIsTyping(false);
      }
    });
    
    return () => unsub();
  }, [conversationId, currentUserId]);

  return (
    <ChatScreen
      conversationId={conversationId as string || ""}
      conversationName={conversationName}
      currentUserId={currentUserId}
      currentUserName={session?.email || "You"}
      isOnline={true}
      isTyping={isTyping}
    />
  );
}