import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { Screen, Card, PrimaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

const PRESETS = [
  'Backend engineer at a fintech company',
  'Full stack developer (MERN)',
  'Data engineer',
  'DevOps / platform engineer',
  'Machine learning engineer',
];

type Step = {
  id: string;
  title: string;
  completed?: boolean;
  alreadyStrong?: boolean;
  estimatedWeeks?: number;
  summary?: string;
  topics?: string[];
  approach?: string;
  resources?: { label: string; url: string }[];
};
type Stage = { id: string; title: string; description?: string; steps: Step[] };
type Roadmap = {
  _id: string;
  goal: string;
  summary?: string;
  personalised?: boolean;
  provider?: string;
  stages: Stage[];
};

function progressOf(roadmap: Roadmap) {
  const steps = (roadmap.stages || []).flatMap((s) => s.steps || []);
  if (!steps.length) return 0;
  return Math.round((steps.filter((s) => s.completed).length / steps.length) * 100);
}

export default function RoadmapScreen() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [active, setActive] = useState<Roadmap | null>(null);
  const [goal, setGoal] = useState('');
  const [useResume, setUseResume] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/roadmaps');
      setRoadmaps(data.roadmaps || []);
      setActive((prev) => prev || data.roadmaps?.[0] || null);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not load roadmaps.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate() {
    if (!goal.trim()) {
      Toast.show({ type: 'info', text1: 'Describe what you want to learn.' });
      return;
    }
    setGenerating(true);
    try {
      const { data } = await api.post('/roadmaps', { goal: goal.trim(), useResume });
      setActive(data.roadmap);
      setRoadmaps((prev) => [data.roadmap, ...prev]);
      setGoal('');
      Toast.show({
        type: 'success',
        text1: data.roadmap.personalised ? 'Roadmap built and tailored to your resume.' : 'Roadmap built.',
      });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not generate the roadmap.' });
    } finally {
      setGenerating(false);
    }
  }

  async function toggleStep(stepId: string, completed: boolean) {
    if (!active) return;
    setActive((prev) =>
      prev
        ? {
            ...prev,
            stages: prev.stages.map((st) => ({
              ...st,
              steps: st.steps.map((s) => (s.id === stepId ? { ...s, completed } : s)),
            })),
          }
        : prev
    );
    try {
      await api.patch(`/roadmaps/${active._id}/steps/${stepId}`, { completed });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not save progress.' });
      load();
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/roadmaps/${id}`);
      setRoadmaps((prev) => prev.filter((r) => r._id !== id));
      setActive((prev) => (prev?._id === id ? null : prev));
      Toast.show({ type: 'success', text1: 'Roadmap deleted.' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not delete the roadmap.' });
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.title}>Learning Roadmap</Text>
        <Text style={styles.subtitle}>
          Generate a staged, dependency-ordered path to your target role.
        </Text>

        <Card style={{ marginTop: 16 }}>
          <Text style={styles.sectionHeading}>Build a roadmap</Text>
          <TextInput
            multiline
            value={goal}
            onChangeText={setGoal}
            placeholder="e.g. Become a backend engineer at a fintech company"
            placeholderTextColor={colors.textSecondary}
            style={styles.textarea}
          />
          <View style={styles.presetRow}>
            {PRESETS.map((p) => (
              <Pressable key={p} onPress={() => setGoal(p)} style={styles.presetChip}>
                <Text style={styles.presetChipText}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.switchRow}>
            <Switch value={useResume} onValueChange={setUseResume} trackColor={{ true: colors.primary }} />
            <Text style={styles.switchLabel}>Personalise using my saved resume</Text>
          </View>
          <PrimaryButton
            title={generating ? 'Designing your path…' : 'Generate roadmap'}
            onPress={handleGenerate}
            loading={generating}
          />
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Text style={styles.sectionHeading}>Saved roadmaps</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : roadmaps.length === 0 ? (
            <Text style={styles.muted}>Nothing saved yet.</Text>
          ) : (
            roadmaps.map((r) => (
              <Pressable
                key={r._id}
                onPress={() => setActive(r)}
                style={[styles.roadmapRow, active?._id === r._id ? styles.roadmapRowActive : null]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.roadmapGoal} numberOfLines={1}>
                    {r.goal}
                  </Text>
                  <Text style={styles.muted}>{progressOf(r)}% complete</Text>
                </View>
                <Pressable onPress={() => handleDelete(r._id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </Pressable>
              </Pressable>
            ))
          )}
        </Card>

        {active ? (
          <View style={{ marginTop: 16 }}>
            <Card>
              <Text style={styles.activeGoal}>{active.goal}</Text>
              {active.summary ? <Text style={styles.muted}>{active.summary}</Text> : null}
              {active.personalised ? (
                <Text style={[styles.badge, { color: colors.success, marginTop: 8 }]}>Tailored to your resume</Text>
              ) : null}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressOf(active)}%` }]} />
              </View>
              <Text style={styles.muted}>{progressOf(active)}% complete</Text>
            </Card>

            {(active.stages || []).map((stage, si) => (
              <Card key={stage.id} style={{ marginTop: 12 }}>
                <View style={styles.stageHeader}>
                  <View style={styles.stageBadge}>
                    <Text style={styles.stageBadgeText}>{si + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stageTitle}>{stage.title}</Text>
                    {stage.description ? <Text style={styles.muted}>{stage.description}</Text> : null}
                  </View>
                </View>

                {(stage.steps || []).map((step) => (
                  <Pressable
                    key={step.id}
                    onPress={() => toggleStep(step.id, !step.completed)}
                    style={[styles.stepCard, step.completed ? styles.stepCardDone : null]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <Ionicons
                        name={step.completed ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={step.completed ? colors.success : colors.textSecondary}
                      />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.stepTitle, step.completed ? styles.stepTitleDone : null]}>
                            {step.title}
                          </Text>
                          {step.alreadyStrong ? (
                            <Text style={[styles.badge, { color: colors.secondary }]}>Already know this</Text>
                          ) : null}
                          {step.estimatedWeeks ? (
                            <Text style={styles.muted}>~{step.estimatedWeeks}w</Text>
                          ) : null}
                        </View>
                        {step.summary ? <Text style={styles.stepSummary}>{step.summary}</Text> : null}
                        {step.topics && step.topics.length > 0 ? (
                          <View style={styles.tagRow}>
                            {step.topics.map((t) => (
                              <Text key={t} style={styles.topicTag}>
                                {t}
                              </Text>
                            ))}
                          </View>
                        ) : null}
                        {step.approach ? (
                          <View style={styles.approachBox}>
                            <Text style={styles.approachLabel}>How to practice this</Text>
                            <Text style={styles.approachText}>{step.approach}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                ))}
              </Card>
            ))}
          </View>
        ) : (
          <Card style={{ marginTop: 16, alignItems: 'center', paddingVertical: 32 }}>
            <Text style={styles.cardTitle}>No roadmap selected</Text>
            <Text style={styles.muted}>Describe your target role above to generate a staged learning path.</Text>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  sectionHeading: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  textarea: {
    backgroundColor: colors.bg,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  presetChip: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  presetChipText: { color: colors.textSecondary, fontSize: 11 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  switchLabel: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  roadmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  roadmapRowActive: { borderColor: colors.primary },
  roadmapGoal: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  activeGoal: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  badge: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  stageHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stageBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stageTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  stepCard: {
    backgroundColor: colors.bg,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  stepCardDone: { borderColor: colors.success },
  stepTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  stepTitleDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  stepSummary: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  topicTag: {
    fontSize: 10,
    color: colors.textSecondary,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  approachBox: {
    marginTop: 8,
    backgroundColor: 'rgba(99,102,241,0.08)',
    borderRadius: 10,
    padding: 8,
  },
  approachLabel: { color: colors.primary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  approachText: { color: colors.textPrimary, fontSize: 12, marginTop: 2 },
});
