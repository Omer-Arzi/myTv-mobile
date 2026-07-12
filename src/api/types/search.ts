import { UserSeriesStatus } from './common';

// Mirrors server/src/modules/search/dto/search-result.dto.ts (GET /search).
// A discriminated union, same pragmatic "every field optional, discriminate
// on type" shape the server DTO itself uses — see that file's comment.

export type SearchProvider = 'tmdb' | 'tvmaze';

export interface SearchResultNextEpisode {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string | null;
}

export interface SearchResultProviderRef {
  provider: SearchProvider;
  providerId: string;
}

export type SearchResultLibraryMatch =
  | {
      type: 'EXACT';
      seriesId: string;
      userStatus: UserSeriesStatus;
      nextEpisode: SearchResultNextEpisode | null;
      needsAttention: boolean;
      attentionReasonCode: string | null;
    }
  | {
      type: 'POSSIBLE';
      seriesId: string;
      seriesTitle: string;
      seriesUserStatus: UserSeriesStatus;
      confidence: number;
      reason: string;
    }
  | { type: 'NONE' };

export type SearchPrimaryAction = 'OPEN_SERIES' | 'REVIEW_SERIES' | 'COMPARE_MATCH' | 'ADD_TO_WATCHLIST';

export interface SeriesSearchResult {
  resultKey: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  providers: SearchResultProviderRef[];
  libraryMatch: SearchResultLibraryMatch;
  primaryAction: SearchPrimaryAction;
  relevanceScore: number;
}

export interface SearchResultsPage {
  results: SeriesSearchResult[];
  nextCursor: string | null;
  hadProviderFailure: boolean;
}
