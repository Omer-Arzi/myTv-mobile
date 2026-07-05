// Returns the first non-null/non-empty candidate, in priority order.
// Callers pass candidates in whichever order makes sense for their card
// shape — a compact landscape thumbnail (episode still first) reads
// differently than a tall poster card (poster first, episode still only as
// a fallback) — so the ordering is the caller's job, not baked in here.
export function pickImage(...candidates: (string | null | undefined)[]): string | null {
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return null;
}
