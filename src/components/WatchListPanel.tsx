import { forwardRef, useCallback, useEffect } from 'react';
import { SectionList, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { getWatchlist } from '../api/endpoints/watchlist';
import { queryKeys } from '../api/queryKeys';
import { WatchlistItem } from '../api/types';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme/theme';
import { groupWatchlistItems } from '../utils/groupWatchlistItems';
import { formatAttentionWarningLabel } from '../utils/format';
import { logEvent } from '../utils/remoteLogger';
import { Screen } from './Screen';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { SectionHeader } from './SectionHeader';
import { SeriesCard } from './SeriesCard';
import { EmptyState } from './EmptyState';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

// initialNumToRender — deliberately bounded, same reasoning as
// UpcomingTimeline's INITIAL_NUM_TO_RENDER but smaller: Watch List rows are
// wider (poster + title + badges) than Upcoming's, so fewer fit in one
// initial screenful.
const WATCHLIST_INITIAL_NUM_TO_RENDER = 16;
// Phase 13: RN's own default (21 — roughly 10 "screens" of content above
// and below the viewport) is tuned for native, where extra off-screen
// rendered rows are comparatively cheap. On web, a real-device crash
// happened right after switching BACK to this panel (display:'none' ->
// visible) with no further trace — the same "hidden SectionList
// misreports its own viewport, then over-renders once shown again"
// category of bug as Upcoming's auto-load runaway (see
// upcomingGrouping.ts), just via VirtualizedList's own windowSize-driven
// rendering instead of our own pagination logic this time. A much smaller
// windowSize caps how much any such over-render can cost, regardless of
// what triggers it.
const WINDOW_SIZE = 5;

// The Watch List mode of the Shows tab (WatchlistScreen) — same sections,
// catalog behavior, actions, sorting, and state management as always, but a
// SectionList instead of a plain ScrollView + .map() of every item. That
// unbounded render was a real, deterministic crash on web: every tracked
// series' poster <Image> mounted and started decoding at once, on first
// visit, and never released (this panel and Upcoming's both stay mounted
// for the rest of the session — see WatchlistScreen.tsx's "both subtrees
// stay mounted" comment). For a library of any real size that's enough
// concurrent image decodes to exceed mobile Safari's WebContent process
// memory ceiling — confirmed via a real-device repro (crashes reliably on
// a second visit to Upcoming, Safari's own "A problem repeatedly occurred"
// page) and reproduced structurally here: a small local test library
// already rendered every poster's <img> tag regardless of scroll position.
// SectionList's initialNumToRender bounds the initial burst the same way
// it already does for UpcomingTimeline. Its own component file/module —
// not inlined into WatchlistScreen.tsx — so it can be mocked as a whole in
// tests exactly like UpcomingTimeline already is (see
// WatchlistScreen.tabReselect.test.tsx), rather than needing to mock
// react-native's SectionList export directly (which pulls in native-module
// side effects jest can't satisfy).
export const WatchListPanel = forwardRef<SectionList<WatchlistItem>>(function WatchListPanel(_props, ref) {
  const navigation = useNavigation<Navigation>();
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: getWatchlist,
  });

  const openSeries = useCallback(
    (seriesId: string, title: string) => {
      navigation.navigate('SeriesDetail', { seriesId, title });
    },
    [navigation],
  );

  // Mirrors UpcomingTimeline's upcoming_data_ready breadcrumb — logs data
  // volume right before it actually renders, so a real crash (the renderer
  // dying mid-paint) at least leaves this as the last trace before
  // silence, same rationale as Phase 12's investigation there.
  useEffect(() => {
    if (data && data.length > 0) {
      logEvent('watchlist_data_ready', { itemCount: data.length });
    }
  }, [data]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <LoadingState />;

  const sections = groupWatchlistItems(data).map((section) => ({ ...section, data: section.items }));

  return (
    <Screen scroll={false} edges={[]}>
      <SectionList
        ref={ref}
        style={styles.list}
        sections={sections}
        keyExtractor={(item) => item.id}
        initialNumToRender={WATCHLIST_INITIAL_NUM_TO_RENDER}
        windowSize={WINDOW_SIZE}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
        renderItem={({ item }) => (
          <SeriesCard
            variant="list"
            title={item.series.title}
            posterUrl={item.series.posterUrl}
            releaseStatus={item.series.releaseStatus}
            userStatus={item.userStatus}
            warning={item.attentionReasonCode ? formatAttentionWarningLabel(item.attentionReasonCode) : null}
            onPress={() => openSeries(item.series.id, item.series.title)}
          />
        )}
        ListEmptyComponent={
          <EmptyState message="Your active library is empty. Series you're watching, caught up on, or planning to start show up here." />
        }
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={styles.contentContainer}
      />
    </Screen>
  );
});

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  contentContainer: { paddingBottom: spacing.xxl },
});
