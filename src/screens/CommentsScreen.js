import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { colors, radius, spacing, type, ThemedSheet } from '../theme';
import { Avatar, timeAgo } from '../components/ui';
import { useApp } from '../state/AppContext';

// Bold the @mentions inside a comment's text.
function MentionText({ text, mentions }) {
  if (!mentions?.length) return <Text style={type.body}>{text}</Text>;
  const names = mentions.map((m) => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(@(?:${names.join('|')}))`, 'g'));
  return (
    <Text style={type.body}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ fontWeight: '800', color: colors.primaryDark }}>{p}</Text>
        ) : (
          <Text key={i}>{p}</Text>
        )
      )}
    </Text>
  );
}

function CommentRow({ postId, comment, isReply, myId, onProfile, onReply }) {
  const { voteComment } = useApp();
  const likes = comment.likes || [];
  const dislikes = comment.dislikes || [];
  return (
    <View style={[styles.commentRow, isReply && styles.replyRow]}>
      <TouchableOpacity
        disabled={!!comment.anonymous}
        onPress={() => onProfile(comment.authorId, comment.authorName)}
      >
        <Avatar
          userId={comment.anonymous ? null : comment.authorId}
          name={comment.anonymous ? (comment.anonName || 'Anonymous') : comment.authorName}
          anonymous={comment.anonymous}
          anonMeta={comment.anonAvatar}
          size={isReply ? 30 : 38}
        />
      </TouchableOpacity>
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <View style={styles.bubbleC}>
          <TouchableOpacity
            disabled={!!comment.anonymous}
            onPress={() => onProfile(comment.authorId, comment.authorName)}
          >
            <Text style={{ ...type.caption, fontWeight: '800', color: colors.ink }}>
              {comment.anonymous ? (comment.anonName || 'Anonymous') : comment.authorName}{comment.authorId === myId ? ' (you)' : ''}
            </Text>
          </TouchableOpacity>
          <MentionText text={comment.text} mentions={comment.mentions} />
        </View>
        <View style={styles.commentActions}>
          <Text style={type.caption}>{timeAgo(comment.createdAt)}</Text>
          <TouchableOpacity style={styles.voteBtn} onPress={() => voteComment(postId, comment, 'likes')}>
            <Ionicons
              name={likes.includes(myId) ? 'thumbs-up' : 'thumbs-up-outline'}
              size={14}
              color={likes.includes(myId) ? colors.primary : colors.inkSoft}
            />
            <Text style={type.caption}>{likes.length || ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.voteBtn} onPress={() => voteComment(postId, comment, 'dislikes')}>
            <Ionicons
              name={dislikes.includes(myId) ? 'thumbs-down' : 'thumbs-down-outline'}
              size={14}
              color={dislikes.includes(myId) ? colors.danger : colors.inkSoft}
            />
            <Text style={type.caption}>{dislikes.length || ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onReply(comment)}>
            <Text style={{ ...type.caption, fontWeight: '800', color: colors.primary }}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function CommentsScreen({ route, navigation }) {
  const { post } = route.params; // { id, realAuthorId, text, ... } plain fields
  const { user, addComment, directory, isBlockedEither } = useApp();
  const [comments, setComments] = useState([]);
  const users = directory;
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) =>
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [post.id]);

    const visible = useMemo(
    () => comments.filter((c) => !isBlockedEither(c.authorId)),
    [comments, user.blocked, directory]
  );
  const topLevel = useMemo(() => visible.filter((c) => !c.parentId), [visible]);
  const repliesOf = (id) => visible.filter((c) => c.parentId === id);

  // @mention suggestions for the word currently being typed
  const mentionMatch = draft.match(/@([^\s@]*)$/);
  const suggestions = mentionMatch
    ? users
        .filter((u) => u.id !== user.id &&
          u.name.toLowerCase().startsWith(mentionMatch[1].toLowerCase()))
        .slice(0, 5)
    : [];

  const insertMention = (u) =>
    setDraft(draft.replace(/@([^\s@]*)$/, `@${u.name} `));

  const openProfile = (userId, name) =>
    navigation.push('UserProfile', { userId, name });

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    const mentions = users
      .filter((u) => u.id !== user.id && text.includes(`@${u.name}`))
      .map((u) => ({ id: u.id, name: u.name }));
    setBusy(true);
    try {
      await addComment({
        post,
        text,
        parentId: replyTo?.parentId || replyTo?.id || null,
        parentAuthorId: replyTo?.authorId || null,
        mentions,
      });
      setDraft('');
      setReplyTo(null);
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
        <Text style={type.title}>Comments</Text>
        <View style={{ width: 26 }} />
      </View>

      {!!post.text && (
        <View style={styles.postPreview}>
          <Text style={type.caption} numberOfLines={2}>
            {post.anonymous ? 'Anonymous' : post.authorName}: {post.text}
          </Text>
        </View>
      )}

      <FlatList
        data={topLevel}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
            No comments yet — be the first.
          </Text>
        }
        renderItem={({ item }) => (
          <View>
            <CommentRow
              postId={post.id}
              comment={item}
              myId={user.id}
              onProfile={openProfile}
              onReply={setReplyTo}
            />
            {repliesOf(item.id).map((r) => (
              <CommentRow
                key={r.id}
                postId={post.id}
                comment={r}
                isReply
                myId={user.id}
                onProfile={openProfile}
                onReply={() => setReplyTo(item)}
              />
            ))}
          </View>
        )}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {suggestions.length > 0 && (
          <ScrollView horizontal style={styles.suggestBar} keyboardShouldPersistTaps="always">
            {suggestions.map((u) => (
              <TouchableOpacity key={u.id} style={styles.suggestChip} onPress={() => insertMention(u)}>
                <Text style={{ fontWeight: '700', color: colors.primaryDark, fontSize: 13 }}>
                  @{u.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {replyTo && (
          <View style={styles.replyBanner}>
            <Text style={[type.caption, { flex: 1 }]}>
              Replying to <Text style={{ fontWeight: '800' }}>{replyTo.authorName}</Text>
            </Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={16} color={colors.inkSoft} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Write a comment… use @ to mention"
            placeholderTextColor={colors.inkSoft}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <TouchableOpacity style={styles.send} onPress={send} disabled={busy}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
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
  postPreview: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  replyRow: { marginLeft: 46 },
  bubbleC: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  commentActions: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.lg, marginTop: 4, marginLeft: spacing.sm,
  },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  suggestBar: {
    backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxHeight: 46,
  },
  suggestChip: {
    backgroundColor: colors.primarySoft, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: 6, marginRight: spacing.sm,
  },
  replyBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.surface,
    borderTopWidth: 1, borderColor: colors.line,
  },
  input: {
    flex: 1, backgroundColor: colors.bg, borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: 10,
    fontSize: 15, color: colors.ink, maxHeight: 110,
  },
  send: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
}));
