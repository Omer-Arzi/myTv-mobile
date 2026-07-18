import { forwardRef, useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { getWatchlist } from '../api/endpoints/watchlist';
import { queryKeys } from '../api/queryKeys';
import { Screen } from '../components/Screen';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { SectionHeader } from '../components/SectionHeader';
import { SeriesCard } from '../components/SeriesCard';
import { EmptyState } from '../components/EmptyState';
import { UpcomingTimeline, UpcomingTimelineHandle } from '../components/UpcomingTimeline';
import { RootStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { groupWatchlistItems } from '../utils/groupWatchlistItems';
import { formatAttentionWarningLabel } from '../utils/format';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type ShowsMode = 'watchlist' | 'upcoming';

// "What can I watch now?" (Watch List) vs. "What was released, releases
// today, and releases next?" (Upcoming) — two modes of the same Shows tab.
// Both subtrees stay mounted at all times; switching only toggles RN's
// `display: 'none'` on the inactive one (never a conditional unmount) — this
// is what makes "preserve Watch List state" and "preserve Upcoming scroll
// position during the session" free: no remount, no query-cache loss, no
// refetch, no scroll-position loss, for either side, with no extra
// state-preservation code. See server/docs/upcoming-timeline-todo.md
// "Frontend structure".
export function WatchlistScreen() {
  const [mode, setMode] = useState<ShowsMode>('watchlist');
  const watchListScrollRef = useRef<ScrollView>(null);
  const upcomingRef = useRef<UpcomingTimelineHandle>(null);

  // Exactly ONE useScrollToTop registration for the whole Shows tab —
  // deliberately not one per panel (that was the "could accidentally call
  // both lists" gap flagged in Phase 4-6 and fixed in Phase 8, see
  // server/docs/upcoming-timeline-todo.md). The dispatcher's scrollToTop
  // method is reassigned on every render (mutating a ref during render is
  // safe — it's not part of the render output) so it always closes over
  // the CURRENT `mode` and refs, never a stale value from whenever this ref
  // object was first created.
  const scrollDispatcherRef = useRef<{ scrollToTop: () => void }>({ scrollToTop: () => {} });
  scrollDispatcherRef.current.scrollToTop = () => {
    if (mode === 'watchlist') {
      watchListScrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      upcomingRef.current?.scrollToToday();
    }
  };
  useScrollToTop(scrollDispatcherRef);

  return (
    // A single top-level safe area for the whole screen (switch row +
    // both panels) — each panel's own inner chrome (Screen/UpcomingTimeline)
    // renders with edges={[]} so the top/bottom inset is only ever applied
    // once, not doubled.
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.switchRow}>
        <Pressable
          style={[styles.switchButton, mode === 'watchlist' && styles.switchButtonActive]}
          onPress={() => setMode('watchlist')}
        >
          <Text style={[styles.switchLabel, mode === 'watchlist' && styles.switchLabelActive]}>WATCH LIST</Text>
        </Pressable>
        <Pressable
          style={[styles.switchButton, mode === 'upcoming' && styles.switchButtonActive]}
          onPress={() => setMode('upcoming')}
        >
          <Text style={[styles.switchLabel, mode === 'upcoming' && styles.switchLabelActive]}>UPCOMING</Text>
        </Pressable>
      </View>

      <View style={[styles.panel, mode !== 'watchlist' && styles.hidden]}>
        <WatchListPanel ref={watchListScrollRef} />
      </View>
      <View style={[styles.panel, mode !== 'upcoming' && styles.hidden]}>
        <UpcomingTimeline ref={upcomingRef} isActive={mode === 'upcoming'} />
      </View>
    </SafeAreaView>
  );
}

// The original Watch List body, unchanged — existing sections, catalog
// behavior, actions, sorting, and state management are all untouched; only
// its mount point moved (from being WatchlistScreen's entire body to one of
// two toggled panels inside it). Now forwardRefs its underlying ScrollView
// up to WatchlistScreen instead of calling useScrollToTop itself — see the
// single-dispatcher comment above.
const WatchListPanel = forwardRef<ScrollView>(function WatchListPanel(_props, ref) {
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

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <LoadingState />;

  const sections = groupWatchlistItems(data);

  return (
    <Screen ref={ref} edges={[]} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}>
      {sections.length === 0 ? (
        <EmptyState message="Your active library is empty. Series you're watching, caught up on, or planning to start show up here." />
      ) : (
        sections.map((section) => (
          <View key={section.status}>
            <SectionHeader title={section.title} />
            {section.items.map((item) => (
              <SeriesCard
                key={item.id}
                variant="list"
                title={item.series.title}
                posterUrl={item.series.posterUrl}
                releaseStatus={item.series.releaseStatus}
                userStatus={item.userStatus}
                warning={item.attentionReasonCode ? formatAttentionWarningLabel(item.attentionReasonCode) : null}
                onPress={() => openSeries(item.series.id, item.series.title)}
              />
            ))}
          </View>
        ))
      )}
    </Screen>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  switchRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.full,
    padding: 4,
  },
  switchButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    alignItems: 'center',
  },
  switchButtonActive: { backgroundColor: colors.accent },
  switchLabel: { ...typography.caption, fontWeight: '700', color: colors.textSecondary },
  switchLabelActive: { color: '#0A0A0D' },
  panel: { flex: 1 },
  hidden: { display: 'none' },
});
