import { MigrationWorkbenchCategory, MigrationWorkbenchItem } from '../api/types';

export interface MigrationWorkbenchSection {
  category: MigrationWorkbenchCategory;
  title: string;
  items: MigrationWorkbenchItem[];
}

// Fixed section order matching the desired user workflow — deterministic
// (no review needed) first, then confirmation, then the two tiers that
// need a human decision before any proposal exists at all. GET
// /migration-workbench already returns items sorted alphabetically by
// title; this is a pure partition into sections, not a re-sort.
const SECTION_DEFINITIONS: { category: MigrationWorkbenchCategory; label: string }[] = [
  { category: 'READY_AUTOMATIC', label: 'Ready for Automatic Migration' },
  { category: 'READY_FOR_CONFIRMATION', label: 'Ready for Confirmation' },
  { category: 'NEEDS_EPISODE_REVIEW', label: 'Needs Episode Review' },
  { category: 'NO_RELIABLE_PROVIDER', label: 'No Reliable Provider' },
];

export function groupMigrationWorkbenchItems(items: MigrationWorkbenchItem[]): MigrationWorkbenchSection[] {
  return SECTION_DEFINITIONS.map(({ category, label }) => {
    const sectionItems = items.filter((item) => item.category === category);
    return { category, title: `${label} (${sectionItems.length})`, items: sectionItems };
  }).filter((section) => section.items.length > 0);
}
