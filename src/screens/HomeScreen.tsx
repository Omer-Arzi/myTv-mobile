import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, LayoutAnimation, Platform, RefreshControl, ScrollView, StyleSheet, UIManager, View } from 'react-native';
import { useFocusEffect, useNavigation, useScrollToTop } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getHome } from '../api/endpoints/home';
import { markEpisodeWatched } from '../api/endpoints/episodes';
import { queryKeys } from '../api/queryKeys';
import { HavenStartedYetItem, MarkWatchedResponse, RecentlyWatchedItem, StaleSeriesItem, WatchNextItem } from '../api/types';
import { Screen } from '../components/Screen';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { SectionHeader } from '../components/SectionHeader';
import { SeriesCard } from '../components/SeriesCard';
import { CaughtUpCard, WatchNextCard, WatchNextCompletionOutcome } from '../components/WatchNextCard';
import { EmptyState } from '../components/EmptyState';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme/theme';
import { getErrorMessage } from '../utils/errors';
import { episodeLabel, formatDate } from '../utils/format';
import { pickImage } from '../utils/media';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

// Mirrors HOME_RECENTLY_WATCHED_LIMIT in server/src/modules/home/home.service.ts
// — the cap the section is already rendered at, so a locally-inserted item
// never makes the rail grow past what the server would itself return.
const RECENTLY_WATCHED_LIMIT = 10;

