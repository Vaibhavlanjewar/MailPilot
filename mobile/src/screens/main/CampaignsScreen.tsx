import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { Screen, PrimaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

function campaignUiStatus(c: { status: string; scheduledAt?: string | null }) {
  if (c.status === 'processing') return { label: 'Processing', color: colors.secondary };
  if (c.status === 'completed') return { label: 'Completed', color: colors.success };
  if (c.status === 'pending' && c.scheduledAt) {
    const t = new Date(c.scheduledAt).getTime();
    if (!Number.isNaN(t) && t > Date.now()) return { label: 'Scheduled', color: colors.warning };
  }
  return { label: 'Pending', color: colors.textSecondary };
}

type Campaign = {
  _id: string;
  name: string;
  status: string;
  scheduledAt?: string | null;
  stats?: { sent?: number; total?: number };
  updatedAt?: string;
  createdAt?: string;
};

export default function CampaignsScreen() {
  const navigation = useNavigation<any>();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/campaign');
      setCampaigns(data.campaigns || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not load campaigns.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function confirmDelete(campaign: Campaign) {
    Alert.alert(
      `Delete "${campaign.name}"?`,
      "This permanently removes the campaign and all its recipient records. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/campaign/${campaign._id}`);
              setCampaigns((prev) => prev.filter((c) => c._id !== campaign._id));
              Toast.show({ type: 'success', text1: `Deleted "${campaign.name}".` });
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.message || 'Could not delete the campaign.' });
            }
          },
        },
      ]
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.subtitle}>Campaigns from the API, with live status.</Text>
        <PrimaryButton title="+ Create campaign" onPress={() => navigation.navigate('CampaignCreate')} />
      </View>
      {loading && campaigns.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No campaigns yet.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const status = campaignUiStatus(item);
            const date = item.updatedAt || item.createdAt;
            return (
              <Pressable
                style={styles.card}
                onPress={() => navigation.navigate('CampaignDetail', { id: item._id, name: item.name })}
                onLongPress={() => confirmDelete(item)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.stats?.sent ?? 0}/{item.stats?.total ?? 0} sent
                    {date ? ` · ${new Date(date).toLocaleDateString()}` : ''}
                  </Text>
                </View>
                <Text style={[styles.statusBadge, { color: status.color, borderColor: status.color }]}>
                  {status.label}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  subtitle: { color: colors.textSecondary, fontSize: 13 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  name: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  meta: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  statusBadge: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
});
