import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Interaction = {
  id: string;
  inputText: string;
  inputMode: string;
  detectedIntent?: string | null;
  actionTaken?: string | null;
  createdAt: string;
};

type Props = {
  apiBaseUrl: string;
  limit?: number;
  language?: 'fr' | 'en';
};

const INTENT_LABELS: Record<string, { fr: string; en: string }> = {
  create_task: { fr: 'Créer une tâche', en: 'Create task' },
  create_event: { fr: 'Créer un événement', en: 'Create event' },
  modify_task: { fr: 'Modifier une tâche', en: 'Modify task' },
  modify_event: { fr: 'Modifier un événement', en: 'Modify event' },
  delete_task: { fr: 'Supprimer une tâche', en: 'Delete task' },
  delete_event: { fr: 'Supprimer un événement', en: 'Delete event' },
  summarize_period: { fr: 'Résumé', en: 'Summary' },
  greeting: { fr: 'Salutation', en: 'Greeting' },
  farewell: { fr: 'Au revoir', en: 'Farewell' },
  thanks: { fr: 'Remerciement', en: 'Thanks' },
  small_talk: { fr: 'Conversation', en: 'Small talk' },
  capabilities: { fr: 'Capacités', en: 'Capabilities' },
  unrecognized: { fr: 'Non reconnu', en: 'Unrecognized' },
};

export default function InteractionHistory({ apiBaseUrl, limit = 30, language = 'fr' }: Props) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/assistant/interactions?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to load interaction history');
      const data = await response.json();
      setInteractions(Array.isArray(data) ? data : []);
    } catch {
      setError(language === 'en' ? 'Unable to load history.' : "Impossible de charger l'historique.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiBaseUrl, language, limit]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const formatDate = (value: string) => new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'fr-FR', {
    dateStyle: 'short', timeStyle: 'short',
  }).format(new Date(value));

  if (loading) return <ActivityIndicator style={styles.loader} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{language === 'en' ? 'Interaction history' : 'Historique des interactions'}</Text>
          <Text style={styles.subtitle}>{language === 'en' ? `Last ${limit} interactions` : `30 dernières interactions`}</Text>
        </View>
        <Pressable onPress={() => loadHistory(true)} disabled={refreshing} style={styles.refreshButton}>
          {refreshing ? <ActivityIndicator size="small" /> : <Text style={styles.refreshText}>↻</Text>}
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && interactions.length === 0 ? (
        <Text style={styles.empty}>{language === 'en' ? 'No interactions yet.' : 'Aucune interaction pour le moment.'}</Text>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {interactions.map((interaction) => {
            const intent = interaction.detectedIntent
              ? INTENT_LABELS[interaction.detectedIntent]?.[language] || interaction.detectedIntent
              : language === 'en' ? 'Not detected' : 'Non détectée';
            return (
              <View key={interaction.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.mode}>{interaction.inputMode === 'voice' ? '🎙️' : '💬'} {interaction.inputMode}</Text>
                  <Text style={styles.date}>{formatDate(interaction.createdAt)}</Text>
                </View>
                <Text style={styles.inputText}>{interaction.inputText}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.intentBadge}><Text style={styles.intentText}>{intent}</Text></View>
                  {interaction.actionTaken ? <Text style={styles.action}>✓ {language === 'en' ? 'Action taken' : 'Action effectuée'}</Text> : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { marginTop: 3, fontSize: 13, color: '#667085' },
  refreshButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d0d5dd' },
  refreshText: { fontSize: 22, color: '#4338ca' },
  loader: { margin: 24 },
  error: { padding: 12, color: '#b42318', backgroundColor: '#fef3f2', borderRadius: 8 },
  empty: { textAlign: 'center', marginTop: 40, color: '#667085' },
  list: { flex: 1 },
  listContent: { gap: 10, paddingBottom: 16 },
  card: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#eaecf0', backgroundColor: '#fff' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  mode: { fontSize: 12, color: '#667085', textTransform: 'capitalize' },
  date: { fontSize: 12, color: '#98a2b3' },
  inputText: { fontSize: 15, lineHeight: 21, color: '#101828', marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  intentBadge: { backgroundColor: '#f2f4f7', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  intentText: { fontSize: 12, fontWeight: '600', color: '#344054' },
  action: { fontSize: 12, color: '#027a48', fontWeight: '600' },
});
