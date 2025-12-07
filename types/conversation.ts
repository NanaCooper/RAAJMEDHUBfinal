import { Timestamp } from 'firebase/firestore';

export interface Conversation {
  id?: string;
  participants: string[]; // user ids
  title?: string; // display title (e.g., doctor's name or group name)
  createdAt?: Timestamp | string;
  lastMessage?: string;
  lastUpdated?: Timestamp | string;
  unreadCount?: number; // legacy single value (optional)
  unread?: Record<string, number>; // per-user unread counts
  typing?: Record<string, any>; // map of userId -> timestamp
  lastMessageSenderId?: string;
  lastMessageType?: string; // 'text' | 'system'
}
