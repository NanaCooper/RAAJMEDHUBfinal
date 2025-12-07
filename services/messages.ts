import { db, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, getDocs, updateDoc, doc, arrayUnion, deleteField, getDoc, increment } from '../utils/firebaseConfig';
import type { Message } from '../types/message';

// Send a message with optimistic status; also updates parent conversation document
export async function sendMessage(conversationId: string, message: Omit<Message, 'id' | 'createdAt' | 'status'>) {
  console.log('[DEBUG] sendMessage called');
  console.log('[DEBUG] conversationId:', conversationId);
  console.log('[DEBUG] senderId:', message.senderId);
  console.log('[DEBUG] message text:', message.text);
  try {
    const messagesCol = collection(db, 'conversations', conversationId, 'messages');
    const convRef = doc(db, 'conversations', conversationId);
    
    // --- FETCH PARTICIPANTS ---
    let participants: string[] = [];
    try {
      console.log('[DEBUG] Fetching conversation document to get participants...');
      const snap = await getDoc(convRef);
      if (snap.exists()) {
        const data: any = snap.data();
        participants = Array.isArray(data.participants) ? data.participants : [];
        console.log('[DEBUG] Found participants:', participants);
      } else {
        console.error('[ERROR] Conversation document does not exist! Cannot denormalize participants.');
        // Fallback or throw error if participants are critical for rules
        throw new Error(`Conversation with ID ${conversationId} not found.`);
      }
    } catch (e) {
      console.error('[ERROR] Failed to fetch conversation for participant denormalization:', e);
      throw e; // Re-throw to prevent sending a message that will be unreadable
    }
    // --- END FETCH ---

    const payload = {
      ...message,
      status: 'sent',
      type: message.type || 'text',
      createdAt: serverTimestamp(),
      readBy: [message.senderId],
      conversationParticipants: participants, // Denormalize participants for security rules
    } as any;
    console.log('[DEBUG] Creating message with payload:', JSON.stringify(payload, null, 2));
    const ref = await addDoc(messagesCol, payload);
    console.log('[DEBUG] Message created successfully with ID:', ref.id);

    // Update conversation meta (unread counts, last message)
    try {
      const senderId = message.senderId;
      const others = participants.filter(p => p !== senderId);
      const unreadUpdates: Record<string, any> = {};
      others.forEach(o => { unreadUpdates[`unread.${o}`] = increment(1); });
      unreadUpdates[`unread.${senderId}`] = 0; // reset sender's unread
      await updateDoc(convRef, {
        lastMessage: message.text || '',
        lastMessageSenderId: senderId,
        lastMessageType: message.type || 'text',
        lastUpdated: serverTimestamp(),
        ...unreadUpdates,
      });
    } catch (e) {
      console.warn('Failed to update conversation meta', e);
    }

    return { id: ref.id, ...payload } as Message;
  } catch (err: any) {
    console.error('[ERROR] ========== sendMessage FAILED ==========');
    console.error('[ERROR] Error code:', err.code);
    console.error('[ERROR] Error message:', err.message);
    console.error('[ERROR] conversationId:', conversationId);
    console.error('[ERROR] senderId:', message.senderId);
    console.error('[ERROR] Full error:', JSON.stringify(err, null, 2));
    console.error('[ERROR] ======================================');
    throw err;
  }
}

export function subscribeToConversation(conversationId: string, userId: string, cb: (messages: Message[]) => void) {
  const messagesCol = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesCol, where('conversationParticipants', 'array-contains', userId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap: any) => {
    const items = snap.docs.map((d: any) => {
      const data = d.data() as any;
      return {
        id: d.id,
        ...data,
        status: data.status || 'sent',
        type: data.type || 'text',
        readBy: data.readBy || [],
      } as Message;
    });
    cb(items);
  });
}

export async function getConversationMessages(conversationId: string) {
  try {
    const messagesCol = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesCol, orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d: any) => {
      const data = d.data() as any;
      return {
        id: d.id,
        ...data,
        status: data.status || 'sent',
        type: data.type || 'text',
        readBy: data.readBy || [],
      } as Message;
    });
  } catch (err) {
    console.error('getConversationMessages error', err);
    throw err;
  }
}

