import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { Screen } from '../../components/ui';
import { colors } from '../../theme/colors';

const WORK_MODES = ['Remote', 'Hybrid', 'On-site'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];

type Job = {
  _id: string;
  title: string;
  company: string;
  location: string;
  workMode: string;
  employmentType: string;
  experienceLevel: string;
  salaryRange?: string;
  description?: string;
  skills?: string[];
  applyUrl?: string;
  isSaved?: boolean;
};

const EMPTY_FILTERS = { q: '', workMode: '', employmentType: '' };

export default function JobSearchScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [savingId, setSavingId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, ...filters };
      Object.keys(params).forEach((k) => {
        if (!params[k]) delete params[k];
      });
      const { data } = await api.get('/jobs', { params });
      if (requestId !== requestIdRef.current) return;
      setJobs(data.jobs || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err: any) {
      if (requestId !== requestIdRef.current) return;
      Toast.show({ type: 'error', text1: err?.message || 'Could not load jobs.' });
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [page, filters]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  function setFilter(key: 'workMode' | 'employmentType', value: string) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? '' : value }));
  }

  async function toggleSave(job: Job) {
    setSavingId(job._id);
    setJobs((prev) => prev.map((j) => (j._id === job._id ? { ...j, isSaved: !j.isSaved } : j)));
    try {
      await api.post(`/jobs/${job._id}/save`);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not update saved jobs.' });
      setJobs((prev) => prev.map((j) => (j._id === job._id ? { ...j, isSaved: job.isSaved } : j)));
    } finally {
      setSavingId(null);
    }
  }

  function chip(active: boolean) {
    return [styles.chip, active ? styles.chipActive : null];
  }

  function chipText(active: boolean) {
    return [styles.chipText, active ? styles.chipTextActive : null];
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Job Board</Text>
        <Text style={styles.headerSubtitle}>
          {loading ? 'Loading…' : `${total} live listing${total === 1 ? '' : 's'}`}
        </Text>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          value={filters.q}
          onChangeText={(text) => {
            setPage(1);
            setFilters((p) => ({ ...p, q: text }));
          }}
          placeholder="Title, company, description..."
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.chipRow}>
        {WORK_MODES.map((m) => (
          <Pressable key={m} onPress={() => setFilter('workMode', m)} style={chip(filters.workMode === m)}>
            <Text style={chipText(filters.workMode === m)}>{m}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.chipRow}>
        {EMPLOYMENT_TYPES.map((t) => (
          <Pressable key={t} onPress={() => setFilter('employmentType', t)} style={chip(filters.employmentType === t)}>
            <Text style={chipText(filters.employmentType === t)}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {loading && jobs.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No jobs match these filters</Text>
              <Text style={styles.headerSubtitle}>Try widening your search or clearing a filter.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.badgeRow}>
                  <Text style={styles.badge}>{item.workMode}</Text>
                  <Text style={styles.badge}>{item.experienceLevel}</Text>
                </View>
                <Pressable onPress={() => toggleSave(item)} disabled={savingId === item._id}>
                  <Ionicons
                    name={item.isSaved ? 'heart' : 'heart-outline'}
                    size={20}
                    color={item.isSaved ? colors.danger : colors.textSecondary}
                  />
                </Pressable>
              </View>
              <Text style={styles.jobTitle}>{item.title}</Text>
              <Text style={styles.jobCompany}>{item.company}</Text>
              <Text style={styles.jobMeta}>{item.location}</Text>
              {item.salaryRange ? <Text style={styles.jobMeta}>{item.salaryRange}</Text> : null}
              {item.description ? (
                <Text style={styles.jobDescription} numberOfLines={3}>
                  {item.description}
                </Text>
              ) : null}
              {item.skills && item.skills.length > 0 ? (
                <View style={styles.skillRow}>
                  {item.skills.slice(0, 6).map((skill) => (
                    <Text key={skill} style={styles.skillTag}>
                      {skill}
                    </Text>
                  ))}
                </View>
              ) : null}
              {item.applyUrl ? (
                <Pressable style={styles.applyButton} onPress={() => Linking.openURL(item.applyUrl!)}>
                  <Text style={styles.applyButtonText}>Apply</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pagination}>
                <Pressable
                  disabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  style={[styles.pageButton, page <= 1 ? { opacity: 0.4 } : null]}
                >
                  <Text style={styles.pageButtonText}>Previous</Text>
                </Pressable>
                <Text style={styles.headerSubtitle}>
                  Page {page} / {totalPages}
                </Text>
                <Pressable
                  disabled={page >= totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={[styles.pageButton, page >= totalPages ? { opacity: 0.4 } : null]}
                >
                  <Text style={styles.pageButtonText}>Next</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 16 },
  headerTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  headerSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 16, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.secondary,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    textTransform: 'uppercase',
  },
  jobTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 10 },
  jobCompany: { color: colors.success, fontSize: 13, fontWeight: '600', marginTop: 2 },
  jobMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  jobDescription: { color: colors.textSecondary, fontSize: 12, marginTop: 8, lineHeight: 18 },
  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  skillTag: {
    fontSize: 10,
    color: colors.textPrimary,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  applyButton: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  applyButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 },
  pageButton: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pageButtonText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
});
