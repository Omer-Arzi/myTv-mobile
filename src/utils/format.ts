export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function episodeLabel(seasonNumber: number, episodeNumber: number, title: string | null): string {
  const code = `S${seasonNumber}E${episodeNumber}`;
  return title ? `${code} — ${title}` : code;
}

// Product-facing wording that deliberately differs from a mechanical
// enum-case conversion. PAUSED's product meaning ("paused, may continue
// later") reads as "On hold" everywhere a user sees it, even though the
// stored/API value stays PAUSED (see server/docs/on-hold-dropped-status-todo.md
// Phase 3 — reusing the existing enum value rather than adding a
// differently-named duplicate). Safe as a flat override here because
// ReleaseStatus and UserSeriesStatus never share a raw string value (same
// assumption theme/statusColors.ts already relies on) — this function is
// used for both.
const STATUS_LABEL_OVERRIDES: Record<string, string> = {
  PAUSED: 'On hold',
};

// "IN_PRODUCTION" -> "In Production", "CAUGHT_UP" -> "Caught Up" — badges
// read the enum values directly otherwise, which reads as shouting.
export function formatStatusLabel(status: string): string {
  const override = STATUS_LABEL_OVERRIDES[status];
  if (override) return override;

  return status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// The ONE place a ProviderCandidate.confidenceScore (canonical 0..1 — see
// api/types/migration-workbench.ts) is ever converted to a percentage for
// display. Introduced alongside the fix for a real bug where a candidate's
// raw 0..1 confidence was displayed correctly as "80%" but then sent
// back to the server AS "80" (not 0.8) on confirm — the server's 0..1
// validation rejected it with "confidence must not be greater than 1".
// Never do the *100/Math.round formatting inline at a call site again;
// always go through this function so display and the value sent back to
// the server can never drift apart.
export function formatConfidencePercent(confidenceScore: number): string {
  return `${Math.round(confidenceScore * 100)}%`;
}
