import { apiClient } from '../client';
import { SearchResultsPage, WatchlistItem } from '../types';

export function search(query: string, cursor: string | null): Promise<SearchResultsPage> {
  const params = new URLSearchParams({ q: query });
  if (cursor) params.set('cursor', cursor);
  return apiClient.get<SearchResultsPage>(`/search?${params.toString()}`);
}

// Only the provider identity is sent — the server re-fetches title/poster/
// overview/releaseStatus fresh rather than trusting the (possibly stale)
// search response. Returns a WatchlistItem, same shape POST
// /series/:id/watchlist returns, since this is exactly that action for a
// series that may not have existed locally until this call.
export function addSearchResult(provider: 'tmdb' | 'tvmaze', providerId: string): Promise<WatchlistItem> {
  return apiClient.post<WatchlistItem>('/search/add', { provider, providerId });
}
