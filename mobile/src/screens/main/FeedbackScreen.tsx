import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import { Screen, Card, Field, PrimaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

export default function FeedbackScreen() {
  const navigation = useNavigation<any>();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!message.trim()) {
      Toast.show({ type: 'info', text1: 'Write a message first.' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/feedback', { message: message.trim(), page: 'mobile-app' });
      Toast.show({ type: 'success', text1: "Thanks — we've got it." });
      setMessage('');
      navigation.goBack();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not send feedback.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.title}>Send feedback</Text>
        <Text style={styles.subtitle}>Bugs, ideas, anything — goes straight to the team.</Text>

        <Card style={{ marginTop: 16 }}>
          <Field
            label="Message"
            placeholder="What's on your mind?"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            style={{ minHeight: 140, textAlignVertical: 'top' }}
          />
          <PrimaryButton title={submitting ? 'Sending…' : 'Send feedback'} onPress={submit} loading={submitting} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
});
