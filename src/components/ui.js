import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, Modal, ScrollView , TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type, shadow, ThemedSheet } from '../theme';
import { REACTIONS, EMOJI, useApp } from '../state/AppContext';

const PALETTE = ['#B4654A', '#4A6FB4', '#8A4AB4', '#4AB48E', '#B44A6F', '#067D5A', '#C4823B'];
export const colorFor = (name = '?') => {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997;
  return PALETTE[h % PALETTE.length];
};

export const timeAgo = (ts) => {
  if (!ts?.toDate) return 'just now';
  const s = Math.max(0, (Date.now() - ts.toDate().getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const reactionsOf = (post) => {
  const map = { ...(post.reactions || {}) };
  (post.likedBy || []).forEach((uid) => { if (!map[uid]) map[uid] = 'love'; });
  return map;
};

// ---- Avatar ----
// Shows the user's profile photo if they have one (looked up live from the
// directory by userId), otherwise a colored initial. `ring` draws the
// emerald story ring around it.
export function Avatar({ userId, name, photoB64, anonymous, anonMeta, size = 44, ring }) {
  const ctx = useApp();
  const u = userId ? ctx?.usersById?.[userId] : null;
  const photo = anonymous ? null : (photoB64 ?? u?.photoB64 ?? null);
  const displayName = name ?? u?.name ?? '?';
  const bg = anonymous ? (anonMeta?.color || colors.anon) : colorFor(displayName);

  if (anonymous && anonMeta?.emoji) {
    const core = (
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: size * 0.52 }}>{anonMeta.emoji}</Text>
      </View>
    );
    if (!ring) return core;
    return (
      <View style={{
        padding: 2.5, borderRadius: (size + 11) / 2,
        borderWidth: 2.5, borderColor: colors.primary,
      }}>{core}</View>
    );
  }

  const inner = photo ? (
    <Image
      source={{ uri: `data:image/jpeg;base64,${photo}` }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>
        {anonymous ? '?' : (displayName || '?').slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );

  if (!ring) return inner;
  return (
    <View style={{
      padding: 2.5, borderRadius: (size + 11) / 2,
      borderWidth: 2.5, borderColor: colors.primary,
    }}>
      {inner}
    </View>
  );
}

export function Chip({ label, active, onPress, tone = 'primary' }) {
  const soft = tone === 'accent' ? colors.accentSoft : colors.primarySoft;
  const strong = tone === 'accent' ? colors.accent : colors.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, { backgroundColor: active ? strong : soft }]}
    >
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: active ? '#fff' : colors.primaryDark }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function SectionHeader({ label, action, onAction }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={type.label}>{label}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ---- Post card ----
const REPORT_REASONS = [
  'Spam', 'Harassment or bullying', 'Hate speech', 'Sexual content',
  'False information', 'Scam or fraud', 'Dangerous or harmful', 'Other',
];

// Report a post: common reasons + an optional note. Reports go to the
// admin-only Reports section in Campus.
export function ReportModal({ visible, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!reason) { Alert.alert('Report', 'Pick a reason first.'); return; }
    await onSubmit(reason, note);
    setSent(true);
    setTimeout(() => { setSent(false); setReason(''); setNote(''); onClose(); }, 1200);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.reportDim} activeOpacity={1} onPress={onClose} />
      <View style={styles.reportSheet}>
        <View style={styles.reportHandle} />
        {sent ? (
          <View style={{ alignItems: 'center', paddingVertical: 30 }}>
            <Ionicons name="checkmark-circle" size={40} color={colors.primary} />
            <Text style={{ ...type.title, marginTop: 8 }}>Report sent</Text>
            <Text style={type.caption}>The admin will review it. Thank you.</Text>
          </View>
        ) : (
          <>
            <Text style={[type.title, { textAlign: 'center' }]}>Report this post</Text>
            <Text style={[type.caption, { textAlign: 'center', marginBottom: spacing.md }]}>
              Your report is only visible to the admin.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {REPORT_REASONS.map((r) => (
                <TouchableOpacity key={r}
                  style={[styles.reportChip, reason === r && styles.reportChipOn]}
                  onPress={() => setReason(r)}>
                  <Text style={[styles.reportChipText, reason === r && { color: '#fff' }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.reportInput}
              placeholder="Why are you reporting this? (optional)"
              placeholderTextColor={colors.inkSoft}
              multiline
              value={note}
              onChangeText={setNote}
            />
            <TouchableOpacity style={styles.reportBtn} onPress={submit}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Send report</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

// Compact react + comment bar for campus section cards, operating on the
// post's linked FEED copy — so reactions, comments and mentions are the
// same everywhere.
export function FeedActions({ feedPostId, fallback, navigation }) {
  const { posts, reactToPost, user } = useApp() || {};
  let feedPost = feedPostId ? (posts || []).find((p) => p.id === feedPostId) : null;
  // Older section posts predate the id linkage — find their feed copy by
  // matching kind + author (+ title when available).
  if (!feedPost && fallback) {
    feedPost = (posts || []).find((p) =>
      p.campusKind === fallback.kind &&
      p.realAuthorId === fallback.authorId &&
      (!fallback.title || p.campusTitle === fallback.title));
  }
  if (!feedPost) return null;

  const myKey = feedPost.reactions?.[user.id] ||
    ((feedPost.likedBy || []).includes(user.id) ? 'love' : null);
  const counts = {};
  Object.values(feedPost.reactions || {}).forEach((k) => { counts[k] = (counts[k] || 0) + 1; });
  (feedPost.likedBy || []).forEach((uid) => {
    if (!feedPost.reactions?.[uid]) counts.love = (counts.love || 0) + 1;
  });

  return (
    <View style={styles.feedActionsRow}>
      {REACTIONS.map((r) => (
        <TouchableOpacity
          key={r.key}
          style={[styles.feedActionChip, myKey === r.key && styles.feedActionChipOn]}
          onPress={() => reactToPost(feedPost, r.key)}
        >
          <Text style={{ fontSize: 15 }}>{r.emoji}</Text>
          {!!counts[r.key] && <Text style={styles.feedActionCount}>{counts[r.key]}</Text>}
        </TouchableOpacity>
      ))}
      <View style={{ flex: 1 }} />
      <TouchableOpacity
        style={styles.feedActionChip}
        onPress={() => navigation.navigate('Comments', {
          post: {
            id: feedPost.id,
            realAuthorId: feedPost.realAuthorId,
            authorName: feedPost.authorName,
            anonymous: feedPost.anonymous,
            text: feedPost.text || '',
          },
        })}
      >
        <Ionicons name="chatbubble-outline" size={15} color={colors.inkSoft} />
        <Text style={styles.feedActionCount}>{feedPost.commentsCount || 0}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Props: post, myId, onReact(key), onOpenComments, onOpenProfile, onSave, onDelete
export function PostCard({ post, myId, onReact, onOpenComments, onOpenProfile, onSave, onDelete }) {
  const [picker, setPicker] = useState(false);
  const [showReactors, setShowReactors] = useState(false);
  const { usersById, awardStar, isAdmin, submitReport } = useApp() || {};
  const [reportOpen, setReportOpen] = useState(false);
  const rx = reactionsOf(post);
  const myReaction = rx[myId] || null;
  const counts = {};
  Object.values(rx).forEach((k) => { counts[k] = (counts[k] || 0) + 1; });
  const total = Object.values(rx).length;
  const mine = post.realAuthorId === myId;
  const saved = (post.savedBy || []).includes(myId);
  const baseName = post.anonymous ? (post.anonName || 'Anonymous') : post.authorName || 'Student';
  const name = mine ? `${baseName} (you)` : baseName;
  const roleLabel = post.authorRole === 'teacher'
    ? (post.authorSubject ? `Teacher · ${post.authorSubject}` : 'Teacher')
    : post.authorRole === 'alumni'
      ? 'Alumni'
      : post.authorRole === 'student'
        ? 'Student'
        : (post.authorDept || 'Student');
  // A badge only shows for a VERIFIED role (authorRole is only set when verified).
  const roleIcon = post.authorRole === 'teacher' ? '👨‍🏫'
    : post.authorRole === 'alumni' ? '🎓'
    : post.authorRole === 'student' ? '🎓' : null;
  const roleBadgeText = post.authorRole === 'teacher' ? 'Teacher'
    : post.authorRole === 'alumni' ? 'Alumni'
    : post.authorRole === 'student' ? 'Student' : '';
  const realName = usersById?.[post.realAuthorId]?.name;
  const sub = post.anonymous
    ? (isAdmin && realName ? `Identity hidden · 🔍 ${realName}` : 'Identity hidden')
    : roleLabel;
  // Admin can tap through an anonymous post to the REAL profile.
  const canVisit = (!post.anonymous || (isAdmin && post.realAuthorId)) && onOpenProfile;

  const confirmDelete = () =>
    Alert.alert('Delete post?', 'This removes it for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);

  const pick = (key) => { setPicker(false); onReact(key); };

  // Daily-star reward (Education & Jobs posts carry a star wallet).
  const giveStar = async () => {
    if (!awardStar) return;
    const res = await awardStar({
      targets: [{ coll: 'posts', id: post.id }, { coll: post.starColl, id: post.starDocId }],
      toUserId: post.realAuthorId,
    });
    Alert.alert(res.ok ? '⭐ Star given!' : 'Stars',
      res.ok
        ? `You have ${res.left} star${res.left === 1 ? '' : 's'} left today. Stars can't be taken back.`
        : res.msg);
  };

  return (
    <View style={[styles.card, shadow.card]}>
      <TouchableOpacity
        style={styles.row}
        disabled={!canVisit}
        onPress={onOpenProfile}
        activeOpacity={0.6}
      >
        <Avatar
          userId={post.anonymous ? null : post.realAuthorId}
          name={post.authorName}
          anonymous={post.anonymous}
          anonMeta={post.anonAvatar}
        />
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ ...type.body, fontWeight: '700' }}>{name}</Text>
            {!post.anonymous && roleIcon && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 3,
                backgroundColor: colors.primarySoft, borderRadius: 999,
                paddingHorizontal: 7, paddingVertical: 1,
              }}>
                <Text style={{ fontSize: 10 }}>{roleIcon}</Text>
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.primaryDark }}>
                  {roleBadgeText}
                </Text>
                <Ionicons name="checkmark-circle" size={11} color={colors.primary} />
              </View>
            )}
          </View>
          <Text style={type.caption}>{sub} · {timeAgo(post.createdAt)}</Text>
        </View>
        {!!post.starColl && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 6 }}>
            <View style={styles.starPill}>
              <Ionicons name="star" size={12} color={colors.accent} />
              <Text style={styles.starPillText}>{post.stars || 0}</Text>
            </View>
            {!mine && (
              <TouchableOpacity style={styles.starGiveBtn} onPress={giveStar}>
                <Ionicons name="star-outline" size={13} color="#fff" />
                <Text style={styles.starGiveBtnText}>+1</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {post.anonymous && (
          <View style={styles.anonBadge}>
            <Ionicons name="eye-off-outline" size={12} color={colors.anon} />
            <Text style={styles.anonBadgeText}>Anon</Text>
          </View>
        )}
      </TouchableOpacity>

      {!!post.campusKind && (
        <View style={styles.campusBadge}>
          <Ionicons
            name={
              post.campusKind === 'event' ? 'calendar'
              : post.campusKind === 'lostfound' ? 'search'
              : post.campusKind === 'club' ? 'people'
              : post.campusKind === 'seminar' ? 'mic'
              : post.campusKind === 'education' ? 'book'
              : post.campusKind === 'jobs' ? 'briefcase'
              : post.campusKind === 'review' ? 'star'
              : post.campusKind === 'findfriends' ? 'heart'
              : 'ribbon'
            }
            size={12}
            color={colors.primaryDark}
          />
          <Text style={styles.campusBadgeText}>
            {post.campusKind === 'event' ? 'Campus Event'
              : post.campusKind === 'lostfound' ? 'Lost & Found'
              : post.campusKind === 'club' ? 'Club'
              : post.campusKind === 'seminar' ? 'Seminar'
              : post.campusKind === 'education' ? 'Education'
              : post.campusKind === 'jobs' ? 'Jobs'
              : post.campusKind === 'review' ? 'Faculty Review'
              : post.campusKind === 'findfriends' ? 'Find Friends'
              : 'Alumni'}
          </Text>
        </View>
      )}

      {!!post.text && <Text style={[type.body, { marginTop: spacing.md }]}>{post.text}</Text>}

      {!!post.imageB64 && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${post.imageB64}` }}
          style={styles.photo}
          resizeMode="cover"
        />
      )}

      {total > 0 && (
        <TouchableOpacity style={styles.breakdown} onPress={() => setShowReactors(true)}>
          {REACTIONS.filter((r) => counts[r.key]).map((r) => (
            <Text key={r.key} style={styles.breakdownItem}>
              {r.emoji} {counts[r.key]}
            </Text>
          ))}
          <Text style={[styles.breakdownItem, { color: colors.primary }]}>· see who</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showReactors} transparent animationType="fade"
        onRequestClose={() => setShowReactors(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
          activeOpacity={1}
          onPress={() => setShowReactors(false)}
        />
        <View style={styles.reactorsBox}>
          <Text style={[type.title, { textAlign: 'center', marginBottom: spacing.md }]}>
            Reactions · {total}
          </Text>
          <ScrollView style={{ maxHeight: 340 }}>
            {Object.entries(rx).map(([uid, key]) => (
              <View key={uid} style={styles.reactorRow}>
                <Avatar userId={uid} size={36} />
                <Text style={[type.body, { flex: 1, marginLeft: spacing.md, fontWeight: '600' }]}>
                  {uid === myId ? 'You' : usersById?.[uid]?.name || 'Student'}
                </Text>
                <Text style={{ fontSize: 20 }}>{EMOJI[key]}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {picker && (
        <View style={[styles.picker, shadow.card]}>
          {REACTIONS.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.pickBtn, myReaction === r.key && styles.pickBtnActive]}
              onPress={() => pick(r.key)}
            >
              <Text style={{ fontSize: 26 }}>{r.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={[styles.row, { marginTop: spacing.md }]}>
        <TouchableOpacity style={styles.action} onPress={() => setPicker(!picker)}>
          {myReaction ? (
            <Text style={{ fontSize: 18 }}>{EMOJI[myReaction]}</Text>
          ) : (
            <Ionicons name="heart-outline" size={20} color={colors.inkSoft} />
          )}
          <Text style={[styles.actionText, myReaction && { color: colors.primaryDark }]}>
            {total}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={onOpenComments}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.inkSoft} />
          <Text style={styles.actionText}>{post.commentsCount || 0}</Text>
        </TouchableOpacity>
        {onSave && (
          <TouchableOpacity style={styles.action} onPress={onSave}>
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={saved ? colors.accent : colors.inkSoft}
            />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {(mine || isAdmin) && (
          <TouchableOpacity style={styles.action} onPress={confirmDelete}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
          </TouchableOpacity>
        )}
        {!mine && (
          <TouchableOpacity style={styles.action} onPress={() => setReportOpen(true)}>
            <Ionicons name="flag-outline" size={16} color={colors.inkSoft} />
            <Text style={styles.actionText}>Report</Text>
          </TouchableOpacity>
        )}
      </View>

      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={(reason, note) => submitReport(post, reason, note)}
      />
    </View>
  );
}

const styles = ThemedSheet(() => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill, marginRight: spacing.sm, marginBottom: spacing.sm,
  },
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md,
  },
  photo: {
    marginTop: spacing.md, width: '100%', aspectRatio: 4 / 3,
    borderRadius: radius.md, backgroundColor: colors.primarySoft,
  },
  breakdown: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  breakdownItem: { fontSize: 13, color: colors.inkSoft, fontWeight: '600' },
  picker: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: colors.surface, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.line,
    paddingVertical: 6, paddingHorizontal: 6, marginTop: spacing.md,
  },
  pickBtn: { padding: 6, borderRadius: radius.pill },
  pickBtnActive: { backgroundColor: colors.primarySoft },
  action: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.xl, gap: 5 },
  actionText: { ...type.caption, fontWeight: '600' },
  anonBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.anonSoft,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill,
  },
  anonBadgeText: { fontSize: 11, fontWeight: '700', color: colors.anon },
  campusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4, marginTop: spacing.md,
  },
  campusBadgeText: { fontSize: 11, fontWeight: '800', color: colors.primaryDark },
  starPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.bg, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.line,
  },
  starPillText: { fontSize: 11.5, fontWeight: '800', color: colors.ink },
  starGiveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.accent, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  starGiveBtnText: { fontSize: 10.5, fontWeight: '800', color: '#fff' },
  reportDim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  reportSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl,
  },
  reportHandle: {
    width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  reportChip: {
    borderRadius: 999, borderWidth: 1.5, borderColor: colors.line,
    backgroundColor: colors.bg, paddingHorizontal: 11, paddingVertical: 7,
  },
  reportChipOn: { backgroundColor: colors.danger, borderColor: colors.danger },
  reportChipText: { fontSize: 12.5, fontWeight: '800', color: colors.ink },
  reportInput: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.lg, paddingVertical: 11,
    fontSize: 14.5, color: colors.ink, marginTop: spacing.md,
    minHeight: 60, textAlignVertical: 'top',
  },
  reportBtn: {
    backgroundColor: colors.danger, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.md,
  },
  feedActionsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: spacing.sm, flexWrap: 'wrap',
  },
  feedActionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.bg, borderRadius: 999,
    borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  feedActionChipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  feedActionCount: { fontSize: 11.5, fontWeight: '800', color: colors.inkSoft },
  reactorsBox: {
    position: 'absolute', left: spacing.xl, right: spacing.xl, top: '25%',
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl,
  },
  reactorRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderColor: colors.line,
  },
}));
