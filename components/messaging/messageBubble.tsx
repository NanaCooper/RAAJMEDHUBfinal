import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Message } from '../../types/message';

function MessageBubble({
  message,
  currentUserId,
  onRetry,
}: {
  message: Message;
  currentUserId: string;
  onRetry?: (m: Message) => void;
}) {
  const isOwn = message.senderId === currentUserId;
  const isSystem = message.type === 'system';
  const ts: any = (message as any).createdAt;
  let time = '';
  if (ts && typeof ts === 'object' && typeof ts.toDate === 'function') {
    time = ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (typeof ts === 'string') {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    else time = ts;
  }
  const [viewer, setViewer] = useState<{ uri: string } | null>(null);

  const status = message.status;
  const readBy: string[] = (message as any).readBy || [];
  const othersHaveRead = isOwn && readBy.some(u => u !== currentUserId);

  const firstImage = message.attachments && message.attachments.length ? message.attachments.find(a => (a.type || '').startsWith('image') || a.url?.match(/\.(jpg|jpeg|png|webp)$/i)) : null;

  if (isSystem) {
    return (
      <View style={styles.systemWrap}>
        {message.text ? <Text style={styles.systemText}>{message.text}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.bubble, isOwn ? styles.right : styles.left]}>
      {firstImage ? (
        <TouchableOpacity onPress={() => setViewer({ uri: firstImage!.url })} activeOpacity={0.9}>
          <Image source={{ uri: firstImage!.url }} style={styles.image} resizeMode="cover" />
        </TouchableOpacity>
      ) : null}

      {message.text ? <Text style={[styles.text, isOwn ? styles.textRight : styles.textLeft]}>{message.text}</Text> : null}

      <View style={styles.metaRow}>
        <Text style={styles.time}>{time}</Text>
        {isOwn && status === 'sending' ? <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 8 }} /> : null}
        {isOwn && status === 'failed' ? (
          <TouchableOpacity onPress={() => onRetry && onRetry(message)} accessibilityRole="button" style={{ marginLeft: 8 }}>
            <MaterialCommunityIcons name="refresh" size={16} color="#ffdddd" />
          </TouchableOpacity>
        ) : null}
        {isOwn && status !== 'failed' && status !== 'sending' ? (
          <MaterialCommunityIcons
            name={othersHaveRead ? 'check-all' : 'check'}
            size={14}
            color={othersHaveRead ? '#c7f9cc' : '#fff'}
            style={{ marginLeft: 6 }}
          />
        ) : null}
      </View>

      <Modal visible={!!viewer} transparent onRequestClose={() => setViewer(null)}>
        <View style={styles.modalWrap}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setViewer(null)} />
          {viewer ? <Image source={{ uri: viewer.uri }} style={styles.fullImage} resizeMode="contain" /> : null}
        </View>
      </Modal>
    </View>
  );
}

const bubbleEqual = (prev: any, next: any) => {
  return prev.message.id === next.message.id &&
    prev.message.status === next.message.status &&
    prev.message.text === next.message.text &&
    (prev.message.readBy || []).length === (next.message.readBy || []).length;
};

export default React.memo(MessageBubble, bubbleEqual);

const styles = StyleSheet.create({
  bubble: { padding: 10, borderRadius: 12, marginVertical: 6, maxWidth: '80%' },
  left: { backgroundColor: '#f1f1f1', alignSelf: 'flex-start' },
  right: { backgroundColor: '#0b6efd', alignSelf: 'flex-end' },
  text: { fontSize: 15 },
  textRight: { color: '#fff' },
  textLeft: { color: '#111' },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 6 },
  time: { fontSize: 10, color: '#666' },
  retry: { fontSize: 12, color: '#ffdddd', marginLeft: 8, textDecorationLine: 'underline' },
  image: { width: 160, height: 120, borderRadius: 8, marginBottom: 6 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '80%' },
  modalClose: { position: 'absolute', top: 24, right: 24, width: 44, height: 44 },
  systemWrap: { alignSelf: 'center', backgroundColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginVertical: 8 },
  systemText: { fontSize: 12, color: '#334155', fontStyle: 'italic' },
});
