import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { debugFetchConversation } from '../../services/conversations';
import { useAuth } from '../../hooks/useAuth';

export default function DebugConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { user } = useAuth();
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    async function run() {
      if (!conversationId) {
        setError('Missing conversationId param');
        return;
      }
      if (!user?.uid) {
        setError('Not signed in - cannot test rules');
        return;
      }
      try {
        const conv = await debugFetchConversation(conversationId as string, user.uid);
        if (!conv) {
          setOutput('Conversation does not exist or not readable');
          return;
        }
        const lines: string[] = [];
        lines.push('Conversation ID: ' + conv.id);
        lines.push('Participants raw: ' + JSON.stringify(conv.participants));
        lines.push('lastUpdated: ' + JSON.stringify(conv.lastUpdated));
        lines.push('Keys: ' + Object.keys(conv).join(', '));
        setOutput(lines.join('\n'));
      } catch (e: any) {
        setError('Fetch failed: ' + e.code + ' ' + e.message);
      }
    }
    run();
  }, [conversationId, user?.uid]);

  return (
    <ScrollView style={{ flex: 1, padding: 16, backgroundColor: '#111' }}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12 }}>Debug Conversation</Text>
      <Text style={{ color: '#bbb', marginBottom: 8 }}>Param conversationId: {conversationId || 'N/A'}</Text>
      <Text style={{ color: '#bbb', marginBottom: 8 }}>Current user: {user?.uid || 'N/A'}</Text>
      {error ? (
        <Text style={{ color: '#ff6b6b', marginTop: 12 }}>Error: {error}</Text>
      ) : (
        <Text style={{ color: '#4ade80', whiteSpace: 'pre-wrap' }}>{output}</Text>
      )}
      <Text style={{ color: '#999', marginTop: 24, fontSize: 12 }}>
        This screen performs a direct getDoc() on the conversation to differentiate a query-denied vs. doc read rule issue.
      </Text>
    </ScrollView>
  );
}