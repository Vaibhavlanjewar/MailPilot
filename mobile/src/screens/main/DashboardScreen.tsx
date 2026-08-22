import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Screen } from '../../components/ui';
import { colors } from '../../theme/colors';

const QUICK_ACTIONS: { label: string; icon: keyof typeof Ionicons.glyphMap; screen: string }[] = [
  { label: 'Job Board', icon: 'briefcase-outline', screen: 'JobSearch' },
  { label: 'My Resume', icon: 'document-text-outline', screen: 'MyResume' },
  { label: 'Campaigns', icon: 'megaphone-outline', screen: 'Campaigns' },
  { label: 'Career Fit', icon: 'compass-outline', screen: 'CareerFit' },
  { label: 'Roadmap', icon: 'map-outline', screen: 'Roadmap' },
  { label: 'Mock Interview', icon: 'videocam-outline', screen: 'MockInterviewLobby' },
  { label: 'Community', icon: 'chatbubbles-outline', screen: 'Community' },
  { label: 'Contacts', icon: 'people-outline', screen: 'Contacts' },
];

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [stats, setStats] = useState<{ campaigns: number | null; savedJobs: number | null }>({
    campaigns: null,
    savedJobs: null,
  });

  useEffect(() => {
    let cancelled = false;
    api
      .get('/campaigns')
      .then(({ data }) => {
        if (!cancelled) setStats((s) => ({ ...s, campaigns: (data.campaigns || data || []).length ?? 0 }));
      })
      .catch(() => {});
    api
      .get('/jobs/saved')
      .then(({ data }) => {
        if (!cancelled) setStats((s) => ({ ...s, savedJobs: (data.jobs || data || []).length ?? 0 }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.greeting}>
          {user?.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'Welcome back'}
        </Text>
        <Text style={styles.subtitle}>Here's your outreach + career prep at a glance.</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.campaigns ?? '—'}</Text>
            <Text style={styles.statLabel}>Campaigns</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.savedJobs ?? '—'}</Text>
            <Text style={styles.statLabel}>Saved jobs</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.grid}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable key={action.screen} style={styles.actionCard} onPress={() => navigation.navigate(action.screen)}>
              <Ionicons name={action.icon} size={22} color={colors.primary} />
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4, marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  statValue: { color: colors.textPrimary, fontSize: 24, fontWeight: '800' },
  statLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  actionLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
});
