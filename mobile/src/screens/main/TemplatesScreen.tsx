import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { Screen, Card, PrimaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

type Template = { _id: string; name: string; subject: string; updatedAt: string };

export default function TemplatesScreen() {
  const [rows, setRows] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/templates');
      setRows(data.templates || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not load templates.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function confirmDelete(row: Template) {
    Alert.alert(`Delete "${row.name}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(row._id);
          try {
            await api.delete(`/templates/${row._id}`);
            setRows((prev) => prev.filter((t) => t._id !== row._id));
          } catch (err: any) {
            Toast.show({ type: 'error', text1: err?.message || 'Could not delete.' });
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.subtitle}>Reusable email templates for your campaigns.</Text>
        <PrimaryButton
          title="+ New template"
          onPress={() =>
            Toast.show({ type: 'info', text1: 'Template editor is web-only for now.' })
          }
        />
      </View>
      {loading && rows.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 40 }}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No templates yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 10 }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.muted}>{item.subject}</Text>
                  <Text style={styles.muted}>Updated {new Date(item.updatedAt).toLocaleDateString()}</Text>
                </View>
                <Pressable onPress={() => confirmDelete(item)} disabled={deletingId === item._id}>
                  <Text style={styles.deleteText}>{deletingId === item._id ? '…' : 'Delete'}</Text>
                </Pressable>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
});
