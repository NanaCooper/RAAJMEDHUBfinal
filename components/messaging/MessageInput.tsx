import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function MessageInput({ onSend, onTyping, onAttach }: { onSend: (payload: { text?: string; attachments?: any[] }) => void | Promise<void>; onTyping?: (isTyping: boolean) => void; onAttach?: (file: any) => Promise<any> }) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const typingRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (typingRef.current) clearTimeout(typingRef.current);
    };
  }, []);

  const handleChange = (t: string) => {
    setText(t);
    if (onTyping) {
      onTyping(true);
      if (typingRef.current) clearTimeout(typingRef.current);
      typingRef.current = setTimeout(() => onTyping(false), 1400);
    }
  };

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    const payload = { text: trimmed || undefined, attachments: attachments.length ? attachments : undefined };
    Promise.resolve(onSend(payload)).catch(() => null);
    setText('');
    setAttachments([]);
    if (onTyping) onTyping(false);
  };

  const pickImage = async () => {
    // Use new ImagePicker.MediaType when available (avoids deprecation warning),
    // otherwise fall back to the older MediaTypeOptions for compatibility.
    const mediaTypesOption = (ImagePicker as any).MediaType?.Images ?? ImagePicker.MediaTypeOptions.Images;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: mediaTypesOption, allowsEditing: false, quality: 0.8 });
    // modern ImagePicker returns { canceled, assets }
    // @ts-ignore
    if (res.canceled) return;
    // @ts-ignore
    const asset = (res.assets && res.assets[0]) || res;
    const file = { uri: asset.uri, name: asset.fileName || `image-${Date.now()}.jpg`, type: asset.type || 'image/jpeg' };
    // show local preview while optionally uploading via onAttach
    setAttachments(a => [...a, file]);
    if (onAttach) {
      try {
        const uploaded = await onAttach(file);
        // if upload returns an object with a url, replace local item
        if (uploaded && uploaded.url) {
          setAttachments(a => a.map(x => (x === file ? uploaded : x)));
        }
      } catch {
        // ignore upload error for now; user can retry later
      }
    }
  };

  const removeAttachment = (index: number) => setAttachments(a => a.filter((_, i) => i !== index));

  return (
    <View style={styles.container}>
      {attachments.length ? (
        <ScrollView horizontal style={styles.attachRow} contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 10 }}>
          {attachments.map((att, i) => (
            <View key={i.toString()} style={styles.attachment}>
              <Image source={{ uri: att.url || att.uri }} style={styles.thumb} />
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeAttachment(i)} accessibilityRole="button">
                <MaterialCommunityIcons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.row}>
        <TouchableOpacity onPress={pickImage} style={{ marginRight: 8 }} accessibilityRole="button">
          <MaterialCommunityIcons name="paperclip" size={22} color="#333" />
        </TouchableOpacity>
        <TextInput value={text} onChangeText={handleChange} placeholder="Type a message" style={styles.input} multiline />
        <TouchableOpacity onPress={send} style={styles.sendBtn} accessibilityRole="button">
          <MaterialCommunityIcons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, borderColor: '#eee' },
  attachRow: { maxHeight: 140, paddingVertical: 8 },
  attachment: { width: 100, height: 100, marginRight: 8, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#fff', fontSize: 12 },
  row: { flexDirection: 'row', padding: 10, alignItems: 'center' },
  input: { flex: 1, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: '#eee', paddingHorizontal: 10, backgroundColor: '#fafafa' },
  sendBtn: { marginLeft: 8, backgroundColor: '#0b6efd', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  sendText: { color: '#fff', fontWeight: '700' },
});
