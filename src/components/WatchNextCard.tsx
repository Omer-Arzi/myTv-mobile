import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { PosterImage } from './PosterImage';
import { colors, radii, spacing } from '../theme/theme';
import { getRemainingEpisodesIndicator } from '../utils/remainingEpisodesIndicator';
import { ReleaseStatus } from '../api/types/common';

interface Props {
  seriesTitle: string;
  imageUrl: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  // How many known catalog episodes come after this episode — drives the
  // small "+N" / "Final episode"/"Latest episode" indicator beside the
  // SxxEyy label. Absent or null renders neither (see
  // getRemainingEpisodesIndicator).
  remainingEpisodesAfterNext?: number | null;
  // Decides "Final episode" (show confirmed over) vs "Latest episode"
  // (still releasing/not yet confirmed) when remainingEpisodesAfterNext is
  // 0 — see getRemainingEpisodesIndicator. Defaults to 'UNKNOWN' (never
  // claims "final" without confirmation) when omitted.
  releaseStatus?: ReleaseStatus;
  onPress: () => void;
  onMarkWatched: () => void;
  isMarking?: boolean;
  markDisabled?: boolean;
  // Marked watched earlier in this session (mutation already succeeded).
  // The card stays in place — see HomeScreen — but goes into a permanent
  // fade/checked state and can no longer be tapped/swiped to re-mark.
  isWatched?: boolean;
  // Fired true the instant this card locks onto a horizontal swipe, false
  // the instant that gesture ends (release OR cancel) — lets a parent
  // ScrollView disable its own scrolling for the duration as an extra
  // defensive layer (see HomeScreen). Optional: the card is fully
  // functional without a parent wiring this up.
  onSwipeLockChange?: (locked: boolean) => void;
}

const CARD_HEIGHT = 92;
const THUMB_SIZE = 76;
const ACTION_SIZE = 40;

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - spacing.lg * 2;

// Two separate, deliberately distinct concepts — collapsing them into one
// knob is what made earlier versions commit on a light flick:
//
// 1. How far the card can visually travel — generous, so there's room for
//    a real "drag it most of the way off" gesture like TV Time's, not a
//    twitch.
const SWIPE_REVEAL_DISTANCE = Math.min(CARD_WIDTH * 0.8, 260);
// 2. Fraction of SWIPE_REVEAL_DISTANCE the drag must cross before release
//    commits to marking watched. High on purpose: a small or medium swipe
//    should only ever peek the affordance and spring back, never fire the
//    mutation. At this ratio that's ~180-210px on typical iPhone widths,
//    matching the "almost to the end" feel this is modeling.
const SWIPE_COMMIT_THRESHOLD_RATIO = 0.75;
const SWIPE_COMMIT_THRESHOLD = SWIPE_REVEAL_DISTANCE * SWIPE_COMMIT_THRESHOLD_RATIO;

// --- Direction-lock thresholds ---------------------------------------
// A mostly-horizontal drag needs to stay captured by this card even when
// the finger drifts up/down a little; a mostly-vertical drag needs to
// release to the parent ScrollView immediately rather than fight it. Three
// more distinct knobs, none of which is SWIPE_ACTIVATION_THRESHOLD above
// (that one only gates when we start considering direction at all; these
// gate which direction wins once movement is happening).
//
// How far dx must travel, while also clearly dominating dy, before we lock
// onto "this is a horizontal swipe" for the rest of the gesture.
const HORIZONTAL_ACTIVATION_THRESHOLD = 14;
// How much bigger |dx| must be than |dy| to count as "clearly horizontal."
const HORIZONTAL_DOMINANCE_RATIO = 1.3;
// How far dy must travel, while dominating dx, before we give up on this
// gesture entirely and let the ScrollView have it — checked independently
// of the horizontal condition so an ambiguous diagonal doesn't sit in limbo
// forever; once either side wins, the decision is locked for the gesture.
const VERTICAL_FAIL_THRESHOLD = 16;

type GestureDirection = 'undetermined' | 'horizontal' | 'vertical';

