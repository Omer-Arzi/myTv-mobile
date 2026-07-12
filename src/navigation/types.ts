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
  // A lightweight 1-vs-1 comparison (one external search result vs one
  // uncertain local series) — deliberately separate from
  // ProviderCandidateSearch, which compares one KNOWN local series against
  // MANY external candidates. Presented as a modal (see RootNavigator) to
  // read as a focused ambiguity-resolution step, not full-screen navigation.
  // onTreatAsDifferent is a same-session callback (not serializable — fine
  // here, this route is never deep-linked), used only to flip the
  // originating search card locally into a new-series state without a
  // second server round trip; see SearchScreen's treatedAsDifferent state.
  PossibleMatchComparison: {
    resultKey: string;
    candidateTitle: string;
    candidateYear: number | null;
    candidatePosterUrl: string | null;
    candidateProvider: 'tmdb' | 'tvmaze';
    candidateProviderId: string;
    possibleSeriesId: string;
    possibleSeriesTitle: string;
    possibleSeriesUserStatus: string;
    confidence: number;
    reason: string;
    onTreatAsDifferent: () => void;
  };
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
