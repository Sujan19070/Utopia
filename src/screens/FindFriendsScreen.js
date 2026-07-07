import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Image,
  Modal, ActivityIndicator, ScrollView, KeyboardAvoidingView, Alert, Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { colors, radius, spacing, type, shadow, ThemedSheet } from '../theme';
import { timeAgo, FeedActions } from '../components/ui';
import { SearchPickerModal } from '../components/pickers';
import { HOMETOWN_OPTIONS } from '../data/hometowns';
import { useApp } from '../state/AppContext';
import { smartCompress } from '../utils/image';

const RED = '#D64545';

const KINDS = [
  { key: 'confession', emoji: '💌', label: 'Confession' },
  { key: 'crush', emoji: '💘', label: 'Crush' },
  { key: 'friend', emoji: '👋', label: 'Find a friend' },
  { key: 'coffee', emoji: '☕', label: 'Coffee adda' },
  { key: 'chill', emoji: '😎', label: 'Chilling' },
  { key: 'study', emoji: '📚', label: 'Study partner' },
  { key: 'other', emoji: '🎯', label: 'Other' },
];
const kindOf = (k) => KINDS.find((x) => x.key === k) || KINDS[KINDS.length - 1];

// Either/or personality picks + interest tags.
const EITHERS = [
  { key: 'coffeeTea', a: '☕ Coffee', b: '🍵 Tea' },
  { key: 'morningNight', a: '🌅 Morning', b: '🌙 Night' },
  { key: 'introExtro', a: '🤫 Introvert', b: '🎉 Extrovert' },
];
const TAGS = ['🎬 Movies', '🌸 Anime', '🎮 Gaming', '⚽ Football', '💻 Programming'];

