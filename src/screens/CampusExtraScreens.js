import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  Modal, Alert, ActivityIndicator, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { colors, radius, spacing, type, shadow, ThemedSheet } from '../theme';
import { Avatar, Chip, timeAgo } from '../components/ui';
import { useApp } from '../state/AppContext';
import { smartCompress } from '../utils/image';

// ---------- shared bits ----------
function ScreenHeader({ title, onBack, onAdd }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack}>
        <Ionicons name="chevron-back" size={26} color={colors.ink} />
      </TouchableOpacity>
      <Text style={type.title}>{title}</Text>
      {onAdd ? (
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      ) : <View style={{ width: 26 }} />}
    </View>
  );
}

function Sheet({ visible, title, onClose, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.dim} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={[type.title, { textAlign: 'center', marginBottom: spacing.md }]}>{title}</Text>
        <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </Modal>
  );
}

function Input(props) {
  return (
    <TextInput
      placeholderTextColor={colors.inkSoft}
      style={[styles.input, props.multiline && { height: 84, textAlignVertical: 'top' }]}
      {...props}
    />
  );
}

const useCol = (name) => {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    return onSnapshot(collection(db, name), (snap) =>
      setRows(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      )
    );
  }, [name]);
  return rows;
};

// ================= EVENTS =================
const EVENT_KINDS = ['Club event', 'Seminar', 'Research lecture', 'Workshop'];

