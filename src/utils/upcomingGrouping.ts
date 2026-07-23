// Pure client-side date/grouping logic for the Upcoming timeline. Mirrors
// (deliberately, minimally duplicated — same precedent as episodeRelease.ts)
// server/src/modules/me/upcoming-query-helpers.ts's ordering rule, but owns
// something the server can never own: "what is today, and which calendar
// day does each item belong under" — this app has no per-user timezone, so
// that's a device-local concern by construction. See
// server/docs/upcoming-timeline-todo.md's "Timezone / date-bucketing rule"
// section for the full reasoning this implements.

import { UpcomingDayBucket, UpcomingItem, UpcomingPage } from '../api/types';

// --- Local calendar-date primitives (device-local, never UTC) -------------

// "YYYY-MM-DD" from the DEVICE's local calendar date — deliberately local
// getters (getFullYear/getMonth/getDate), never UTC getters, since this is
// the one place "today" is decided for the whole feature.
export function getLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Local midnight for a "YYYY-MM-DD" key — the local (not UTC) Date
// constructor, so date-arithmetic (add/diff) happens in the device's own
// calendar space and is immune to UTC/local offset drift.
function parseLocalDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysToLocalDateKey(key: string, days: number): string {
  const date = parseLocalDateKey(key);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

// Integer number of local calendar days from `fromKey` to `toKey` (positive
// = toKey is later). Computed via each key's local-midnight Date, not a
// millisecond diff of two arbitrary instants — immune to DST (a 23h or 25h
// "day" near a DST transition still counts as exactly 1 calendar day here).
export function daysBetweenLocalDateKeys(fromKey: string, toKey: string): number {
  const from = parseLocalDateKey(fromKey);
  const to = parseLocalDateKey(toKey);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

// The calendar date to bucket/group an item under. Date-only items (today,
// always — no integrated provider supplies time-of-day) bucket under their
// RAW provider date string, unconverted — never through a timezone
// conversion, which is what avoids the classic "UTC midnight reads as
// yesterday afternoon in a negative-offset timezone" bug. A known-time item
// (architecturally supported, not reachable with current data) buckets
// under the device-local calendar date of its actual instant instead, since
// then there IS a precise real-world moment and the correct "day" is
// genuinely the user's local calendar day at that moment — this is exactly
// what lets a known time correctly "cross" the local calendar date boundary
// when that's actually true.
export function resolveEffectiveLocalDateKey(item: UpcomingItem): string {
  if (item.hasKnownReleaseTime) {
    return getLocalDateKey(new Date(item.airDateInstant));
  }
  return item.airDateOnly;
}

// --- Date-window pagination (mirrors the server's chosen model — see
// server/docs/upcoming-timeline-todo.md "Pagination") ------------------------

// Deliberately small — "a small amount of historical context above Today"
// (the product spec), not a full lookback. Keeping this small keeps Today's
// section index low in the initially-rendered list, which is what makes
// the mount-time scrollToLocation anchor reliable without a fake
// getItemLayout — see docs/upcoming-timeline-todo.md Phase 10 for the
// real-device bug (a visibly multi-step scroll settling on a still-wrong
// past date) a too-generous value here caused. Anything further back is one
// scroll-up gesture away via onStartReached pagination (Phase 9).
export const UPCOMING_INITIAL_PAST_DAYS = 3;
// Initial span kept under the server's 45-day max window (3+30=33).
export const UPCOMING_INITIAL_FUTURE_DAYS = 30;
// Subsequent scroll-triggered page size in each direction. Was 30 — Phase 15
// shrank it to 10: on web (no maintainVisibleContentPosition compensation on
// prepend, see SCROLL_RESET_DISTANCE_PX below), a single auto-load's content
// jump is roughly proportional to this many days' worth of items, and 30
// days was routinely 60-100+ items appearing under the user in one shot
// (confirmed via remoteLogger: 26 items/9 sections -> 95 items/33 sections
// from ONE auto-load, within 3 seconds of landing on Today). 10 keeps a
// single load's visual jump small enough to not read as "loads lots of past
// shows and jumps there" while still fetching enough to make continued
// scrolling feel continuous.
export const UPCOMING_PAGE_WINDOW_DAYS = 10;

export interface UpcomingWindow {
  from: string;
  to: string;
}

export function getInitialUpcomingWindow(todayKey: string): UpcomingWindow {
  return {
    from: addDaysToLocalDateKey(todayKey, -UPCOMING_INITIAL_PAST_DAYS),
    to: addDaysToLocalDateKey(todayKey, UPCOMING_INITIAL_FUTURE_DAYS + 1),
  };
}

export function getPreviousUpcomingWindow(currentFromKey: string): UpcomingWindow {
  return { from: addDaysToLocalDateKey(currentFromKey, -UPCOMING_PAGE_WINDOW_DAYS), to: currentFromKey };
}

export function getNextUpcomingWindow(currentToKeyExclusive: string): UpcomingWindow {
  return { from: currentToKeyExclusive, to: addDaysToLocalDateKey(currentToKeyExclusive, UPCOMING_PAGE_WINDOW_DAYS) };
}

// --- Within-day ordering (mirrors upcoming-query-helpers.ts's server rule) -

export function compareUpcomingItemsWithinDay(a: UpcomingItem, b: UpcomingItem): number {
  if (a.hasKnownReleaseTime !== b.hasKnownReleaseTime) {
    return a.hasKnownReleaseTime ? -1 : 1;
  }
  if (a.hasKnownReleaseTime && b.hasKnownReleaseTime) {
    const diff = new Date(a.airDateInstant).getTime() - new Date(b.airDateInstant).getTime();
    if (diff !== 0) return diff;
  } else {
    const titleDiff = a.seriesTitle.localeCompare(b.seriesTitle, undefined, { sensitivity: 'base' });
    if (titleDiff !== 0) return titleDiff;
  }
  if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
  if (a.episodeNumber !== b.episodeNumber) return a.episodeNumber - b.episodeNumber;
  return a.episodeId.localeCompare(b.episodeId);
}

// --- Section headers --------------------------------------------------------

export type UpcomingSectionKind = 'pastDate' | 'yesterday' | 'today' | 'tomorrow' | 'weekday' | 'later';

// Offsets -1/0/1 = Yesterday/Today/Tomorrow; 2..7 = weekday name (future
// only — see docs/upcoming-timeline-todo.md, past never gets weekday
// names, it jumps straight from Yesterday to an absolute date); >=8 = Later
// (single shared section); <=-2 = an individual absolute-date past section.
export function getSectionKindForOffset(offset: number): UpcomingSectionKind {
  if (offset <= -2) return 'pastDate';
  if (offset === -1) return 'yesterday';
  if (offset === 0) return 'today';
  if (offset === 1) return 'tomorrow';
  if (offset <= 7) return 'weekday';
  return 'later';
}

export function formatSectionTitle(kind: UpcomingSectionKind, dateKey: string, todayKey: string): string {
  switch (kind) {
    case 'yesterday':
      return 'Yesterday';
    case 'today':
      return 'Today';
    case 'tomorrow':
      return 'Tomorrow';
    case 'weekday':
      return parseLocalDateKey(dateKey).toLocaleDateString(undefined, { weekday: 'long' });
    case 'later':
      return 'Later';
    case 'pastDate': {
      const date = parseLocalDateKey(dateKey);
      const sameYear = parseLocalDateKey(todayKey).getFullYear() === date.getFullYear();
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
    }
  }
}

// Always an integer day count, never converted to weeks/months — see
// docs/upcoming-timeline-todo.md "Later section".
export function formatDaysUntil(dayOffset: number): string {
  return `${dayOffset} day${dayOffset === 1 ? '' : 's'}`;
}

// --- Building the full section list from loaded pages ----------------------

export type UpcomingRow =
  | { type: 'item'; key: string; item: UpcomingItem; dayOffset: number }
  | { type: 'empty'; key: string; message: string };

export interface UpcomingSection {
  key: string;
  kind: UpcomingSectionKind;
  title: string;
  data: UpcomingRow[];
}

// Builds the final, ordered section list from every currently-loaded day
// bucket (across however many pages have been fetched so far), re-bucketing
// by the effective local date rather than trusting the server's raw
// (unconverted) date key directly (see resolveEffectiveLocalDateKey), then
// injecting an empty "Today" section when today has zero items but falls
// within the currently-loaded [loadedFromKey, loadedToKeyExclusive) span —
// so Today is always visible as an anchor even on a quiet day, without ever
// implying the whole library is empty (see docs/upcoming-timeline-todo.md
// "Today focus").
export function buildUpcomingSections(
  days: UpcomingDayBucket[],
  todayKey: string,
  loadedFromKey: string,
  loadedToKeyExclusive: string,
): UpcomingSection[] {
  const byDate = new Map<string, UpcomingItem[]>();
  for (const bucket of days) {
    for (const item of bucket.items) {
      const key = resolveEffectiveLocalDateKey(item);
      const existing = byDate.get(key);
      if (existing) existing.push(item);
      else byDate.set(key, [item]);
    }
  }

  const todayInRange = todayKey >= loadedFromKey && todayKey < loadedToKeyExclusive;
  if (todayInRange && !byDate.has(todayKey)) {
    byDate.set(todayKey, []);
  }

  const sortedDateKeys = [...byDate.keys()].sort((a, b) => a.localeCompare(b));

  const sections: UpcomingSection[] = [];
  let laterSection: UpcomingSection | null = null;

  for (const dateKey of sortedDateKeys) {
    const offset = daysBetweenLocalDateKeys(todayKey, dateKey);
    const kind = getSectionKindForOffset(offset);
    const items = [...(byDate.get(dateKey) ?? [])].sort(compareUpcomingItemsWithinDay);
    const rows: UpcomingRow[] =
      items.length > 0
        ? items.map((item) => ({ type: 'item' as const, key: item.episodeId, item, dayOffset: offset }))
        : [{ type: 'empty' as const, key: `${dateKey}-empty`, message: 'Nothing releasing today' }];

    if (kind === 'later') {
      if (!laterSection) {
        laterSection = { key: 'later', kind: 'later', title: 'Later', data: [] };
        sections.push(laterSection);
      }
      laterSection.data.push(...rows);
    } else {
      sections.push({ key: dateKey, kind, title: formatSectionTitle(kind, dateKey, todayKey), data: rows });
    }
  }

  return sections;
}

// --- Cache patching (mirrors SeriesDetailScreen's setQueryData-in-place ----
// pattern — see applyUnwatchToSeriesDetail) -------------------------------

// Patches one item (by episodeId) across every loaded page's day buckets,
// in place, immediately after a successful mark-watched/unwatch mutation —
// so the card's checkmark flips instantly without waiting on/forcing a
// background refetch of the whole timeline. Upcoming's core product rule
// ("the card stays, only its watched visual state changes") falls directly
// out of this: nothing removes or reorders the item, it's simply replaced
// with an updated copy at the same position.
export function patchUpcomingItemInPages(pages: UpcomingPage[], episodeId: string, patch: Partial<UpcomingItem>): UpcomingPage[] {
  return pages.map((page) => ({
    ...page,
    days: page.days.map((day) => {
      if (!day.items.some((item) => item.episodeId === episodeId)) return day;
      return { ...day, items: day.items.map((item) => (item.episodeId === episodeId ? { ...item, ...patch } : item)) };
    }),
  }));
}

// --- Today-anchor decision logic (framework-free — see
// UpcomingTimeline.tsx and docs/upcoming-timeline-todo.md Phase 8 for the
// full root-cause writeup of the bug these functions fix) ------------------

// The index of the section to scroll to for "Today" — a section carrying
// kind 'today' always exists whenever buildUpcomingSections was given a
// loaded range containing todayKey, REGARDLESS of whether that day has any
// releases (see buildUpcomingSections' synthesized-empty-section behavior
// above) — so this never needs a separate "what if today is empty" branch.
export function findTodaySectionIndex(sections: UpcomingSection[]): number {
  return sections.findIndex((s) => s.kind === 'today');
}

// The section to actually SCROLL to — Today if it has any releases, else
// the next chronological section (tomorrow, the day after, ... or the
// aggregate "Later" section) that does. Every section other than a
// possibly-empty synthesized Today always has at least one item by
// construction (buildUpcomingSections never creates an empty section for
// any other date), so in practice this only ever needs to skip forward at
// most one step — the forward scan and defensive "does it have an item"
// check exist purely so this never silently lands on another empty section
// if that assumption ever stops holding. Falls back to Today's own (empty)
// index if nothing later in the currently-loaded window has anything
// either, rather than returning -1 and scrolling nowhere.
export function findAnchorSectionIndex(sections: UpcomingSection[]): number {
  const todayIndex = findTodaySectionIndex(sections);
  if (todayIndex === -1) return -1;
  if (sections[todayIndex].data.some((row) => row.type === 'item')) return todayIndex;
  for (let i = todayIndex + 1; i < sections.length; i++) {
    if (sections[i].data.some((row) => row.type === 'item')) return i;
  }
  return todayIndex;
}

export interface InitialAnchorDecisionInput {
  // Whether Upcoming is the panel currently visible (mode === 'upcoming')
  // — never scroll a hidden SectionList (see Phase 8: a display:'none'
  // ancestor never gets a real layout pass, so scrolling it either throws
  // or lands wrong).
  isActive: boolean;
  // Set only from the SectionList's own onLayout reporting a real (>0)
  // height — the one-time, native, event-driven signal that it has
  // genuinely been laid out, as opposed to assumed-ready after an
  // arbitrary timeout.
  hasLaidOut: boolean;
  // True once the automatic first-entry anchor has already fired for this
  // mount (or since the last actual date rollover) — prevents repeating it
  // on ordinary rerenders, background refetches, or a switch-away-and-back
  // within the same preserved session.
  hasAnchoredAlready: boolean;
  sections: UpcomingSection[];
}

// The exact decision UpcomingTimeline's mount-time anchor effect makes,
// extracted as a pure function so it's directly unit-testable without
// mounting a real SectionList/QueryClient/NavigationContainer. Returns
// true only on a genuine first-ever-visible-and-laid-out entry with data
// ready — never on a rerender that doesn't change any of these inputs,
// never while hidden, never a second time after having already anchored.
export function shouldPerformInitialAnchor(input: InitialAnchorDecisionInput): boolean {
  if (!input.isActive || !input.hasLaidOut || input.hasAnchoredAlready) return false;
  return findTodaySectionIndex(input.sections) !== -1;
}

// The exact bound handleScrollToIndexFailed enforces: retryCount is the
// number of retries ALREADY performed (0 before the first retry) — returns
// false once maxRetries have already happened, so a pathological case
// (sections never settling, or a device that never finishes measuring)
// cannot become an infinite retry loop or a runaway timer chain.
export function canRetryScrollToToday(retryCount: number, maxRetries: number): boolean {
  return retryCount < maxRetries;
}

// A freshly-mounted SectionList always starts at scroll offset 0 — already
// "at the start" of its content — which trivially satisfies
// onStartReachedThreshold, so onStartReached (and, less commonly,
// onEndReached for a short initial render) can fire on mount, BEFORE the
// initial Today anchor has had a chance to run (hasLaidOut is set async,
// from a real onLayout event). Left ungated, this becomes a runaway loop:
// each auto-loaded page still leaves the list sitting at ~offset 0 (nothing
// has scrolled it away yet), so it can fire again for another page, growing
// `sections` far beyond the intended initial window before the anchor ever
// gets a stable target — see docs/upcoming-timeline-todo.md Phase 9 for the
// real-device bug this caused (opened on a date over a month in the past
// instead of Today).
//
// Phase 11 (web): the same runaway recurs on web for a deeper reason a
// simple "has anchored" flag can't fix — react-native-web doesn't
// compensate scroll offset when content is prepended/appended
// (maintainVisibleContentPosition isn't respected by its SectionList), so
// the list can read as "still near the edge" after every auto-loaded page,
// not just before the first one. Two gates, not one:
//
// - hasUserScrolled must be true before ANY auto-load is allowed at all —
//   without this, even a small per-direction cap still lets onStartReached
//   AND onEndReached each fire their own bounded burst simultaneously right
//   at mount (before the user has done anything), landing away from Today
//   even though the burst is bounded. hasUserScrolled only ever becomes
//   true from UpcomingTimeline.tsx's onScroll reporting a real, meaningful
//   displacement from an edge (isScrolledAwayFromStart/End) — which the
//   small, deliberately-low-index Today anchor scroll does not itself
//   produce, but genuine user scrolling does.
// - Once hasUserScrolled is true, autoLoadCount/maxAutoLoadsSinceReset caps
//   how many *consecutive, unreset* auto-triggered loads can happen in one
//   direction — still needed even after real scrolling starts, since the
//   same uncompensated-prepend problem can otherwise resume mid-session.
//   UpcomingTimeline.tsx resets the relevant counter back to 0 whenever
//   onScroll reports the list genuinely away from that edge again — a
//   permanently-stuck list (the web bug) can, by construction, never
//   report that, so it stays capped; ordinary scrolling resets constantly
//   and effectively never hits the cap.
//
// Phase 12 (web): `isActive` closes a real-device runaway confirmed via
// remoteLogger breadcrumbs — onStartReached/onEndReached are live
// callbacks on a component that never unmounts (both Watch List and
// Upcoming panels stay mounted, toggling display:'none' — see
// WatchlistScreen.tsx), so they keep firing even while the panel is
// hidden. Toggling display:'none' on/off itself made react-native-web's
// SectionList misreport its viewport as "near the start", and since
// hasAnchoredAlready/hasUserScrolled were already true from a previous
// visit, every other gate here passed — logged as a burst of 7 auto-loads
// in under 2 seconds, ballooning a 9-section timeline to 201 sections and
// breaking both manual scroll-up (the target edge kept moving) and the
// scrollToToday tab-reselect (its target index no longer fit inside
// initialNumToRender). Auto-loading must never fire for a panel that
// isn't the one currently visible.
export function canAutoLoadMorePages(
  isActive: boolean,
  hasAnchoredAlready: boolean,
  hasMorePage: boolean,
  isFetchingPage: boolean,
  hasUserScrolled: boolean,
  autoLoadCount: number,
  maxAutoLoadsSinceReset: number,
): boolean {
  if (!isActive || !hasAnchoredAlready || !hasMorePage || isFetchingPage || !hasUserScrolled) return false;
  return autoLoadCount < maxAutoLoadsSinceReset;
}

// Small and deliberately generous relative to native's typical case (where
// the anchor scroll succeeds and the list genuinely moves away from the
// edge, so the counter keeps resetting and this rarely binds at all) — just
// enough to survive a stuck-at-the-edge web session without letting the
// unreset auto-load burst run away indefinitely.
export const MAX_AUTO_LOAD_PAGES_SINCE_RESET = 2;

// How far (in px) the scroll offset needs to be from an edge before that
// edge's auto-load counter resets (see canAutoLoadMorePages) — comfortably
// more than one card's height, so a couple of cards' worth of genuine
// scrolling away from the boundary counts as "not stuck there", without
// being so large that just reading near an edge keeps the cap engaged.
//
// Phase 14: this threshold alone isn't enough — the caller
// (UpcomingTimeline.tsx's onScroll) must also skip the reset entirely
// while isProgrammaticScrollRef is set, not just gate the hasUserScrolled
// latch by it. Confirmed via a real session's remoteLogger breadcrumbs:
// autoPreviousLoadCount kept resetting to 0 almost every single time
// (logged autoLoadCount values of 1,1,1,1,2,1,1,2... instead of climbing
// to MAX_AUTO_LOAD_PAGES_SINCE_RESET and stopping), because prepending a
// page itself fires an onScroll event reporting "away from start" (web
// doesn't compensate scroll position on prepend/append — the same
// limitation noted throughout this file), and that self-inflicted event
// was resetting the very counter meant to cap it. 32 items became 523
// across 9 pages in under 5 seconds from "scrolling just a little."
//
// Phase 15: raised 200 -> 400. The Today anchor (only UPCOMING_INITIAL_-
// PAST_DAYS=3 days of past context above it, by design — see Phase 10)
// already rests fairly close to the list's start on a typical library, so
// 200px of ordinary scroll "settling" or a small deliberate glance upward
// could exceed this threshold without the user meaning to request more
// history at all — immediately latching hasUserScrolled and unlocking
// onStartReached's auto-load off what was essentially still just "arriving
// at Today." 400px asks for a clearly deliberate scroll (more than a
// screen's worth on most devices) before treating it as "the user wants
// more history," while remaining comfortably below what a real scroll-up
// gesture covers.
export const SCROLL_RESET_DISTANCE_PX = 400;

export function isScrolledAwayFromStart(contentOffsetY: number): boolean {
  return contentOffsetY > SCROLL_RESET_DISTANCE_PX;
}

export function isScrolledAwayFromEnd(contentOffsetY: number, contentHeight: number, layoutHeight: number): boolean {
  const distanceFromEnd = contentHeight - layoutHeight - contentOffsetY;
  return distanceFromEnd > SCROLL_RESET_DISTANCE_PX;
}
