// Watch Next / Continue Watching "+N" remaining-episodes indicator (TV
// Time-style). Pure — no React, no RN — so the text/format decision is
// testable independent of rendering.

import { ReleaseStatus } from '../api/types/common';

// "Final episode" claims the SHOW itself is over, not just that nothing
// else is queued locally — only true once the provider confirms it (ENDED/
// CANCELLED). A show still RETURNING/IN_PRODUCTION (or not yet confirmed
// either way, UNKNOWN) may simply not have its next episode released yet;
// "Latest episode" makes that distinction instead of overclaiming the
// series is finished.
const FINISHED_RELEASE_STATUSES: ReleaseStatus[] = ['ENDED', 'CANCELLED'];

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
//
// releaseStatus decides the wording for the "nothing queued after this"
// case: "Final episode" only when the show is confirmed over (ENDED/
// CANCELLED); "Latest episode" for a still-releasing (or not-yet-confirmed)
// show, since more episodes may simply not be out yet. Defaults to 'UNKNOWN'
// (the conservative, non-finished reading) when omitted.
export function getRemainingEpisodesIndicator(
  remainingEpisodesAfterNext: number | null | undefined,
  releaseStatus: ReleaseStatus = 'UNKNOWN',
): RemainingEpisodesIndicator | null {
  if (remainingEpisodesAfterNext === null || remainingEpisodesAfterNext === undefined) return null;
  if (remainingEpisodesAfterNext === 0) {
    const isFinalEpisode = FINISHED_RELEASE_STATUSES.includes(releaseStatus);
    return { text: isFinalEpisode ? 'Final episode' : 'Latest episode', isFinalEpisode };
  }
  return { text: wrapBidiIsolatedLtr(`+${remainingEpisodesAfterNext}`), isFinalEpisode: false };
}
