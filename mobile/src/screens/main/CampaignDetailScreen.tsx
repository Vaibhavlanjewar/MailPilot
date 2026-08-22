import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { Screen, Card } from '../../components/ui';
import { colors } from '../../theme/colors';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function recipientColor(status: string) {
  if (status === 'sent') return colors.success;
  if (status === 'failed') return colors.danger;
  return colors.textSecondary;
}

export default function CampaignDetailScreen({ route }: any) {
  const { id } = route.params;
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<any>(null);
  const [summary, setSummary] = useState({ total: 0, sent: 0, failed: 0, queued: 0 });
  const [recipients, setRecipients] = useState<any[]>([]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { data } = await api.get(`/campaign/status/${id}`);
        setCampaign(data.campaign || null);
        setSummary(data.summary || { total: 0, sent: 0, failed: 0, queued: 0 });
        setRecipients(data.recipients || []);
      } catch (err: any) {
        Toast.show({ type: 'error', text1: err?.message || 'Could not load campaign.' });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (summary.queued <= 0) return undefined;
    const timer = setInterval(() => load(true), 3000);
    return () => clearInterval(timer);
  }, [summary.queued, load]);

  if (loading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!campaign) {
    return (
      <Screen style={styles.center}>
        <Text style={styles.muted}>Campaign not found.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={recipients}
        keyExtractor={(item, i) => item._id || String(i)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>{campaign.name}</Text>
            <Text style={styles.subject}>{campaign.subject}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{summary.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: colors.success }]}>{summary.sent}</Text>
                <Text style={styles.statLabel}>Sent</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: colors.danger }]}>{summary.failed}</Text>
                <Text style={styles.statLabel}>Failed</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: colors.secondary }]}>{summary.queued}</Text>
                <Text style={styles.statLabel}>Queued</Text>
              </View>
            </View>

            <Text style={styles.sectionHeading}>Recipients</Text>
          </>
        }
        ListEmptyComponent={<Text style={styles.muted}>No recipients.</Text>}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 8 }}>
            <View style={styles.recipientRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recipientEmail}>{item.email}</Text>
                <Text style={styles.muted}>{formatDate(item.sentAt || item.updatedAt)}</Text>
              </View>
              <Text style={[styles.statusBadge, { color: recipientColor(item.status) }]}>{item.status}</Text>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  subject: { color: colors.textSecondary, fontSize: 13, marginTop: 4, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  statValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 2, textTransform: 'uppercase' },
  sectionHeading: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10 },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recipientEmail: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  muted: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  statusBadge: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
});
