// Covers SystemScreen (mobile/docs/tab-restructure-todo.md Step 4): status
// multi-select state, the Fetch button's call args, and the latest-run
// progress readout. startLibraryRefresh/getLibraryRefreshStatus are the
// only two network seams, mocked exactly like the screen calls them.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SystemScreen } from '../SystemScreen';
import { getLibraryRefreshStatus, startLibraryRefresh } from '../../api/endpoints/sync';
import { LibraryRefreshJob } from '../../api/types';

jest.mock('../../api/endpoints/sync');

const mockStartLibraryRefresh = startLibraryRefresh as jest.MockedFunction<typeof startLibraryRefresh>;
const mockGetLibraryRefreshStatus = getLibraryRefreshStatus as jest.MockedFunction<typeof getLibraryRefreshStatus>;

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

async function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SystemScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockStartLibraryRefresh.mockReset();
  mockGetLibraryRefreshStatus.mockReset();
  mockGetLibraryRefreshStatus.mockResolvedValue({ latestJob: null, automaticUpdatesEnabled: true, lastAutomaticCheckAt: null, lastLocalActivationAt: null });
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
});
