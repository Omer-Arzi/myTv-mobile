import { groupWatchlistItems } from '../groupWatchlistItems';
import { WatchlistItem } from '../../api/types';

function item(title: string, userStatus: WatchlistItem['userStatus']): WatchlistItem {
  return {
    id: title,
    series: { id: title, title, overview: null, posterUrl: null, backdropUrl: null, releaseStatus: 'UNKNOWN' },
    userStatus,
    attentionReasonCode: null,
  };
}

describe('groupWatchlistItems', () => {
  it('groups mixed statuses into Watching, Caught Up, Watchlist sections in that order', () => {
    const items = [item('Alpha', 'WATCHING'), item('Bravo', 'CAUGHT_UP'), item('Charlie', 'WATCHLIST')];
    const sections = groupWatchlistItems(items);

    expect(sections.map((s) => s.status)).toEqual(['WATCHING', 'CAUGHT_UP', 'WATCHLIST']);
    expect(sections.map((s) => s.title)).toEqual(['Watching (1)', 'Caught Up (1)', 'Watchlist (1)']);
  });

  it('preserves the already-alphabetical order within each section (partition, not re-sort)', () => {
    // Server already returns these alphabetically sorted overall; grouping
    // must not disturb the relative order within a section.
    const items = [item('Alpha', 'WATCHING'), item('Bravo', 'WATCHING'), item('Charlie', 'WATCHING')];
    const sections = groupWatchlistItems(items);

    expect(sections).toHaveLength(1);
    expect(sections[0].items.map((i) => i.series.title)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('omits a section entirely when it has zero items', () => {
    const items = [item('Alpha', 'WATCHING')];
    const sections = groupWatchlistItems(items);

    expect(sections).toHaveLength(1);
    expect(sections[0].status).toBe('WATCHING');
  });

  it('returns an empty array when there are no items at all', () => {
    expect(groupWatchlistItems([])).toEqual([]);
  });

  it('computes an accurate count per section header', () => {
    const items = [item('A', 'WATCHING'), item('B', 'WATCHING'), item('C', 'CAUGHT_UP')];
    const sections = groupWatchlistItems(items);

    expect(sections.find((s) => s.status === 'WATCHING')?.title).toBe('Watching (2)');
    expect(sections.find((s) => s.status === 'CAUGHT_UP')?.title).toBe('Caught Up (1)');
  });

  it('grouping is stable across repeated calls on the same input (no hidden re-sort/randomness)', () => {
    const items = [item('Zeta', 'WATCHLIST'), item('Alpha', 'WATCHING')];
    const first = groupWatchlistItems(items);
    const second = groupWatchlistItems(items);

    expect(second).toEqual(first);
  });
});
