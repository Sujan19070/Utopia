import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Switch, Alert, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, spacing, type, ThemedSheet } from '../theme';
import { Avatar } from '../components/ui';
import { useApp } from '../state/AppContext';

import { smartCompress } from '../utils/image';

export default function CreatePostScreen({ navigation }) {
  const { addPost, user } = useApp();
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(!!user.anon?.on);
  const [imageB64, setImageB64] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled) return;
    try {
      setBusy(true);
      const b64 = await smartCompress(result.assets[0], 900, 0.55);
      setImageB64(b64);
      setPreview(result.assets[0].uri);
    } catch (e) {
      Alert.alert('Could not process photo', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!text.trim() && !imageB64) return;
    try {
      setBusy(true);
      await addPost({ text: text.trim(), anonymous, imageB64 });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not post', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={type.title}>New post</Text>
        <TouchableOpacity
          style={[styles.publish, (!text.trim() && !imageB64) && { opacity: 0.4 }]}
          onPress={publish}
          disabled={busy || (!text.trim() && !imageB64)}
        >
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.publishText}>Post</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.identity}>
        <Avatar userId={anonymous ? null : user.id} name={user.name} anonymous={anonymous} size={40} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={{ ...type.body, fontWeight: '700' }}>
            {anonymous ? 'Anonymous' : user.name}
          </Text>
          <Text style={type.caption}>
            {anonymous ? 'Your name stays hidden' : 'Posting to everyone'}
          </Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ true: colors.anon }} />
          <Text style={[type.caption, { fontSize: 11 }]}>Anonymous</Text>
        </View>
      </View>

      <TextInput
        style={styles.input}
        placeholder={
          anonymous
            ? 'Share a confession, a question, anything — no one sees your name.'
            : 'Share something with campus…'
        }
        placeholderTextColor={colors.inkSoft}
        multiline
        value={text}
        onChangeText={setText}
        autoFocus
      />

      {preview && (
        <View style={styles.attached}>
          <Image source={{ uri: preview }} style={styles.thumb} />
          <Text style={[type.caption, { flex: 1, marginLeft: spacing.md }]}>Photo attached</Text>
          <TouchableOpacity onPress={() => { setPreview(null); setImageB64(null); }}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.tool} onPress={pickPhoto} disabled={busy}>
          <Ionicons name="image-outline" size={20} color={colors.primary} />
          <Text style={styles.toolText}>{busy ? 'Working…' : 'Add photo'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={[type.caption, { paddingHorizontal: spacing.lg, paddingBottom: spacing.md }]}>
        Community rule: anonymous posts are still moderated. Harassment gets removed
        and can suspend the account behind the mask.
      </Text>
    </SafeAreaView>
  );
}

const styles = ThemedSheet(() => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  publish: {
    backgroundColor: colors.primary, paddingHorizontal: spacing.lg,
    paddingVertical: 8, borderRadius: radius.pill, minWidth: 70, alignItems: 'center',
  },
  publishText: { color: '#fff', fontWeight: '800' },
  identity: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderColor: colors.line,
  },
  input: { flex: 1, padding: spacing.lg, fontSize: 16, color: colors.ink, textAlignVertical: 'top' },
  attached: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    padding: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radius.md,
  },
  thumb: { width: 54, height: 54, borderRadius: radius.sm },
  toolbar: {
    flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.xl,
  },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
}));
