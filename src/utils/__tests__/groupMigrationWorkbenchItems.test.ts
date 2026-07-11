import { groupMigrationWorkbenchItems } from '../groupMigrationWorkbenchItems';
import { MigrationWorkbenchItem } from '../../api/types';

function item(title: string, category: MigrationWorkbenchItem['category']): MigrationWorkbenchItem {
  return { seriesId: title, title, posterUrl: null, category, reason: 'reason', proposal: null };
}

describe('groupMigrationWorkbenchItems', () => {
  it('groups all 4 categories in the fixed order: automatic, confirmation, episode review, no provider', () => {
    const items = [
      item('D', 'NO_RELIABLE_PROVIDER'),
      item('C', 'NEEDS_EPISODE_REVIEW'),
      item('B', 'READY_FOR_CONFIRMATION'),
      item('A', 'READY_AUTOMATIC'),
    ];
    const sections = groupMigrationWorkbenchItems(items);

    expect(sections.map((s) => s.category)).toEqual(['READY_AUTOMATIC', 'READY_FOR_CONFIRMATION', 'NEEDS_EPISODE_REVIEW', 'NO_RELIABLE_PROVIDER']);
  });

  it('preserves the already-alphabetical order within each section (partition, not re-sort)', () => {
    const items = [item('Alpha', 'READY_AUTOMATIC'), item('Bravo', 'READY_AUTOMATIC'), item('Charlie', 'READY_AUTOMATIC')];
    const sections = groupMigrationWorkbenchItems(items);

    expect(sections).toHaveLength(1);
    expect(sections[0].items.map((i) => i.title)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('omits a section entirely when it has zero items', () => {
    const items = [item('Alpha', 'READY_AUTOMATIC')];
    const sections = groupMigrationWorkbenchItems(items);

    expect(sections).toHaveLength(1);
    expect(sections[0].category).toBe('READY_AUTOMATIC');
  });

  it('returns an empty array when there are no items at all — the "nearly empty" long-term goal state', () => {
    expect(groupMigrationWorkbenchItems([])).toEqual([]);
  });

  it('computes an accurate count per section header', () => {
    const items = [item('A', 'NO_RELIABLE_PROVIDER'), item('B', 'NO_RELIABLE_PROVIDER'), item('C', 'READY_AUTOMATIC')];
    const sections = groupMigrationWorkbenchItems(items);

    expect(sections.find((s) => s.category === 'NO_RELIABLE_PROVIDER')?.title).toBe('No Reliable Provider (2)');
    expect(sections.find((s) => s.category === 'READY_AUTOMATIC')?.title).toBe('Ready for Automatic Migration (1)');
  });
});
