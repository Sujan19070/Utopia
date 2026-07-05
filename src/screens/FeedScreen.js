import React, { useMemo, useState } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type, ThemedSheet } from '../theme';
import { PostCard, Avatar } from '../components/ui';
import { SearchPickerModal, SelectField } from '../components/pickers';
import { useApp } from '../state/AppContext';
import { UNIVERSITIES } from '../data/universities';
import { HOMETOWN_OPTIONS } from '../data/hometowns';
import { COLLEGES } from '../data/colleges';
import { MEDICAL_COLLEGES } from '../data/medicalColleges';

const FILTER_FIELDS = [
  { key: 'university', label: 'University' },
  { key: 'hometown', label: 'Hometown' },
  { key: 'college', label: 'College' },
  { key: 'school', label: 'School' },
  { key: 'area', label: 'Area' },
];
const EMPTY = { university: '', hometown: '', college: '', school: '', area: '' };
const norm = (s) => (s || '').trim().toLowerCase();

function StoriesRow({ navigation }) {
  const { user, stories, isBlockedEither } = useApp();
  const authors = useMemo(() => {
    const seen = new Map();
    stories.forEach((s) => {
      if (!seen.has(s.authorId)) seen.set(s.authorId, { id: s.authorId, name: s.authorName });
    });
    return [...seen.values()].filter((a) => a.id !== user.id && !isBlockedEither(a.id));
  }, [stories, user.id]);
  const iHaveStory = stories.some((s) => s.authorId === user.id);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.storiesRow}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}
    >
      <TouchableOpacity
        style={styles.storyItem}
        onPress={() =>
          iHaveStory
            ? navigation.navigate('StoryViewer', { authorId: user.id })
            : navigation.navigate('CreateStory')
        }
      >
        <View>
          <Avatar userId={user.id} size={58} ring={iHaveStory} />
          <TouchableOpacity
            style={styles.plusBadge}
            onPress={() => navigation.navigate('CreateStory')}
          >
            <Ionicons name="add" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.storyName} numberOfLines={1}>Your story</Text>
      </TouchableOpacity>

      {authors.map((a) => (
        <TouchableOpacity
          key={a.id}
          style={styles.storyItem}
          onPress={() => navigation.navigate('StoryViewer', { authorId: a.id })}
        >
          <Avatar userId={a.id} name={a.name} size={58} ring />
          <Text style={styles.storyName} numberOfLines={1}>
            {(a.name || 'Student').split(' ')[0]}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function FilterModal({ visible, onClose, filters, setFilters }) {
  const [picker, setPicker] = useState(null);
  const distinct = (key) => filters.__distinct?.[key] || [];
  const set = (key, v) => setFilters((prev) => ({ ...prev, [key]: v }));
  const clear = () => setFilters((prev) => ({ ...EMPTY, __distinct: prev.__distinct }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.dim} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={[type.title, { textAlign: 'center' }]}>Filter the feed</Text>
        <Text style={[type.caption, { textAlign: 'center', marginTop: 4, marginBottom: spacing.lg }]}>
          Pick any values to see matching posts. Anonymous posts always stay visible.
        </Text>

        <SelectField label="University" value={filters.university}
          placeholder="Any university" onPress={() => setPicker('university')} />
        <SelectField label="Hometown (zila / upazila)" value={filters.hometown}
          placeholder="Any hometown" onPress={() => setPicker('hometown')} />
        <SelectField label="College" value={filters.college}
          placeholder="Any college" onPress={() => setPicker('college')} />
        <SelectField label="School" value={filters.school}
          placeholder="Any school" onPress={() => setPicker('school')} />
        <SelectField label="Area" value={filters.area}
          placeholder="Any area" onPress={() => setPicker('area')} />

        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
          <TouchableOpacity style={[styles.sheetBtn, { backgroundColor: colors.bg }]} onPress={clear}>
            <Text style={{ fontWeight: '800', color: colors.inkSoft }}>Clear all</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sheetBtn, { backgroundColor: colors.primary }]} onPress={onClose}>
            <Text style={{ fontWeight: '800', color: '#fff' }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SearchPickerModal visible={picker === 'university'} title="Filter by university"
        items={[...UNIVERSITIES, ...MEDICAL_COLLEGES].sort((a, b) => a.localeCompare(b))} current={filters.university}
        onPick={(v) => set('university', v)} onClose={() => setPicker(null)} allowCustom />
      <SearchPickerModal visible={picker === 'hometown'} title="Filter by hometown"
        items={HOMETOWN_OPTIONS} current={filters.hometown}
        onPick={(v) => set('hometown', v)} onClose={() => setPicker(null)} />
      <SearchPickerModal visible={picker === 'college'} title="Filter by college"
        items={[...new Set([...COLLEGES, ...distinct('college')])].sort((a, b) => a.localeCompare(b))}
        current={filters.college}
        onPick={(v) => set('college', v)} onClose={() => setPicker(null)} allowCustom />
      <SearchPickerModal visible={picker === 'school'} title="Filter by school"
        items={distinct('school')} current={filters.school}
        onPick={(v) => set('school', v)} onClose={() => setPicker(null)} allowCustom />
      <SearchPickerModal visible={picker === 'area'} title="Filter by area"
        items={distinct('area')} current={filters.area}
        onPick={(v) => set('area', v)} onClose={() => setPicker(null)} allowCustom />
    </Modal>
  );
}

export default function FeedScreen({ navigation }) {
  const {
    posts, reactToPost, toggleSave, deletePost, user, unreadCount, usersById,
    isBlockedEither,
  } = useApp();
  const [filters, setFilters] = useState(EMPTY);
  const [filterOpen, setFilterOpen] = useState(false);

  // distinct values people have entered (for school/area/college pickers)
  const distinct = useMemo(() => {
    const keys = ['college', 'school', 'area'];
    const out = {};
    keys.forEach((k) => {
      out[k] = [...new Set(
        Object.values(usersById).map((u) => (u[k] || '').trim()).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b));
    });
    return out;
  }, [usersById]);

  const active = FILTER_FIELDS.filter((ff) => norm(filters[ff.key]));

  // Filtered view: identified posts must match every chosen value;
  // anonymous posts always pass (so filters can't unmask anyone).
  const visiblePosts = useMemo(() => {
    if (!posts) return posts;
    const base = posts.filter(
      (p) => p.anonymous || !isBlockedEither(p.realAuthorId)
    );
    if (active.length === 0) return base;
    return base.filter((p) => {
      if (p.anonymous) return true;
      const author = usersById[p.realAuthorId];
      if (!author) return false;
      return active.every((ff) => norm(author[ff.key]) === norm(filters[ff.key]));
    });
  }, [posts, filters, usersById]);

  const filterLabels = active.map((ff) => filters[ff.key]).join(', ');

  const openComments = (post) =>
    navigation.navigate('Comments', {
      post: {
        id: post.id,
        realAuthorId: post.realAuthorId,
        authorName: post.authorName,
        anonymous: post.anonymous,
        text: post.text || '',
      },
    });

  const openProfile = (post) =>
    navigation.navigate('UserProfile', { userId: post.realAuthorId, name: post.authorName });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={type.display}>Campus feed</Text>
          <Text style={type.caption}>Live — everyone on Utopia sees this</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity style={styles.roundBtn} onPress={() => setFilterOpen(true)}>
            <Ionicons name="funnel-outline" size={20} color={colors.primaryDark} />
            {active.length > 0 && <View style={styles.dot} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.roundBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.primaryDark} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.compose} onPress={() => navigation.navigate('CreatePost')}>
            <Ionicons name="add" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {active.length > 0 && (
        <View style={styles.filterBar}>
          <Ionicons name="funnel" size={13} color={colors.primaryDark} />
          <Text style={styles.filterBarText} numberOfLines={1}>
            Filtered: {filterLabels}
          </Text>
          <TouchableOpacity onPress={() => setFilters(EMPTY)}>
            <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 12.5 }}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {posts === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visiblePosts}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={<StoriesRow navigation={navigation} />}
          ListEmptyComponent={
            <View style={[styles.center, { paddingTop: 80 }]}>
              <Ionicons name="leaf-outline" size={40} color={colors.primary} />
              <Text style={[type.title, { marginTop: spacing.md }]}>
                {active.length ? 'No matching posts' : 'Nothing here yet'}
              </Text>
              <Text style={[type.caption, { marginTop: 4 }]}>
                {active.length ? 'Try fewer filters.' : 'Be the first — tap + to post.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              myId={user.id}
              onReact={(key) => reactToPost(item, key)}
              onOpenComments={() => openComments(item)}
              onOpenProfile={() => openProfile(item)}
              onSave={() => toggleSave(item)}
              onDelete={() => deletePost(item)}
            />
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <FilterModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={{ ...filters, __distinct: distinct }}
        setFilters={setFilters}
      />
    </SafeAreaView>
  );
}

const styles = ThemedSheet(() => ({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
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
  badge: {
    position: 'absolute', top: 2, right: 2,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  compose: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  filterBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primarySoft,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.md,
  },
  filterBarText: { flex: 1, color: colors.primaryDark, fontWeight: '700', fontSize: 12.5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 100 },
  storiesRow: { marginBottom: spacing.md },
  storyItem: { alignItems: 'center', width: 68 },
  storyName: { ...type.caption, marginTop: 4, maxWidth: 68, textAlign: 'center' },
  plusBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bg,
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
  filterRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  filterRowActive: { backgroundColor: colors.primary },
  sheetBtn: {
    flex: 1, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center',
  },
}));
