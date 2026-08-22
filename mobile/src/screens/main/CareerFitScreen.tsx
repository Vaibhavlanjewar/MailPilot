import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import { Screen, Card, PrimaryButton, SecondaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

const PRIORITY_COLOR: Record<string, string> = {
  high: colors.danger,
  medium: colors.warning,
  low: colors.textSecondary,
};

type Advice = {
  updatedAt?: string;
  provider?: string;
  summary?: string;
  strengths?: string[];
  companyTypes?: { type: string; why: string }[];
  locations?: { location: string; why: string }[];
  targetRoles?: string[];
  salaryBand?: { currency: string; min: number; max: number; note?: string };
  skillGaps?: { skill: string; why: string; priority: string }[];
};

export default function CareerFitScreen() {
  const navigation = useNavigation<any>();
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [hasResume, setHasResume] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/career/fit').then(({ data }) => setAdvice(data.advice)),
      api.get('/resumes/me').then(({ data }) => setHasResume(Boolean(data.resume))),
    ])
      .catch((err) => Toast.show({ type: 'error', text1: err?.message || 'Could not load.' }))
      .finally(() => setLoading(false));
  }, []);

  async function generate() {
    setGenerating(true);
    try {
      const { data } = await api.post('/career/fit');
      setAdvice(data.advice);
      Toast.show({ type: 'success', text1: 'Suggestions updated from your latest resume.' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not generate suggestions.' });
    } finally {
      setGenerating(false);
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
        <Text style={styles.title}>Career Fit</Text>
        <Text style={styles.subtitle}>
          AI reads your resume and suggests company types, locations, a salary band, and skill gaps
          worth closing.
        </Text>

        {!hasResume && (
          <Card style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={styles.cardTitle}>Add your resume first</Text>
            <Text style={styles.muted}>These suggestions need real evidence to work from.</Text>
            <View style={{ marginTop: 12, width: '100%' }}>
              <PrimaryButton title="Add resume" onPress={() => navigation.navigate('MyResume')} />
            </View>
          </Card>
        )}

        <Card style={{ marginTop: 16 }}>
          <Text style={styles.cardTitle}>{advice ? 'Latest suggestions' : 'No suggestions yet'}</Text>
          {advice?.updatedAt ? (
            <Text style={styles.muted}>Generated {new Date(advice.updatedAt).toLocaleString()}</Text>
          ) : null}
          <View style={{ marginTop: 12 }}>
            <PrimaryButton
              title={generating ? 'Analyzing…' : advice ? 'Regenerate' : 'Generate suggestions'}
              onPress={generate}
              loading={generating}
              disabled={!hasResume}
            />
          </View>
        </Card>

        {advice && (
          <>
            <Card style={{ marginTop: 16 }}>
              <Text style={styles.sectionHeading}>Your position</Text>
              <Text style={styles.body}>{advice.summary}</Text>
              {advice.strengths && advice.strengths.length > 0 ? (
                <View style={styles.tagRow}>
                  {advice.strengths.map((s) => (
                    <Text key={s} style={[styles.tag, { color: colors.success, borderColor: colors.success }]}>
                      {s}
                    </Text>
                  ))}
                </View>
              ) : null}
            </Card>

            {advice.companyTypes && advice.companyTypes.length > 0 && (
              <Card style={{ marginTop: 16 }}>
                <Text style={styles.sectionHeading}>Company types to target</Text>
                {advice.companyTypes.map((c) => (
                  <View key={c.type} style={styles.subItem}>
                    <Text style={styles.subItemTitle}>{c.type}</Text>
                    <Text style={styles.muted}>{c.why}</Text>
                  </View>
                ))}
              </Card>
            )}

            {advice.locations && advice.locations.length > 0 && (
              <Card style={{ marginTop: 16 }}>
                <Text style={styles.sectionHeading}>Locations</Text>
                {advice.locations.map((l) => (
                  <View key={l.location} style={styles.subItem}>
                    <Text style={styles.subItemTitle}>{l.location}</Text>
                    <Text style={styles.muted}>{l.why}</Text>
                  </View>
                ))}
              </Card>
            )}

            {advice.targetRoles && advice.targetRoles.length > 0 && (
              <Card style={{ marginTop: 16 }}>
                <Text style={styles.sectionHeading}>Target roles</Text>
                <View style={styles.tagRow}>
                  {advice.targetRoles.map((r) => (
                    <Text key={r} style={[styles.tag, { color: colors.primary, borderColor: colors.primary }]}>
                      {r}
                    </Text>
                  ))}
                </View>
              </Card>
            )}

            <Card style={{ marginTop: 16 }}>
              <Text style={styles.sectionHeading}>Realistic salary band</Text>
              {advice.salaryBand?.min ? (
                <>
                  <Text style={styles.salary}>
                    {advice.salaryBand.currency} {Number(advice.salaryBand.min).toLocaleString()} –{' '}
                    {Number(advice.salaryBand.max).toLocaleString()}
                  </Text>
                  <Text style={styles.muted}>{advice.salaryBand.note}</Text>
                </>
              ) : (
                <Text style={styles.muted}>Not enough evidence in your resume to estimate this.</Text>
              )}
            </Card>

            {advice.skillGaps && advice.skillGaps.length > 0 && (
              <Card style={{ marginTop: 16 }}>
                <Text style={styles.sectionHeading}>Skill gaps worth closing</Text>
                {advice.skillGaps.map((g) => (
                  <View key={g.skill} style={styles.gapRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subItemTitle}>{g.skill}</Text>
                      <Text style={styles.muted}>{g.why}</Text>
                    </View>
                    <Text style={[styles.priorityBadge, { color: PRIORITY_COLOR[g.priority] || colors.textSecondary }]}>
                      {g.priority}
                    </Text>
                  </View>
                ))}
                <View style={{ marginTop: 12 }}>
                  <SecondaryButton title="Build a learning roadmap →" onPress={() => navigation.navigate('Roadmap')} />
                </View>
              </Card>
            )}
          </>
        )}
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
  sectionHeading: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  body: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: {
    fontSize: 11,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  subItem: {
    backgroundColor: colors.bg,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  subItemTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  salary: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 4 },
  gapRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  priorityBadge: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
});
