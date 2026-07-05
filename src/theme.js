import { StyleSheet } from 'react-native';

// ---------------- palettes ----------------
const BASE = {
  accent: '#F5B042',
  accentSoft: '#FDF0DA',
  danger: '#D64545',
  anon: '#4B3F72',
  anonSoft: '#EDEAF6',
};

export const PALETTES = {
  emerald: {
    ...BASE,
    name: 'Emerald', dark: false,
    primary: '#067D5A', primaryDark: '#044A37', primarySoft: '#DDF2EA',
    bg: '#F7F9F7', surface: '#FFFFFF',
    ink: '#101E18', inkSoft: '#56665E', line: '#E5EAE7',
  },
  night: {
    ...BASE,
    name: 'Night', dark: true,
    primary: '#1DA97E', primaryDark: '#7FD6BC', primarySoft: '#123329',
    bg: '#0E1512', surface: '#182119',
    ink: '#ECF2EE', inkSoft: '#9AABA1', line: '#26332B',
    accentSoft: '#3A2E15', anonSoft: '#272138',
  },
  ocean: {
    ...BASE,
    name: 'Ocean', dark: false,
    primary: '#0E5FA8', primaryDark: '#08406F', primarySoft: '#DDEBF8',
    bg: '#F6F8FA', surface: '#FFFFFF',
    ink: '#101820', inkSoft: '#57626C', line: '#E4E9EE',
  },
  sunset: {
    ...BASE,
    name: 'Sunset', dark: false,
    primary: '#D4572B', primaryDark: '#93381A', primarySoft: '#FBE7DD',
    bg: '#FBF7F4', surface: '#FFFFFF',
    ink: '#221510', inkSoft: '#6E5B52', line: '#EFE4DD',
  },
  royal: {
    ...BASE,
    name: 'Royal', dark: false,
    primary: '#5B3FA8', primaryDark: '#3E2B74', primarySoft: '#EBE5F8',
    bg: '#F8F7FB', surface: '#FFFFFF',
    ink: '#161221', inkSoft: '#5E586E', line: '#E8E5F0',
  },
};

export const THEME_KEYS = Object.keys(PALETTES);

// ---------------- live color object ----------------
// `colors` keeps the SAME object identity forever; applyTheme mutates it.
// Inline styles pick up changes on re-render; ThemedSheet handles the
// StyleSheet-based ones by rebuilding when the theme version bumps.
export const colors = { ...PALETTES.emerald };

let version = 0;
export const themeVersion = () => version;

export function applyTheme(key) {
  const p = PALETTES[key] || PALETTES.emerald;
  Object.assign(colors, p);
  version++;
}

// Lazy, theme-aware StyleSheet. Usage: const styles = ThemedSheet(() => ({...}))
export function ThemedSheet(factory) {
  let cachedV = -1;
  let cached = null;
  return new Proxy({}, {
    get(_, prop) {
      if (cachedV !== version) {
        cached = StyleSheet.create(factory());
        cachedV = version;
      }
      return cached[prop];
    },
  });
}

// ---------------- shared tokens ----------------
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };

// `type` styles read colors via getters so they always match the theme.
export const type = {
  get display() {
    return { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 };
  },
  get title() {
    return { fontSize: 19, fontWeight: '700', color: colors.ink };
  },
  get body() {
    return { fontSize: 15, fontWeight: '400', color: colors.ink, lineHeight: 21 };
  },
  get caption() {
    return { fontSize: 12.5, fontWeight: '500', color: colors.inkSoft };
  },
  get label() {
    return {
      fontSize: 11, fontWeight: '700', color: colors.inkSoft,
      letterSpacing: 1.2, textTransform: 'uppercase',
    };
  },
};

// `card` is a getter returning a FRESH object each read: React Native
// freezes style objects in dev, so we must never hand out one shared
// mutable object. This also makes the shadow theme-aware automatically.
export const shadow = {
  get card() {
    return {
      shadowColor: colors.dark ? '#000000' : colors.ink,
      shadowOpacity: colors.dark ? 0.35 : 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    };
  },
};
