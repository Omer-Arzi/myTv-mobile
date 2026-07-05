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
import { SeriesCard } from '../components/SeriesCard';
import { EmptyState } from '../components/EmptyState';
import { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/theme';
import { formatDate } from '../utils/format';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

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

  return (
    <Screen refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}>
      {data.length === 0 ? (
        <EmptyState message="Your watchlist is empty. Series you add will show up here." />
      ) : (
        <View>
          {data.map((item) => (
            <SeriesCard
              key={item.id}
              variant="list"
              title={item.series.title}
              posterUrl={item.series.posterUrl}
              subtitle={`Added ${formatDate(item.addedAt) ?? ''}`}
              releaseStatus={item.series.releaseStatus}
              userStatus={item.userStatus}
              onPress={() => openSeries(item.series.id, item.series.title)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
