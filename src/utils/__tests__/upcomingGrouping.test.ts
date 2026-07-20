import { UpcomingDayBucket, UpcomingItem, UpcomingPage } from '../../api/types';
import {
  addDaysToLocalDateKey,
  buildUpcomingSections,
  canAutoLoadMorePages,
  canRetryScrollToToday,
  compareUpcomingItemsWithinDay,
  daysBetweenLocalDateKeys,
  findAnchorSectionIndex,
  findTodaySectionIndex,
  formatDaysUntil,
  formatSectionTitle,
  getInitialUpcomingWindow,
  getLocalDateKey,
  getNextUpcomingWindow,
  getPreviousUpcomingWindow,
  getSectionKindForOffset,
  isScrolledAwayFromEnd,
  isScrolledAwayFromStart,
  MAX_AUTO_LOAD_PAGES_SINCE_RESET,
  patchUpcomingItemInPages,
  resolveEffectiveLocalDateKey,
  SCROLL_RESET_DISTANCE_PX,
  shouldPerformInitialAnchor,
  UpcomingRow,
  UpcomingSection,
} from '../upcomingGrouping';

function makeItem(overrides: Partial<UpcomingItem> = {}): UpcomingItem {
  return {
    seriesId: 's1',
    seriesTitle: 'Alpha Show',
    posterUrl: null,
    episodeId: 'e1',
    seasonId: 'se1',
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: null,
    airDateOnly: '2026-07-15',
    airDateInstant: '2026-07-15T00:00:00.000Z',
    hasKnownReleaseTime: false,
    isReleased: true,
    isWatched: false,
    episodeWatchId: null,
    seriesUserStatus: 'WATCHING',
    seriesReleaseStatus: 'RETURNING',
    badges: { seasonPremiere: false, seriesPremiere: false },
    ...overrides,
  };
}

