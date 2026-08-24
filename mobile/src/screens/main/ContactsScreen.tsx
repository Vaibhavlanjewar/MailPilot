import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { Screen, Card, Field, PrimaryButton, SecondaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Contact = { id: string; name?: string; email: string; company?: string; subscribed: boolean };

export default function ContactsScreen() {
  const [rows, setRows] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toggleBusyId, setToggleBusyId] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState({ name: '', email: '', company: '' });
  const [addBusy, setAddBusy] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);

  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editDraft, setEditDraft] = useState({ name: '', email: '', company: '' });
  const [editBusy, setEditBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/contacts');
      setRows(data.contacts || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not load contacts.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.name || '').toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.company || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  async function toggleSubscription(row: Contact) {
    const next = !row.subscribed;
    setToggleBusyId(row.id);
    setRows((cur) => cur.map((c) => (c.id === row.id ? { ...c, subscribed: next } : c)));
    try {
      await api.patch(`/contacts/${row.id}/subscription`, { subscribed: next });
    } catch (err: any) {
      setRows((cur) => cur.map((c) => (c.id === row.id ? { ...c, subscribed: row.subscribed } : c)));
      Toast.show({ type: 'error', text1: err?.message || 'Could not update subscription.' });
    } finally {
      setToggleBusyId('');
    }
  }

  async function handleAddContact() {
    const email = addDraft.email.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      Toast.show({ type: 'error', text1: 'Enter a valid email address.' });
      return;
    }
    setAddBusy(true);
    try {
      await api.post('/contacts/bulk', {
        contacts: [{ name: addDraft.name.trim(), email, company: addDraft.company.trim() }],
      });
      await load();
      setAddDraft({ name: '', email: '', company: '' });
      setAddOpen(false);
      Toast.show({ type: 'success', text1: 'Contact added.' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not add contact.' });
    } finally {
      setAddBusy(false);
    }
  }

  async function handleUploadCsv() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const file = result.assets[0];

    setCsvBusy(true);
    try {
      const form = new FormData();
      // RN's FormData accepts a { uri, name, type } object in place of a Blob.
      form.append('file', { uri: file.uri, name: file.name || 'contacts.csv', type: 'text/csv' } as any);
      const { data } = await api.post('/contacts/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await load();
      Toast.show({ type: 'success', text1: `Imported ${data.imported} contact${data.imported === 1 ? '' : 's'}.` });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not import the CSV.' });
    } finally {
      setCsvBusy(false);
    }
  }

  function openEdit(row: Contact) {
    setEditContact(row);
    setEditDraft({ name: row.name || '', email: row.email, company: row.company || '' });
  }

  async function handleSaveEdit() {
    if (!editContact) return;
    const email = editDraft.email.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      Toast.show({ type: 'error', text1: 'Enter a valid email address.' });
      return;
    }
    setEditBusy(true);
    try {
      const { data } = await api.patch(`/contacts/${editContact.id}`, {
        name: editDraft.name.trim(),
        email,
        company: editDraft.company.trim(),
      });
      setRows((cur) => cur.map((c) => (c.id === editContact.id ? { ...c, ...(data.contact || editDraft) } : c)));
      setEditContact(null);
      Toast.show({ type: 'success', text1: 'Contact updated.' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not save contact.' });
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Field label="Search" placeholder="Search by name, email, or company" value={search} onChangeText={setSearch} />
        <View style={styles.headerButtons}>
          <View style={{ flex: 1 }}>
            <PrimaryButton title="+ Add contact" onPress={() => setAddOpen(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <SecondaryButton
              title={csvBusy ? 'Importing…' : 'Upload CSV'}
              onPress={handleUploadCsv}
              disabled={csvBusy}
            />
          </View>
        </View>
        <Text style={styles.note}>CSV needs name, email, company columns — email is required.</Text>
      </View>

      {loading && rows.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 40 }}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No contacts yet. Add one above.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 10 }}>
              <View style={styles.row}>
                <Pressable style={{ flex: 1 }} onPress={() => openEdit(item)}>
                  <Text style={styles.name}>{item.name || 'Unnamed contact'}</Text>
                  <Text style={styles.muted}>{item.email}</Text>
                  {item.company ? <Text style={styles.muted}>{item.company}</Text> : null}
                </Pressable>
                <View style={{ alignItems: 'center' }}>
                  <Switch
                    value={item.subscribed}
                    onValueChange={() => toggleSubscription(item)}
                    disabled={toggleBusyId === item.id}
                    trackColor={{ true: colors.primary }}
                  />
                  <Text style={styles.switchLabel}>{item.subscribed ? 'Subscribed' : 'Unsubscribed'}</Text>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add contact</Text>
            <Field label="Name" placeholder="Optional" value={addDraft.name} onChangeText={(v) => setAddDraft((p) => ({ ...p, name: v }))} />
            <Field label="Company" placeholder="Optional" value={addDraft.company} onChangeText={(v) => setAddDraft((p) => ({ ...p, company: v }))} />
            <Field
              label="Email"
              placeholder="contact@example.com"
              value={addDraft.email}
              onChangeText={(v) => setAddDraft((p) => ({ ...p, email: v }))}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={styles.modalButtons}>
              <SecondaryButton title="Cancel" onPress={() => setAddOpen(false)} disabled={addBusy} />
              <PrimaryButton title={addBusy ? 'Saving…' : 'Save'} onPress={handleAddContact} loading={addBusy} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editContact} transparent animationType="fade" onRequestClose={() => setEditContact(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit contact</Text>
            <Field label="Name" value={editDraft.name} onChangeText={(v) => setEditDraft((p) => ({ ...p, name: v }))} />
            <Field label="Company" value={editDraft.company} onChangeText={(v) => setEditDraft((p) => ({ ...p, company: v }))} />
            <Field
              label="Email"
              value={editDraft.email}
              onChangeText={(v) => setEditDraft((p) => ({ ...p, email: v }))}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={styles.modalButtons}>
              <SecondaryButton title="Cancel" onPress={() => setEditContact(null)} disabled={editBusy} />
              <PrimaryButton title={editBusy ? 'Saving…' : 'Save changes'} onPress={handleSaveEdit} loading={editBusy} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, paddingBottom: 8, gap: 10 },
  headerButtons: { flexDirection: 'row', gap: 10 },
  note: { color: colors.textSecondary, fontSize: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  switchLabel: { color: colors.textSecondary, fontSize: 9, marginTop: 4, textTransform: 'uppercase' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, width: '100%', maxWidth: 420 },
  modalTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
