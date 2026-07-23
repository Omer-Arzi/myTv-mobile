import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, LayoutChangeEvent, Platform, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { getUpcoming } from '../api/endpoints/upcoming';
import { markEpisodeWatched } from '../api/endpoints/episodes';
import { unwatchEpisode } from '../api/endpoints/episode-watches';
import { queryKeys } from '../api/queryKeys';
import { RootStackParamList } from '../navigation/types';
import { UpcomingItem } from '../api/types';
import { Screen } from './Screen';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';
import { SectionHeader } from './SectionHeader';
import { UpcomingCard } from './UpcomingCard';
import { colors, radii, spacing } from '../theme/theme';
import { getErrorMessage, isForceRequiredError } from '../utils/errors';
import { confirmAsync } from '../utils/confirmAsync';
import { appAlert } from '../utils/appAlert';
import { logEvent } from '../utils/remoteLogger';
import {
  buildUpcomingSections,
  canAutoLoadMorePages,
  canRetryScrollToToday,
  findAnchorSectionIndex,
  getInitialUpcomingWindow,
  getLocalDateKey,
  getNextUpcomingWindow,
  getPreviousUpcomingWindow,
  isScrolledAwayFromEnd,
  isScrolledAwayFromStart,
  MAX_AUTO_LOAD_PAGES_SINCE_RESET,
  patchUpcomingItemInPages,
  shouldPerformInitialAnchor,
  UPCOMING_WEB_LOAD_FUTURE_DAYS,
  UPCOMING_WEB_LOAD_PAST_DAYS,
  UpcomingRow,
  UpcomingSection,
} from '../utils/upcomingGrouping';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

// Bounded fallback for VirtualizedList's documented scrollToIndex-without-
// getItemLayout failure mode (see docs/upcoming-timeline-todo.md Phase 8) —
// a short, explicitly-capped retry, never an unbounded loop and never the
// PRIMARY anchoring mechanism (that's isActive + real onLayout gating below,
// plus a deliberately small initial past window — see Phase 10 — which
// keeps Today's section index low enough that this retry path is rarely
// needed at all; widened from 3/100ms as defense-in-depth for a real device
// with an unusually dense release history, not as the primary fix).
const SCROLL_TO_TODAY_RETRY_DELAY_MS = 120;
const MAX_SCROLL_TO_TODAY_RETRIES = 6;
// Explicit, above RN's own default of 10 — combined with the small initial
// past window (Phase 10), this makes it likely Today's section is already
// within the very first render pass, so the mount-time anchor typically
// succeeds on its first scrollToLocation call with no visible retry
// "settling" at all. Briefly reduced to 16 in Phase 12 on a since-disproven
// "large real account" theory for a real-device crash — the
// upcoming_data_ready breadcrumb added in that same pass showed the real
// account only has totalItemCount=32 (matching local test data almost
// exactly), and 16 measurably reintroduced Phase 10's scrollToIndex-retry
// behavior (anchorSectionIndex=3 no longer comfortably fit). Reverted to
// 30 — the actual crash cause is still open, tracked by that same
// breadcrumb for next time.
const INITIAL_NUM_TO_RENDER = 30;
// Phase 13: RN's own default (21 — roughly 10 "screens" of content above
// and below the viewport) is tuned for native, where extra off-screen
// rendered rows are comparatively cheap. On web, a real-device crash
// happened right after a display:'none' -> visible toggle with no further
// trace — the same category of bug as the auto-load runaway this file
// already fixed (a hidden SectionList misreporting its own viewport),
// just via VirtualizedList's own windowSize-driven rendering this time
// instead of our pagination logic. A much smaller windowSize caps how
// much any such over-render can cost, regardless of what triggers it —
// see WatchListPanel.tsx, which uses the same value for the same reason.
const WINDOW_SIZE = 5;
// How long a scrollToLocation call suppresses onScroll from latching
// hasUserScrolled AND blocks onStartReached/onEndReached from auto-loading
// at all — generous relative to a long *animated* scroll's real duration
// (e.g. jumping back to Today from deep in the future), not just an
// instant jump: an animated scroll fires many intermediate onScroll events
// while still in flight, each reporting a position "away from" whatever
// edge it's passing through, which — if not suppressed for the WHOLE
// transit, not just its first moment — can re-arm the auto-load cap
// mid-scroll and load extra pages that shift content out from under the
// still-in-flight animation, landing away from the intended target. Also
// comfortably above react-native-web's own 100ms scroll-end settle timeout
// (ScrollViewBase).
const PROGRAMMATIC_SCROLL_SUPPRESS_MS = 1500;

