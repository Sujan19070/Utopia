import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Image,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { colors, radius, spacing, type, shadow, ThemedSheet } from '../theme';
import { Avatar, timeAgo } from '../components/ui';
import { useApp } from '../state/AppContext';
import { smartCompress } from '../utils/image';

const DAY = 24 * 3600 * 1000;

// ------------------------------------------------------- admin: reports ----
export function AdminReportsScreen({ navigation }) {
  const { user, isAdmin, usersById } = useApp();
  const [reports, setReports] = useState(null);
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(collection(db, 'reports'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setReports(list);
    });
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={26} color={colors.ink} />
          </TouchableOpacity>
          <Text style={type.title}>Reports</Text>
          <View style={{ width: 26 }} />
        </View>
        <Text style={[type.caption, { textAlign: 'center', marginTop: 40 }]}>
          This section is only available to the app admin.
        </Text>
      </SafeAreaView>
    );
  }

  const visible = (reports || []).filter((r) => showClosed || r.status === 'open');

  const deleteReportedPost = async (r) => {
    Alert.alert('Delete the reported post?', 'It will be removed for everyone immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete post', style: 'destructive',
        onPress: async () => {
          try { await deleteDoc(doc(db, 'posts', r.postId)); } catch (e) {}
          if (r.starColl && r.starDocId) {
            try { await deleteDoc(doc(db, r.starColl, r.starDocId)); } catch (e) {}
          }
          await updateDoc(doc(db, 'reports', r.id), { status: 'closed', action: 'post deleted' });
        },
      },
    ]);
  };

  const banUser = (r) => {
    if (!r.reportedUserId) return Alert.alert('Ban', 'No user attached to this report.');
    const name = usersById?.[r.reportedUserId]?.name || 'this user';
    const apply = (label, value) => async () => {
      await updateDoc(doc(db, 'users', r.reportedUserId), { bannedUntil: value });
      await updateDoc(doc(db, 'reports', r.id), { status: 'closed', action: `banned ${label}` });
      Alert.alert('Done', value ? `${name} is banned (${label}).` : `${name} is unbanned.`);
    };
    Alert.alert(`Block ${name}?`, 'They will be locked out of the app for the chosen time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: '1 day', onPress: apply('1 day', Date.now() + DAY) },
      { text: '7 days', onPress: apply('7 days', Date.now() + 7 * DAY) },
      { text: '30 days', onPress: apply('30 days', Date.now() + 30 * DAY) },
      { text: 'Permanent', style: 'destructive', onPress: apply('permanently', 'forever') },
      { text: 'Unban', onPress: apply('', null) },
    ]);
  };

  const dismiss = (r) =>
    updateDoc(doc(db, 'reports', r.id), { status: 'closed', action: 'dismissed' });

  const Card = ({ r }) => {
    const target = usersById?.[r.reportedUserId];
    const banned = target && (target.bannedUntil === 'forever' ||
      (typeof target.bannedUntil === 'number' && target.bannedUntil > Date.now()));
    return (
      <View style={[styles.card, shadow.card, r.status === 'closed' && { opacity: 0.55 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={styles.reasonPill}>
            <Ionicons name="flag" size={11} color="#fff" />
            <Text style={styles.reasonPillText}>{r.reason}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={type.caption}>{timeAgo(r.createdAt)}</Text>
        </View>
        {!!r.note && <Text style={[type.body, { marginTop: spacing.sm }]}>"{r.note}"</Text>}
        <Text style={[type.caption, { marginTop: spacing.sm }]}>
          Reported by {r.reporterName} · against{' '}
          <Text style={{ fontWeight: '800' }}>{target?.name || r.reportedUserId || '—'}</Text>
          {banned ? ' (currently banned)' : ''}
        </Text>
        {!!r.postText && (
          <View style={styles.postPreview}>
            <Text numberOfLines={3} style={type.caption}>{r.postText}</Text>
          </View>
        )}
        {r.status === 'closed' ? (
          <Text style={[type.caption, { marginTop: spacing.sm, fontWeight: '800' }]}>
            ✔ Closed{r.action ? ` — ${r.action}` : ''}
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md, flexWrap: 'wrap' }}>
            <TouchableOpacity style={[styles.adminBtn, { backgroundColor: colors.danger }]}
              onPress={() => deleteReportedPost(r)}>
              <Ionicons name="trash" size={13} color="#fff" />
              <Text style={styles.adminBtnText}>Delete post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.adminBtn, { backgroundColor: '#8B2E2E' }]}
              onPress={() => banUser(r)}>
              <Ionicons name="ban" size={13} color="#fff" />
              <Text style={styles.adminBtnText}>Block user</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.adminBtn, { backgroundColor: colors.inkSoft }]}
              onPress={() => dismiss(r)}>
              <Ionicons name="checkmark" size={13} color="#fff" />
              <Text style={styles.adminBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={type.title}>Reports</Text>
        <TouchableOpacity onPress={() => setShowClosed(!showClosed)}>
          <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12.5 }}>
            {showClosed ? 'Open only' : 'Show closed'}
          </Text>
        </TouchableOpacity>
      </View>
      {reports === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
              No {showClosed ? '' : 'open '}reports. 🎉
            </Text>
          }
          renderItem={({ item }) => <Card r={item} />}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------- developer ----
