import { forwardRef, useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { listSeries } from '../api/endpoints/series';
import { getMigrationWorkbench } from '../api/endpoints/migration-workbench';
import { queryKeys } from '../api/queryKeys';
import { SeriesCard as SeriesCardModel, UserSeriesStatus } from '../api/types';
import { RootStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { formatStatusLabel } from '../utils/format';
import { logEvent } from '../utils/remoteLogger';
import { Screen } from './Screen';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { SeriesCard } from './SeriesCard';
import { EmptyState } from './EmptyState';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

// Formerly LibraryScreen.tsx's own tab — merged in here 2026-08 (see
// mobile/docs/tab-restructure-todo.md) so "browse every tracked series,
// filterable by status" lives in the Watch List mode of the Shows tab
// instead of a separate bottom-nav tab. WATCHING is the default (this tab
// is literally named "Watch List"), not Library's old CAUGHT_UP default.
const STATUS_FILTERS: UserSeriesStatus[] = ['WATCHING', 'CAUGHT_UP', 'COMPLETED', 'PAUSED', 'DROPPED'];

// Single page at the DTO's max page size rather than a full cursor-paged
// "load more" — carried over unchanged from LibraryScreen.tsx: there's no
// existing infinite-scroll pattern elsewhere in the app to reuse, and
// per-status libraries are expected to stay small. Revisit if a status
// list exceeds 50.
const PAGE_LIMIT = 50;

// initialNumToRender — deliberately bounded, same reasoning as
// UpcomingTimeline's INITIAL_NUM_TO_RENDER but smaller: these rows are
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

// The Watch List mode of the Shows tab (WatchlistScreen) — a SectionList,
// never a plain ScrollView + .map() of every item. That unbounded render
// was a real, deterministic crash on web: every tracked series' poster
// <Image> mounted and started decoding at once, on first visit, and never
// released (this panel and Upcoming's both stay mounted for the rest of
// the session — see WatchlistScreen.tsx's "both subtrees stay mounted"
// comment). For a library of any real size that's enough concurrent image
// decodes to exceed mobile Safari's WebContent process memory ceiling —
// confirmed via a real-device repro (crashes reliably on a second visit to
// Upcoming, Safari's own "A problem repeatedly occurred" page) and
// reproduced structurally here: a small local test library already
// rendered every poster's <img> tag regardless of scroll position.
// SectionList's initialNumToRender bounds the initial burst the same way
// it already does for UpcomingTimeline. Its own component file/module —
// not inlined into WatchlistScreen.tsx — so it can be mocked as a whole in
// tests exactly like UpcomingTimeline already is (see
// WatchlistScreen.tabReselect.test.tsx), rather than needing to mock
// react-native's SectionList export directly (which pulls in native-module
// side effects jest can't satisfy).
//
// Exactly one section, keyed by the current status filter — carries no
// visible section-header text (the active filter pill above already
// conveys "what am I looking at"), but keeps the SectionList shape (rather
// than switching to FlatList) so WatchlistScreen.tsx's dispatcher ref can
// keep calling scrollToLocation({ sectionIndex: 0, itemIndex: 0 }) exactly
// as it does today, unchanged.
export const WatchListPanel = forwardRef<SectionList<SeriesCardModel>>(function WatchListPanel(_props, ref) {
  const navigation = useNavigation<Navigation>();
  const [status, setStatus] = useState<UserSeriesStatus>('WATCHING');

  const params = { status, limit: PAGE_LIMIT };
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.seriesList(params),
    queryFn: () => listSeries(params),
  });
  const { data: needsAttentionItems } = useQuery({
    queryKey: queryKeys.migrationWorkbench,
    queryFn: getMigrationWorkbench,
  });

  const openSeries = useCallback(
    (seriesId: string, title: string) => {
      navigation.navigate('SeriesDetail', { seriesId, title });
    },
    [navigation],
  );
  const openNeedsAttention = useCallback(() => navigation.navigate('NeedsAttention'), [navigation]);

  // Mirrors UpcomingTimeline's upcoming_data_ready breadcrumb — logs data
  // volume right before it actually renders, so a real crash (the renderer
  // dying mid-paint) at least leaves this as the last trace before
  // silence, same rationale as Phase 12's investigation there.
  useEffect(() => {
    if (data && data.items.length > 0) {
      logEvent('watchlist_data_ready', { itemCount: data.items.length, status });
    }
  }, [data, status]);

  // An empty array (not one section with empty data) whenever there's
  // nothing to show — SectionList only renders ListEmptyComponent when
  // sections itself is empty, not merely when a section's data is.
  const sections = data && data.items.length > 0 ? [{ title: status, data: data.items }] : [];

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
        ListHeaderComponent={
          <>
            {needsAttentionItems && needsAttentionItems.length > 0 ? (
              <Pressable style={({ pressed }) => [styles.attentionBanner, pressed && styles.attentionBannerPressed]} onPress={openNeedsAttention}>
                <Text style={styles.attentionBannerText}>⚠ Needs Attention ({needsAttentionItems.length})</Text>
              </Pressable>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
              {STATUS_FILTERS.map((filter) => {
                const active = filter === status;
                return (
                  <Pressable key={filter} style={[styles.filterPill, active && styles.filterPillActive]} onPress={() => setStatus(filter)}>
                    <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{formatStatusLabel(filter)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        }
        renderItem={({ item }) => (
          <SeriesCard
            variant="list"
            title={item.title}
            posterUrl={item.posterUrl}
            releaseStatus={item.releaseStatus}
            userStatus={item.userStatus}
            onPress={() => openSeries(item.id, item.title)}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : (
            <EmptyState message={`No series with status "${formatStatusLabel(status)}" yet.`} />
          )
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
  attentionBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.warningSoft,
  },
  attentionBannerPressed: { opacity: 0.7 },
  attentionBannerText: { ...typography.caption, color: colors.warning, fontWeight: '700' },
  filterRow: { flexGrow: 0 },
  filterRowContent: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
  },
  filterPillActive: { backgroundColor: colors.accent },
  filterLabel: { ...typography.caption, fontWeight: '600' },
  filterLabelActive: { color: '#0A0A0D' },
});
