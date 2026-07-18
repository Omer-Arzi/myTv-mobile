import { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { listSeries } from '../api/endpoints/series';
import { getMigrationWorkbench } from '../api/endpoints/migration-workbench';
import { queryKeys } from '../api/queryKeys';
import { Screen } from '../components/Screen';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { SeriesCard } from '../components/SeriesCard';
import { EmptyState } from '../components/EmptyState';
import { RootStackParamList } from '../navigation/types';
import { UserSeriesStatus } from '../api/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { formatStatusLabel } from '../utils/format';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

// A "library" browse-by-status view, distinct from Watchlist (its own
// endpoint/table) and Home (WATCHING-only rails). Backend already supports
// filtering GET /series by any UserSeriesStatus, so this is the one screen
// that surfaces CAUGHT_UP/COMPLETED series (and PAUSED/DROPPED) which
// otherwise have no tab to appear in.
const STATUS_FILTERS: UserSeriesStatus[] = ['WATCHING', 'CAUGHT_UP', 'COMPLETED', 'PAUSED', 'DROPPED'];

// Single page at the DTO's max page size rather than a full cursor-paged
// "load more" — there's no existing infinite-scroll pattern elsewhere in
// the app to reuse (WatchlistScreen's GET /watchlist isn't paginated), and
// per-status libraries are expected to be small. See LIMITATIONS note in
// the accompanying report for revisiting this if a status list exceeds 50.
const PAGE_LIMIT = 50;

export function LibraryScreen() {
  const navigation = useNavigation<Navigation>();
  // Re-selecting the active tab scrolls the main (vertical) list to top —
  // deliberately NOT the horizontal status-filter row below, which is a
  // separate ScrollView. See HomeScreen for the shared rationale.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const [status, setStatus] = useState<UserSeriesStatus>('CAUGHT_UP');

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

  return (
    <Screen ref={scrollRef} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}>
      {needsAttentionItems && needsAttentionItems.length > 0 ? (
        <Pressable style={({ pressed }) => [styles.attentionBanner, pressed && styles.attentionBannerPressed]} onPress={openNeedsAttention}>
          <Text style={styles.attentionBannerText}>⚠ Needs Attention ({needsAttentionItems.length})</Text>
        </Pressable>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        {STATUS_FILTERS.map((filter) => {
          const active = filter === status;
          return (
            <Pressable
              key={filter}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setStatus(filter)}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{formatStatusLabel(filter)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState message={`No series with status "${formatStatusLabel(status)}" yet.`} />
      ) : (
        <View>
          {data.items.map((item) => (
            <SeriesCard
              key={item.id}
              variant="list"
              title={item.title}
              posterUrl={item.posterUrl}
              releaseStatus={item.releaseStatus}
              userStatus={item.userStatus}
              onPress={() => openSeries(item.id, item.title)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
