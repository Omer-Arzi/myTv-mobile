import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { PosterImage } from './PosterImage';
import { colors, radii, spacing, typography } from '../theme/theme';
import { formatDate } from '../utils/format';
import { isEpisodeReleased } from '../utils/episodeRelease';

interface Props {
  episodeNumber: number;
  title: string | null;
  imageUrl: string | null;
  seriesTitle?: string | null;
  // Drives the release-date gate below — a future/unknown episode can
  // never be marked watched from here (client-side defense-in-depth;
  // the server rejects it regardless, see EpisodeWatchService.markWatched).
  airDate: string | null;
  watched: boolean;
  watchedAt: string | null;
  note: string | null;
  canEditNote: boolean;
  onMarkWatched: () => void;
  onEditNote?: () => void;
  isMarking?: boolean;
  markDisabled?: boolean;
  // Secondary, deliberately subtle "undo" action — only rendered for
  // watched episodes. Omitting onUnwatch hides the affordance entirely
  // (used for episodes with no episodeWatchId to unwatch, defensively).
  onUnwatch?: () => void;
  isUnwatching?: boolean;
  unwatchDisabled?: boolean;
}

const STILL_WIDTH = 108;
const STILL_HEIGHT = 61; // 16:9
const ACTION_SIZE = 36;

export function EpisodeCard({
  episodeNumber,
  title,
  imageUrl,
  seriesTitle,
  airDate,
  watched,
  watchedAt,
  note,
  canEditNote,
  onMarkWatched,
  onEditNote,
  isMarking = false,
  markDisabled = false,
  onUnwatch,
  isUnwatching = false,
  unwatchDisabled = false,
}: Props) {
  const released = isEpisodeReleased(airDate);

  return (
    <View style={[styles.row, watched && styles.rowWatched]}>
      <View style={styles.stillWrapper}>
        <PosterImage uri={imageUrl} width={STILL_WIDTH} height={STILL_HEIGHT} radius={radii.sm} title={seriesTitle} />
        {watched ? (
          <View style={styles.watchedDot}>
            <Text style={styles.watchedDotText}>✓</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.textColumn}>
        <Text style={styles.title} numberOfLines={2}>
          {`E${episodeNumber}`}
          {title ? `  ${title}` : ''}
        </Text>
        <Text style={[styles.watchState, watched ? styles.watchStateWatched : styles.watchStateUnwatched]}>
          {watched ? `Watched${watchedAt ? ` · ${formatDate(watchedAt)}` : ''}` : released ? 'Not watched' : 'Not yet released'}
        </Text>
        {canEditNote ? (
          <Pressable style={styles.notePill} onPress={onEditNote} hitSlop={6}>
            <Text style={styles.notePillText}>{note ? '📝 Note' : '+ Add note'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.actionSlot}>
        {!watched && released ? (
          <Pressable
            style={({ pressed }) => [styles.actionCircle, pressed && styles.actionPressed]}
            onPress={onMarkWatched}
            disabled={isMarking || markDisabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Mark episode as watched"
          >
            {isMarking ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={styles.actionGlyph}>✓</Text>}
          </Pressable>
        ) : null}
        {watched && onUnwatch ? (
          // Deliberately subtle/muted (not the bright accent used for the
          // primary "mark watched" circle) — this is a correction action,
          // not something that should draw the eye or invite a stray tap.
          // A confirmation dialog gates the actual mutation on top of that.
          <Pressable
            style={({ pressed }) => [styles.undoCircle, pressed && styles.actionPressed]}
            onPress={onUnwatch}
            disabled={isUnwatching || unwatchDisabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Mark episode as unwatched"
          >
            {isUnwatching ? (
              <ActivityIndicator size="small" color={colors.textTertiary} />
            ) : (
              <Text style={styles.undoGlyph}>↺</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rowWatched: { opacity: 0.6 },
  stillWrapper: { position: 'relative' },
  watchedDot: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: radii.full,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  watchedDotText: { fontSize: 10, fontWeight: '700', color: '#0A0A0D' },
  textColumn: { flex: 1, justifyContent: 'center', gap: 3 },
  title: { ...typography.body, fontWeight: '600' },
  watchState: { ...typography.caption },
  watchStateWatched: { color: colors.success },
  watchStateUnwatched: { color: colors.textTertiary },
  notePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    marginTop: 2,
  },
  notePillText: { ...typography.small, color: colors.textSecondary },
  actionSlot: { width: ACTION_SIZE, alignItems: 'center', justifyContent: 'center' },
  actionCircle: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: { opacity: 0.6 },
  actionGlyph: { fontSize: 15, fontWeight: '700', color: colors.accent },
  undoCircle: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoGlyph: { fontSize: 15, fontWeight: '700', color: colors.textTertiary },
});
