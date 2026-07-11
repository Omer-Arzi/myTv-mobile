// Mobile-side mirror of server/src/common/is-episode-released.ts's
// canonical released predicate — mobile has no shared runtime with the
// server, so this is a deliberate, minimal, one-line duplication (same
// precedent as formatDate/episodeLabel already being independently
// implemented here), not a second competing rule. Semantics must stay
// identical: null airDate -> not released (conservative); airDate <= now
// -> released.
//
// Used only as client-side defense-in-depth (e.g. disabling a "mark
// watched" affordance for a future episode in SeriesDetailScreen) — the
// server (EpisodeWatchService.markWatched) is the real enforcement
// boundary and rejects a future-episode watch attempt regardless of what
// the client does.
export function isEpisodeReleased(airDate: string | null, now: Date = new Date()): boolean {
  if (!airDate) return false;
  const parsed = new Date(airDate);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() <= now.getTime();
}
