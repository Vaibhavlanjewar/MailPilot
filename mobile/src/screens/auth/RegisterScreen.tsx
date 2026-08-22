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

export default function RegisterScreen({ navigation }: any) {
  const { register, loginWithGoogleIdToken } = useAuth();
  const [name, setName] = useState('');
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
        // Same immediate Gmail-consent continuation as LoginScreen — see the
        // comment there for why this can't just happen later in Settings.
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

  function handleGooglePress() {
    if (!googleReady) {
      Toast.show({ type: 'info', text1: googleSignInConfigError || 'Google sign-in is not ready yet.' });
      return;
    }
    promptAsync();
  }

  async function handleSubmit() {
    setError(null);
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await register({ email: email.trim(), password, name: name.trim() });
    } catch (err: any) {
      const message = err?.message || 'Registration failed.';
      setError(message);
      Toast.show({ type: 'error', text1: message });
    } finally {
      setLoading(false);
    }
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
          <Text style={styles.subtitle}>Create an account</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Register</Text>

          <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
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
            textContentType="newPassword"
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PrimaryButton title="Create account" onPress={handleSubmit} loading={loading} />

          <View style={{ marginTop: 10 }}>
            <SecondaryButton title="Continue with Google" onPress={handleGooglePress} disabled={googleLoading} />
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.subtitle}>Already registered? </Text>
            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>Log in</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderWidth: 1, borderRadius: 20, padding: 20 },
  cardTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  errorText: { color: colors.danger, fontSize: 13, marginBottom: 12 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
});
