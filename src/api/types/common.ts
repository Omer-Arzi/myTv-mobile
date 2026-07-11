// Mirrors prisma/schema.prisma's ReleaseStatus/UserSeriesStatus enums in
// the backend (server/prisma/schema.prisma) — kept as plain string unions
// here since the mobile app has no Prisma client of its own.

export type ReleaseStatus = 'UNKNOWN' | 'RETURNING' | 'ENDED' | 'CANCELLED' | 'IN_PRODUCTION';

export type UserSeriesStatus = 'UNKNOWN' | 'WATCHLIST' | 'WATCHING' | 'PAUSED' | 'DROPPED' | 'CAUGHT_UP' | 'COMPLETED';

// The only statuses PATCH /series/:seriesId/status accepts — see
// API_CONTRACT.md. Used by SeriesDetailScreen's status-actions menu (see
// src/utils/seriesStatusActions.ts) via api/endpoints/series.ts's
// updateSeriesStatus().
export type ManualUserStatus = 'WATCHING' | 'PAUSED' | 'DROPPED' | 'WATCHLIST';
