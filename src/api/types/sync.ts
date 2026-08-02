// Mirrors server/src/modules/sync/dto/library-refresh-job.dto.ts.
export type LibraryRefreshJobStatus = 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

export interface LibraryRefreshJob {
  id: string;
  status: LibraryRefreshJobStatus;
  startedAt: string;
  finishedAt: string | null;
  totalSeries: number;
  checkedSeries: number;
  seriesWithNewEpisodes: number;
  seriesWithNewSeasons: number;
  seriesFailed: number;
  seriesManualReview: number;
  seriesActivatedLocally: number;
  // User-safe message only — never the raw provider/SQL error.
  lastError: string | null;
}

// Mirrors server/src/modules/sync/dto/library-refresh-job.dto.ts's
// LibraryRefreshStatusDto — the response of GET /sync/library/status.
export interface LibraryRefreshStatus {
  latestJob: LibraryRefreshJob | null;
  automaticUpdatesEnabled: boolean;
  lastAutomaticCheckAt: string | null;
  lastLocalActivationAt: string | null;
}
