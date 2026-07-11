import { UserSeriesStatus, WatchlistItem } from '../api/types';

export interface WatchlistSection {
  status: UserSeriesStatus;
  title: string;
  items: WatchlistItem[];
}

// Fixed section order for the Watchlist tab's new "active library" layout
// — Watching, then Caught Up, then Watchlist. GET /watchlist already
// returns only these three statuses, already sorted alphabetically by
// title (server/src/modules/watchlist/watchlist-query-helpers.ts) — this
// is a pure partition into sections, not a re-sort, so each section stays
// alphabetical because Array.filter preserves relative order.
const SECTION_DEFINITIONS: { status: UserSeriesStatus; label: string }[] = [
  { status: 'WATCHING', label: 'Watching' },
  { status: 'CAUGHT_UP', label: 'Caught Up' },
  { status: 'WATCHLIST', label: 'Watchlist' },
];

// Groups already-sorted watchlist items into their sections, computing a
// "Title (count)" header per section, and dropping any section with zero
// items entirely (never rendered as an empty section with just a header).
export function groupWatchlistItems(items: WatchlistItem[]): WatchlistSection[] {
  return SECTION_DEFINITIONS.map(({ status, label }) => {
    const sectionItems = items.filter((item) => item.userStatus === status);
    return { status, title: `${label} (${sectionItems.length})`, items: sectionItems };
  }).filter((section) => section.items.length > 0);
}