export default function FindFriendsScreen({ navigation }) {
  const { user, crossPostToFeed, isAdmin, usersById } = useApp();
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [homePick, setHomePick] = useState(false);
  const [f, setF] = useState({
    kind: 'friend', text: '', hometown: '', anonymous: false,
    eithers: {}, tags: [],
  });
  const [photo, setPhoto] = useState(null); // base64 or null

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (res.canceled) return;
    setBusy(true);
    try {
      setPhoto(await smartCompress(res.assets[0], 900, 0.55));
    } catch (e) { Alert.alert('Photo', String(e?.message || e)); }
    finally { setBusy(false); }
  };

  useEffect(() => onSnapshot(collection(db, 'findFriends'), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    setItems(list);
  }), []);

  const visible = useMemo(
    () => (filter ? (items || []).filter((i) => i.kind === filter) : items),
    [items, filter]
  );

  const interestChips = (it) => {
    const out = [];
    EITHERS.forEach((e) => { if (it.eithers?.[e.key]) out.push(it.eithers[e.key]); });
    (it.tags || []).forEach((t) => out.push(t));
    return out;
  };

  const submit = async () => {
    setErr('');
    if (!f.text.trim()) return setErr('Write your post first.');
    setBusy(true);
    try {
      const secRef = await addDoc(collection(db, 'findFriends'), {
        kind: f.kind,
        text: f.text.trim(),
        hometown: f.hometown,
        eithers: f.eithers,
        tags: f.tags,
        anonymous: !!f.anonymous,
        imageB64: photo,
        authorId: user.id,
        authorName: user.name,
        createdAt: serverTimestamp(),
      });
      const k = kindOf(f.kind);
      const chips = interestChips(f);
      const feedId = await crossPostToFeed({
        campusKind: 'findfriends',
        title: k.label,
        anonymous: !!f.anonymous,
        text: `${k.emoji} ${k.label}\n${f.text.trim()}${f.hometown ? `\n🏠 ${f.hometown}` : ''}${chips.length ? `\n${chips.join(' · ')}` : ''}`,
        imageB64: photo,
      });
      await updateDoc(secRef, { feedPostId: feedId });
      setOpen(false);
      setF({ kind: 'friend', text: '', hometown: '', anonymous: false, eithers: {}, tags: [] });
      setPhoto(null);
    } catch (e) { setErr(String(e?.message || e)); }
    finally { setBusy(false); }
  };

  const Card = ({ it }) => {
    const k = kindOf(it.kind);
    const chips = interestChips(it);
    const mine = it.authorId === user.id;
    const canOpen = !it.anonymous || isAdmin;
    return (
      <View style={[styles.card, shadow.card]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.kindBadge, { backgroundColor: RED }]}>
            <Text style={{ fontSize: 12 }}>{k.emoji}</Text>
            <Text style={styles.kindBadgeText}>{k.label}</Text>
          </View>
          <View style={{ flex: 1 }} />
          {(mine || isAdmin) && (
            <TouchableOpacity onPress={() => Alert.alert('Delete this post?',
              'This removes it for everyone and cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteDoc(doc(db, 'findFriends', it.id)) },
              ])}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          disabled={!canOpen}
          onPress={() => navigation.navigate('UserProfile', {
            userId: it.authorId, name: it.authorName,
          })}
          style={{ marginTop: spacing.sm }}
        >
          <Text style={type.caption}>
            {it.anonymous
              ? (isAdmin ? `🎭 Anonymous · 🔍 ${usersById?.[it.authorId]?.name || it.authorId} · tap to open` : '🎭 Anonymous')
              : `${it.authorName}${mine ? ' (you)' : ''}`}
            {'  ·  '}{timeAgo(it.createdAt)}
          </Text>
        </TouchableOpacity>

        <Text style={[type.body, { marginTop: spacing.sm }]}>{it.text}</Text>
        {!!it.imageB64 && (
          <Image source={{ uri: `data:image/jpeg;base64,${it.imageB64}` }} style={styles.photo} />
        )}

        {(!!it.hometown || chips.length > 0) && (
          <View style={styles.chipsRow}>
            {!!it.hometown && (
              <View style={styles.chip}><Text style={styles.chipText}>🏠 {it.hometown}</Text></View>
            )}
            {chips.map((c) => (
              <View key={c} style={styles.chip}><Text style={styles.chipText}>{c}</Text></View>
            ))}
          </View>
        )}
        <FeedActions feedPostId={it.feedPostId} navigation={navigation} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={type.title}>Find friends</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: RED }]} onPress={() => { setErr(''); setOpen(true); }}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* motto banner */}
      <View style={styles.motto}>
        <Ionicons name="heart" size={14} color="#fff" />
        <Text style={styles.mottoText}>Post it, ask it & confess it.</Text>
      </View>

      {/* kind filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }} contentContainerStyle={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, !filter && { backgroundColor: RED, borderColor: RED }]}
          onPress={() => setFilter('')}>
          <Text style={[styles.filterChipText, !filter && { color: '#fff' }]}>All</Text>
        </TouchableOpacity>
        {KINDS.map((k) => (
          <TouchableOpacity key={k.key}
            style={[styles.filterChip, filter === k.key && { backgroundColor: RED, borderColor: RED }]}
            onPress={() => setFilter(filter === k.key ? '' : k.key)}>
            <Text style={[styles.filterChipText, filter === k.key && { color: '#fff' }]}>
              {k.emoji} {k.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {items === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={RED} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
              Nothing here yet. Confess something, find your coffee adda, or
              hunt for a study partner — anonymously if you like. ❤️
            </Text>
          }
          renderItem={({ item }) => <Card it={item} />}
        />
      )}

      {/* composer */}
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.dim} activeOpacity={1} onPress={() => setOpen(false)} />
        <KeyboardAvoidingView behavior="padding">
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl }}>
              <Text style={[type.title, { textAlign: 'center' }]}>❤️ Post it, ask it & confess it</Text>

              <Text style={[type.label, { marginTop: spacing.md }]}>What is this?</Text>
              <View style={styles.kindWrap}>
                {KINDS.map((k) => (
                  <TouchableOpacity key={k.key}
                    style={[styles.kindChip, f.kind === k.key && { backgroundColor: RED, borderColor: RED }]}
                    onPress={() => setF({ ...f, kind: k.key })}>
                    <Text style={[styles.kindChipText, f.kind === k.key && { color: '#fff' }]}>
                      {k.emoji} {k.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={type.label}>Your post</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder={
                  f.kind === 'confession' ? 'Say what you never said out loud…'
                  : f.kind === 'crush' ? 'Green shirt, library, 2pm. You know who you are…'
                  : f.kind === 'study' ? 'Looking for a study partner for…'
                  : 'Who are you looking for? What do you want to do?'
                }
                placeholderTextColor={colors.inkSoft}
                multiline
                value={f.text}
                onChangeText={(v) => setF({ ...f, text: v })}
              />

              <Text style={type.label}>Hometown (optional — find people from home)</Text>
              <TouchableOpacity style={styles.homeBtn} onPress={() => setHomePick(true)}>
                <Ionicons name="home-outline" size={15} color={RED} />
                <Text style={{ ...type.body, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                  {f.hometown || 'Select hometown…'}
                </Text>
                {!!f.hometown && (
                  <TouchableOpacity onPress={() => setF({ ...f, hometown: '' })}>
                    <Ionicons name="close-circle" size={18} color={colors.inkSoft} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.homeBtn} onPress={pickPhoto} disabled={busy}>
                <Ionicons name="image-outline" size={15} color={RED} />
                <Text style={{ ...type.body, fontWeight: '700', flex: 1 }}>
                  {photo ? 'Photo attached ✓' : 'Add a photo (optional)'}
                </Text>
                {!!photo && (
                  <TouchableOpacity onPress={() => setPhoto(null)}>
                    <Ionicons name="close-circle" size={18} color={colors.inkSoft} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              {!!photo && (
                <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={styles.photoPreview} />
              )}

              <Text style={[type.label, { marginTop: spacing.sm }]}>About you (optional)</Text>
              {EITHERS.map((e) => (
                <View key={e.key} style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  {[e.a, e.b].map((opt) => (
                    <TouchableOpacity key={opt}
                      style={[styles.eitherChip, f.eithers[e.key] === opt && { backgroundColor: RED, borderColor: RED }]}
                      onPress={() => setF({
                        ...f,
                        eithers: { ...f.eithers, [e.key]: f.eithers[e.key] === opt ? null : opt },
                      })}>
                      <Text style={[styles.kindChipText, f.eithers[e.key] === opt && { color: '#fff' }]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              <View style={[styles.kindWrap, { marginTop: 8 }]}>
                {TAGS.map((t) => {
                  const on = f.tags.includes(t);
                  return (
                    <TouchableOpacity key={t}
                      style={[styles.kindChip, on && { backgroundColor: RED, borderColor: RED }]}
                      onPress={() => setF({
                        ...f, tags: on ? f.tags.filter((x) => x !== t) : [...f.tags, t],
                      })}>
                      <Text style={[styles.kindChipText, on && { color: '#fff' }]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.anonRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...type.body, fontWeight: '700' }}>🎭 Post anonymously</Text>
                  <Text style={type.caption}>Nobody sees your name — perfect for confessions.</Text>
                </View>
                <Switch
                  value={f.anonymous}
                  onValueChange={(v) => setF({ ...f, anonymous: v })}
                  trackColor={{ true: RED }}
                />
              </View>

              {!!err && <Text style={{ color: colors.danger, fontWeight: '700', marginTop: spacing.sm }}>{err}</Text>}
              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: RED }]} onPress={submit} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                    {f.anonymous ? 'Post anonymously ❤️' : 'Post ❤️'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SearchPickerModal
        visible={homePick}
        title="Your hometown"
        items={HOMETOWN_OPTIONS}
        current={f.hometown}
        onPick={(v) => setF({ ...f, hometown: v })}
        onClose={() => setHomePick(false)}
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
    alignItems: 'center', justifyContent: 'center',
  },
  motto: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#D64545', paddingVertical: 8,
  },
  mottoText: { color: '#fff', fontWeight: '800', fontSize: 12.5, letterSpacing: 0.3 },
  filterRow: {
    gap: 8, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  filterChip: {
    borderRadius: 999, borderWidth: 1.5, borderColor: colors.line,
    backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 7,
  },
  filterChipText: { fontSize: 12.5, fontWeight: '800', color: colors.ink },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  kindBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
  },
  kindBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  chipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm,
  },
  chip: {
    backgroundColor: colors.bg, borderRadius: 999,
    borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  chipText: { fontSize: 11.5, fontWeight: '700', color: colors.ink },
  kindWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: spacing.sm },
  kindChip: {
    borderRadius: 999, borderWidth: 1.5, borderColor: colors.line,
    backgroundColor: colors.bg, paddingHorizontal: 11, paddingVertical: 7,
  },
  kindChipText: { fontSize: 12.5, fontWeight: '800', color: colors.ink },
  eitherChip: {
    flex: 1, alignItems: 'center', borderRadius: 999,
    borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.bg,
    paddingVertical: 8,
  },
  homeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    padding: spacing.md, marginTop: 6, marginBottom: spacing.sm,
  },
  photo: {
    width: '100%', height: 220, borderRadius: radius.md,
    marginTop: spacing.sm, backgroundColor: colors.bg,
  },
  photoPreview: {
    width: '100%', height: 150, borderRadius: radius.md,
    marginBottom: spacing.sm, backgroundColor: colors.bg,
  },
  anonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bg, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.sm,
  },
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
    borderRadius: radius.md, paddingVertical: 15,
    alignItems: 'center', marginTop: spacing.md,
  },
}));
