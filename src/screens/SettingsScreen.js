import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type, shadow, PALETTES, THEME_KEYS, ThemedSheet } from '../theme';
import { t } from '../i18n/strings';
import { Avatar, SectionHeader } from '../components/ui';
import { useApp } from '../state/AppContext';

export default function SettingsScreen({ navigation }) {
  const { user, usersById, saveSettings, unblockUser } = useApp();
  const s = user.settings || {};
  const night = !!s.night;
  const themeKey = s.theme || 'emerald';
  const lang = s.lang || 'en';
  const showActive = s.showActive !== false;
  const blocked = (user.blocked || []).map((id) => ({ id, ...(usersById[id] || {}) }));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={type.title}>{t('settings')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <SectionHeader label={t('appearance')} />
        <View style={[styles.card, shadow.card]}>
          <View style={styles.row}>
            <Ionicons name="moon" size={20} color={colors.primary} />
            <Text style={[type.body, { flex: 1, marginLeft: spacing.md, fontWeight: '600' }]}>
              {t('nightMode')}
            </Text>
            <Switch
              value={night}
              onValueChange={(v) => saveSettings({ night: v })}
              trackColor={{ true: colors.primary }}
            />
          </View>

          <View style={[styles.rowLine]} />
          <Text style={[type.label, { paddingHorizontal: spacing.lg, paddingTop: spacing.md }]}>
            {t('theme')}
          </Text>
          <View style={styles.themeGrid}>
            {THEME_KEYS.map((k) => {
              const p = PALETTES[k];
              const selected = night ? k === 'night' : k === themeKey;
              return (
                <TouchableOpacity
                  key={k}
                  style={[styles.themeItem, selected && { borderColor: colors.primary }]}
                  onPress={() =>
                    k === 'night'
                      ? saveSettings({ night: true })
                      : saveSettings({ theme: k, night: false })
                  }
                >
                  <View style={{ flexDirection: 'row' }}>
                    <View style={[styles.swatch, { backgroundColor: p.primary }]} />
                    <View style={[styles.swatch, { backgroundColor: p.accent }]} />
                    <View style={[styles.swatch, { backgroundColor: p.bg, borderWidth: 1, borderColor: p.line }]} />
                  </View>
                  <Text style={[type.caption, { fontWeight: '700', marginTop: 6 }]}>
                    {p.name} {selected ? '✓' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <SectionHeader label={t('language')} />
        <View style={[styles.card, shadow.card, { flexDirection: 'row', padding: spacing.md, gap: spacing.md }]}>
          {[['en', 'English'], ['bn', 'বাংলা']].map(([code, label]) => (
            <TouchableOpacity
              key={code}
              style={[styles.langBtn, lang === code && { backgroundColor: colors.primary }]}
              onPress={() => saveSettings({ lang: code })}
            >
              <Text style={{ fontWeight: '800', fontSize: 15, color: lang === code ? '#fff' : colors.ink }}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionHeader label={t('privacy')} />
        <View style={[styles.card, shadow.card]}>
          <View style={styles.row}>
            <Ionicons name="radio-button-on" size={20} color={colors.primary} />
            <Text style={[type.body, { flex: 1, marginLeft: spacing.md, fontWeight: '600' }]}>
              {t('showActive')}
            </Text>
            <Switch
              value={showActive}
              onValueChange={(v) => saveSettings({ showActive: v })}
              trackColor={{ true: colors.primary }}
            />
          </View>
          <Text style={[type.caption, { paddingHorizontal: spacing.lg, paddingBottom: spacing.md }]}>
            {t('showActiveHint')}
          </Text>
        </View>

        <SectionHeader label={t('blockedAccounts')} />
        <View style={[styles.card, shadow.card]}>
          {blocked.length === 0 ? (
            <Text style={[type.caption, { padding: spacing.lg }]}>{t('noBlocked')}</Text>
          ) : (
            blocked.map((b, i) => (
              <View key={b.id} style={[styles.row, i < blocked.length - 1 && styles.rowBorder]}>
                <Avatar userId={b.id} name={b.name} size={40} />
                <Text style={[type.body, { flex: 1, marginLeft: spacing.md, fontWeight: '600' }]}>
                  {b.name || 'Student'}
                </Text>
                <TouchableOpacity style={styles.unblockBtn} onPress={() => unblockUser(b.id)}>
                  <Text style={{ color: colors.primaryDark, fontWeight: '800', fontSize: 12.5 }}>
                    {t('unblock')}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
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
    marginHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  rowLine: { height: 1, backgroundColor: colors.line, marginHorizontal: spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderColor: colors.line },
  themeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md,
    padding: spacing.lg, paddingTop: spacing.md,
  },
  themeItem: {
    borderWidth: 2, borderColor: colors.line, borderRadius: radius.md,
    padding: spacing.md, minWidth: 96, alignItems: 'center',
  },
  swatch: { width: 20, height: 20, borderRadius: 10, marginRight: -6 },
  langBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 13,
    borderRadius: radius.md, backgroundColor: colors.bg,
  },
  unblockBtn: {
    backgroundColor: colors.primarySoft, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: 7,
  },
}));
