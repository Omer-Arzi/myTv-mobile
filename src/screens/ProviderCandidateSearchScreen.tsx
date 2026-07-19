import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSeriesDetail } from '../api/endpoints/series';
import { confirmProviderIdentity, searchProviderCandidates } from '../api/endpoints/migration-workbench';
import { queryKeys } from '../api/queryKeys';
import { Screen } from '../components/Screen';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { SectionHeader } from '../components/SectionHeader';
import { PosterImage } from '../components/PosterImage';
import { RootStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { formatConfidencePercent } from '../utils/format';
import { appAlert } from '../utils/appAlert';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type CandidatesRoute = RouteProp<RootStackParamList, 'ProviderCandidateSearch'>;

// "Find Provider" — search + compare + confirm identity for one
// NO_RELIABLE_PROVIDER series. Reuses the exact same TMDb search/scoring
// the CLI's missing-provider-candidates report uses (GET
// /migration-workbench/:seriesId/candidates); never auto-selects a
// candidate, even when the search recommends one — the user always makes
// the explicit choice below. Confirming an identity only saves the
// decision (via POST :seriesId/confirm-identity) and pushes into
// MigrationProposalScreen for the real review; it never applies a
// migration by itself.
export function ProviderCandidateSearchScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<CandidatesRoute>();
  const { seriesId, title } = route.params;
  const queryClient = useQueryClient();

  const seriesDetail = useQuery({ queryKey: queryKeys.seriesDetail(seriesId), queryFn: () => getSeriesDetail(seriesId) });
  const candidatesQuery = useQuery({ queryKey: queryKeys.providerCandidates(seriesId), queryFn: () => searchProviderCandidates(seriesId) });

  const localSummary = useMemo(() => {
    const detail = seriesDetail.data;
    if (!detail) return null;
    const episodes = detail.seasons.flatMap((s) => s.episodes);
    return { seasonCount: detail.seasons.length, episodeCount: episodes.length, watchedCount: episodes.filter((e) => e.watched).length };
  }, [seriesDetail.data]);

  const confirmMutation = useMutation({
    mutationFn: (params: { provider: string; providerId: string; confidence: number }) => confirmProviderIdentity(seriesId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.migrationWorkbench });
      navigation.replace('MigrationProposal', { seriesId, title });
    },
    onError: (err: unknown) => appAlert('Could not save identity', err instanceof Error ? err.message : 'Something went wrong.'),
  });

  const handleSelect = useCallback(
    (candidate: { provider: string; providerId: string; title: string; confidenceScore: number }) => {
      appAlert('Confirm identity', `Confirm "${candidate.title}" as the correct match for "${title ?? 'this series'}"? This does not apply a migration yet.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => confirmMutation.mutate({ provider: candidate.provider, providerId: candidate.providerId, confidence: candidate.confidenceScore }) },
      ]);
    },
    [confirmMutation, title],
  );

  if (seriesDetail.isLoading || candidatesQuery.isLoading) return <LoadingState />;
  if (seriesDetail.isError) return <ErrorState error={seriesDetail.error} onRetry={seriesDetail.refetch} />;
  if (candidatesQuery.isError) return <ErrorState error={candidatesQuery.error} onRetry={candidatesQuery.refetch} />;
  if (!candidatesQuery.data || !localSummary) return <LoadingState />;

  const { candidates, reason } = candidatesQuery.data;

  return (
    <Screen>
      <SectionHeader title="Current local series" />
      <View style={styles.card}>
        <Text style={typography.subheading}>{title}</Text>
        <Text style={styles.rowLabel}>{localSummary.seasonCount} season(s), {localSummary.episodeCount} episode(s), {localSummary.watchedCount} watched</Text>
      </View>

      <SectionHeader title={`Candidates (${candidates.length})`} subtitle={reason} />

      {candidates.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.rowLabel}>No plausible candidates found on TMDb.</Text>
        </View>
      ) : (
        candidates.map((candidate) => (
          <View key={`${candidate.provider}:${candidate.providerId}`} style={styles.candidateCard}>
            <View style={styles.candidateRow}>
              <PosterImage uri={candidate.posterUrl} width={64} height={96} title={candidate.title} />
              <View style={styles.candidateText}>
                <Text style={typography.subheading}>{candidate.title}{candidate.year ? ` (${candidate.year})` : ''}</Text>
                <Text style={styles.rowLabel}>
                  {candidate.seasonCount ?? '?'} season(s), {candidate.episodeCount ?? '?'} episode(s) · {formatConfidencePercent(candidate.confidenceScore)} confidence
                </Text>
                <Text style={styles.explanation}>{candidate.explanation}</Text>
                {candidate.warnings.map((w, i) => (
                  <Text key={i} style={styles.warning}>⚠ {w}</Text>
                ))}
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.selectButton, pressed && styles.pressed, confirmMutation.isPending && styles.disabled]}
              onPress={() => handleSelect(candidate)}
              disabled={confirmMutation.isPending}
            >
              <Text style={styles.selectButtonText}>Select this candidate</Text>
            </Pressable>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: radii.md, backgroundColor: colors.surface, gap: spacing.xs },
  rowLabel: { ...typography.bodySecondary },
  candidateCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.lg, borderRadius: radii.md, backgroundColor: colors.surface, gap: spacing.md },
  candidateRow: { flexDirection: 'row', gap: spacing.md },
  candidateText: { flex: 1, gap: 4 },
  explanation: { ...typography.small },
  warning: { ...typography.small, color: colors.warning },
  selectButton: { paddingVertical: spacing.sm, borderRadius: radii.md, alignItems: 'center', backgroundColor: colors.accent },
  selectButtonText: { ...typography.caption, fontWeight: '700', color: '#0A0A0D' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
