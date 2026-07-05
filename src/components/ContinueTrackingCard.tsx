import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { PosterImage } from './PosterImage';
import { colors, radii, spacing } from '../theme/theme';
import { episodeLabel } from '../utils/format';

interface Props {
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  imageUrl: string | null;
  seriesTitle: string;
  onMarkWatched: () => void;
  isMarking?: boolean;
  markDisabled?: boolean;
}

const CARD_HEIGHT = 92;
const THUMB_SIZE = 76;
const ACTION_SIZE = 40;

// Series Detail's equivalent of Home's WatchNextCard — same thumbnail size,
// card height, and accent-soft circular check button, so the "here's what
// to watch next" affordance reads as the same UI object wherever it shows
// up. No series-title pill (redundant — we're already on that series'
// page) and no swipe gesture here yet, per this pass's scope.
export function ContinueTrackingCard({
  seasonNumber,
  episodeNumber,
  episodeTitle,
  imageUrl,
  seriesTitle,
  onMarkWatched,
  isMarking = false,
  markDisabled = false,
}: Props) {
  return (
    <View style={styles.card}>
      <PosterImage uri={imageUrl} width={THUMB_SIZE} height={THUMB_SIZE} radius={radii.md} title={seriesTitle} />

      <View style={styles.content}>
        <Text style={styles.label}>CONTINUE TRACKING</Text>
        <Text style={styles.value} numberOfLines={1}>
          {episodeLabel(seasonNumber, episodeNumber, episodeTitle)}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.actionCircle, pressed && styles.actionPressed]}
        onPress={onMarkWatched}
        disabled={isMarking || markDisabled}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Mark next episode as watched"
      >
        {isMarking ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={styles.actionGlyph}>✓</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CARD_HEIGHT,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  content: { flex: 1, gap: 3, justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '700', color: colors.accent, letterSpacing: 0.5 },
  value: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  actionCircle: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: { opacity: 0.6 },
  actionGlyph: { fontSize: 16, fontWeight: '700', color: colors.accent },
});
