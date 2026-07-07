import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, spacing, type, shadow, ThemedSheet } from '../theme';
import { Avatar } from '../components/ui';
import { useApp } from '../state/AppContext';
import { t } from '../i18n/strings';
import { smartCompress } from '../utils/image';

export default function ProfileScreen({ navigation }) {
  const { user, signOut, updateProfilePhoto } = useApp();
  const [busy, setBusy] = useState(false);

  const changePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.5, allowsEditing: true,
      aspect: [1, 1], base64: true,
    });
    if (result.canceled) return;
    try {
      setBusy(true);
      const b64 = await smartCompress(result.assets[0], 400, 0.5);
      await updateProfilePhoto(b64);
    } catch (e) {
      Alert.alert('Could not save photo', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.head}>
          <TouchableOpacity onPress={changePhoto} activeOpacity={0.8}>
            <Avatar userId={user.id} size={92} />
            <View style={styles.camBadge}>
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={15} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={[type.display, { marginTop: spacing.md }]}>{user.name}</Text>
          {!!user.username && (
            <Text style={{ color: colors.primaryDark, fontWeight: '700', marginTop: 2 }}>
              @{user.username}
            </Text>
          )}
          <Text style={[type.caption, { marginTop: 2 }]}>{user.email}</Text>
        </View>

        <TouchableOpacity
          style={[styles.bigBtn, shadow.card]}
          onPress={() => navigation.navigate('MyAccount')}
        >
          <View style={[styles.bigIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="person" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ ...type.body, fontWeight: '800' }}>{t('myAccount')}</Text>
            <Text style={type.caption}>{t('descAccount')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.inkSoft} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bigBtn, shadow.card]}
          onPress={() => navigation.navigate('PublicProfile')}
        >
          <View style={[styles.bigIcon, { backgroundColor: colors.accent }]}>
            <Ionicons name="albums" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ ...type.body, fontWeight: '800' }}>{t('publicProfile')}</Text>
            <Text style={type.caption}>{t('descPublic')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.inkSoft} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bigBtn, shadow.card]}
          onPress={() => navigation.navigate('MyEducation')}
        >
          <View style={[styles.bigIcon, { backgroundColor: '#4A6FB4' }]}>
            <Ionicons name="school" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ ...type.body, fontWeight: '800' }}>{t('education')}</Text>
            <Text style={type.caption}>{t('descEducation')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.inkSoft} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bigBtn, shadow.card]}
          onPress={() => navigation.navigate('AnonMode')}
        >
          <View style={[styles.bigIcon, { backgroundColor: colors.anon }]}>
            <Text style={{ fontSize: 20 }}>🎭</Text>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ ...type.body, fontWeight: '800' }}>Anonymous</Text>
              {user.anon?.on && (
                <View style={{ backgroundColor: colors.anonSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.anon }}>ON</Text>
                </View>
              )}
            </View>
            <Text style={type.caption}>
              {user.anon?.on
                ? `Appearing as ${user.anon.emoji || '🎭'} ${user.anon.name || 'Anonymous'}`
                : 'Nickname & avatar for anonymous posting'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.inkSoft} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bigBtn, shadow.card]}
          onPress={() => navigation.navigate('Developer')}
        >
          <View style={[styles.bigIcon, { backgroundColor: '#4A6FB4' }]}>
            <Ionicons name="code-slash" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ ...type.body, fontWeight: '800' }}>Developer</Text>
            <Text style={type.caption}>Who built Utopia & why</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bigBtn, shadow.card]}
          onPress={() => navigation.navigate('Feedback')}
        >
          <View style={[styles.bigIcon, { backgroundColor: colors.accent }]}>
            <Ionicons name="chatbox-ellipses" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ ...type.body, fontWeight: '800' }}>Feedback</Text>
            <Text style={type.caption}>Tell the developer what to improve</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bigBtn, shadow.card]}
          onPress={() => navigation.navigate('Settings')}
        >
          <View style={[styles.bigIcon, { backgroundColor: colors.inkSoft }]}>
            <Ionicons name="settings" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ ...type.body, fontWeight: '800' }}>{t('settings')}</Text>
            <Text style={type.caption}>{t('descSettings')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.inkSoft} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOut} onPress={signOut}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={{ color: colors.danger, fontWeight: '800' }}>{t('signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = ThemedSheet(() => ({
  root: { flex: 1, backgroundColor: colors.bg },
  head: { alignItems: 'center', padding: spacing.xl },
  camBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: colors.bg,
  },
  bigBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, marginHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  bigIcon: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, margin: spacing.xl, padding: spacing.md,
  },
}));
