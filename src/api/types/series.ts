import { ReleaseStatus, UserSeriesStatus } from './common';
import { EpisodeSummary } from './episode';

// Mirrors server/src/common/dto/series-summary.dto.ts
export interface SeriesSummary {
  id: string;
  title: string;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseStatus: ReleaseStatus;
}

// Mirrors server/src/modules/series/dto/series-card.dto.ts — a
// SeriesSummary plus this user's personal status, used by GET /series and
// GET /watchlist.
export interface SeriesCard extends SeriesSummary {
  userStatus: UserSeriesStatus;
}

// Mirrors server/src/modules/series/dto/episode-detail.dto.ts
export interface EpisodeDetail extends EpisodeSummary {
  watched: boolean;
  watchedAt: string | null;
  note: string | null;
  episodeWatchId: string | null;
}

// Mirrors server/src/modules/series/dto/season-detail.dto.ts
export interface SeasonDetail {
  seasonNumber: number;
  title: string | null;
  episodes: EpisodeDetail[];
}

// Mirrors server/src/modules/series/dto/series-external-ids.dto.ts
export interface SeriesExternalIds {
  tmdbId: string | null;
  traktId: string | null;
  imdbId: string | null;
}

// Mirrors server/src/modules/series/dto/series-detail.dto.ts — the
// response of GET /series/:id.
export interface SeriesDetail {
  id: string;
  title: string;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseStatus: ReleaseStatus;
  userStatus: UserSeriesStatus;
  nextEpisode: EpisodeSummary | null;
  seasons: SeasonDetail[];
  externalIds: SeriesExternalIds | null;
}

// Mirrors server/src/modules/series/dto/series-list-page.dto.ts — the
// response of GET /series.
export interface SeriesListPage {
  items: SeriesCard[];
  nextCursor: string | null;
}
