// Watch Next / Continue Watching "+N" remaining-episodes indicator (TV
// Time-style). Pure — no React, no RN — so the text/format decision is
// testable independent of rendering.

// Left-to-Right Isolate (U+2066) / Pop Directional Isolate (U+2069) —
// Unicode bidi control characters. Written as \u escapes rather than the
// literal (invisible) glyphs so they're unambiguous in source/diffs. Forces
// the wrapped fragment to render as an isolated LTR run regardless of the
// surrounding paragraph's bidi direction. Without this, "+87" embedded in
// an RTL context can visually reorder to "87+" — the isolate keeps "+" on
// the left and the digits on the right no matter what.
const LEFT_TO_RIGHT_ISOLATE = '⁦';
const POP_DIRECTIONAL_ISOLATE = '⁩';

function wrapBidiIsolatedLtr(text: string): string {
  return `${LEFT_TO_RIGHT_ISOLATE}${text}${POP_DIRECTIONAL_ISOLATE}`;
}

export interface RemainingEpisodesIndicator {
  text: string;
  isFinalEpisode: boolean;
}

// Decides what (if anything) the Watch Next card's remaining-episodes
// indicator should show, from the server-computed `remainingEpisodesAfterNext`
// (see server/src/modules/me/dto/watch-next-item.dto.ts). Returns null when
// nothing should render — covers "no known next episode" (field is absent/
// undefined on the item) and "could not reliably determine catalog
// position" (field is null) identically: never guess, never show "+0".
export function getRemainingEpisodesIndicator(
  remainingEpisodesAfterNext: number | null | undefined,
): RemainingEpisodesIndicator | null {
  if (remainingEpisodesAfterNext === null || remainingEpisodesAfterNext === undefined) return null;
  if (remainingEpisodesAfterNext === 0) return { text: 'Final episode', isFinalEpisode: true };
  return { text: wrapBidiIsolatedLtr(`+${remainingEpisodesAfterNext}`), isFinalEpisode: false };
}
