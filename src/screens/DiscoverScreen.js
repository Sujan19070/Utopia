import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  Modal, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { colors, radius, spacing, type, shadow, ThemedSheet } from '../theme';
import { Avatar, Chip } from '../components/ui';
import { SearchPickerModal, SelectField } from '../components/pickers';
import { useApp } from '../state/AppContext';
import { UNIVERSITIES } from '../data/universities';
import { HOMETOWN_OPTIONS } from '../data/hometowns';
import { COLLEGES } from '../data/colleges';
import { MEDICAL_COLLEGES } from '../data/medicalColleges';

const norm = (s) => (s || '').trim().toLowerCase();

// distance in km between two lat/lng points
function haversine(a, b) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const EMPTY_FILTERS = { university: '', hometown: '', area: '', college: '' };

export default function DiscoverScreen({ navigation }) {
  const { user, directory, sendFriendRequest, respondFriendRequest, setMyLocation, isBlockedEither , isAdmin, usersById } = useApp();
  const [tab, setTab] = useState('near'); // 'near' | 'people' | 'friends' | 'anon'
  const [reqs, setReqs] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [picker, setPicker] = useState(null); // which filter picker is open
  const [noteFor, setNoteFor] = useState(null); // person receiving a request
  const [note, setNote] = useState('');
  const [locStatus, setLocStatus] = useState('idle'); // idle|asking|on|denied
  const [myCoords, setMyCoords] = useState(null);

  // All friend requests involving me (for per-person button state)
  useEffect(() => {
    return onSnapshot(collection(db, 'friendRequests'), (snap) => {
      setReqs(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((r) => r.from === user.id || r.to === user.id)
      );
    });
  }, [user.id]);

  // Near me: get my location once when the tab opens
  useEffect(() => {
    if (tab !== 'near' || locStatus === 'on' || locStatus === 'asking') return;
    (async () => {
      setLocStatus('asking');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocStatus('denied'); return; }
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setMyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        await setMyLocation(pos.coords);
        setLocStatus('on');
      } catch (e) {
        setLocStatus('denied');
      }
    })();
  }, [tab]);

  const stopSharing = async () => {
    await setMyLocation(null);
    setMyCoords(null);
    setLocStatus('idle');
    setTab('people');
  };

  // ---- friend state per person ----
  const stateFor = (id) => {
    if ((user.friends || []).includes(id)) return 'friends';
    if (reqs.some((r) => r.to === id && r.from === user.id && r.status === 'pending')) return 'requested';
    if (reqs.some((r) => r.from === id && r.to === user.id && r.status === 'pending')) return 'incoming';
    return 'none';
  };

  // ---- filtering ----
  const activeFilters = Object.entries(filters).filter(([, v]) => norm(v));
  const matchesFilters = (p) =>
    activeFilters.every(([k, v]) => norm(p[k]) === norm(v));

  const distinct = (key) =>
    [...new Set(directory.map((u) => (u[key] || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

  const others = useMemo(
    () => directory.filter(
      (p) => p.id !== user.id && !isBlockedEither(p.id) && matchesFilters(p)
    ),
    [directory, user.id, filters, user.blocked]
  );

  const nearPeople = useMemo(() => {
    if (!myCoords) return [];
    return others
      .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number')
      .map((p) => ({ ...p, km: haversine(myCoords, { lat: p.lat, lng: p.lng }) }))
      .sort((a, b) => a.km - b.km);
  }, [others, myCoords]);

  // Friends tab: just my accepted friends (real IDs).
  const friendsList = useMemo(
    () => directory.filter((p) => (user.friends || []).includes(p.id) && !isBlockedEither(p.id)),
    [directory, user.friends, user.blocked]
  );

  // Anonymous identities: anyone with anon mode ON + a nickname. Shown by
  // nickname/avatar only — the real person is hidden (developer can still
  // trace it via realAuthorId/anonFor in the database). Anyone can message
  // an anonymous identity; no friend request needed.
  const anonPeople = useMemo(
    () => directory
      .filter((p) => p.id !== user.id && p.anon?.on && (p.anon?.name || '').trim())
      .map((p) => ({
        id: p.id,
        nick: p.anon.name,
        emoji: p.anon.emoji || '🎭',
        color: p.anon.color || '#4B3F72',
      })),
    [directory, user.id]
  );

  const submitRequest = async () => {
    const target = noteFor;
    setNoteFor(null);
    await sendFriendRequest(target.id, target.name, note.trim());
    setNote('');
  };

  // ---- row ----
  const PersonRow = ({ p, km }) => {
    const st = stateFor(p.id);
    return (
      <TouchableOpacity
        style={[styles.card, shadow.card]}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('UserProfile', { userId: p.id, name: p.name })}
      >
        <Avatar userId={p.id} name={p.name} size={50} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ ...type.body, fontWeight: '700' }}>{p.name}</Text>
            {km != null && (
              <View style={styles.kmBadge}>
                <Ionicons name="location" size={10} color={colors.primaryDark} />
                <Text style={styles.kmText}>
                  {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}
                </Text>
              </View>
            )}
          </View>
          <Text style={type.caption} numberOfLines={1}>
            {[p.university, p.hometown].filter(Boolean).join(' · ') ||
              (p.username ? `@${p.username}` : 'Student')}
          </Text>
        </View>
        {st === 'friends' && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('ChatRoom', { otherId: p.id, otherName: p.name })}
          >
            <Ionicons name="chatbubble" size={14} color="#fff" />
            <Text style={styles.primaryBtnText}>Chat</Text>
          </TouchableOpacity>
        )}
        {st === 'none' && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setNoteFor(p)}>
            <Ionicons name="person-add" size={14} color="#fff" />
            <Text style={styles.primaryBtnText}>Add</Text>
          </TouchableOpacity>
        )}
        {st === 'requested' && (
          <View style={[styles.softBtn, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="time" size={14} color={colors.accent} />
            <Text style={[styles.softBtnText, { color: colors.accent }]}>Sent</Text>
          </View>
        )}
        {st === 'incoming' && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
            onPress={() => respondFriendRequest(p.id, true)}
          >
            <Ionicons name="checkmark" size={14} color="#fff" />
            <Text style={styles.primaryBtnText}>Accept</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // Row for an anonymous identity — anyone can message it (opens an
  // anonymous chat thread on the recipient's side).
  const AnonRow = ({ a }) => (
    <View style={[styles.card, shadow.card]}>
      <TouchableOpacity
        disabled={!isAdmin}
        onPress={() => navigation.navigate('UserProfile', { userId: a.id, name: usersById?.[a.id]?.name })}
        style={{
          width: 50, height: 50, borderRadius: 25,
          backgroundColor: a.color, alignItems: 'center', justifyContent: 'center',
        }}>
        <Text style={{ fontSize: 24 }}>{a.emoji}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        disabled={!isAdmin}
        onPress={() => navigation.navigate('UserProfile', { userId: a.id, name: usersById?.[a.id]?.name })}
        style={{ flex: 1, marginLeft: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ ...type.body, fontWeight: '700' }}>{a.nick}</Text>
          <Text style={{ fontSize: 12 }}>🎭</Text>
        </View>
        <Text style={type.caption}>
          {isAdmin ? `🔍 ${usersById?.[a.id]?.name || a.id} · tap to open` : 'Anonymous · anyone can message'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.anon }]}
        onPress={() => navigation.navigate('ChatRoom', {
          otherId: a.id, otherName: a.nick, toAnon: true,
        })}
      >
        <Ionicons name="chatbubble" size={14} color="#fff" />
        <Text style={styles.primaryBtnText}>Message</Text>
      </TouchableOpacity>
    </View>
  );

  const filterCount = activeFilters.length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={type.display}>Discover</Text>
          <Text style={type.caption}>Find your people on campus</Text>
        </View>
        <TouchableOpacity style={styles.roundBtn} onPress={() => setFilterOpen(true)}>
          <Ionicons name="funnel-outline" size={20} color={colors.primaryDark} />
          {filterCount > 0 && <View style={styles.dot} />}
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <Chip label="Near me" active={tab === 'near'} onPress={() => setTab('near')} />
        <Chip label="People" active={tab === 'people'} onPress={() => setTab('people')} />
        <Chip label="Friends" active={tab === 'friends'} onPress={() => setTab('friends')} />
        <Chip label="🎭 Anonymous" active={tab === 'anon'} onPress={() => setTab('anon')} />
      </View>

      {filterCount > 0 && (
        <View style={styles.filterBar}>
          <Ionicons name="funnel" size={13} color={colors.primaryDark} />
          <Text style={styles.filterBarText} numberOfLines={1}>
            {activeFilters.map(([, v]) => v).join(' · ')}
          </Text>
          <TouchableOpacity onPress={() => setFilters(EMPTY_FILTERS)}>
            <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 12.5 }}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'near' ? (
        locStatus === 'asking' ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : locStatus === 'denied' ? (
          <View style={styles.center}>
            <Ionicons name="location-outline" size={40} color={colors.primary} />
            <Text style={[type.title, { marginTop: spacing.md }]}>Location needed</Text>
            <Text style={[type.caption, { marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }]}>
              Allow location in your phone settings to see students near you,
              or use the People tab instead.
            </Text>
          </View>
        ) : (
          <FlatList
            data={nearPeople}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
            ListHeaderComponent={
              <View style={styles.shareRow}>
                <Ionicons name="navigate" size={15} color={colors.primary} />
                <Text style={[type.caption, { flex: 1 }]}>
                  Sharing your approximate location (~100 m accuracy)
                </Text>
                <TouchableOpacity onPress={stopSharing}>
                  <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 12.5 }}>Stop</Text>
                </TouchableOpacity>
              </View>
            }
            ListEmptyComponent={
              <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
                No one nearby is sharing location yet. When your friends open
                Near me, they'll appear here with their distance.
              </Text>
            }
            renderItem={({ item }) => <PersonRow p={item} km={item.km} />}
          />
        )
      ) : tab === 'friends' ? (
        <FlatList
          data={friendsList}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
              No friends yet. Send a friend request from the People tab — once
              they accept, they show here and you can chat.
            </Text>
          }
          renderItem={({ item }) => <PersonRow p={item} />}
        />
      ) : tab === 'anon' ? (
        <FlatList
          data={anonPeople}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          ListHeaderComponent={
            <View style={styles.shareRow}>
              <Text style={{ fontSize: 15 }}>🎭</Text>
              <Text style={[type.caption, { flex: 1 }]}>
                Anonymous identities. Anyone can message them — no friend request needed.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
              No one is in anonymous mode right now. Turn it on in Profile → Anonymous.
            </Text>
          }
          renderItem={({ item }) => <AnonRow a={item} />}
        />
      ) : (
        <FlatList
          data={others}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
              {filterCount ? 'No one matches these filters.' : 'Just you so far — invite your friends!'}
            </Text>
          }
          renderItem={({ item }) => <PersonRow p={item} />}
        />
      )}

      {/* ---- friend request note ---- */}
      <Modal visible={!!noteFor} transparent animationType="fade" onRequestClose={() => setNoteFor(null)}>
        <TouchableOpacity style={styles.dim} activeOpacity={1} onPress={() => setNoteFor(null)} />
        <View style={styles.noteBox}>
          <Text style={type.title}>Add friend</Text>
          <Text style={[type.caption, { marginTop: 4 }]}>
            Send a request to {noteFor?.name} with a note (optional):
          </Text>
          <TextInput
            style={styles.noteInput}
            placeholder={`Hi ${noteFor ? noteFor.name.split(' ')[0] : ''}! We're in the same batch…`}
            placeholderTextColor={colors.inkSoft}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={140}
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <TouchableOpacity
              style={[styles.sheetBtn, { backgroundColor: colors.bg }]}
              onPress={() => { setNoteFor(null); setNote(''); }}
            >
              <Text style={{ fontWeight: '800', color: colors.inkSoft }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetBtn, { backgroundColor: colors.primary }]}
              onPress={submitRequest}
            >
              <Text style={{ fontWeight: '800', color: '#fff' }}>Send request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ---- filters ---- */}
      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <TouchableOpacity style={styles.dim} activeOpacity={1} onPress={() => setFilterOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={[type.title, { textAlign: 'center', marginBottom: spacing.md }]}>
            Find friends by…
          </Text>
          <SelectField
            label="University"
            value={filters.university}
            placeholder="Any university"
            onPress={() => setPicker('university')}
          />
          <SelectField
            label="Hometown (zila / upazila)"
            value={filters.hometown}
            placeholder="Any hometown"
            onPress={() => setPicker('hometown')}
          />
          <SelectField
            label="Area (where they live)"
            value={filters.area}
            placeholder="Any area"
            onPress={() => setPicker('area')}
          />
          <SelectField
            label="College"
            value={filters.college}
            placeholder="Any college"
            onPress={() => setPicker('college')}
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <TouchableOpacity
              style={[styles.sheetBtn, { backgroundColor: colors.bg }]}
              onPress={() => setFilters(EMPTY_FILTERS)}
            >
              <Text style={{ fontWeight: '800', color: colors.inkSoft }}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetBtn, { backgroundColor: colors.primary }]}
              onPress={() => setFilterOpen(false)}
            >
              <Text style={{ fontWeight: '800', color: '#fff' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <SearchPickerModal
        visible={picker === 'university'}
        title="Filter by university"
        items={[...UNIVERSITIES, ...MEDICAL_COLLEGES].sort((a, b) => a.localeCompare(b))}
        current={filters.university}
        onPick={(v) => setFilters({ ...filters, university: v })}
        onClose={() => setPicker(null)}
      />
      <SearchPickerModal
        visible={picker === 'hometown'}
        title="Filter by hometown"
        items={HOMETOWN_OPTIONS}
        current={filters.hometown}
        onPick={(v) => setFilters({ ...filters, hometown: v })}
        onClose={() => setPicker(null)}
      />
      <SearchPickerModal
        visible={picker === 'area'}
        title="Filter by area"
        items={distinct('area')}
        current={filters.area}
        onPick={(v) => setFilters({ ...filters, area: v })}
        onClose={() => setPicker(null)}
        allowCustom
      />
      <SearchPickerModal
        visible={picker === 'college'}
        title="Filter by college"
        items={[...new Set([...COLLEGES, ...distinct('college')])].sort((a, b) => a.localeCompare(b))}
        current={filters.college}
        onPick={(v) => setFilters({ ...filters, college: v })}
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
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg,
  },
  roundBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  dot: {
    position: 'absolute', top: 6, right: 6,
    width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent,
  },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  filterBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primarySoft,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.md,
  },
  filterBarText: { flex: 1, color: colors.primaryDark, fontWeight: '700', fontSize: 12.5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  kmBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill,
  },
  kmText: { fontSize: 11, fontWeight: '800', color: colors.primaryDark },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: 9,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 12.5 },
  softBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 9,
  },
  softBtnText: { fontWeight: '800', fontSize: 12.5 },
  shareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primarySoft, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 8, marginBottom: spacing.md,
  },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  sheetBtn: { flex: 1, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center' },
  noteBox: {
    position: 'absolute', left: spacing.xl, right: spacing.xl, top: '28%',
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl,
  },
  noteInput: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    padding: spacing.md, fontSize: 14.5, color: colors.ink,
    height: 84, textAlignVertical: 'top',
    marginTop: spacing.md, marginBottom: spacing.lg,
  },
}));
