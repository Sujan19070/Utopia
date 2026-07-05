import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, ThemedSheet } from '../theme';
import { useApp } from '../state/AppContext';

export default function VerifyEmailScreen() {
  const { user, resendVerification, refreshVerification, signOut } = useApp();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [msg, setMsg] = useState('');

  // Auto-check every 5 seconds — the moment the link is clicked, the app opens.
  useEffect(() => {
    const iv = setInterval(() => { refreshVerification().catch(() => {}); }, 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const tm = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(tm);
  }, [cooldown]);

  const check = async () => {
    setBusy(true);
    setMsg('');
    try {
      const ok = await refreshVerification();
      if (!ok) setMsg('Not verified yet — click the link in your email first, then try again.');
    } catch (e) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setMsg('');
    try {
      await resendVerification();
      setCooldown(30);
      setMsg('Sent! Check your inbox — and the spam folder.');
    } catch (e) {
      setMsg(String(e?.message || e));
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name="mail-unread" size={40} color="#fff" />
        </View>
        <Text style={styles.title}>Confirm your email</Text>
        <Text style={styles.sub}>
          We sent a confirmation link to{'\n'}
          <Text style={{ fontWeight: '800', color: '#fff' }}>{user?.email}</Text>
        </Text>
        <Text style={styles.hint}>
          Open the email and tap the link — this screen unlocks automatically.
          Check the spam folder if you don't see it.
        </Text>

        {!!msg && <Text style={styles.msg}>{msg}</Text>}

        <TouchableOpacity style={styles.primaryBtn} onPress={check} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.primaryDark} />
          ) : (
            <Text style={styles.primaryText}>I've verified — continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ghostBtn, cooldown > 0 && { opacity: 0.5 }]}
          onPress={resend}
          disabled={cooldown > 0}
        >
          <Text style={styles.ghostText}>
            {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend email'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ marginTop: spacing.xl }} onPress={signOut}>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '700' }}>
            Use a different account — Sign out
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = ThemedSheet(() => ({
  root: { flex: 1, backgroundColor: colors.primary },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  iconWrap: {
    width: 84, height: 84, borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#fff' },
  sub: {
    color: 'rgba(255,255,255,0.9)', fontSize: 15,
    textAlign: 'center', marginTop: spacing.md, lineHeight: 22,
  },
  hint: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13,
    textAlign: 'center', marginTop: spacing.md, lineHeight: 19,
    paddingHorizontal: spacing.lg,
  },
  msg: {
    color: '#FFE9BE', fontWeight: '700', fontSize: 13,
    textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: '#fff', borderRadius: radius.pill,
    paddingVertical: 14, paddingHorizontal: spacing.xxl,
    marginTop: spacing.xl, minWidth: 260, alignItems: 'center',
  },
  primaryText: { color: colors.primaryDark, fontWeight: '800', fontSize: 15 },
  ghostBtn: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: radius.pill, paddingVertical: 13,
    paddingHorizontal: spacing.xxl, marginTop: spacing.md,
    minWidth: 260, alignItems: 'center',
  },
  ghostText: { color: '#fff', fontWeight: '800', fontSize: 14 },
}));
