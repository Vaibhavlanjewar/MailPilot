import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { Screen, Card, Field, PrimaryButton, SecondaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

const EMPTY_LINKS = { linkedin: '', github: '', portfolio: '', leetcode: '' };
const LINK_FIELDS = [
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/you' },
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/you' },
  { key: 'portfolio', label: 'Portfolio', placeholder: 'https://yoursite.com' },
  { key: 'leetcode', label: 'LeetCode', placeholder: 'https://leetcode.com/u/you' },
] as const;

type Resume = {
  title: string;
  wordCount: number;
  source: string;
  hasFile: boolean;
  embedding: { chunkCount: number; provider?: string };
  links?: Record<string, string>;
  projectLinks?: { title: string; url: string }[];
};

/** RN ships Blob + FileReader globally, so this works the same on native and web. */
function fileUriToBase64(uri: string): Promise<string> {
  return fetch(uri)
    .then((res) => res.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Could not read the file.'));
          reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
          reader.readAsDataURL(blob);
        })
    );
}

export default function MyResumeScreen() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [pasteText, setPasteText] = useState('');
  const [pasteTitle, setPasteTitle] = useState('My resume');
  const [linksDraft, setLinksDraft] = useState<Record<string, string>>(EMPTY_LINKS);
  const [linksBusy, setLinksBusy] = useState(false);
  const [linksDirty, setLinksDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/resumes/me');
      setResume(data.resume);
      setLinksDraft({ ...EMPTY_LINKS, ...(data.resume?.links || {}) });
      setLinksDirty(false);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not load your resume.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const file = result.assets[0];

    if ((file.size || 0) > 2 * 1024 * 1024) {
      Toast.show({ type: 'error', text1: 'File exceeds the 2MB limit.' });
      return;
    }

    const isTxt = file.name.toLowerCase().endsWith('.txt');

    setBusy(true);
    try {
      let content: string;
      let fileBase64: string | undefined;

      if (isTxt) {
        // Text drives AI features; no original file needs to be kept for
        // attachments (mirrors the web client's fileToBase64 skip for .txt).
        const response = await fetch(file.uri);
        content = await response.text();
      } else {
        fileBase64 = await fileUriToBase64(file.uri);
        // PDF/DOCX text extraction runs client-side on web via pdf.js/mammoth
        // (browser-only CDN scripts). Mobile has no DOM, so the same
        // extraction runs server-side instead — same outcome, different side.
        const { data } = await api.post('/resumes/extract-text', {
          fileBase64,
          fileName: file.name,
          mimeType: file.mimeType,
        });
        content = data.content;
      }

      const { data } = await api.put('/resumes/me', {
        title: file.name,
        source: 'upload',
        content,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.mimeType,
        fileBase64,
      });
      setResume(data.resume);
      Toast.show({ type: 'success', text1: resume ? 'Resume replaced.' : 'Resume saved.' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not save the resume.' });
    } finally {
      setBusy(false);
    }
  }

  async function handlePaste() {
    if (!pasteText.trim()) {
      Toast.show({ type: 'info', text1: 'Paste your resume text first.' });
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.put('/resumes/me', {
        title: pasteTitle.trim() || 'My resume',
        source: 'paste',
        content: pasteText,
      });
      setResume(data.resume);
      setPasteText('');
      Toast.show({ type: 'success', text1: 'Resume saved.' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not save the resume.' });
    } finally {
      setBusy(false);
    }
  }

  function updateLink(key: string, value: string) {
    setLinksDraft((prev) => ({ ...prev, [key]: value }));
    setLinksDirty(true);
  }

  async function handleSaveLinks() {
    setLinksBusy(true);
    try {
      const { data } = await api.patch('/resumes/me/links', {
        links: linksDraft,
        projectLinks: resume?.projectLinks || [],
      });
      setResume(data.resume);
      setLinksDirty(false);
      Toast.show({ type: 'success', text1: 'Links saved.' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not save links.' });
    } finally {
      setLinksBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await api.delete('/resumes/me');
      setResume(null);
      Toast.show({ type: 'success', text1: 'Resume deleted.' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not delete the resume.' });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.title}>My Resume</Text>
        <Text style={styles.subtitle}>
          One resume powers email personalisation, interview prep and your learning roadmap.
        </Text>

        {resume ? (
          <Card style={{ marginTop: 16 }}>
            <Text style={styles.resumeTitle}>{resume.title}</Text>
            <Text style={styles.resumeMeta}>
              {resume.wordCount.toLocaleString()} words · {resume.embedding.chunkCount} search chunk
              {resume.embedding.chunkCount === 1 ? '' : 's'} · {resume.source}
            </Text>
            <Text style={styles.resumeMeta}>
              Search mode: {resume.embedding.provider ? `semantic (${resume.embedding.provider})` : 'keyword matching'}
            </Text>
            <SecondaryButton title="Delete resume" onPress={handleDelete} disabled={busy} />
          </Card>
        ) : (
          <Card style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={styles.resumeTitle}>No resume yet</Text>
            <Text style={styles.resumeMeta}>Add one below to unlock personalised emails and interview prep.</Text>
          </Card>
        )}

        {resume && (
          <Card style={{ marginTop: 16 }}>
            <Text style={styles.sectionTitle}>Profile links</Text>
            {LINK_FIELDS.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                placeholder={f.placeholder}
                value={linksDraft[f.key]}
                onChangeText={(v) => updateLink(f.key, v)}
                autoCapitalize="none"
                keyboardType="url"
              />
            ))}
            <PrimaryButton
              title={linksBusy ? 'Saving…' : 'Save links'}
              onPress={handleSaveLinks}
              disabled={!linksDirty}
              loading={linksBusy}
            />
          </Card>
        )}

        <Card style={{ marginTop: 16 }}>
          <View style={styles.tabRow}>
            <SecondaryButton title="Upload a file" onPress={() => setMode('upload')} />
            <SecondaryButton title="Paste text" onPress={() => setMode('paste')} />
          </View>

          {mode === 'upload' ? (
            <View style={{ marginTop: 16 }}>
              <PrimaryButton
                title={busy ? 'Extracting and saving…' : 'Choose a PDF, Word or text file'}
                onPress={handlePickFile}
                loading={busy}
              />
              <Text style={styles.note}>Max 2MB · replaces your current resume</Text>
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              <Field label="Title" value={pasteTitle} onChangeText={setPasteTitle} />
              <Text style={styles.label}>Resume text</Text>
              <TextInput
                multiline
                numberOfLines={10}
                value={pasteText}
                onChangeText={setPasteText}
                placeholder="Paste your full resume here…"
                placeholderTextColor={colors.textSecondary}
                style={styles.textarea}
              />
              <PrimaryButton
                title={busy ? 'Saving…' : resume ? 'Replace my resume' : 'Save my resume'}
                onPress={handlePaste}
                loading={busy}
              />
            </View>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  resumeTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  resumeMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 4, marginBottom: 12 },
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  tabRow: { flexDirection: 'row', gap: 10 },
  note: { color: colors.textSecondary, fontSize: 11, marginTop: 8 },
  label: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  textarea: {
    backgroundColor: colors.bg,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 14,
    minHeight: 160,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
});
