import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AuthProvider } from './src/context/AuthContext';
import { ActiveCallProvider } from './src/context/ActiveCallContext';
import FloatingCallBubble from './src/components/FloatingCallBubble';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ActiveCallProvider>
          <StatusBar style="light" />
          <RootNavigator />
          {/* After the navigator so an in-progress call stays reachable from
              whatever screen the user wandered off to. */}
          <FloatingCallBubble />
          <Toast />
        </ActiveCallProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
