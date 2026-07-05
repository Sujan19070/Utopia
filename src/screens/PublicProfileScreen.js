import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { colors, radius, spacing, type, shadow, ThemedSheet } from '../theme';
import { Avatar, PostCard, Chip, timeAgo } from '../components/ui';
import { useApp } from '../state/AppContext';

const TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'story', label: 'Story' },
  { key: 'saved', label: 'Saved' },
  { key: 'friends', label: 'Friends' },
];

export default function PublicProfileScreen({ navigation }) {
  const { user, usersById, stories, reactToPost, toggleSave, deletePost } = useApp();
  const [tab, setTab] = useState('posts');
  const [myPosts, setMyPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), where('realAuthorId', '==', user.id));
    return onSnapshot(q, (snap) =>
      setMyPosts(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      )
    );
  }, [user.id]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), where('savedBy', 'array-contains', user.id));
    return onSnapshot(q, (snap) =>
      setSavedPosts(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      )
    );
  }, [user.id]);

  const myStories = useMemo(
    () => stories.filter((s) => s.authorId === user.id),
    [stories, user.id]
  );
  const friends = (user.friends || []).map((id) => usersById[id]).filter(Boolean);

  const openComments = (post) =>
    navigation.push('Comments', {
      post: {
        id: post.id, realAuthorId: post.realAuthorId,
        authorName: post.authorName, anonymous: post.anonymous, text: post.text || '',
      },
    });

  const renderPost = ({ item }) => (
    <PostCard
      post={item}
      myId={user.id}
      onReact={(key) => reactToPost(item, key)}
      onOpenComments={() => openComments(item)}
      onSave={() => toggleSave(item)}
      onDelete={() => deletePost(item)}
    />
  );

  const data = tab === 'posts' ? myPosts : tab === 'saved' ? savedPosts : [];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={type.title}>Public Profile</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.top}>
        <Avatar userId={user.id} size={64} ring={myStories.length > 0} />
        <View style={{ marginLeft: spacing.md }}>
          <Text style={{ ...type.title }}>{user.name}</Text>
          {!!user.username && (
            <Text style={{ color: colors.primaryDark, fontWeight: '700' }}>@{user.username}</Text>
          )}
          <Text style={type.caption}>
            {myPosts.length} posts · {friends.length} friends
          </Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </View>

      {(tab === 'posts' || tab === 'saved') && (
        <FlatList
          data={data}
          keyExtractor={(p) => p.id}
          renderItem={renderPost}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: spacing.sm }}
          ListEmptyComponent={
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
              {tab === 'posts'
                ? 'No posts yet.'
                : 'No saved posts — tap the bookmark on any post to save it.'}
            </Text>
          }
        />
      )}

      {tab === 'story' && (
        <View style={{ padding: spacing.lg }}>
          {myStories.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
              <Text style={type.caption}>No active story right now.</Text>
            </View>
          ) : (
            myStories.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.storyRow, shadow.card]}
                onPress={() => navigation.navigate('StoryViewer', { authorId: user.id })}
              >
                <View style={[styles.storyThumb, { backgroundColor: s.bg || colors.primarySoft }]}>
                  <Ionicons
                    name={s.imageB64 ? 'image' : 'text'}
                    size={20}
                    color={s.bg ? '#fff' : colors.primary}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={{ ...type.body, fontWeight: '700' }} numberOfLines={1}>
                    {s.text || 'Photo story'}
                  </Text>
                  <Text style={type.caption}>{timeAgo(s.createdAt)} · disappears after 24h</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity
            style={styles.addStory}
            onPress={() => navigation.navigate('CreateStory')}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800' }}>Add to story</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'friends' && (
        <FlatList
          data={friends}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
              No friends yet — visit someone's profile and tap "Add friend".
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.friendRow, shadow.card]}
              onPress={() => navigation.push('UserProfile', { userId: item.id, name: item.name })}
            >
              <Avatar userId={item.id} size={48} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={{ ...type.body, fontWeight: '700' }}>{item.name}</Text>
                <Text style={type.caption}>
                  {item.username ? `@${item.username}` : [item.dept, item.year].filter(Boolean).join(' · ') || 'Student'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
            </TouchableOpacity>
          )}
        />
      )}
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
  top: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.lg,
  },
  tabs: {
    flexDirection: 'row', paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  storyRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  storyThumb: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  addStory: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 12, marginTop: spacing.md,
  },
  friendRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
  },
}));
