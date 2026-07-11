import { apiClient } from '../client';
import { ManualUserStatus, ReleaseStatus, SeriesDetail, SeriesListPage, UserSeriesStatus, WatchAllRequest, WatchAllResponse } from '../types';

export function getSeriesDetail(seriesId: string): Promise<SeriesDetail> {
  return apiClient.get<SeriesDetail>(`/series/${encodeURIComponent(seriesId)}`);
}

export interface ListSeriesParams {
  status?: UserSeriesStatus;
  releaseStatus?: ReleaseStatus;
  q?: string;
  limit?: number;
  cursor?: string;
}

export function listSeries(params: ListSeriesParams = {}): Promise<SeriesListPage> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.releaseStatus) query.set('releaseStatus', params.releaseStatus);
  if (params.q) query.set('q', params.q);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.cursor) query.set('cursor', params.cursor);

  const qs = query.toString();
  return apiClient.get<SeriesListPage>(`/series${qs ? `?${qs}` : ''}`);
}

// Called from SeriesDetailScreen's status-actions menu (see
// src/utils/seriesStatusActions.ts) — Put on hold / Drop series / Resume
// watching all go through this. For a resume request (userStatus:
// 'WATCHING'), the backend derives the real resulting status — this may
// come back as CAUGHT_UP or COMPLETED, not necessarily WATCHING (see
// server/docs/on-hold-dropped-status-todo.md Phase 4).
export interface UpdateSeriesStatusResponse {
  seriesId: string;
  userStatus: UserSeriesStatus;
  nextEpisode: SeriesDetail['nextEpisode'];
}

export function updateSeriesStatus(seriesId: string, userStatus: ManualUserStatus): Promise<UpdateSeriesStatusResponse> {
  return apiClient.patch<UpdateSeriesStatusResponse>(`/series/${encodeURIComponent(seriesId)}/status`, { userStatus });
}

export function watchSeriesAllReleased(seriesId: string, body: WatchAllRequest = {}): Promise<WatchAllResponse> {
  return apiClient.post<WatchAllResponse>(`/series/${encodeURIComponent(seriesId)}/watch-all-released`, body);
}
