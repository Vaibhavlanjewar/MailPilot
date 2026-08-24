import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import { Screen, Card, Field, PrimaryButton, SecondaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

type Contact = { id: string; name?: string; email: string; company?: string; subscribed: boolean };
type Template = { _id: string; name: string; subject: string; body: string };

const MAX_RECIPIENTS_PER_CAMPAIGN = 100;
const DAILY_RECIPIENT_LIMIT = 450;

function defaultScheduleDate() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

export default function CampaignCreateScreen() {
  const navigation = useNavigation<any>();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const [hasResume, setHasResume] = useState(false);
  const [attachResume, setAttachResume] = useState(true);

  const [sender, setSender] = useState<{ address: string; displayName: string; hasGmail: boolean } | null>(null);

  const [limits, setLimits] = useState({
    maxRecipientsPerCampaign: MAX_RECIPIENTS_PER_CAMPAIGN,
    dailyLimit: DAILY_RECIPIENT_LIMIT,
    remainingToday: DAILY_RECIPIENT_LIMIT,
  });

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [scheduleAt, setScheduleAt] = useState<Date>(defaultScheduleDate());
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setContactsLoading(true);
    try {
      const [{ data: contactsData }, { data: templatesData }, { data: resumeData }, { data: limitsData }, { data: settingsData }] =
        await Promise.all([
          api.get('/contacts'),
          api.get('/templates'),
          api.get('/resumes/me').catch(() => ({ data: {} })),
          api.get('/campaign/limits').catch(() => ({ data: {} })),
          api.get('/users/me/settings').catch(() => ({ data: {} })),
        ]);
      setContacts(contactsData.contacts || []);
      setTemplates(templatesData.templates || []);
      setHasResume(Boolean(resumeData.resume));
      if (limitsData.maxRecipientsPerCampaign) {
        setLimits({
          maxRecipientsPerCampaign: limitsData.maxRecipientsPerCampaign,
          dailyLimit: limitsData.dailyLimit,
          remainingToday: limitsData.remainingToday,
        });
      }
      if (settingsData?.email) {
        const address = (settingsData.smtpUser || '').trim() || (settingsData.email || '').trim();
        setSender({
          address,
          displayName:
            (settingsData.smtpFromDisplayName || '').trim() ||
            (settingsData.name || '').trim() ||
            address.split('@')[0],
          hasGmail: Boolean(settingsData.hasGmailRefreshToken),
        });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not load campaign setup.' });
    } finally {
      setContactsLoading(false);
    }
  }, []);

  // Refreshes contacts/resume/Gmail status when returning from Recipients,
  // My Resume, or Settings — mirrors the web wizard resuming with fresh data
  // after those same round trips.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const activeContacts = useMemo(() => contacts.filter((c) => c.subscribed !== false), [contacts]);
  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeContacts;
    return activeContacts.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q)
    );
  }, [activeContacts, search]);

  function toggleContact(id: string) {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function applyTemplate(tpl: Template) {
    setSelectedTemplateId(tpl._id);
    setBody(tpl.body || '');
    if (!subject.trim()) setSubject(tpl.subject || '');
  }

  const recipientCount = selectedIds.length;
  const overCampaignMax = recipientCount > limits.maxRecipientsPerCampaign;
  const overDailyLimit = recipientCount > limits.remainingToday;

  const canSubmit =
    recipientCount > 0 &&
    !overCampaignMax &&
    !overDailyLimit &&
    name.trim().length > 0 &&
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const scheduledAtIso = sendMode === 'schedule' ? scheduleAt.toISOString() : undefined;

      const { data: createData } = await api.post('/campaign/create', {
        name: name.trim(),
        subject: subject.trim(),
        content: body,
        contactIds: selectedIds,
        attachResume: hasResume ? attachResume : false,
        ...(scheduledAtIso ? { scheduledAt: scheduledAtIso } : {}),
      });

      const campaignId = createData.campaign._id;
      await api.post(`/campaign/send/${campaignId}`, {
        ...(scheduledAtIso ? { scheduledAt: scheduledAtIso } : {}),
      });

      Toast.show({
        type: 'success',
        text1: sendMode === 'schedule' ? 'Campaign scheduled.' : 'Campaign queued for delivery.',
      });
      navigation.replace('CampaignDetail', { id: campaignId, name: name.trim() });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not create the campaign.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {sender && !sender.hasGmail && (
          <Card style={{ marginBottom: 14, borderColor: colors.warning }}>
            <Text style={styles.sectionTitle}>Gmail isn't connected</Text>
            <Text style={styles.muted}>
              This campaign can't be delivered until Gmail is connected as the sender.
            </Text>
            <View style={{ marginTop: 10 }}>
              <SecondaryButton title="Connect Gmail in Settings" onPress={() => navigation.navigate('Settings')} />
            </View>
          </Card>
        )}

        <Card style={{ marginBottom: 14 }}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recipients</Text>
            <Pressable onPress={() => navigation.navigate('Contacts')}>
              <Text style={styles.link}>Manage contacts / Upload CSV</Text>
            </Pressable>
          </View>
          <Text style={styles.muted}>
            {recipientCount} selected · {limits.remainingToday} sends left today
          </Text>
          {(overCampaignMax || overDailyLimit) && (
            <Text style={styles.errorText}>
              {overCampaignMax
                ? `Max ${limits.maxRecipientsPerCampaign} recipients allowed per campaign.`
                : `Daily limit exceeded. Remaining today: ${limits.remainingToday}.`}
            </Text>
          )}
          <Field
            label="Search contacts"
            placeholder="Search by name, email, or company"
            value={search}
            onChangeText={setSearch}
          />
          {contactsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : filteredContacts.length === 0 ? (
            <View>
              <Text style={styles.muted}>No contacts yet.</Text>
              <View style={{ marginTop: 10 }}>
                <SecondaryButton title="Add contacts" onPress={() => navigation.navigate('Contacts')} />
              </View>
            </View>
          ) : (
            <View style={styles.contactList}>
              {filteredContacts.map((contact) => {
                const checked = selectedIds.includes(contact.id);
                return (
                  <Pressable
                    key={contact.id}
                    onPress={() => toggleContact(contact.id)}
                    style={[styles.contactRow, checked ? styles.contactRowChecked : null]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{contact.name || 'Unnamed contact'}</Text>
                      <Text style={styles.muted}>{contact.email}</Text>
                    </View>
                    <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
                      {checked ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <Text style={styles.sectionTitle}>Template (optional)</Text>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setSelectedTemplateId('')}
              style={[styles.chip, !selectedTemplateId ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, !selectedTemplateId ? styles.chipTextActive : null]}>
                Write from scratch
              </Text>
            </Pressable>
            {templates.map((tpl) => (
              <Pressable
                key={tpl._id}
                onPress={() => applyTemplate(tpl)}
                style={[styles.chip, selectedTemplateId === tpl._id ? styles.chipActive : null]}
              >
                <Text style={[styles.chipText, selectedTemplateId === tpl._id ? styles.chipTextActive : null]}>
                  {tpl.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>
            Placeholders like {'{{name}}'}, {'{{first_name}}'}, and {'{{email}}'} work in the subject or body.
          </Text>
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <Text style={styles.sectionTitle}>Campaign</Text>
          <Field
            label="Campaign name"
            placeholder="Python developer outreach — batch 1"
            value={name}
            onChangeText={setName}
          />
          <Field
            label="Subject line"
            placeholder="Quick question about {{company}}"
            value={subject}
            onChangeText={setSubject}
          />
          <Field
            label="Email content (HTML)"
            placeholder={'<p>Hi {{first_name}},</p>'}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={10}
            style={{ minHeight: 180, textAlignVertical: 'top' }}
          />
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <Text style={styles.sectionTitle}>Send</Text>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setSendMode('now')}
              style={[styles.chip, sendMode === 'now' ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, sendMode === 'now' ? styles.chipTextActive : null]}>Send now</Text>
            </Pressable>
            <Pressable
              onPress={() => setSendMode('schedule')}
              style={[styles.chip, sendMode === 'schedule' ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, sendMode === 'schedule' ? styles.chipTextActive : null]}>Schedule</Text>
            </Pressable>
          </View>
          {sendMode === 'schedule' && (
            <DateTimePicker
              value={scheduleAt}
              mode="datetime"
              minimumDate={new Date()}
              onChange={(_, date) => date && setScheduleAt(date)}
              style={{ alignSelf: 'flex-start', marginTop: 12 }}
            />
          )}

          {hasResume ? (
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>Attach my resume</Text>
                <Text style={styles.muted}>Sends the resume on file with every email in this campaign.</Text>
              </View>
              <Switch value={attachResume} onValueChange={setAttachResume} trackColor={{ true: colors.primary }} />
            </View>
          ) : (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.hint}>No resume on file, so nothing will be attached.</Text>
              <Pressable onPress={() => navigation.navigate('MyResume')} style={{ marginTop: 6 }}>
                <Text style={styles.link}>Add one under My Resume</Text>
              </Pressable>
            </View>
          )}
        </Card>

        <PrimaryButton
          title={submitting ? 'Submitting…' : sendMode === 'schedule' ? 'Schedule campaign' : 'Send campaign'}
          onPress={submit}
          loading={submitting}
          disabled={!canSubmit}
        />
        <View style={{ height: 10 }} />
        <SecondaryButton title="Cancel" onPress={() => navigation.goBack()} disabled={submitting} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  link: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  muted: { color: colors.textSecondary, fontSize: 12, marginBottom: 10 },
  hint: { color: colors.textSecondary, fontSize: 11, marginTop: 8, lineHeight: 16 },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '600', marginBottom: 10 },
  name: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  contactList: { maxHeight: 320, gap: 8 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  contactRowChecked: { borderColor: colors.primary },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.bg,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
});
