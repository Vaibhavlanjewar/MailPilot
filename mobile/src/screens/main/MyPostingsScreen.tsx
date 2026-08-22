import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Screen, Card, PrimaryButton, SecondaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

type Job = { _id: string; title: string; company: string; location: string; workMode: string; active: boolean; createdAt: string };

export default function MyPostingsScreen() {
  const navigation = useNavigation<any>();
  const { isRecruiter } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/jobs/mine');
      setJobs(data.jobs || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not load your postings.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isRecruiter) load();
  }, [isRecruiter, load]);

  async function toggleActive(job: Job) {
    setTogglingId(job._id);
    try {
      const { data } = await api.patch(`/jobs/${job._id}`, { active: !job.active });
      setJobs((prev) => prev.map((j) => (j._id === job._id ? data.job : j)));
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not update this listing.' });
    } finally {
      setTogglingId(null);
    }
  }

  function confirmDelete(job: Job) {
    Alert.alert(`Delete "${job.title}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/jobs/${job._id}`);
            setJobs((prev) => prev.filter((j) => j._id !== job._id));
          } catch (err: any) {
            Toast.show({ type: 'error', text1: err?.message || 'Could not delete this listing.' });
          }
        },
      },
    ]);
  }

  if (!isRecruiter) {
    return (
      <Screen style={styles.center}>
        <Card style={{ alignItems: 'center', margin: 20 }}>
          <Text style={styles.cardTitle}>Recruiter account required</Text>
          <Text style={styles.muted}>Managing postings is a Recruiter feature. Switch your account type in Settings.</Text>
          <View style={{ marginTop: 12, width: '100%' }}>
            <PrimaryButton title="Go to Settings" onPress={() => navigation.navigate('Settings')} />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          {jobs.length} listing{jobs.length === 1 ? '' : 's'} posted by you.
        </Text>
        <PrimaryButton title="+ Post a new job" onPress={() => navigation.navigate('PostJob')} />
      </View>
      {loading && jobs.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 40 }}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No postings yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 10 }}>
              <View style={styles.rowTop}>
                <Text style={styles.jobTitle}>{item.title}</Text>
                <Text style={[styles.badge, { color: item.active ? colors.success : colors.textSecondary }]}>
                  {item.active ? 'Active' : 'Paused'}
                </Text>
              </View>
              <Text style={styles.muted}>
                {item.company} · {item.location} · {item.workMode} · Posted {new Date(item.createdAt).toLocaleDateString()}
              </Text>
              <View style={styles.actionsRow}>
                <SecondaryButton
                  title={togglingId === item._id ? '…' : item.active ? 'Pause' : 'Reactivate'}
                  onPress={() => toggleActive(item)}
                  disabled={togglingId === item._id}
                />
                <SecondaryButton title="Delete" onPress={() => confirmDelete(item)} />
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { padding: 16, gap: 10 },
  subtitle: { color: colors.textSecondary, fontSize: 13 },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  badge: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
});
