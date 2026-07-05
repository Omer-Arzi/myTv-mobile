import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { PosterImage } from './PosterImage';
import { colors, radii, spacing, typography } from '../theme/theme';
import { formatDate } from '../utils/format';

interface Props {
  episodeNumber: number;
  title: string | null;
  imageUrl: string | null;
  seriesTitle?: string | null;
  watched: boolean;
  watchedAt: string | null;
  note: string | null;
  canEditNote: boolean;
  onMarkWatched: () => void;
  onEditNote?: () => void;
  isMarking?: boolean;
  markDisabled?: boolean;
}

const STILL_WIDTH = 108;
const STILL_HEIGHT = 61; // 16:9
const ACTION_SIZE = 36;

export function EpisodeCard({
  episodeNumber,
  title,
  imageUrl,
  seriesTitle,
  watched,
  watchedAt,
  note,
  canEditNote,
  onMarkWatched,
  onEditNote,
  isMarking = false,
  markDisabled = false,
}: Props) {
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
          {watched ? `Watched${watchedAt ? ` · ${formatDate(watchedAt)}` : ''}` : 'Not watched'}
        </Text>
        {canEditNote ? (
          <Pressable style={styles.notePill} onPress={onEditNote} hitSlop={6}>
            <Text style={styles.notePillText}>{note ? '📝 Note' : '+ Add note'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.actionSlot}>
        {!watched ? (
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
});
