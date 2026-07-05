import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type, ThemedSheet } from '../theme';
import { useApp } from '../state/AppContext';
import { UNIVERSITIES } from '../data/universities';
import { HOMETOWN_OPTIONS } from '../data/hometowns';
import { SearchPickerModal, SelectField } from '../components/pickers';
import { COLLEGES } from '../data/colleges';
import { MEDICAL_COLLEGES } from '../data/medicalColleges';

function Field({ label, value, onChange, placeholder, readOnly, keyboardType, autoCapitalize }) {
  return (
    <View style={styles.field}>
      <Text style={type.label}>{label}</Text>
      {readOnly ? (
        <View style={[styles.input, styles.readOnly]}>
          <Text style={{ color: colors.inkSoft, fontSize: 15 }}>{value}</Text>
        </View>
      ) : (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.inkSoft}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'words'}
        />
      )}
    </View>
  );
}

export default function MyAccountScreen({ navigation }) {
  const { user, saveAccount } = useApp();
  const [f, setF] = useState({
    name: user.name || '',
    username: user.username || '',
    birthday: user.birthday || '',
    mobile: user.mobile || '',
    hometown: user.hometown || '',
    area: user.area || '',
    university: user.university || '',
    college: user.college || '',
    school: user.school || '',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [picker, setPicker] = useState(null); // 'university' | 'hometown'

  const set = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    setMsg(null);
    setBusy(true);
    try {
      const res = await saveAccount(f);
      if (res.error) setMsg({ ok: false, text: res.error });
      else setMsg({ ok: true, text: 'Saved!' });
    } catch (e) {
      setMsg({ ok: false, text: String(e?.message || e) });
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
        <Text style={type.title}>My Account</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
          <Field label="Name" value={f.name} onChange={set('name')} placeholder="Your full name" />
          <Field
            label="Username (unique)"
            value={f.username}
            onChange={set('username')}
            placeholder="e.g. rakib_07"
            autoCapitalize="none"
          />
          <Field label="Birthday" value={f.birthday} onChange={set('birthday')} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" />
          <Field label="Mobile" value={f.mobile} onChange={set('mobile')} placeholder="+880…" keyboardType="phone-pad" />
          <Field label="Email" value={user.email} readOnly />
          <SelectField
            label="Hometown (zila / upazila)"
            value={f.hometown}
            placeholder="Tap to select your hometown"
            onPress={() => setPicker('hometown')}
          />
          <Field label="Area (where you live now)" value={f.area} onChange={set('area')} placeholder="e.g. Mirpur, Dhaka" />

          <SelectField
            label="University"
            value={f.university}
            placeholder="Tap to select your university"
            onPress={() => setPicker('university')}
          />

          <SelectField
            label="College"
            value={f.college}
            placeholder="Tap to select your college"
            onPress={() => setPicker('college')}
          />
          <Field label="School" value={f.school} onChange={set('school')} placeholder="Your school" />

          {msg && (
            <Text style={{ color: msg.ok ? colors.primary : colors.danger, fontWeight: '700', marginBottom: spacing.sm }}>
              {msg.text}
            </Text>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save changes</Text>}
          </TouchableOpacity>

          <Text style={[type.caption, { marginTop: spacing.md, textAlign: 'center' }]}>
            Hometown, area, university, college and school power the feed filter —
            fill them in and you can filter campus posts to people who match you.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <SearchPickerModal
        visible={picker === 'university'}
        title="Select your university"
        items={[...UNIVERSITIES, ...MEDICAL_COLLEGES].sort((a, b) => a.localeCompare(b))}
        current={f.university}
        onPick={(u) => setF((prev) => ({ ...prev, university: u }))}
        onClose={() => setPicker(null)}
        allowCustom
      />
      <SearchPickerModal
        visible={picker === 'college'}
        title="Select your college"
        items={COLLEGES}
        current={f.college}
        onPick={(c) => setF((prev) => ({ ...prev, college: c }))}
        onClose={() => setPicker(null)}
        allowCustom
      />
      <SearchPickerModal
        visible={picker === 'hometown'}
        title="Select your hometown"
        items={HOMETOWN_OPTIONS}
        current={f.hometown}
        onPick={(h) => setF((prev) => ({ ...prev, hometown: h }))}
        onClose={() => setPicker(null)}
      />
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
  field: { marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    fontSize: 15, color: colors.ink, marginTop: 6,
  },
  selectRow: { flexDirection: 'row', alignItems: 'center' },
  readOnly: { backgroundColor: colors.bg },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: spacing.sm,
  },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  pickerRoot: { flex: 1, backgroundColor: colors.bg },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    margin: spacing.lg, paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: colors.ink },
  uniRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 13,
    borderBottomWidth: 1, borderColor: colors.line,
    backgroundColor: colors.surface,
  },
}));
