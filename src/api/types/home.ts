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
  // How many known catalog episodes come after nextEpisode (nextEpisode
  // itself not counted). Null when the server couldn't reliably determine
  // catalog position — render nothing, never assume 0. See
  // src/utils/remainingEpisodesIndicator.ts for the display rule.
  remainingEpisodesAfterNext: number | null;
}

// Mirrors server/src/modules/me/dto/stale-series-item.dto.ts
export interface StaleSeriesItem {
  series: SeriesSummary;
  lastWatchedAt: string | null;
  nextEpisode: EpisodeSummary | null;
  userStatus: UserSeriesStatus;
}

// Mirrors server/src/modules/me/dto/haven-started-yet-item.dto.ts — a
// derived Home section, not a persistent status: WATCHLIST, zero watched
// episodes, at least one released regular (season > 0) episode, and a
// confirmed provider mapping. Sorted newest-released-first by the server.
export interface HavenStartedYetItem {
  series: SeriesSummary;
  latestReleasedRegularEpisode: EpisodeSummary;
  releasedRegularEpisodeCount: number;
}

// Mirrors server/src/modules/home/dto/home-response.dto.ts — the response
// of GET /home.
export interface HomeResponse {
  recentlyWatched: RecentlyWatchedItem[];
  watchNext: WatchNextItem[];
  staleSeries: StaleSeriesItem[];
  haventStartedYet: HavenStartedYetItem[];
}
