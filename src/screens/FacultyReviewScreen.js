import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert,
  Modal, ActivityIndicator, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { colors, radius, spacing, type, shadow, ThemedSheet } from '../theme';
import { timeAgo, FeedActions } from '../components/ui';
import { SearchPickerModal, SelectField } from '../components/pickers';
import { useApp } from '../state/AppContext';
import { AIUB_FACULTY } from '../data/aiubFaculty';

const RATING_LABELS = {
  1: 'Below expectation',
  2: 'Needs improvement',
  3: 'Satisfactory',
  4: 'Good',
  5: 'Excellent',
};

const Stars = ({ value, size = 16, onPress }) => (
  <View style={{ flexDirection: 'row', gap: 3 }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <TouchableOpacity key={i} disabled={!onPress} onPress={() => onPress?.(i)}>
        <Ionicons
          name={i <= value ? 'star' : 'star-outline'}
          size={size}
          color={i <= value ? colors.accent : colors.inkSoft}
        />
      </TouchableOpacity>
    ))}
  </View>
);

export default function FacultyReviewScreen({ navigation }) {
  const { user, crossPostToFeed, isAdmin, usersById } = useApp();
  const [reviews, setReviews] = useState(null);
  const [filterFaculty, setFilterFaculty] = useState('');
  const [picker, setPicker] = useState(null); // 'filter' | 'form'
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ faculty: '', course: '', rating: 0, review: '', tips: '', cg: '' });

  useEffect(() => {
    return onSnapshot(collection(db, 'facultyReviews'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setReviews(list);
    });
  }, []);

  // Faculty options: official list + every name already reviewed.
  const facultyOptions = useMemo(() => {
    const used = (reviews || []).map((r) => r.faculty).filter(Boolean);
    return [...new Set([...AIUB_FACULTY, ...used])].sort((a, b) => a.localeCompare(b));
  }, [reviews]);

  const visible = useMemo(() => {
    if (!reviews) return reviews;
    if (!filterFaculty) return reviews;
    return reviews.filter((r) => r.faculty === filterFaculty);
  }, [reviews, filterFaculty]);

  const avg = useMemo(() => {
    if (!filterFaculty || !visible?.length) return null;
    return (visible.reduce((s, r) => s + (r.rating || 0), 0) / visible.length).toFixed(1);
  }, [visible, filterFaculty]);

  const submit = async () => {
    setErr('');
    if (!f.faculty) return setErr('Select the faculty you are reviewing.');
    if (!f.course.trim()) return setErr('Which course did you take with them?');
    if (!f.rating) return setErr('Tap a star rating.');
    if (!f.review.trim()) return setErr('Write your honest review.');
    if (!f.cg.trim()) return setErr('Enter your current CG — it keeps reviews honest.');
    setBusy(true);
    try {
      const secRef = await addDoc(collection(db, 'facultyReviews'), {
        faculty: f.faculty,
        course: f.course.trim(),
        rating: f.rating,
        review: f.review.trim(),
        tips: f.tips.trim(),
        cg: f.cg.trim(),
        realAuthorId: user.id, // hidden from users; developer-traceable
        createdAt: serverTimestamp(),
      });
      const feedId = await crossPostToFeed({
        campusKind: 'review', title: f.faculty, anonymous: true,
        text: `${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)} ${RATING_LABELS[f.rating]}\n${f.faculty}\nCourse: ${f.course.trim()} · CG ${f.cg.trim()}\n\n${f.review.trim()}${f.tips.trim() ? '\n\n💡 ' + f.tips.trim() : ''}`,
      });
      await updateDoc(secRef, { feedPostId: feedId });
      setOpen(false);
      setF({ faculty: '', course: '', rating: 0, review: '', tips: '', cg: '' });
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const Card = ({ r }) => (
    <View style={[styles.card, shadow.card]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={styles.anonDot}><Text style={{ fontSize: 14 }}>🎭</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...type.body, fontWeight: '800' }}>{r.faculty}</Text>
          <Text style={type.caption}>{r.course} · {timeAgo(r.createdAt)}</Text>
          {isAdmin && (
            <TouchableOpacity onPress={() => navigation.navigate('UserProfile', {
              userId: r.realAuthorId, name: usersById?.[r.realAuthorId]?.name,
            })}>
              <Text style={[type.caption, { color: colors.anon, fontWeight: '700' }]}>
                🔍 {usersById?.[r.realAuthorId]?.name || r.realAuthorId} · tap to open
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.cgPill}>
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.primaryDark }}>CG {r.cg}</Text>
        </View>
        {(r.realAuthorId === user.id || isAdmin) && (
          <TouchableOpacity onPress={() => Alert.alert('Delete your review?',
            'This removes it for everyone and cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteDoc(doc(db, 'facultyReviews', r.id)) },
            ])}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm }}>
        <Stars value={r.rating || 0} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkSoft }}>
          {RATING_LABELS[r.rating] || ''}
        </Text>
      </View>
      <Text style={[type.body, { marginTop: spacing.sm }]}>{r.review}</Text>
      {!!r.tips && (
        <View style={styles.tipsBox}>
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.primaryDark }}>💡 TIPS FOR A BETTER RESULT</Text>
          <Text style={[type.body, { marginTop: 4 }]}>{r.tips}</Text>
        </View>
      )}
      <FeedActions feedPostId={r.feedPostId} fallback={{ kind: 'review', authorId: r.realAuthorId, title: r.faculty }} navigation={navigation} />
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={type.title}>Faculty review</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setErr(''); setOpen(true); }}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* the oath banner */}
      <View style={styles.oath}>
        <Text style={styles.oathText}>
          🤲 I swear to my Lord, this is only truth but nothing else.
        </Text>
      </View>

      <View style={styles.filterRow}>
        <View style={{ flex: 1 }}>
          <SelectField
            label=""
            value={filterFaculty}
            placeholder="All faculty — tap to filter"
            onPress={() => setPicker('filter')}
          />
        </View>
        {!!filterFaculty && (
          <TouchableOpacity onPress={() => setFilterFaculty('')} style={{ paddingHorizontal: 8 }}>
            <Ionicons name="close-circle" size={22} color={colors.inkSoft} />
          </TouchableOpacity>
        )}
      </View>
      {!!avg && (
        <View style={styles.avgRow}>
          <Stars value={Math.round(Number(avg))} />
          <Text style={{ fontWeight: '800', color: colors.primaryDark, fontSize: 13 }}>
            {avg} / 5 · {visible.length} review{visible.length === 1 ? '' : 's'}
          </Text>
        </View>
      )}

      {reviews === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
              No reviews yet{filterFaculty ? ' for this faculty' : ''}. Be the first —
              it's fully anonymous.
            </Text>
          }
          renderItem={({ item }) => <Card r={item} />}
        />
      )}

      {/* write review modal */}
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.dim} activeOpacity={1} onPress={() => setOpen(false)} />
        <KeyboardAvoidingView behavior="padding">
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl }}>
              <Text style={[type.title, { textAlign: 'center' }]}>Write a review</Text>
              <View style={[styles.oath, { marginHorizontal: 0, marginTop: spacing.md }]}>
                <Text style={styles.oathText}>
                  🤲 I swear to my Lord, this is only truth but nothing else.
                </Text>
              </View>
              <Text style={[type.caption, { textAlign: 'center', marginBottom: spacing.md }]}>
                🎭 Posted 100% anonymously — no name, no profile link.
              </Text>

              <SelectField
                label="Faculty"
                value={f.faculty}
                placeholder="Select or type faculty name"
                onPress={() => setPicker('form')}
              />
              <Text style={type.label}>Course</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. CSC 2107 — Data Structures"
                placeholderTextColor={colors.inkSoft}
                value={f.course}
                onChangeText={(v) => setF({ ...f, course: v })}
              />
              <Text style={type.label}>Rating</Text>
              <View style={{ alignItems: 'center', marginVertical: spacing.sm }}>
                <Stars value={f.rating} size={34} onPress={(i) => setF({ ...f, rating: i })} />
                <Text style={{ marginTop: 6, fontWeight: '800', fontSize: 13, color: f.rating ? colors.primaryDark : colors.inkSoft }}>
                  {f.rating ? `${'★'.repeat(f.rating)} ${RATING_LABELS[f.rating]}` : 'Tap the stars'}
                </Text>
              </View>
              <Text style={type.label}>Your review</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Teaching style, grading, attendance, fairness…"
                placeholderTextColor={colors.inkSoft}
                multiline
                value={f.review}
                onChangeText={(v) => setF({ ...f, review: v })}
              />
              <Text style={type.label}>Tips for a better result (optional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                placeholder="e.g. Do the lab reports seriously, past questions repeat…"
                placeholderTextColor={colors.inkSoft}
                multiline
                value={f.tips}
                onChangeText={(v) => setF({ ...f, tips: v })}
              />
              <Text style={type.label}>Your current CG</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 3.67"
                placeholderTextColor={colors.inkSoft}
                keyboardType="decimal-pad"
                value={f.cg}
                onChangeText={(v) => setF({ ...f, cg: v })}
              />

              {!!err && <Text style={{ color: colors.danger, fontWeight: '700', marginTop: spacing.sm }}>{err}</Text>}

              <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Post anonymously</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SearchPickerModal
        visible={picker === 'filter'}
        title="Filter by faculty"
        items={facultyOptions}
        current={filterFaculty}
        onPick={(v) => setFilterFaculty(v)}
        onClose={() => setPicker(null)}
        allowCustom
      />
      <SearchPickerModal
        visible={picker === 'form'}
        title="Select faculty"
        items={facultyOptions}
        current={f.faculty}
        onPick={(v) => setF({ ...f, faculty: v })}
        onClose={() => setPicker(null)}
        allowCustom
      />
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
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  oath: {
    backgroundColor: '#3D2E00',
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.lg,
    borderWidth: 1, borderColor: colors.accent,
  },
  oathText: {
    color: '#F5D9A0', fontWeight: '800', fontSize: 12.5, textAlign: 'center',
  },
  filterRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, marginTop: spacing.sm,
  },
  avgRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  anonDot: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.anonSoft, alignItems: 'center', justifyContent: 'center',
  },
  cgPill: {
    backgroundColor: colors.primarySoft, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  tipsBox: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.sm,
  },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, maxHeight: '92%',
  },
  sheetHandle: {
    width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.lg, paddingVertical: 11,
    fontSize: 15, color: colors.ink, marginTop: 6, marginBottom: spacing.sm,
  },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: spacing.md,
  },
}));