export interface UpcomingTimelineHandle {
  // Smoothly returns the timeline to Today — used by WatchlistScreen's
  // single tab-reselect dispatcher when Upcoming is the active mode. Not
  // gated by the "anchor once per mount" guard: this is an explicit,
  // repeatable user action, unlike the automatic first-entry anchor.
  scrollToToday: () => void;
}

interface Props {
  // Whether the Upcoming mode is the one currently visible in
  // WatchlistScreen (mode === 'upcoming'). Both modes stay mounted at all
  // times (display:'none' toggle — see WatchlistScreen), so this is the
  // explicit signal that gates the initial Today-anchor scroll: a
  // display:'none' ancestor never gets a real layout pass in RN's Yoga
  // engine, so scrolling while inactive targets a SectionList that has
  // never measured a single cell — see Phase 8 for the full root-cause
  // writeup of the bug this prevents.
  isActive: boolean;
}

// The "Upcoming" mode of the Shows tab (WatchlistScreen) — a chronological
// personal release timeline, deliberately NOT a second Watch List: cards
// never disappear on watch, only their checkmark state changes. See
// server/docs/upcoming-timeline-todo.md for the full design writeup this
// implements (bidirectional date-window pagination via TanStack Query's
// native useInfiniteQuery, Today-anchor-on-mount, client-owned local
// day-bucketing).
export const UpcomingTimeline = forwardRef<UpcomingTimelineHandle, Props>(function UpcomingTimeline({ isActive }, ref) {
  const navigation = useNavigation<Navigation>();
  const queryClient = useQueryClient();
  const listRef = useRef<SectionList<UpcomingRow, UpcomingSection>>(null);
  // Mirrors the `isActive` prop into a ref, reassigned fresh on every
  // render (safe — not part of render output). onStartReached/onEndReached
  // below read this instead of closing over `isActive` directly: the
  // display:'none' toggle and the underlying SectionList's own scroll/
  // layout events don't necessarily settle in the same tick as React
  // committing the new render, so a callback closure captured just before
  // a mode switch could otherwise still see the OLD isActive value for
  // one more event. A ref removes that race entirely.
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const hasAnchoredToToday = useRef(false);
  const scrollToTodayRetriesRef = useRef(0);
  // True only once onScroll has reported the list genuinely away from an
  // edge (isScrolledAwayFromStart/End) from a scroll we didn't cause
  // ourselves (see isProgrammaticScrollRef below — the Today anchor isn't
  // always a tiny jump; if there are past days above it, its own
  // scrollToLocation call can easily cross the away-from-edge threshold).
  // See canAutoLoadMorePages in upcomingGrouping.ts for why this must gate
  // ANY auto-load: without it, onStartReached and onEndReached can each
  // fire their own bounded burst simultaneously right at mount, landing
  // away from Today even though each burst is bounded.
  const hasUserScrolled = useRef(false);
  // Set around every scrollToLocation call we make (see
  // markProgrammaticScroll) so the onScroll handler below can tell "we just
  // moved the list ourselves" apart from a real user scroll — the counter
  // resets still apply regardless of cause, only the hasUserScrolled latch
  // needs this distinction.
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // How many *consecutive, unreset* auto-triggered previous/next-page loads
  // have happened in each direction since hasUserScrolled became true — see
  // canAutoLoadMorePages for the full Phase 11 writeup of why this is also
  // needed (react-native-web doesn't compensate scroll position when
  // content is prepended, so onStartReached/onEndReached can keep re-firing
  // even after a real user scroll). Reset to 0 by the onScroll handler
  // below whenever the list is genuinely away from that edge again.
  const autoPreviousLoadCount = useRef(0);
  const autoNextLoadCount = useRef(0);
  const [mutatingEpisodeId, setMutatingEpisodeId] = useState<string | null>(null);
  // Set only inside the SectionList's own onLayout, and only when it
  // reports a real (>0) height — the one-time, native, event-driven signal
  // that this SectionList has actually been given screen space and Yoga has
  // laid it out for real, as opposed to sitting under a display:'none'
  // ancestor (which never triggers a layout pass at all). See Phase 8.
  const [hasLaidOut, setHasLaidOut] = useState(false);

  // The timeline is anchored to "today" as of opening Upcoming, not
  // re-derived on every render — but IS re-checked on app foreground and on
  // a periodic timer, so a midnight rollover while the app stays open (or
  // was backgrounded across midnight) is caught. Both are needed: app-focus
  // alone misses "phone stays awake, on this screen, straight through
  // midnight"; the timer alone would be the only signal if the OS never
  // backgrounds the app. When todayKey actually changes, the query key
  // changes with it (see queryKeys.upcoming below), which naturally starts
  // a fresh anchored fetch — a full reset is correct and cheap here (this
  // fires at most once a day), not a "minor interaction" to optimize away.
  const [todayKey, setTodayKey] = useState(() => getLocalDateKey(new Date()));
  const queryKey = queryKeys.upcoming(todayKey);

  useEffect(() => {
    const checkForDateRollover = () => {
      const current = getLocalDateKey(new Date());
      setTodayKey((prev) => (prev === current ? prev : current));
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkForDateRollover();
    });
    const interval = setInterval(checkForDateRollover, 60_000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  // Re-anchor to the new Today once it actually rolls over — todayKey only
  // changes via checkForDateRollover above (at most once a day), so this
  // never fights the "only once per mount" guard under normal scrolling.
  useEffect(() => {
    hasAnchoredToToday.current = false;
    hasUserScrolled.current = false;
    autoPreviousLoadCount.current = 0;
    autoNextLoadCount.current = 0;
  }, [todayKey]);

  const { data, isLoading, isError, error, refetch, isRefetching, fetchPreviousPage, fetchNextPage, hasPreviousPage, hasNextPage, isFetchingPreviousPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey,
      queryFn: ({ pageParam }) => getUpcoming(pageParam),
      initialPageParam: getInitialUpcomingWindow(todayKey),
      // Web loads a bigger, more self-explanatory chunk per explicit button
      // press than native's small scroll-triggered auto-load page size —
      // see UPCOMING_WEB_LOAD_PAST_DAYS/UPCOMING_WEB_LOAD_FUTURE_DAYS
      // (Phase 16). Platform.OS is invariant for the process lifetime, so a
      // plain check here is correct regardless of how many times react-query
      // calls this.
      getPreviousPageParam: (firstPage) =>
        firstPage.hasMorePast ? getPreviousUpcomingWindow(firstPage.from, Platform.OS === 'web' ? UPCOMING_WEB_LOAD_PAST_DAYS : undefined) : undefined,
      getNextPageParam: (lastPage) =>
        lastPage.hasMoreFuture ? getNextUpcomingWindow(lastPage.to, Platform.OS === 'web' ? UPCOMING_WEB_LOAD_FUTURE_DAYS : undefined) : undefined,
    });

  const pages = data?.pages ?? [];
  const loadedFromKey = pages[0]?.from;
  const loadedToKeyExclusive = pages[pages.length - 1]?.to;

  const sections = useMemo(() => {
    if (!loadedFromKey || !loadedToKeyExclusive) return [];
    const allDays = pages.flatMap((page) => page.days);
    return buildUpcomingSections(allDays, todayKey, loadedFromKey, loadedToKeyExclusive);
  }, [pages, todayKey, loadedFromKey, loadedToKeyExclusive]);

  const totalItemCount = useMemo(() => sections.reduce((sum, s) => sum + s.data.filter((r) => r.type === 'item').length, 0), [sections]);
  const firstPage = pages[0];
  const lastPage = pages[pages.length - 1];
  const isGloballyEmpty = !isLoading && totalItemCount === 0 && firstPage?.hasMorePast === false && lastPage?.hasMoreFuture === false;

  // Logs data volume right before it actually renders — a real crash (the
  // renderer dying mid-paint, e.g. from a large concurrent image-decode
  // burst) leaves no other trace: this is the last breadcrumb we'd see
  // before silence, closing the gap the Phase 12 investigation hit (the
  // session went quiet immediately after watchlist_mode_change, before any
  // other event had a chance to fire).
  useEffect(() => {
    if (isActive && totalItemCount > 0) {
      logEvent('upcoming_data_ready', { totalItemCount, sectionsCount: sections.length, pagesLoaded: pages.length });
    }
  }, [isActive, totalItemCount, sections.length, pages.length]);

  // Marks the upcoming burst of onScroll events any scrollToLocation call
  // produces as "ours", so the hasUserScrolled latch above doesn't mistake
  // our own programmatic anchor scroll for genuine user interaction.
  const markProgrammaticScroll = useCallback(() => {
    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimeoutRef.current) clearTimeout(programmaticScrollTimeoutRef.current);
    programmaticScrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, PROGRAMMATIC_SCROLL_SUPPRESS_MS);
  }, []);

  useEffect(
    () => () => {
      if (programmaticScrollTimeoutRef.current) clearTimeout(programmaticScrollTimeoutRef.current);
    },
    [],
  );

  // The one shared scroll implementation — used both by the automatic
  // first-entry anchor below and by the imperative scrollToToday() handle
  // (tab-reselect). Resets the retry budget on every fresh invocation, so
  // each explicit scroll attempt gets its own bounded fallback window
  // rather than exhausting a global counter over the component's lifetime.
  // Targets findAnchorSectionIndex, not plain "today" — if today has no
  // releases, that lands on the next day (or the aggregate "Later" section)
  // that actually has something, rather than a blank "Nothing releasing
  // today" placeholder.
  const scrollToTodaySection = useCallback(
    (animated: boolean, reason: 'initial_anchor' | 'tab_reselect') => {
      const anchorSectionIndex = findAnchorSectionIndex(sections);
      if (anchorSectionIndex === -1) return;
      scrollToTodayRetriesRef.current = 0;
      markProgrammaticScroll();
      logEvent('upcoming_scroll_to_today', { reason, animated, anchorSectionIndex, sectionsCount: sections.length });
      listRef.current?.scrollToLocation({ sectionIndex: anchorSectionIndex, itemIndex: 0, animated, viewOffset: 0 });
    },
    [sections, markProgrammaticScroll],
  );

  // Bring Today into focus on first entry, without requiring the user to
  // manually locate it — but only when Upcoming is actually the visible
  // mode AND its SectionList has genuinely been laid out (hasLaidOut),
  // never while sitting hidden underneath Watch List. See Phase 8 in
  // docs/upcoming-timeline-todo.md for the full root-cause writeup: both
  // panels stay mounted at all times (display:'none' toggle), and a hidden
  // SectionList has never measured a single cell, so scrolling it produces
  // either a runtime error (no onScrollToIndexFailed, previously) or a
  // wrong-landing best-effort estimate. Only ever fires once per mount
  // (hasAnchoredToToday), so loading more pages afterward (or a background
  // refetch) never yanks an intentionally-scrolled user back to Today, and
  // switching away and back during the same session is a no-op here (the
  // ref is not reset by isActive changing, only by an actual date rollover
  // — see the todayKey effect above).
  useEffect(() => {
    if (!shouldPerformInitialAnchor({ isActive, hasLaidOut, hasAnchoredAlready: hasAnchoredToToday.current, sections })) return;
    hasAnchoredToToday.current = true;
    scrollToTodaySection(false, 'initial_anchor');
  }, [isActive, hasLaidOut, sections, scrollToTodaySection]);

  // Exposed to WatchlistScreen's single tab-reselect dispatcher — see
  // WatchlistScreen.tsx. Deliberately NOT gated by hasAnchoredToToday: a
  // reselect is a fresh, explicit user action every time, not the
  // one-shot automatic entry anchor above.
  useImperativeHandle(ref, () => ({ scrollToToday: () => scrollToTodaySection(true, 'tab_reselect') }), [scrollToTodaySection]);

  // Bounded fallback for VirtualizedList's scrollToIndex-without-
  // getItemLayout failure mode (see Phase 8) — retries the same call once
  // more after a short delay (long enough for more of the list to have
  // rendered in response to the failed attempt), capped so a pathological
  // case can never become an infinite retry loop or a runaway timer chain.
  const handleScrollToIndexFailed = useCallback(() => {
    if (!canRetryScrollToToday(scrollToTodayRetriesRef.current, MAX_SCROLL_TO_TODAY_RETRIES)) return;
    scrollToTodayRetriesRef.current += 1;
    logEvent('upcoming_scroll_retry', { retryCount: scrollToTodayRetriesRef.current });
    setTimeout(() => {
      const anchorSectionIndex = findAnchorSectionIndex(sections);
      if (anchorSectionIndex === -1) return;
      markProgrammaticScroll();
      listRef.current?.scrollToLocation({ sectionIndex: anchorSectionIndex, itemIndex: 0, animated: false, viewOffset: 0 });
    }, SCROLL_TO_TODAY_RETRY_DELAY_MS);
  }, [sections, markProgrammaticScroll]);

  const handleListLayout = useCallback((e: LayoutChangeEvent) => {
    if (e.nativeEvent.layout.height > 0) setHasLaidOut(true);
  }, []);

  // Phase 16 — web's explicit "Load earlier releases"/"Load more upcoming"
  // buttons (see ListHeaderComponent/ListFooterComponent below) call these
  // directly, replacing scroll-triggered auto-load on web entirely. Logs a
  // breadcrumb distinct from 'upcoming_auto_load' so Railway logs can tell
  // the two mechanisms apart.
  const handleLoadPrevious = useCallback(() => {
    logEvent('upcoming_manual_load', { direction: 'previous' });
    void fetchPreviousPage();
  }, [fetchPreviousPage]);

  const handleLoadNext = useCallback(() => {
    logEvent('upcoming_manual_load', { direction: 'next' });
    void fetchNextPage();
  }, [fetchNextPage]);

  const openSeries = useCallback(
    (item: UpcomingItem) => navigation.navigate('SeriesDetail', { seriesId: item.seriesId, title: item.seriesTitle }),
    [navigation],
  );

  const patchItem = useCallback(
    (episodeId: string, patch: Partial<UpcomingItem>) => {
      // Recomputed from todayKey (a primitive, stable across renders until
      // an actual rollover) rather than closing over the `queryKey` array
      // above (a fresh reference every render) — this is what keeps this
      // callback targeting the CURRENT anchor's cache entry even across a
      // midnight rollover, instead of a stale closure over whatever anchor
      // was active when the callback happened to last be recreated.
      queryClient.setQueryData<typeof data>(queryKeys.upcoming(todayKey), (old) =>
        old ? { ...old, pages: patchUpcomingItemInPages(old.pages, episodeId, patch) } : old,
      );
    },
    [queryClient, todayKey],
  );

  // Reuses the exact two existing endpoints every other watch-state
  // interaction in this app uses (POST /episodes/:id/watch, DELETE
  // /episode-watches/:watchId) — no new mutation API for Upcoming. Unlike
  // SeriesDetailScreen's dedicated "undo" affordance (which asks for
  // confirmation because it's a correction flow), tapping an already-watched
  // Upcoming card's check is a direct, symmetric toggle — Upcoming is a
  // passive timeline, not a multi-step correction UI. The force-required
  // retry flow (attached note/rating/emotion) is still honored identically.
  const handleToggleWatched = useCallback(
    async (item: UpcomingItem) => {
      if (mutatingEpisodeId) return;
      setMutatingEpisodeId(item.episodeId);
      try {
        if (!item.isWatched) {
          const result = await markEpisodeWatched(item.episodeId);
          patchItem(item.episodeId, { isWatched: true, episodeWatchId: result.watch.id });
        } else if (item.episodeWatchId) {
          try {
            const result = await unwatchEpisode(item.episodeWatchId);
            patchItem(item.episodeId, { isWatched: false, episodeWatchId: null });
            if (result.warning) {
              appAlert('Heads Up', result.warning);
            }
          } catch (err) {
            if (!isForceRequiredError(err)) throw err;
            const confirmed = await confirmAsync(
              'Extra Data Attached',
              `${getErrorMessage(err)}\n\nThis episode has extra data attached (a note, rating, or reaction). Continue?`,
              'Continue',
            );
            if (!confirmed) return;
            const result = await unwatchEpisode(item.episodeWatchId, { force: true });
            patchItem(item.episodeId, { isWatched: false, episodeWatchId: null });
            if (result.warning) {
              appAlert('Heads Up', result.warning);
            }
          }
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.home });
        void queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
      } catch (err) {
        appAlert(item.isWatched ? 'Could Not Mark Unwatched' : 'Could Not Mark Watched', getErrorMessage(err));
      } finally {
        setMutatingEpisodeId(null);
      }
    },
    [mutatingEpisodeId, patchItem, queryClient],
  );

  if (isLoading) {
    return (
      <Screen scroll={false} edges={[]}>
        <LoadingState />
      </Screen>
    );
  }
  if (isError) {
    return (
      <Screen scroll={false} edges={[]}>
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }
  if (isGloballyEmpty) {
    return (
      <Screen scroll={false} edges={[]}>
        <EmptyState message="No upcoming releases in your library yet. Series you're tracking will show their release timeline here." />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} edges={[]}>
      <SectionList
        ref={listRef}
        style={styles.list}
        sections={sections}
        keyExtractor={(row) => row.key}
        stickySectionHeadersEnabled={false}
        initialNumToRender={INITIAL_NUM_TO_RENDER}
        windowSize={WINDOW_SIZE}
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
        renderItem={({ item: row, section }) =>
          row.type === 'empty' ? (
            <View style={styles.emptyRow}>
              <EmptyState message={row.message} />
            </View>
          ) : (
            <UpcomingCard
              item={row.item}
              dayOffset={row.dayOffset}
              isInLater={section.kind === 'later'}
              onPress={() => openSeries(row.item)}
              onToggleWatched={() => handleToggleWatched(row.item)}
              isMutating={mutatingEpisodeId === row.item.episodeId}
            />
          )
        }
        // Phase 16: auto-load-on-scroll is native-only — web replaces it
        // entirely with the explicit Load More buttons below
        // (ListHeaderComponent/ListFooterComponent), since react-native-web
        // never reliably compensates scroll position on prepend/append no
        // matter how conservatively this auto-trigger is tuned (Phases
        // 11/12/14/15). All the machinery below (hasUserScrolled,
        // autoPreviousLoadCount/autoNextLoadCount, canAutoLoadMorePages,
        // markProgrammaticScroll, onScroll) stays fully live for native and
        // is simply never invoked on web once this handler is undefined.
        onStartReached={
          Platform.OS === 'web'
            ? undefined
            : () => {
                // Never while one of our own scrollToLocation calls is still in
                // flight (see markProgrammaticScroll) — an animated jump back to
                // Today (the tab-reselect gesture) passes through the "near
                // start" threshold while still settling, and an auto-load
                // triggered mid-transit shifts content out from under the
                // still-moving scroll, landing away from the intended target.
                if (isProgrammaticScrollRef.current) return;
                // Gated on hasAnchoredToToday — see docs/upcoming-timeline-todo.md
                // Phase 9: an ungated onStartReached fires immediately on mount
                // (a fresh SectionList always starts at offset 0, trivially "near
                // the start"), racing the async Today-anchor and runaway-loading
                // extra past pages before it ever gets a stable target. ALSO
                // gated on hasUserScrolled (Phase 11) — without it, this and
                // onEndReached could each still fire their own bounded burst
                // simultaneously right at mount, landing away from Today even
                // though bounded (react-native-web doesn't compensate scroll
                // position when content is prepended/appended, so the list can
                // read as "near both edges" for a short initial render). See
                // canAutoLoadMorePages and the onScroll handler below.
                if (canAutoLoadMorePages(isActiveRef.current, hasAnchoredToToday.current, hasPreviousPage, isFetchingPreviousPage, hasUserScrolled.current, autoPreviousLoadCount.current, MAX_AUTO_LOAD_PAGES_SINCE_RESET)) {
                  autoPreviousLoadCount.current += 1;
                  logEvent('upcoming_auto_load', { direction: 'previous', autoLoadCount: autoPreviousLoadCount.current });
                  // Phase 14: confirmed via remoteLogger breadcrumbs from a real
                  // session — autoPreviousLoadCount kept resetting to 0 (logged
                  // autoLoadCount values of 1,1,1,1,2,1,1,2...) almost every time,
                  // never reliably reaching MAX_AUTO_LOAD_PAGES_SINCE_RESET,
                  // because prepending a page shifts content without web
                  // properly compensating scroll position (the same
                  // maintainVisibleContentPosition limitation noted above) —
                  // that shift itself fires onScroll reporting "away from start",
                  // which the handler below (correctly, for a REAL user scroll)
                  // treats as a reset signal. markProgrammaticScroll() marks the
                  // onScroll events this fetch's own content-shift produces as
                  // ours, not a genuine user scroll, so the cap can no longer be
                  // defeated by its own prepended content — a real user scroll
                  // still resets it normally once this suppression window ends.
                  markProgrammaticScroll();
                  void fetchPreviousPage();
                }
              }
        }
        // Phase 15: was 2 (2 screens' worth of distance from the edge) —
        // extremely generous given the Today anchor already sits close to
        // the start by design (only 3 days of past context above it, Phase
        // 10), so onStartReached could fire off nearly any scroll, not just
        // one that actually approached the loaded start. 0.5 requires
        // genuinely nearing the edge before RN considers this "reached."
        // Native only, per the Phase 16 note above.
        onStartReachedThreshold={0.5}
        onEndReached={
          Platform.OS === 'web'
            ? undefined
            : () => {
                if (isProgrammaticScrollRef.current) return;
                if (canAutoLoadMorePages(isActiveRef.current, hasAnchoredToToday.current, hasNextPage, isFetchingNextPage, hasUserScrolled.current, autoNextLoadCount.current, MAX_AUTO_LOAD_PAGES_SINCE_RESET)) {
                  autoNextLoadCount.current += 1;
                  logEvent('upcoming_auto_load', { direction: 'next', autoLoadCount: autoNextLoadCount.current });
                  markProgrammaticScroll();
                  void fetchNextPage();
                }
              }
        }
        // Phase 15: same reasoning as onStartReachedThreshold above.
        onEndReachedThreshold={0.5}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        // Phase 16: web shows an explicit tappable button instead of a bare
        // spinner-on-auto-trigger — hidden once that direction is exhausted
        // (hasPreviousPage/hasNextPage false), swapped for a spinner mid-fetch.
        // Native keeps its original spinner-only behavior unchanged.
        ListHeaderComponent={
          Platform.OS === 'web'
            ? hasPreviousPage
              ? <LoadMoreButton label="Load earlier releases" iconName="chevron-up-outline" isLoading={isFetchingPreviousPage} onPress={handleLoadPrevious} />
              : null
            : isFetchingPreviousPage
              ? <ActivityIndicator style={styles.spinner} color={colors.accent} />
              : null
        }
        ListFooterComponent={
          Platform.OS === 'web'
            ? hasNextPage
              ? <LoadMoreButton label="Load more upcoming" iconName="chevron-down-outline" isLoading={isFetchingNextPage} onPress={handleLoadNext} />
              : null
            : isFetchingNextPage
              ? <ActivityIndicator style={styles.spinner} color={colors.accent} />
              : null
        }
        contentContainerStyle={styles.contentContainer}
        onLayout={handleListLayout}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        // Latches hasUserScrolled true (unless this scroll was our own —
        // see isProgrammaticScrollRef/markProgrammaticScroll) and resets
        // each direction's auto-load cap (regardless of cause), whenever
        // the list is genuinely away from that edge — see
        // canAutoLoadMorePages/Phase 11. A list permanently stuck at an
        // edge (the web bug) never satisfies either check, so it stays
        // blocked/capped; ordinary scrolling latches almost immediately and
        // keeps resetting the cap, so it effectively never binds.
        scrollEventThrottle={16}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const awayFromStart = isScrolledAwayFromStart(contentOffset.y);
          const awayFromEnd = isScrolledAwayFromEnd(contentOffset.y, contentSize.height, layoutMeasurement.height);
          if ((awayFromStart || awayFromEnd) && !isProgrammaticScrollRef.current) hasUserScrolled.current = true;
          // Phase 14: these resets must respect isProgrammaticScrollRef too
          // (the hasUserScrolled latch above already did) — an auto-load's
          // own content-prepend fires onScroll reporting "away from start"
          // on web (scroll position isn't compensated), and resetting the
          // cap unconditionally on that self-inflicted event is exactly
          // what let the cap be defeated every time (see onStartReached's
          // markProgrammaticScroll call, added alongside this fix): each
          // load reset its own counter back to 0 before the next one could
          // ever accumulate past it.
          if (awayFromStart && !isProgrammaticScrollRef.current) autoPreviousLoadCount.current = 0;
          if (awayFromEnd && !isProgrammaticScrollRef.current) autoNextLoadCount.current = 0;
        }}
      />
    </Screen>
  );
});

