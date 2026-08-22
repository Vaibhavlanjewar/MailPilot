import React, { Suspense, lazy } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { ScreenErrorBoundary } from '../components/ScreenErrorBoundary';
import MockInterviewLobbyScreen from '../screens/main/MockInterviewLobbyScreen';

const Stack = createNativeStackNavigator();

// react-native-webrtc throws at *import time* if its native module isn't
// linked (see MockInterviewRoomScreen.native.tsx). React Navigation's
// Stack.Screen normally imports every screen module eagerly at app startup —
// deferring this one via lazy() means that throw (if it happens) only
// surfaces when someone actually opens this screen, not on every app launch.
const MockInterviewRoomScreen = lazy(() => import('../screens/main/MockInterviewRoomScreen'));

function LazyRoomScreen(props: any) {
  return (
    <ScreenErrorBoundary label="the practice room">
      <Suspense
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        }
      >
        <MockInterviewRoomScreen {...props} />
      </Suspense>
    </ScreenErrorBoundary>
  );
}

export default function MockInterviewStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
      }}
    >
      <Stack.Screen name="MockInterviewLobbyHome" component={MockInterviewLobbyScreen} options={{ title: 'Live Practice Room' }} />
      <Stack.Screen name="MockInterviewRoom" component={LazyRoomScreen} options={{ title: 'Practice Room' }} />
    </Stack.Navigator>
  );
}
