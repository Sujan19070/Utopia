import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, type, ThemedSheet } from '../theme';
import { Avatar, timeAgo } from '../components/ui';
import { useApp } from '../state/AppContext';

export default function StoryViewerScreen({ route, navigation }) {
  const { authorId } = route.params;
  const { user, stories, deleteStory } = useApp();
  const [index, setIndex] = useState(0);

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
    </SafeAreaView>
  );
}

const styles = ThemedSheet(() => ({
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