// Phase 16, web only — the explicit "Load earlier releases"/"Load more
// upcoming" button shown in ListHeaderComponent/ListFooterComponent above,
// replacing native's auto-load-on-scroll for the reasons documented there.
// Styled after ErrorState.tsx's onRetry button (this app's only other
// standalone action-button precedent) rather than introducing a new shared
// Button component for a single call site.
function LoadMoreButton({
  label,
  iconName,
  isLoading,
  onPress,
}: {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  isLoading: boolean;
  onPress: () => void;
}) {
  if (isLoading) return <ActivityIndicator style={styles.spinner} color={colors.accent} />;
  return (
    <Pressable style={styles.loadMoreButton} onPress={onPress}>
      {/* Icon colored to match the button TEXT, not the usual bare-icon
          colors.accent — the pill's own background IS colors.accent, so an
          accent-colored icon would be invisible against it. */}
      <Ionicons name={iconName} size={18} color="#0A0A0D" />
      <Text style={styles.loadMoreButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  contentContainer: { paddingBottom: spacing.xxl },
  spinner: { paddingVertical: spacing.lg },
  emptyRow: { paddingHorizontal: spacing.lg },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xs,
    marginVertical: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
  },
  loadMoreButtonText: { color: '#0A0A0D', fontWeight: '700', fontSize: 14 },
});
