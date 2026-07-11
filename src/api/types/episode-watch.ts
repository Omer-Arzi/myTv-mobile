import { UserSeriesStatus } from './common';
import { EpisodeSummary, EpisodeWatch } from './episode';
import { SeriesSummary } from './series';

// Mirrors server/src/modules/episodes/dto/mark-watched-response.dto.ts —
// the response of POST /episodes/:episodeId/watch.
export interface MarkWatchedResponse {
  watch: EpisodeWatch;
  series: SeriesSummary;
  nextEpisode: EpisodeSummary | null;
  seriesCompleted: boolean;
  userStatus: UserSeriesStatus;
}

// Mirrors server/src/modules/episodes/dto/unwatch-episode-response.dto.ts —
// the response of DELETE /episode-watches/:watchId.
export interface UnwatchEpisodeResponse {
  episodeId: string;
  seriesId: string;
  removedWatchId: string;
  previousUserStatus: UserSeriesStatus;
  // Recomputed from remaining watch state — UNLESS previousUserStatus was
  // DROPPED/PAUSED, in which case it's unchanged from previousUserStatus
  // and `warning` explains why.
  newUserStatus: UserSeriesStatus;
  previousNextEpisodeId: string | null;
  newNextEpisodeId: string | null;
  hasRemainingReleasedUnwatched: boolean;
  warning?: string;
}
