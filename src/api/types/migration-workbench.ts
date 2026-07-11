import { UserSeriesStatus } from './common';

// Mirrors server/src/modules/migration-workbench/dto/*.ts — GET /migration-workbench
// answers "what migration work does my library still need," grouped into 4
// categories, not "which providers are unconfirmed." READY_AUTOMATIC/
// READY_FOR_CONFIRMATION items carry a pre-computed proposal (from the
// library-health CLI pipeline's own cached reports); NEEDS_EPISODE_REVIEW/
// NO_RELIABLE_PROVIDER do not — those need a human decision first.
export type MigrationWorkbenchCategory = 'READY_AUTOMATIC' | 'READY_FOR_CONFIRMATION' | 'NEEDS_EPISODE_REVIEW' | 'NO_RELIABLE_PROVIDER';

export interface MigrationProposalSummary {
  currentUserStatus: UserSeriesStatus;
  // Automatically derived — never a manually-set value. PAUSED/DROPPED are
  // always preserved regardless of what the migration would otherwise compute.
  proposedUserStatus: UserSeriesStatus;
  matchedWatchedEpisodeCount: number;
  matchedTotalEpisodeCount: number;
  episodesToCreate: number;
  seasonsToCreate: number[];
  unmatchedWatchedOrphanCount: number;
  confidence: 'HIGH' | 'BORDERLINE';
}

export interface MigrationWorkbenchItem {
  seriesId: string;
  title: string;
  posterUrl: string | null;
  category: MigrationWorkbenchCategory;
  reason: string;
  // Set only for READY_AUTOMATIC/READY_FOR_CONFIRMATION.
  proposal: MigrationProposalSummary | null;
}

export interface MigrationCurrentState {
  episodeCount: number;
  watchedCount: number;
  userStatus: UserSeriesStatus;
}

// GET /migration-workbench/:seriesId/proposal — always a fresh live
// provider fetch, never cached. eligible is false (with current/proposal
// both null) when there's no confirmed provider decision on file yet —
// no live call is attempted in that case.
export interface MigrationProposal {
  seriesId: string;
  title: string;
  eligible: boolean;
  category: MigrationWorkbenchCategory;
  reason: string;
  current: MigrationCurrentState | null;
  proposal: MigrationProposalSummary | null;
}

// POST /migration-workbench/:seriesId/confirm — a real write.
export interface MigrationConfirmResult {
  seriesId: string;
  title: string;
  applied: boolean;
  finalUserStatus: UserSeriesStatus;
  episodesCreated: number;
  seasonsCreated: number[];
  verificationPassed: boolean;
  message: string;
}

export interface MigrationHistoryProviderRef {
  provider: string | null;
  providerId: string | null;
  tmdbId?: string | null;
}

// GET /migration-workbench/history
export interface MigrationHistoryItem {
  id: string;
  seriesId: string;
  seriesTitle: string;
  appliedAt: string;
  providerBefore: MigrationHistoryProviderRef | null;
  providerAfter: MigrationHistoryProviderRef;
  userStatusBefore: string;
  userStatusAfter: string;
  episodesInsertedCount: number;
  episodesUpdatedCount: number;
  verificationPassed: boolean;
  rolledBack: boolean;
  rollbackAvailable: boolean;
}

// GET /migration-workbench/history/:migrationId
export interface MigrationHistoryDetail {
  id: string;
  seriesId: string;
  seriesTitle: string;
  appliedAt: string;
  classification: string;
  sourceCategory: string;
  providerBefore: MigrationHistoryProviderRef | null;
  providerAfter: MigrationHistoryProviderRef;
  releaseStatusBefore: string | null;
  releaseStatusAfter: string | null;
  userStatusBefore: string;
  userStatusAfter: string;
  nextEpisodeIdBefore: string | null;
  nextEpisodeIdAfter: string | null;
  episodesInsertedCount: number;
  episodesUpdatedCount: number;
  preservedOrphanEpisodeCount: number;
  watchedMappingCount: number;
  verificationPassed: boolean;
  verificationDetail: string[];
  rolledBackAt: string | null;
  rollbackReason: string | null;
}

// POST /migration-workbench/history/:migrationId/rollback-preview — read-only.
export interface MigrationRollbackPreview {
  migrationId: string;
  eligible: boolean;
  refusalReasons: string[];
  explanations: string[];
  wouldRestoreProvider: MigrationHistoryProviderRef | null;
  wouldRestoreUserStatus: string | null;
  wouldRestoreNextEpisodeId: string | null;
  wouldRemoveEpisodeCount: number;
  watchHistoryPreserved: boolean;
}

// POST /migration-workbench/history/:migrationId/rollback — a real write.
export interface MigrationRollbackResult {
  migrationId: string;
  rolledBack: boolean;
  episodesDeleted: number;
  providerRestored: boolean;
  progressRestored: boolean;
  message: string;
}

// GET /migration-workbench/:seriesId/candidates
export interface ProviderCandidate {
  provider: string;
  providerId: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  episodeCount: number | null;
  seasonCount: number | null;
  confidenceScore: number;
  titleMatchType: string;
  yearMatchType: string;
  explanation: string;
  warnings: string[];
}

export interface ProviderCandidateSearchResult {
  seriesId: string;
  localTitle: string;
  candidates: ProviderCandidate[];
  classification: string;
  reason: string;
  recommendedProviderId: string | null;
}
