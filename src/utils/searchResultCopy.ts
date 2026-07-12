// Pure copy/label logic for search result cards — deliberately NOT routed
// through utils/format.ts's formatStatusLabel. Search's context line uses
// different wording than the rest of the app on purpose (explicit product
// direction): "In Haven't Started Yet" instead of "Watchlist", "On Hold"
// instead of "On hold" — reusing the Home screen's own section-name
// convention for WATCHLIST rather than a mechanical enum-case conversion,
// since it answers "what does this mean for me" more directly. Never
// UNKNOWN, never a raw provider id, never more than one line.

import { SeriesSearchResult } from '../api/types';

function nextEpisodeCode(seasonNumber: number, episodeNumber: number): string {
  return `S${seasonNumber}E${episodeNumber}`;
}

// The ONE line every card shows — doubles as both "status badge" and
// "context" per the approved simplicity direction (no separate colored
// pill; Search is optimized for scanning, not a second status-chip system).
export function searchResultContextLine(result: SeriesSearchResult): string {
  const match = result.libraryMatch;

  if (match.type === 'NONE') return 'Not in your library';
  if (match.type === 'POSSIBLE') return 'Possible library match';

  // EXACT — needsAttention takes priority over the underlying status line;
  // a series that needs review is more actionable information right now
  // than what it was last confirmed as.
  if (match.needsAttention) return 'Needs Review';

  switch (match.userStatus) {
    case 'WATCHING':
      return match.nextEpisode ? `Watching • Next ${nextEpisodeCode(match.nextEpisode.seasonNumber, match.nextEpisode.episodeNumber)}` : 'Watching';
    case 'CAUGHT_UP':
      return 'Caught Up';
    case 'COMPLETED':
      return 'Completed';
    case 'WATCHLIST':
      return "In Haven't Started Yet";
    case 'PAUSED':
      return 'On Hold';
    case 'DROPPED':
      return 'Dropped';
    default:
      // UNKNOWN — should not occur for an EXACT match in practice, but
      // never render the literal enum value if it somehow does.
      return 'In your library';
  }
}

// Routes a Needs Review ('EXACT' + needsAttention) result to the exact same
// branch NeedsAttentionScreen.openItem already uses — never a second review
// UI. 'no-confirmed-provider-match' is the one reasonCode
// classifySeriesForAttention produces when there's no confirmed identity at
// all (mirrors the Migration Workbench's NO_RELIABLE_PROVIDER category);
// every other reason (e.g. 'known-episode-numbering-risk') routes to the
// proposal screen instead, same as every other confirmed-but-flagged series.
export function needsReviewTarget(attentionReasonCode: string | null): 'ProviderCandidateSearch' | 'MigrationProposal' {
  return attentionReasonCode === 'no-confirmed-provider-match' ? 'ProviderCandidateSearch' : 'MigrationProposal';
}
