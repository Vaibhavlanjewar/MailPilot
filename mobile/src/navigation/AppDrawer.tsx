import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { colors, gradient } from '../theme/colors';
import DashboardScreen from '../screens/main/DashboardScreen';
import JobSearchScreen from '../screens/main/JobSearchScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import MyResumeScreen from '../screens/main/MyResumeScreen';
import CareerFitScreen from '../screens/main/CareerFitScreen';
import RoadmapScreen from '../screens/main/RoadmapScreen';
import CampaignsStack from './CampaignsStack';
import ContactsScreen from '../screens/main/ContactsScreen';
import TemplatesScreen from '../screens/main/TemplatesScreen';
import AnalyticsScreen from '../screens/main/AnalyticsScreen';
import EmailTrackingScreen from '../screens/main/EmailTrackingScreen';
import ResumeRagScreen from '../screens/main/ResumeRagScreen';
import InterviewPrepScreen from '../screens/main/InterviewPrepScreen';
import CommunityScreen from '../screens/main/CommunityScreen';
import MockInterviewStack from './MockInterviewStack';
import PostJobScreen from '../screens/main/PostJobScreen';
import MyPostingsScreen from '../screens/main/MyPostingsScreen';
import HowToUseScreen from '../screens/main/HowToUseScreen';
import ContactUsScreen from '../screens/main/ContactUsScreen';
import FeedbackScreen from '../screens/main/FeedbackScreen';
import MindGamesScreen from '../screens/main/MindGamesScreen';
import PlaceholderScreen from '../screens/main/PlaceholderScreen';

const Drawer = createDrawerNavigator();

type NavItem = { name: string; label: string; icon: keyof typeof Ionicons.glyphMap; title?: string };
type NavSection = { heading?: string; product?: boolean; items: NavItem[] };

// Mirrors client/src/components/layout/Sidebar.jsx's grouping — same two
// products (Outreach, CareerPilot) plus Account/Recruiter utility sections.
const NAV_SECTIONS: NavSection[] = [
  { items: [{ name: 'MyResume', label: 'Upload Resume', icon: 'document-text-outline' }] },
  {
    heading: 'Outreach',
    product: true,
    items: [
      { name: 'Dashboard', label: 'Dashboard', icon: 'grid-outline' },
      { name: 'Campaigns', label: 'Campaigns', icon: 'megaphone-outline' },
      { name: 'Contacts', label: 'Recipients', icon: 'people-outline' },
      { name: 'Templates', label: 'Email Templates', icon: 'document-outline' },
      { name: 'EmailTracking', label: 'Delivery & Opens', icon: 'time-outline' },
      { name: 'Analytics', label: 'Analytics', icon: 'bar-chart-outline' },
    ],
  },
  {
    heading: 'CareerPilot',
    product: true,
    items: [
      { name: 'ResumeRag', label: 'Ask My Resume', icon: 'chatbox-ellipses-outline' },
      { name: 'CareerFit', label: 'Career Fit', icon: 'compass-outline' },
      { name: 'Roadmap', label: 'Learning Roadmap', icon: 'map-outline' },
      { name: 'InterviewPrep', label: 'Interview Prep', icon: 'school-outline' },
      { name: 'MockInterviewLobby', label: 'Live Practice Room', icon: 'videocam-outline' },
      { name: 'JobSearch', label: 'Job Board', icon: 'briefcase-outline' },
      { name: 'Community', label: 'Community', icon: 'chatbubbles-outline' },
      { name: 'MindGames', label: 'Mind Games', icon: 'extension-puzzle-outline' },
    ],
  },
  {
    heading: 'Recruiter',
    items: [
      { name: 'PostJob', label: 'Post a Job', icon: 'add-circle-outline' },
      { name: 'MyPostings', label: 'My Postings', icon: 'briefcase-outline' },
    ],
  },
  {
    heading: 'Account',
    items: [
      { name: 'Settings', label: 'Settings', icon: 'settings-outline' },
      { name: 'HowToUse', label: 'How To Use', icon: 'help-circle-outline' },
      { name: 'ContactUs', label: 'Contact Us', icon: 'mail-outline' },
      { name: 'Feedback', label: 'Send Feedback', icon: 'chatbox-ellipses-outline' },
    ],
  },
];

