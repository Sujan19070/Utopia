import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, spacing, type, ThemedSheet } from '../theme';
import { useApp } from '../state/AppContext';
import { smartCompress } from '../utils/image';

const BGS = ['#067D5A', '#4B3F72', '#4A6FB4', '#C4823B', '#101E18'];

export default function CreateStoryScreen({ navigation }) {
  const { addStory } = useApp();
  const [imageB64, setImageB64] = useState(null);
  const [preview, setPreview] = useState(null);
  const [text, setText] = useState('');
  const [bg, setBg] = useState(BGS[0]);
  const [busy, setBusy] = useState(false);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add a story photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.5, base64: true,
    });
    if (result.canceled) return;
    try {
      setBusy(true);
      const b64 = await smartCompress(result.assets[0], 900, 0.5);
      setImageB64(b64);
      setPreview(result.assets[0].uri);
    } catch (e) {
      Alert.alert('Could not process photo', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!imageB64 && !text.trim()) return;
    try {
      setBusy(true);
      await addStory({ imageB64, text: text.trim(), bg: imageB64 ? null : bg });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not post story', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: imageB64 ? colors.ink : bg }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={[type.title, { color: '#fff' }]}>New story</Text>
        <TouchableOpacity
          style={[styles.publish, (!imageB64 && !text.trim()) && { opacity: 0.4 }]}
          onPress={publish}
          disabled={busy || (!imageB64 && !text.trim())}
        >
          {busy ? <ActivityIndicator color={colors.primaryDark} size="small" />
                : <Text style={styles.publishText}>Share</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.stage}>
        {preview ? (
          <Image source={{ uri: preview }} style={styles.photo} resizeMode="cover" />
        ) : null}
        <TextInput
          style={[styles.textInput, preview && styles.caption]}
          placeholder={preview ? 'Add a caption…' : 'Type your story…'}
          placeholderTextColor="rgba(255,255,255,0.7)"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={200}
        />
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.tool} onPress={pickPhoto} disabled={busy}>
          <Ionicons name="image" size={20} color="#fff" />
          <Text style={styles.toolText}>{preview ? 'Change photo' : 'Add photo'}</Text>
        </TouchableOpacity>
        {preview ? (
          <TouchableOpacity
            style={styles.tool}
            onPress={() => { setPreview(null); setImageB64(null); }}
          >
            <Ionicons name="trash" size={18} color="#fff" />
            <Text style={styles.toolText}>Remove</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {BGS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.swatch, { backgroundColor: c }, bg === c && styles.swatchActive]}
                onPress={() => setBg(c)}
              />
            ))}
          </View>
        )}
      </View>

      <Text style={styles.hint}>Stories disappear after 24 hours.</Text>
    </SafeAreaView>
  );
}

const styles = ThemedSheet(() => ({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  publish: {
    backgroundColor: '#fff', paddingHorizontal: spacing.lg,
    paddingVertical: 8, borderRadius: radius.pill, minWidth: 74, alignItems: 'center',
  },
  publishText: { color: colors.primaryDark, fontWeight: '800' },
  stage: { flex: 1, justifyContent: 'center' },
  photo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  textInput: {
    color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  caption: {
    position: 'absolute', bottom: 20, left: 0, right: 0,
    fontSize: 17, fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 10,
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolText: { color: '#fff', fontWeight: '700' },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  swatchActive: { borderWidth: 3, borderColor: '#fff' },
  hint: {
    color: 'rgba(255,255,255,0.75)', fontSize: 12,
    textAlign: 'center', paddingBottom: spacing.lg,
  },
}));
