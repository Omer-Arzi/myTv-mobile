import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AlertButton, Pressable, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { getSeriesDetail, watchSeriesAllReleased } from '../api/endpoints/series';
import { markEpisodeWatched } from '../api/endpoints/episodes';
import { addNote } from '../api/endpoints/episode-watches';
import { watchSeasonAll } from '../api/endpoints/seasons';
import { queryKeys } from '../api/queryKeys';
import { EpisodeDetail, WatchAllRequest, WatchAllResponse } from '../api/types';
import { Screen } from '../components/Screen';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { PosterImage } from '../components/PosterImage';
import { StatusBadge } from '../components/StatusBadge';
import { SectionHeader } from '../components/SectionHeader';
import { SeasonAccordion } from '../components/SeasonAccordion';
import { ContinueTrackingCard } from '../components/ContinueTrackingCard';
import { NoteEditModal } from '../components/NoteEditModal';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';
import { getErrorMessage } from '../utils/errors';
import { episodeLabel, formatStatusLabel } from '../utils/format';
import { pickImage } from '../utils/media';
import { computeSeasonProgress, seasonDisplayTitle } from '../utils/seasonProgress';

type SeriesDetailRoute = RouteProp<RootStackParamList, 'SeriesDetail'>;

const BACKDROP_HEIGHT = 200;
const POSTER_WIDTH = 108;
const POSTER_HEIGHT = 162;

// The watch-all endpoints reject with 400 when userStatus is DROPPED/PAUSED
// and force wasn't set — see server/src/common/watch-all-logic.ts's
// checkWatchAllAllowed, which is the only 400 either endpoint documents.
// Matching on this substring (rather than just "any 400") keeps this from
// misfiring on some unrelated future validation error.
function isForceRequiredError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 400 && err.message.includes('force=true');
}

function buildDryRunMessage(result: WatchAllResponse): string {
  const lines = [
    result.watchesCreated > 0
      ? `${result.watchesCreated} episode${result.watchesCreated === 1 ? '' : 's'} will be marked watched.`
      : 'No episodes would be marked watched.',
  ];
  if (result.episodesAlreadyWatched > 0) lines.push(`Already watched: ${result.episodesAlreadyWatched}`);
  if (result.episodesSkippedFuture > 0) lines.push(`Not yet aired (skipped): ${result.episodesSkippedFuture}`);
  if (result.episodesSkippedUnknownAirDate > 0) {
    lines.push(`Unknown air date (skipped): ${result.episodesSkippedUnknownAirDate}`);
  }
  if (result.previousUserStatus !== result.newUserStatus) {
    lines.push(`Status: ${formatStatusLabel(result.previousUserStatus)} → ${formatStatusLabel(result.newUserStatus)}`);
  }
  return lines.join('\n');
}

