import { UserSeriesStatus } from './common';

// Mirrors server/src/modules/episodes/dto/watch-all-request.dto.ts
export interface WatchAllRequest {
  dryRun?: boolean;
  includeUnknownAirDate?: boolean;
  force?: boolean;
}

// Mirrors server/src/modules/episodes/dto/watch-all-response.dto.ts — the
// response of both POST /seasons/:seasonId/watch-all and
// POST /series/:seriesId/watch-all-released.
export interface WatchAllResponse {
  episodesConsidered: number;
  episodesAlreadyWatched: number;
  watchesCreated: number;
  episodesSkippedFuture: number;
  episodesSkippedUnknownAirDate: number;
  previousUserStatus: UserSeriesStatus;
  newUserStatus: UserSeriesStatus;
  previousNextEpisodeId: string | null;
  newNextEpisodeId: string | null;
  dryRun: boolean;
}