// TV Time-style compact "continue watching" row: thumbnail on the left,
// series title as a small pill + a large SxxEyy + episode title in the
// middle, a circular action affordance on the right. One fixed height per
// card (no tall poster-list layout) so the whole Watch Next section reads
// as a tight, scannable stack rather than a gallery.
//
// The trailing circle is its own Pressable nested inside the card's
// Pressable — React Native's responder system gives the touch to whichever
// one claims it first (the innermost), so tapping the circle marks the
// episode watched without also firing the card's onPress navigation.
//
// Swipe-right is a second way to trigger the exact same action: a green
// check affordance sits behind the card and is revealed as the card slides
// right, growing more opaque/prominent the further it travels. Only a
// release past SWIPE_COMMIT_THRESHOLD calls the same onMarkWatched as the
// circle — anything short of that (including a fast but short flick; there
// is deliberately no velocity-based completion) always springs back with no
// mutation call. No gesture library is installed, so this uses core RN
// PanResponder/Animated rather than reanimated/gesture-handler — see
// GestureDirection below for how it stays stable against a parent
// ScrollView on a diagonal drag despite that.
export function WatchNextCard({
  seriesTitle,
  imageUrl,
  seasonNumber,
  episodeNumber,
  episodeTitle,
  remainingEpisodesAfterNext,
  releaseStatus,
  onPress,
  onMarkWatched,
  isMarking = false,
  markDisabled = false,
  isWatched = false,
  onSwipeLockChange,
}: Props) {
  const remainingIndicator = getRemainingEpisodesIndicator(remainingEpisodesAfterNext, releaseStatus);
  const translateX = useRef(new Animated.Value(0)).current;

  // PanResponder is created once; callbacks read from this ref so they
  // always see the latest props without the responder being torn down and
  // recreated mid-gesture.
  const latest = useRef({ onMarkWatched, isMarking, markDisabled, onSwipeLockChange });
  latest.current = { onMarkWatched, isMarking, markDisabled, onSwipeLockChange };

  // Locked once per gesture and never reconsidered afterward — this is what
  // stops "dy grows a bit mid-swipe" from cancelling an already-recognized
  // horizontal drag, and equally stops "dx recovers a bit mid-scroll" from
  // yanking responder-ship away from an already-conceded vertical scroll.
  const direction = useRef<GestureDirection>('undetermined');

  const resetPosition = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      // Only ever claim based on movement, never on bare touch-down — a
      // plain tap must still fall through to the Pressables untouched.
      // This also resets direction for the new gesture.
      onStartShouldSetPanResponder: () => {
        direction.current = 'undetermined';
        return false;
      },
      onMoveShouldSetPanResponder: (_, gesture) => {
        const { isMarking: marking, markDisabled: disabled } = latest.current;
        if (marking || disabled) return false;

        if (direction.current === 'horizontal') return true;
        if (direction.current === 'vertical') return false;

        const absDx = Math.abs(gesture.dx);
        const absDy = Math.abs(gesture.dy);

        if (gesture.dx > HORIZONTAL_ACTIVATION_THRESHOLD && absDx > absDy * HORIZONTAL_DOMINANCE_RATIO) {
          direction.current = 'horizontal';
          return true;
        }

        if (absDy > VERTICAL_FAIL_THRESHOLD && absDy > absDx) {
          direction.current = 'vertical';
          return false;
        }

        return false; // still ambiguous — ask again on the next move sample
      },
      onPanResponderGrant: () => {
        // Only reachable via the 'horizontal' branch above.
        latest.current.onSwipeLockChange?.(true);
      },
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(Math.max(0, Math.min(gesture.dx, SWIPE_REVEAL_DISTANCE)));
      },
      onPanResponderRelease: (_, gesture) => {
        latest.current.onSwipeLockChange?.(false);
        const dx = Math.max(0, Math.min(gesture.dx, SWIPE_REVEAL_DISTANCE));
        if (dx >= SWIPE_COMMIT_THRESHOLD) {
          Animated.spring(translateX, { toValue: SWIPE_REVEAL_DISTANCE, useNativeDriver: true, bounciness: 0 }).start();
          latest.current.onMarkWatched();
        } else {
          resetPosition();
        }
      },
      onPanResponderTerminate: () => {
        latest.current.onSwipeLockChange?.(false);
        resetPosition();
      },
    }),
  ).current;

  // Once the mutation this swipe triggered settles (success or error), snap
  // the card back — on error it lands back at rest with the row untouched;
  // on success the row is about to disappear from the refetched list anyway.
  const wasMarking = useRef(isMarking);
  useEffect(() => {
    if (wasMarking.current && !isMarking) {
      resetPosition();
    }
    wasMarking.current = isMarking;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMarking]);

  const checkOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_COMMIT_THRESHOLD],
    outputRange: [0.25, 1],
    extrapolate: 'clamp',
  });
  const checkScale = translateX.interpolate({
    inputRange: [0, SWIPE_COMMIT_THRESHOLD],
    outputRange: [0.8, 1.15],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.swipeBackground} pointerEvents="none">
        <Animated.Text style={[styles.swipeGlyph, { opacity: checkOpacity, transform: [{ scale: checkScale }] }]}>
          ✓
        </Animated.Text>
      </View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.pressed, isWatched && styles.cardWatched]}
          onPress={onPress}
        >
          <PosterImage uri={imageUrl} width={THUMB_SIZE} height={THUMB_SIZE} radius={radii.md} title={seriesTitle} />

          <View style={styles.content}>
            <View style={styles.pillRow}>
              <View style={styles.pill}>
                <Text style={styles.pillText} numberOfLines={1}>
                  {seriesTitle}
                </Text>
              </View>
              {isWatched ? (
                <View style={styles.watchedBadge}>
                  <Text style={styles.watchedBadgeText}>Watched</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.episodeCodeRow}>
              <Text style={styles.episodeCode}>{`S${seasonNumber}E${episodeNumber}`}</Text>
              {remainingIndicator ? (
                <Text style={styles.remainingIndicator} numberOfLines={1}>
                  {remainingIndicator.text}
                </Text>
              ) : null}
            </View>
            {episodeTitle ? (
              <Text style={styles.episodeTitle} numberOfLines={1}>
                {episodeTitle}
              </Text>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.actionCircle,
              pressed && styles.actionPressed,
              isWatched && styles.actionCircleWatched,
            ]}
            onPress={onMarkWatched}
            disabled={isMarking || markDisabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isWatched ? 'Episode watched' : 'Mark episode as watched'}
          >
            {isMarking ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={[styles.actionGlyph, isWatched && styles.actionGlyphWatched]}>✓</Text>
            )}
          </Pressable>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// The two distinct "nothing left to watch right now" outcomes a mark-watched
