import AsyncStorage from '@react-native-async-storage/async-storage';
import { addRecentSearch, clearRecentSearches, getRecentSearches, MAX_RECENT_SEARCHES } from '../recentSearches';

describe('recentSearches', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns an empty list when nothing has been searched yet', async () => {
    expect(await getRecentSearches()).toEqual([]);
  });

  it('adds a query and persists it', async () => {
    await addRecentSearch('naruto');
    expect(await getRecentSearches()).toEqual(['naruto']);
  });

  it('adds newest first', async () => {
    await addRecentSearch('naruto');
    await addRecentSearch('frieren');
    expect(await getRecentSearches()).toEqual(['frieren', 'naruto']);
  });

  it('deduplicates case-insensitively, moving the re-searched query to the top', async () => {
    await addRecentSearch('naruto');
    await addRecentSearch('frieren');
    await addRecentSearch('NARUTO');
    expect(await getRecentSearches()).toEqual(['NARUTO', 'frieren']);
  });

  it(`caps the list at ${MAX_RECENT_SEARCHES}`, async () => {
    for (let i = 0; i < MAX_RECENT_SEARCHES + 3; i++) {
      await addRecentSearch(`query-${i}`);
    }
    const result = await getRecentSearches();
    expect(result).toHaveLength(MAX_RECENT_SEARCHES);
    expect(result[0]).toBe(`query-${MAX_RECENT_SEARCHES + 2}`);
  });

  it('ignores an empty/whitespace-only query', async () => {
    await addRecentSearch('   ');
    expect(await getRecentSearches()).toEqual([]);
  });

  it('clearRecentSearches empties the list', async () => {
    await addRecentSearch('naruto');
    await clearRecentSearches();
    expect(await getRecentSearches()).toEqual([]);
  });
});
