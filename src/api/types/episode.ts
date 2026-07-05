// Mirrors server/src/common/dto/episode-summary.dto.ts
export interface EpisodeSummary {
  id: string;
  seasonId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string | null;
  overview: string | null;
  airDate: string | null;
  runtimeMinutes: number | null;
  imageUrl: string | null;
}

// Mirrors server/src/modules/episodes/dto/episode-watch.dto.ts
export interface EpisodeWatch {
  id: string;
  watchedAt: string;
  note: string | null;
  episode: EpisodeSummary;
}
