import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Screen, ScreenTitle } from '../../components/ui';
import { colors } from '../../theme/colors';

/**
 * react-native-webrtc has no web build and throws at import time outside a
 * native runtime, so the real call screen lives in the .native.tsx sibling
 * file — Metro picks this one for the web bundle instead, purely so the
 * dashboard/dev-web preview doesn't crash trying to load it.
 */
export default function MockInterviewRoomScreen() {
  return (
    <Screen style={{ padding: 20 }}>
      <ScreenTitle>Live Practice Room</ScreenTitle>
      <Text style={styles.text}>
        Video calls require the native build (they use react-native-webrtc, which has no web
        version). Open this room from the JobPilot app on your phone.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
});
