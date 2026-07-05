import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, Modal, Image, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import {
  useAudioRecorder, useAudioPlayer, useAudioPlayerStatus,
  RecordingPresets, AudioModule, setAudioModeAsync,
} from 'expo-audio';
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteField,
  onSnapshot, query, orderBy, limit, serverTimestamp,
  arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { colors, radius, spacing, type, ThemedSheet } from '../theme';
import { Avatar, timeAgo } from '../components/ui';
import { REACTIONS, EMOJI, useApp } from '../state/AppContext';
import { smartCompress } from '../utils/image';
import { readFileB64, writeTempB64, fmtBytes, fileKind } from '../utils/files';

export const chatIdFor = (a, b) => [a, b].sort().join('_');

const MAX_B64 = 950000; // Firestore doc safety limit (~700 KB binary)
const TAGS = { love: { emoji: '❤️', label: 'Love' }, bff: { emoji: '🌟', label: 'Best friend' } };

const previewOf = (m) => {
  if (m.deleted) return 'Message deleted';
  if (m.type === 'audio') return '🎤 Voice message';
  if (m.type === 'image') return '📷 Photo';
  if (m.type === 'file') return `📎 ${m.fileName || 'File'}`;
  return m.text || '';
};

// ============================================================
// CHAT LIST — pin, tag (Love / Best friend), archive, groups
// ============================================================
export function ChatListScreen({ navigation }) {
  const { user, usersById, directory, isBlockedEither, presenceOf } = useApp();
  const [chats, setChats] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [menuChat, setMenuChat] = useState(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState({});

  useEffect(() => {
    const q = query(collection(db, 'chats'));
    return onSnapshot(q, (snap) => {
      setChats(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((c) => (c.participants || []).includes(user.id))
      );
    });
  }, [user.id]);

  const rows = useMemo(() => {
    const enrich = (c) => {
      const otherId = c.isGroup ? null : (c.participants || []).find((p) => p !== user.id);
      const theirAnon = !c.isGroup && c.anonFor && c.anonFor === otherId;
      return {
        ...c,
        otherId,
        theirAnon,
        myAnon: !c.isGroup && c.anonFor === user.id,
        display: c.isGroup
          ? c.name || 'Group'
          : theirAnon
            ? c.names?.[otherId] || 'Anonymous'
            : c.names?.[otherId] || usersById[otherId]?.name || 'Student',
        pinned: (c.pinnedBy || []).includes(user.id),
        archived: (c.archivedBy || []).includes(user.id),
        tag: c.tags?.[user.id] || null,
      };
    };
    return chats
      .map(enrich)
      .filter((c) => c.isGroup || !isBlockedEither(c.otherId))
      .filter((c) => c.archived === showArchived)
      .sort((a, b) =>
        (b.pinned - a.pinned) ||
        ((b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
      );
  }, [chats, user.id, usersById, showArchived, user.blocked]);

  const archivedCount = useMemo(
    () => chats.filter((c) => (c.archivedBy || []).includes(user.id)).length,
    [chats, user.id]
  );

  const openChat = (c) =>
    navigation.navigate('ChatRoom', {
      chatId: c.id,
      otherId: c.otherId || undefined,
      otherName: c.isGroup ? undefined : c.display,
    });

  const act = async (patch) => {
    await updateDoc(doc(db, 'chats', menuChat.id), patch);
    setMenuChat(null);
  };

  const toggleSel = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  const createGroup = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (!groupName.trim()) return Alert.alert('Group name', 'Give your group a name.');
    if (ids.length < 2) return Alert.alert('Members', 'Pick at least 2 people.');
    const names = { [user.id]: user.name };
    ids.forEach((id) => { names[id] = usersById[id]?.name || 'Student'; });
    const ref = await addDoc(collection(db, 'chats'), {
      isGroup: true,
      name: groupName.trim(),
      participants: [user.id, ...ids],
      names,
      admin: user.id,
      lastMessage: `${user.name} created the group`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setGroupOpen(false); setGroupName(''); setSelected({});
    navigation.navigate('ChatRoom', { chatId: ref.id });
  };

  const people = directory.filter((p) => p.id !== user.id && !isBlockedEither(p.id));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.listHeader}>
        <View>
          <Text style={type.display}>{showArchived ? 'Archived' : 'Chats'}</Text>
          <Text style={type.caption}>
            {showArchived ? 'Hidden conversations' : 'Messages, groups, voice & files'}
          </Text>
        </View>
        {showArchived ? (
          <TouchableOpacity style={styles.roundBtn} onPress={() => setShowArchived(false)}>
            <Ionicons name="arrow-back" size={20} color={colors.primaryDark} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.newGroupBtn} onPress={() => setGroupOpen(true)}>
            <Ionicons name="people" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12.5 }}>New group</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.primary} />
            <Text style={[type.title, { marginTop: spacing.md }]}>
              {showArchived ? 'No archived chats' : 'No chats yet'}
            </Text>
            {!showArchived && (
              <Text style={[type.caption, { marginTop: 4, textAlign: 'center' }]}>
                Message someone from Discover, or start a group.
              </Text>
            )}
          </View>
        }
        ListFooterComponent={
          !showArchived && archivedCount > 0 ? (
            <TouchableOpacity style={styles.archiveRow} onPress={() => setShowArchived(true)}>
              <Ionicons name="archive" size={18} color={colors.inkSoft} />
              <Text style={[type.caption, { fontWeight: '700' }]}>
                Archived ({archivedCount})
              </Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => {
          const pres = item.isGroup ? null : presenceOf(item.otherId);
          return (
            <TouchableOpacity
              style={styles.chatRow}
              onPress={() => openChat(item)}
              onLongPress={() => setMenuChat(item)}
              delayLongPress={280}
            >
              <View>
                {item.isGroup ? (
                  <View style={styles.groupAvatar}>
                    <Ionicons name="people" size={24} color="#fff" />
                  </View>
                ) : item.theirAnon ? (
                  <Avatar anonymous anonMeta={item.anonAvatar} name={item.display} size={50} />
                ) : (
                  <Avatar userId={item.anonFor ? null : item.otherId} name={item.display} size={50} />
                )}
                {pres?.active && !item.anonFor && <View style={styles.onlineDot} />}
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={{ ...type.body, fontWeight: '700' }} numberOfLines={1}>
                    {item.display}
                  </Text>
                  {(item.theirAnon || item.myAnon) && <Text style={{ fontSize: 12 }}>🎭</Text>}
                  {!!item.tag && <Text style={{ fontSize: 13 }}>{TAGS[item.tag]?.emoji}</Text>}
                  {item.pinned && <Ionicons name="pin" size={12} color={colors.accent} />}
                </View>
                <Text style={type.caption} numberOfLines={1}>
                  {item.myAnon ? `🎭 as ${item.names?.[user.id] || 'Anonymous'} · ` : ''}{item.lastMessage || '…'}
                </Text>
              </View>
              <Text style={type.caption}>{timeAgo(item.updatedAt)}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* long-press chat menu */}
      <Modal visible={!!menuChat} transparent animationType="fade" onRequestClose={() => setMenuChat(null)}>
        <TouchableOpacity style={styles.dim} activeOpacity={1} onPress={() => setMenuChat(null)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={[type.title, { textAlign: 'center', marginBottom: spacing.md }]}>
            {menuChat?.display}
          </Text>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => act({ pinnedBy: menuChat.pinned ? arrayRemove(user.id) : arrayUnion(user.id) })}
          >
            <Ionicons name="pin" size={19} color={colors.primary} />
            <Text style={styles.menuText}>{menuChat?.pinned ? 'Unpin chat' : 'Pin chat'}</Text>
          </TouchableOpacity>
          {!menuChat?.isGroup && Object.entries(TAGS).map(([k, v]) => (
            <TouchableOpacity
              key={k}
              style={styles.menuRow}
              onPress={() => act({ [`tags.${user.id}`]: menuChat.tag === k ? deleteField() : k })}
            >
              <Text style={{ fontSize: 18 }}>{v.emoji}</Text>
              <Text style={styles.menuText}>
                {menuChat?.tag === k ? `Remove "${v.label}" tag` : `Tag as ${v.label}`}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => act({ archivedBy: menuChat.archived ? arrayRemove(user.id) : arrayUnion(user.id) })}
          >
            <Ionicons name="archive" size={19} color={colors.inkSoft} />
            <Text style={styles.menuText}>{menuChat?.archived ? 'Unarchive' : 'Archive chat'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* new group */}
      <Modal visible={groupOpen} transparent animationType="slide" onRequestClose={() => setGroupOpen(false)}>
        <TouchableOpacity style={styles.dim} activeOpacity={1} onPress={() => setGroupOpen(false)} />
        <View style={[styles.sheet, { maxHeight: '80%' }]}>
          <View style={styles.sheetHandle} />
          <Text style={[type.title, { textAlign: 'center' }]}>New group</Text>
          <TextInput
            style={styles.groupNameInput}
            placeholder="Group name (e.g. CSE Batch 29)"
            placeholderTextColor={colors.inkSoft}
            value={groupName}
            onChangeText={setGroupName}
          />
          <Text style={[type.label, { marginBottom: spacing.sm }]}>Add members</Text>
          <ScrollView style={{ maxHeight: 320 }}>
            {people.map((p) => (
              <TouchableOpacity key={p.id} style={styles.memberRow} onPress={() => toggleSel(p.id)}>
                <Avatar userId={p.id} name={p.name} size={38} />
                <Text style={[type.body, { flex: 1, marginLeft: spacing.md, fontWeight: '600' }]}>
                  {p.name}
                </Text>
                <Ionicons
                  name={selected[p.id] ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={selected[p.id] ? colors.primary : colors.inkSoft}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.createBtn} onPress={createGroup}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Create group</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================
// MESSAGE PIECES
// ============================================================
function AudioBubble({ msg, mine }) {
  const [uri, setUri] = useState(null);
  useEffect(() => {
    let alive = true;
    writeTempB64(msg.audioB64, `va_${msg.id}.m4a`)
      .then((u) => alive && setUri(u))
      .catch(() => {});
    return () => { alive = false; };
  }, [msg.id]);
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);

  const toggle = () => {
    if (!uri) return;
    if (status.playing) { player.pause(); return; }
    try {
      if (status.duration && status.currentTime >= status.duration - 0.05) player.seekTo(0);
    } catch (e) {}
    player.play();
  };

  const d = msg.durationSec || Math.round(status.duration || 0);
  const mm = `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`;
  const fg = mine ? '#fff' : colors.primary;
  return (
    <TouchableOpacity style={styles.audioRow} onPress={toggle} activeOpacity={0.7}>
      <Ionicons name={status.playing ? 'pause-circle' : 'play-circle'} size={36} color={fg} />
      <View style={[styles.audioLine, { backgroundColor: mine ? 'rgba(255,255,255,0.6)' : colors.primarySoft }]} />
      <Text style={{ color: mine ? '#EAF7F1' : colors.inkSoft, fontSize: 12, fontWeight: '700' }}>
        {uri ? mm : '…'}
      </Text>
    </TouchableOpacity>
  );
}

function FileBubble({ msg, mine }) {
  const [busy, setBusy] = useState(false);
  const kind = fileKind(msg.mimeType, msg.fileName);
  const open = async () => {
    try {
      setBusy(true);
      const safe = (msg.fileName || 'file').replace(/[^\w.\-]+/g, '_');
      const uri = await writeTempB64(msg.fileB64, `${msg.id}_${safe}`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: msg.mimeType || undefined });
      } else {
        Alert.alert('Saved', 'File prepared, but sharing is unavailable on this device.');
      }
    } catch (e) {
      Alert.alert('Open file', String(e?.message || e));
    } finally { setBusy(false); }
  };
  const fg = mine ? '#fff' : colors.ink;
  return (
    <TouchableOpacity style={styles.fileCard} onPress={open} activeOpacity={0.7}>
      <View style={[styles.fileIcon, { backgroundColor: mine ? 'rgba(255,255,255,0.25)' : colors.primarySoft }]}>
        {busy ? (
          <ActivityIndicator size="small" color={mine ? '#fff' : colors.primary} />
        ) : (
          <Ionicons name={kind.icon} size={20} color={mine ? '#fff' : colors.primary} />
        )}
      </View>
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <Text style={{ color: fg, fontWeight: '700', fontSize: 13.5 }} numberOfLines={1}>
          {msg.fileName || 'File'}
        </Text>
        <Text style={{ color: mine ? '#DFF2EA' : colors.inkSoft, fontSize: 11.5 }}>
          {kind.label}{msg.fileSize ? ` · ${fmtBytes(msg.fileSize)}` : ''} · tap to open
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// CHAT ROOM — receipts, typing, voice, files, reply/edit/delete,
// reactions, search, groups
// ============================================================
export function ChatRoomScreen({ route, navigation }) {
  const { user, usersById, isBlockedEither, presenceOf } = useApp();
  const params = route.params || {};
  // Anonymous mode ON + starting a chat by person -> use a separate anonymous
  // chat thread; opening from the chat list (explicit chatId) is unchanged.
  const baseId = params.otherId ? chatIdFor(user.id, params.otherId) : null;
  const chatId = params.chatId ||
    (user.anon?.on ? `${baseId}_anon_${user.id}` : baseId);

  const [meta, setMeta] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [selMsg, setSelMsg] = useState(null);
  const [histMsg, setHistMsg] = useState(null);
  const [searchOn, setSearchOn] = useState(false);
  const [search, setSearch] = useState('');
  const [, setTickState] = useState(0);
  const [recOn, setRecOn] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const lastTyping = useRef(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const isGroup = !!meta?.isGroup;
  const otherId = params.otherId ||
    (!isGroup ? (meta?.participants || []).find((p) => p !== user.id) : null);
  const title = isGroup
    ? meta?.name || 'Group'
    : params.otherName || meta?.names?.[otherId] || usersById[otherId]?.name || 'Student';
  const myTag = meta?.tags?.[user.id];
  // this thread is anonymous if its id says so or its doc says so
  const anonChat = chatId.includes('_anon_') || !!meta?.anonFor;
  const iAmAnonHere = anonChat && (meta?.anonFor ? meta.anonFor === user.id : true);
  const myDisplayName = iAmAnonHere ? (user.anon?.name || 'Anonymous') : user.name;
  const theyAreAnon = anonChat && meta?.anonFor && meta.anonFor === otherId;
  const blocked = !isGroup && otherId ? isBlockedEither(otherId) : false;
  // presence stays hidden in anonymous chats (it would leak identity)
  const pres = !isGroup && !anonChat && otherId ? presenceOf(otherId) : null;

  useEffect(
    () => onSnapshot(doc(db, 'chats', chatId), (s) => setMeta(s.exists() ? s.data() : null)),
    [chatId]
  );

  useEffect(() => {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(300)
    );
    return onSnapshot(q, (snap) =>
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [chatId]);

  // read receipt: record the moment I have the messages on screen
  useEffect(() => {
    if (!messages.length) return;
    setDoc(doc(db, 'chats', chatId), { lastRead: { [user.id]: serverTimestamp() } }, { merge: true })
      .catch(() => {});
  }, [messages.length, chatId]);

  // ticker so "typing…" expires visually
  useEffect(() => {
    const iv = setInterval(() => setTickState((t) => t + 1), 1500);
    return () => clearInterval(iv);
  }, []);

  // recording timer (auto-stop at 60s)
  useEffect(() => {
    if (!recOn) return;
    const iv = setInterval(() => setRecSec((s) => {
      if (s >= 59) { stopRec(true); return s; }
      return s + 1;
    }), 1000);
    return () => clearInterval(iv);
  }, [recOn]);

  const typers = Object.entries(meta?.typing || {})
    .filter(([uid, ts]) => uid !== user.id && ts && Date.now() - ts < 5000)
    .map(([uid]) => meta?.names?.[uid] || usersById[uid]?.name || 'Someone');

  const onDraft = (v) => {
    setDraft(v);
    if (v && Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      setDoc(doc(db, 'chats', chatId), { typing: { [user.id]: Date.now() } }, { merge: true })
        .catch(() => {});
    }
  };

  const bumpChat = async (preview) => {
    const base = {
      lastMessage: preview,
      updatedAt: serverTimestamp(),
      typing: { [user.id]: null },
    };
    if (isGroup) {
      await setDoc(doc(db, 'chats', chatId), base, { merge: true });
    } else {
      const extra = anonChat && iAmAnonHere
        ? {
            anonFor: user.id,
            anonAvatar: { emoji: user.anon?.emoji || '🎭', color: user.anon?.color || '#4B3F72' },
          }
        : {};
      await setDoc(doc(db, 'chats', chatId), {
        ...base,
        participants: [user.id, otherId],
        names: { [user.id]: myDisplayName, [otherId]: title },
        ...extra,
      }, { merge: true });
    }
  };

  const sendMessage = async (extra) => {
    const payload = {
      senderId: user.id,
      senderName: myDisplayName,
      type: 'text',
      text: '',
      reactions: {},
      replyTo: replyTo
        ? { id: replyTo.id, name: replyTo.senderName, preview: previewOf(replyTo).slice(0, 70) }
        : null,
      createdAt: serverTimestamp(),
      ...extra,
    };
    await addDoc(collection(db, 'chats', chatId, 'messages'), payload);
    await bumpChat(previewOf(payload));
    notifyRecipients(previewOf(payload));
    setReplyTo(null);
  };

  // In-app + phone notification for everyone else in this chat.
  const notifyRecipients = (preview) => {
    const recips = (meta?.participants || (otherId ? [user.id, otherId] : []))
      .filter((id) => id && id !== user.id);
    recips.forEach((to) => {
      if (!iAmAnonHere && isBlockedEither(to)) return;
      addDoc(collection(db, 'notifications'), {
        to,
        fromId: iAmAnonHere ? null : user.id,
        fromName: myDisplayName,
        type: 'message',
        preview: (preview || '').slice(0, 80),
        chatId,
        read: false,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    });
  };

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    try {
      if (editing) {
        await updateDoc(doc(db, 'chats', chatId, 'messages', editing.id), {
          text,
          edited: true,
          history: arrayUnion({ text: editing.text, at: Date.now() }),
        });
        setEditing(null);
      } else {
        await sendMessage({ type: 'text', text });
      }
    } catch (e) {
      Alert.alert('Could not send', String(e?.message || e));
    }
  };

  // ---- voice ----
  const startRec = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone needed', 'Allow microphone access to send voice messages.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecSec(0);
      setRecOn(true);
    } catch (e) {
      Alert.alert('Recorder', String(e?.message || e));
    }
  };

  const stopRec = async (sendIt) => {
    try {
      setRecOn(false);
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (!sendIt) return;
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording captured.');
      setBusy(true);
      const b64 = await readFileB64(uri);
      if (b64.length > MAX_B64) {
        Alert.alert('Too long', 'Voice messages can be up to about 1 minute in this build.');
        return;
      }
      await sendMessage({ type: 'audio', audioB64: b64, durationSec: recSec });
    } catch (e) {
      Alert.alert('Voice message', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  // ---- attachments ----
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.5, base64: true,
    });
    if (result.canceled) return;
    setBusy(true);
    try {
      const b64 = await smartCompress(result.assets[0], 900, 0.5);
      await sendMessage({ type: 'image', imageB64: b64 });
    } catch (e) {
      Alert.alert('Photo', String(e?.message || e));
    } finally { setBusy(false); }
  };

  const pickDoc = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled) return;
      const a = res.assets[0];
      if (a.size && a.size > 1500000) {
        Alert.alert('File too large',
          `"${a.name}" is ${fmtBytes(a.size)}. This build supports files up to ~700 KB — full-size sharing arrives with the storage upgrade.`);
        return;
      }
      setBusy(true);
      const b64 = await readFileB64(a.uri);
      if (b64.length > MAX_B64) {
        Alert.alert('File too large', 'Files up to ~700 KB in this build.');
        return;
      }
      await sendMessage({
        type: 'file',
        fileB64: b64,
        fileName: a.name || 'file',
        mimeType: a.mimeType || '',
        fileSize: a.size || Math.round(b64.length * 0.75),
      });
    } catch (e) {
      Alert.alert('File', String(e?.message || e));
    } finally { setBusy(false); }
  };

  const attach = () =>
    Alert.alert('Attach', 'Photos and files up to ~700 KB.', [
      { text: 'Photo', onPress: pickPhoto },
      { text: 'Document / file', onPress: pickDoc },
      { text: 'Cancel', style: 'cancel' },
    ]);

  // ---- message actions ----
  const react = async (m, key) => {
    setSelMsg(null);
    const cur = m.reactions?.[user.id];
    await updateDoc(doc(db, 'chats', chatId, 'messages', m.id), {
      [`reactions.${user.id}`]: cur === key ? deleteField() : key,
    });
  };

  const delMsg = (m) => {
    setSelMsg(null);
    Alert.alert('Delete message?', 'Everyone will see that it was deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () =>
          updateDoc(doc(db, 'chats', chatId, 'messages', m.id), {
            deleted: true, text: '', imageB64: null, audioB64: null, fileB64: null,
          }),
      },
    ]);
  };

  const startEdit = (m) => {
    setSelMsg(null);
    setEditing(m);
    setDraft(m.text || '');
  };

  const visible = messages
    .filter((m) => m.senderId === user.id || !isBlockedEither(m.senderId))
    .filter((m) => {
      if (!searchOn || !search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (m.text || '').toLowerCase().includes(q) ||
             (m.fileName || '').toLowerCase().includes(q);
    });

  const otherRead = !isGroup && otherId ? meta?.lastRead?.[otherId] : null;

  const subtitle = typers.length
    ? `${isGroup ? typers[0] + ' is ' : ''}typing…`
    : isGroup
      ? `${(meta?.participants || []).length} members`
      : anonChat
        ? (iAmAnonHere ? `You appear as ${myDisplayName}` : 'Anonymous chat')
        : pres
          ? (pres.active ? 'Active now' : `Last seen ${pres.ago} ago`)
          : 'Live chat';

  const renderMessage = ({ item }) => {
    const mine = item.senderId === user.id;
    const read = otherRead?.seconds && item.createdAt?.seconds &&
      otherRead.seconds >= item.createdAt.seconds;
    const rx = Object.entries(item.reactions || {});
    const counts = {};
    rx.forEach(([, k]) => { counts[k] = (counts[k] || 0) + 1; });

    return (
      <View style={{ marginBottom: spacing.sm }}>
        {isGroup && !mine && (
          <Text style={styles.senderName}>{item.senderName || 'Student'}</Text>
        )}
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => !item.deleted && setSelMsg(item)}
          delayLongPress={260}
          onPress={() => item.edited && !item.deleted && setHistMsg(item)}
          style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
        >
          {item.replyTo && (
            <View style={[styles.quote, { borderLeftColor: mine ? '#fff' : colors.primary }]}>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: mine ? '#EAF7F1' : colors.primaryDark }}>
                {item.replyTo.name}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 12, color: mine ? '#D6EEE4' : colors.inkSoft }}>
                {item.replyTo.preview}
              </Text>
            </View>
          )}

          {item.deleted ? (
            <Text style={{ fontStyle: 'italic', fontSize: 14, color: mine ? '#D6EEE4' : colors.inkSoft }}>
              This message was deleted
            </Text>
          ) : item.type === 'image' && item.imageB64 ? (
            <Image
              source={{ uri: `data:image/jpeg;base64,${item.imageB64}` }}
              style={styles.chatPhoto}
              resizeMode="cover"
            />
          ) : item.type === 'audio' ? (
            <AudioBubble msg={item} mine={mine} />
          ) : item.type === 'file' ? (
            <FileBubble msg={item} mine={mine} />
          ) : (
            <Text style={{ color: mine ? '#fff' : colors.ink, fontSize: 15 }}>{item.text}</Text>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4, marginTop: 4 }}>
            {item.edited && !item.deleted && (
              <Text style={{ fontSize: 10, color: mine ? '#CFEDE2' : colors.inkSoft }}>edited ·</Text>
            )}
            <Text style={{ fontSize: 10.5, color: mine ? '#CFEDE2' : colors.inkSoft }}>
              {timeAgo(item.createdAt)}
            </Text>
            {mine && !isGroup && !item.deleted && (
              <Ionicons
                name={read ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={read ? colors.accent : '#CFEDE2'}
              />
            )}
          </View>
        </TouchableOpacity>

        {rx.length > 0 && !item.deleted && (
          <View style={[styles.reactRow, mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
            {Object.entries(counts).map(([k, n]) => (
              <Text key={k} style={styles.reactBadge}>
                {EMOJI[k]}{n > 1 ? ` ${n}` : ''}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.roomHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        {isGroup ? (
          <View style={[styles.groupAvatar, { width: 38, height: 38, borderRadius: 19 }]}>
            <Ionicons name="people" size={18} color="#fff" />
          </View>
        ) : theyAreAnon ? (
          <Avatar anonymous anonMeta={meta?.anonAvatar} name={title} size={38} />
        ) : (
          <Avatar userId={anonChat ? null : otherId} name={title} size={38} />
        )}
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ ...type.body, fontWeight: '700' }} numberOfLines={1}>{title}</Text>
            {anonChat && <Text style={{ fontSize: 12 }}>🎭</Text>}
            {!!myTag && <Text style={{ fontSize: 13 }}>{TAGS[myTag]?.emoji}</Text>}
          </View>
          <Text
            style={{
              ...type.caption, fontWeight: '700',
              color: typers.length ? colors.primary
                : pres?.active ? '#1FA372' : colors.inkSoft,
            }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
        <TouchableOpacity style={styles.callBtn} onPress={() => { setSearchOn(!searchOn); setSearch(''); }}>
          <Ionicons name={searchOn ? 'close' : 'search'} size={18} color={colors.primary} />
        </TouchableOpacity>
        {!isGroup && (
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Alert.alert('Voice call', 'Calls come with the Agora/Stream build.')}
          >
            <Ionicons name="call" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {searchOn && (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={15} color={colors.inkSoft} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages…"
            placeholderTextColor={colors.inkSoft}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {!!search.trim() && (
            <Text style={type.caption}>{visible.length} found</Text>
          )}
        </View>
      )}

      <FlatList
        ref={listRef}
        data={visible}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg }}
        onContentSizeChange={() => !searchOn && listRef.current?.scrollToEnd({ animated: true })}
        renderItem={renderMessage}
      />

      {blocked ? (
        <View style={[styles.inputBar, { justifyContent: 'center' }]}>
          <Ionicons name="ban" size={16} color={colors.inkSoft} />
          <Text style={type.caption}>You can't message this person.</Text>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {replyTo && (
            <View style={styles.topBanner}>
              <Ionicons name="return-up-back" size={15} color={colors.primaryDark} />
              <Text style={[type.caption, { flex: 1 }]} numberOfLines={1}>
                Replying to <Text style={{ fontWeight: '800' }}>{replyTo.senderName}</Text>: {previewOf(replyTo)}
              </Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Ionicons name="close" size={16} color={colors.inkSoft} />
              </TouchableOpacity>
            </View>
          )}
          {editing && (
            <View style={[styles.topBanner, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="pencil" size={14} color={colors.accent} />
              <Text style={[type.caption, { flex: 1 }]}>Editing message</Text>
              <TouchableOpacity onPress={() => { setEditing(null); setDraft(''); }}>
                <Ionicons name="close" size={16} color={colors.inkSoft} />
              </TouchableOpacity>
            </View>
          )}

          {recOn ? (
            <View style={styles.recBar}>
              <View style={styles.recDot} />
              <Text style={{ color: colors.danger, fontWeight: '800', width: 46 }}>
                0:{String(recSec).padStart(2, '0')}
              </Text>
              <Text style={[type.caption, { flex: 1 }]}>Recording voice message…</Text>
              <TouchableOpacity style={styles.recBtn} onPress={() => stopRec(false)}>
                <Ionicons name="trash" size={18} color={colors.danger} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.recBtn, { backgroundColor: colors.primary }]}
                onPress={() => stopRec(true)}
              >
                <Ionicons name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inputBar}>
              <TouchableOpacity style={styles.sideBtn} onPress={attach} disabled={busy}>
                {busy
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Ionicons name="attach" size={22} color={colors.primary} />}
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder={editing ? 'Edit your message…' : 'Message…'}
                placeholderTextColor={colors.inkSoft}
                value={draft}
                onChangeText={onDraft}
                multiline
              />
              {draft.trim() ? (
                <TouchableOpacity style={styles.send} onPress={send}>
                  <Ionicons name={editing ? 'checkmark' : 'send'} size={18} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.send} onPress={startRec}>
                  <Ionicons name="mic" size={19} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      {/* message actions */}
      <Modal visible={!!selMsg} transparent animationType="fade" onRequestClose={() => setSelMsg(null)}>
        <TouchableOpacity style={styles.dim} activeOpacity={1} onPress={() => setSelMsg(null)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.emojiRow}>
            {REACTIONS.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[
                  styles.emojiBtn,
                  selMsg?.reactions?.[user.id] === r.key && { backgroundColor: colors.primarySoft },
                ]}
                onPress={() => react(selMsg, r.key)}
              >
                <Text style={{ fontSize: 26 }}>{r.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => { setReplyTo(selMsg); setSelMsg(null); }}
          >
            <Ionicons name="return-up-back" size={19} color={colors.primary} />
            <Text style={styles.menuText}>Reply</Text>
          </TouchableOpacity>
          {selMsg?.senderId === user.id && selMsg?.type === 'text' && (
            <TouchableOpacity style={styles.menuRow} onPress={() => startEdit(selMsg)}>
              <Ionicons name="pencil" size={18} color={colors.primary} />
              <Text style={styles.menuText}>Edit</Text>
            </TouchableOpacity>
          )}
          {selMsg?.edited && (
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => { setHistMsg(selMsg); setSelMsg(null); }}
            >
              <Ionicons name="time" size={18} color={colors.inkSoft} />
              <Text style={styles.menuText}>View edit history</Text>
            </TouchableOpacity>
          )}
          {selMsg?.senderId === user.id && (
            <TouchableOpacity style={styles.menuRow} onPress={() => delMsg(selMsg)}>
              <Ionicons name="trash" size={18} color={colors.danger} />
              <Text style={[styles.menuText, { color: colors.danger }]}>Delete message</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      {/* edit history */}
      <Modal visible={!!histMsg} transparent animationType="fade" onRequestClose={() => setHistMsg(null)}>
        <TouchableOpacity style={styles.dim} activeOpacity={1} onPress={() => setHistMsg(null)} />
        <View style={styles.histBox}>
          <Text style={[type.title, { textAlign: 'center', marginBottom: spacing.md }]}>
            Edit history
          </Text>
          <ScrollView style={{ maxHeight: 340 }}>
            <View style={styles.histRow}>
              <Text style={[type.caption, { fontWeight: '800', color: colors.primaryDark }]}>Current</Text>
              <Text style={type.body}>{histMsg?.text}</Text>
            </View>
            {[...(histMsg?.history || [])].reverse().map((h, i) => (
              <View key={i} style={styles.histRow}>
                <Text style={type.caption}>
                  {h.at ? new Date(h.at).toLocaleString() : 'Earlier'}
                </Text>
                <Text style={[type.body, { color: colors.inkSoft }]}>{h.text}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = ThemedSheet(() => ({
  root: { flex: 1, backgroundColor: colors.bg },
  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg,
  },
  roundBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  newGroupBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: 9,
  },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, paddingTop: 80 },
  archiveRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: spacing.lg,
  },
  chatRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line,
  },
  groupAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute', right: 0, bottom: 2,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: '#31C48D',
    borderWidth: 2, borderColor: colors.surface,
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
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md,
  },
  menuText: { ...type.body, fontWeight: '700' },
  groupNameInput: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    fontSize: 15, color: colors.ink,
    marginVertical: spacing.md,
  },
  memberRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  createBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.md,
  },
  roomHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line,
  },
  callBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginLeft: 4,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderColor: colors.line,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: colors.ink, paddingVertical: 4 },
  bubble: { maxWidth: '80%', padding: spacing.md, borderRadius: radius.lg },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  senderName: {
    fontSize: 11, fontWeight: '800', color: colors.inkSoft,
    marginLeft: 6, marginBottom: 2,
  },
  quote: {
    borderLeftWidth: 3, paddingLeft: 8,
    marginBottom: 6, opacity: 0.95,
  },
  chatPhoto: { width: 220, height: 220, borderRadius: radius.md },
  reactRow: { flexDirection: 'row', gap: 4, marginTop: 2, paddingHorizontal: 4 },
  reactBadge: {
    fontSize: 12, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2,
    overflow: 'hidden', color: colors.ink,
  },
  topBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.surface,
    borderTopWidth: 1, borderColor: colors.line,
  },
  sideBtn: { padding: 8 },
  input: {
    flex: 1, backgroundColor: colors.bg, borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: 10,
    fontSize: 15, color: colors.ink, maxHeight: 110,
  },
  send: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  recBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.surface,
    borderTopWidth: 1, borderColor: colors.line,
  },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger },
  recBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 170 },
  audioLine: { flex: 1, height: 3, borderRadius: 2 },
  fileCard: { flexDirection: 'row', alignItems: 'center', minWidth: 200, maxWidth: 250 },
  fileIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.line,
    marginBottom: spacing.sm,
  },
  emojiBtn: { padding: 8, borderRadius: radius.pill },
  histBox: {
    position: 'absolute', left: spacing.xl, right: spacing.xl, top: '22%',
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl,
  },
  histRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderColor: colors.line,
  },
}));
