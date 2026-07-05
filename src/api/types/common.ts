// Mirrors prisma/schema.prisma's ReleaseStatus/UserSeriesStatus enums in
// the backend (server/prisma/schema.prisma) — kept as plain string unions
// here since the mobile app has no Prisma client of its own.

export type ReleaseStatus = 'UNKNOWN' | 'RETURNING' | 'ENDED' | 'CANCELLED' | 'IN_PRODUCTION';

export type UserSeriesStatus = 'UNKNOWN' | 'WATCHLIST' | 'WATCHING' | 'PAUSED' | 'DROPPED' | 'CAUGHT_UP' | 'COMPLETED';

// The only statuses PATCH /series/:seriesId/status accepts — see
// API_CONTRACT.md. Not used by any screen yet (that endpoint isn't wired
// up on the client side in this pass), kept here for when it is.
export type ManualUserStatus = 'WATCHING' | 'PAUSED' | 'DROPPED' | 'WATCHLIST';
