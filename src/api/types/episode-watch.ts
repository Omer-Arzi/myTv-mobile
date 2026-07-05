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
