import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import MockInterviewLobbyScreen from '../screens/main/MockInterviewLobbyScreen';
import MockInterviewRoomScreen from '../screens/main/MockInterviewRoomScreen';

const Stack = createNativeStackNavigator();

export default function MockInterviewStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
      }}
    >
      <Stack.Screen name="MockInterviewLobbyHome" component={MockInterviewLobbyScreen} options={{ title: 'Live Practice Room' }} />
      <Stack.Screen name="MockInterviewRoom" component={MockInterviewRoomScreen} options={{ title: 'Practice Room' }} />
    </Stack.Navigator>
  );
}
