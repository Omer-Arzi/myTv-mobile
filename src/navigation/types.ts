// SeriesDetail is pushed above the tab navigator (a native-stack screen,
// not a tab) so it's reachable from a card tap on any of the three tabs,
// with the standard iOS "back" affordance.
export type RootStackParamList = {
  Tabs: undefined;
  SeriesDetail: { seriesId: string; title?: string };
  NeedsAttention: undefined;
  MigrationProposal: { seriesId: string; title?: string };
  MigrationHistory: undefined;
  MigrationHistoryDetail: { migrationId: string; seriesTitle?: string };
  ProviderCandidateSearch: { seriesId: string; title?: string };
};

export type TabParamList = {
  Home: undefined;
  Watchlist: undefined;
  Library: undefined;
  Search: undefined;
};

// Augments React Navigation's own types so useNavigation()/navigate() are
// type-checked against RootStackParamList without passing a generic at
// every call site. See https://reactnavigation.org/docs/typescript.
declare global {
  namespace ReactNavigation {
    // Empty on purpose — this is React Navigation's own documented
    // augmentation pattern (an interface merge, not a real member list).
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
