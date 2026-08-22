import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { Screen, Card, PrimaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

const TABS = ['Prep Plan', 'Chat'] as const;

export default function InterviewPrepScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Prep Plan');
  const [jobDescription, setJobDescription] = useState('');
  const [resume, setResume] = useState<any>(null);
  const [resumeLoading, setResumeLoading] = useState(true);

  useEffect(() => {
    api
      .get('/resumes/me')
      .then(({ data }) => setResume(data.resume))
      .catch(() => {})
      .finally(() => setResumeLoading(false));
  }, []);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Interview Prep</Text>
        <Text style={styles.subtitle}>
          Practice questions and an open-ended coach chat, grounded in your resume and target role.
        </Text>

        {!resumeLoading && !resume ? (
          <Card style={{ marginTop: 16 }}>
            <Text style={styles.cardTitle}>No resume on file</Text>
            <Text style={styles.muted}>Prep works better once we know your real skills and experience.</Text>
          </Card>
        ) : null}

        <Card style={{ marginTop: 16 }}>
          <Text style={styles.label}>Job you're interviewing for</Text>
          <TextInput
            multiline
            value={jobDescription}
            onChangeText={setJobDescription}
            placeholder="Paste the job description — role, responsibilities, required skills…"
            placeholderTextColor={colors.textSecondary}
            style={styles.textarea}
          />
        </Card>

        <View style={styles.tabRow}>
          {TABS.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabButton, tab === t ? styles.tabButtonActive : null]}>
              <Text style={[styles.tabText, tab === t ? styles.tabTextActive : null]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'Prep Plan' ? (
          <PrepPlanTab jobDescription={jobDescription} />
        ) : (
          <ChatTab jobDescription={jobDescription} hasResume={Boolean(resume)} />
        )}

        <Text style={styles.note}>
          The Code Sandbox tab (Python/JS in-browser + C/C++/Java via a hosted sandbox) needs
          browser-only tech (Web Workers, Pyodide/WASM) and isn't available on mobile yet.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function PrepPlanTab({ jobDescription }: { jobDescription: string }) {
  const [loading, setLoading] = useState(false);
  const [focusArea, setFocusArea] = useState('');
  const [questions, setQuestions] = useState<{ id: number; question: string; tips: string; sampleAnswer: string }[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function handleGenerate() {
    if (!jobDescription.trim()) {
      Toast.show({ type: 'info', text1: 'Paste the target job description above first.' });
      return;
    }
    setLoading(true);
    setFocusArea('');
    setQuestions([]);
    try {
      const { data } = await api.post('/ai/interview-prep', { jobDescription: jobDescription.trim() });
      setFocusArea(data.focus || '');
      setQuestions(data.questions || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not generate prep questions.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card style={{ marginTop: 16 }}>
      <Text style={styles.cardTitle}>Staged questions</Text>
      <Text style={styles.muted}>A quick-start set grounded in your resume and the job description.</Text>
      <View style={{ marginTop: 12 }}>
        <PrimaryButton title={loading ? 'Generating…' : 'Generate practice questions'} onPress={handleGenerate} loading={loading} />
      </View>

      {focusArea ? (
        <View style={styles.focusBox}>
          <Text style={styles.focusLabel}>Focus area</Text>
          <Text style={styles.body}>{focusArea}</Text>
        </View>
      ) : null}

      {questions.map((q) => {
        const open = expandedId === q.id;
        return (
          <Pressable key={q.id} onPress={() => setExpandedId(open ? null : q.id)} style={styles.questionCard}>
            <Text style={styles.questionText}>
              Q{q.id}: {q.question}
            </Text>
            {open ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.answerLabel}>Answer strategy</Text>
                <Text style={styles.muted}>{q.tips}</Text>
                <Text style={[styles.answerLabel, { marginTop: 8 }]}>Sample response</Text>
                <Text style={styles.sample}>"{q.sampleAnswer}"</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </Card>
  );
}

function ChatTab({ jobDescription, hasResume }: { jobDescription: string; hasResume: boolean }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'coach'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const starters = [
    'Quiz me on this role, one question at a time.',
    'What are the biggest gaps between my resume and this job?',
    'How should I answer "tell me about yourself" for this job?',
  ];

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const next = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const { data } = await api.post('/ai/interview-chat', { jobDescription, message: trimmed, history: messages });
      setMessages([...next, { role: 'coach', content: data.reply }]);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'The coach is unavailable right now.' });
      setMessages(next);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <Card style={{ marginTop: 16 }}>
      <Text style={styles.cardTitle}>Coach chat</Text>
      <Text style={styles.muted}>
        {hasResume ? 'The coach knows your resume and the job description above.' : 'Add your resume for better-grounded answers.'}
      </Text>

      <ScrollView ref={scrollRef} style={styles.chatBox} contentContainerStyle={{ padding: 4 }}>
        {messages.length === 0 ? (
          <View style={styles.startersRow}>
            {starters.map((s) => (
              <Pressable key={s} onPress={() => send(s)} style={styles.starterChip}>
                <Text style={styles.starterText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          messages.map((m, i) => (
            <View key={i} style={[styles.bubbleRow, m.role === 'user' ? { justifyContent: 'flex-end' } : null]}>
              <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleCoach]}>
                <Text style={m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextCoach}>{m.content}</Text>
              </View>
            </View>
          ))
        )}
        {sending ? <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} /> : null}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything, or say 'quiz me'…"
            placeholderTextColor={colors.textSecondary}
            style={styles.chatInput}
            onSubmitEditing={() => send(input)}
          />
          <Pressable onPress={() => send(input)} disabled={sending || !input.trim()} style={styles.sendButton}>
            <Text style={styles.sendButtonText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  body: { color: colors.textPrimary, fontSize: 13, marginTop: 4 },
  textarea: {
    backgroundColor: colors.bg,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  tabRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tabButton: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderWidth: 1 },
  tabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  focusBox: { marginTop: 14, backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 12, padding: 12 },
  focusLabel: { color: colors.primary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  questionCard: { marginTop: 10, backgroundColor: colors.bg, borderColor: colors.surfaceBorder, borderWidth: 1, borderRadius: 12, padding: 12 },
  questionText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  answerLabel: { color: colors.secondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  sample: { color: colors.textPrimary, fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  chatBox: { maxHeight: 320, marginTop: 12, backgroundColor: colors.bg, borderRadius: 12, borderColor: colors.surfaceBorder, borderWidth: 1 },
  startersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  starterChip: { borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  starterText: { color: colors.textSecondary, fontSize: 11 },
  bubbleRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 4 },
  bubble: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  bubbleUser: { backgroundColor: colors.primary },
  bubbleCoach: { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderWidth: 1 },
  bubbleTextUser: { color: '#fff', fontSize: 13 },
  bubbleTextCoach: { color: colors.textPrimary, fontSize: 13 },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chatInput: { flex: 1, backgroundColor: colors.bg, borderColor: colors.surfaceBorder, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.textPrimary, fontSize: 13 },
  sendButton: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  sendButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  note: { color: colors.textSecondary, fontSize: 11, marginTop: 16, lineHeight: 16 },
});
