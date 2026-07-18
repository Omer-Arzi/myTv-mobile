import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, LayoutChangeEvent, SectionList, StyleSheet, View } from 'react-native';
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
import { colors, spacing } from '../theme/theme';
import { getErrorMessage, isForceRequiredError } from '../utils/errors';
import { confirmAsync } from '../utils/confirmAsync';
import {
  buildUpcomingSections,
  canAutoLoadMorePages,
  canRetryScrollToToday,
  findTodaySectionIndex,
  getInitialUpcomingWindow,
  getLocalDateKey,
  getNextUpcomingWindow,
  getPreviousUpcomingWindow,
  patchUpcomingItemInPages,
  shouldPerformInitialAnchor,
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
// "settling" at all.
const INITIAL_NUM_TO_RENDER = 30;

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
  const hasAnchoredToToday = useRef(false);
  const scrollToTodayRetriesRef = useRef(0);
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
  }, [todayKey]);

  const { data, isLoading, isError, error, refetch, isRefetching, fetchPreviousPage, fetchNextPage, hasPreviousPage, hasNextPage, isFetchingPreviousPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey,
      queryFn: ({ pageParam }) => getUpcoming(pageParam),
      initialPageParam: getInitialUpcomingWindow(todayKey),
      getPreviousPageParam: (firstPage) => (firstPage.hasMorePast ? getPreviousUpcomingWindow(firstPage.from) : undefined),
      getNextPageParam: (lastPage) => (lastPage.hasMoreFuture ? getNextUpcomingWindow(lastPage.to) : undefined),
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

  // The one shared scroll implementation — used both by the automatic
  // first-entry anchor below and by the imperative scrollToToday() handle
  // (tab-reselect). Resets the retry budget on every fresh invocation, so
  // each explicit scroll attempt gets its own bounded fallback window
  // rather than exhausting a global counter over the component's lifetime.
  const scrollToTodaySection = useCallback(
    (animated: boolean) => {
      const todaySectionIndex = findTodaySectionIndex(sections);
      if (todaySectionIndex === -1) return;
      scrollToTodayRetriesRef.current = 0;
      listRef.current?.scrollToLocation({ sectionIndex: todaySectionIndex, itemIndex: 0, animated, viewOffset: 0 });
    },
    [sections],
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
    scrollToTodaySection(false);
  }, [isActive, hasLaidOut, sections, scrollToTodaySection]);

  // Exposed to WatchlistScreen's single tab-reselect dispatcher — see
  // WatchlistScreen.tsx. Deliberately NOT gated by hasAnchoredToToday: a
  // reselect is a fresh, explicit user action every time, not the
  // one-shot automatic entry anchor above.
  useImperativeHandle(ref, () => ({ scrollToToday: () => scrollToTodaySection(true) }), [scrollToTodaySection]);

  // Bounded fallback for VirtualizedList's scrollToIndex-without-
  // getItemLayout failure mode (see Phase 8) — retries the same call once
  // more after a short delay (long enough for more of the list to have
  // rendered in response to the failed attempt), capped so a pathological
  // case can never become an infinite retry loop or a runaway timer chain.
  const handleScrollToIndexFailed = useCallback(() => {
    if (!canRetryScrollToToday(scrollToTodayRetriesRef.current, MAX_SCROLL_TO_TODAY_RETRIES)) return;
    scrollToTodayRetriesRef.current += 1;
    setTimeout(() => {
      const todaySectionIndex = findTodaySectionIndex(sections);
      if (todaySectionIndex === -1) return;
      listRef.current?.scrollToLocation({ sectionIndex: todaySectionIndex, itemIndex: 0, animated: false, viewOffset: 0 });
    }, SCROLL_TO_TODAY_RETRY_DELAY_MS);
  }, [sections]);

  const handleListLayout = useCallback((e: LayoutChangeEvent) => {
    if (e.nativeEvent.layout.height > 0) setHasLaidOut(true);
  }, []);

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
              Alert.alert('Heads Up', result.warning);
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
              Alert.alert('Heads Up', result.warning);
            }
          }
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.home });
        void queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
      } catch (err) {
        Alert.alert(item.isWatched ? 'Could Not Mark Unwatched' : 'Could Not Mark Watched', getErrorMessage(err));
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
        onStartReached={() => {
          // Gated on hasAnchoredToToday — see docs/upcoming-timeline-todo.md
          // Phase 9: an ungated onStartReached fires immediately on mount
          // (a fresh SectionList always starts at offset 0, trivially "near
          // the start"), racing the async Today-anchor and runaway-loading
          // extra past pages before it ever gets a stable target.
          if (canAutoLoadMorePages(hasAnchoredToToday.current, hasPreviousPage, isFetchingPreviousPage)) void fetchPreviousPage();
        }}
        onStartReachedThreshold={2}
        onEndReached={() => {
          if (canAutoLoadMorePages(hasAnchoredToToday.current, hasNextPage, isFetchingNextPage)) void fetchNextPage();
        }}
        onEndReachedThreshold={2}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        ListHeaderComponent={isFetchingPreviousPage ? <ActivityIndicator style={styles.spinner} color={colors.accent} /> : null}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={styles.spinner} color={colors.accent} /> : null}
        contentContainerStyle={styles.contentContainer}
        onLayout={handleListLayout}
        onScrollToIndexFailed={handleScrollToIndexFailed}
      />
    </Screen>
  );
});

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  contentContainer: { paddingBottom: spacing.xxl },
  spinner: { paddingVertical: spacing.lg },
  emptyRow: { paddingHorizontal: spacing.lg },
});
