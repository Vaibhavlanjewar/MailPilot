import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Screen, ScreenTitle } from '../../components/ui';
import { colors } from '../../theme/colors';

// Registered for every web page the mobile app doesn't have a native screen
// for yet, so navigation stays complete instead of dead-ending. Swap these
// out for real screens incrementally.
export default function PlaceholderScreen({ route }: any) {
  const title = route?.params?.title || route?.name || 'Coming soon';
  return (
    <Screen style={styles.container}>
      <ScreenTitle>{title}</ScreenTitle>
      <Text style={styles.text}>
        This screen isn't built for mobile yet — it exists on the web app and the backend already
        supports it, just no native UI here yet.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
