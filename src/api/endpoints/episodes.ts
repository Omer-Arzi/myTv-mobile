import { apiClient } from '../client';
import { MarkWatchedResponse } from '../types';

export function markEpisodeWatched(episodeId: string): Promise<MarkWatchedResponse> {
  return apiClient.post<MarkWatchedResponse>(`/episodes/${encodeURIComponent(episodeId)}/watch`);
}
