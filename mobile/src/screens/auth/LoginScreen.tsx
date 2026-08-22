import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';
import { useGoogleAuth, googleSignInConfigError } from '../../hooks/useGoogleAuth';
import { getGmailConnectUrlIfNeeded } from '../../services/gmailConnect';
import { Field, PrimaryButton, SecondaryButton } from '../../components/ui';
import { colors, gradient } from '../../theme/colors';

export default function LoginScreen({ navigation }: any) {
  const { login, loginWithGoogleIdToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { ready: googleReady, promptAsync } = useGoogleAuth(
    async (idToken) => {
      setGoogleLoading(true);
      try {
        await loginWithGoogleIdToken(idToken);
        // Firebase sign-in proves identity but yields no refresh token, so it
        // cannot authorise the campaign queue to send mail later. Continue
        // straight into Gmail's offline consent while still in a sign-in
        // mindset — mirrors client/src/pages/Login.jsx exactly.
        const connectUrl = await getGmailConnectUrlIfNeeded();
        if (connectUrl) {
          await WebBrowser.openBrowserAsync(connectUrl);
        }
      } catch (err: any) {
        const message = err?.message || 'Google sign-in failed.';
        setError(message);
        Toast.show({ type: 'error', text1: message });
      } finally {
        setGoogleLoading(false);
      }
    },
    (message) => Toast.show({ type: 'error', text1: message })
  );

  async function handleSubmit() {
    setError(null);
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      const message = err?.message || 'Sign in failed.';
      setError(message);
      Toast.show({ type: 'error', text1: message });
    } finally {
      setLoading(false);
    }
  }

  function handleGooglePress() {
    if (!googleReady) {
      Toast.show({ type: 'info', text1: googleSignInConfigError || 'Google sign-in is not ready yet.' });
      return;
    }
    promptAsync();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <LinearGradient colors={gradient as unknown as [string, string]} style={styles.logo}>
            <Text style={styles.logoText}>JP</Text>
          </LinearGradient>
          <Text style={styles.title}>JobPilot</Text>
          <Text style={styles.subtitle}>Sign in to manage campaigns</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Log in</Text>
          <Text style={styles.cardSubtitle}>Use the account you registered with.</Text>

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={{ alignSelf: 'flex-end', marginBottom: 16 }}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>

          <PrimaryButton title="Sign in" onPress={handleSubmit} loading={loading} />

          <View style={{ marginTop: 10 }}>
            <SecondaryButton title="Continue with Google" onPress={handleGooglePress} disabled={googleLoading} />
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.subtitle}>No account? </Text>
            <Pressable onPress={() => navigation.navigate('Register')}>
              <Text style={styles.link}>Register</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 12,
  },
  link: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },
});
