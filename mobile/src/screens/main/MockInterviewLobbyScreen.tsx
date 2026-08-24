import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../services/api';
import { Screen, Card, Field, PrimaryButton, SecondaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

function formatWhen(value: string) {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function defaultStart() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

/**
 * A meeting link shared by someone else always points at the web app
 * (mailpilot.../app/mock-interview/:code) — the invitee's browser has no way
 * to know the app exists. This lets them paste that link (or just the bare
 * code) here instead, so the app can join directly without OS-level deep
 * link handling.
 */
function extractRoomCode(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const withoutQuery = trimmed.split(/[?#]/)[0];
  const segments = withoutQuery.split('/').filter(Boolean);
  return segments[segments.length - 1] || '';
}

type Meeting = {
  code: string;
  title?: string;
  status: string;
  scheduledAt?: string;
  durationMinutes?: number;
  inviteeEmail?: string;
  canJoinNow?: boolean;
  joinOpensAt?: string;
  joinUrl: string;
  isOwner: boolean;
};

export default function MockInterviewLobbyScreen() {
  const navigation = useNavigation<any>();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date>(defaultStart());
  const [joinLink, setJoinLink] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [inviteeEmail, setInviteeEmail] = useState('');

  const loadMeetings = useCallback(async () => {
    try {
      const { data } = await api.get('/mock-interview/meetings');
      setMeetings(data.meetings || []);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
    const timer = setInterval(loadMeetings, 60_000);
    return () => clearInterval(timer);
  }, [loadMeetings]);

  function joinViaLink() {
    const code = extractRoomCode(joinLink);
    if (!code) {
      Toast.show({ type: 'error', text1: 'Paste a valid invite link or room code.' });
      return;
    }
    setJoinLink('');
    navigation.navigate('MockInterviewRoom', { code });
  }

  async function createRoom() {
    setCreating(true);
    try {
      const { data } = await api.post('/mock-interview/rooms');
      navigation.navigate('MockInterviewRoom', { code: data.room.code });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not create a room.' });
    } finally {
      setCreating(false);
    }
  }

  async function scheduleMeeting() {
    setScheduling(true);
    try {
      const { data } = await api.post('/mock-interview/meetings', {
        title,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes,
        inviteeEmail: inviteeEmail.trim(),
      });
      Toast.show({
        type: 'success',
        text1: data.inviteSent ? 'Meeting scheduled and invite sent.' : 'Meeting scheduled.',
      });
      setTitle('');
      setInviteeEmail('');
      setScheduledAt(defaultStart());
      setShowForm(false);
      loadMeetings();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not schedule the meeting.' });
    } finally {
      setScheduling(false);
    }
  }

  async function cancelMeeting(code: string) {
    try {
      await api.patch(`/mock-interview/meetings/${code}/cancel`);
      Toast.show({ type: 'success', text1: 'Meeting cancelled.' });
      loadMeetings();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not cancel.' });
    }
  }

  function confirmRemove(code: string) {
    Alert.alert('Remove this room?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/mock-interview/rooms/${code}`);
            Toast.show({ type: 'success', text1: 'Room removed.' });
            loadMeetings();
          } catch (err: any) {
            Toast.show({ type: 'error', text1: err?.message || 'Could not remove the room.' });
          }
        },
      },
    ]);
  }

  async function copyLink(url: string) {
    await Clipboard.setStringAsync(url);
    Toast.show({ type: 'success', text1: 'Link copied.' });
  }

  const scheduled = meetings.filter((m) => m.scheduledAt);
  const instant = meetings.filter((m) => !m.scheduledAt);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.title}>Live Practice Room</Text>
        <Text style={styles.subtitle}>
          Video + audio mock interviews with someone else on JobPilot. Peer-to-peer, nothing
          recorded or stored.
        </Text>
        <Text style={styles.note}>
          Uses your device's camera and microphone — you'll be asked to allow access when you join.
        </Text>

        <View style={styles.actionsRow}>
          <PrimaryButton title={creating ? 'Creating…' : 'Start now'} onPress={createRoom} loading={creating} />
          <SecondaryButton title="Schedule for later" onPress={() => setShowForm((v) => !v)} />
        </View>

        <Card style={{ marginTop: 16 }}>
          <Text style={styles.cardTitle}>Have an invite link?</Text>
          <Text style={styles.muted}>
            Someone shared a JobPilot meeting link with you — paste it here to join right in the app.
          </Text>
          <Field
            label="Invite link or room code"
            placeholder="https://... or just the code"
            value={joinLink}
            onChangeText={setJoinLink}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <PrimaryButton title="Join" onPress={joinViaLink} disabled={!joinLink.trim()} />
        </Card>

        {showForm && (
          <Card style={{ marginTop: 16 }}>
            <Text style={styles.cardTitle}>New meeting</Text>
            <Field label="What is it about?" placeholder="e.g. Backend round practice" value={title} onChangeText={setTitle} />
            <Text style={styles.fieldLabel}>When</Text>
            <DateTimePicker
              value={scheduledAt}
              mode="datetime"
              minimumDate={new Date()}
              onChange={(_, date) => date && setScheduledAt(date)}
              style={{ alignSelf: 'flex-start', marginBottom: 12 }}
            />
            <Field
              label="Invite by email (optional)"
              placeholder="them@example.com"
              value={inviteeEmail}
              onChangeText={setInviteeEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <PrimaryButton title={scheduling ? 'Scheduling…' : 'Schedule meeting'} onPress={scheduleMeeting} loading={scheduling} />
          </Card>
        )}

        <Card style={{ marginTop: 16 }}>
          <Text style={styles.cardTitle}>Upcoming</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : scheduled.length === 0 ? (
            <Text style={styles.muted}>Nothing scheduled yet.</Text>
          ) : (
            scheduled.map((m) => (
              <View key={m.code} style={styles.meetingCard}>
                <Text style={styles.meetingTitle}>{m.title}</Text>
                <Text style={styles.muted}>
                  {formatWhen(m.scheduledAt!)} · {m.durationMinutes} min
                  {m.inviteeEmail ? ` · with ${m.inviteeEmail}` : ''}
                </Text>
                <Text style={styles.statusBadge}>{m.status}</Text>
                <View style={styles.meetingActions}>
                  <SecondaryButton title="Copy link" onPress={() => copyLink(m.joinUrl)} />
                  {m.isOwner ? (
                    <>
                      <SecondaryButton title="Cancel" onPress={() => cancelMeeting(m.code)} />
                      <SecondaryButton title="Remove" onPress={() => confirmRemove(m.code)} />
                    </>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </Card>

        {instant.length > 0 && (
          <Card style={{ marginTop: 16 }}>
            <Text style={styles.cardTitle}>Open rooms</Text>
            {instant.map((r) => (
              <View key={r.code} style={styles.meetingCard}>
                <Text style={styles.meetingTitle}>{r.code}</Text>
                <Text style={styles.statusBadge}>{r.status}</Text>
                <View style={styles.meetingActions}>
                  <SecondaryButton title="Copy link" onPress={() => copyLink(r.joinUrl)} />
                  {r.isOwner ? <SecondaryButton title="Remove" onPress={() => confirmRemove(r.code)} /> : null}
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  note: { color: colors.warning, fontSize: 11, marginTop: 10, lineHeight: 16 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  fieldLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  muted: { color: colors.textSecondary, fontSize: 12 },
  meetingCard: { backgroundColor: colors.bg, borderColor: colors.surfaceBorder, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 8 },
  meetingTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  statusBadge: { color: colors.secondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 6 },
  meetingActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
});
