import { UserSeriesStatus } from './common';
import { SeriesSummary } from './series';

// Mirrors server/src/modules/watchlist/dto/watchlist-item.dto.ts — the
// response of GET /watchlist. Only ever WATCHING/CAUGHT_UP/WATCHLIST, and
// only WATCHING/CAUGHT_UP series with a confirmed provider match — the tab
// represents the user's active, TRUSTWORTHY tracking list, not every row
// that happens to carry an active-looking status label (see
// utils/groupWatchlistItems.ts for how the client groups these into
// sections). Already sorted alphabetically by series.title.
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
