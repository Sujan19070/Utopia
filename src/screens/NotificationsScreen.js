import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type, ThemedSheet } from '../theme';
import { Avatar, timeAgo } from '../components/ui';
import { useApp } from '../state/AppContext';

const META = {
  reaction: { icon: 'heart', color: colors.danger, text: (n) => `reacted ${n.emoji || ''} to your post` },
  comment: { icon: 'chatbubble', color: colors.primary, text: () => 'commented on your post' },
  reply: { icon: 'return-down-forward', color: colors.accent, text: () => 'replied to your comment' },
  mention: { icon: 'at', color: colors.anon, text: () => 'mentioned you in a comment' },
  friend_request: { icon: 'person-add', color: colors.primary, text: () => 'sent you a friend request' },
  friend_accept: { icon: 'people', color: colors.primary, text: () => 'accepted your friend request — you are now friends' },
  message: { icon: 'chatbubble-ellipses', color: colors.primary, text: () => 'sent you a message' },
  story_reaction: { icon: 'heart', color: colors.danger, text: (n) => `reacted ${n.emoji || ''} to your story` },
  story_reply: { icon: 'return-down-forward', color: colors.primary, text: () => 'replied to your story' },
  star: { icon: 'star', color: colors.accent, text: () => 'gave your post a ⭐ star' },
};

export default function NotificationsScreen({ navigation }) {
  const { user, notifications, markNotificationsRead, respondFriendRequest, isBlockedEither } = useApp();
  const visible = notifications.filter((n) => !n.fromId || !isBlockedEither(n.fromId));
  const [handled, setHandled] = useState({}); // notifId -> 'accepted' | 'ignored'

  useEffect(() => {
    markNotificationsRead();
  }, []);

  const open = (n) => {
    if (n.type === 'message' || n.type === 'story_reply') {
      navigation.navigate('ChatRoom', n.chatId
        ? { chatId: n.chatId }
        : { otherId: n.fromId, otherName: n.fromName });
      return;
    }
    if (n.type === 'story_reaction') return;
    if (n.type === 'friend_request' || n.type === 'friend_accept') {
      navigation.push('UserProfile', { userId: n.fromId, name: n.fromName });
      return;
    }
    if (!n.postId) return;
    navigation.push('Comments', {
      post: {
        id: n.postId,
        realAuthorId: n.postOwnerId,
        authorName: null,
        anonymous: false,
        text: n.preview || '',
      },
    });
  };

  const renderFriendActions = (n) => {
    const alreadyFriends = (user.friends || []).includes(n.fromId);
    if (alreadyFriends) {
      return (
        <View style={styles.actionRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12.5 }}>Friends</Text>
        </View>
      );
    }
    if (handled[n.id] === 'ignored') {
      return <Text style={[type.caption, { marginTop: 6 }]}>Request ignored</Text>;
    }
    return (
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => {
            respondFriendRequest(n.fromId, true);
            setHandled((h) => ({ ...h, [n.id]: 'accepted' }));
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12.5 }}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ignoreBtn}
          onPress={() => {
            respondFriendRequest(n.fromId, false);
            setHandled((h) => ({ ...h, [n.id]: 'ignored' }));
          }}
        >
          <Text style={{ color: colors.inkSoft, fontWeight: '800', fontSize: 12.5 }}>Ignore</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={type.title}>Notifications</Text>
        <View style={{ width: 26 }} />
      </View>

      {visible.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={40} color={colors.primary} />
          <Text style={[type.title, { marginTop: spacing.md }]}>Nothing yet</Text>
          <Text style={[type.caption, { marginTop: 4 }]}>
            Reactions, comments, mentions and friend requests land here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => {
            const meta = META[item.type] || META.comment;
            return (
              <TouchableOpacity
                style={[styles.row, !item.read && styles.unread]}
                onPress={() => open(item)}
              >
                <View>
                  <Avatar
                    userId={item.fromId}
                    name={item.fromName}
                    anonymous={!item.fromId}
                    anonMeta={!item.fromId ? { emoji: '🎭', color: colors.anon } : null}
                    size={46}
                  />
                  <View style={[styles.typeBadge, { backgroundColor: meta.color }]}>
                    <Ionicons name={meta.icon} size={11} color="#fff" />
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={type.body}>
                    <Text style={{ fontWeight: '800' }}>{item.fromName}</Text> {meta.text(item)}
                  </Text>
                  {!!item.preview && (
                    <Text style={type.caption} numberOfLines={1}>“{item.preview}”</Text>
                  )}
                  <Text style={[type.caption, { marginTop: 2 }]}>{timeAgo(item.createdAt)}</Text>
                  {item.type === 'friend_request' && renderFriendActions(item)}
                </View>
              </TouchableOpacity>
            );
          }}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line,
  },
  unread: { backgroundColor: colors.primarySoft },
  typeBadge: {
    position: 'absolute', right: -3, bottom: -3,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.surface,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 8 },
  acceptBtn: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: 7,
  },
  ignoreBtn: {
    backgroundColor: colors.bg, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.lg, paddingVertical: 7,
  },
}));
