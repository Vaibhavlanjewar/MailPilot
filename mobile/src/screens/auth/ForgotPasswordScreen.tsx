import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, StyleSheet, Pressable } from 'react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { auth, firebaseConfigError } from '../../services/firebase';
import { Field, PrimaryButton } from '../../components/ui';
import { colors, gradient } from '../../theme/colors';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!auth) {
      setError(firebaseConfigError || 'Firebase not configured.');
      return;
    }
    if (!email) {
      setError('Enter your email.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
      Toast.show({ type: 'success', text1: 'Password reset email sent.' });
    } catch (err: any) {
      const message = err?.message || 'Could not send reset email.';
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
          <Text style={styles.subtitle}>Reset your password</Text>
        </View>

        <View style={styles.card}>
          {sent ? (
            <Text style={styles.subtitle}>
              Check {email} for a link to reset your password.
            </Text>
          ) : (
            <>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <PrimaryButton title="Send reset link" onPress={handleSubmit} loading={loading} />
            </>
          )}

          <Pressable onPress={() => navigation.navigate('Login')} style={{ marginTop: 18, alignSelf: 'center' }}>
            <Text style={styles.link}>Back to login</Text>
          </Pressable>
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
  errorText: { color: colors.danger, fontSize: 13, marginBottom: 12 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
});