function CustomDrawerContent(props: any) {
  const { logout } = useAuth();
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
      <View style={styles.header}>
        <LinearGradient colors={gradient as unknown as [string, string]} style={styles.logo}>
          <Text style={styles.logoText}>JP</Text>
        </LinearGradient>
        <Text style={styles.brand}>JobPilot</Text>
      </View>

      {NAV_SECTIONS.map((section) => (
        <View key={section.heading || 'top'} style={styles.section}>
          {section.heading ? (
            <Text style={[styles.sectionHeading, section.product ? styles.sectionHeadingAccent : null]}>
              {section.heading}
            </Text>
          ) : null}
          {section.items.map((item) => {
            const isActive = props.state.routeNames[props.state.index] === item.name;
            return (
              <Pressable
                key={item.name}
                onPress={() => props.navigation.navigate(item.name)}
                style={[styles.item, isActive ? styles.itemActive : null]}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={isActive ? colors.primary : colors.textSecondary}
                  style={{ marginRight: 12 }}
                />
                <Text style={[styles.itemLabel, isActive ? styles.itemLabelActive : null]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Pressable style={styles.logout} onPress={() => logout()}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} style={{ marginRight: 12 }} />
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </DrawerContentScrollView>
  );
}

function withTitle(title: string) {
  return (props: any) => <PlaceholderScreen {...props} route={{ ...props.route, params: { title } }} />;
}

export default function AppDrawer() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        drawerStyle: { backgroundColor: colors.surface, width: 280 },
      }}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} />
      <Drawer.Screen name="Campaigns" component={CampaignsStack} options={{ headerShown: false }} />
      <Drawer.Screen name="Contacts" component={ContactsScreen} options={{ title: 'Recipients' }} />
      <Drawer.Screen name="Templates" component={TemplatesScreen} options={{ title: 'Email Templates' }} />
      <Drawer.Screen name="EmailTracking" component={EmailTrackingScreen} options={{ title: 'Delivery & Opens' }} />
      <Drawer.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Analytics' }} />
      <Drawer.Screen name="MyResume" component={MyResumeScreen} options={{ title: 'My Resume' }} />
      <Drawer.Screen name="ResumeRag" component={ResumeRagScreen} options={{ title: 'Ask My Resume' }} />
      <Drawer.Screen name="CareerFit" component={CareerFitScreen} options={{ title: 'Career Fit' }} />
      <Drawer.Screen name="Roadmap" component={RoadmapScreen} options={{ title: 'Learning Roadmap' }} />
      <Drawer.Screen name="InterviewPrep" component={InterviewPrepScreen} options={{ title: 'Interview Prep' }} />
      <Drawer.Screen name="MockInterviewLobby" component={MockInterviewStack} options={{ headerShown: false, title: 'Live Practice Room' }} />
      <Drawer.Screen name="JobSearch" component={JobSearchScreen} options={{ title: 'Job Board' }} />
      <Drawer.Screen name="Community" component={CommunityScreen} options={{ title: 'Community' }} />
      <Drawer.Screen name="MindGames" component={MindGamesScreen} options={{ title: 'Mind Games' }} />
      <Drawer.Screen name="PostJob" component={PostJobScreen} options={{ title: 'Post a Job' }} />
      <Drawer.Screen name="MyPostings" component={MyPostingsScreen} options={{ title: 'My Postings' }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
      <Drawer.Screen name="HowToUse" component={HowToUseScreen} options={{ title: 'How To Use' }} />
      <Drawer.Screen name="ContactUs" component={ContactUsScreen} options={{ title: 'Contact Us' }} />
      <Drawer.Screen name="Feedback" component={FeedbackScreen} options={{ title: 'Send Feedback' }} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20 },
  logo: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  brand: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  section: { marginBottom: 18, paddingHorizontal: 12 },
  sectionHeading: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  sectionHeadingAccent: { color: colors.primary },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  itemActive: { backgroundColor: 'rgba(99,102,241,0.14)' },
  itemLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  itemLabelActive: { color: colors.primary, fontWeight: '700' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  logoutText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
});
