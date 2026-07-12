import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../theme/theme';

// No skeleton/loading-placeholder pattern existed anywhere in this app
// before this feature (LoadingState is a full-screen spinner) — this is a
// new pattern, matching SearchResultCard's own poster+title+context+action
// silhouette so the transition into real results doesn't jump.
export function SearchResultSkeleton() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.row, { opacity }]} accessibilityElementsHidden accessibilityLabel="Loading results">
      <View style={styles.poster} />
      <View style={styles.text}>
        <View style={styles.titleLine} />
        <View style={styles.contextLine} />
      </View>
    </Animated.View>
  );
}

export function SearchResultSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View accessibilityLabel="Loading results">
      {Array.from({ length: count }, (_, i) => (
        <SearchResultSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  poster: { width: 56, height: 84, borderRadius: radii.md, backgroundColor: colors.surfaceElevated },
  text: { flex: 1, gap: spacing.sm },
  titleLine: { height: 16, width: '70%', borderRadius: radii.sm, backgroundColor: colors.surfaceElevated },
  contextLine: { height: 13, width: '45%', borderRadius: radii.sm, backgroundColor: colors.surfaceElevated },
});
