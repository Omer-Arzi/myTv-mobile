// Covers Task 3's core behaviors end to end at the screen level: a
// mark-watched mutation success must (a) show a brief success state, (b)
// then either update the card in place (real next episode) or remove it
// entirely (CAUGHT_UP / COMPLETED) with no manual refresh, (c) never
// conflate CAUGHT_UP and COMPLETED copy, (d) roll a failed mutation back to
// its normal state, and (e) survive a background refetch landing mid-
// animation without the card reappearing (the "stale refetch race" the
// task explicitly warns against).
//
// getHome/markEpisodeWatched are the only two network seams — mocked here
// exactly like this file's own screen would call them in production, with
// no other mocking of HomeScreen's internals.

import { act, render, waitFor, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomeScreen } from '../HomeScreen';
import { getHome } from '../../api/endpoints/home';
import { markEpisodeWatched } from '../../api/endpoints/episodes';
import { HomeResponse, MarkWatchedResponse, SeriesSummary, EpisodeSummary } from '../../api/types';

jest.mock('../../api/endpoints/home');
jest.mock('../../api/endpoints/episodes');

const mockGetHome = getHome as jest.MockedFunction<typeof getHome>;
const mockMarkEpisodeWatched = markEpisodeWatched as jest.MockedFunction<typeof markEpisodeWatched>;

const series = (overrides: Partial<SeriesSummary> = {}): SeriesSummary => ({
  id: 'series-1',
  title: 'Doctor Who',
  overview: null,
  posterUrl: null,
  backdropUrl: null,
  releaseStatus: 'RETURNING',
  ...overrides,
});

const episode = (overrides: Partial<EpisodeSummary> = {}): EpisodeSummary => ({
  id: 'ep-1',
  seasonId: 'season-1',
  seasonNumber: 3,
  episodeNumber: 11,
  title: 'Utopia',
  overview: null,
  airDate: '2020-01-01T00:00:00.000Z',
  runtimeMinutes: 45,
  imageUrl: null,
  ...overrides,
});

function baseHome(overrides: Partial<HomeResponse> = {}): HomeResponse {
  return {
    recentlyWatched: [],
    watchNext: [
      {
        series: series(),
        nextEpisode: episode(),
        lastWatchedAt: null,
        userStatus: 'WATCHING',
        remainingEpisodesAfterNext: 2,
      },
    ],
    staleSeries: [],
    haventStartedYet: [],
    ...overrides,
  };
}

const Stack = createNativeStackNavigator();

