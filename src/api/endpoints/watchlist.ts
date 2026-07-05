import { apiClient } from '../client';
import { WatchlistItem } from '../types';

export function getWatchlist(): Promise<WatchlistItem[]> {
  return apiClient.get<WatchlistItem[]>('/watchlist');
}