// Promise-wraps Alert.alert's callback-based API so the multi-step
// dry-run -> confirm -> apply -> (maybe) force-retry flow below can just be
// written as sequential async/await instead of nested callbacks.
function confirmAsync(title: string, message: string, confirmText: string): Promise<boolean> {
  return new Promise((resolve) => {
    const buttons: AlertButton[] = [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, onPress: () => resolve(true) },
    ];
    Alert.alert(title, message, buttons, { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export function SeriesDetailScreen() {
  const { params } = useRoute<SeriesDetailRoute>();
  const queryClient = useQueryClient();
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set());
  const [markingEpisodeId, setMarkingEpisodeId] = useState<string | null>(null);
  const [editingEpisode, setEditingEpisode] = useState<EpisodeDetail | null>(null);
  const [markingAllSeasonId, setMarkingAllSeasonId] = useState<string | null>(null);
  const [isMarkingSeriesAll, setIsMarkingSeriesAll] = useState(false);
  const hasAutoExpanded = useRef(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.seriesDetail(params.seriesId),
    queryFn: () => getSeriesDetail(params.seriesId),
  });

  const markWatchedMutation = useMutation({
    mutationFn: (episodeId: string) => markEpisodeWatched(episodeId),
    onMutate: (episodeId: string) => setMarkingEpisodeId(episodeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.seriesDetail(params.seriesId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    },
    onError: (mutationError) => {
      Alert.alert('Could not mark as watched', getErrorMessage(mutationError));
    },
    onSettled: () => setMarkingEpisodeId(null),
  });

  const addNoteMutation = useMutation({
    mutationFn: ({ watchId, text }: { watchId: string; text: string }) => addNote(watchId, text),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.seriesDetail(params.seriesId) });
      setEditingEpisode(null);
    },
    onError: (mutationError) => {
      Alert.alert('Could not save note', getErrorMessage(mutationError));
    },
  });

  // The one season auto-expanded on first load: the one with the next
  // episode, else the first with anything left to watch, else the last
  // (fully watched series). Everything else starts collapsed — the
  // "Continue tracking" card above already surfaces the single most
  // relevant episode, so the accordion doesn't need to force more than one
  // season open to be useful.
  const defaultExpandedSeason = useMemo(() => {
    if (!data || data.seasons.length === 0) return null;
    if (data.nextEpisode) return data.nextEpisode.seasonNumber;
    const inProgress = data.seasons.find((season) => season.episodes.some((ep) => !ep.watched));
    if (inProgress) return inProgress.seasonNumber;
    return data.seasons[data.seasons.length - 1].seasonNumber;
  }, [data]);

  useEffect(() => {
    if (!hasAutoExpanded.current && defaultExpandedSeason !== null) {
      setExpandedSeasons(new Set([defaultExpandedSeason]));
      hasAutoExpanded.current = true;
    }
  }, [defaultExpandedSeason]);

  const seriesProgress = useMemo(
    () => computeSeasonProgress(data?.seasons.flatMap((season) => season.episodes) ?? []),
    [data],
  );

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <LoadingState />;

  const toggleSeason = (seasonNumber: number) => {
    setExpandedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(seasonNumber)) {
        next.delete(seasonNumber);
      } else {
        next.add(seasonNumber);
      }
      return next;
    });
  };

  // Shared dry-run -> confirm -> apply flow for both the season-level and
  // series-level "mark watched" actions — same endpoint contract, same
  // dialogs, just a different call/label per caller.
  const runWatchAll = async (label: string, call: (body: WatchAllRequest) => Promise<WatchAllResponse>) => {
    try {
      const preview = await call({ dryRun: true });

      if (preview.watchesCreated === 0) {
        Alert.alert('Already Caught Up', `No unwatched, released episodes found in ${label}.`);
        return;
      }

      const confirmed = await confirmAsync(`Mark ${label} as Watched?`, buildDryRunMessage(preview), 'Confirm');
      if (!confirmed) return;

      await call({ dryRun: false });
      void queryClient.invalidateQueries({ queryKey: queryKeys.seriesDetail(params.seriesId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      Alert.alert('Done', `Marked ${preview.watchesCreated} episode${preview.watchesCreated === 1 ? '' : 's'} as watched.`);
    } catch (err) {
      if (isForceRequiredError(err)) {
        const forceConfirmed = await confirmAsync('Cannot Mark Watched', getErrorMessage(err), 'Mark Anyway');
        if (!forceConfirmed) return;

        try {
          const applied = await call({ dryRun: false, force: true });
          void queryClient.invalidateQueries({ queryKey: queryKeys.seriesDetail(params.seriesId) });
          void queryClient.invalidateQueries({ queryKey: queryKeys.home });
          Alert.alert('Done', `Marked ${applied.watchesCreated} episode${applied.watchesCreated === 1 ? '' : 's'} as watched.`);
        } catch (forceErr) {
          Alert.alert('Could Not Mark Watched', getErrorMessage(forceErr));
        }
        return;
      }

      Alert.alert('Could Not Mark Watched', getErrorMessage(err));
    }
  };

  const handleMarkSeasonAllWatched = async (seasonId: string, label: string) => {
    setMarkingAllSeasonId(seasonId);
    try {
      await runWatchAll(label, (body) => watchSeasonAll(seasonId, body));
    } finally {
      setMarkingAllSeasonId(null);
    }
  };

  const handleMarkSeriesAllReleased = async () => {
    setIsMarkingSeriesAll(true);
    try {
      await runWatchAll(data.title, (body) => watchSeriesAllReleased(data.id, body));
    } finally {
      setIsMarkingSeriesAll(false);
    }
  };

  const isMarkingNextEpisode = data.nextEpisode !== null && markingEpisodeId === data.nextEpisode.id;

  return (
    <Screen edges={['bottom']} contentContainerStyle={styles.scrollContent}>
      <View style={styles.backdropWrapper}>
        <PosterImage uri={data.backdropUrl} width="100%" height={BACKDROP_HEIGHT} radius={0} title={data.title} />
      </View>

      <View style={styles.header}>
        <PosterImage uri={data.posterUrl} width={POSTER_WIDTH} height={POSTER_HEIGHT} title={data.title} />
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={3}>
            {data.title}
          </Text>
          <View style={styles.badgeRow}>
            <StatusBadge status={data.releaseStatus} />
            <StatusBadge status={data.userStatus} />
          </View>
        </View>
      </View>

      {data.overview ? <Text style={styles.overview}>{data.overview}</Text> : null}

      {data.nextEpisode ? (
        <ContinueTrackingCard
          seasonNumber={data.nextEpisode.seasonNumber}
          episodeNumber={data.nextEpisode.episodeNumber}
          episodeTitle={data.nextEpisode.title}
          imageUrl={pickImage(data.nextEpisode.imageUrl, data.backdropUrl, data.posterUrl)}
          seriesTitle={data.title}
          onMarkWatched={() => data.nextEpisode && markWatchedMutation.mutate(data.nextEpisode.id)}
          isMarking={isMarkingNextEpisode}
          markDisabled={markWatchedMutation.isPending}
        />
      ) : null}

      <SectionHeader
        title="All Episodes"
        subtitle={seriesProgress.totalCount > 0 ? `${seriesProgress.watchedCount}/${seriesProgress.totalCount} watched` : undefined}
        action={
          seriesProgress.totalCount > 0 ? (
            <Pressable onPress={handleMarkSeriesAllReleased} disabled={isMarkingSeriesAll} hitSlop={8}>
              {isMarkingSeriesAll ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={styles.markAllReleasedText}>Mark All Released</Text>
              )}
            </Pressable>
          ) : undefined
        }
      />

      <View style={styles.seasonList}>
        {data.seasons.map((season) => (
          <SeasonAccordion
            key={season.seasonNumber}
            title={seasonDisplayTitle(season.seasonNumber, season.title)}
            episodes={season.episodes}
            seriesTitle={data.title}
            expanded={expandedSeasons.has(season.seasonNumber)}
            onToggle={() => toggleSeason(season.seasonNumber)}
            onMarkWatched={(episodeId) => markWatchedMutation.mutate(episodeId)}
            onEditNote={(episode) => setEditingEpisode(episode)}
            markingEpisodeId={markingEpisodeId}
            markDisabled={markWatchedMutation.isPending}
            onMarkAllWatched={(seasonId) =>
              handleMarkSeasonAllWatched(seasonId, seasonDisplayTitle(season.seasonNumber, season.title))
            }
            markingAllSeasonId={markingAllSeasonId}
          />
        ))}
      </View>

      <NoteEditModal
        visible={editingEpisode !== null}
        episodeLabel={
          editingEpisode ? episodeLabel(editingEpisode.seasonNumber, editingEpisode.episodeNumber, editingEpisode.title) : ''
        }
        initialText={editingEpisode?.note ?? null}
        isSaving={addNoteMutation.isPending}
        onClose={() => setEditingEpisode(null)}
        onSave={(text) => {
          if (editingEpisode?.episodeWatchId) {
            addNoteMutation.mutate({ watchId: editingEpisode.episodeWatchId, text });
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.xxl },
  backdropWrapper: { width: '100%', height: BACKDROP_HEIGHT },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: -POSTER_HEIGHT / 3,
  },
  headerText: { flex: 1, justifyContent: 'flex-end', gap: spacing.sm, paddingBottom: 2 },
  title: { ...typography.title },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  overview: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 21,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  markAllReleasedText: { fontSize: 13, fontWeight: '600', color: colors.accent },
  seasonList: { marginTop: spacing.xs },
});
