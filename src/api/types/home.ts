import { UserSeriesStatus } from './common';
import { EpisodeSummary } from './episode';
import { SeriesSummary } from './series';

// Mirrors server/src/modules/me/dto/recently-watched-item.dto.ts
export interface RecentlyWatchedItem {
  watchId: string;
  watchedAt: string;
  note: string | null;
  series: SeriesSummary;
  episode: EpisodeSummary;
}

export interface RecentlyWatchedPage {
  items: RecentlyWatchedItem[];
  nextCursor: string | null;
}

// Mirrors server/src/modules/me/dto/watch-next-item.dto.ts
export interface WatchNextItem {
  series: SeriesSummary;
  nextEpisode: EpisodeSummary;
  lastWatchedAt: string | null;
  userStatus: UserSeriesStatus;
}

// Mirrors server/src/modules/me/dto/stale-series-item.dto.ts
export interface StaleSeriesItem {
  series: SeriesSummary;
  lastWatchedAt: string | null;
  nextEpisode: EpisodeSummary | null;
  userStatus: UserSeriesStatus;
}

// Mirrors server/src/modules/home/dto/home-response.dto.ts — the response
// of GET /home.
export interface HomeResponse {
  recentlyWatched: RecentlyWatchedItem[];
  watchNext: WatchNextItem[];
  staleSeries: StaleSeriesItem[];
}
