import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Image,
  Modal, ActivityIndicator, ScrollView, KeyboardAvoidingView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { colors, radius, spacing, type, shadow, ThemedSheet } from '../theme';
import { Avatar, timeAgo, FeedActions } from '../components/ui';
import { useApp } from '../state/AppContext';
import { SearchPickerModal } from '../components/pickers';
import { smartCompress } from '../utils/image';
import { readFileB64, writeTempB64, fmtBytes } from '../utils/files';

const MAX_B64 = 950000; // ~700 KB binary — Firestore doc safety limit

const DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const docIcon = (name = '', mime = '') => {
  const n = name.toLowerCase();
  if (mime.includes('pdf') || n.endsWith('.pdf')) return '📕';
  if (mime.includes('presentation') || /\.pptx?$/.test(n)) return '📙';
  if (mime.includes('sheet') || mime.includes('excel') || /\.xlsx?$/.test(n)) return '📗';
  return '📘'; // word & others
};

// ---------------------------------------------------------------- stars ----
function StarCorner({ item, coll }) {
  const { user, awardStar, starsLeftToday } = useApp();
  const [busy, setBusy] = useState(false);
  const mine = item.authorId === user.id;

  const give = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const targets = [{ coll, id: item.id }];
      if (item.feedPostId) targets.push({ coll: 'posts', id: item.feedPostId });
      const res = await awardStar({ targets, toUserId: item.authorId });
      if (!res.ok) Alert.alert('Stars', res.msg);
      else Alert.alert('⭐ Star given!', `They now have one more star. You have ${res.left} star${res.left === 1 ? '' : 's'} left today. Stars can't be taken back.`);
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.starCorner}>
      <View style={styles.starCount}>
        <Ionicons name="star" size={13} color={colors.accent} />
        <Text style={styles.starCountText}>{item.stars || 0}</Text>
      </View>
      {!mine && (
        <TouchableOpacity style={styles.starGive} onPress={give} disabled={busy}>
          <Ionicons name="star-outline" size={15} color="#fff" />
          <Text style={styles.starGiveText}>+1</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function WalletPill() {
  const { starsLeftToday } = useApp();
  return (
    <View style={styles.wallet}>
      <Ionicons name="star" size={13} color={colors.accent} />
      <Text style={styles.walletText}>{starsLeftToday()} left today</Text>
    </View>
  );
}

const confirmDelete = (what, onYes) =>
  Alert.alert(`Delete ${what}?`, 'This removes it for everyone. This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onYes },
  ]);

// ------------------------------------------------------------ education ----
export function EducationBoardScreen({ navigation }) {
  const { user, crossPostToFeed, isAdmin } = useApp();
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ title: '', course: '', text: '' });
  const [attach, setAttach] = useState(null); // {kind:'photo'|'file', b64, name, mime, size}

  useEffect(() => onSnapshot(collection(db, 'eduNotes'), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    setItems(list);
  }), []);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (res.canceled) return;
    setBusy(true);
    try {
      const b64 = await smartCompress(res.assets[0], 900, 0.55);
      setAttach({ kind: 'photo', b64, name: 'photo.jpg', mime: 'image/jpeg', size: Math.round(b64.length * 0.75) });
    } catch (e) { Alert.alert('Photo', String(e?.message || e)); }
    finally { setBusy(false); }
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: DOC_TYPES, copyToCacheDirectory: true });
      if (res.canceled) return;
      const a = res.assets[0];
      if (a.size && a.size > 1500000) {
        Alert.alert('File too large', `"${a.name}" is ${fmtBytes(a.size)}. Files up to ~700 KB in this build — the storage upgrade lifts this.`);
        return;
      }
      setBusy(true);
      const b64 = await readFileB64(a.uri);
      if (b64.length > MAX_B64) { Alert.alert('File too large', 'Files up to ~700 KB in this build.'); return; }
      setAttach({ kind: 'file', b64, name: a.name || 'file', mime: a.mimeType || '', size: a.size || Math.round(b64.length * 0.75) });
    } catch (e) { Alert.alert('File', String(e?.message || e)); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    setErr('');
    if (!f.title.trim()) return setErr('Give your post a title.');
    if (!f.text.trim() && !attach) return setErr('Write something or attach a note/photo.');
    setBusy(true);
    try {
      const secRef = await addDoc(collection(db, 'eduNotes'), {
        title: f.title.trim(), course: f.course.trim(), text: f.text.trim(),
        imageB64: attach?.kind === 'photo' ? attach.b64 : null,
        fileB64: attach?.kind === 'file' ? attach.b64 : null,
        fileName: attach?.kind === 'file' ? attach.name : '',
        mimeType: attach?.kind === 'file' ? attach.mime : '',
        fileSize: attach?.kind === 'file' ? attach.size : 0,
        authorId: user.id, authorName: user.name,
        stars: 0, starsBy: {},
        createdAt: serverTimestamp(),
      });
      const feedId = await crossPostToFeed({
        starColl: 'eduNotes', starDocId: secRef.id,
        campusKind: 'education', title: f.title.trim(),
        text: `📚 ${f.title.trim()}${f.course.trim() ? ' · ' + f.course.trim() : ''}${f.text.trim() ? '\n' + f.text.trim() : ''}${attach?.kind === 'file' ? `\n📎 ${attach.name} — open it in Campus → Education` : ''}`,
        imageB64: attach?.kind === 'photo' ? attach.b64 : null,
      });
      await updateDoc(secRef, { feedPostId: feedId });
      setOpen(false);
      setF({ title: '', course: '', text: '' });
      setAttach(null);
    } catch (e) { setErr(String(e?.message || e)); }
    finally { setBusy(false); }
  };

  const openFile = async (it) => {
    try {
      const uri = await writeTempB64(it.fileB64, it.fileName || 'file');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: it.mimeType || undefined });
      } else Alert.alert('File saved', uri);
    } catch (e) { Alert.alert('Open file', String(e?.message || e)); }
  };

  const Card = ({ it }) => (
    <View style={[styles.card, shadow.card]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...type.body, fontWeight: '800' }}>{it.title}</Text>
          <Text style={type.caption}>
            {it.authorName} · {timeAgo(it.createdAt)}{it.course ? ` · ${it.course}` : ''}
          </Text>
        </View>
        {(it.authorId === user.id || isAdmin) && (
          <TouchableOpacity onPress={() => confirmDelete('this post', () => deleteDoc(doc(db, 'eduNotes', it.id)))}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        )}
        <StarCorner item={it} coll="eduNotes" />
      </View>
      {!!it.text && <Text style={[type.body, { marginTop: spacing.sm }]}>{it.text}</Text>}
      {!!it.imageB64 && (
        <Image source={{ uri: `data:image/jpeg;base64,${it.imageB64}` }} style={styles.photo} />
      )}
      {!!it.fileB64 && (
        <TouchableOpacity style={styles.fileChip} onPress={() => openFile(it)}>
          <Text style={{ fontSize: 20 }}>{docIcon(it.fileName, it.mimeType)}</Text>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ ...type.body, fontWeight: '700', fontSize: 13.5 }}>{it.fileName}</Text>
            <Text style={type.caption}>{fmtBytes(it.fileSize)} · tap to open</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      )}
      <FeedActions feedPostId={it.feedPostId} fallback={{ kind: 'education', authorId: it.authorId, title: it.title }} navigation={navigation} />
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={type.title}>Education</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <WalletPill />
          <TouchableOpacity style={styles.addBtn} onPress={() => { setErr(''); setOpen(true); }}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {items === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
              No study posts yet. Share notes, PDFs, slides, or sheets — helpful
              posts earn ⭐ stars.
            </Text>
          }
          renderItem={({ item }) => <Card it={item} />}
        />
      )}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.dim} activeOpacity={1} onPress={() => setOpen(false)} />
        <KeyboardAvoidingView behavior="padding">
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl }}>
              <Text style={[type.title, { textAlign: 'center', marginBottom: spacing.md }]}>Share study material</Text>
              <Text style={type.label}>Title</Text>
              <TextInput style={styles.input} placeholder="e.g. DSA final — all past questions solved"
                placeholderTextColor={colors.inkSoft} value={f.title}
                onChangeText={(v) => setF({ ...f, title: v })} />
              <Text style={type.label}>Course (optional)</Text>
              <TextInput style={styles.input} placeholder="e.g. CSC 2107"
                placeholderTextColor={colors.inkSoft} value={f.course}
                onChangeText={(v) => setF({ ...f, course: v })} />
              <Text style={type.label}>Details</Text>
              <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                placeholder="What's inside, which chapters, tips…" multiline
                placeholderTextColor={colors.inkSoft} value={f.text}
                onChangeText={(v) => setF({ ...f, text: v })} />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.sm }}>
                <TouchableOpacity style={styles.attachBtn} onPress={pickPhoto} disabled={busy}>
                  <Ionicons name="image" size={16} color={colors.primary} />
                  <Text style={styles.attachText}>Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachBtn} onPress={pickFile} disabled={busy}>
                  <Ionicons name="document-attach" size={16} color={colors.primary} />
                  <Text style={styles.attachText}>PDF / PPT / Word / Excel</Text>
                </TouchableOpacity>
              </View>
              {attach && (
                <View style={styles.attachPreview}>
                  <Text style={{ fontSize: 18 }}>{attach.kind === 'photo' ? '🖼️' : docIcon(attach.name, attach.mime)}</Text>
                  <Text numberOfLines={1} style={[type.caption, { flex: 1 }]}>
                    {attach.name} · {fmtBytes(attach.size)}
                  </Text>
                  <TouchableOpacity onPress={() => setAttach(null)}>
                    <Ionicons name="close-circle" size={20} color={colors.inkSoft} />
                  </TouchableOpacity>
                </View>
              )}

              {!!err && <Text style={{ color: colors.danger, fontWeight: '700', marginTop: spacing.sm }}>{err}</Text>}
              <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Post to Education</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ----------------------------------------------------------------- jobs ----
