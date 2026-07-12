// Local-only recent-search history — the app's first use of on-device
// persistence (no AsyncStorage/SecureStore/MMKV existed anywhere in this
// codebase before this feature). Stores raw query strings only, not series
// — the simplest model that matches "search-as-you-type": tapping a recent
// entry just re-runs that search. Newest first, deduplicated
// case-insensitively, capped at MAX_RECENT_SEARCHES. No backend
// persistence — this is deliberately a per-device convenience list, not
// account data.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'mytv:recentSearches';
export const MAX_RECENT_SEARCHES = 8;

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === 'string') : [];
  } catch {
    // Corrupt/unreadable storage is never fatal to Search — just behave as
    // if there's no history yet.
    return [];
  }
}

// Newest occurrence wins position — re-searching an existing query moves it
// to the top rather than creating a second entry.
export async function addRecentSearch(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return getRecentSearches();

  const existing = await getRecentSearches();
  const deduped = existing.filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
  const next = [trimmed, ...deduped].slice(0, MAX_RECENT_SEARCHES);

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
