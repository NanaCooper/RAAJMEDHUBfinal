import { db, collection, query, where, orderBy, onSnapshot, getDocs, doc, getDoc, auth, getAuthInstance } from '../utils/firebaseConfig';
import type { Conversation } from '../types/conversation';

export async function getConversationsForUser(userId: string) {
  try {
    const conversationsCol = collection(db, 'conversations');
    const q = query(conversationsCol, where('participants', 'array-contains', userId), orderBy('lastUpdated', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) } as Conversation));
  } catch (err) {
    console.error('getConversationsForUser error', err);
    throw err;
  }
}

export function subscribeToConversations(userId: string, cb: (conversations: Conversation[]) => void) {
  console.log('[DEBUG] subscribeToConversations invoked. Requested userId:', userId);
  let cancelled = false;
  let liveUnsub: any = () => {};

  // Defer subscription until auth is fully ready to avoid request.auth == null
  getAuthInstance().then((authInstance: any) => {
    if (cancelled) return;
    const authUid = authInstance?.currentUser?.uid;
    console.log('[DEBUG] Auth ready. auth.currentUser?.uid:', authUid);
    if (!authUid) {
      console.warn('[WARN] No authenticated user yet. Skipping conversations subscription.');
      cb([]);
      return;
    }
    if (authUid !== userId) {
      console.warn('[WARN] Mismatch between provided userId and auth.currentUser.uid', { provided: userId, authUid });
    }

    const conversationsCol = collection(db, 'conversations');
    const qPrimary = query(conversationsCol, where('participants', 'array-contains', userId), orderBy('lastUpdated', 'desc'));
    liveUnsub = onSnapshot(qPrimary, (snap: any) => {
      console.log('[DEBUG] Conversations primary snapshot docs:', snap.docs.length);
      const items = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) } as Conversation));
      cb(items);
    }, async (error: any) => {
      console.error('[ERROR] Primary conversations query failed:', error.code, error.message);
      // Fallback without orderBy
      try {
        const qFallback = query(conversationsCol, where('participants', 'array-contains', userId));
        const snapFb = await getDocs(qFallback);
        console.log('[DEBUG] Fallback conversations doc count:', snapFb.docs.length);
        const items = snapFb.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) } as Conversation));
        cb(items);
      } catch (fbErr: any) {
        console.error('[ERROR] Fallback conversations query also failed:', fbErr.code, fbErr.message);
        cb([]);
      }
    });
  });

  return () => {
    cancelled = true;
    try { liveUnsub(); } catch {}
  };
}

// DEBUG helper: fetch a single conversation by id and log field presence
export async function debugFetchConversation(conversationId: string, currentUserId: string) {
  console.log('[DEBUG] debugFetchConversation start', { conversationId, currentUserId });
  try {
    const ref = doc(db, 'conversations', conversationId);
    const snap = await getDoc(ref);
    console.log('[DEBUG] exists:', snap.exists());
    if (!snap.exists()) return null;
    const data: any = snap.data();
    console.log('[DEBUG] raw data:', JSON.stringify(data, null, 2));
    console.log('[DEBUG] participants type:', Array.isArray(data.participants) ? 'array' : typeof data.participants);
    console.log('[DEBUG] participants value:', data.participants);
    console.log('[DEBUG] lastUpdated field present:', 'lastUpdated' in data, 'value:', data.lastUpdated);
    console.log('[DEBUG] contains currentUserId:', Array.isArray(data.participants) ? data.participants.includes(currentUserId) : (currentUserId in (data.participants || {})));
    return { id: snap.id, ...data } as Conversation;
  } catch (e: any) {
    console.error('[ERROR] debugFetchConversation failed', e.code, e.message);
    throw e;
  }
}

// Find a conversation between two users, or create one if it doesn't exist.
export async function findOrCreateConversation(patientId: string, doctorId: string): Promise<Conversation> {
  console.log(`[DEBUG] findOrCreateConversation called for patient: ${patientId}, doctor: ${doctorId}`);
  try {
    const conversationsCol = collection(db, 'conversations');
    
    // Query for an existing conversation with these exact two participants
    const q = query(
      conversationsCol,
      where('participants', 'array-contains', doctorId)
    );

    const snap = await getDocs(q);
    
    // Filter the results locally to find the exact match
    const existingDoc = snap.docs.find(doc => {
      const data = doc.data();
      const participants = data.participants || [];
      return participants.length === 2 && participants.includes(patientId) && participants.includes(doctorId);
    });


    if (existingDoc) {
      // Conversation already exists
      console.log(`[DEBUG] Found existing conversation: ${existingDoc.id}`);
      return { id: existingDoc.id, ...existingDoc.data() } as Conversation;
    } else {
      // No existing conversation, so create a new one
      console.log('[DEBUG] No existing conversation found. Creating a new one...');
      const { serverTimestamp, addDoc, Timestamp } = await import('firebase/firestore');
      
      const newConversationData = {
        participants: [patientId, doctorId],
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        lastMessage: 'Consultation started.',
        lastMessageSenderId: 'system',
        lastMessageType: 'system',
        unread: {
          [patientId]: 0,
          [doctorId]: 1, // Notify the doctor
        },
        typing: {},
      };

      const docRef = await addDoc(conversationsCol, newConversationData);
      console.log(`[DEBUG] Created new conversation with ID: ${docRef.id}`);
      
      // To satisfy the return type for the caller, we create a temporary object.
      // The actual server-generated timestamps will be synced via real-time listeners in the UI.
      const now = Timestamp.now();
      const createdConversation: Conversation = {
        id: docRef.id,
        participants: newConversationData.participants,
        lastMessage: newConversationData.lastMessage,
        lastMessageSenderId: newConversationData.lastMessageSenderId,
        lastMessageType: newConversationData.lastMessageType,
        unread: newConversationData.unread,
        typing: newConversationData.typing,
        createdAt: now,
        lastUpdated: now,
      };
      return createdConversation;
    }
  } catch (err: any) {
    console.error('[ERROR] ========== findOrCreateConversation FAILED ==========');
    console.error('[ERROR] Error code:', err.code);
    console.error('[ERROR] Error message:', err.message);
    console.error(`[ERROR] patientId: ${patientId}, doctorId: ${doctorId}`);
    console.error('[ERROR] Full error:', JSON.stringify(err, null, 2));
    console.error('[ERROR] =================================================');
    throw err;
  }
}
