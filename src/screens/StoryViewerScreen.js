import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, type, ThemedSheet } from '../theme';
import { Avatar, timeAgo } from '../components/ui';
import { REACTIONS, EMOJI, useApp } from '../state/AppContext';

export default function StoryViewerScreen({ route, navigation }) {
  const { authorId } = route.params;
  const { user, stories, deleteStory, reactToStory, replyToStory } = useApp();
  const [index, setIndex] = useState(0);
  const [reply, setReply] = useState('');
  const [sent, setSent] = useState(false);

  const mine = authorId === user.id;
  const authorStories = useMemo(
    () => stories.filter((s) => s.authorId === authorId),
    [stories, authorId]
  );

  // Story deleted or expired while viewing
  if (authorStories.length === 0) {
    navigation.goBack();
    return null;
  }
  const i = Math.min(index, authorStories.length - 1);
  const story = authorStories[i];

  const next = () =>
    i < authorStories.length - 1 ? setIndex(i + 1) : navigation.goBack();
  const prev = () => (i > 0 ? setIndex(i - 1) : null);

  const confirmDelete = () =>
    Alert.alert('Delete this story?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteStory(story) },
    ]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: story.bg || colors.ink }]} edges={['top']}>
      {story.imageB64 && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${story.imageB64}` }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      )}

      {/* progress bars */}
      <View style={styles.progressRow}>
        {authorStories.map((s, k) => (
          <View key={s.id} style={[styles.bar, k <= i && styles.barActive]} />
        ))}
      </View>

      {/* header */}
      <View style={styles.header}>
        <Avatar userId={authorId} name={story.authorName} size={38} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>
            {mine ? 'You' : story.authorName}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
            {timeAgo(story.createdAt)}
          </Text>
        </View>
        {mine && (
          <TouchableOpacity onPress={confirmDelete} style={{ padding: 8 }}>
            <Ionicons name="trash" size={20} color="#fff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* text story / caption */}
      <View style={styles.center} pointerEvents="none">
        {!story.imageB64 && !!story.text && (
          <Text style={styles.bigText}>{story.text}</Text>
        )}
      </View>
      {story.imageB64 && !!story.text && (
        <Text style={styles.caption}>{story.text}</Text>
      )}

      {/* tap zones */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={prev} />
          <TouchableOpacity style={{ flex: 2 }} onPress={next} />
        </View>
      </View>

      {/* reactions + reply (only on other people's stories) */}
      {!mine && (
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.footer}
        >
          {sent ? (
            <View style={styles.sentPill}>
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800' }}>Sent</Text>
            </View>
          ) : (
            <>
              <View style={styles.reactBar}>
                {REACTIONS.map((r) => {
                  const active = story.reactions?.[user.id] === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      style={[styles.reactBtn, active && styles.reactBtnActive]}
                      onPress={() => reactToStory(story, r.key)}
                    >
                      <Text style={{ fontSize: 26 }}>{r.emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.replyRow}>
                <TextInput
                  style={styles.replyInput}
                  placeholder={`Reply to ${story.authorName?.split(' ')[0] || 'story'}…`}
                  placeholderTextColor="rgba(255,255,255,0.7)"
                  value={reply}
                  onChangeText={setReply}
                />
                <TouchableOpacity
                  style={[styles.replySend, !reply.trim() && { opacity: 0.4 }]}
                  disabled={!reply.trim()}
                  onPress={async () => {
                    await replyToStory(story, reply);
                    setReply('');
                    setSent(true);
                    setTimeout(() => setSent(false), 1500);
                  }}
                >
                  <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      )}

      {/* my own story: show who reacted */}
      {mine && Object.keys(story.reactions || {}).length > 0 && (
        <View style={styles.myReacts}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
            {Object.values(story.reactions).map((k) => EMOJI[k]).join(' ')}
            {'  '}{Object.keys(story.reactions).length}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = ThemedSheet(() => ({
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md,
  },
  reactBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999,
    paddingVertical: 6, paddingHorizontal: 6,
  },
  reactBtn: { padding: 6, borderRadius: 999 },
  reactBtnActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  replyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  replyInput: {
    flex: 1, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 11,
    color: '#fff', fontSize: 15,
  },
  replySend: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sentPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center',
    backgroundColor: colors.primary, borderRadius: 999,
    paddingHorizontal: spacing.xl, paddingVertical: 12,
  },
  myReacts: {
    position: 'absolute', bottom: spacing.xl, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 999,
    paddingHorizontal: spacing.lg, paddingVertical: 8,
  },
  root: { flex: 1 },
  progressRow: {
    flexDirection: 'row', gap: 4,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
  },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  barActive: { backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  bigText: {
    color: '#fff', fontSize: 28, fontWeight: '800',
    textAlign: 'center', lineHeight: 38,
  },
  caption: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 10,
    paddingHorizontal: spacing.lg,
  },
}));