export function JobsScreen({ navigation }) {
  const { user, crossPostToFeed, isAdmin } = useApp();
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ kind: 'job', title: '', company: '', location: '', pay: '', details: '', apply: '' });

  useEffect(() => onSnapshot(collection(db, 'jobs'), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    setItems(list);
  }), []);

  const submit = async () => {
    setErr('');
    if (!f.title.trim()) return setErr('What is the job title?');
    if (!f.details.trim()) return setErr('Add some details about the role.');
    setBusy(true);
    try {
      const secRef = await addDoc(collection(db, 'jobs'), {
        ...f,
        title: f.title.trim(), company: f.company.trim(), location: f.location.trim(),
        pay: f.pay.trim(), details: f.details.trim(), apply: f.apply.trim(),
        authorId: user.id, authorName: user.name,
        stars: 0, starsBy: {},
        createdAt: serverTimestamp(),
      });
      const feedId = await crossPostToFeed({
        starColl: 'jobs', starDocId: secRef.id,
        campusKind: 'jobs', title: f.title.trim(),
        text: `💼 ${f.kind === 'internship' ? 'Internship' : 'Job'}: ${f.title.trim()}${f.company.trim() ? ' @ ' + f.company.trim() : ''}${f.location.trim() ? '\n📍 ' + f.location.trim() : ''}${f.pay.trim() ? '\n💰 ' + f.pay.trim() : ''}\n\n${f.details.trim()}${f.apply.trim() ? '\n\n📮 Apply: ' + f.apply.trim() : ''}`,
      });
      await updateDoc(secRef, { feedPostId: feedId });
      setOpen(false);
      setF({ kind: 'job', title: '', company: '', location: '', pay: '', details: '', apply: '' });
    } catch (e) { setErr(String(e?.message || e)); }
    finally { setBusy(false); }
  };

  const Card = ({ it }) => (
    <View style={[styles.card, shadow.card]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={styles.kindPill}>
          <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#fff' }}>
            {it.kind === 'internship' ? 'INTERNSHIP' : 'JOB'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...type.body, fontWeight: '800' }}>{it.title}</Text>
          <Text style={type.caption}>
            {it.company ? `${it.company} · ` : ''}{it.authorName} · {timeAgo(it.createdAt)}
          </Text>
        </View>
        {(it.authorId === user.id || isAdmin) && (
          <TouchableOpacity onPress={() => confirmDelete('this job post', () => deleteDoc(doc(db, 'jobs', it.id)))}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        )}
        <StarCorner item={it} coll="jobs" />
      </View>
      {(!!it.location || !!it.pay) && (
        <Text style={[type.caption, { marginTop: spacing.sm }]}>
          {it.location ? `📍 ${it.location}` : ''}{it.location && it.pay ? '   ' : ''}{it.pay ? `💰 ${it.pay}` : ''}
        </Text>
      )}
      <Text style={[type.body, { marginTop: spacing.sm }]}>{it.details}</Text>
      {!!it.apply && (
        <View style={styles.applyBox}>
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.primaryDark }}>📮 HOW TO APPLY</Text>
          <Text selectable style={[type.body, { marginTop: 4 }]}>{it.apply}</Text>
        </View>
      )}
      <FeedActions feedPostId={it.feedPostId} fallback={{ kind: 'jobs', authorId: it.authorId, title: it.title }} navigation={navigation} />
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={type.title}>Jobs & internships</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <WalletPill />
          <TouchableOpacity style={styles.addBtn} onPress={() => { setErr(''); setOpen(true); }}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {items === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
              No jobs posted yet. Share part-time work, internships, tuition,
              campus gigs — useful posts earn ⭐ stars.
            </Text>
          }
          renderItem={({ item }) => <Card it={item} />}
        />
      )}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.dim} activeOpacity={1} onPress={() => setOpen(false)} />
        <KeyboardAvoidingView behavior="padding">
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl }}>
              <Text style={[type.title, { textAlign: 'center', marginBottom: spacing.md }]}>Post a job</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.sm }}>
                {['job', 'internship'].map((k) => (
                  <TouchableOpacity key={k}
                    style={[styles.kindChip, f.kind === k && styles.kindChipOn]}
                    onPress={() => setF({ ...f, kind: k })}>
                    <Text style={[styles.kindChipText, f.kind === k && { color: '#fff' }]}>
                      {k === 'job' ? '💼 Job' : '🎓 Internship'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={type.label}>Title</Text>
              <TextInput style={styles.input} placeholder="e.g. Junior React Native developer"
                placeholderTextColor={colors.inkSoft} value={f.title}
                onChangeText={(v) => setF({ ...f, title: v })} />
              <Text style={type.label}>Company / who's hiring (optional)</Text>
              <TextInput style={styles.input} placeholder="e.g. TechCorp BD"
                placeholderTextColor={colors.inkSoft} value={f.company}
                onChangeText={(v) => setF({ ...f, company: v })} />
              <Text style={type.label}>Location (optional)</Text>
              <TextInput style={styles.input} placeholder="e.g. Banani / remote"
                placeholderTextColor={colors.inkSoft} value={f.location}
                onChangeText={(v) => setF({ ...f, location: v })} />
              <Text style={type.label}>Salary / stipend (optional)</Text>
              <TextInput style={styles.input} placeholder="e.g. 15k–20k BDT"
                placeholderTextColor={colors.inkSoft} value={f.pay}
                onChangeText={(v) => setF({ ...f, pay: v })} />
              <Text style={type.label}>Details</Text>
              <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Requirements, hours, deadline…" multiline
                placeholderTextColor={colors.inkSoft} value={f.details}
                onChangeText={(v) => setF({ ...f, details: v })} />
              <Text style={type.label}>How to apply (optional)</Text>
              <TextInput style={styles.input} placeholder="Link, email, or phone"
                placeholderTextColor={colors.inkSoft} value={f.apply}
                onChangeText={(v) => setF({ ...f, apply: v })} />

              {!!err && <Text style={{ color: colors.danger, fontWeight: '700', marginTop: spacing.sm }}>{err}</Text>}
              <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Post job</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ------------------------------------------------------------ spotlight ----
export function SpotlightScreen({ navigation }) {
  const { user, directory } = useApp();
  const [reviews, setReviews] = useState([]);
  const [coursePick, setCoursePick] = useState('');
  const [courseOpen, setCourseOpen] = useState(false);

  useEffect(() => onSnapshot(collection(db, 'facultyReviews'), (snap) =>
    setReviews(snap.docs.map((d) => d.data()))), []);

  // Average star rating per teacher from faculty reviews.
  const teacherStats = (list) => {
    const m = {};
    list.forEach((r) => {
      if (!r.faculty || !r.rating) return;
      if (!m[r.faculty]) m[r.faculty] = { sum: 0, n: 0 };
      m[r.faculty].sum += r.rating;
      m[r.faculty].n += 1;
    });
    return Object.entries(m)
      .map(([name, v]) => ({ name, avg: v.sum / v.n, n: v.n }))
      .sort((a, b) => b.avg - a.avg || b.n - a.n);
  };
  const weekStartSec = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime() / 1000;
  };
  const bestTeacherOverall = useMemo(() => teacherStats(reviews)[0] || null, [reviews]);
  const bestTeacherWeek = useMemo(
    () => teacherStats(reviews.filter((r) => (r.createdAt?.seconds || 0) >= weekStartSec()))[0] || null,
    [reviews]
  );
  const courses = useMemo(
    () => [...new Set(reviews.map((r) => r.course).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [reviews]
  );
  const courseTop = useMemo(
    () => (coursePick ? teacherStats(reviews.filter((r) => r.course === coursePick)).slice(0, 3) : []),
    [reviews, coursePick]
  );

  const weekKeyNow = () => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return `w-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const ranking = useMemo(
    () => directory
      .filter((p) => (p.starsReceived || 0) > 0)
      .sort((a, b) => (b.starsReceived || 0) - (a.starsReceived || 0))
      .slice(0, 30),
    [directory]
  );
  const campusStar = ranking[0] || null;
  const helper = useMemo(() => {
    const wk = weekKeyNow();
    const list = directory
      .filter((p) => p.starsWeekKey === wk && (p.starsWeek || 0) > 0)
      .sort((a, b) => (b.starsWeek || 0) - (a.starsWeek || 0));
    return list[0] || null;
  }, [directory]);

  const Row = ({ p, i }) => (
    <View style={[styles.rankRow, p.id === user.id && styles.rankRowMe]}>
      <Text style={styles.rankNum}>{i + 1}</Text>
      <Avatar user={p} size={38} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={{ ...type.body, fontWeight: '700' }}>{p.name}{p.id === user.id ? ' (you)' : ''}</Text>
        <Text style={type.caption}>{p.university || p.dept || ''}</Text>
      </View>
      <View style={styles.starCount}>
        <Ionicons name="star" size={13} color={colors.accent} />
        <Text style={styles.starCountText}>{p.starsReceived || 0}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={type.title}>Campus Spotlight</Text>
        <WalletPill />
      </View>

      <FlatList
        data={ranking}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        ListHeaderComponent={
          <View>
            <View style={[styles.card, shadow.card, { backgroundColor: colors.primarySoft }]}>
              <Text style={[type.caption, { textAlign: 'center' }]}>
                Everyone gets ⭐ 2 stars a day to reward helpful Education and
                Jobs posts. Stars can't be taken back — earn them by helping
                your campus. Rankings update live.
              </Text>
            </View>

            {campusStar && (
              <View style={[styles.card, shadow.card, styles.heroCard]}>
                <Text style={styles.heroLabel}>🌟 CAMPUS STAR</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: spacing.sm }}>
                  <Avatar user={campusStar} size={54} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...type.title, fontSize: 18 }}>{campusStar.name}</Text>
                    <Text style={type.caption}>{campusStar.starsReceived} ⭐ all-time</Text>
                  </View>
                </View>
              </View>
            )}
            {helper && (
              <View style={[styles.card, shadow.card, styles.heroCard]}>
                <Text style={styles.heroLabel}>🤝 HELPER OF THE WEEK</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: spacing.sm }}>
                  <Avatar user={helper} size={54} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...type.title, fontSize: 18 }}>{helper.name}</Text>
                    <Text style={type.caption}>{helper.starsWeek} ⭐ this week</Text>
                  </View>
                </View>
              </View>
            )}

            <Text style={[type.label, { marginTop: spacing.md, marginBottom: spacing.sm }]}>TEACHER RANKINGS · from faculty reviews</Text>

            {bestTeacherOverall && (
              <View style={[styles.card, shadow.card, styles.heroCard]}>
                <Text style={styles.heroLabel}>🏆 BEST TEACHER OVERALL</Text>
                <Text style={{ ...type.title, fontSize: 17, marginTop: spacing.sm }}>{bestTeacherOverall.name}</Text>
                <Text style={type.caption}>
                  {'★'.repeat(Math.round(bestTeacherOverall.avg))} {bestTeacherOverall.avg.toFixed(1)} / 5 · {bestTeacherOverall.n} review{bestTeacherOverall.n === 1 ? '' : 's'}
                </Text>
              </View>
            )}
            {bestTeacherWeek && (
              <View style={[styles.card, shadow.card, styles.heroCard]}>
                <Text style={styles.heroLabel}>📅 BEST TEACHER OF THE WEEK</Text>
                <Text style={{ ...type.title, fontSize: 17, marginTop: spacing.sm }}>{bestTeacherWeek.name}</Text>
                <Text style={type.caption}>
                  {'★'.repeat(Math.round(bestTeacherWeek.avg))} {bestTeacherWeek.avg.toFixed(1)} / 5 · {bestTeacherWeek.n} this week
                </Text>
              </View>
            )}
            <View style={[styles.card, shadow.card]}>
              <Text style={styles.heroLabel}>📖 BEST TEACHER OF THE COURSE</Text>
              <TouchableOpacity style={styles.coursePickBtn} onPress={() => setCourseOpen(true)}>
                <Ionicons name="book-outline" size={15} color={colors.primary} />
                <Text style={{ ...type.body, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                  {coursePick || 'Select a course…'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.inkSoft} />
              </TouchableOpacity>
              {coursePick && courseTop.length === 0 && (
                <Text style={[type.caption, { marginTop: spacing.sm }]}>No reviews for this course yet.</Text>
              )}
              {courseTop.map((t, i) => (
                <View key={t.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm }}>
                  <Text style={{ fontSize: 15 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</Text>
                  <Text style={{ ...type.body, fontWeight: '700', flex: 1 }} numberOfLines={1}>{t.name}</Text>
                  <Text style={type.caption}>{t.avg.toFixed(1)} ★ · {t.n}</Text>
                </View>
              ))}
            </View>

            <Text style={[type.label, { marginTop: spacing.md, marginBottom: spacing.sm }]}>CAMPUS RANKING · student stars</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
            Nobody has stars yet — everyone starts at zero. Post helpful notes
            or jobs, and give your 2 daily stars to posts that helped you.
          </Text>
        }
        renderItem={({ item, index }) => <Row p={item} i={index} />}
      />
      <SearchPickerModal
        visible={courseOpen}
        title="Pick a course"
        items={courses}
        current={coursePick}
        onPick={(v) => setCoursePick(v)}
        onClose={() => setCourseOpen(false)}
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
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  wallet: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primarySoft, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  walletText: { fontSize: 11.5, fontWeight: '800', color: colors.primaryDark },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  starCorner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  starCount: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.bg, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.line,
  },
  starCountText: { fontSize: 12, fontWeight: '800', color: colors.ink },
  starGive: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.accent, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  starGiveText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  photo: {
    width: '100%', height: 220, borderRadius: radius.md,
    marginTop: spacing.sm, backgroundColor: colors.bg,
  },
  fileChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    padding: spacing.md, marginTop: spacing.sm,
  },
  attachBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primarySoft, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  attachText: { fontSize: 12.5, fontWeight: '800', color: colors.primaryDark },
  attachPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    padding: spacing.md, marginTop: spacing.sm,
  },
  kindPill: {
    backgroundColor: '#4A6FB4', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  kindChip: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  kindChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  kindChipText: { fontWeight: '800', fontSize: 13.5, color: colors.ink },
  applyBox: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.sm,
  },
  heroCard: { borderWidth: 1.5, borderColor: colors.accent },
  coursePickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    padding: spacing.md, marginTop: spacing.sm,
  },
  heroLabel: { fontSize: 11, fontWeight: '900', color: colors.accent, letterSpacing: 0.5 },
  rankRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  rankRowMe: { borderWidth: 1.5, borderColor: colors.primary },
  rankNum: { width: 26, fontWeight: '900', fontSize: 14, color: colors.inkSoft },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, maxHeight: '92%',
  },
  sheetHandle: {
    width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.lg, paddingVertical: 11,
    fontSize: 15, color: colors.ink, marginTop: 6, marginBottom: spacing.sm,
  },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: spacing.md,
  },
}));
