import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = { children: React.ReactNode; label: string };
type State = { error: Error | null };

/**
 * React Navigation imports every registered screen's module eagerly on app
 * startup (not just when the user navigates to it), so a module that throws
 * at import time — react-native-webrtc does exactly this when its native
 * module isn't linked — can crash the entire app before any UI renders, not
 * just the one screen that needed it. Only a class component can be an error
 * boundary (no hook equivalent); this scopes that failure to a single
 * screen showing a message instead of the whole app closing.
 */
export class ScreenErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.label}] failed to load`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Couldn't load {this.props.label}</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <Text style={styles.hint}>
            This usually means a native module didn't build into this app correctly. Try
            reinstalling the app, or contact support if it keeps happening.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  message: { color: colors.danger, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  hint: { color: colors.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