async function renderHomeScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  mockGetHome.mockReset();
  mockMarkEpisodeWatched.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('HomeScreen — Watch Next post-mark-watched reconciliation', () => {
  it('advancing to a real next episode: shows a brief success state, then updates the card in place without removing it', async () => {
    mockGetHome.mockResolvedValue(baseHome());
    const nextEp = episode({ id: 'ep-2', episodeNumber: 12, title: 'The Sound of Drums' });
    mockMarkEpisodeWatched.mockResolvedValue({
      watch: { id: 'watch-1', watchedAt: '2020-02-01T00:00:00.000Z', note: null, episode: episode() },
      series: series(),
      nextEpisode: nextEp,
      seriesCompleted: false,
      userStatus: 'WATCHING',
      remainingEpisodesAfterNext: 1,
    } satisfies MarkWatchedResponse);

    const { getByLabelText, getByText, queryByText } = await renderHomeScreen();
    await waitFor(() => expect(getByText('S3E11')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByLabelText('Mark episode as watched'));
    });
    expect(mockMarkEpisodeWatched).toHaveBeenCalledWith('ep-1');

    // Immediately after success: still the old episode, now shown as watched.
    expect(getByLabelText('Episode watched')).toBeTruthy();
    expect(getByText('S3E11')).toBeTruthy();

    // After the reconciliation delay: swapped in place to the new episode —
    // never removed, since a valid next episode exists.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await waitFor(() => expect(getByText('S3E12')).toBeTruthy());
    expect(queryByText('S3E11')).toBeNull();
  });

  it('marking the last currently-released episode of a still-RETURNING show: shows "You\'re all caught up", then removes the card — never "Series completed"', async () => {
    mockGetHome.mockResolvedValue(baseHome());
    mockMarkEpisodeWatched.mockResolvedValue({
      watch: { id: 'watch-1', watchedAt: '2020-02-01T00:00:00.000Z', note: null, episode: episode() },
      series: series({ releaseStatus: 'RETURNING' }),
      nextEpisode: null,
      seriesCompleted: true,
      userStatus: 'CAUGHT_UP',
      remainingEpisodesAfterNext: null,
    } satisfies MarkWatchedResponse);

    const { getByLabelText, getByText, queryByText } = await renderHomeScreen();
    await waitFor(() => expect(getByText('S3E11')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByLabelText('Mark episode as watched'));
    });

    // Brief success state, correct copy, immediately.
    await waitFor(() => expect(getByText("You're all caught up")).toBeTruthy());
    expect(queryByText('Series completed')).toBeNull();

    // Card is removed after the pause — no manual refresh needed. Checking
    // for the episode-code text rather than the series title, since the
    // title legitimately still appears in the Recently Watched rail (this
    // was a real watch — see HomeScreen's onSuccess local insertion).
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await waitFor(() => expect(queryByText("You're all caught up")).toBeNull());
    expect(queryByText('S3E11')).toBeNull();
  });

  it('completing an ENDED series: shows "Series completed", then removes the card — never "You\'re all caught up"', async () => {
    mockGetHome.mockResolvedValue(baseHome({ watchNext: [{ ...baseHome().watchNext[0], series: series({ releaseStatus: 'ENDED' }) }] }));
    mockMarkEpisodeWatched.mockResolvedValue({
      watch: { id: 'watch-1', watchedAt: '2020-02-01T00:00:00.000Z', note: null, episode: episode() },
      series: series({ releaseStatus: 'ENDED' }),
      nextEpisode: null,
      seriesCompleted: true,
      userStatus: 'COMPLETED',
      remainingEpisodesAfterNext: null,
    } satisfies MarkWatchedResponse);

    const { getByLabelText, getByText, queryByText } = await renderHomeScreen();
    await waitFor(() => expect(getByText('S3E11')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByLabelText('Mark episode as watched'));
    });

    await waitFor(() => expect(getByText('Series completed')).toBeTruthy());
    expect(queryByText("You're all caught up")).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await waitFor(() => expect(queryByText('Series completed')).toBeNull());
  });

  it('a failed mutation rolls the card back to its normal, actionable state — no success state, no removal', async () => {
    mockGetHome.mockResolvedValue(baseHome());
    mockMarkEpisodeWatched.mockRejectedValue(new Error('network error'));

    const { getByLabelText, getByText } = await renderHomeScreen();
    await waitFor(() => expect(getByText('S3E11')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByLabelText('Mark episode as watched'));
    });

    // Still there, still actionable — not stuck in a checked/pending state.
    await waitFor(() => expect(getByLabelText('Mark episode as watched')).toBeTruthy());
    expect(getByText('S3E11')).toBeTruthy();
  });

  it('a background refetch that lands mid-animation does not re-insert or reorder the card being removed (no stale-refetch race)', async () => {
    mockGetHome.mockResolvedValue(baseHome());
    mockMarkEpisodeWatched.mockResolvedValue({
      watch: { id: 'watch-1', watchedAt: '2020-02-01T00:00:00.000Z', note: null, episode: episode() },
      series: series(),
      nextEpisode: null,
      seriesCompleted: true,
      userStatus: 'CAUGHT_UP',
      remainingEpisodesAfterNext: null,
    } satisfies MarkWatchedResponse);

    const { getByLabelText, getByText, queryByText } = await renderHomeScreen();
    await waitFor(() => expect(getByText('S3E11')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByLabelText('Mark episode as watched'));
    });
    await waitFor(() => expect(getByText("You're all caught up")).toBeTruthy());

    // Simulate the background invalidateQueries-triggered refetch (fired in
    // onSuccess) resolving mid-animation with a STALE server snapshot that
    // still contains the just-completed series unchanged — this is exactly
    // what a real refetch racing the client-side timer would return.
    mockGetHome.mockResolvedValue(baseHome());

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // The card must still be gone — the stale background data must not
    // resurrect it. Checking the episode code (not the series title, which
    // legitimately persists in the Recently Watched rail for this real watch).
    await waitFor(() => expect(queryByText("You're all caught up")).toBeNull());
    expect(queryByText('S3E11')).toBeNull();
  });
});
