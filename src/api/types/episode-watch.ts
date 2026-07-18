import { UserSeriesStatus } from './common';
import { EpisodeSummary, EpisodeWatch } from './episode';
import { SeriesSummary } from './series';

// Mirrors server/src/modules/episodes/dto/mark-watched-response.dto.ts —
// the response of POST /episodes/:episodeId/watch.
export interface MarkWatchedResponse {
  watch: EpisodeWatch;
  series: SeriesSummary;
  nextEpisode: EpisodeSummary | null;
  // True whenever there was no next episode found (covers both CAUGHT_UP
  // and COMPLETED userStatus) — kept for backward compatibility. Prefer
  // userStatus for the precise CAUGHT_UP-vs-COMPLETED distinction (see
  // HomeScreen's mark-watched handling).
  seriesCompleted: boolean;
  userStatus: UserSeriesStatus;
  // Same field Watch Next items carry (WatchNextItem.remainingEpisodesAfterNext)
  // — included so a Watch Next card can update its "+N" indicator in place
  // from this response alone, without a follow-up request. Null when
  // nextEpisode is null, or when the server couldn't reliably determine it.
  remainingEpisodesAfterNext: number | null;
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
