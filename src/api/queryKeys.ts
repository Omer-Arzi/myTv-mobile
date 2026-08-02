import { ListSeriesParams } from './endpoints/series';

// Centralized so a future mutation (e.g. mark-watched, status update) can
// invalidate the right queries without every screen needing to know the
// exact key shape.
export const queryKeys = {
  home: ['home'] as const,
  seriesDetail: (seriesId: string) => ['series', seriesId] as const,
  seriesList: (params: ListSeriesParams) => ['series', 'list', params] as const,
  // Prefix of every seriesList(params) key regardless of status/limit —
  // TanStack Query's default partial-key matching means invalidating this
  // alone refreshes every status-filtered variant a caller might have
  // cached (e.g. the merged Watch List panel's WATCHING and CAUGHT_UP tabs
  // both refetch), without needing to know which one is currently active.
  seriesLists: ['series', 'list'] as const,
  migrationWorkbench: ['migration-workbench'] as const,
  migrationProposal: (seriesId: string) => ['migration-workbench', seriesId, 'proposal'] as const,
  providerCandidates: (seriesId: string) => ['migration-workbench', seriesId, 'candidates'] as const,
  migrationHistory: ['migration-workbench', 'history'] as const,
  migrationHistoryDetail: (migrationId: string) => ['migration-workbench', 'history', migrationId] as const,
  search: (query: string) => ['search', query] as const,
  // Keyed on the local "today" the timeline was anchored to at mount time
  // (not on every from/to window) — useInfiniteQuery owns paging within
  // this one key via getPreviousPageParam/getNextPageParam. See
  // UpcomingTimeline.tsx / src/utils/upcomingGrouping.ts.
  upcoming: (anchorDateKey: string) => ['upcoming', anchorDateKey] as const,
  syncStatus: ['sync', 'library-status'] as const,
};
