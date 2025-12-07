import React, { useMemo } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import type { Conversation } from '../../types/conversation';

interface Props {
	conversation: Conversation;
	currentUserId?: string;
	onPress?: () => void;
}

function formatTime(ts: any): string {
	if (!ts) return '';
	try {
		if (ts.toDate) return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		const d = new Date(ts);
		if (!isNaN(d.getTime())) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	} catch {}
	return '';
}

function ConversationItem({ conversation, currentUserId, onPress }: Props) {
	const title = conversation.title ?? 'Conversation';
	const last = conversation.lastMessage ?? '';
	const time = formatTime(conversation.lastUpdated);
	const unread = useMemo(() => {
		if (conversation.unread && currentUserId) return conversation.unread[currentUserId] || 0;
		return conversation.unreadCount || 0;
	}, [conversation.unread, conversation.unreadCount, currentUserId]);
	const otherTyping = useMemo(() => {
		if (!conversation.typing || !currentUserId) return false;
		return Object.keys(conversation.typing).some(k => k !== currentUserId);
	}, [conversation.typing, currentUserId]);

	return (
		<TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={onPress}>
			<View style={styles.left}>
				<View style={[styles.avatar, otherTyping && styles.avatarTyping]}>
					<Text style={styles.avatarText}>{title.charAt(0)}</Text>
				</View>
				{otherTyping && <View style={styles.typingDot} />}
			</View>

			<View style={styles.middle}>
				<Text style={[styles.title, unread > 0 && styles.titleUnread]} numberOfLines={1}>{title}</Text>
				<Text style={styles.last} numberOfLines={1}>{otherTyping ? 'Typing…' : last}</Text>
			</View>

			<View style={styles.right}>
				<Text style={styles.time}>{time}</Text>
				{unread > 0 ? (
					<View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View>
				) : null}
			</View>
		</TouchableOpacity>
	);
}

const areEqual = (prev: Props, next: Props) => {
	return prev.conversation.id === next.conversation.id &&
		prev.conversation.lastMessage === next.conversation.lastMessage &&
		prev.conversation.lastUpdated === next.conversation.lastUpdated &&
		prev.conversation.unread === next.conversation.unread &&
		prev.currentUserId === next.currentUserId;
};

export default React.memo(ConversationItem, areEqual);

const styles = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomColor: '#f4f4f4', borderBottomWidth: 1 },
	left: { width: 56, alignItems: 'center' },
	avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f6ff', alignItems: 'center', justifyContent: 'center' },
	avatarTyping: { backgroundColor: '#eef2ff' },
	typingDot: { position: 'absolute', bottom: -2, right: 4, width: 10, height: 10, borderRadius: 5, backgroundColor: '#4f46e5', borderWidth: 2, borderColor: '#fff' },
	avatarText: { color: '#0b6efd', fontWeight: '700' },
	middle: { flex: 1, paddingHorizontal: 8 },
	title: { fontWeight: '700' },
	titleUnread: { fontWeight: '800', color: '#0f1724' },
	last: { color: '#666', marginTop: 4 },
	right: { width: 72, alignItems: 'flex-end' },
	time: { color: '#999', fontSize: 12 },
	badge: { marginTop: 6, backgroundColor: '#e23b3b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
	badgeText: { color: '#fff', fontWeight: '700' },
});
