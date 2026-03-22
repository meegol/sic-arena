import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';

import { Fonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async () => {
    setLoading(true);
    setError(null);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>SIC Arena</Text>
          <Text style={styles.subtitle}>Pusoy Dos Tracker</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Create account</Text>
          <Text style={styles.sectionSubtitle}>Join your card room roster.</Text>

          <View style={styles.inputField}>
            <Text style={styles.inputLabel}>Display name</Text>
            <TextInput
              placeholder="Your callsign"
              placeholderTextColor={palette.textMuted}
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
            />
          </View>

          <View style={styles.inputField}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              placeholder="you@example.com"
              placeholderTextColor={palette.textMuted}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputField}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              placeholder="••••••••"
              placeholderTextColor={palette.textMuted}
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={handleSignup}>
            {loading ? (
              <ActivityIndicator color="#00440a" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Link href={"/(auth)/login" as const} style={styles.footerLink}>Log in</Link>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const palette = {
  background: '#0c0e17',
  surfaceLow: '#11131d',
  surface: '#171924',
  surfaceHigh: '#222532',
  primary: '#9cff93',
  secondary: '#ff7168',
  tertiary: '#81ecff',
  text: '#f0f0fd',
  textMuted: '#aaaab7',
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  header: {
    marginBottom: 32,
  },
  brand: {
    color: palette.primary,
    fontFamily: Fonts.rounded,
    fontSize: 26,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  card: {
    backgroundColor: palette.surfaceLow,
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  sectionTitle: {
    color: palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 20,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
  },
  inputField: {
    gap: 8,
  },
  inputLabel: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.text,
  },
  primaryButton: {
    backgroundColor: palette.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#00440a',
    fontFamily: Fonts.rounded,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  footerText: {
    color: palette.textMuted,
    fontSize: 12,
  },
  footerLink: {
    color: palette.tertiary,
    fontSize: 12,
  },
  errorText: {
    color: palette.secondary,
    fontSize: 12,
  },
});