export function EventsScreen({ navigation }) {
  const { user, crossPostToFeed } = useApp();
  const events = useCol('events');
  const [filter, setFilter] = useState('All');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: EVENT_KINDS[0], title: '', date: '', venue: '', details: '' });
  const [busy, setBusy] = useState(false);

  const shown = filter === 'All' ? events : events.filter((e) => e.kind === filter);

  const publish = async () => {
    if (!f.title.trim() || !f.date.trim()) {
      Alert.alert('Missing info', 'At least a title and date are needed.');
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, 'events'), {
        ...f, title: f.title.trim(),
        authorId: user.id, authorName: user.name,
        interested: [], createdAt: serverTimestamp(),
      });
      await crossPostToFeed({
        campusKind: 'event', title: f.title.trim(),
        text: `📅 ${f.kind}: ${f.title.trim()}\n${f.date}${f.venue ? ' · ' + f.venue : ''}${f.details ? '\n\n' + f.details : ''}`,
      });
      setOpen(false);
      setF({ kind: EVENT_KINDS[0], title: '', date: '', venue: '', details: '' });
    } finally { setBusy(false); }
  };

  const toggleInterest = (ev) => {
    const has = (ev.interested || []).includes(user.id);
    updateDoc(doc(db, 'events', ev.id), {
      interested: has ? arrayRemove(user.id) : arrayUnion(user.id),
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title="Events" onBack={() => navigation.goBack()} onAdd={() => setOpen(true)} />
      <View style={styles.chipRow}>
        {['All', ...EVENT_KINDS].map((k) => (
          <Chip key={k} label={k} active={filter === k} onPress={() => setFilter(k)} />
        ))}
      </View>
      <FlatList
        data={shown}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
            No events yet — tap + to post your club's next one.
          </Text>
        }
        renderItem={({ item }) => {
          const going = (item.interested || []).includes(user.id);
          return (
            <View style={[styles.card, shadow.card]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Chip label={item.kind} tone="accent" />
                {item.authorId === user.id && (
                  <TouchableOpacity onPress={() => deleteDoc(doc(db, 'events', item.id))}>
                    <Ionicons name="trash-outline" size={17} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={{ ...type.body, fontWeight: '800', fontSize: 16, marginTop: spacing.sm }}>
                {item.title}
              </Text>
              <Text style={[type.caption, { marginTop: 4 }]}>
                <Ionicons name="calendar" size={12} color={colors.primary} /> {item.date}
                {item.venue ? `   ·   ${item.venue}` : ''}
              </Text>
              {!!item.details && (
                <Text style={[type.body, { marginTop: spacing.sm }]}>{item.details}</Text>
              )}
              <View style={styles.cardFoot}>
                <TouchableOpacity
                  style={styles.miniRow}
                  onPress={() => navigation.push('UserProfile', { userId: item.authorId, name: item.authorName })}
                >
                  <Avatar userId={item.authorId} name={item.authorName} size={24} />
                  <Text style={type.caption}>{item.authorName}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.interestBtn, going && { backgroundColor: colors.primary }]}
                  onPress={() => toggleInterest(item)}
                >
                  <Ionicons name={going ? 'star' : 'star-outline'} size={14} color={going ? '#fff' : colors.primary} />
                  <Text style={{ fontWeight: '800', fontSize: 12.5, color: going ? '#fff' : colors.primary }}>
                    Interested · {(item.interested || []).length}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
      <Sheet visible={open} title="New event" onClose={() => setOpen(false)}>
        <View style={[styles.chipRow, { paddingHorizontal: 0 }]}>
          {EVENT_KINDS.map((k) => (
            <Chip key={k} label={k} active={f.kind === k} onPress={() => setF({ ...f, kind: k })} />
          ))}
        </View>
        <Input placeholder="Event title" value={f.title} onChangeText={(v) => setF({ ...f, title: v })} />
        <Input placeholder="Date & time (e.g. 12/07/2026 4:00 PM)" value={f.date} onChangeText={(v) => setF({ ...f, date: v })} />
        <Input placeholder="Venue (e.g. Auditorium, Room 302)" value={f.venue} onChangeText={(v) => setF({ ...f, venue: v })} />
        <Input placeholder="Details" value={f.details} onChangeText={(v) => setF({ ...f, details: v })} multiline />
        <TouchableOpacity style={styles.saveBtn} onPress={publish} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Post event</Text>}
        </TouchableOpacity>
      </Sheet>
    </SafeAreaView>
  );
}

// ================= LOST & FOUND =================
export function LostFoundScreen({ navigation }) {
  const { user, crossPostToFeed } = useApp();
  const items = useCol('lostfound');
  const [filter, setFilter] = useState('All');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: 'lost', title: '', details: '', place: '' });
  const [imageB64, setImageB64] = useState(null);
  const [busy, setBusy] = useState(false);

  const shown = items.filter((i) => {
    if (filter === 'Resolved') return i.resolved;
    if (i.resolved) return false;
    if (filter === 'All') return true;
    return i.kind === filter.toLowerCase();
  });

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.5, base64: true,
    });
    if (r.canceled) return;
    setBusy(true);
    try { setImageB64(await smartCompress(r.assets[0], 700, 0.45)); }
    catch (e) { Alert.alert('Photo failed', String(e?.message || e)); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (!f.title.trim()) { Alert.alert('Missing info', 'Describe the item.'); return; }
    setBusy(true);
    try {
      await addDoc(collection(db, 'lostfound'), {
        ...f, title: f.title.trim(),
        imageB64: imageB64 || null, resolved: false,
        authorId: user.id, authorName: user.name, createdAt: serverTimestamp(),
      });
      await crossPostToFeed({
        campusKind: 'lostfound', title: f.title.trim(),
        text: `${f.kind === 'lost' ? '🔍 LOST' : '📦 FOUND'}: ${f.title.trim()}${f.place ? '\n📍 ' + f.place : ''}${f.details ? '\n\n' + f.details : ''}`,
        imageB64: imageB64 || null,
      });
      setOpen(false);
      setF({ kind: 'lost', title: '', details: '', place: '' });
      setImageB64(null);
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title="Lost & Found" onBack={() => navigation.goBack()} onAdd={() => setOpen(true)} />
      <View style={styles.chipRow}>
        {['All', 'Lost', 'Found', 'Resolved'].map((k) => (
          <Chip key={k} label={k} active={filter === k} onPress={() => setFilter(k)} />
        ))}
      </View>
      <FlatList
        data={shown}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
            Nothing here. Lost something? Found something? Tap +.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, shadow.card, item.resolved && { opacity: 0.65 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={[styles.lfBadge, { backgroundColor: item.kind === 'lost' ? colors.danger : colors.primary }]}>
                <Text style={styles.lfBadgeText}>{item.kind === 'lost' ? 'LOST' : 'FOUND'}</Text>
              </View>
              {item.resolved && (
                <View style={[styles.lfBadge, { backgroundColor: colors.inkSoft }]}>
                  <Text style={styles.lfBadgeText}>RESOLVED</Text>
                </View>
              )}
              <View style={{ flex: 1 }} />
              <Text style={type.caption}>{timeAgo(item.createdAt)}</Text>
            </View>
            <Text style={{ ...type.body, fontWeight: '800', fontSize: 16, marginTop: spacing.sm }}>
              {item.title}
            </Text>
            {!!item.place && (
              <Text style={type.caption}>
                <Ionicons name="location" size={12} color={colors.primary} /> {item.place}
              </Text>
            )}
            {!!item.details && <Text style={[type.body, { marginTop: 6 }]}>{item.details}</Text>}
            {!!item.imageB64 && (
              <Image
                source={{ uri: `data:image/jpeg;base64,${item.imageB64}` }}
                style={styles.lfPhoto}
                resizeMode="cover"
              />
            )}
            <View style={styles.cardFoot}>
              <TouchableOpacity
                style={styles.miniRow}
                onPress={() => navigation.push('UserProfile', { userId: item.authorId, name: item.authorName })}
              >
                <Avatar userId={item.authorId} name={item.authorName} size={24} />
                <Text style={type.caption}>{item.authorName}</Text>
              </TouchableOpacity>
              {item.authorId === user.id ? (
                !item.resolved ? (
                  <TouchableOpacity
                    style={styles.interestBtn}
                    onPress={() => updateDoc(doc(db, 'lostfound', item.id), { resolved: true })}
                  >
                    <Ionicons name="checkmark" size={14} color={colors.primary} />
                    <Text style={{ fontWeight: '800', fontSize: 12.5, color: colors.primary }}>Mark resolved</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => deleteDoc(doc(db, 'lostfound', item.id))}>
                    <Ionicons name="trash-outline" size={17} color={colors.danger} />
                  </TouchableOpacity>
                )
              ) : (
                <TouchableOpacity
                  style={[styles.interestBtn, { backgroundColor: colors.primary }]}
                  onPress={() => navigation.navigate('ChatRoom', { otherId: item.authorId, otherName: item.authorName })}
                >
                  <Ionicons name="chatbubble" size={13} color="#fff" />
                  <Text style={{ fontWeight: '800', fontSize: 12.5, color: '#fff' }}>Message</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />
      <Sheet visible={open} title="Report lost / found" onClose={() => setOpen(false)}>
        <View style={[styles.chipRow, { paddingHorizontal: 0 }]}>
          <Chip label="I lost something" active={f.kind === 'lost'} onPress={() => setF({ ...f, kind: 'lost' })} />
          <Chip label="I found something" active={f.kind === 'found'} onPress={() => setF({ ...f, kind: 'found' })} />
        </View>
        <Input placeholder="Item (e.g. Blue water bottle, Student ID card)" value={f.title} onChangeText={(v) => setF({ ...f, title: v })} />
        <Input placeholder="Where? (e.g. Library 2nd floor)" value={f.place} onChangeText={(v) => setF({ ...f, place: v })} />
        <Input placeholder="Details (color, marks, when…)" value={f.details} onChangeText={(v) => setF({ ...f, details: v })} multiline />
        <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto} disabled={busy}>
          <Ionicons name={imageB64 ? 'checkmark-circle' : 'image-outline'} size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            {imageB64 ? 'Photo attached' : 'Add a photo (optional)'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={publish} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Post</Text>}
        </TouchableOpacity>
      </Sheet>
    </SafeAreaView>
  );
}

// ================= ALUMNI =================
export function AlumniScreen({ navigation }) {
  const { user, crossPostToFeed } = useApp();
  const alumni = useCol('alumni');
  const [open, setOpen] = useState(false);
  const mine = useMemo(() => alumni.find((a) => a.id === user.id), [alumni, user.id]);
  const [f, setF] = useState({ batch: '', role: '', org: '', note: '' });
  const [busy, setBusy] = useState(false);

  const openForm = () => {
    setF({
      batch: mine?.batch || '', role: mine?.role || '',
      org: mine?.org || '', note: mine?.note || '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!f.batch.trim()) { Alert.alert('Missing info', 'Add your batch (e.g. CSE 2018).'); return; }
    setBusy(true);
    try {
      const wasListed = !!mine;
      await setDoc(doc(db, 'alumni', user.id), {
        ...f, batch: f.batch.trim(),
        authorId: user.id, authorName: user.name,
        createdAt: mine?.createdAt || serverTimestamp(),
      });
      if (!wasListed) {
        await crossPostToFeed({
          campusKind: 'alumni', title: f.batch.trim(),
          text: `🎓 Joined Alumni · Batch ${f.batch.trim()}${(f.role || f.org) ? '\n' + [f.role, f.org].filter(Boolean).join(' @ ') : ''}${f.note ? '\n\n' + f.note : ''}`,
        });
      }
      setOpen(false);
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title="Alumni" onBack={() => navigation.goBack()} onAdd={openForm} />
      <Text style={[type.caption, { paddingHorizontal: spacing.lg, marginBottom: spacing.sm }]}>
        Seniors who've graduated — for guidance, referrals and connections.
        {mine ? ' You are listed.' : ' Graduated? Tap + to add yourself.'}
      </Text>
      <FlatList
        data={alumni}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
            No alumni listed yet.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, shadow.card]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => navigation.push('UserProfile', { userId: item.authorId, name: item.authorName })}
              >
                <Avatar userId={item.authorId} name={item.authorName} size={48} />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={{ ...type.body, fontWeight: '800' }}>
                  {item.authorName}{item.authorId === user.id ? ' (you)' : ''}
                </Text>
                <Text style={type.caption}>Batch: {item.batch}</Text>
                {!!(item.role || item.org) && (
                  <Text style={{ ...type.caption, color: colors.primaryDark, fontWeight: '700' }}>
                    {[item.role, item.org].filter(Boolean).join(' @ ')}
                  </Text>
                )}
              </View>
              {item.authorId === user.id ? (
                <TouchableOpacity onPress={() => deleteDoc(doc(db, 'alumni', user.id))}>
                  <Ionicons name="trash-outline" size={17} color={colors.danger} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.interestBtn, { backgroundColor: colors.primary }]}
                  onPress={() => navigation.navigate('ChatRoom', { otherId: item.authorId, otherName: item.authorName })}
                >
                  <Ionicons name="chatbubble" size={13} color="#fff" />
                  <Text style={{ fontWeight: '800', fontSize: 12.5, color: '#fff' }}>Message</Text>
                </TouchableOpacity>
              )}
            </View>
            {!!item.note && <Text style={[type.body, { marginTop: spacing.sm }]}>{item.note}</Text>}
          </View>
        )}
      />
      <Sheet visible={open} title={mine ? 'Edit my alumni profile' : 'Add me as alumni'} onClose={() => setOpen(false)}>
        <Input placeholder="Batch / dept & year (e.g. CSE 2018)" value={f.batch} onChangeText={(v) => setF({ ...f, batch: v })} />
        <Input placeholder="Current role (e.g. Software Engineer)" value={f.role} onChangeText={(v) => setF({ ...f, role: v })} />
        <Input placeholder="Company / organization" value={f.org} onChangeText={(v) => setF({ ...f, org: v })} />
        <Input placeholder="A note for juniors (advice, referral info…)" value={f.note} onChangeText={(v) => setF({ ...f, note: v })} multiline />
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
        </TouchableOpacity>
      </Sheet>
    </SafeAreaView>
  );
}


