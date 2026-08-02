// Covers WatchListPanel's merged behavior (mobile/docs/tab-restructure-todo.md
// Step 2): it now sources from GET /series (status-filterable, like the
// retired LibraryScreen) instead of GET /watchlist, with the status-pill
// row and Needs Attention banner both relocated in as SectionList header
// content. listSeries/getMigrationWorkbench are the only two network seams
// mocked here, exactly like the component calls them in production.
//
// Virtualization props (initialNumToRender/windowSize) are NOT asserted
// here — this codebase's own documented limitation (see CLAUDE.md and
// WatchlistScreen.tabReselect.test.tsx's header comment) is that RNTL 14.x
// has no way to introspect a mounted host SectionList's props, and the
// real crashes these props guard against were never unit-test-catchable
// even before this merge. That verification stays real-device/manual.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WatchListPanel } from '../WatchListPanel';
import { listSeries } from '../../api/endpoints/series';
import { getMigrationWorkbench } from '../../api/endpoints/migration-workbench';
import { SeriesCard as SeriesCardModel } from '../../api/types';

jest.mock('../../api/endpoints/series');
jest.mock('../../api/endpoints/migration-workbench');

const mockListSeries = listSeries as jest.MockedFunction<typeof listSeries>;
const mockGetMigrationWorkbench = getMigrationWorkbench as jest.MockedFunction<typeof getMigrationWorkbench>;

const seriesCard = (overrides: Partial<SeriesCardModel> = {}): SeriesCardModel => ({
  id: 'series-1',
  title: 'Doctor Who',
  overview: null,
  posterUrl: null,
  backdropUrl: null,
  releaseStatus: 'RETURNING',
  userStatus: 'WATCHING',
  ...overrides,
});

const Stack = createNativeStackNavigator();

function NullScreen() {
  return null;
}

async function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="WatchList" component={WatchListPanel} options={{ headerShown: false }} />
          <Stack.Screen name="SeriesDetail" component={NullScreen} />
          <Stack.Screen name="NeedsAttention" component={NullScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockListSeries.mockReset();
  mockGetMigrationWorkbench.mockReset();
  mockGetMigrationWorkbench.mockResolvedValue([]);
});

describe('WatchListPanel', () => {
  it('defaults to the WATCHING filter and renders its results', async () => {
    mockListSeries.mockResolvedValue({ items: [seriesCard()], nextCursor: null });

    const { getByText } = await renderPanel();

    await waitFor(() => expect(getByText('Doctor Who')).toBeTruthy());
    expect(mockListSeries).toHaveBeenCalledWith({ status: 'WATCHING', limit: 50 });
  });

  it('tapping a status pill refetches with the new status', async () => {
    mockListSeries.mockResolvedValue({ items: [seriesCard({ id: 'series-2', title: 'Severance', userStatus: 'COMPLETED' })], nextCursor: null });

    const { getByText } = await renderPanel();
    await waitFor(() => expect(mockListSeries).toHaveBeenCalledWith({ status: 'WATCHING', limit: 50 }));

    await act(async () => {
      fireEvent.press(getByText('Completed'));
    });

    await waitFor(() => expect(mockListSeries).toHaveBeenCalledWith({ status: 'COMPLETED', limit: 50 }));
    await waitFor(() => expect(getByText('Severance')).toBeTruthy());
  });

  it('shows an empty state message naming the active filter when there are no results', async () => {
    mockListSeries.mockResolvedValue({ items: [], nextCursor: null });

    const { getByText } = await renderPanel();

    await waitFor(() => expect(getByText(/No series with status "Watching" yet\./)).toBeTruthy());
  });

  it('shows no Needs Attention banner when there is nothing to review', async () => {
    mockListSeries.mockResolvedValue({ items: [], nextCursor: null });
    mockGetMigrationWorkbench.mockResolvedValue([]);

    const { queryByText } = await renderPanel();

    await waitFor(() => expect(mockGetMigrationWorkbench).toHaveBeenCalled());
    expect(queryByText(/Needs Attention/)).toBeNull();
  });

  it('shows a Needs Attention banner with the item count when there is something to review', async () => {
    mockListSeries.mockResolvedValue({ items: [], nextCursor: null });
    mockGetMigrationWorkbench.mockResolvedValue([
      { seriesId: 'series-3', title: 'Severance', posterUrl: null, category: 'NEEDS_EPISODE_REVIEW', reason: 'test', proposal: null },
    ]);

    const { getByText } = await renderPanel();

    await waitFor(() => expect(getByText('⚠ Needs Attention (1)')).toBeTruthy());
  });
});
