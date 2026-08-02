import { apiClient } from '../client';
import { LibraryRefreshJob, LibraryRefreshStatus, UserSeriesStatus } from '../types';

// statuses: omit or pass an empty array to refresh every tracked status
// (the server's original whole-library behavior) — see
// server/src/modules/sync/dto/start-library-refresh-request.dto.ts.
export function startLibraryRefresh(statuses: UserSeriesStatus[] = []): Promise<LibraryRefreshJob> {
  return apiClient.post<LibraryRefreshJob>('/sync/library/refresh', statuses.length > 0 ? { statuses } : {});
}

export function getLibraryRefreshStatus(): Promise<LibraryRefreshStatus> {
  return apiClient.get<LibraryRefreshStatus>('/sync/library/status');
}
