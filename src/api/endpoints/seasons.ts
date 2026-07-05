import { apiClient } from '../client';
import { WatchAllRequest, WatchAllResponse } from '../types';

export function watchSeasonAll(seasonId: string, body: WatchAllRequest = {}): Promise<WatchAllResponse> {
  return apiClient.post<WatchAllResponse>(`/seasons/${encodeURIComponent(seasonId)}/watch-all`, body);
}
