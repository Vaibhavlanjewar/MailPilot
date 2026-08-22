import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen, Card } from '../../components/ui';
import { colors } from '../../theme/colors';

export default function ContactUsScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.title}>Get in Touch</Text>
        <Text style={styles.subtitle}>
          Have any questions or need more information? We'd love to hear from you.
        </Text>

        <Card style={{ marginTop: 16 }}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.link} onPress={() => Linking.openURL('mailto:mailpilot.io@gmail.com')}>
            mailpilot.io@gmail.com
          </Text>

          <Text style={[styles.label, { marginTop: 16 }]}>Address</Text>
          <Text style={styles.body}>
            Veerannapalya (Near Nagawara / Manyata Tech Park),{'\n'}
            Arabic College Post,{'\n'}
            Bengaluru North Taluk,{'\n'}
            Bengaluru - 560045,{'\n'}
            Karnataka, India
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 19 },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  body: { color: colors.textPrimary, fontSize: 13, marginTop: 6, lineHeight: 20 },
  link: { color: colors.primary, fontSize: 14, marginTop: 6, fontWeight: '600' },
});
