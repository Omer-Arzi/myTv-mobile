import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { PosterImage } from './PosterImage';
import { colors, radii, spacing } from '../theme/theme';

interface Props {
  seriesTitle: string;
  imageUrl: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  onPress: () => void;
  onMarkWatched: () => void;
  isMarking?: boolean;
  markDisabled?: boolean;
}

const CARD_HEIGHT = 92;
const THUMB_SIZE = 76;
const ACTION_SIZE = 40;

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - spacing.lg * 2;

// Three separate, deliberately distinct concepts — collapsing them into one
// or two knobs is what made the previous version commit on a light flick:
//
// 1. How much horizontal finger movement before this is even recognized as
//    a swipe (below this, taps and vertical list scrolling pass straight
//    through to the Pressable/ScrollView untouched).
const SWIPE_ACTIVATION_THRESHOLD = 8;
// 2. How far the card can visually travel — generous, so there's room for
//    a real "drag it most of the way off" gesture like TV Time's, not a
//    twitch.
const SWIPE_REVEAL_DISTANCE = Math.min(CARD_WIDTH * 0.8, 260);
// 3. Fraction of SWIPE_REVEAL_DISTANCE the drag must cross before release
//    commits to marking watched. High on purpose: a small or medium swipe
//    should only ever peek the affordance and spring back, never fire the
//    mutation. At this ratio that's ~180-210px on typical iPhone widths,
//    matching the "almost to the end" feel this is modeling.
const SWIPE_COMMIT_THRESHOLD_RATIO = 0.75;
const SWIPE_COMMIT_THRESHOLD = SWIPE_REVEAL_DISTANCE * SWIPE_COMMIT_THRESHOLD_RATIO;

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
// PanResponder/Animated rather than reanimated/gesture-handler.
export function WatchNextCard({
  seriesTitle,
  imageUrl,
  seasonNumber,
  episodeNumber,
  episodeTitle,
  onPress,
  onMarkWatched,
  isMarking = false,
  markDisabled = false,
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;

  // PanResponder is created once; callbacks read from this ref so they
  // always see the latest props without the responder being torn down and
  // recreated mid-gesture.
  const latest = useRef({ onMarkWatched, isMarking, markDisabled });
  latest.current = { onMarkWatched, isMarking, markDisabled };

  const resetPosition = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        const { isMarking: marking, markDisabled: disabled } = latest.current;
        if (marking || disabled) return false;
        return gesture.dx > SWIPE_ACTIVATION_THRESHOLD && Math.abs(gesture.dx) > Math.abs(gesture.dy);
      },
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(Math.max(0, Math.min(gesture.dx, SWIPE_REVEAL_DISTANCE)));
      },
      onPanResponderRelease: (_, gesture) => {
        const dx = Math.max(0, Math.min(gesture.dx, SWIPE_REVEAL_DISTANCE));
        if (dx >= SWIPE_COMMIT_THRESHOLD) {
          Animated.spring(translateX, { toValue: SWIPE_REVEAL_DISTANCE, useNativeDriver: true, bounciness: 0 }).start();
          latest.current.onMarkWatched();
        } else {
          resetPosition();
        }
      },
      onPanResponderTerminate: resetPosition,
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
        <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
          <PosterImage uri={imageUrl} width={THUMB_SIZE} height={THUMB_SIZE} radius={radii.md} title={seriesTitle} />

          <View style={styles.content}>
            <View style={styles.pill}>
              <Text style={styles.pillText} numberOfLines={1}>
                {seriesTitle}
              </Text>
            </View>
            <Text style={styles.episodeCode}>{`S${seasonNumber}E${episodeNumber}`}</Text>
            {episodeTitle ? (
              <Text style={styles.episodeTitle} numberOfLines={1}>
                {episodeTitle}
              </Text>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [styles.actionCircle, pressed && styles.actionPressed]}
            onPress={onMarkWatched}
            disabled={isMarking || markDisabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Mark episode as watched"
          >
            {isMarking ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={styles.actionGlyph}>✓</Text>
            )}
          </Pressable>
        </Pressable>
      </Animated.View>
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
  content: { flex: 1, gap: 3, justifyContent: 'center' },
  pill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  pillText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  episodeCode: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  episodeTitle: { fontSize: 13, color: colors.textSecondary },
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
