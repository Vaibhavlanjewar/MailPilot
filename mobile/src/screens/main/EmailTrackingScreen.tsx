import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { Screen, Card } from '../../components/ui';
import { colors } from '../../theme/colors';

type Row = {
  id: string;
  campaignName: string;
  opened: boolean;
  openCount: number;
  recentlyOpenedAt: string | null;
  name: string;
  email: string;
};

export default function EmailTrackingScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const { data } = await api.get('/email-tracking', { params: { search: q || undefined, limit: 30 } });
      setRows(data.items || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not load tracking data.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(search), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.subtitle}>Delivery and open status per recipient.</Text>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or email"
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
          />
        </View>
      </View>

      {loading && rows.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 40 }}
          onRefresh={() => load(search)}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No tracking data yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 10 }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name || item.email}</Text>
                  <Text style={styles.muted}>{item.email}</Text>
                  <Text style={styles.muted}>{item.campaignName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.status, { color: item.opened ? colors.success : colors.textSecondary }]}>
                    {item.opened ? `Opened ×${item.openCount}` : 'Not opened'}
                  </Text>
                  {item.recentlyOpenedAt ? (
                    <Text style={styles.muted}>{new Date(item.recentlyOpenedAt).toLocaleString()}</Text>
                  ) : null}
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, gap: 10 },
  subtitle: { color: colors.textSecondary, fontSize: 13 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  status: { fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
});
