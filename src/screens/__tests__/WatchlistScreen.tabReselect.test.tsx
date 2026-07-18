// Covers items 5/6 of the Phase 8 fix (docs/upcoming-timeline-todo.md):
// re-selecting the already-active Shows tab must dispatch to exactly ONE
// target depending on which mode is currently selected — Watch List's
// ScrollView when WATCH LIST is active, UpcomingTimeline's scrollToToday()
// when UPCOMING is active — never both, via WatchlistScreen's single
// useScrollToTop + dispatcher-ref pattern (replacing the earlier two-
// independent-hooks design that risked firing both simultaneously).
//
// Both Screen and UpcomingTimeline are mocked with minimal forwardRef fakes
// exposing a spy-able imperative handle — this exercises WatchlistScreen's
// own dispatch logic in isolation (which target gets called, and only one),
// not Screen's real ScrollView internals or UpcomingTimeline's internal
// query/SectionList machinery (that's covered separately by
// upcomingGrouping.test.ts's pure decision-logic tests). This RNTL version
// (14.x) does not expose UNSAFE_getByType/UNSAFE_root for grabbing a real
// host ScrollView instance, so mocking Screen is the direct alternative.

import { forwardRef, useImperativeHandle } from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WatchlistScreen } from '../WatchlistScreen';
import { getWatchlist } from '../../api/endpoints/watchlist';

jest.mock('../../api/endpoints/watchlist');

const mockScrollTo = jest.fn();
jest.mock('../../components/Screen', () => {
  const { forwardRef: fr, useImperativeHandle: uih } = require('react');
  return {
    Screen: fr(({ children }: { children: React.ReactNode }, ref: unknown) => {
      uih(ref, () => ({ scrollTo: mockScrollTo }));
      return children;
    }),
  };
});

const mockScrollToToday = jest.fn();
jest.mock('../../components/UpcomingTimeline', () => {
  const { forwardRef: fr, useImperativeHandle: uih } = require('react');
  const { Text: RNText } = require('react-native');
  const { createElement } = require('react');
  return {
    UpcomingTimeline: fr((_props: unknown, ref: unknown) => {
      uih(ref, () => ({ scrollToToday: mockScrollToToday }));
      return createElement(RNText, null, 'Upcoming Mock');
    }),
  };
});

const mockGetWatchlist = getWatchlist as jest.MockedFunction<typeof getWatchlist>;

const Tab = createBottomTabNavigator();

function OtherScreen() {
  return <Text>Other tab content</Text>;
}

async function renderShowsTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <Tab.Navigator>
          <Tab.Screen name="Watchlist" component={WatchlistScreen} options={{ tabBarButtonTestID: 'tab-button-watchlist' }} />
          <Tab.Screen name="Other" component={OtherScreen} options={{ tabBarButtonTestID: 'tab-button-other' }} />
        </Tab.Navigator>
      </NavigationContainer>
    </QueryClientProvider>,
  );
}

// useScrollToTop's tabPress handler defers its actual scroll call into a
// requestAnimationFrame callback — see activeTabScrollToTop.test.tsx for
// the same rationale (accounting for a listener that might call
// preventDefault() in the same tick).
function flushRAF() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

beforeEach(() => {
  mockGetWatchlist.mockReset();
  mockGetWatchlist.mockResolvedValue([]);
  mockScrollTo.mockClear();
  mockScrollToToday.mockClear();
});

describe('WatchlistScreen — mode-specific tab reselect (Phase 8)', () => {
  it('5. reselecting while WATCH LIST is active scrolls Watch List only — never dispatches to Upcoming', async () => {
    const { getByTestId, getByText } = await renderShowsTab();
    await waitFor(() => expect(getByText('WATCH LIST')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId('tab-button-watchlist'));
      await flushRAF();
    });

    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(mockScrollTo).toHaveBeenCalledWith(expect.objectContaining({ y: 0 }));
    expect(mockScrollToToday).not.toHaveBeenCalled();
  });

  it('6. reselecting while UPCOMING is active scrolls to Today only — never scrolls Watch List', async () => {
    const { getByTestId, getByText } = await renderShowsTab();
    await waitFor(() => expect(getByText('WATCH LIST')).toBeTruthy());

    // Switch to Upcoming mode.
    await act(async () => {
      fireEvent.press(getByText('UPCOMING'));
    });
    await waitFor(() => expect(getByText('Upcoming Mock')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId('tab-button-watchlist'));
      await flushRAF();
    });

    expect(mockScrollToToday).toHaveBeenCalledTimes(1);
    expect(mockScrollTo).not.toHaveBeenCalled();
  });

  it('switching tabs away and back does not itself trigger either scroll target (only an actual reselect does)', async () => {
    const { getByTestId, getByText } = await renderShowsTab();
    await waitFor(() => expect(getByText('WATCH LIST')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId('tab-button-other'));
      await flushRAF();
    });
    await waitFor(() => expect(getByText('Other tab content')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId('tab-button-watchlist'));
      await flushRAF();
    });

    expect(mockScrollTo).not.toHaveBeenCalled();
    expect(mockScrollToToday).not.toHaveBeenCalled();
  });

  it('switching from Upcoming back to Watch List, then reselecting, targets Watch List only (mode is read fresh, not stale)', async () => {
    const { getByTestId, getByText } = await renderShowsTab();
    await waitFor(() => expect(getByText('WATCH LIST')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('UPCOMING'));
    });
    await waitFor(() => expect(getByText('Upcoming Mock')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('WATCH LIST'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('tab-button-watchlist'));
      await flushRAF();
    });

    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(mockScrollToToday).not.toHaveBeenCalled();
  });
});
