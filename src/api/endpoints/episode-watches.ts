import { apiClient } from '../client';
import { EpisodeWatch, UnwatchEpisodeResponse } from '../types';

export function addNote(watchId: string, text: string): Promise<EpisodeWatch> {
  return apiClient.patch<EpisodeWatch>(`/episode-watches/${encodeURIComponent(watchId)}/note`, { text });
}

// force=true is required when the watch has a note/rating/emotion attached
// — the backend rejects with 400 otherwise (see SeriesDetailScreen's
// force-required retry flow).
export function unwatchEpisode(watchId: string, options?: { force?: boolean }): Promise<UnwatchEpisodeResponse> {
  const query = options?.force ? '?force=true' : '';
  return apiClient.delete<UnwatchEpisodeResponse>(`/episode-watches/${encodeURIComponent(watchId)}${query}`);
}
