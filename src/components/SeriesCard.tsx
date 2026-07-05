import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PosterImage } from './PosterImage';
import { StatusBadge } from './StatusBadge';
import { colors, spacing, typography } from '../theme/theme';

export type SeriesCardVariant = 'rail' | 'list';
export type SeriesCardSize = 'sm' | 'md' | 'lg';

interface Props {
  title: string;
  posterUrl?: string | null;
  subtitle?: string | null;
  releaseStatus?: string | null;
  userStatus?: string | null;
  variant?: SeriesCardVariant;
  size?: SeriesCardSize;
  onPress: () => void;
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
export function SeriesCard({ title, posterUrl, subtitle, releaseStatus, userStatus, variant = 'rail', size = 'md', onPress }: Props) {
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
            {releaseStatus ? <StatusBadge status={releaseStatus} /> : null}
            {userStatus ? <StatusBadge status={userStatus} /> : null}
          </View>
        </View>
      </Pressable>
    );
  }

  const { width, height } = RAIL_SIZES[size];
  return (
    <Pressable style={({ pressed }) => [styles.railCard, { width }, pressed && styles.pressed]} onPress={onPress}>
      <PosterImage uri={posterUrl ?? null} width={width} height={height} title={title} />
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

  // list variant
  listRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  listText: { flex: 1, justifyContent: 'center', gap: 4 },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: 2, flexWrap: 'wrap' },
});
