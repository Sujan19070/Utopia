import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type, ThemedSheet } from '../theme';
import { t } from '../i18n/strings';
import { Chip } from '../components/ui';
import { SearchPickerModal, SelectField } from '../components/pickers';
import { useApp } from '../state/AppContext';
import { UNIVERSITIES } from '../data/universities';
import { COLLEGES } from '../data/colleges';
import { MEDICAL_COLLEGES } from '../data/medicalColleges';

export const INTERESTS = [
  'Programming', 'Robotics', 'Machine Learning', 'Power', 'Literature', 'Art',
];

const ROLES = [
  { key: 'student', label: 'Student', icon: 'school-outline' },
  { key: 'teacher', label: 'Teacher', icon: 'easel-outline' },
  { key: 'alumni', label: 'Alumni', icon: 'ribbon-outline' },
];

export default function MyEducationScreen({ navigation }) {
  const { user, saveEducation, requestRoleVerification, checkRoleVerified } = useApp();
  const [f, setF] = useState({
    university: user.university || '',
    college: user.college || '',
    role: user.role || 'student',
    subject: user.subject || '',
    batch: user.batch || '',
    major: user.major || '',
    minorField: user.minorField || '',
    researchPapers: user.researchPapers || '',
    interests: user.interests || [],
  });
  const [picker, setPicker] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [eduEmail, setEduEmail] = useState(user.eduEmail || '');
  const [vBusy, setVBusy] = useState(false);
  const [vMsg, setVMsg] = useState('');

  // Is the currently picked role already verified for this account?
  // Verified students & alumni can switch between those two roles freely —
  // same person, same verified university email.
  const FLEX = ['student', 'alumni'];
  const roleActive = user.roleVerified && (user.role === f.role ||
    (FLEX.includes(user.role) && FLEX.includes(f.role)));
  const needsVerify = !roleActive;

  const sendVerify = async () => {
    setVMsg('');
    setVBusy(true);
    try {
      const res = await requestRoleVerification(f.role, eduEmail);
      if (res.error) setVMsg(res.error);
      else setVMsg(`Confirmation sent to ${eduEmail.trim()} — open it, click the link, then tap "I've verified".`);
    } finally {
      setVBusy(false);
    }
  };

  const confirmVerify = async () => {
    setVMsg('');
    setVBusy(true);
    try {
      const ok = await checkRoleVerified();
      setVMsg(ok
        ? `Verified! You are now a ${f.role}.`
        : 'Not verified yet — click the link in the email first.');
    } finally {
      setVBusy(false);
    }
  };

  const toggleInterest = (i) =>
    setF((prev) => ({
      ...prev,
      interests: prev.interests.includes(i)
        ? prev.interests.filter((x) => x !== i)
        : [...prev.interests, i],
    }));

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      await saveEducation(f);
      setMsg(needsVerify && f.role !== 'student'
        ? 'Saved. Your role stays as before until you verify the email above.'
        : needsVerify
          ? 'Saved as Student. Verify your .edu email above to get the verified badge.'
          : t('saved'));
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
        <Text style={type.title}>{t('education')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
          <Text style={[type.label, { marginBottom: spacing.sm }]}>I am a…</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
            {ROLES.map((r) => {
              const active = f.role === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.roleBtn, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setF({ ...f, role: r.key })}
                >
                  <Ionicons name={r.icon} size={18} color={active ? '#fff' : colors.primary} />
                  <Text style={{ fontWeight: '800', fontSize: 13, color: active ? '#fff' : colors.ink }}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {user.roleVerified && FLEX.includes(user.role) && (
            <Text style={[type.caption, { marginTop: -6, marginBottom: spacing.md }]}>
              ✓ Verified {user.role}s can switch between Student and Alumni without re-verifying.
            </Text>
          )}

          <View style={styles.verifyBox}>
              {roleActive ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                  <Text style={{ ...type.body, fontWeight: '800', color: colors.primaryDark }}>
                    {f.role === 'teacher' ? 'Teacher' : f.role === 'alumni' ? 'Alumni' : 'Student'} verified
                    {user.eduEmail ? ` · ${user.eduEmail}` : ''}
                  </Text>
                </View>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
                    <Ionicons name="ribbon-outline" size={16} color={colors.accent} />
                    <Text style={{ ...type.body, fontWeight: '800' }}>
                      {f.role === 'teacher' ? 'Verify to become a Teacher'
                        : f.role === 'alumni' ? 'Verify to become an Alumnus'
                        : 'Get the verified Student badge'}
                    </Text>
                  </View>
                  <Text style={[type.caption, { marginBottom: spacing.sm }]}>
                    {f.role === 'teacher'
                      ? 'Confirm your university / institutional email so students can trust the Teacher badge.'
                      : f.role === 'alumni'
                        ? 'Confirm an email to verify you graduated. Your university email is best.'
                        : 'Confirm your student (.edu / university) email to get a verified Student badge on your posts and profile. Optional — you can use Utopia as a student without it.'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="you@student.university.edu.bd"
                    placeholderTextColor={colors.inkSoft}
                    value={eduEmail}
                    onChangeText={setEduEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <TouchableOpacity
                      style={[styles.vBtn, { backgroundColor: colors.primary }]}
                      onPress={sendVerify}
                      disabled={vBusy}
                    >
                      {vBusy
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.vBtnText}>Send confirmation</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.vBtn, { backgroundColor: colors.accent }]}
                      onPress={confirmVerify}
                      disabled={vBusy}
                    >
                      <Text style={styles.vBtnText}>I've verified</Text>
                    </TouchableOpacity>
                  </View>
                  {!!vMsg && (
                    <Text style={{
                      marginTop: spacing.sm, fontSize: 12.5, fontWeight: '700',
                      color: vMsg.startsWith('Verified') ? colors.primary
                        : vMsg.startsWith('Confirmation') ? colors.primaryDark : colors.danger,
                    }}>
                      {vMsg}
                    </Text>
                  )}
                </>
              )}
            </View>

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

          <Text style={type.label}>
            {f.role === 'teacher' ? 'Subject you teach' : 'Subject'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={f.role === 'teacher' ? 'e.g. Digital Electronics' : 'e.g. Physics'}
            placeholderTextColor={colors.inkSoft}
            value={f.subject}
            onChangeText={(v) => setF({ ...f, subject: v })}
          />
          <Text style={type.label}>Batch</Text>
          <TextInput
            style={styles.input}
            placeholder={f.role === 'alumni' ? 'e.g. CSE 2018' : 'e.g. CSE 2022 / Batch 29'}
            placeholderTextColor={colors.inkSoft}
            value={f.batch}
            onChangeText={(v) => setF({ ...f, batch: v })}
          />
          <Text style={type.label}>Major</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Computer Science & Engineering"
            placeholderTextColor={colors.inkSoft}
            value={f.major}
            onChangeText={(v) => setF({ ...f, major: v })}
          />
          <Text style={type.label}>Minor</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Mathematics"
            placeholderTextColor={colors.inkSoft}
            value={f.minorField}
            onChangeText={(v) => setF({ ...f, minorField: v })}
          />
          <Text style={type.label}>Research papers</Text>
          <TextInput
            style={[styles.input, { height: 96, textAlignVertical: 'top' }]}
            placeholder="Titles or links — one per line"
            placeholderTextColor={colors.inkSoft}
            value={f.researchPapers}
            onChangeText={(v) => setF({ ...f, researchPapers: v })}
            multiline
          />

          <Text style={[type.label, { marginBottom: spacing.sm }]}>Interested fields</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {INTERESTS.map((i) => (
              <Chip
                key={i}
                label={i}
                active={f.interests.includes(i)}
                onPress={() => toggleInterest(i)}
              />
            ))}
          </View>

          {!!msg && (
            <Text style={{ color: msg === t('saved') ? colors.primary : colors.danger, fontWeight: '700', marginTop: spacing.md }}>
              {msg}
            </Text>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{t('save')}</Text>}
          </TouchableOpacity>
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
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    fontSize: 15, color: colors.ink,
    marginTop: 6, marginBottom: spacing.lg,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: spacing.lg,
  },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  roleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  verifyBox: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  vBtn: {
    flex: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center',
  },
  vBtnText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
}));
