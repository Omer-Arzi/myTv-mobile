import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PosterImage } from './PosterImage';
import { StatusBadge } from './StatusBadge';
import { colors, radii, spacing, typography } from '../theme/theme';

export type SeriesCardVariant = 'rail' | 'list';
export type SeriesCardSize = 'sm' | 'md' | 'lg';

interface Props {
  title: string;
  posterUrl?: string | null;
  subtitle?: string | null;
  releaseStatus?: string | null;
  userStatus?: string | null;
  // A short warning label (e.g. "Numbering risk") shown alongside the
  // status badges — list variant only. Sourced from the same
  // classifySeriesForAttention reasonCode the Needs Attention inbox uses;
  // never a second, ad hoc warning classification.
  warning?: string | null;
  variant?: SeriesCardVariant;
  size?: SeriesCardSize;
  onPress: () => void;
  // Rail variant only (Home's rails) — an overlay "⋯" button in the
  // poster's top-right corner, same glyph/affordance as SeriesDetailScreen's
  // options button (see useSeriesOptionsMenu.ts, the shared hook both call
  // into). Omit to render the card exactly as before — every existing
  // caller is unaffected by this prop's addition.
  onOptionsPress?: () => void;
}

const RAIL_SIZES: Record<SeriesCardSize, { width: number; height: number }> = {
  sm: { width: 100, height: 150 },
  md: { width: 120, height: 180 },
  lg: { width: 140, height: 210 },
};

const LIST_SIZES: Record<SeriesCardSize, { width: number; height: number }> = {
  sm: { width: 56, height: 84 },
  md: { width: 76, height: 114 },
  lg: { width: 96, height: 144 },
};

// The one card component for "a series, represented as a poster + title +
// optional status/subtitle" — used by Home's rails, Watch Next, and the
// Watchlist screen. `variant` picks the layout (vertical poster-card for
// horizontal rails, horizontal row for vertical lists); `size` scales the
// poster within that layout, letting Watch Next read as more prominent
// than a plain Watchlist row without a different component.
export function SeriesCard({ title, posterUrl, subtitle, releaseStatus, userStatus, warning, variant = 'rail', size = 'md', onPress, onOptionsPress }: Props) {
  // "UNKNOWN" release status just means MyTV hasn't confirmed a provider
  // match yet — it's not a real broadcast state, and showing it literally
  // ("Unknown") reads as noise, not information. Simplest honest option:
  // the badge disappears rather than displaying a placeholder value.
  const showReleaseBadge = releaseStatus && releaseStatus !== 'UNKNOWN';

  if (variant === 'list') {
    const { width, height } = LIST_SIZES[size];
    return (
      <Pressable style={({ pressed }) => [styles.listRow, pressed && styles.pressed]} onPress={onPress}>
        <PosterImage uri={posterUrl ?? null} width={width} height={height} title={title} />
        <View style={styles.listText}>
          <Text style={typography.subheading} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={typography.bodySecondary} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
          <View style={styles.badgeRow}>
            {showReleaseBadge ? <StatusBadge status={releaseStatus} /> : null}
            {userStatus ? <StatusBadge status={userStatus} /> : null}
            {warning ? (
              <View style={styles.warningBadge}>
                <Text style={styles.warningLabel}>{warning}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  }

  const { width, height } = RAIL_SIZES[size];
  return (
    <Pressable style={({ pressed }) => [styles.railCard, { width }, pressed && styles.pressed]} onPress={onPress}>
      <View>
        <PosterImage uri={posterUrl ?? null} width={width} height={height} title={title} />
        {onOptionsPress ? (
          <Pressable
            style={({ pressed }) => [styles.railOptionsButton, pressed && styles.pressed]}
            // Stops the tap from also bubbling to the outer Pressable's
            // onPress (which navigates into the series) — this button
            // opens the options menu instead, never both at once.
            onPress={(e) => {
              e.stopPropagation();
              onOptionsPress();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Series options"
          >
            <Text style={styles.railOptionsGlyph}>⋯</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.railTitle} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.railSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
      {userStatus ? (
        <View style={styles.railBadge}>
          <StatusBadge status={userStatus} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },

  // rail variant
  railCard: { gap: spacing.xs },
  railTitle: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  railSubtitle: { ...typography.small },
  railBadge: { marginTop: 2 },
  railOptionsButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 26,
    height: 26,
    borderRadius: radii.full,
    backgroundColor: 'rgba(10, 10, 13, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railOptionsGlyph: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // list variant
  listRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  listText: { flex: 1, justifyContent: 'center', gap: 4 },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: 2, flexWrap: 'wrap' },
  warningBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.warningSoft,
    alignSelf: 'flex-start',
  },
  warningLabel: { fontSize: 12, fontWeight: '600', color: colors.warning },
});
