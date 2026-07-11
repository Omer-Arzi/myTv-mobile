import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { EpisodeDetail } from '../api/types';
import { spacing } from '../theme/theme';
import { computeSeasonProgress } from '../utils/seasonProgress';
import { EpisodeCard } from './EpisodeCard';
import { SeasonHeader } from './SeasonHeader';

interface Props {
  title: string;
  episodes: EpisodeDetail[];
  seriesTitle: string;
  expanded: boolean;
  onToggle: () => void;
  onMarkWatched: (episodeId: string) => void;
  onEditNote: (episode: EpisodeDetail) => void;
  markingEpisodeId: string | null;
  markDisabled: boolean;
  onUnwatch: (episode: EpisodeDetail) => void;
  unwatchingEpisodeId: string | null;
  unwatchDisabled: boolean;
  // GET /series/:id's SeasonDetail has no id of its own — every episode in
  // it carries seasonId (mirrors EpisodeSummaryDto), and since seasonNumber
  // is unique per series, all episodes here share the same one. Derived
  // rather than passed down, so callers don't need to know this quirk.
  onMarkAllWatched: (seasonId: string) => void;
  markingAllSeasonId: string | null;
}

// One collapsible card per season: SeasonHeader is always visible (title,
// progress bar, watched count, complete check); the episode rows underneath
// only mount while expanded, so a series with many seasons doesn't render
// hundreds of EpisodeCards up front.
export function SeasonAccordion({
  title,
  episodes,
  seriesTitle,
  expanded,
  onToggle,
  onMarkWatched,
  onEditNote,
  markingEpisodeId,
  markDisabled,
  onMarkAllWatched,
  markingAllSeasonId,
  onUnwatch,
  unwatchingEpisodeId,
  unwatchDisabled,
}: Props) {
  const progress = useMemo(() => computeSeasonProgress(episodes), [episodes]);
  const seasonId = episodes[0]?.seasonId ?? null;

  return (
    <View style={styles.container}>
      <SeasonHeader
        title={title}
        progress={progress}
        expanded={expanded}
        onPress={onToggle}
        onMarkAllWatched={seasonId ? () => onMarkAllWatched(seasonId) : undefined}
        isMarkingAll={seasonId !== null && markingAllSeasonId === seasonId}
      />
      {expanded ? (
        <View style={styles.episodeList}>
          {episodes.map((episode) => (
            <EpisodeCard
              key={episode.id}
              episodeNumber={episode.episodeNumber}
              title={episode.title}
              imageUrl={episode.imageUrl}
              seriesTitle={seriesTitle}
              airDate={episode.airDate}
              watched={episode.watched}
              watchedAt={episode.watchedAt}
              note={episode.note}
              canEditNote={episode.watched && episode.episodeWatchId !== null}
              onMarkWatched={() => onMarkWatched(episode.id)}
              onEditNote={() => onEditNote(episode)}
              isMarking={markingEpisodeId === episode.id}
              markDisabled={markDisabled}
              onUnwatch={episode.watched && episode.episodeWatchId ? () => onUnwatch(episode) : undefined}
              isUnwatching={unwatchingEpisodeId === episode.id}
              unwatchDisabled={unwatchDisabled}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  episodeList: { marginTop: spacing.xs },
});
