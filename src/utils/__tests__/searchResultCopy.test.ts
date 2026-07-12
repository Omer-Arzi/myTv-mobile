import { needsReviewTarget, searchResultContextLine } from '../searchResultCopy';
import { SeriesSearchResult } from '../../api/types';

function result(overrides: Partial<SeriesSearchResult> = {}): SeriesSearchResult {
  return {
    resultKey: 'k',
    title: 'Frieren',
    year: 2023,
    posterUrl: null,
    providers: [{ provider: 'tmdb', providerId: '1' }],
    libraryMatch: { type: 'NONE' },
    primaryAction: 'ADD_TO_WATCHLIST',
    relevanceScore: 0,
    ...overrides,
  };
}

describe('searchResultContextLine', () => {
  it('shows "Not in your library" for NONE', () => {
    expect(searchResultContextLine(result({ libraryMatch: { type: 'NONE' } }))).toBe('Not in your library');
  });

  it('shows "Possible library match" for POSSIBLE', () => {
    expect(searchResultContextLine(result({ libraryMatch: { type: 'POSSIBLE', seriesId: 's1', seriesTitle: 'X', seriesUserStatus: 'WATCHLIST', confidence: 0.7, reason: 'Similar title' } }))).toBe(
      'Possible library match',
    );
  });

  it('shows "Watching • Next SxEy" when a next episode is known', () => {
    const line = searchResultContextLine(
      result({ libraryMatch: { type: 'EXACT', seriesId: 's1', userStatus: 'WATCHING', nextEpisode: { id: 'e1', seasonNumber: 2, episodeNumber: 4, title: null }, needsAttention: false, attentionReasonCode: null } }),
    );
    expect(line).toBe('Watching • Next S2E4');
  });

  it('shows plain "Watching" when no next episode is known', () => {
    const line = searchResultContextLine(result({ libraryMatch: { type: 'EXACT', seriesId: 's1', userStatus: 'WATCHING', nextEpisode: null, needsAttention: false, attentionReasonCode: null } }));
    expect(line).toBe('Watching');
  });

  it.each([
    ['CAUGHT_UP', 'Caught Up'],
    ['COMPLETED', 'Completed'],
    ['WATCHLIST', "In Haven't Started Yet"],
    ['PAUSED', 'On Hold'],
    ['DROPPED', 'Dropped'],
  ] as const)('shows "%s" -> "%s"', (userStatus, expected) => {
    const line = searchResultContextLine(result({ libraryMatch: { type: 'EXACT', seriesId: 's1', userStatus, nextEpisode: null, needsAttention: false, attentionReasonCode: null } }));
    expect(line).toBe(expected);
  });

  it('never displays the literal UNKNOWN status', () => {
    const line = searchResultContextLine(result({ libraryMatch: { type: 'EXACT', seriesId: 's1', userStatus: 'UNKNOWN', nextEpisode: null, needsAttention: false, attentionReasonCode: null } }));
    expect(line).not.toMatch(/unknown/i);
  });

  it('shows "Needs Review" — takes priority over the underlying status — when needsAttention is true', () => {
    const line = searchResultContextLine(result({ libraryMatch: { type: 'EXACT', seriesId: 's1', userStatus: 'WATCHING', nextEpisode: null, needsAttention: true, attentionReasonCode: 'no-confirmed-provider-match' } }));
    expect(line).toBe('Needs Review');
  });
});

describe('needsReviewTarget', () => {
  it('routes to ProviderCandidateSearch for no-confirmed-provider-match — mirrors NeedsAttentionScreen exactly', () => {
    expect(needsReviewTarget('no-confirmed-provider-match')).toBe('ProviderCandidateSearch');
  });

  it('routes to MigrationProposal for every other reason code', () => {
    expect(needsReviewTarget('known-episode-numbering-risk')).toBe('MigrationProposal');
    expect(needsReviewTarget(null)).toBe('MigrationProposal');
  });
});
