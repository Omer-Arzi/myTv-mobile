// Single source of truth for visual design tokens. Dark mode first — MyTv
// is meant to feel like a personal TV journal at night, not a bright admin
// panel: near-black surfaces, a cinematic indigo accent, poster/backdrop
// imagery doing most of the visual work rather than color or chrome.

import { Platform } from 'react-native';

export const colors = {
  background: '#0A0A0D',
  surface: '#16161B',
  surfaceElevated: '#202027',
  border: '#2A2A32',

  textPrimary: '#F2F2F5',
  textSecondary: '#9C9CA6',
  textTertiary: '#6B6B75',

  accent: '#6C8CFF',
  accentSoft: 'rgba(108, 140, 255, 0.16)',

  success: '#4ADE80',
  successSoft: 'rgba(74, 222, 128, 0.16)',

  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.16)',

  danger: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.16)',

  neutral: '#9C9CA6',
  neutralSoft: 'rgba(156, 156, 166, 0.14)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  full: 999,
} as const;

// A small, deliberately coarse scale — every screen picks from this rather
// than one-off font sizes, per the "avoid one-off inline styles" direction.
export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.textPrimary },
  heading: { fontSize: 19, fontWeight: '700' as const, color: colors.textPrimary },
  subheading: { fontSize: 16, fontWeight: '600' as const, color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.textPrimary },
  bodySecondary: { fontSize: 14, fontWeight: '400' as const, color: colors.textSecondary },
  caption: { fontSize: 13, fontWeight: '500' as const, color: colors.textSecondary },
  small: { fontSize: 12, fontWeight: '500' as const, color: colors.textTertiary },
};

// iOS Safari/WKWebView (including this app's installed "app-like" PWA —
// see docs/pwa.md) auto-zooms the whole page whenever a focused text
// input's computed font-size is under 16px — a built-in WebKit
// accessibility heuristic that can't be disabled via the viewport meta tag
// (iOS ignores maximum-scale/user-scalable=no for exactly this case, by
// design). Every typography size in this file is under 16px, so any
// TextInput styled directly from `typography.body` (etc.) triggers it on
// focus — confirmed as the cause of a real-device "page zooms in, stays
// zoomed across tab switches" report (the zoom is a genuine browser-level
// zoom, not app state, so it persists until manually reset). Native has no
// such behavior, so this only ever applies on web. Merge into any
// TextInput's own style array — never applies to non-input text, which
// would needlessly bump every label/caption to a size the design doesn't
// call for: `style={[styles.input, WEB_INPUT_ZOOM_FIX]}`.
export const WEB_INPUT_ZOOM_FIX = Platform.OS === 'web' ? { fontSize: 16 } : {};

export const theme = { colors, spacing, radii, typography };
