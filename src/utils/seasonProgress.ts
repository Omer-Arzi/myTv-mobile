import { EpisodeDetail } from '../api/types';

export interface SeasonProgress {
  totalCount: number;
  watchedCount: number;
  releasedCount: number;
  // 0-1, watched/total — the denominator is total known episodes rather
  // than released-so-far, matching how the season header reads ("1/14")
  // even mid-air for a currently-releasing season.
  progress: number;
  isFullyWatched: boolean;
  // At least one released episode hasn't been watched yet — distinct from
  // "not fully watched," since a season can be fully caught up on
  // everything released while still having unaired episodes in its total
  // count. Not surfaced in the UI yet; kept for a future "mark all
  // released as watched" action (see SeriesDetailScreen's TODO).
  hasUnwatchedReleasedEpisodes: boolean;
}

function isReleased(airDate: string | null, now: Date): boolean {
  if (!airDate) return false;
  const date = new Date(airDate);
  return !Number.isNaN(date.getTime()) && date.getTime() <= now.getTime();
}

export function computeSeasonProgress(episodes: EpisodeDetail[], now: Date = new Date()): SeasonProgress {
  const totalCount = episodes.length;
  const watchedCount = episodes.filter((e) => e.watched).length;
  const releasedCount = episodes.filter((e) => isReleased(e.airDate, now)).length;

  return {
    totalCount,
    watchedCount,
    releasedCount,
    progress: totalCount > 0 ? watchedCount / totalCount : 0,
    isFullyWatched: totalCount > 0 && watchedCount === totalCount,
    hasUnwatchedReleasedEpisodes: releasedCount > watchedCount,
  };
}

export function seasonDisplayTitle(seasonNumber: number, title: string | null): string {
  if (title) return title;
  return seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber}`;
}
