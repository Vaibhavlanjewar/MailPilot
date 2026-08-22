import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Card, SecondaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

const OUTREACH_STEPS = [
  { title: '1. Add your resume', description: 'One resume powers everything — AI-personalised emails, interview prep, and your roadmap.', screen: 'MyResume', action: 'Add resume' },
  { title: '2. Set up sending', description: 'Connect Gmail with one click, or add a Gmail App Password. Nothing sends until this is done.', screen: 'Settings', action: 'Set up sending' },
  { title: '3. Add recipients', description: "Upload a CSV or add people one by one from Recipients.", screen: 'Contacts', action: 'Manage recipients' },
  { title: '4. Write or generate a template', description: 'Write from scratch, or generate one with AI from a job description.', screen: 'Templates', action: 'Open templates' },
  { title: '5. Build a campaign', description: 'Name it, pick recipients, add content, review, and send now or schedule.', screen: 'Campaigns', action: 'Create campaign' },
  { title: '6. Track delivery', description: 'Watch sent/failed counts, opens and per-recipient status.', screen: 'Analytics', action: 'View analytics' },
];

const CAREER_STEPS = [
  { title: '1. Ask questions about your resume', description: 'Open-ended chat grounded in your actual resume.', screen: 'ResumeRag', action: 'Ask my resume' },
  { title: '2. Prepare for an interview', description: 'Staged practice questions and a live coach chat.', screen: 'InterviewPrep', action: 'Open interview prep' },
  { title: '3. Build a learning roadmap', description: 'A staged path to your target role, tailored to your resume.', screen: 'Roadmap', action: 'Build a roadmap' },
  { title: '4. Browse jobs', description: 'Search and filter real listings, save the ones you like.', screen: 'JobSearch', action: 'Open job board' },
  { title: '5. Join the community', description: 'Share referrals, interview experiences, and salary data.', screen: 'Community', action: 'Open community' },
];

export default function HowToUseScreen() {
  const navigation = useNavigation<any>();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.title}>How To Use JobPilot</Text>

        <Text style={styles.sectionHeading}>Outreach</Text>
        {OUTREACH_STEPS.map((s) => (
          <Card key={s.title} style={{ marginBottom: 10 }}>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={styles.stepBody}>{s.description}</Text>
            <View style={{ marginTop: 10 }}>
              <SecondaryButton title={s.action} onPress={() => navigation.navigate(s.screen)} />
            </View>
          </Card>
        ))}

        <Text style={[styles.sectionHeading, { marginTop: 10 }]}>CareerPilot</Text>
        {CAREER_STEPS.map((s) => (
          <Card key={s.title} style={{ marginBottom: 10 }}>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={styles.stepBody}>{s.description}</Text>
            <View style={{ marginTop: 10 }}>
              <SecondaryButton title={s.action} onPress={() => navigation.navigate(s.screen)} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  sectionHeading: { color: colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10 },
  stepTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  stepBody: { color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 18 },
});
