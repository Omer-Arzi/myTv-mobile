import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/theme';
import { SeasonProgress } from '../utils/seasonProgress';

interface Props {
  title: string;
  progress: SeasonProgress;
  expanded: boolean;
  onPress: () => void;
  // Undefined when there's nothing markable (no episodes in this season,
  // so there's no seasonId to act on either) — renders an empty slot
  // rather than a button that can't do anything.
  onMarkAllWatched?: () => void;
  isMarkingAll?: boolean;
}

const CHECK_SIZE = 24;

// The collapsed, always-visible row for one season inside SeasonAccordion:
// title + expand chevron on one line, watched/total count + a check badge
// on the next, and a thin progress bar underneath. The check badge is
// static (season complete) or an actionable "mark all released as watched"
// button (season incomplete) — never both, and never a button with nothing
// to do.
export function SeasonHeader({ title, progress, expanded, onPress, onMarkAllWatched, isMarkingAll = false }: Props) {
  const pct = Math.round(progress.progress * 100);
  const hasStarted = progress.watchedCount > 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
      // Web only: this row can contain its own nested "mark all watched"
      // button (below). react-native-web renders accessibilityRole="button"
      // as a literal <button>, and browsers don't allow <button> inside
      // <button> — the DOM silently breaks that nesting. Native touchables
      // don't have this constraint, so native keeps the button role as-is.
      accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
      accessibilityLabel={`${title}, ${progress.watchedCount} of ${progress.totalCount} watched, ${expanded ? 'expanded' : 'collapsed'}`}
    >
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.chevron, expanded && styles.chevronExpanded]}>▾</Text>
        </View>

        <View style={styles.statsGroup}>
          <Text style={styles.count}>{`${progress.watchedCount}/${progress.totalCount}`}</Text>
          {progress.isFullyWatched ? (
            <View style={styles.checkBadge}>
              <Text style={styles.checkGlyph}>✓</Text>
            </View>
          ) : onMarkAllWatched ? (
            <Pressable
              style={({ pressed }) => [styles.actionBadge, pressed && styles.actionBadgePressed]}
              onPress={onMarkAllWatched}
              disabled={isMarkingAll}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Mark all released episodes in ${title} as watched`}
            >
              {isMarkingAll ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={styles.actionGlyph}>✓</Text>
              )}
            </Pressable>
          ) : (
            <View style={styles.checkSlot} />
          )}
        </View>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${pct}%` },
            progress.isFullyWatched ? styles.fillComplete : hasStarted ? styles.fillPartial : styles.fillEmpty,
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  title: { ...typography.subheading },
  chevron: { fontSize: 12, color: colors.textTertiary },
  chevronExpanded: { transform: [{ rotate: '180deg' }] },
  statsGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  count: { ...typography.caption },
  checkBadge: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: CHECK_SIZE / 2,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: { fontSize: 13, fontWeight: '700', color: '#0A0A0D' },
  checkSlot: { width: CHECK_SIZE, height: CHECK_SIZE },
  // Distinct from the static complete badge (colors.success fill) — an
  // accent-soft circle, the same "this is a tappable action" language used
  // by WatchNextCard/EpisodeCard's mark-watched circles elsewhere in the app.
  actionBadge: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: CHECK_SIZE / 2,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgePressed: { opacity: 0.6 },
  actionGlyph: { fontSize: 13, fontWeight: '700', color: colors.accent },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2 },
  fillEmpty: { backgroundColor: 'transparent' },
  fillPartial: { backgroundColor: colors.warning },
  fillComplete: { backgroundColor: colors.success },
});
