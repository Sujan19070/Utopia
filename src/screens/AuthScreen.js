import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  KeyboardAvoidingView, Platform, Switch, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type, ThemedSheet } from '../theme';
import { useApp } from '../state/AppContext';
import { FIREBASE_READY } from '../config/firebase';

export default function AuthScreen() {
  const { signIn, signUp, signInWithGoogle, resetPassword, authError, setAuthError } = useApp();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdult, setIsAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  const forgot = async () => {
    setLocalError('');
    setAuthError('');
    setResetMsg('');
    if (!email.trim()) {
      setLocalError('Type your email above first, then tap "Forgot password?" again.');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
      setResetMsg(`Password reset link sent to ${email.trim()}. Open the email, set a new password, then sign in with it.`);
    } catch (e) {
      setLocalError(String(e?.message || e).replace('Firebase: ', ''));
    } finally {
      setBusy(false);
    }
  };

  const error = localError || authError;

  const submit = async () => {
    setLocalError('');
    setAuthError('');
    if (!FIREBASE_READY) {
      setLocalError('Firebase is not configured yet — paste your config in src/config/firebase.js.');
      return;
    }
    if (!isAdult) return setLocalError('Confirm you are 18 or older to continue.');
    if (!email.trim() || !password) return setLocalError('Enter your email and password.');
    if (mode === 'signup' && !name.trim()) return setLocalError('Enter your name.');
    setBusy(true);
    if (mode === 'signup') await signUp(name, email, password);
    else await signIn(email, password);
    setBusy(false);
  };

  const google = async () => {
    setLocalError('');
    setAuthError('');
    if (!isAdult) return setLocalError('Confirm you are 18 or older to continue.');
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      Alert.alert('Google sign-in', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior="padding"
    >
      <View style={styles.hero}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
        <Text style={[type.display, { color: '#fff', marginTop: spacing.lg }]}>Utopia</Text>
        <Text style={{ color: '#CFEDE2', marginTop: 6, fontSize: 14 }}>
          Your university. Friends, dates, notes and jobs — one app.
        </Text>
      </View>

      <View style={styles.sheet}>
        <View style={styles.tabs}>
          {['signin', 'signup'].map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.tab, mode === m && styles.tabActive]}
              onPress={() => { setMode(m); setLocalError(''); setAuthError(''); }}
            >
              <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="Your name (shown on posts)"
            placeholderTextColor={colors.inkSoft}
            value={name}
            onChangeText={setName}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.inkSoft}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (6+ characters)"
          placeholderTextColor={colors.inkSoft}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {mode === 'signin' && (
          <TouchableOpacity onPress={forgot} disabled={busy} style={{ alignSelf: 'flex-end', marginTop: 6 }}>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>
              Forgot password? / Change password
            </Text>
          </TouchableOpacity>
        )}
        {resetMsg ? (
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12.5, marginTop: spacing.sm }}>
            {resetMsg}
          </Text>
        ) : null}

        <View style={styles.ageRow}>
          <Switch value={isAdult} onValueChange={setIsAdult} trackColor={{ true: colors.primary }} />
          <Text style={[type.caption, { flex: 1 }]}>
            I confirm I am 18 or older and a student of this university.
          </Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>
              {mode === 'signin' ? 'Sign in' : 'Create my account'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.googleBtn} onPress={google} disabled={busy}>
          <Ionicons name="logo-google" size={18} color={colors.ink} />
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = ThemedSheet(() => ({
  root: { flex: 1, backgroundColor: colors.primary },
  hero: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  logo: {
    width: 76, height: 76, borderRadius: 20,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing.xl, paddingBottom: spacing.xxl,
  },
  tabs: {
    flexDirection: 'row', backgroundColor: colors.bg,
    borderRadius: radius.md, padding: 4, marginBottom: spacing.lg,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surface, elevation: 1 },
  tabText: { fontWeight: '700', color: colors.inkSoft, fontSize: 14 },
  tabTextActive: { color: colors.primaryDark },
  input: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: 13,
    fontSize: 15, color: colors.ink, marginBottom: spacing.md,
  },
  ageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: spacing.xs, marginBottom: spacing.sm,
  },
  error: { color: colors.danger, fontSize: 12.5, marginBottom: spacing.sm },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: spacing.sm,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  googleBtn: {
    flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    paddingVertical: 14, marginTop: spacing.md,
  },
  googleText: { fontWeight: '700', color: colors.ink, fontSize: 15 },
}));
