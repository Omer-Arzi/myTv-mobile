import { useCallback } from 'react';
import { RefreshControl, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
import { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/theme';
import { groupWatchlistItems } from '../utils/groupWatchlistItems';
import { formatAttentionWarningLabel } from '../utils/format';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

// The Watchlist tab represents the user's ACTIVE, TRUSTWORTHY tracking list
// (Watching / Caught Up / Watchlist), grouped into three ordered sections —
// see groupWatchlistItems.ts. GET /watchlist already does the real work
// (filtering to those three statuses, gating WATCHING/CAUGHT_UP on a
// confirmed provider match, sorting alphabetically); this screen only
// partitions the already-correct response into sections and renders them.
// PAUSED/DROPPED/COMPLETED/UNKNOWN series, and any unconfirmed WATCHING/
// CAUGHT_UP series, are unaffected — still fully available via the Library
// tab (and unconfirmed ones also via the Needs Attention inbox).
export function WatchlistScreen() {
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
    <Screen refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}>
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
}
