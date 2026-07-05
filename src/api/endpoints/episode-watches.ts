import { apiClient } from '../client';
import { EpisodeWatch } from '../types';

export function addNote(watchId: string, text: string): Promise<EpisodeWatch> {
  return apiClient.patch<EpisodeWatch>(`/episode-watches/${encodeURIComponent(watchId)}/note`, { text });
}
