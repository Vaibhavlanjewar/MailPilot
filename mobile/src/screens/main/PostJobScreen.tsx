import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Screen, Card, Field, PrimaryButton, SecondaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

const WORK_MODES = ['Remote', 'Hybrid', 'On-site'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const EXPERIENCE_LEVELS = ['Fresher', 'Junior', 'Mid', 'Senior', 'Lead'];

const EMPTY_FORM = {
  title: '',
  company: '',
  location: '',
  workMode: 'Hybrid',
  employmentType: 'Full-time',
  experienceLevel: 'Mid',
  salaryRange: '',
  skills: '',
  applyUrl: '',
  recruiterName: '',
  recruiterLinkedIn: '',
  description: '',
};

function PickerRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((o) => (
          <Pressable key={o} onPress={() => onChange(o)} style={[styles.chip, value === o ? styles.chipActive : null]}>
            <Text style={[styles.chipText, value === o ? styles.chipTextActive : null]}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function PostJobScreen() {
  const navigation = useNavigation<any>();
  const { isRecruiter } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [rawText, setRawText] = useState('');
  const [extracting, setExtracting] = useState(false);

  function set(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (!isRecruiter) {
    return (
      <Screen style={styles.center}>
        <Card style={{ alignItems: 'center', margin: 20 }}>
          <Text style={styles.cardTitle}>Recruiter account required</Text>
          <Text style={styles.muted}>Posting jobs is a Recruiter feature. Switch your account type in Settings.</Text>
          <View style={{ marginTop: 12, width: '100%' }}>
            <PrimaryButton title="Go to Settings" onPress={() => navigation.navigate('Settings')} />
          </View>
        </Card>
      </Screen>
    );
  }

  async function handleExtract() {
    if (!rawText.trim()) {
      Toast.show({ type: 'info', text1: 'Paste a job description first.' });
      return;
    }
    setExtracting(true);
    try {
      const { data } = await api.post('/jobs/extract', { rawText });
      const f = data.fields || {};
      setForm((prev) => ({
        ...prev,
        title: f.title || prev.title,
        company: f.company || prev.company,
        location: f.location || prev.location,
        workMode: WORK_MODES.includes(f.workMode) ? f.workMode : prev.workMode,
        employmentType: EMPLOYMENT_TYPES.includes(f.employmentType) ? f.employmentType : prev.employmentType,
        experienceLevel: EXPERIENCE_LEVELS.includes(f.experienceLevel) ? f.experienceLevel : prev.experienceLevel,
        salaryRange: f.salaryRange || prev.salaryRange,
        skills: Array.isArray(f.skills) ? f.skills.join(', ') : prev.skills,
        description: f.description || prev.description,
      }));
      Toast.show({ type: 'success', text1: 'Fields extracted — review before publishing.' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not extract fields.' });
    } finally {
      setExtracting(false);
    }
  }

  async function handlePublish() {
    if (!form.title.trim() || !form.company.trim() || !form.location.trim() || !form.description.trim()) {
      Toast.show({ type: 'info', text1: 'Please fill out all required fields.' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/jobs', form);
      Toast.show({ type: 'success', text1: `Published "${form.title}" to the job board.` });
      setForm(EMPTY_FORM);
      navigation.navigate('JobSearch');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not publish this job.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.title}>Post a Job</Text>
        <Text style={styles.subtitle}>Fill out the role details to publish it to the job board.</Text>

        <Card style={{ marginTop: 16 }}>
          <Text style={styles.cardTitle}>Paste a job description (optional)</Text>
          <Text style={styles.muted}>AI fills the fields below for you to review — nothing publishes until you submit.</Text>
          <TextInput
            multiline
            value={rawText}
            onChangeText={setRawText}
            placeholder="Paste the full job description text here…"
            placeholderTextColor={colors.textSecondary}
            style={[styles.textarea, { marginTop: 10 }]}
          />
          <PrimaryButton title={extracting ? 'Extracting…' : 'Extract fields with AI'} onPress={handleExtract} loading={extracting} />
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Field label="Job Title *" placeholder="e.g. Senior Frontend Engineer" value={form.title} onChangeText={(v) => set('title', v)} />
          <Field label="Company *" placeholder="e.g. Razorpay" value={form.company} onChangeText={(v) => set('company', v)} />
          <Field label="Location *" placeholder="e.g. Bengaluru, India" value={form.location} onChangeText={(v) => set('location', v)} />
          <PickerRow label="Work Mode" options={WORK_MODES} value={form.workMode} onChange={(v) => set('workMode', v)} />
          <PickerRow label="Employment Type" options={EMPLOYMENT_TYPES} value={form.employmentType} onChange={(v) => set('employmentType', v)} />
          <PickerRow label="Experience Level" options={EXPERIENCE_LEVELS} value={form.experienceLevel} onChange={(v) => set('experienceLevel', v)} />
          <Field label="Salary Range" placeholder="e.g. ₹18-24 LPA" value={form.salaryRange} onChangeText={(v) => set('salaryRange', v)} />
          <Field label="Skills (comma-separated)" placeholder="e.g. React, Node.js, AWS" value={form.skills} onChangeText={(v) => set('skills', v)} />
          <Field label="Recruiter Name" value={form.recruiterName} onChangeText={(v) => set('recruiterName', v)} />
          <Field label="Recruiter LinkedIn" autoCapitalize="none" value={form.recruiterLinkedIn} onChangeText={(v) => set('recruiterLinkedIn', v)} />
          <Field label="Direct Apply Link" autoCapitalize="none" value={form.applyUrl} onChangeText={(v) => set('applyUrl', v)} />
          <Text style={styles.label}>Role Description *</Text>
          <TextInput
            multiline
            value={form.description}
            onChangeText={(v) => set('description', v)}
            placeholder="Responsibilities, requirements, what a strong candidate looks like…"
            placeholderTextColor={colors.textSecondary}
            style={[styles.textarea, { marginBottom: 16 }]}
          />
          <PrimaryButton title={submitting ? 'Publishing…' : 'Publish Job Opening'} onPress={handlePublish} loading={submitting} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  label: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
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
  },
});
