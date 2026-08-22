import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import { Screen, Card, PrimaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

type ChatItem = {
  id: string;
  question: string;
  answer: string;
  criticalKeywords: string[];
  recommendedAction: string;
  provider?: string;
};

export default function ResumeRagScreen() {
  const navigation = useNavigation<any>();
  const [resume, setResume] = useState<any>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  const [query, setQuery] = useState('');
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [history, setHistory] = useState<ChatItem[]>([]);

  useEffect(() => {
    api
      .get('/resumes/me')
      .then(({ data }) => setResume(data.resume))
      .catch((err) => Toast.show({ type: 'error', text1: err?.message || 'Could not load your resume.' }))
      .finally(() => setLoadingResume(false));
  }, []);

  async function handleSubmit() {
    if (!query.trim()) {
      Toast.show({ type: 'info', text1: 'Enter a question first.' });
      return;
    }
    if (!resume) {
      Toast.show({ type: 'info', text1: 'Add your resume under My Resume first.' });
      return;
    }
    setLoadingQuery(true);
    try {
      const { data } = await api.post('/ai/rag/query', { query: query.trim() });
      setHistory((prev) => [
        {
          id: `chat-${Date.now()}`,
          question: query.trim(),
          answer: data.answer,
          criticalKeywords: data.criticalKeywords || [],
          recommendedAction: data.recommendedAction || '',
          provider: data.provider,
        },
        ...prev,
      ]);
      setQuery('');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not query this resume.' });
    } finally {
      setLoadingQuery(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.title}>Ask My Resume</Text>
        <Text style={styles.subtitle}>
          Query your stored resume using retrieval-augmented generation.
        </Text>

        {loadingResume ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
        ) : !resume ? (
          <Card style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={styles.cardTitle}>No resume saved yet</Text>
            <View style={{ marginTop: 12, width: '100%' }}>
              <PrimaryButton title="Add resume" onPress={() => navigation.navigate('MyResume')} />
            </View>
          </Card>
        ) : (
          <Card style={{ marginTop: 16 }}>
            <Text style={styles.label}>Indexed document</Text>
            <Text style={styles.body}>{resume.title}</Text>
            <Text style={styles.muted}>
              {resume.wordCount} words · {resume.embedding?.provider ? `semantic (${resume.embedding.provider})` : 'keyword matching'}
            </Text>
          </Card>
        )}

        <Card style={{ marginTop: 16 }}>
          <Text style={styles.label}>Ask anything about your resume</Text>
          <TextInput
            multiline
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. List my projects where I used Docker"
            placeholderTextColor={colors.textSecondary}
            style={styles.textarea}
          />
          <PrimaryButton
            title={loadingQuery ? 'Thinking…' : 'Ask'}
            onPress={handleSubmit}
            loading={loadingQuery}
            disabled={!resume}
          />
        </Card>

        {history.map((item) => (
          <Card key={item.id} style={{ marginTop: 12 }}>
            <Text style={styles.question}>"{item.question}"</Text>
            <Text style={styles.body}>{item.answer}</Text>
            {item.criticalKeywords.length > 0 ? (
              <View style={styles.tagRow}>
                {item.criticalKeywords.map((k) => (
                  <Text key={k} style={styles.tag}>
                    {k}
                  </Text>
                ))}
              </View>
            ) : null}
            {item.recommendedAction ? <Text style={styles.recommendation}>"{item.recommendedAction}"</Text> : null}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  body: { color: colors.textPrimary, fontSize: 13, lineHeight: 19 },
  muted: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  textarea: {
    backgroundColor: colors.bg,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 13,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  question: { color: colors.primary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: {
    fontSize: 10,
    color: colors.primary,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recommendation: { color: colors.textSecondary, fontSize: 11, fontStyle: 'italic', marginTop: 10 },
});
