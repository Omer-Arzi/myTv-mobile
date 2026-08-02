// Covers SystemScreen (mobile/docs/tab-restructure-todo.md Step 4 + the
// later "transfer manual review here" follow-up): status multi-select
// state, the Fetch button's call args, the latest-run progress readout,
// and the Manual Review row (moved in from WatchListPanel's old
// conditional banner — this one is always rendered, regardless of count).
// startLibraryRefresh/getLibraryRefreshStatus/getMigrationWorkbench are the
// only three network seams, mocked exactly like the screen calls them.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SystemScreen } from '../SystemScreen';
import { getLibraryRefreshStatus, startLibraryRefresh } from '../../api/endpoints/sync';
import { getMigrationWorkbench } from '../../api/endpoints/migration-workbench';
import { LibraryRefreshJob } from '../../api/types';

jest.mock('../../api/endpoints/sync');
jest.mock('../../api/endpoints/migration-workbench');

const mockStartLibraryRefresh = startLibraryRefresh as jest.MockedFunction<typeof startLibraryRefresh>;
const mockGetLibraryRefreshStatus = getLibraryRefreshStatus as jest.MockedFunction<typeof getLibraryRefreshStatus>;
const mockGetMigrationWorkbench = getMigrationWorkbench as jest.MockedFunction<typeof getMigrationWorkbench>;

const job = (overrides: Partial<LibraryRefreshJob> = {}): LibraryRefreshJob => ({
  id: 'job-1',
  status: 'COMPLETED',
  startedAt: '2026-08-02T00:00:00.000Z',
  finishedAt: '2026-08-02T00:01:00.000Z',
  totalSeries: 10,
  checkedSeries: 10,
  seriesWithNewEpisodes: 2,
  seriesWithNewSeasons: 0,
  seriesFailed: 1,
  seriesManualReview: 0,
  seriesActivatedLocally: 0,
  lastError: null,
  ...overrides,
});

const Stack = createNativeStackNavigator();

function NullScreen() {
  return null;
}

async function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="System" component={SystemScreen} options={{ headerShown: false }} />
          <Stack.Screen name="NeedsAttention" component={NullScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockStartLibraryRefresh.mockReset();
  mockGetLibraryRefreshStatus.mockReset();
  mockGetLibraryRefreshStatus.mockResolvedValue({ latestJob: null, automaticUpdatesEnabled: true, lastAutomaticCheckAt: null, lastLocalActivationAt: null });
  mockGetMigrationWorkbench.mockReset();
  mockGetMigrationWorkbench.mockResolvedValue([]);
});

describe('SystemScreen', () => {
  it('defaults to no statuses selected and labels the button "Fetch All"', async () => {
    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Fetch All')).toBeTruthy());
  });

  it('selecting statuses updates the button label and Fetch sends exactly those statuses', async () => {
    mockStartLibraryRefresh.mockResolvedValue(job({ status: 'RUNNING', checkedSeries: 0 }));
    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Fetch All')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Completed'));
    });
    await act(async () => {
      fireEvent.press(getByText('Caught Up'));
    });
    await waitFor(() => expect(getByText('Fetch 2 Selected')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Fetch 2 Selected'));
    });

    await waitFor(() => expect(mockStartLibraryRefresh).toHaveBeenCalledWith(expect.arrayContaining(['COMPLETED', 'CAUGHT_UP'])));
    expect(mockStartLibraryRefresh.mock.calls[0][0]).toHaveLength(2);
  });

  it('pressing Fetch with no selection requests every status', async () => {
    mockStartLibraryRefresh.mockResolvedValue(job({ status: 'RUNNING', checkedSeries: 0 }));
    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Fetch All')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Fetch All'));
    });

    await waitFor(() => expect(mockStartLibraryRefresh).toHaveBeenCalledWith([]));
  });

  it('renders the latest run progress once a job exists', async () => {
    mockGetLibraryRefreshStatus.mockResolvedValue({
      latestJob: job(),
      automaticUpdatesEnabled: true,
      lastAutomaticCheckAt: null,
      lastLocalActivationAt: null,
    });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('10 / 10')).toBeTruthy());
    expect(getByText('2')).toBeTruthy();
    expect(getByText('1')).toBeTruthy();
  });

  it('shows "Nothing needs attention" when there is nothing to review', async () => {
    mockGetMigrationWorkbench.mockResolvedValue([]);

    const { getByText, queryByText } = await renderScreen();

    await waitFor(() => expect(getByText('Nothing needs attention')).toBeTruthy());
    expect(queryByText(/Needs Attention \(/)).toBeNull();
  });

  it('shows the Needs Attention count and count is always visible, unlike the old conditional banner', async () => {
    mockGetMigrationWorkbench.mockResolvedValue([
      { seriesId: 'series-1', title: 'Severance', posterUrl: null, category: 'NEEDS_EPISODE_REVIEW', reason: 'test', proposal: null },
      { seriesId: 'series-2', title: 'Bleach', posterUrl: null, category: 'NEEDS_EPISODE_REVIEW', reason: 'test', proposal: null },
    ]);

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('⚠ Needs Attention (2)')).toBeTruthy());
  });

  it('tapping the manual review row navigates to NeedsAttention', async () => {
    mockGetMigrationWorkbench.mockResolvedValue([
      { seriesId: 'series-1', title: 'Severance', posterUrl: null, category: 'NEEDS_EPISODE_REVIEW', reason: 'test', proposal: null },
    ]);

    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('⚠ Needs Attention (1)')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('⚠ Needs Attention (1)'));
    });

    // NullScreen renders nothing, so a successful navigation is observed by
    // the System screen's own content (e.g. "Fetch All") disappearing.
    await waitFor(() => expect(() => getByText('Fetch All')).toThrow());
  });
});
