import { apiClient } from '../client';
import {
  MigrationConfirmResult,
  MigrationHistoryDetail,
  MigrationHistoryItem,
  MigrationProposal,
  MigrationRollbackPreview,
  MigrationRollbackResult,
  MigrationWorkbenchItem,
  ProviderCandidateSearchResult,
} from '../types';

export function getMigrationWorkbench(): Promise<MigrationWorkbenchItem[]> {
  return apiClient.get<MigrationWorkbenchItem[]>('/migration-workbench');
}

export function getMigrationProposal(seriesId: string): Promise<MigrationProposal> {
  return apiClient.get<MigrationProposal>(`/migration-workbench/${seriesId}/proposal`);
}

export function confirmMigration(seriesId: string): Promise<MigrationConfirmResult> {
  return apiClient.post<MigrationConfirmResult>(`/migration-workbench/${seriesId}/confirm`);
}

export function searchProviderCandidates(seriesId: string): Promise<ProviderCandidateSearchResult> {
  return apiClient.get<ProviderCandidateSearchResult>(`/migration-workbench/${seriesId}/candidates`);
}

export function confirmProviderIdentity(seriesId: string, body: { provider: string; providerId: string; confidence: number }): Promise<{ seriesId: string; saved: true }> {
  return apiClient.post(`/migration-workbench/${seriesId}/confirm-identity`, body);
}

export function getMigrationHistory(): Promise<MigrationHistoryItem[]> {
  return apiClient.get<MigrationHistoryItem[]>('/migration-workbench/history');
}

export function getMigrationHistoryDetail(migrationId: string): Promise<MigrationHistoryDetail> {
  return apiClient.get<MigrationHistoryDetail>(`/migration-workbench/history/${migrationId}`);
}

export function previewRollback(migrationId: string): Promise<MigrationRollbackPreview> {
  return apiClient.post<MigrationRollbackPreview>(`/migration-workbench/history/${migrationId}/rollback-preview`);
}

export function rollbackMigration(migrationId: string): Promise<MigrationRollbackResult> {
  return apiClient.post<MigrationRollbackResult>(`/migration-workbench/history/${migrationId}/rollback`);
}
