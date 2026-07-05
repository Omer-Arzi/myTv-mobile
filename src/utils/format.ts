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

// "IN_PRODUCTION" -> "In Production", "CAUGHT_UP" -> "Caught Up" — badges
// read the enum values directly otherwise, which reads as shouting.
export function formatStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