describe('getLocalDateKey / addDaysToLocalDateKey / daysBetweenLocalDateKeys', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(getLocalDateKey(new Date(2026, 6, 5))).toBe('2026-07-05');
  });

  it('pads single-digit month/day', () => {
    expect(getLocalDateKey(new Date(2026, 0, 9))).toBe('2026-01-09');
  });

  it('adds/subtracts days across month and year boundaries', () => {
    expect(addDaysToLocalDateKey('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDaysToLocalDateKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysToLocalDateKey('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('computes day differences using calendar dates, not raw ms/24h division', () => {
    expect(daysBetweenLocalDateKeys('2026-07-15', '2026-07-15')).toBe(0);
    expect(daysBetweenLocalDateKeys('2026-07-15', '2026-07-16')).toBe(1);
    expect(daysBetweenLocalDateKeys('2026-07-16', '2026-07-15')).toBe(-1);
    expect(daysBetweenLocalDateKeys('2026-07-15', '2026-08-22')).toBe(38);
  });

  it('is immune to DST — a "day" spanning a DST transition still counts as exactly 1', () => {
    // US DST spring-forward 2026-03-08 (a 23-hour local day in US timezones)
    // — regardless of host TZ, calendar-date arithmetic must still say 1.
    expect(daysBetweenLocalDateKeys('2026-03-07', '2026-03-08')).toBe(1);
    expect(daysBetweenLocalDateKeys('2026-03-08', '2026-03-09')).toBe(1);
  });
});

describe('resolveEffectiveLocalDateKey', () => {
  it('uses the raw airDateOnly verbatim when the time is unknown — no conversion at all', () => {
    const item = makeItem({ airDateOnly: '2026-07-15', airDateInstant: '2026-07-15T00:00:00.000Z', hasKnownReleaseTime: false });
    expect(resolveEffectiveLocalDateKey(item)).toBe('2026-07-15');
  });

  it('delegates to the device-local calendar date of the instant when the time is known', () => {
    const instant = '2026-07-15T21:30:00.000Z';
    const item = makeItem({ airDateOnly: '2026-07-15', airDateInstant: instant, hasKnownReleaseTime: true });
    expect(resolveEffectiveLocalDateKey(item)).toBe(getLocalDateKey(new Date(instant)));
  });

  it('a known-time instant near a day boundary can resolve to a DIFFERENT local date than the raw airDateOnly (the "crossing" case)', () => {
    // This test's environment runs with a positive UTC offset (Asia/Jerusalem,
    // UTC+3 in July) — a late-UTC instant on 2026-07-15 is already
    // 2026-07-16 local. If this suite ever runs in a different host
    // timezone this specific assertion may need adjusting, but the
    // resolveEffectiveLocalDateKey contract itself (delegate to local date
    // of the instant) is verified timezone-independently above.
    const instant = '2026-07-15T22:00:00.000Z';
    const item = makeItem({ airDateOnly: '2026-07-15', airDateInstant: instant, hasKnownReleaseTime: true });
    const localKey = getLocalDateKey(new Date(instant));
    expect(resolveEffectiveLocalDateKey(item)).toBe(localKey);
    if (localKey !== '2026-07-15') {
      expect(resolveEffectiveLocalDateKey(item)).not.toBe(item.airDateOnly);
    }
  });
});

describe('compareUpcomingItemsWithinDay', () => {
  it('sorts known-time items before unknown-time items regardless of clock value', () => {
    const known = makeItem({ episodeId: 'known', hasKnownReleaseTime: true, airDateInstant: '2026-07-15T23:59:00.000Z' });
    const unknown = makeItem({ episodeId: 'unknown', hasKnownReleaseTime: false, seriesTitle: 'Aardvark' });
    expect([unknown, known].sort(compareUpcomingItemsWithinDay).map((i) => i.episodeId)).toEqual(['known', 'unknown']);
  });

  it('sorts unknown-time items alphabetically by series title', () => {
    const zebra = makeItem({ episodeId: 'zebra', seriesTitle: 'Zebra' });
    const apple = makeItem({ episodeId: 'apple', seriesTitle: 'Apple' });
    expect([zebra, apple].sort(compareUpcomingItemsWithinDay).map((i) => i.episodeId)).toEqual(['apple', 'zebra']);
  });
});

describe('getSectionKindForOffset', () => {
  it.each([
    [-10, 'pastDate'],
    [-2, 'pastDate'],
    [-1, 'yesterday'],
    [0, 'today'],
    [1, 'tomorrow'],
    [2, 'weekday'],
    [7, 'weekday'],
    [8, 'later'],
    [100, 'later'],
  ])('offset %i -> %s', (offset, expected) => {
    expect(getSectionKindForOffset(offset)).toBe(expected);
  });
});

describe('formatSectionTitle', () => {
  const today = '2026-07-15';

  it('labels contextual offsets', () => {
    expect(formatSectionTitle('yesterday', '2026-07-14', today)).toBe('Yesterday');
    expect(formatSectionTitle('today', '2026-07-15', today)).toBe('Today');
    expect(formatSectionTitle('tomorrow', '2026-07-16', today)).toBe('Tomorrow');
    expect(formatSectionTitle('later', '2026-08-01', today)).toBe('Later');
  });

  it('uses a weekday name for near-future dates', () => {
    // 2026-07-17 is a Friday.
    expect(formatSectionTitle('weekday', '2026-07-17', today)).toBe('Friday');
  });

  it('uses an absolute date for far-past dates, omitting the year when it matches today', () => {
    const label = formatSectionTitle('pastDate', '2026-06-01', today);
    expect(label).not.toContain('2026');
    expect(label).toMatch(/Jun/);
  });

  it('includes the year for a far-past date in a different year', () => {
    const label = formatSectionTitle('pastDate', '2025-06-01', today);
    expect(label).toContain('2025');
  });
});

describe('formatDaysUntil', () => {
  it('always shows an integer day count, never weeks/months', () => {
    expect(formatDaysUntil(8)).toBe('8 days');
    expect(formatDaysUntil(19)).toBe('19 days');
    expect(formatDaysUntil(37)).toBe('37 days');
    expect(formatDaysUntil(64)).toBe('64 days');
  });

  it('singularizes exactly 1 day (unreachable via Later today, but correct in general)', () => {
    expect(formatDaysUntil(1)).toBe('1 day');
  });
});

describe('getInitialUpcomingWindow / getPreviousUpcomingWindow / getNextUpcomingWindow', () => {
  it('builds an initial window straddling today, with a deliberately small past lookback (Phase 10) under the server 45-day cap', () => {
    const window = getInitialUpcomingWindow('2026-07-15');
    expect(window.from).toBe('2026-07-12');
    expect(window.to).toBe('2026-08-15');
    expect(daysBetweenLocalDateKeys(window.from, window.to)).toBeLessThanOrEqual(45);
  });

  it('builds a contiguous previous window with no gap or overlap', () => {
    const initial = getInitialUpcomingWindow('2026-07-15');
    const prev = getPreviousUpcomingWindow(initial.from);
    expect(prev.to).toBe(initial.from);
  });

  it('builds a contiguous next window with no gap or overlap', () => {
    const initial = getInitialUpcomingWindow('2026-07-15');
    const next = getNextUpcomingWindow(initial.to);
    expect(next.from).toBe(initial.to);
  });
});

describe('buildUpcomingSections', () => {
  const today = '2026-07-15';

  function dayBucket(date: string, items: UpcomingItem[]): UpcomingDayBucket {
    return { date, items };
  }

  it('synthesizes an empty Today section when today has zero items but is within the loaded range', () => {
    const days = [dayBucket('2026-07-10', [makeItem({ episodeId: 'e1', airDateOnly: '2026-07-10' })])];
    const sections = buildUpcomingSections(days, today, '2026-07-01', '2026-07-20');
    const todaySection = sections.find((s) => s.kind === 'today');
    expect(todaySection).toBeDefined();
    expect(todaySection!.data).toEqual([{ type: 'empty', key: '2026-07-15-empty', message: 'Nothing releasing today' }]);
  });

  it('does NOT synthesize a Today section when today falls outside the loaded range', () => {
    const days = [dayBucket('2026-07-10', [makeItem({ episodeId: 'e1', airDateOnly: '2026-07-10' })])];
    const sections = buildUpcomingSections(days, today, '2026-07-01', '2026-07-12');
    expect(sections.some((s) => s.kind === 'today')).toBe(false);
  });

  it('groups multiple future dates >=8 days out under a single shared Later section, chronological within it', () => {
    const days = [
      dayBucket('2026-07-30', [makeItem({ episodeId: 'later1', airDateOnly: '2026-07-30', seriesTitle: 'Later One' })]),
      dayBucket('2026-08-05', [makeItem({ episodeId: 'later2', airDateOnly: '2026-08-05', seriesTitle: 'Later Two' })]),
    ];
    const sections = buildUpcomingSections(days, today, '2026-07-01', '2026-09-01');
    const laterSections = sections.filter((s) => s.kind === 'later');
    expect(laterSections).toHaveLength(1);
    expect(laterSections[0].data.map((r) => (r.type === 'item' ? r.item.episodeId : null))).toEqual(['later1', 'later2']);
  });

  it('attaches the correct dayOffset to each Later item for the "X days" display', () => {
    const days = [dayBucket('2026-07-23', [makeItem({ episodeId: 'e1', airDateOnly: '2026-07-23' })])];
    const sections = buildUpcomingSections(days, today, '2026-07-01', '2026-09-01');
    const later = sections.find((s) => s.kind === 'later')!;
    const row = later.data[0];
    expect(row.type).toBe('item');
    if (row.type === 'item') expect(row.dayOffset).toBe(8);
  });

  it('gives each individual near-date section its own header and correct offset', () => {
    const days = [
      dayBucket('2026-07-14', [makeItem({ episodeId: 'y', airDateOnly: '2026-07-14' })]),
      dayBucket('2026-07-16', [makeItem({ episodeId: 't', airDateOnly: '2026-07-16' })]),
    ];
    const sections = buildUpcomingSections(days, today, '2026-07-01', '2026-07-20');
    expect(sections.map((s) => s.kind)).toEqual(['yesterday', 'today', 'tomorrow']);
  });

  it('never produces duplicate items across the flattened section list', () => {
    const days = [
      dayBucket('2026-07-10', [makeItem({ episodeId: 'dup', airDateOnly: '2026-07-10' })]),
    ];
    const sections = buildUpcomingSections(days, today, '2026-07-01', '2026-07-20');
    const allIds = sections.flatMap((s) => s.data.filter((r) => r.type === 'item').map((r) => (r as { item: UpcomingItem }).item.episodeId));
    expect(allIds).toEqual(['dup']);
  });

  it('sorts items within a re-bucketed date using the same known/unknown-time rule', () => {
    const zebra = makeItem({ episodeId: 'zebra', airDateOnly: '2026-07-10', seriesTitle: 'Zebra' });
    const apple = makeItem({ episodeId: 'apple', airDateOnly: '2026-07-10', seriesTitle: 'Apple' });
    const sections = buildUpcomingSections([dayBucket('2026-07-10', [zebra, apple])], today, '2026-07-01', '2026-07-20');
    const section = sections.find((s) => s.key === '2026-07-10')!;
    expect(section.data.map((r) => (r as { item: UpcomingItem }).item.episodeId)).toEqual(['apple', 'zebra']);
  });
});

describe('patchUpcomingItemInPages', () => {
  function makePage(overrides: Partial<UpcomingPage> = {}): UpcomingPage {
    return { from: '2026-07-01', to: '2026-07-31', today: '2026-07-15', hasMorePast: false, hasMoreFuture: false, days: [], ...overrides };
  }

  it('patches only the matching episode, leaving everything else untouched', () => {
    const target = makeItem({ episodeId: 'target', isWatched: false, episodeWatchId: null });
    const other = makeItem({ episodeId: 'other', isWatched: false, episodeWatchId: null });
    const pages = [makePage({ days: [{ date: '2026-07-10', items: [target, other] }] })];

    const patched = patchUpcomingItemInPages(pages, 'target', { isWatched: true, episodeWatchId: 'watch-1' });

    const patchedTarget = patched[0].days[0].items.find((i) => i.episodeId === 'target')!;
    const untouchedOther = patched[0].days[0].items.find((i) => i.episodeId === 'other')!;
    expect(patchedTarget).toMatchObject({ isWatched: true, episodeWatchId: 'watch-1' });
    expect(untouchedOther).toMatchObject({ isWatched: false, episodeWatchId: null });
  });

  it('is a no-op (returns an equivalent structure) when the episodeId is not found in any page', () => {
    const pages = [makePage({ days: [{ date: '2026-07-10', items: [makeItem({ episodeId: 'e1' })] }] })];
    const patched = patchUpcomingItemInPages(pages, 'missing', { isWatched: true });
    expect(patched[0].days[0].items[0].isWatched).toBe(false);
  });
});

// See docs/upcoming-timeline-todo.md Phase 8 for the bug these decision
// functions fix (wrong initial date + uncaught SectionList runtime error).
describe('findTodaySectionIndex', () => {
  function makeSection(overrides: Partial<UpcomingSection> = {}): UpcomingSection {
    return { key: 'k', kind: 'today', title: 'Today', data: [], ...overrides };
  }

  it('finds the today section regardless of position', () => {
    const sections = [makeSection({ key: 'yesterday', kind: 'yesterday' }), makeSection({ key: 'today', kind: 'today' }), makeSection({ key: 'tomorrow', kind: 'tomorrow' })];
    expect(findTodaySectionIndex(sections)).toBe(1);
  });

  it('finds the today section even when its data is empty (no releases today)', () => {
    const sections = [makeSection({ kind: 'today', data: [] })];
    expect(findTodaySectionIndex(sections)).toBe(0);
  });

  it('returns -1 when no today section exists', () => {
    const sections = [makeSection({ kind: 'yesterday' }), makeSection({ kind: 'tomorrow' })];
    expect(findTodaySectionIndex(sections)).toBe(-1);
  });
});

// The actual scroll target for both the automatic entry anchor and the
// "jump to Today" tab-reselect gesture — skips an empty Today (no
// releases) forward to the next day (or the aggregate "Later" section)
// that actually has something, rather than landing on a blank "Nothing
// releasing today" placeholder.
describe('findAnchorSectionIndex', () => {
  function makeSection(overrides: Partial<UpcomingSection> = {}): UpcomingSection {
    return { key: 'k', kind: 'today', title: 'Today', data: [], ...overrides };
  }
  function itemRow(key: string): UpcomingRow {
    return { type: 'item', key, item: makeItem({ episodeId: key }), dayOffset: 0 };
  }
  function emptyRow(key: string): UpcomingRow {
    return { type: 'empty', key, message: 'Nothing releasing today' };
  }

  it('targets Today directly when it has releases', () => {
    const sections = [
      makeSection({ key: 'yesterday', kind: 'yesterday', data: [itemRow('y1')] }),
      makeSection({ key: 'today', kind: 'today', data: [itemRow('t1')] }),
      makeSection({ key: 'tomorrow', kind: 'tomorrow', data: [itemRow('tm1')] }),
    ];
    expect(findAnchorSectionIndex(sections)).toBe(1);
  });

  it('skips forward to the next section with releases when Today is the synthesized empty placeholder', () => {
    const sections = [
      makeSection({ key: 'today', kind: 'today', data: [emptyRow('today-empty')] }),
      makeSection({ key: 'tomorrow', kind: 'tomorrow', data: [itemRow('tm1')] }),
    ];
    expect(findAnchorSectionIndex(sections)).toBe(1);
  });

  it('skips past multiple empty-feeling gaps (Later aggregate) to the first section that actually has an item', () => {
    const sections = [
      makeSection({ key: 'today', kind: 'today', data: [emptyRow('today-empty')] }),
      makeSection({ key: 'later', kind: 'later', data: [itemRow('later1')] }),
    ];
    expect(findAnchorSectionIndex(sections)).toBe(1);
  });

  it('falls back to Today\'s own index when nothing later in the loaded window has releases either', () => {
    const sections = [makeSection({ key: 'today', kind: 'today', data: [emptyRow('today-empty')] })];
    expect(findAnchorSectionIndex(sections)).toBe(0);
  });

  it('returns -1 when there is no Today section at all (data not loaded yet)', () => {
    const sections = [makeSection({ key: 'yesterday', kind: 'yesterday', data: [itemRow('y1')] })];
    expect(findAnchorSectionIndex(sections)).toBe(-1);
  });
});

describe('shouldPerformInitialAnchor', () => {
  const todaySection: UpcomingSection = { key: 'today', kind: 'today', title: 'Today', data: [] };
  const emptyTodaySection: UpcomingSection = { key: 'today', kind: 'today', title: 'Today', data: [] };
  const base = { isActive: true, hasLaidOut: true, hasAnchoredAlready: false, sections: [todaySection] };

  it('1. selects Today as the initial anchor when active, laid out, and not yet anchored', () => {
    expect(shouldPerformInitialAnchor(base)).toBe(true);
  });

  it('2. Today remains the anchor even when it has zero episodes', () => {
    expect(shouldPerformInitialAnchor({ ...base, sections: [emptyTodaySection] })).toBe(true);
  });

  it('3. does not anchor again on an ordinary rerender once already anchored', () => {
    expect(shouldPerformInitialAnchor({ ...base, hasAnchoredAlready: true })).toBe(false);
  });

  it('4. a restored/preserved Upcoming session (already anchored, isActive flips back true) is not forced back to Today', () => {
    // Simulates: user anchored once, switched to Watch List (isActive false),
    // then switched back to Upcoming (isActive true again) — hasAnchoredAlready
    // is still true throughout, since it is only ever reset by an actual date
    // rollover, never by isActive toggling.
    expect(shouldPerformInitialAnchor({ ...base, hasAnchoredAlready: true, isActive: true })).toBe(false);
  });

  it('never scrolls while inactive (hidden underneath Watch List), even if laid out and data is ready', () => {
    expect(shouldPerformInitialAnchor({ ...base, isActive: false })).toBe(false);
  });

  it('never scrolls before a real layout has been reported, even if active and data is ready', () => {
    expect(shouldPerformInitialAnchor({ ...base, hasLaidOut: false })).toBe(false);
  });

  it('never scrolls before there is a today section to target (data not loaded yet)', () => {
    expect(shouldPerformInitialAnchor({ ...base, sections: [] })).toBe(false);
  });
});

describe('canRetryScrollToToday', () => {
  it('7. allows a retry while under the cap', () => {
    expect(canRetryScrollToToday(0, 3)).toBe(true);
    expect(canRetryScrollToToday(2, 3)).toBe(true);
  });

  it('8. refuses once the cap is reached — cannot retry indefinitely', () => {
    expect(canRetryScrollToToday(3, 3)).toBe(false);
    expect(canRetryScrollToToday(4, 3)).toBe(false);
  });

  it('8. modeling repeated failures converges to a fixed, bounded number of attempts, never growing unbounded', () => {
    let retryCount = 0;
    let attempts = 0;
    // Simulate onScrollToIndexFailed firing over and over (e.g. sections
    // never settling) — must stop scheduling new retries after the cap.
    for (let i = 0; i < 100; i++) {
      if (!canRetryScrollToToday(retryCount, 3)) break;
      retryCount += 1;
      attempts += 1;
    }
    expect(attempts).toBe(3);
  });
});

// See docs/upcoming-timeline-todo.md Phase 9 — the real-device bug this
// function fixes (Upcoming opened over a month in the past instead of
// Today, because onStartReached fired at mount-time offset 0 and
// runaway-loaded extra past pages before the Today anchor ever ran) — and
// Phase 11, the web recurrence: react-native-web doesn't compensate scroll
// position when content is prepended/appended, so even a bounded per-
// direction cap could still fire its own full burst in BOTH directions
// simultaneously at mount, before any real scrolling, landing away from
// Today despite being bounded. hasUserScrolled blocks any auto-load until a
// real scroll has happened at all; autoLoadCount/maxAutoLoadsSinceReset
// (with the reset side, isScrolledAwayFromStart/End, tested below) is what
// then keeps ongoing scroll-driven pagination from running away too.
describe('canAutoLoadMorePages', () => {
  it('refuses to auto-load before the initial anchor has completed, even when a page is available and not currently fetching', () => {
    expect(canAutoLoadMorePages(true, false, true, false, true, 0, 2)).toBe(false);
  });

  it('refuses before any real user scroll has happened, even once anchored', () => {
    expect(canAutoLoadMorePages(true, true, true, false, false, 0, 2)).toBe(false);
  });

  it('allows auto-loading once anchored, scrolled, a page is available, and nothing is already in flight', () => {
    expect(canAutoLoadMorePages(true, true, true, false, true, 0, 2)).toBe(true);
  });

  it('refuses when there is no further page to load, even if anchored and scrolled', () => {
    expect(canAutoLoadMorePages(true, true, false, false, true, 0, 2)).toBe(false);
  });

  it('refuses while a fetch for that direction is already in flight, even if anchored and scrolled', () => {
    expect(canAutoLoadMorePages(true, true, true, true, true, 0, 2)).toBe(false);
  });

  // Phase 12 (web): a real-device runaway confirmed via remoteLogger
  // breadcrumbs — the panel toggling to hidden (isActive false) and back
  // made react-native-web's SectionList misreport its viewport as "near
  // the start", firing onStartReached even while hidden. Every OTHER gate
  // here had already passed (hasAnchoredAlready/hasUserScrolled persist
  // across a hide/show toggle, since the component never unmounts), so
  // isActive is the only thing that blocked it. Logged as a burst of 7
  // auto-loads in under 2 seconds, ballooning 9 sections to 201.
  it('refuses while the panel is not the active one, even if every other gate would otherwise allow it', () => {
    expect(canAutoLoadMorePages(false, true, true, false, true, 0, 2)).toBe(false);
  });

  it('models the exact runaway-mount scenario: repeated onStartReached firings before anchoring or scrolling never trigger a single fetch', () => {
    let fetchCount = 0;
    const hasAnchoredAlready = false; // list sits at offset 0 before the anchor effect has run
    for (let i = 0; i < 10; i++) {
      if (canAutoLoadMorePages(true, hasAnchoredAlready, true, false, false, 0, 2)) fetchCount += 1;
    }
    expect(fetchCount).toBe(0);
  });

  it('models the mount-time burst-in-both-directions scenario: anchored but never actually scrolled, onStartReached AND onEndReached both firing repeatedly never trigger a single fetch', () => {
    let fetchCount = 0;
    for (let i = 0; i < 10; i++) {
      if (canAutoLoadMorePages(true, true, true, false, false, 0, 2)) fetchCount += 1; // onStartReached
      if (canAutoLoadMorePages(true, true, true, false, false, 0, 2)) fetchCount += 1; // onEndReached
    }
    expect(fetchCount).toBe(0);
  });

  it('caps auto-loads once scrolled but the list never actually leaves the edge again (the web scroll-compensation failure)', () => {
    let fetchCount = 0;
    let autoLoadCount = 0;
    // Simulates onStartReached firing every render because prepended
    // content is never compensated for — hasUserScrolled is (genuinely)
    // true from an earlier real scroll, and nothing is ever in-flight for
    // more than an instant, but the counter is never reset because the
    // list never reports being away from the edge again afterward.
    for (let i = 0; i < 20; i++) {
      if (canAutoLoadMorePages(true, true, true, false, true, autoLoadCount, 2)) {
        autoLoadCount += 1;
        fetchCount += 1;
      }
    }
    expect(fetchCount).toBe(2);
  });

  it('with the production cap, allows a fresh batch again after the count has been reset (simulating a genuine away-from-edge scroll)', () => {
    let autoLoadCount = MAX_AUTO_LOAD_PAGES_SINCE_RESET; // capped out
    expect(canAutoLoadMorePages(true, true, true, false, true, autoLoadCount, MAX_AUTO_LOAD_PAGES_SINCE_RESET)).toBe(false);
    autoLoadCount = 0; // onScroll reset it after a genuine away-from-edge scroll
    expect(canAutoLoadMorePages(true, true, true, false, true, autoLoadCount, MAX_AUTO_LOAD_PAGES_SINCE_RESET)).toBe(true);
  });
});

describe('isScrolledAwayFromStart / isScrolledAwayFromEnd', () => {
  it('is not away from the start at offset 0 (a freshly-mounted or stuck-at-the-edge list)', () => {
    expect(isScrolledAwayFromStart(0)).toBe(false);
  });

  it('is away from the start once comfortably past the reset threshold', () => {
    expect(isScrolledAwayFromStart(SCROLL_RESET_DISTANCE_PX + 1)).toBe(true);
  });

  it('is not away from the end when sitting exactly at the bottom of the content', () => {
    expect(isScrolledAwayFromEnd(800, 1000, 200)).toBe(false); // 1000 - 200 - 800 = 0
  });

  it('is away from the end when there is a comfortable amount of content still below the viewport', () => {
    expect(isScrolledAwayFromEnd(0, 2000, 200)).toBe(true); // 2000 - 200 - 0 = 1800
  });
});
