// Smoke test for the 2026-08 tab restructure (mobile/docs/tab-restructure-todo.md):
// the real TabNavigator now has exactly 4 tabs — Home, Watchlist, Search,
// System — with Library removed and Search/System repositioned. Every
// screen's network seam is mocked (never internals) purely so each one
// mounts without crashing; this test asserts on the tab bar itself, not on
// any one screen's content.

import { render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TabNavigator } from '../TabNavigator';
import { getHome } from '../../api/endpoints/home';
import { listSeries } from '../../api/endpoints/series';
import { getMigrationWorkbench } from '../../api/endpoints/migration-workbench';
import { getLibraryRefreshStatus } from '../../api/endpoints/sync';

jest.mock('../../api/endpoints/home');
jest.mock('../../api/endpoints/series');
jest.mock('../../api/endpoints/migration-workbench');
jest.mock('../../api/endpoints/sync');
jest.mock('../../utils/recentSearches', () => ({
  MAX_RECENT_SEARCHES: 8,
  getRecentSearches: jest.fn().mockResolvedValue([]),
  addRecentSearch: jest.fn().mockResolvedValue([]),
  clearRecentSearches: jest.fn().mockResolvedValue(undefined),
}));

const mockGetHome = getHome as jest.MockedFunction<typeof getHome>;
const mockListSeries = listSeries as jest.MockedFunction<typeof listSeries>;
const mockGetMigrationWorkbench = getMigrationWorkbench as jest.MockedFunction<typeof getMigrationWorkbench>;
const mockGetLibraryRefreshStatus = getLibraryRefreshStatus as jest.MockedFunction<typeof getLibraryRefreshStatus>;

beforeEach(() => {
  mockGetHome.mockResolvedValue({ recentlyWatched: [], watchNext: [], staleSeries: [], haventStartedYet: [] });
  mockListSeries.mockResolvedValue({ items: [], nextCursor: null });
  mockGetMigrationWorkbench.mockResolvedValue([]);
  mockGetLibraryRefreshStatus.mockResolvedValue({ latestJob: null, automaticUpdatesEnabled: true, lastAutomaticCheckAt: null, lastLocalActivationAt: null });
});

async function renderTabNavigator() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </QueryClientProvider>,
  );
}

describe('TabNavigator — post-restructure tab set', () => {
  it('renders exactly Home, Watchlist, Search, and System — Library is gone', async () => {
    const { getByTestId, queryByTestId, getByText, queryByText } = await renderTabNavigator();

    await waitFor(() => expect(getByTestId('tab-button-home')).toBeTruthy());
    expect(getByTestId('tab-button-watchlist')).toBeTruthy();
    expect(getByTestId('tab-button-search')).toBeTruthy();
    expect(getByTestId('tab-button-system')).toBeTruthy();
    expect(queryByTestId('tab-button-library')).toBeNull();

    expect(getByText('Home')).toBeTruthy();
    expect(getByText('Watchlist')).toBeTruthy();
    expect(getByText('Search')).toBeTruthy();
    expect(getByText('System')).toBeTruthy();
    expect(queryByText('Library')).toBeNull();
  });
});