// Mark all unread messages in a conversation as read by userId
export async function markConversationRead(conversationId: string, userId: string) {
  try {
    const messagesCol = collection(db, 'conversations', conversationId, 'messages');
    const snap = await getDocs(messagesCol);
    const updates: Promise<void>[] = [];
    snap.docs.forEach((d: any) => {
      const data = d.data() as any;
      const readBy: string[] = data.readBy || [];
      if (!readBy.includes(userId) && data.senderId !== userId) {
        const ref = doc(db, 'conversations', conversationId, 'messages', d.id);
        updates.push(updateDoc(ref, { readBy: arrayUnion(userId) }) as unknown as Promise<void>);
      }
    });
    // Reset unread counter on conversation doc
    const convRef = doc(db, 'conversations', conversationId);
    updates.push(updateDoc(convRef, { [`unread.${userId}`]: 0 }) as unknown as Promise<void>);
    await Promise.all(updates);
  } catch (err) {
    console.error('markConversationRead error', err);
    throw err;
  }
}

// Set or clear typing indicator on the conversation document (typing map: { [userId]: timestamp })
export async function setTyping(conversationId: string, userId: string, isTyping: boolean) {
  console.log('[DEBUG] setTyping called - conversationId:', conversationId, 'userId:', userId, 'isTyping:', isTyping);
  try {
    const convRef = doc(db, 'conversations', conversationId);
    if (isTyping) {
      console.log('[DEBUG] Setting typing indicator...');
      await updateDoc(convRef, { [`typing.${userId}`]: serverTimestamp() });
      console.log('[DEBUG] Typing indicator set successfully');
    } else {
      console.log('[DEBUG] Removing typing indicator...');
      await updateDoc(convRef, { [`typing.${userId}`]: deleteField() });
      console.log('[DEBUG] Typing indicator removed successfully');
    }
  } catch (err: any) {
    console.error('[ERROR] ========== setTyping FAILED ==========');
    console.error('[ERROR] Error code:', err.code);
    console.error('[ERROR] Error message:', err.message);
    console.error('[ERROR] conversationId:', conversationId);
    console.error('[ERROR] userId:', userId);
    console.error('[ERROR] isTyping:', isTyping);
    console.error('[ERROR] Full error:', JSON.stringify(err, null, 2));
    console.error('[ERROR] ====================================');
    throw err;
  }
}

// Pagination support: load older messages (descending -> reverse for display)
export async function paginateMessages(conversationId: string, userId: string, pageSize: number, startAfterDoc?: any) {
  console.log('[DEBUG] paginateMessages called - conversationId:', conversationId, 'userId:', userId, 'pageSize:', pageSize);
  try {
    let qBase = query(
      collection(db, 'conversations', conversationId, 'messages'),
      where('conversationParticipants', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );
    if (startAfterDoc) {
      const firestore: any = await import('firebase/firestore');
      qBase = firestore.query(qBase, firestore.startAfter(startAfterDoc));
    }
    const firestore: any = await import('firebase/firestore');
    const limited = firestore.query(qBase, firestore.limit(pageSize));
    console.log('[DEBUG] Executing paginated query...');
    const snap = await getDocs(limited);
    const docs = snap.docs;
    console.log('[DEBUG] Retrieved', docs.length, 'messages');
    const items = docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as Message[];
    return { messages: items.reverse(), lastDoc: docs[docs.length - 1], hasMore: docs.length === pageSize };
  } catch (err: any) {
    console.error('[ERROR] ========== paginateMessages FAILED ==========');
    console.error('[ERROR] Error code:', err.code);
    console.error('[ERROR] Error message:', err.message);
    console.error('[ERROR] conversationId:', conversationId);
    console.error('[ERROR] Full error:', JSON.stringify(err, null, 2));
    console.error('[ERROR] =======================================');
    throw err;
  }
}
