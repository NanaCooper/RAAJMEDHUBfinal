import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { subscribeToConversations, getConversationsForUser } from '../services/conversations';
import { subscribeToConversation, sendMessage, markConversationRead, paginateMessages, setTyping } from '../services/messages';
import { doc, getDoc, db } from '../utils/firebaseConfig';
import type { Conversation } from '../types/conversation';
import type { Message } from '../types/message';

interface UseConversationsResult {
	conversations: Conversation[];
	loading: boolean;
	error?: any;
	refresh: () => Promise<void>;
}

// Cache for user profiles (name lookup)
const nameCache: Record<string, string> = {};

async function fetchUserName(userId: string): Promise<string> {
	if (nameCache[userId]) return nameCache[userId];
	try {
		const snap = await getDoc(doc(db, 'users', userId));
		if (snap.exists()) {
			const data: any = snap.data();
			const name = data.name || data.fullName || data.email || userId;
			nameCache[userId] = name;
			return name;
		}
	} catch {}
	return userId;
}

export function useConversations(currentUserId?: string): UseConversationsResult {
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<any>();

	const hydrateTitles = useCallback(async (items: Conversation[]) => {
		const updated: Conversation[] = [];
		for (const c of items) {
			if (!c.title && currentUserId && Array.isArray(c.participants)) {
				const other = c.participants.find(p => p !== currentUserId);
				if (other) {
					const nm = await fetchUserName(other);
					updated.push({ ...c, title: nm });
					continue;
				}
			}
			updated.push(c);
		}
		return updated;
	}, [currentUserId]);

	const refresh = useCallback(async () => {
		if (!currentUserId) return;
		setLoading(true);
		try {
			const list = await getConversationsForUser(currentUserId);
			const hydrated = await hydrateTitles(list);
			setConversations(hydrated);
			setError(undefined);
		} catch (e) {
			setError(e);
		} finally {
			setLoading(false);
		}
	}, [currentUserId, hydrateTitles]);

	useEffect(() => {
		if (!currentUserId) return;
		setLoading(true);
		const unsub = subscribeToConversations(currentUserId, async (items) => {
			try {
				const hydrated = await hydrateTitles(items);
				setConversations(hydrated);
			} catch {}
			setLoading(false);
		});
		return () => { try { unsub(); } catch {} };
	}, [currentUserId, hydrateTitles]);

	return { conversations, loading, error, refresh };
}

interface UseConversationOptions {
	pageSize?: number;
}
interface UseConversationResult {
	messages: Message[];
	loading: boolean;
	sending: boolean;
	error?: any;
	send: (text: string) => Promise<void>;
	loadEarlier: () => Promise<void>;
	hasMore: boolean;
	markRead: () => Promise<void>;
	typing: boolean;
	setTypingState: (is: boolean) => Promise<void>;
}

export function useConversation(conversationId?: string, currentUserId?: string, opts: UseConversationOptions = {}): UseConversationResult {
	const pageSize = opts.pageSize || 30;
	const [messages, setMessages] = useState<Message[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [sending, setSending] = useState<boolean>(false);
	const [error, setError] = useState<any>();
	const [hasMore, setHasMore] = useState<boolean>(false);
	const lastDocRef = useRef<any>(null);
	const [typing, setTypingLocal] = useState<boolean>(false);
	const typingTimeout = useRef<any>(null);

	// Real-time subscription
	useEffect(() => {
		if (!conversationId || !currentUserId) return;
		setLoading(true);
		const unsub = subscribeToConversation(conversationId, currentUserId, (items) => {
			setMessages(items);
			setLoading(false);
		});
		return () => { try { unsub(); } catch {} };
	}, [conversationId, currentUserId]);

	// Initial pagination load (fetch latest batch to determine hasMore)
	useEffect(() => {
		(async () => {
			if (!conversationId || !currentUserId) return;
			try {
				const page = await paginateMessages(conversationId, currentUserId, pageSize);
				lastDocRef.current = page.lastDoc;
				setHasMore(page.hasMore);
				// Merge with any existing real-time messages (avoid duplicates)
				setMessages(prev => {
					const ids = new Set(prev.map(m => m.id));
						const merged = [...page.messages.filter(m => !ids.has(m.id)), ...prev];
						return merged.sort((a: any, b: any) => {
							const av = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime());
							const bv = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime());
							return av - bv;
						});
				});
			} catch (e) {
				setError(e);
			}
		})();
	}, [conversationId, currentUserId, pageSize]);

	const loadEarlier = useCallback(async () => {
		if (!conversationId || !currentUserId || !hasMore || !lastDocRef.current) return;
		try {
			const page = await paginateMessages(conversationId, currentUserId, pageSize, lastDocRef.current);
			lastDocRef.current = page.lastDoc;
			setHasMore(page.hasMore);
			setMessages(prev => [...page.messages, ...prev]);
		} catch (e) {
			setError(e);
		}
	}, [conversationId, currentUserId, hasMore, pageSize]);

	const send = useCallback(async (text: string) => {
		const trimmed = text.trim();
		if (!trimmed || !conversationId || !currentUserId) return;
		setSending(true);
		const tempId = `tmp-${Date.now()}`;
		const optimistic: Message = {
			id: tempId,
			text: trimmed,
			senderId: currentUserId,
			status: 'sending',
			type: 'text',
			createdAt: new Date().toISOString(),
			readBy: [currentUserId],
		} as any;
		setMessages(prev => [...prev, optimistic]);
		try {
			await sendMessage(conversationId, {
				conversationId,
				senderId: currentUserId,
				text: trimmed,
				type: 'text',
			} as any);
		} catch (e) {
			setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
			setError(e);
		} finally {
			setSending(false);
		}
	}, [conversationId, currentUserId]);

	const markRead = useCallback(async () => {
		if (!conversationId || !currentUserId) return;
		try { await markConversationRead(conversationId, currentUserId); } catch (e) { setError(e); }
	}, [conversationId, currentUserId]);

	// Auto mark read when messages change
	useEffect(() => {
		if (!conversationId || !currentUserId) return;
		if (messages.length === 0) return;
		const unread = messages.some(m => m.senderId !== currentUserId && !(m.readBy || []).includes(currentUserId));
		if (unread) markRead();
	}, [messages, markRead, conversationId, currentUserId]);

	const setTypingState = useCallback(async (is: boolean) => {
		if (!conversationId || !currentUserId) return;
		setTypingLocal(is);
		if (typingTimeout.current) clearTimeout(typingTimeout.current);
		try { await setTyping(conversationId, currentUserId, is); } catch {}
		if (is) {
			typingTimeout.current = setTimeout(() => {
				setTypingLocal(false);
				setTyping(conversationId, currentUserId, false).catch(()=>{});
			}, 4000);
		}
	}, [conversationId, currentUserId]);

	return { messages, loading, sending, error, send, loadEarlier, hasMore, markRead, typing, setTypingState };
}

