import React, { useState } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type, shadow, ThemedSheet } from '../theme';
import { useApp } from '../state/AppContext';
import { Avatar, Chip, SectionHeader } from '../components/ui';
import { SPOTLIGHT, COURSES, JOBS } from '../mock/data';

// All campus sections are live and cross-post to the main feed.
// They go live the same way the feed did (see GOLIVE.md, "What's next").

const HUB = [
  { key: 'Events', icon: 'calendar', title: 'Events', desc: 'Club events, seminars, research lectures', tone: colors.primary, live: true },
  { key: 'Clubs', icon: 'people', title: 'Clubs', desc: 'Campus clubs — create, join, connect', tone: '#4AB48E', live: true },
  { key: 'Seminars', icon: 'mic', title: 'Seminars', desc: 'Seminars, research lectures, talks', tone: '#C4823B', live: true },
  { key: 'LostFound', icon: 'search', title: 'Lost & Found', desc: 'Lost something on campus? Found something?', tone: '#B4654A', live: true },
  { key: 'Alumni', icon: 'ribbon', title: 'Alumni', desc: 'Graduates — guidance, referrals, connections', tone: '#4B3F72', live: true },
  { key: 'FacultyReview', icon: 'star', title: 'Faculty review', desc: 'Anonymous teacher & course reviews with ratings and CG', tone: '#B4832F', live: true },
  { key: 'FindFriends', icon: 'heart', title: 'Find friends', desc: 'Post it, ask it & confess it — crush, coffee adda, study partners', tone: '#D64545', live: true },
  { key: 'AdminReports', icon: 'flag', title: 'Reports', desc: 'Admin only — reported posts, delete & block users', tone: '#8B2E2E', live: true, adminOnly: true },
  { key: 'Spotlight', icon: 'sparkles', title: 'Campus Spotlight', desc: 'Star ranking — Campus Star & Helper of the week', tone: colors.accent, live: true },
  { key: 'Education', icon: 'book', title: 'Education', desc: 'Notes, PDFs, slides & sheets — earn ⭐ stars', tone: '#067D5A', live: true },
  { key: 'Jobs', icon: 'briefcase', title: 'Jobs & internships', desc: 'Part-time work, internships, gigs — earn ⭐ stars', tone: '#4A6FB4', live: true },
];

export function CampusHubScreen({ navigation }) {
  const { isAdmin } = useApp();
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={{ padding: spacing.lg }}>
        <Text style={type.display}>Campus</Text>
        <Text style={type.caption}>Everything beyond the feed</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
      {HUB.filter((h) => !h.adminOnly || isAdmin).map((h) => (
        <TouchableOpacity
          key={h.key}
          style={[styles.hubCard, shadow.card]}
          onPress={() => navigation.navigate(h.key)}
        >
          <View style={[styles.hubIcon, { backgroundColor: h.tone }]}>
            <Ionicons name={h.icon} size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ ...type.body, fontWeight: '800' }}>{h.title}</Text>
            <Text style={type.caption}>{h.desc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.inkSoft} />
        </TouchableOpacity>
      ))}
      <Text style={[type.caption, { padding: spacing.lg, textAlign: 'center' }]}>
        Everything here posts to the main feed too — react and comment there.
      </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export function SpotlightScreen() {
  const [votedEntry, setVotedEntry] = useState(null);
  const [optedIn, setOptedIn] = useState(false);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.spotHero}>
          <Text style={[type.label, { color: '#F9DFA9' }]}>{SPOTLIGHT.weekLabel}</Text>
          <Text style={[type.display, { color: '#fff', marginTop: 6 }]}>Campus Spotlight</Text>
          <Text style={{ color: '#EAF6EF', marginTop: 6, lineHeight: 20 }}>
            Every week, students who opt in get featured and campus votes.
            Only people who joined themselves appear here.
          </Text>
          <TouchableOpacity
            style={[styles.optIn, optedIn && { backgroundColor: '#fff' }]}
            onPress={() => setOptedIn(!optedIn)}
          >
            <Ionicons
              name={optedIn ? 'checkmark-circle' : 'sparkles-outline'}
              size={16}
              color={optedIn ? colors.accent : '#fff'}
            />
            <Text style={{ fontWeight: '800', color: optedIn ? colors.accent : '#fff' }}>
              {optedIn ? 'You are in this week' : 'Feature me next week'}
            </Text>
          </TouchableOpacity>
        </View>

        {SPOTLIGHT.categories.map((cat) => (
          <View key={cat.id}>
            <SectionHeader label={cat.title} />
            <Text style={[type.caption, { paddingHorizontal: spacing.lg, marginTop: -6 }]}>
              {cat.subtitle}
            </Text>
            {cat.entries.map((e, idx) => {
              const voted = votedEntry === e.id;
              return (
                <View key={e.id} style={[styles.entry, shadow.card]}>
                  <Text style={styles.rank}>{idx + 1}</Text>
                  <Avatar name={e.user.name} size={46} />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={{ ...type.body, fontWeight: '700' }}>{e.user.name}</Text>
                    <Text style={type.caption}>{e.tagline}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.voteBtn, voted && { backgroundColor: colors.accent }]}
                    onPress={() => setVotedEntry(voted ? null : e.id)}
                  >
                    <Ionicons
                      name={voted ? 'star' : 'star-outline'}
                      size={15}
                      color={voted ? '#fff' : colors.accent}
                    />
                    <Text style={{ fontWeight: '800', fontSize: 12.5, color: voted ? '#fff' : colors.accent }}>
                      {e.votes + (voted ? 1 : 0)}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

export function EducationScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={{ padding: spacing.lg }}>
        <Text style={type.display}>Education</Text>
        <Text style={type.caption}>Shared by students, for students</Text>
      </View>
      <FlatList
        data={COURSES}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={[styles.listCard, shadow.card]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Chip label={item.kind} />
              <Chip label={item.dept} tone="accent" />
            </View>
            <Text style={{ ...type.body, fontWeight: '700', marginTop: spacing.sm }}>{item.title}</Text>
            <View style={styles.metaRow}>
              <Text style={type.caption}>by {item.author}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="bookmark" size={13} color={colors.primary} />
                <Text style={type.caption}>{item.saves} saves</Text>
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

export function JobsScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={{ padding: spacing.lg }}>
        <Text style={type.display}>Jobs & internships</Text>
        <Text style={type.caption}>Opportunities posted by students and alumni</Text>
      </View>
      <FlatList
        data={JOBS}
        keyExtractor={(j) => j.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={[styles.listCard, shadow.card]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Chip label={item.type} />
              <Text style={type.caption}>{item.posted}</Text>
            </View>
            <Text style={{ ...type.body, fontWeight: '700', marginTop: spacing.sm }}>{item.role}</Text>
            <Text style={type.caption}>{item.org}</Text>
            <View style={styles.metaRow}>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 14 }}>{item.pay}</Text>
              <TouchableOpacity style={styles.apply}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12.5 }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = ThemedSheet(() => ({
  root: { flex: 1, backgroundColor: colors.bg },
  hubCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, marginHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  hubIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  spotHero: {
    backgroundColor: colors.primaryDark, margin: spacing.lg,
    borderRadius: radius.lg, padding: spacing.xl,
  },
  optIn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#fff', borderRadius: radius.pill,
    paddingVertical: 11, marginTop: spacing.lg,
  },
  entry: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm,
  },
  rank: { width: 24, fontSize: 15, fontWeight: '800', color: colors.inkSoft, textAlign: 'center', marginRight: spacing.sm },
  voteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: colors.accent, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: 7,
  },
  listCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  apply: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 8 },
}));
