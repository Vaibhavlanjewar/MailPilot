import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { Screen, Card } from '../../components/ui';
import { colors } from '../../theme/colors';

type Summary = {
  totalCampaigns: number;
  totalRecipients: number;
  totalSent: number;
  totalFailed: number;
  deliveryRate: number;
  failureRate: number;
};

export default function AnalyticsScreen() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/analytics/summary')
      .then(({ data }) => {
        setSummary(data.summary || null);
        setRecentCampaigns(data.recentCampaigns || []);
        setStatusBreakdown(data.statusBreakdown || []);
      })
      .catch((err) => Toast.show({ type: 'error', text1: err?.message || 'Could not load analytics.' }))
      .finally(() => setLoading(false));
  }, []);

  const stats = summary || {
    totalCampaigns: 0,
    totalRecipients: 0,
    totalSent: 0,
    totalFailed: 0,
    deliveryRate: 0,
    failureRate: 0,
  };
  const statusMax = Math.max(...statusBreakdown.map((s) => s.value), 1);

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
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>Live metrics from your campaigns and delivery stats.</Text>

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalCampaigns}</Text>
            <Text style={styles.statLabel}>Campaigns</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalRecipients}</Text>
            <Text style={styles.statLabel}>Recipients</Text>
          </Card>
          <Card style={[styles.statCard, { width: '100%' }]}>
            <Text style={styles.statValue}>
              {stats.totalSent} / {stats.totalFailed}
            </Text>
            <Text style={styles.statLabel}>Sent / Failed</Text>
          </Card>
        </View>

        {statusBreakdown.length > 0 && (
          <Card style={{ marginTop: 16 }}>
            <Text style={styles.sectionHeading}>Campaign status mix</Text>
            {statusBreakdown.map((s) => (
              <View key={s.label} style={{ marginBottom: 10 }}>
                <View style={styles.barLabelRow}>
                  <Text style={styles.muted}>{s.label}</Text>
                  <Text style={styles.muted}>{s.value}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(4, (s.value / statusMax) * 100)}%` }]} />
                </View>
              </View>
            ))}
          </Card>
        )}

        <Card style={{ marginTop: 16 }}>
          <Text style={styles.sectionHeading}>Delivery funnel</Text>
          <FunnelStrip label="Recipients" value={stats.totalRecipients} pct={100} />
          <FunnelStrip label="Sent" value={stats.totalSent} pct={82} />
          <FunnelStrip label="Failed" value={stats.totalFailed} pct={18} />
          <Text style={styles.muted}>
            Delivery rate: {stats.deliveryRate}% · Failure rate: {stats.failureRate}%
          </Text>
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Text style={styles.sectionHeading}>Recent campaigns</Text>
          {recentCampaigns.length === 0 ? (
            <Text style={styles.muted}>No campaigns available yet.</Text>
          ) : (
            recentCampaigns.slice(0, 5).map((c) => (
              <View key={c.id} style={styles.campaignRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.campaignName}>{c.name}</Text>
                  <Text style={styles.muted}>Status: {c.status}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.muted}>
                    Sent {c.sent} / {c.total}
                  </Text>
                  <Text style={styles.muted}>Failed {c.failed}</Text>
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function FunnelStrip({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={styles.barLabelRow}>
        <Text style={styles.muted}>{label}</Text>
        <Text style={styles.textPrimary}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flex: 1, minWidth: '45%', alignItems: 'center' },
  statValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  sectionHeading: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  muted: { color: colors.textSecondary, fontSize: 12 },
  textPrimary: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
  campaignRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  campaignName: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
});