// can produce — see HomeScreen's post-watch reconciliation. Never collapsed
// into one ambiguous label: a still-airing show reading "no more episodes"
// would wrongly imply it had ended.
export type WatchNextCompletionOutcome = 'CAUGHT_UP' | 'COMPLETED';

interface CaughtUpCardProps {
  seriesTitle: string;
  imageUrl: string | null;
  outcome: WatchNextCompletionOutcome;
  onPress: () => void;
}

const COMPLETION_COPY: Record<WatchNextCompletionOutcome, { badge: string; body: string }> = {
  CAUGHT_UP: { badge: 'Caught up', body: "You're all caught up" },
  COMPLETED: { badge: 'Completed', body: 'Series completed' },
};

// Rendered in a Watch Next slot for the brief success window after a
// mark-watched leaves the series with no next episode (see HomeScreen's
// completionState + scheduled removal) — a few hundred ms of this subtle
// success treatment (green badge/check, same footprint as WatchNextCard),
// then the slot is removed from the list entirely. Never a permanent
// placeholder: unlike an earlier version of this component, staying in
// this state indefinitely was the bug (the item only ever disappeared on a
// manual refresh) — see the fix's investigation notes.
export function CaughtUpCard({ seriesTitle, imageUrl, outcome, onPress }: CaughtUpCardProps) {
  const copy = COMPLETION_COPY[outcome];
  return (
    <View style={styles.swipeContainer}>
      <Pressable style={({ pressed }) => [styles.card, styles.cardWatched, pressed && styles.pressed]} onPress={onPress}>
        <PosterImage uri={imageUrl} width={THUMB_SIZE} height={THUMB_SIZE} radius={radii.md} title={seriesTitle} />

        <View style={styles.content}>
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText} numberOfLines={1}>
                {seriesTitle}
              </Text>
            </View>
            <View style={styles.watchedBadge}>
              <Text style={styles.watchedBadgeText}>{copy.badge}</Text>
            </View>
          </View>
          <Text style={styles.episodeTitle}>{copy.body}</Text>
        </View>

        <View style={[styles.actionCircle, styles.actionCircleWatched]}>
          <Text style={[styles.actionGlyph, styles.actionGlyphWatched]}>✓</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  swipeBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.success,
    justifyContent: 'center',
    paddingLeft: spacing.lg,
  },
  swipeGlyph: { fontSize: 20, fontWeight: '700', color: '#0A0A0D' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CARD_HEIGHT,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
  },
  pressed: { opacity: 0.75 },
  cardWatched: { opacity: 0.55 },
  content: { flex: 1, gap: 3, justifyContent: 'center' },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  pillText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  watchedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  watchedBadgeText: { fontSize: 11, fontWeight: '700', color: '#0A0A0D' },
  episodeCodeRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  episodeCode: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  // Deliberately smaller/lighter than episodeCode and not a pill/badge —
  // see WatchNextCard's remaining-episodes indicator spec. writingDirection
  // is an iOS-only hint; the real cross-platform bidi safety comes from the
  // LRI/PDI isolate marks already embedded in the text itself (see
  // getRemainingEpisodesIndicator) — this is defense in depth, not the fix.
  remainingIndicator: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, writingDirection: 'ltr' },
  episodeTitle: { fontSize: 13, color: colors.textSecondary },
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
  actionGlyph: { fontSize: 16, fontWeight: '700', color: colors.accent },
  actionGlyphWatched: { color: '#0A0A0D' },
});
