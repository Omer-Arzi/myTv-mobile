import { UserSeriesStatus } from './common';
import { SeriesSummary } from './series';

// Mirrors server/src/modules/watchlist/dto/watchlist-item.dto.ts — the
// response of GET /watchlist.
export interface WatchlistItem {
  id: string;
  addedAt: string;
  series: SeriesSummary;
  userStatus: UserSeriesStatus;
}
