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
  // Overrides the success overlay's resolved label (see below) with the
  // terminal outcome copy — Caught up / Completed — for the brief window
  // between a mark-watched that leaves no next episode and the slot's
  // removal. Omitted (the ordinary "advance to a real next episode" case)
  // falls back to the default "Watched" label.
  successOutcome?: WatchNextCompletionOutcome;
}

// The two distinct "nothing left to watch right now" outcomes a mark-watched
// can produce — see HomeScreen's post-watch reconciliation. Never collapsed
// into one ambiguous label: a still-airing show reading "no more episodes"
// would wrongly imply it had ended.
export type WatchNextCompletionOutcome = 'CAUGHT_UP' | 'COMPLETED';

const COMPLETION_COPY: Record<WatchNextCompletionOutcome, { badge: string; body: string }> = {
  CAUGHT_UP: { badge: 'Caught up', body: "You're all caught up" },
  COMPLETED: { badge: 'Completed', body: 'Series completed' },
};

const CARD_HEIGHT = 92;
const THUMB_SIZE = 76;
const ACTION_SIZE = 40;

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - spacing.lg * 2;

// Commit gesture, not a full-track drag: crossing this fraction of the
// card's own width is enough to commit — roughly 35-45% of card width, not
// "almost to the edge." Once dx reaches this, commit() fires mid-drag (see
// onPanResponderMove below), not only on release — the whole point of a
// commit gesture is that the user doesn't have to keep dragging once it's
// locked in.
const SWIPE_COMMIT_THRESHOLD_RATIO = 0.4;
const SWIPE_COMMIT_THRESHOLD = CARD_WIDTH * SWIPE_COMMIT_THRESHOLD_RATIO;

// A second, independent way to commit: a short but fast flick. Distance
// alone would either force raising SWIPE_COMMIT_THRESHOLD (defeating the
// ~35-45% target) or accepting slow, accidental drags at a low threshold —
// velocity is what actually tells "flicked it" apart from "bumped it."
// FAST_SWIPE_MIN_DISTANCE still requires a real horizontal drag (well past
// the direction-lock activation floor below), just nowhere near
// SWIPE_COMMIT_THRESHOLD's full distance.
const FAST_SWIPE_MIN_DISTANCE = 28;
const FAST_SWIPE_VELOCITY_THRESHOLD = 0.5; // px/ms, PanResponder gestureState.vx units

