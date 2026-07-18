// Task 1: re-selecting the ALREADY-active bottom tab should smoothly scroll
// its current screen to the top, via @react-navigation/native's own
// useScrollToTop mechanism — not a bespoke global event system. This
// exercises that exact wiring (Screen's forwardRef'd ScrollView +
// useScrollToTop, the same pattern HomeScreen/WatchlistScreen/LibraryScreen
// use in production) inside a real bottom-tab navigator, rather than
// mocking react-navigation's internals.
//
// Uses two minimal tab screens instead of the real four (which would each
// need their own API/react-query mocking) — the thing under test is the
// tab-press → scroll-to-top wiring itself, not any one screen's content.

import { useEffect, useRef, useState } from 'react';
import { Text, ScrollView as RNScrollView } from 'react-native';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer, useScrollToTop } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Screen } from '../../components/Screen';

const Tab = createBottomTabNavigator();

// Modern ScrollView exposes its imperative handle via useImperativeHandle
// rather than a class prototype, so a prototype-level jest.spyOn can't see
// real calls — instead capture the actual ref instance once mounted and
// spy on that specific object below.
let capturedScrollRef: RNScrollView | null = null;
let scrollToSpy: jest.SpyInstance;

// Same pattern as HomeScreen/WatchlistScreen/LibraryScreen: a ref to
// Screen's forwarded ScrollView, registered with useScrollToTop. A local
// counter (bumped only on mount) stands in for "filters/search/pagination/
// data" — if a reselect ever remounted this screen, the rendered count
// would reset to 1 instead of staying wherever the test left it.
let mountCount = 0;
function TabAScreen() {
  const scrollRef = useRef<RNScrollView>(null);
  useScrollToTop(scrollRef);
  useEffect(() => {
    capturedScrollRef = scrollRef.current;
  });
  const [state] = useState(() => {
    mountCount += 1;
    return mountCount;
  });
  return (
    <Screen ref={scrollRef}>
      <Text>Tab A content, mount #{state}</Text>
    </Screen>
  );
}

function TabBScreen() {
  return (
    <Screen>
      <Text>Tab B content</Text>
    </Screen>
  );
}

function renderTabs() {
  return render(
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="TabA" component={TabAScreen} options={{ tabBarButtonTestID: 'tab-button-a' }} />
        <Tab.Screen name="TabB" component={TabBScreen} options={{ tabBarButtonTestID: 'tab-button-b' }} />
      </Tab.Navigator>
    </NavigationContainer>,
  );
}

// useScrollToTop's own tabPress handler defers its actual scrollTo call
// into a requestAnimationFrame callback (see node_modules/@react-navigation/native/src/useScrollToTop.tsx)
// so listeners that call preventDefault() in the same tick are accounted
// for — a plain fireEvent.press + act() flush isn't enough to observe it.
function flushRAF() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

beforeEach(() => {
  mountCount = 0;
  capturedScrollRef = null;
});

afterEach(() => {
  scrollToSpy?.mockRestore();
});

describe('bottom-tab re-selection — scroll to top via useScrollToTop', () => {
  it('re-tapping the already-active tab scrolls its screen to the top exactly once, with no remount', async () => {
    const { getByText, getByTestId } = await renderTabs();

    await waitFor(() => expect(getByText(/Tab A content, mount #1/)).toBeTruthy());
    expect(capturedScrollRef).not.toBeNull();
    // Spy at the instance level (not ScrollView.prototype) — modern
    // ScrollView exposes scrollTo via useImperativeHandle on this exact
    // instance rather than a class prototype method.
    scrollToSpy = jest.spyOn(capturedScrollRef!, 'scrollTo').mockImplementation(() => {});

    // Re-tap the already-active "TabA" tab bar button.
    const tabButton = getByTestId('tab-button-a');
    await act(async () => {
      fireEvent.press(tabButton);
      await flushRAF();
    });

    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).toHaveBeenCalledWith(expect.objectContaining({ y: 0 }));
    // Still mount #1 — the reselect did not remount the screen or reset
    // whatever local state it holds.
    expect(getByText(/Tab A content, mount #1/)).toBeTruthy();
  });

  it('tapping an inactive tab navigates normally and does not trigger a scroll-to-top on the tab being left or the one being entered', async () => {
    const { getByText, getByTestId } = await renderTabs();
    await waitFor(() => expect(getByText(/Tab A content, mount #1/)).toBeTruthy());
    scrollToSpy = jest.spyOn(capturedScrollRef!, 'scrollTo').mockImplementation(() => {});

    const tabBButton = getByTestId('tab-button-b');
    await act(async () => {
      fireEvent.press(tabBButton);
      await flushRAF();
    });

    await waitFor(() => expect(getByText('Tab B content')).toBeTruthy());
    // Switching tabs is plain navigation, not a reselect — scroll-to-top
    // must not fire for it.
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('navigating away and back to the tab preserves its state (tabs stay mounted, not remounted per focus)', async () => {
    const { getByText, getByTestId } = await renderTabs();
    await waitFor(() => expect(getByText(/Tab A content, mount #1/)).toBeTruthy());
    scrollToSpy = jest.spyOn(capturedScrollRef!, 'scrollTo').mockImplementation(() => {});

    await act(async () => {
      fireEvent.press(getByTestId('tab-button-b'));
      await flushRAF();
    });
    await waitFor(() => expect(getByText('Tab B content')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId('tab-button-a'));
      await flushRAF();
    });

    // Back on TabA, still mount #1 (never remounted) — and coming back via
    // a normal tab switch (not a reselect of an already-focused tab) must
    // not itself trigger a scroll either.
    await waitFor(() => expect(getByText(/Tab A content, mount #1/)).toBeTruthy());
    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});
