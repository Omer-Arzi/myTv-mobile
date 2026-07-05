import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getHome } from '../api/endpoints/home';
import { markEpisodeWatched } from '../api/endpoints/episodes';
import { queryKeys } from '../api/queryKeys';
import { RecentlyWatchedItem, StaleSeriesItem, WatchNextItem } from '../api/types';
import { Screen } from '../components/Screen';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { SectionHeader } from '../components/SectionHeader';
import { SeriesCard } from '../components/SeriesCard';
import { WatchNextCard } from '../components/WatchNextCard';
import { EmptyState } from '../components/EmptyState';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme/theme';
import { getErrorMessage } from '../utils/errors';
import { episodeLabel, formatDate } from '../utils/format';
import { pickImage } from '../utils/media';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const queryClient = useQueryClient();
  const [pendingEpisodeId, setPendingEpisodeId] = useState<string | null>(null);
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.home,
    queryFn: getHome,
  });

  const markWatchedMutation = useMutation({
    mutationFn: (episodeId: string) => markEpisodeWatched(episodeId),
    onMutate: (episodeId: string) => setPendingEpisodeId(episodeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    },
    onError: (mutationError) => {
      Alert.alert('Could not mark as watched', getErrorMessage(mutationError));
    },
    onSettled: () => setPendingEpisodeId(null),
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
      <SectionHeader title="Recently Watched" />
      {data.recentlyWatched.length === 0 ? (
        <EmptyState message="No watch history yet." />
      ) : (
        <FlatList
          horizontal
          data={data.recentlyWatched}
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
      {data.watchNext.length === 0 ? (
        <EmptyState message="Nothing in progress right now." />
      ) : (
        <View>
          {data.watchNext.map((item: WatchNextItem) => (
            <WatchNextCard
              key={item.series.id}
              seriesTitle={item.series.title}
              // Compact landscape thumbnail — the episode still fits this
              // shape best; backdrop next, poster (portrait) as a last resort.
              imageUrl={pickImage(item.nextEpisode.imageUrl, item.series.backdropUrl, item.series.posterUrl)}
              seasonNumber={item.nextEpisode.seasonNumber}
              episodeNumber={item.nextEpisode.episodeNumber}
              episodeTitle={item.nextEpisode.title}
              onPress={() => openSeries(item.series.id, item.series.title)}
              onMarkWatched={() => markWatchedMutation.mutate(item.nextEpisode.id)}
              isMarking={pendingEpisodeId === item.nextEpisode.id}
              markDisabled={markWatchedMutation.isPending}
            />
          ))}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  rail: { paddingHorizontal: spacing.lg, gap: spacing.md },
});
