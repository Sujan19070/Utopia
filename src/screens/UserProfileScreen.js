import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  doc, onSnapshot, collection, query, where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { colors, radius, spacing, type, ThemedSheet } from '../theme';
import { Avatar, PostCard, SectionHeader } from '../components/ui';
import { useApp } from '../state/AppContext';

export default function UserProfileScreen({ route, navigation }) {
  const { userId, name: fallbackName } = route.params;
  const {
    user, stories, reactToPost, toggleSave, deletePost,
    sendFriendRequest, respondFriendRequest,
    unfriend, blockUser, unblockUser, isBlockedEither, presenceOf,
  } = useApp();
  const [profile, setProfile] = useState(null);
  const [theirPosts, setTheirPosts] = useState([]);
  const [outgoing, setOutgoing] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const isMe = userId === user.id;

  useEffect(() => {
    return onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) setProfile({ id: userId, ...snap.data() });
    });
  }, [userId]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), where('realAuthorId', '==', userId));
    return onSnapshot(q, (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => !p.anonymous)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setTheirPosts(rows);
    });
  }, [userId]);

  // Friend request state in both directions
  useEffect(() => {
    if (isMe) return;
    const u1 = onSnapshot(doc(db, 'friendRequests', `${user.id}_${userId}`), (s) =>
      setOutgoing(s.exists() ? s.data() : null)
    );
    const u2 = onSnapshot(doc(db, 'friendRequests', `${userId}_${user.id}`), (s) =>
      setIncoming(s.exists() ? s.data() : null)
    );
    return () => { u1(); u2(); };
  }, [userId, user.id, isMe]);

  const displayName = profile?.name || fallbackName || 'Student';
  const iBlocked = (user.blocked || []).includes(userId);
  const theyBlocked = (profile?.blocked || []).includes(user.id);
  const presence = !isMe && !iBlocked && !theyBlocked ? presenceOf(userId) : null;

  const openMenu = () =>
    Alert.alert(displayName, undefined, [
      ...(isFriend ? [{
        text: 'Unfriend', style: 'destructive',
        onPress: () => Alert.alert('Remove friend?', `Unfriend ${displayName}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unfriend', style: 'destructive', onPress: () => unfriend(userId) },
        ]),
      }] : []),
      iBlocked
        ? { text: 'Unblock', onPress: () => unblockUser(userId) }
        : {
            text: 'Block', style: 'destructive',
            onPress: () => Alert.alert('Block this person?',
              'They can\'t chat with you and you won\'t see each other\'s posts. You can unblock from Settings.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Block', style: 'destructive', onPress: () => blockUser(userId) },
            ]),
          },
      { text: 'Cancel', style: 'cancel' },
    ]);
  const hasStory = useMemo(
    () => stories.some((s) => s.authorId === userId),
    [stories, userId]
  );
  const isFriend = (user.friends || []).includes(userId);

  const call = (kind) =>
    Alert.alert(`${kind} call`, `${kind} calls with ${displayName} come in the next build.`);

  const openChat = () =>
    navigation.navigate('ChatRoom', { otherId: userId, otherName: displayName });

  const openComments = (post) =>
    navigation.push('Comments', {
      post: {
        id: post.id, realAuthorId: post.realAuthorId,
        authorName: post.authorName, anonymous: post.anonymous, text: post.text || '',
      },
    });

  // Friend button: Friends ✓ / Accept / Requested / Add friend
  const FriendButton = () => {
    if (isFriend) {
      return (
        <View style={[styles.softBtn, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="checkmark-circle" size={17} color={colors.primary} />
          <Text style={styles.softBtnText}>Friends</Text>
        </View>
      );
    }
    if (incoming?.status === 'pending') {
      return (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => respondFriendRequest(userId, true)}
        >
          <Ionicons name="person-add" size={16} color="#fff" />
          <Text style={styles.primaryBtnText}>Accept request</Text>
        </TouchableOpacity>
      );
    }
    if (outgoing?.status === 'pending') {
      return (
        <View style={[styles.softBtn, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="time" size={16} color={colors.accent} />
          <Text style={[styles.softBtnText, { color: colors.accent }]}>Requested</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => sendFriendRequest(userId, displayName)}
      >
        <Ionicons name="person-add" size={16} color="#fff" />
        <Text style={styles.primaryBtnText}>Add friend</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={type.title}>Profile</Text>
        {!isMe ? (
          <TouchableOpacity onPress={openMenu}>
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.ink} />
          </TouchableOpacity>
        ) : <View style={{ width: 26 }} />}
      </View>

      {(iBlocked || theyBlocked) ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Ionicons name="ban" size={44} color={colors.inkSoft} />
          <Text style={[type.title, { marginTop: spacing.md }]}>
            {iBlocked ? 'You blocked this user' : 'Profile unavailable'}
          </Text>
          {iBlocked && (
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: spacing.lg }]}
              onPress={() => unblockUser(userId)}
            >
              <Text style={styles.primaryBtnText}>Unblock</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
      {!(iBlocked || theyBlocked) && (
      <FlatList
        data={theirPosts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View>
            <View style={styles.head}>
              <TouchableOpacity
                disabled={!hasStory}
                onPress={() => navigation.navigate('StoryViewer', { authorId: userId })}
              >
                <Avatar userId={userId} name={displayName} size={80} ring={hasStory} />
              </TouchableOpacity>
              {hasStory && (
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12, marginTop: 4 }}>
                  Tap photo to view story
                </Text>
              )}
              <Text style={[type.display, { marginTop: spacing.sm }]}>
                {displayName}{isMe ? ' (you)' : ''}
              </Text>
              {!!profile?.username && (
                <Text style={{ color: colors.primaryDark, fontWeight: '700' }}>
                  @{profile.username}
                </Text>
              )}
              {presence && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <View style={{
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: presence.active ? '#31C48D' : colors.inkSoft,
                  }} />
                  <Text style={{ ...type.caption, fontWeight: '700', color: presence.active ? '#1FA372' : colors.inkSoft }}>
                    {presence.active ? 'Active now' : `Last seen ${presence.ago} ago`}
                  </Text>
                </View>
              )}
              <Text style={type.caption}>
                {[profile?.hometown, profile?.university || profile?.dept]
                  .filter(Boolean).join(' · ') || 'Student'}
                {'  ·  '}{(profile?.friends || []).length} friends
              </Text>
              {!!profile?.role && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: profile.roleVerified ? colors.primarySoft : colors.bg,
                  borderWidth: profile.roleVerified ? 0 : 1,
                  borderColor: colors.line,
                  borderRadius: 999,
                  paddingHorizontal: 10, paddingVertical: 4, marginTop: spacing.sm,
                }}>
                  <Text style={{ fontSize: 12 }}>
                    {profile.role === 'teacher' ? '👨‍🏫' : profile.role === 'alumni' ? '🎓' : '📚'}
                  </Text>
                  <Text style={{
                    fontSize: 12, fontWeight: '800',
                    color: profile.roleVerified ? colors.primaryDark : colors.inkSoft,
                  }}>
                    {profile.role === 'teacher' ? 'Teacher' : profile.role === 'alumni' ? 'Alumni' : 'Student'}
                    {profile.subject ? ` · ${profile.subject}` : ''}
                    {profile.batch ? ` · ${profile.batch}` : ''}
                  </Text>
                  {profile.roleVerified
                    ? <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                    : <Text style={{ fontSize: 10, color: colors.inkSoft }}>· unverified</Text>}
                </View>
              )}
              {!!(profile?.major || profile?.minorField) && (
                <Text style={[type.caption, { marginTop: 2 }]}>
                  {[profile?.major && `Major: ${profile.major}`, profile?.minorField && `Minor: ${profile.minorField}`]
                    .filter(Boolean).join('  ·  ')}
                </Text>
              )}
              {(profile?.interests || []).length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm, justifyContent: 'center' }}>
                  {profile.interests.map((i) => (
                    <View key={i} style={{
                      backgroundColor: colors.primarySoft, borderRadius: 999,
                      paddingHorizontal: 10, paddingVertical: 4,
                      marginRight: 6, marginBottom: 6,
                    }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primaryDark }}>{i}</Text>
                    </View>
                  ))}
                </View>
              )}

              {!isMe && (
                <View style={styles.btnRow}>
                  <FriendButton />
                  {isFriend && (
                    <TouchableOpacity style={styles.softBtn} onPress={openChat}>
                      <Ionicons name="chatbubble" size={16} color={colors.primary} />
                      <Text style={styles.softBtnText}>Chat</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.iconBtn} onPress={() => call('Voice')}>
                    <Ionicons name="call" size={17} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => call('Video')}>
                    <Ionicons name="videocam" size={17} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <SectionHeader label={isMe ? 'Your public posts' : 'Posts'} />
            {theirPosts.length === 0 && (
              <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.md }]}>
                No public posts yet.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            myId={user.id}
            onReact={(key) => reactToPost(item, key)}
            onOpenComments={() => openComments(item)}
            onSave={() => toggleSave(item)}
            onDelete={() => deletePost(item)}
          />
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
  head: { alignItems: 'center', padding: spacing.xl, paddingBottom: spacing.md },
  btnRow: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg,
    alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center',
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: 11,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
  softBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primarySoft, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: 11,
  },
  softBtnText: { color: colors.primaryDark, fontWeight: '800', fontSize: 13.5 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
}));