// Pure and exported so the actual commit decision is unit-testable without
// simulating PanResponder's raw touch/gestureState machinery — this
// codebase has no established way to do that reliably in RTL (see
// WatchNextCard.test.tsx's "swipe commit decision" block, which exercises
// this function directly instead of a real gesture). Used identically by
// onPanResponderMove (mid-drag) and onPanResponderRelease (a safety net for
// a slow drag whose move events skipped the exact threshold-crossing frame).
export function shouldCommitSwipe(dx: number, vx: number): boolean {
  if (dx >= SWIPE_COMMIT_THRESHOLD) return true;
  return dx >= FAST_SWIPE_MIN_DISTANCE && vx >= FAST_SWIPE_VELOCITY_THRESHOLD;
}

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
// right, growing more opaque/prominent the further it travels. This is a
// commit gesture, not a full-track drag — crossing SWIPE_COMMIT_THRESHOLD
// (~35-45% of card width) OR a short, fast flick (see FAST_SWIPE_* above)
// commits immediately, mid-drag, without waiting for release: the card
// snaps back to rest and a full-card green success overlay (spinner, then a
// checkmark once the mutation resolves) fades in on top, covering both the
// thumbnail and text — see successOverlayOpacity below. Release before
// committing always springs back to rest with no mutation call. No gesture
// library is installed, so this uses core RN PanResponder/Animated rather
// than reanimated/gesture-handler — see GestureDirection below for how it
// stays stable against a parent ScrollView on a diagonal drag despite that.
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
  successOutcome,
  onSwipeLockChange,
}: Props) {
  const remainingIndicator = getRemainingEpisodesIndicator(remainingEpisodesAfterNext, releaseStatus);
  const translateX = useRef(new Animated.Value(0)).current;
  // Full-card success overlay's own opacity — independent of translateX, see
  // the isActiveSuccess effect below for what drives it.
  const successOverlayOpacity = useRef(new Animated.Value(0)).current;

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
  // Set the instant this gesture commits (distance or fast-flick) and never
  // reconsidered afterward — this is what makes "additional finger movement
  // isn't necessary once committed" true: onPanResponderMove stops updating
  // translateX, and onPanResponderRelease/Terminate know not to re-evaluate
  // or undo a decision already made mid-drag. Reset per-gesture alongside
  // direction.
  const hasCommitted = useRef(false);

  const resetPosition = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  };

  // The one place a swipe-triggered commit happens, called from either
  // onPanResponderMove (the common case — mid-drag, before release) or
  // onPanResponderRelease (a safety net for a long slow drag whose move
  // events happened to skip over the exact threshold-crossing frame). Snaps
  // the card back to rest immediately — the green success overlay (driven
  // by the isActiveSuccess effect below, via isMarking turning true from
  // this same onMarkWatched call) takes over from here, so there is nowhere
  // left for the card to visually travel to.
  const commit = () => {
    hasCommitted.current = true;
    resetPosition();
    latest.current.onMarkWatched();
  };

  const panResponder = useRef(
    PanResponder.create({
      // Only ever claim based on movement, never on bare touch-down — a
      // plain tap must still fall through to the Pressables untouched.
      // This also resets direction/commit state for the new gesture.
      onStartShouldSetPanResponder: () => {
        direction.current = 'undetermined';
        hasCommitted.current = false;
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
        if (hasCommitted.current) return; // the commit animation owns translateX now

        const dx = Math.max(0, gesture.dx);
        translateX.setValue(Math.min(dx, SWIPE_COMMIT_THRESHOLD));

        if (shouldCommitSwipe(dx, gesture.vx)) commit();
      },
      onPanResponderRelease: (_, gesture) => {
        latest.current.onSwipeLockChange?.(false);
        if (hasCommitted.current) return; // already handled mid-drag

        const dx = Math.max(0, gesture.dx);
        if (shouldCommitSwipe(dx, gesture.vx)) {
          commit();
        } else {
          resetPosition();
        }
      },
      onPanResponderTerminate: () => {
        latest.current.onSwipeLockChange?.(false);
        if (!hasCommitted.current) resetPosition();
      },
    }),
  ).current;

  // Drives the full-card green success overlay: fades in the instant either
  // a mutation starts (isMarking, from a swipe commit OR a plain tap on the
  // check circle — one shared visual for both trigger paths) or has just
  // succeeded (isWatched), and fades back out the instant both go false
  // again — which happens in exactly two cases: a failed mutation (rolls
  // back to the untouched card, see onError in HomeScreen) or, for the
  // "advance to a real next episode" case, the instant HomeScreen swaps
  // this slot's content after its own post-watch hold — at which point the
  // overlay fades away to reveal the NEW episode's content, already sitting
  // underneath it, unseen, the whole time. That's the entire "same-slot
  // replacement" trick: no second animated value or list diffing needed,
  // just one opacity fading out over content that already changed while
  // hidden. (The "series is now caught up, remove the slot" case never
  // reaches this fade-out branch — the component unmounts instead, see
  // HomeScreen's removeWatchNextSlot — so the overlay just stays fully
  // green, undisturbed, right up until the whole row collapses/exits.)
  const isActiveSuccess = isMarking || isWatched;
  const wasActiveSuccess = useRef(isActiveSuccess);
  useEffect(() => {
    if (isActiveSuccess !== wasActiveSuccess.current) {
      Animated.timing(successOverlayOpacity, {
        toValue: isActiveSuccess ? 1 : 0,
        duration: isActiveSuccess ? 200 : 380,
        useNativeDriver: true,
      }).start();
    }
    wasActiveSuccess.current = isActiveSuccess;
  }, [isActiveSuccess, successOverlayOpacity]);

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

  // Pending: neutral copy, same regardless of outcome (the outcome isn't
  // known yet). Resolved: the terminal outcome copy if this mark-watched
  // left no next episode (successOutcome), else the ordinary "Watched".
  const overlayLabel = isMarking ? 'Marking watched…' : successOutcome ? COMPLETION_COPY[successOutcome].badge : 'Watched';

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
          // Guarded by hasCommitted, not just onPanResponderRelease's own
          // control flow: on web, react-native-web's Pressable can still
          // observe a native DOM click synthesized from the same
          // mousedown/mouseup pair a commit just fired from, independently
          // of PanResponder's own gesture negotiation — without this guard,
          // a committed swipe could also navigate into the series a beat
          // later. hasCommitted only ever resets at the start of the NEXT
          // gesture, so a genuine subsequent tap is completely unaffected.
          onPress={() => {
            if (hasCommitted.current) return;
            onPress();
          }}
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

      {/* Full-card success overlay — see the isActiveSuccess effect above.
          pointerEvents="none": the check circle/card Pressables above already
          disable themselves via isMarking/markDisabled, this just guarantees
          no stray touch reaches anything while it's visible. */}
      <Animated.View pointerEvents="none" style={[styles.successOverlay, { opacity: successOverlayOpacity }]}>
        {isMarking ? (
          <ActivityIndicator size="small" color="#0A0A0D" />
        ) : (
          <Text style={styles.successGlyph}>✓</Text>
        )}
        <Text style={styles.successLabel}>{overlayLabel}</Text>
      </Animated.View>
    </View>
  );
}

interface CaughtUpCardProps {
  seriesTitle: string;
  imageUrl: string | null;
  outcome: WatchNextCompletionOutcome;
  onPress: () => void;
}

// A static, permanently-caught-up/completed row — same footprint/copy as
// WatchNextCard's own success overlay (see COMPLETION_COPY), but with no
// swipe/mark-watched affordance. Not currently wired into HomeScreen's Watch
// Next flow (WatchNextCard's own successOutcome-aware overlay now owns that
// brief post-watch window end to end, so the slot never has to swap
// component types mid-transition — see that component's doc comment).
// Kept as an independent, exported, unit-tested component for any screen
// that wants a plain "already caught up" row with no gesture involved.
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
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  successGlyph: { fontSize: 20, fontWeight: '700', color: '#0A0A0D' },
  successLabel: { fontSize: 15, fontWeight: '700', color: '#0A0A0D' },
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
