import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type, shadow, ThemedSheet } from '../theme';
import { useApp } from '../state/AppContext';

const EMOJIS = ['🎭', '🦊', '🐼', '🦉', '🐯', '🦁', '🐸', '🐙', '🦄', '👻', '🤖', '🐰', '🐨', '🐻', '🦋', '🌙'];
const COLORS = ['#4B3F72', '#0E5FA8', '#B4654A', '#067D5A', '#93381A', '#3E2B74'];

export default function AnonymousScreen({ navigation }) {
  const { user, saveAnon } = useApp();
  const a = user.anon || {};
  const [on, setOn] = useState(!!a.on);
  const [name, setName] = useState(a.name || '');
  const [emoji, setEmoji] = useState(a.emoji || '🎭');
  const [color, setColor] = useState(a.color || COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    if (on && !name.trim()) {
      setMsg('Pick a nickname first — that\u2019s how you\u2019ll appear.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await saveAnon({ on, name, emoji, color });
      setMsg('Saved!');
    } catch (e) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={type.title}>Anonymous mode</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        <View style={[styles.card, shadow.card]}>
          <View style={styles.row}>
            <Text style={{ fontSize: 22 }}>🎭</Text>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={{ ...type.body, fontWeight: '800' }}>Go anonymous</Text>
              <Text style={type.caption}>
                Posts, comments and new chats use your nickname instead of your name.
              </Text>
            </View>
            <Switch value={on} onValueChange={setOn} trackColor={{ true: colors.anon }} />
          </View>
        </View>

        {/* live preview */}
        <View style={[styles.preview, { opacity: on ? 1 : 0.45 }]}>
          <View style={[styles.bigAvatar, { backgroundColor: color }]}>
            <Text style={{ fontSize: 34 }}>{emoji}</Text>
          </View>
          <Text style={{ ...type.title, marginTop: spacing.sm }}>
            {name.trim() || 'Your nickname'}
          </Text>
          <Text style={type.caption}>This is how everyone will see you</Text>
        </View>

        <Text style={type.label}>Nickname</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Night Owl, Campus Fox…"
          placeholderTextColor={colors.inkSoft}
          value={name}
          onChangeText={setName}
          maxLength={24}
        />

        <Text style={[type.label, { marginTop: spacing.md }]}>Avatar</Text>
        <View style={styles.grid}>
          {EMOJIS.map((e) => (
            <TouchableOpacity
              key={e}
              style={[styles.emojiCell, emoji === e && { borderColor: colors.anon, backgroundColor: colors.anonSoft }]}
              onPress={() => setEmoji(e)}
            >
              <Text style={{ fontSize: 24 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[type.label, { marginTop: spacing.md }]}>Color</Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
              onPress={() => setColor(c)}
            />
          ))}
        </View>

        {!!msg && (
          <Text style={{ color: msg === 'Saved!' ? colors.primary : colors.danger, fontWeight: '700', marginTop: spacing.lg }}>
            {msg}
          </Text>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : (
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Save</Text>
          )}
        </TouchableOpacity>

        <Text style={[type.caption, { marginTop: spacing.lg, textAlign: 'center' }]}>
          Anonymous hides your name and photo from other students in the app.
          Utopia still knows it's your account — abuse can be moderated.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = ThemedSheet(() => ({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  preview: { alignItems: 'center', marginBottom: spacing.xl },
  bigAvatar: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    fontSize: 15, color: colors.ink, marginTop: 6,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm,
  },
  emojiCell: {
    width: 52, height: 52, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  swatchActive: { borderWidth: 3, borderColor: colors.ink },
  saveBtn: {
    backgroundColor: colors.anon, borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: spacing.xl,
  },
}));