// ================= CLUBS =================
export function ClubsScreen({ navigation }) {
  const { user, crossPostToFeed } = useApp();
  const clubs = useCol('clubs');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', tagline: '', about: '' });
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    if (!f.name.trim()) { Alert.alert('Missing info', 'Give your club a name.'); return; }
    setBusy(true);
    try {
      await addDoc(collection(db, 'clubs'), {
        ...f, name: f.name.trim(),
        members: [user.id],
        authorId: user.id, authorName: user.name,
        createdAt: serverTimestamp(),
      });
      await crossPostToFeed({
        campusKind: 'club', title: f.name.trim(),
        text: `👥 New club: ${f.name.trim()}${f.tagline ? '\n' + f.tagline : ''}${f.about ? '\n\n' + f.about : ''}`,
      });
      setOpen(false);
      setF({ name: '', tagline: '', about: '' });
    } finally { setBusy(false); }
  };

  const toggleJoin = (club) => {
    const inClub = (club.members || []).includes(user.id);
    updateDoc(doc(db, 'clubs', club.id), {
      members: inClub ? arrayRemove(user.id) : arrayUnion(user.id),
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title="Clubs" onBack={() => navigation.goBack()} onAdd={() => setOpen(true)} />
      <FlatList
        data={clubs}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
            No clubs yet — run one? Tap + to add it.
          </Text>
        }
        renderItem={({ item }) => {
          const inClub = (item.members || []).includes(user.id);
          return (
            <View style={[styles.card, shadow.card]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ ...type.body, fontWeight: '800', fontSize: 16, flex: 1 }}>
                  {item.name}
                </Text>
                {item.authorId === user.id && (
                  <TouchableOpacity onPress={() => deleteDoc(doc(db, 'clubs', item.id))}>
                    <Ionicons name="trash-outline" size={17} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
              {!!item.tagline && (
                <Text style={{ ...type.caption, color: colors.primaryDark, fontWeight: '700' }}>
                  {item.tagline}
                </Text>
              )}
              {!!item.about && <Text style={[type.body, { marginTop: 6 }]}>{item.about}</Text>}
              <View style={styles.cardFoot}>
                <TouchableOpacity
                  style={styles.miniRow}
                  onPress={() => navigation.push('UserProfile', { userId: item.authorId, name: item.authorName })}
                >
                  <Avatar userId={item.authorId} name={item.authorName} size={24} />
                  <Text style={type.caption}>
                    {item.authorName} · {(item.members || []).length} member{(item.members || []).length === 1 ? '' : 's'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.interestBtn, inClub && { backgroundColor: colors.primary }]}
                  onPress={() => toggleJoin(item)}
                >
                  <Ionicons
                    name={inClub ? 'checkmark' : 'add'}
                    size={14}
                    color={inClub ? '#fff' : colors.primary}
                  />
                  <Text style={{ fontWeight: '800', fontSize: 12.5, color: inClub ? '#fff' : colors.primary }}>
                    {inClub ? 'Joined' : 'Join'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
      <Sheet visible={open} title="New club" onClose={() => setOpen(false)}>
        <Input placeholder="Club name (e.g. Photography Club)" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
        <Input placeholder="Tagline (e.g. We shoot every Friday)" value={f.tagline} onChangeText={(v) => setF({ ...f, tagline: v })} />
        <Input placeholder="About the club, how to join activities…" value={f.about} onChangeText={(v) => setF({ ...f, about: v })} multiline />
        <TouchableOpacity style={styles.saveBtn} onPress={publish} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Create club</Text>}
        </TouchableOpacity>
      </Sheet>
    </SafeAreaView>
  );
}

// ================= SEMINARS =================
export function SeminarsScreen({ navigation }) {
  const { user, crossPostToFeed } = useApp();
  const seminars = useCol('seminars');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', speaker: '', date: '', venue: '', details: '' });
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    if (!f.title.trim() || !f.date.trim()) {
      Alert.alert('Missing info', 'At least a title and date are needed.');
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, 'seminars'), {
        ...f, title: f.title.trim(),
        interested: [],
        authorId: user.id, authorName: user.name,
        createdAt: serverTimestamp(),
      });
      await crossPostToFeed({
        campusKind: 'seminar', title: f.title.trim(),
        text: `🎤 Seminar: ${f.title.trim()}${f.speaker ? '\nSpeaker: ' + f.speaker : ''}\n${f.date}${f.venue ? ' · ' + f.venue : ''}${f.details ? '\n\n' + f.details : ''}`,
      });
      setOpen(false);
      setF({ title: '', speaker: '', date: '', venue: '', details: '' });
    } finally { setBusy(false); }
  };

  const toggleInterest = (sem) => {
    const has = (sem.interested || []).includes(user.id);
    updateDoc(doc(db, 'seminars', sem.id), {
      interested: has ? arrayRemove(user.id) : arrayUnion(user.id),
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title="Seminars & lectures" onBack={() => navigation.goBack()} onAdd={() => setOpen(true)} />
      <FlatList
        data={seminars}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
            No seminars posted yet — tap + to share one.
          </Text>
        }
        renderItem={({ item }) => {
          const going = (item.interested || []).includes(user.id);
          return (
            <View style={[styles.card, shadow.card]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Chip label="Seminar" tone="accent" />
                {item.authorId === user.id && (
                  <TouchableOpacity onPress={() => deleteDoc(doc(db, 'seminars', item.id))}>
                    <Ionicons name="trash-outline" size={17} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={{ ...type.body, fontWeight: '800', fontSize: 16, marginTop: spacing.sm }}>
                {item.title}
              </Text>
              {!!item.speaker && (
                <Text style={{ ...type.caption, color: colors.primaryDark, fontWeight: '700' }}>
                  Speaker: {item.speaker}
                </Text>
              )}
              <Text style={[type.caption, { marginTop: 4 }]}>
                <Ionicons name="calendar" size={12} color={colors.primary} /> {item.date}
                {item.venue ? `   ·   ${item.venue}` : ''}
              </Text>
              {!!item.details && <Text style={[type.body, { marginTop: spacing.sm }]}>{item.details}</Text>}
              <View style={styles.cardFoot}>
                <TouchableOpacity
                  style={styles.miniRow}
                  onPress={() => navigation.push('UserProfile', { userId: item.authorId, name: item.authorName })}
                >
                  <Avatar userId={item.authorId} name={item.authorName} size={24} />
                  <Text style={type.caption}>{item.authorName}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.interestBtn, going && { backgroundColor: colors.primary }]}
                  onPress={() => toggleInterest(item)}
                >
                  <Ionicons name={going ? 'star' : 'star-outline'} size={14} color={going ? '#fff' : colors.primary} />
                  <Text style={{ fontWeight: '800', fontSize: 12.5, color: going ? '#fff' : colors.primary }}>
                    Interested · {(item.interested || []).length}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
      <Sheet visible={open} title="New seminar / lecture" onClose={() => setOpen(false)}>
        <Input placeholder="Title" value={f.title} onChangeText={(v) => setF({ ...f, title: v })} />
        <Input placeholder="Speaker (e.g. Dr. Rahman, CSE Dept)" value={f.speaker} onChangeText={(v) => setF({ ...f, speaker: v })} />
        <Input placeholder="Date & time" value={f.date} onChangeText={(v) => setF({ ...f, date: v })} />
        <Input placeholder="Venue" value={f.venue} onChangeText={(v) => setF({ ...f, venue: v })} />
        <Input placeholder="Details" value={f.details} onChangeText={(v) => setF({ ...f, details: v })} multiline />
        <TouchableOpacity style={styles.saveBtn} onPress={publish} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Post seminar</Text>}
        </TouchableOpacity>
      </Sheet>
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
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  cardFoot: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.md,
  },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  interestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 7,
  },
  lfBadge: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  lfBadgeText: { color: '#fff', fontWeight: '800', fontSize: 10.5, letterSpacing: 0.5 },
  lfPhoto: {
    width: '100%', height: 200, borderRadius: radius.md,
    marginTop: spacing.sm, backgroundColor: colors.primarySoft,
  },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingBottom: spacing.xxl, maxHeight: '85%',
  },
  sheetHandle: {
    width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    fontSize: 15, color: colors.ink, marginBottom: spacing.md,
  },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 4, marginBottom: spacing.md,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
}));