// How long a Watch Next card sits in its "success" state (green badge +
// check, see CaughtUpCard) before being removed from the list — within the
// task's specified ~600-900ms window. Also used as the (much shorter in
// practice, but same mechanism) pause before an advance-to-next-episode
// swap, so both post-watch outcomes go through one shared, consistently-
// timed reconciliation path rather than two different UX rhythms.
const POST_WATCH_RECONCILE_DELAY_MS = 750;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const [pendingEpisodeId, setPendingEpisodeId] = useState<string | null>(null);
  const [isSwipeLocked, setIsSwipeLocked] = useState(false);

  // Re-selecting the already-active Home tab smoothly scrolls this screen
  // to the top — @react-navigation/native's own supported mechanism for
  // this (listens for tabPress while already focused, calls
  // scrollTo({y:0, animated:true}) on whatever ref it's given). Nothing
  // else about this screen's state (query data, the Watch Next slot
  // machinery below, filters) is touched.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  // --- Watch Next slot stability ----------------------------------------
  // The section is rendered from these four, NOT directly from
  // `data.watchNext` — that's what lets a slot's *content* refresh in place
  // (advance to the next episode, flip to a success state, then be removed)
  // without the section ever reordering unexpectedly mid-session.
  //
  // - watchNextOrder: series ids — this is the slot order/list membership.
  //   A full reconcile (pull-to-refresh, refocus, remount) replaces it
  //   wholesale; a completed series' own post-watch reconciliation (below)
  //   removes just that one id.
  // - watchNextBySeriesId: current content for each slot. Starts as
  //   `data.watchNext`'s items; swapped in place from a markEpisodeWatched
  //   response when that series advances to a new next episode.
  // - completionState: slots whose series had no next episode left after a
  //   mark-watched — CAUGHT_UP (still airing/renewable) or COMPLETED (show
  //   has ended) per response.userStatus, rendered as CaughtUpCard's brief
  //   success state before removal. See schedulePostWatchReconciliation.
  const [watchNextOrder, setWatchNextOrder] = useState<string[] | null>(null);
  const [watchNextBySeriesId, setWatchNextBySeriesId] = useState<Record<string, WatchNextItem>>({});
  const [completionState, setCompletionState] = useState<Record<string, WatchNextCompletionOutcome>>({});
  // Episode ids whose mutation has succeeded but the post-watch
  // reconciliation delay hasn't finished yet — rendered as a checked/
  // non-actionable "Watched" state on the still-shown old episode. Cleared
  // the moment that series' slot advances or is removed; also cleared
  // wholesale on a full reconcile.
  const [pendingAdvanceEpisodeIds, setPendingAdvanceEpisodeIds] = useState<Set<string>>(new Set());

  // Recently Watched items inserted locally, newest first, from mutation
  // responses this session — layered on top of (not replacing) the frozen
  // `data.recentlyWatched` from the query cache, see mergedRecentlyWatched
  // below. Cleared on the same full-reconcile paths as the Watch Next
  // snapshot, since at that point the server's own list already includes
  // everything these were standing in for.
  const [localRecentlyWatched, setLocalRecentlyWatched] = useState<RecentlyWatchedItem[]>([]);

  // One timeout per series currently in its post-watch success/pause
  // window — see schedulePostWatchReconciliation. Tracked so a full
  // reconcile (or unmount) can cancel a still-pending one rather than
  // letting it fire later against state that's already been reset from
  // under it (which would otherwise be exactly the kind of stale-refetch
  // race the task calls out to avoid).
  const pendingReconcileTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const clearPendingReconcileTimeouts = useCallback(() => {
    for (const timeout of Object.values(pendingReconcileTimeouts.current)) clearTimeout(timeout);
    pendingReconcileTimeouts.current = {};
  }, []);
  useEffect(() => clearPendingReconcileTimeouts, [clearPendingReconcileTimeouts]);

  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.home,
    queryFn: getHome,
  });

  // Full reconcile: (re)snapshot the stable slot order/content straight
  // from a fresh HomeResponse and drop all local completed/caught-up state.
  // The only paths that call this are ones the task explicitly allows to
  // reorder/remove cards: pull-to-refresh, screen refocus, and (implicitly,
  // since state resets) app restart.
  const applyFreshWatchNext = useCallback(
    (items: WatchNextItem[]) => {
      clearPendingReconcileTimeouts();
      setWatchNextOrder(items.map((item) => item.series.id));
      setWatchNextBySeriesId(Object.fromEntries(items.map((item) => [item.series.id, item])));
      setCompletionState({});
      setPendingAdvanceEpisodeIds(new Set());
      // The server's own recentlyWatched now covers everything these local
      // insertions were standing in for — drop them so nothing lingers past
      // its explicit-refresh lifetime.
      setLocalRecentlyWatched([]);
    },
    [clearPendingReconcileTimeouts],
  );

  // Snapshot the stable order/content once, the first time data arrives.
  useEffect(() => {
    if (data && watchNextOrder === null) {
      applyFreshWatchNext(data.watchNext);
    }
  }, [data, watchNextOrder, applyFreshWatchNext]);

  // The one shared post-watch reconciliation path for both outcomes a
  // markEpisodeWatched response can produce, used by both the V action and
  // the swipe action (they already funnel into the same mutation — see
  // WatchNextCard's onMarkWatched prop, called identically by its check
  // button and its swipe-release handler). Everything needed is already in
  // the mutation response itself (nextEpisode, userStatus,
  // remainingEpisodesAfterNext) — no follow-up request, so there is
  // nothing that can race a background refetch mid-animation.
  const schedulePostWatchReconciliation = useCallback((seriesId: string, episodeId: string, response: MarkWatchedResponse) => {
    const existing = pendingReconcileTimeouts.current[seriesId];
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(() => {
      delete pendingReconcileTimeouts.current[seriesId];
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      if (response.nextEpisode) {
        // A valid next episode exists — update the card in place rather
        // than removing it (per the task's explicit "do not remove the
        // series card entirely" requirement).
        const freshItem: WatchNextItem = {
          series: response.series,
          nextEpisode: response.nextEpisode,
          lastWatchedAt: response.watch.watchedAt,
          userStatus: response.userStatus,
          remainingEpisodesAfterNext: response.remainingEpisodesAfterNext,
        };
        setWatchNextBySeriesId((prev) => ({ ...prev, [seriesId]: freshItem }));
        setCompletionState((prev) => {
          if (!(seriesId in prev)) return prev;
          const next = { ...prev };
          delete next[seriesId];
          return next;
        });
      } else {
        // No valid next episode — the slot has already shown its brief
        // success state (set synchronously in onSuccess below); now remove
        // it from the list entirely.
        setWatchNextOrder((prev) => (prev ?? []).filter((id) => id !== seriesId));
        setWatchNextBySeriesId((prev) => {
          if (!(seriesId in prev)) return prev;
          const next = { ...prev };
          delete next[seriesId];
          return next;
        });
        setCompletionState((prev) => {
          if (!(seriesId in prev)) return prev;
          const next = { ...prev };
          delete next[seriesId];
          return next;
        });
      }

      setPendingAdvanceEpisodeIds((prev) => {
        if (!prev.has(episodeId)) return prev;
        const next = new Set(prev);
        next.delete(episodeId);
        return next;
      });
    }, POST_WATCH_RECONCILE_DELAY_MS);

    pendingReconcileTimeouts.current[seriesId] = timeout;
  }, []);

  // Shared by both the V (check-button) action and the swipe action —
  // WatchNextCard calls this same onMarkWatched prop from both its check
  // Pressable and its swipe-release handler (see that component), so there
  // is exactly one mutation/business-logic path for both, not two.
  const markWatchedMutation = useMutation({
    mutationFn: ({ episodeId }: { episodeId: string; seriesId: string }) => markEpisodeWatched(episodeId),
    onMutate: ({ episodeId }) => setPendingEpisodeId(episodeId),
    onSuccess: (response, { episodeId, seriesId }) => {
      // Show the checked/"Watched" state on this slot right away...
      setPendingAdvanceEpisodeIds((prev) => new Set(prev).add(episodeId));

      // ...and put the watch straight at the top of Recently Watched. The
      // mutation response already has everything a RecentlyWatchedItem
      // needs (watch id/watchedAt/note + episode + series), so this is
      // built from confirmed server data, not a guess from the card that
      // was tapped.
      const watchedItem: RecentlyWatchedItem = {
        watchId: response.watch.id,
        watchedAt: response.watch.watchedAt,
        note: response.watch.note,
        series: response.series,
        episode: response.watch.episode,
      };
      setLocalRecentlyWatched((prev) => [
        watchedItem,
        ...prev.filter((item) => item.watchId !== watchedItem.watchId && item.episode.id !== watchedItem.episode.id),
      ]);

      // If there's nothing left to watch, show the right success state
      // (CAUGHT_UP vs COMPLETED — never the ambiguous "no more episodes")
      // immediately; response.userStatus is already the precise,
      // server-derived distinction (deriveUserStatusFromNextEpisode:
      // COMPLETED only when the provider release status is ENDED/CANCELLED,
      // CAUGHT_UP otherwise — the same rule that already correctly excludes
      // Season 0 specials from "is there anything left" via
      // findFirstUnwatchedEpisodeId). This is everything the response
      // already carries — no follow-up request, so nothing can race a
      // background refetch mid-animation.
      if (!response.nextEpisode) {
        const outcome: WatchNextCompletionOutcome = response.userStatus === 'COMPLETED' ? 'COMPLETED' : 'CAUGHT_UP';
        setCompletionState((prev) => ({ ...prev, [seriesId]: outcome }));
      }

      // Advance-in-place (if a next episode exists) or remove-after-success
      // (if not) — both after the same brief pause, via one shared path.
      schedulePostWatchReconciliation(seriesId, episodeId, response);

      // Background cache reconciliation for everything else this watch may
      // affect (series progress/next-episode on SeriesDetail if visited,
      // and Home's OWN cached data for the next time a full reconcile runs
      // — e.g. the next pull-to-refresh or tab refocus). Deliberately safe
      // to fire immediately: the Watch Next section above renders from
      // watchNextOrder/watchNextBySeriesId/completionState, never directly
      // from this query's `data`, so a background refetch landing mid-
      // animation cannot reinsert or reorder the card that's mid-transition.
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({ queryKey: queryKeys.seriesDetail(seriesId) });
      // Partial match — Upcoming's query key carries a dynamic "today"
      // anchor this screen doesn't know, so this invalidates every
      // currently-cached Upcoming query regardless of anchor.
      void queryClient.invalidateQueries({ queryKey: ['upcoming'] });
    },
    onError: (mutationError) => {
      Alert.alert('Could not mark as watched', getErrorMessage(mutationError));
    },
    onSettled: () => setPendingEpisodeId(null),
  });

  const handleRefresh = useCallback(async () => {
    const result = await refetch();
    if (result.data) applyFreshWatchNext(result.data.watchNext);
  }, [refetch, applyFreshWatchNext]);

  // Tab screens stay mounted across navigation, so leaving Home and coming
  // back doesn't remount it or re-run useQuery on its own. Treat that
  // re-focus as the "explicit refresh" moment the task calls for — but
  // skip the very first focus (initial mount), which already fetched.
  const isInitialFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isInitialFocus.current) {
        isInitialFocus.current = false;
        return;
      }
      void handleRefresh();
    }, [handleRefresh]),
  );

  const openSeries = useCallback(
    (seriesId: string, title: string) => {
      navigation.navigate('SeriesDetail', { seriesId, title });
    },
    [navigation],
  );

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <LoadingState />;

  // Fall back to deriving the slot order/content straight from `data` for
  // the one render before the snapshot effect above commits, so there's no
  // empty-section flash on first load.
  const effectiveOrder = watchNextOrder ?? data.watchNext.map((item) => item.series.id);
  const effectiveWatchNextBySeriesId = watchNextOrder === null
    ? Object.fromEntries(data.watchNext.map((item) => [item.series.id, item]))
    : watchNextBySeriesId;

  // Locally-inserted watches first (newest first, as inserted), then the
  // frozen server list with anything already represented locally filtered
  // out — dedupe by watchId primarily, falling back to episode id in case
  // the server hasn't produced a matching watchId for this episode yet.
  const localWatchIds = new Set(localRecentlyWatched.map((item) => item.watchId));
  const localEpisodeIds = new Set(localRecentlyWatched.map((item) => item.episode.id));
  const mergedRecentlyWatched = [
    ...localRecentlyWatched,
    ...data.recentlyWatched.filter((item) => !localWatchIds.has(item.watchId) && !localEpisodeIds.has(item.episode.id)),
  ].slice(0, RECENTLY_WATCHED_LIMIT);

  return (
    <Screen
      ref={scrollRef}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={colors.accent} />}
      scrollEnabled={!isSwipeLocked}
    >
      <SectionHeader title="Recently Watched" />
      {mergedRecentlyWatched.length === 0 ? (
        <EmptyState message="No watch history yet." />
      ) : (
        <FlatList
          horizontal
          data={mergedRecentlyWatched}
          keyExtractor={(item) => item.watchId}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          renderItem={({ item }: { item: RecentlyWatchedItem }) => (
            // Rail cards are tall/poster-shaped, so the poster is the
            // natural fit — the episode still is only a fallback for a
            // series that has no poster yet.
            <SeriesCard
              variant="rail"
              title={item.series.title}
              posterUrl={pickImage(item.series.posterUrl, item.episode.imageUrl)}
              subtitle={episodeLabel(item.episode.seasonNumber, item.episode.episodeNumber, item.episode.title)}
              onPress={() => openSeries(item.series.id, item.series.title)}
            />
          )}
        />
      )}

      {/* Watch Next is the primary section — TV Time-style compact rows,
          not another poster gallery, since this is the one list a user is
          expected to scan every time they open the app. */}
      <SectionHeader title="Watch Next" subtitle="Ready to continue" />
      {effectiveOrder.length === 0 ? (
        <EmptyState message="Nothing in progress right now." />
      ) : (
        <View>
          {effectiveOrder.map((seriesId) => {
            const item = effectiveWatchNextBySeriesId[seriesId];
            if (!item) return null;

            const completionOutcome = completionState[seriesId];
            if (completionOutcome) {
              return (
                <CaughtUpCard
                  key={seriesId}
                  seriesTitle={item.series.title}
                  imageUrl={pickImage(item.nextEpisode.imageUrl, item.series.backdropUrl, item.series.posterUrl)}
                  outcome={completionOutcome}
                  onPress={() => openSeries(item.series.id, item.series.title)}
                />
              );
            }

            const isWatched = pendingAdvanceEpisodeIds.has(item.nextEpisode.id);
            return (
              <WatchNextCard
                key={seriesId}
                seriesTitle={item.series.title}
                // Compact landscape thumbnail — the episode still fits this
                // shape best; backdrop next, poster (portrait) as a last resort.
                imageUrl={pickImage(item.nextEpisode.imageUrl, item.series.backdropUrl, item.series.posterUrl)}
                seasonNumber={item.nextEpisode.seasonNumber}
                episodeNumber={item.nextEpisode.episodeNumber}
                episodeTitle={item.nextEpisode.title}
                remainingEpisodesAfterNext={item.remainingEpisodesAfterNext}
                releaseStatus={item.series.releaseStatus}
                onPress={() => openSeries(item.series.id, item.series.title)}
                onMarkWatched={() => markWatchedMutation.mutate({ episodeId: item.nextEpisode.id, seriesId })}
                isMarking={pendingEpisodeId === item.nextEpisode.id}
                markDisabled={markWatchedMutation.isPending || isWatched}
                isWatched={isWatched}
                onSwipeLockChange={setIsSwipeLocked}
              />
            );
          })}
        </View>
      )}

      <SectionHeader title="Haven't Watched For A While" />
      {data.staleSeries.length === 0 ? (
        <EmptyState message="Nothing has gone stale." />
      ) : (
        <FlatList
          horizontal
          data={data.staleSeries}
          keyExtractor={(item) => item.series.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          renderItem={({ item }: { item: StaleSeriesItem }) => (
            <SeriesCard
              variant="rail"
              title={item.series.title}
              posterUrl={pickImage(item.series.posterUrl, item.nextEpisode?.imageUrl, item.series.backdropUrl)}
              subtitle={item.lastWatchedAt ? `Last watched ${formatDate(item.lastWatchedAt)}` : undefined}
              userStatus={item.userStatus}
              onPress={() => openSeries(item.series.id, item.series.title)}
            />
          )}
        />
      )}

      {/* A derived section, not a persistent status — see
          GET /me/havent-started-yet: watchlisted series with real,
          released content ready to start. Reuses the exact same rail/
          SeriesCard pattern as Recently Watched and Haven't Watched For A
          While above, never a new card component. Server already sorts
          newest-released-first, alphabetical on ties — rendered in that
          order as-is. */}
      <SectionHeader title="Haven't Started Yet" />
      {data.haventStartedYet.length === 0 ? (
        <EmptyState message="Nothing new to start right now." />
      ) : (
        <FlatList
          horizontal
          data={data.haventStartedYet}
          keyExtractor={(item) => item.series.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          renderItem={({ item }: { item: HavenStartedYetItem }) => (
            <SeriesCard
              variant="rail"
              title={item.series.title}
              posterUrl={pickImage(item.series.posterUrl, item.latestReleasedRegularEpisode.imageUrl, item.series.backdropUrl)}
              subtitle={`${item.releasedRegularEpisodeCount} episode${item.releasedRegularEpisodeCount === 1 ? '' : 's'} out`}
              onPress={() => openSeries(item.series.id, item.series.title)}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rail: { paddingHorizontal: spacing.lg, gap: spacing.md },
});
