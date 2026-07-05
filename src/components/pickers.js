import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type, ThemedSheet } from '../theme';

// Generic searchable single-select picker.
// items: string[] · current: string · onPick(value) · allowCustom: let the
// person use whatever they typed if it's not in the list.
export function SearchPickerModal({ visible, title, items, current, onPick, onClose, allowCustom }) {
  const [search, setSearch] = useState('');

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((u) => u.toLowerCase().includes(q));
  }, [search, items]);

  const exact = results.some((u) => u.toLowerCase() === search.trim().toLowerCase());
  const pick = (v) => { onPick(v); setSearch(''); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setSearch(''); onClose(); }}>
            <Ionicons name="close" size={26} color={colors.ink} />
          </TouchableOpacity>
          <Text style={type.title}>{title}</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color={colors.inkSoft} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search…"
            placeholderTextColor={colors.inkSoft}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>
        <FlatList
          data={results.slice(0, 400)}
          keyExtractor={(u) => u}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={25}
          ListHeaderComponent={
            <View>
              {allowCustom && search.trim().length > 2 && !exact && (
                <TouchableOpacity
                  style={[styles.row, { backgroundColor: colors.accentSoft }]}
                  onPress={() => pick(search.trim())}
                >
                  <Ionicons name="add-circle" size={18} color={colors.accent} />
                  <Text style={{ ...type.body, fontWeight: '700', flex: 1, marginLeft: 8 }}>
                    Use “{search.trim()}”
                  </Text>
                </TouchableOpacity>
              )}
              {!!current && (
                <TouchableOpacity style={styles.row} onPress={() => pick('')}>
                  <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
                  <Text style={{ ...type.body, color: colors.danger, marginLeft: 8 }}>
                    Clear selection
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => pick(item)}>
              <Ionicons
                name={item === current ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={item === current ? colors.primary : colors.inkSoft}
              />
              <Text style={{ ...type.body, flex: 1, marginLeft: 8 }}>{item}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
              {allowCustom
                ? 'No match — keep typing and tap “Use …” to add yours.'
                : 'No match found.'}
            </Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

// A tappable input-looking row that opens a picker.
export function SelectField({ label, value, placeholder, onPress }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {!!label && <Text style={type.label}>{label}</Text>}
      <TouchableOpacity style={styles.select} onPress={onPress}>
        <Text style={{ fontSize: 15, color: value ? colors.ink : colors.inkSoft, flex: 1 }}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.inkSoft} />
      </TouchableOpacity>
    </View>
  );
}

const styles = ThemedSheet(() => ({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    margin: spacing.lg, paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: colors.ink },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 13,
    borderBottomWidth: 1, borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  select: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    marginTop: 6, flexDirection: 'row', alignItems: 'center',
  },
}));