export function DeveloperScreen({ navigation }) {
  const { isAdmin } = useApp();
  const [info, setInfo] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: '', email: '', phone: '', bio: '', purpose: '', photoB64: null });

  useEffect(() => onSnapshot(doc(db, 'appMeta', 'developer'), (snap) => {
    setInfo(snap.exists() ? snap.data() : {});
  }), []);

  const startEdit = () => {
    setF({
      name: info?.name || '', email: info?.email || '', phone: info?.phone || '',
      bio: info?.bio || '', purpose: info?.purpose || '', photoB64: info?.photoB64 || null,
    });
    setEditing(true);
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled) return;
    setBusy(true);
    try { setF({ ...f, photoB64: await smartCompress(res.assets[0], 500, 0.6) }); }
    finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    try {
      await setDoc(doc(db, 'appMeta', 'developer'), {
        ...f, updatedAt: serverTimestamp(),
      }, { merge: true });
      setEditing(false);
    } finally { setBusy(false); }
  };

  const Row = ({ icon, label, value }) => !value ? null : (
    <View style={styles.devRow}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={type.label}>{label}</Text>
        <Text selectable style={type.body}>{value}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={type.title}>Developer</Text>
        {isAdmin ? (
          <TouchableOpacity onPress={editing ? () => setEditing(false) : startEdit}>
            <Text style={{ color: colors.primary, fontWeight: '800' }}>{editing ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 26 }} />}
      </View>

      {info === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
          {!editing ? (
            <View style={[styles.card, shadow.card, { alignItems: 'center' }]}>
              {info.photoB64 ? (
                <Image source={{ uri: `data:image/jpeg;base64,${info.photoB64}` }} style={styles.devPhoto} />
              ) : (
                <View style={[styles.devPhoto, { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="code-slash" size={34} color={colors.primary} />
                </View>
              )}
              <Text style={[type.title, { marginTop: spacing.md }]}>{info.name || 'Utopia developer'}</Text>
              <View style={{ alignSelf: 'stretch', marginTop: spacing.md, gap: spacing.md }}>
                <Row icon="mail" label="EMAIL" value={info.email} />
                <Row icon="call" label="PHONE" value={info.phone} />
                <Row icon="person" label="ABOUT" value={info.bio} />
                <Row icon="rocket" label="WHY UTOPIA EXISTS" value={info.purpose} />
              </View>
              {!info.name && !info.bio && (
                <Text style={[type.caption, { marginTop: spacing.md, textAlign: 'center' }]}>
                  The developer hasn't filled this in yet.
                </Text>
              )}
            </View>
          ) : (
            <View style={[styles.card, shadow.card]}>
              <TouchableOpacity style={{ alignSelf: 'center' }} onPress={pickPhoto} disabled={busy}>
                {f.photoB64 ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${f.photoB64}` }} style={styles.devPhoto} />
                ) : (
                  <View style={[styles.devPhoto, { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="camera" size={28} color={colors.primary} />
                  </View>
                )}
                <Text style={[type.caption, { textAlign: 'center', marginTop: 4 }]}>Tap to change photo</Text>
              </TouchableOpacity>
              {[
                ['name', 'Name', 'Your name'],
                ['email', 'Email', 'contact email'],
                ['phone', 'Phone', 'phone number'],
              ].map(([k, label, ph]) => (
                <View key={k}>
                  <Text style={type.label}>{label}</Text>
                  <TextInput style={styles.input} placeholder={ph} placeholderTextColor={colors.inkSoft}
                    value={f[k]} onChangeText={(v) => setF({ ...f, [k]: v })} />
                </View>
              ))}
              <Text style={type.label}>Bio</Text>
              <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} multiline
                placeholder="About the developer…" placeholderTextColor={colors.inkSoft}
                value={f.bio} onChangeText={(v) => setF({ ...f, bio: v })} />
              <Text style={type.label}>Purpose of this app</Text>
              <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} multiline
                placeholder="Why Utopia exists…" placeholderTextColor={colors.inkSoft}
                value={f.purpose} onChangeText={(v) => setF({ ...f, purpose: v })} />
              <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> :
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Save</Text>}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ----------------------------------------------------------- feedback ----
export function FeedbackScreen({ navigation }) {
  const { user, isAdmin } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [all, setAll] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(collection(db, 'feedback'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setAll(list);
    });
  }, [isAdmin]);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        text: text.trim(),
        userId: user.id,
        name: user.name,
        email: user.email,
        createdAt: serverTimestamp(),
      });
      setText('');
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={type.title}>Feedback</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
          <View style={[styles.card, shadow.card]}>
            <Text style={{ ...type.body, fontWeight: '800' }}>💬 Tell the developer</Text>
            <Text style={type.caption}>
              Bugs, ideas, complaints — everything helps make Utopia better.
              Your name and email go with it so the developer can reply.
            </Text>
            <TextInput
              style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
              placeholder="Write your feedback…"
              placeholderTextColor={colors.inkSoft}
              multiline
              value={text}
              onChangeText={setText}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={submit} disabled={busy || !text.trim()}>
              {busy ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ color: '#fff', fontWeight: '800' }}>
                  {sent ? '✔ Sent — thank you!' : 'Send feedback'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {isAdmin && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[type.label, { marginBottom: spacing.sm }]}>
                ALL FEEDBACK · {all?.length ?? '…'} (only you can see this)
              </Text>
              {(all || []).map((fb) => (
                <View key={fb.id} style={[styles.card, shadow.card]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...type.body, fontWeight: '800' }}>{fb.name}</Text>
                      <Text selectable style={type.caption}>{fb.email} · {timeAgo(fb.createdAt)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteDoc(doc(db, 'feedback', fb.id))}>
                      <Ionicons name="trash-outline" size={17} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[type.body, { marginTop: spacing.sm }]}>{fb.text}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    padding: spacing.lg, marginBottom: spacing.md,
  },
  reasonPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.danger, borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  reasonPillText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  postPreview: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.sm,
    borderLeftWidth: 3, borderLeftColor: colors.danger,
  },
  adminBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
  },
  adminBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  devRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  devPhoto: { width: 96, height: 96, borderRadius: 48 },
  input: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.lg, paddingVertical: 11,
    fontSize: 15, color: colors.ink, marginTop: 6, marginBottom: spacing.sm,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm,
  },
}));
