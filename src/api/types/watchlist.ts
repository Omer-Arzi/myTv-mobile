import { UserSeriesStatus } from './common';
import { SeriesSummary } from './series';

// Mirrors server/src/modules/watchlist/dto/watchlist-item.dto.ts — the
// response of GET /watchlist. Only ever WATCHING/CAUGHT_UP/WATCHLIST, and
// only WATCHING/CAUGHT_UP series with a confirmed provider match — this
// was previously used to power the Watch List tab's trust-filtered view;
// as of the 2026-08 tab restructure (mobile/docs/tab-restructure-todo.md)
// that tab now sources from GET /series instead (unfiltered by trust,
// filterable by any status), so GET /watchlist has no mobile consumer
// left — this type is still used for POST /series/:id/watchlist and
// POST /search/add's response shape. Already sorted alphabetically by
// series.title.
export interface WatchlistItem {
  id: string;
  series: SeriesSummary;
  userStatus: UserSeriesStatus;
  // Set (to the same reasonCode GET /needs-attention uses) when this series
  // is confirmed but on the known episode-numbering/season-shift risk list.
  // Null for every other item. Drives a small warning indicator — reuses
  // the same classification the Needs Attention inbox does, never a second one.
  attentionReasonCode: string | null;
}
