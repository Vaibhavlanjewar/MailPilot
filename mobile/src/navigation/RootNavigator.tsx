import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import AppDrawer from './AppDrawer';

const AuthStack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.surfaceBorder,
    primary: colors.primary,
  },
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

export default function RootNavigator() {
  const { ready, isAuthenticated } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={navTheme}
      linking={{
        prefixes: ['jobpilot://'],
        // Only matches once AppDrawer is mounted (post-login) — an
        // unauthenticated tap just opens the app to the login screen instead
        // of crashing, since Login/Register/ForgotPassword have no matching path.
        config: {
          screens: {
            MockInterviewLobby: {
              screens: {
                MockInterviewRoom: 'mock-interview/:code',
              },
            },
          },
        },
      }}
    >
      {isAuthenticated ? <AppDrawer /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
