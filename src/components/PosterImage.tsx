import { useEffect, useState } from 'react';
import { DimensionValue, Image, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../theme/theme';

interface Props {
  uri: string | null;
  width: DimensionValue;
  height: number;
  radius?: number;
  // Series/show title, when known — used to render initials on the
  // placeholder ("The Great Voyage" -> "TG") instead of a generic icon.
  // Omit for contexts with no strong series identity to show (e.g. a bare
  // episode still with no series in scope).
  title?: string | null;
}

function getInitials(title: string): string {
  const words = title.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// The one place a remote poster/backdrop/still image gets rendered —
// handles both "no URL yet" (common for un-enriched series) and a URL that
// fails to load (dead link, transient network error) with the same
// placeholder, rather than every card inventing its own broken-image look.
// Width/height are always caller-supplied and fixed, so a missing/failed
// image never changes layout — this only ever swaps what renders *inside*
// that fixed box.
export function PosterImage({ uri, width, height, radius = radii.md, title }: Props) {
  const [failed, setFailed] = useState(false);

  // A url that previously failed might succeed on a later render (e.g. a
  // refetch resolves a broken link) — don't get stuck showing the
  // placeholder forever for the same mounted instance.
  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const box = { width, height, borderRadius: radius };

  if (!uri || failed) {
    // width may be a percentage string (the full-bleed backdrop) — the
    // constraining dimension for badge sizing is whichever one is numeric.
    const minDimension = Math.min(typeof width === 'number' ? width : height, height);
    const badgeSize = Math.min(Math.max(minDimension * 0.5, 24), 96);
    const initials = title ? getInitials(title) : '';

    return (
      <View style={[styles.placeholder, box]}>
        <View style={styles.sheen} />
        <View
          style={[
            styles.badge,
            { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 },
          ]}
        >
          {initials ? (
            <Text style={[styles.initials, { fontSize: badgeSize * 0.4 }]} numberOfLines={1}>
              {initials}
            </Text>
          ) : (
            <Text style={[styles.glyph, { fontSize: badgeSize * 0.5 }]}>📺</Text>
          )}
        </View>
      </View>
    );
  }

  return <Image source={{ uri }} style={[styles.image, box]} resizeMode="cover" onError={() => setFailed(true)} />;
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surfaceElevated },
  placeholder: {
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // A faint top sheen instead of a flat fill — the closest approximation of
  // a "gradient card" without pulling in a gradient library (would need a
  // native rebuild, which isn't warranted for a placeholder tile).
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  initials: { fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 },
  glyph: { opacity: 0.6 },
});
