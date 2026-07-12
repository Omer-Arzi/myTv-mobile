import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PosterImage } from './PosterImage';
import { SeriesSearchResult } from '../api/types';
import { searchResultContextLine } from '../utils/searchResultCopy';
import { colors, spacing, typography } from '../theme/theme';

const POSTER_WIDTH = 56;
const POSTER_HEIGHT = 84;
// react-native's documented minimum comfortable tap target, independent of
// the icon glyph's own visual size (kept smaller, centered within this box).
const TRAILING_TAP_TARGET = 44;

export type SearchResultAddState = 'idle' | 'adding';

interface Props {
  result: SeriesSearchResult;
  addState?: SearchResultAddState;
  // Card body tap — navigation only. A no-op for NONE/POSSIBLE results (no
  // Series Detail exists to open yet for either); EXACT always opens.
  onOpenSeries: () => void;
  // Trailing icon taps — the only actions a card ever offers, and only one
  // ever applies per result: REVIEW_SERIES (EXACT + needsAttention),
  // COMPARE_MATCH (POSSIBLE), or ADD_TO_WATCHLIST (NONE).
  onReview: () => void;
  onCompare: () => void;
  onAdd: () => void;
}

// The one reusable search-result row — deliberately NOT SeriesCard (see
// component-philosophy note in the approved UX plan): SeriesCard's whole
// card is a single onPress with no button concept and no "not in library"/
// "possible match" states, none of which fit search's navigation-vs-action
// split. Search is optimized for dense scanning; this card is intentionally
// lighter than SeriesCard — poster, title, one context line, one optional
// icon-only trailing action, nothing else.
export function SearchResultCard({ result, addState = 'idle', onOpenSeries, onReview, onCompare, onAdd }: Props) {
  const isExisting = result.libraryMatch.type === 'EXACT';
  const contextLine = searchResultContextLine(result);

  const children = (
    <>
      <PosterImage uri={result.posterUrl} width={POSTER_WIDTH} height={POSTER_HEIGHT} title={result.title} />
      <View style={styles.text}>
        <Text style={typography.subheading} numberOfLines={2}>
          {result.title}
          {result.year ? <Text style={styles.year}> ({result.year})</Text> : null}
        </Text>
        <Text style={styles.context} numberOfLines={1}>
          {contextLine}
        </Text>
      </View>
      <TrailingAction result={result} addState={addState} onReview={onReview} onCompare={onCompare} onAdd={onAdd} />
    </>
  );

  // A NEW/POSSIBLE result's body does nothing — deliberately a plain View,
  // not a Pressable with onPress left undefined: Pressable is an
  // accessibility container by default regardless of onPress, which would
  // group the title text and the trailing Add/Compare button (a separate,
  // real accessibility stop) into one opaque unit. A plain View has no such
  // grouping, so each child stays independently reachable.
  if (!isExisting) {
    return <View style={styles.row}>{children}</View>;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onOpenSeries}
      accessibilityRole="button"
      accessibilityLabel={`Open ${result.title}`}
    >
      {children}
    </Pressable>
  );
}

function TrailingAction({ result, addState, onReview, onCompare, onAdd }: Pick<Props, 'result' | 'addState' | 'onReview' | 'onCompare' | 'onAdd'>) {
  const match = result.libraryMatch;

  if (match.type === 'EXACT' && match.needsAttention) {
    return (
      <Pressable
        style={({ pressed }) => [styles.iconTarget, pressed && styles.pressed]}
        onPress={onReview}
        accessibilityRole="button"
        accessibilityLabel={`Review ${result.title}`}
        hitSlop={8}
      >
        <Ionicons name="alert-circle-outline" size={22} color={colors.warning} />
      </Pressable>
    );
  }

  if (match.type === 'POSSIBLE') {
    return (
      <Pressable
        style={({ pressed }) => [styles.iconTarget, pressed && styles.pressed]}
        onPress={onCompare}
        accessibilityRole="button"
        accessibilityLabel={`Compare ${result.title}`}
        hitSlop={8}
      >
        <Ionicons name="swap-horizontal-outline" size={22} color={colors.textSecondary} />
      </Pressable>
    );
  }

  if (match.type === 'NONE') {
    if (addState === 'adding') {
      return (
        <View style={styles.iconTarget}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      );
    }
    return (
      <Pressable
        style={({ pressed }) => [styles.iconTarget, pressed && styles.pressed]}
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={`Add ${result.title} to Watchlist`}
        hitSlop={8}
      >
        <Ionicons name="add-circle-outline" size={24} color={colors.accent} />
      </Pressable>
    );
  }

  // EXACT, not needing attention — no trailing action at all. The card
  // already opens on a body tap; there is nothing left to offer.
  return null;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
  year: { ...typography.bodySecondary },
  context: { ...typography.bodySecondary },
  iconTarget: { width: TRAILING_TAP_TARGET, height: TRAILING_TAP_TARGET, alignItems: 'center', justifyContent: 'center' },
});
