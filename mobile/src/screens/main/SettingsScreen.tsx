import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Screen, Card, Field, PrimaryButton, SecondaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

function gmailFallbackName(email: string) {
  const value = typeof email === 'string' ? email.trim() : '';
  if (!value) return '';
  return value.split('@')[0] || '';
}

export default function SettingsScreen() {
  const { user, updateUser, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpFromDisplayName, setSmtpFromDisplayName] = useState('');
  const [role, setRole] = useState('candidate');
  const [roleSaving, setRoleSaving] = useState(false);
  const [hasGmailRefreshToken, setHasGmailRefreshToken] = useState(false);
  const [connectingGmail, setConnectingGmail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users/me/settings');
      setSmtpUser(data.smtpUser?.trim() || data.email || '');
      setSmtpFromDisplayName(
        data.smtpFromDisplayName?.trim() || gmailFallbackName(data.smtpUser || data.email) || data.name || ''
      );
      setHasGmailRefreshToken(Boolean(data.hasGmailRefreshToken));
      setRole(data.role || 'candidate');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not load settings.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveProfile() {
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me/settings', {
        smtpUser: smtpUser.trim() === '' ? '' : smtpUser.trim().toLowerCase(),
        smtpFromDisplayName: smtpFromDisplayName.trim(),
      });
      setSmtpUser(data.smtpUser?.trim() || data.email || '');
      setSmtpFromDisplayName(
        data.smtpFromDisplayName?.trim() || gmailFallbackName(data.smtpUser || data.email) || data.name || ''
      );
      Toast.show({ type: 'success', text1: 'Sender settings saved.' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(nextRole: string) {
    if (nextRole === role) return;
    setRoleSaving(true);
    try {
      const { data } = await api.patch('/users/me/settings', { role: nextRole });
      setRole(data.role);
      updateUser({ role: data.role });
      Toast.show({
        type: 'success',
        text1: data.role === 'recruiter' ? 'Switched to Recruiter.' : 'Switched to Candidate.',
      });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not update role.' });
    } finally {
      setRoleSaving(false);
    }
  }

  async function handleConnectGmail() {
    setConnectingGmail(true);
    try {
      const { data } = await api.get('/users/me/gmail/connect-url');
      if (!data?.url) throw new Error('No connect URL returned.');
      // Server-side OAuth: the callback lands on the backend, stores the
      // refresh token against this user, then redirects to the web app's
      // Settings page — which a phone can't necessarily reach. So instead of
      // chasing that redirect, just let the user finish in the in-app
      // browser and re-check status once they close it.
      await WebBrowser.openBrowserAsync(data.url);
      await load();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not start Gmail connect.' });
    } finally {
      setConnectingGmail(false);
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
        <Card>
          <Text style={styles.cardTitle}>Account type</Text>
          <Text style={styles.muted}>Candidates search and apply to jobs. Recruiters get a Recruiter section.</Text>
          <View style={styles.roleRow}>
            {[
              { value: 'candidate', label: 'Candidate', desc: 'Job hunting' },
              { value: 'recruiter', label: 'Recruiter', desc: 'Hiring' },
            ].map((opt) => (
              <Pressable
                key={opt.value}
                disabled={roleSaving}
                onPress={() => handleRoleChange(opt.value)}
                style={[styles.roleCard, role === opt.value ? styles.roleCardActive : null]}
              >
                <Text style={[styles.roleLabel, role === opt.value ? { color: colors.primary } : null]}>{opt.label}</Text>
                <Text style={styles.muted}>{opt.desc}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Text style={styles.cardTitle}>Profile</Text>
          <Text style={styles.muted}>Sender details for campaign emails.</Text>
          <View style={{ marginTop: 12 }}>
            <Field
              label="Gmail address"
              placeholder={user?.email || 'you@gmail.com'}
              value={smtpUser}
              onChangeText={setSmtpUser}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field
              label="Sender name (shown in From)"
              placeholder={gmailFallbackName(smtpUser || user?.email || '') || 'e.g. JobPilot'}
              value={smtpFromDisplayName}
              onChangeText={setSmtpFromDisplayName}
            />
            <PrimaryButton title={saving ? 'Saving…' : 'Save sender settings'} onPress={handleSaveProfile} loading={saving} />
          </View>
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Text style={styles.cardTitle}>Email sending</Text>
          <Text style={styles.muted}>
            Connect Gmail so JobPilot can send your campaigns. One click, no password ever touches this app.
          </Text>
          <View style={styles.gmailRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.gmailLabel}>Connect Gmail</Text>
              <Text style={styles.muted}>Required before campaigns can send.</Text>
            </View>
            {hasGmailRefreshToken ? (
              <View style={styles.connectedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={styles.connectedText}>Connected</Text>
              </View>
            ) : (
              <SecondaryButton
                title={connectingGmail ? 'Opening…' : 'Connect Gmail'}
                onPress={handleConnectGmail}
                disabled={connectingGmail}
              />
            )}
          </View>
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.value}>{user?.name || 'JobPilot user'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={{ marginTop: 16 }}>
            <SecondaryButton title="Log out" onPress={() => logout()} />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  roleRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  roleCard: { flex: 1, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 12, padding: 12 },
  roleCardActive: { borderColor: colors.primary, backgroundColor: 'rgba(99,102,241,0.1)' },
  roleLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  gmailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, backgroundColor: colors.bg, borderRadius: 12, padding: 12 },
  gmailLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  connectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(52,211,153,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  connectedText: { color: colors.success, fontSize: 11, fontWeight: '700' },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  value: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 4 },
  email: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
});
