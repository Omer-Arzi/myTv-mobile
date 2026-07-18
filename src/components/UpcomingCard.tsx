import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { PosterImage } from './PosterImage';
import { colors, radii, spacing, typography } from '../theme/theme';
import { UpcomingItem } from '../api/types';
import { formatDaysUntil } from '../utils/upcomingGrouping';

interface Props {
  item: UpcomingItem;
  // Only used to render the "X days" count when this card is inside the
  // Later section (dayOffset >= 8) — see docs/upcoming-timeline-todo.md
  // "Later section". Ignored otherwise.
  dayOffset: number;
  isInLater: boolean;
  onPress: () => void;
  onToggleWatched: () => void;
  isMutating?: boolean;
}

const POSTER_WIDTH = 64;
const POSTER_HEIGHT = 96;
const ACTION_SIZE = 36;

// No platform/network/channel field is ever read or rendered here — see
// docs/upcoming-timeline-todo.md "Do not display platform". Unknown release
// time is never shown as a placeholder ("Unknown"/"--") — the hour is simply
// omitted; its absence IS the signal, no icon/badge marks it either way.
export function UpcomingCard({ item, dayOffset, isInLater, onPress, onToggleWatched, isMutating = false }: Props) {
  const localizedTime = item.hasKnownReleaseTime
    ? new Date(item.airDateInstant).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null;

  // Mirrors EpisodeCard's rule exactly: a future/unreleased episode can
  // never be marked watched from here — the action circle simply doesn't
  // render, same as SeriesDetailScreen's EpisodeCard. This is
  // client-side defense-in-depth; the server rejects it regardless
  // (EpisodeWatchService.markWatched).
  const canToggleWatched = item.isWatched || item.isReleased;

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <PosterImage uri={item.posterUrl} width={POSTER_WIDTH} height={POSTER_HEIGHT} radius={radii.sm} title={item.seriesTitle} />

      <View style={styles.content}>
        <Text style={styles.seriesTitle} numberOfLines={1}>
          {item.seriesTitle}
        </Text>
        <Text style={styles.episodeCode}>
          {`S${item.seasonNumber}E${item.episodeNumber}`}
          {item.episodeTitle ? `  ${item.episodeTitle}` : ''}
        </Text>

        <View style={styles.metaRow}>
          {localizedTime ? <Text style={styles.metaText}>{localizedTime}</Text> : null}
          {isInLater ? <Text style={styles.metaText}>{formatDaysUntil(dayOffset)}</Text> : null}
          {item.badges.seriesPremiere ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Series Premiere</Text>
            </View>
          ) : item.badges.seasonPremiere ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Season Premiere</Text>
            </View>
          ) : null}
        </View>
      </View>

      {canToggleWatched ? (
        <Pressable
          style={({ pressed }) => [styles.actionCircle, item.isWatched && styles.actionCircleWatched, pressed && styles.actionPressed]}
          onPress={onToggleWatched}
          disabled={isMutating}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={item.isWatched ? 'Mark episode as unwatched' : 'Mark episode as watched'}
        >
          {isMutating ? (
            <ActivityIndicator size="small" color={item.isWatched ? '#0A0A0D' : colors.accent} />
          ) : (
            <Text style={[styles.actionGlyph, item.isWatched && styles.actionGlyphWatched]}>✓</Text>
          )}
        </Pressable>
      ) : (
        <View style={styles.actionSlot} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.75 },
  content: { flex: 1, gap: 3, justifyContent: 'center' },
  seriesTitle: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  episodeCode: { ...typography.body, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: 2 },
  metaText: { ...typography.small },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.accentSoft,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.accent },
  actionSlot: { width: ACTION_SIZE, height: ACTION_SIZE },
  actionCircle: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCircleWatched: { backgroundColor: colors.success },
  actionPressed: { opacity: 0.6 },
  actionGlyph: { fontSize: 15, fontWeight: '700', color: colors.accent },
  actionGlyphWatched: { color: '#0A0A0D' },
});
