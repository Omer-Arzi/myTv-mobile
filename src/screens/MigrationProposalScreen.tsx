import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { confirmMigration, getMigrationProposal, reviewSeasonShrink } from '../api/endpoints/migration-workbench';
import { ProposalReasonCode } from '../api/types/migration-workbench';
import { queryKeys } from '../api/queryKeys';
import { Screen } from '../components/Screen';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { SectionHeader } from '../components/SectionHeader';
import { StatusBadge } from '../components/StatusBadge';
import { RootStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type ProposalRoute = RouteProp<RootStackParamList, 'MigrationProposal'>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

// Short, fixed summary per reasonCode — the PRIMARY explanation shown to
// the user. The server's full `reason` text (sometimes very long — a real
// season-shrink case can list every unmatched episode by id) is available
// as collapsible detail below, never as the primary text.
const REASON_CODE_SUMMARIES: Record<ProposalReasonCode, string> = {
  NO_CONFIRMED_IDENTITY: 'This series needs a confirmed provider match before a migration can be proposed.',
  ALTERNATE_TITLE: 'The provider lists this show under a different title (translation or alternate name) than your local title.',
  IDENTITY_CONFLICT: 'The title matches, but the release year differs enough to suggest a different show (e.g. a remake or reboot).',
  PROVIDER_CATALOG_INCOMPLETE: "The provider's data for this show looks incomplete or could not be fetched.",
  SEASON_STRUCTURE_MISMATCH: "The provider's season structure doesn't line up with your local catalog (e.g. seasons combined or renumbered).",
  WATCH_HISTORY_UNMAPPED: "Some of your watched episodes don't have a matching slot in the provider's catalog.",
  ALREADY_MIGRATED: 'This series is already fully migrated — nothing left to do.',
  SAFE_TO_APPLY: 'Ready to migrate — everything checks out.',
};

// The single place a migration is actually reviewed and confirmed — the
// desired workflow's "Review migration proposal" step. Always a fresh live
// provider fetch (GET /migration-workbench/:seriesId/proposal), never the
// cached list-view data. Confirm Migration derives the final status
// automatically (COMPLETED/CAUGHT_UP/WATCHING) — there is deliberately no
// manual status picker anywhere on this screen.
export function MigrationProposalScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<ProposalRoute>();
  const { seriesId, title } = route.params;
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isReviewingSeasonShrink, setIsReviewingSeasonShrink] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.migrationProposal(seriesId),
    queryFn: () => getMigrationProposal(seriesId),
  });

  const openSeries = useCallback(() => navigation.navigate('SeriesDetail', { seriesId, title }), [navigation, seriesId, title]);
  const openProviderSearch = useCallback(() => navigation.navigate('ProviderCandidateSearch', { seriesId, title }), [navigation, seriesId, title]);

  const mutation = useMutation({
    mutationFn: () => confirmMigration(seriesId),
    onMutate: () => setIsConfirming(true),
    onSettled: () => setIsConfirming(false),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.migrationWorkbench });
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
      Alert.alert('Migration applied', result.message, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    },
    onError: (err: unknown) => {
      Alert.alert('Migration failed', err instanceof Error ? err.message : 'Something went wrong.');
    },
  });

  const seasonShrinkMutation = useMutation({
    mutationFn: () => reviewSeasonShrink(seriesId),
    onMutate: () => setIsReviewingSeasonShrink(true),
    onSettled: () => setIsReviewingSeasonShrink(false),
    onSuccess: () => refetch(),
    onError: (err: unknown) => {
      Alert.alert('Could not save review', err instanceof Error ? err.message : 'Something went wrong.');
    },
  });

  const handleConfirm = useCallback(() => {
    Alert.alert('Confirm Migration', `This will correct ${title ?? 'this series'}’ catalog and recompute its status. This cannot be undone from the app.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm Migration', style: 'destructive', onPress: () => mutation.mutate() },
    ]);
  }, [mutation, title]);

  const handleReviewSeasonShrink = useCallback(() => {
    Alert.alert(
      'Review Season Mismatch',
      `The provider's season structure for ${title ?? 'this series'} doesn't match your local catalog exactly. Approving this will let the migration proceed — every watched episode is still preserved, none are ever deleted or marked watched automatically.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: () => seasonShrinkMutation.mutate() },
      ],
    );
  }, [seasonShrinkMutation, title]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <LoadingState />;

  const actions = data.availableActions ?? [];
  const canConfirm = actions.includes('CONFIRM_MIGRATION');
  const canReviewSeasonShrink = actions.includes('REVIEW_SEASON_MISMATCH');
  const canFindNewProvider = actions.includes('FIND_NEW_PROVIDER');

  return (
    <Screen>
      <SectionHeader title="Current library" />
      {data.current ? (
        <View style={styles.card}>
          <Row label="Episodes" value={String(data.current.episodeCount)} />
          <Row label="Watched" value={String(data.current.watchedCount)} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Status</Text>
            <StatusBadge status={data.current.userStatus} />
          </View>
        </View>
      ) : null}

      <SectionHeader title="Migration proposal" />
      <View style={styles.card}>
        <Text style={styles.summaryText}>{REASON_CODE_SUMMARIES[data.reasonCode] ?? data.reason}</Text>
        <Pressable onPress={() => setShowDetail((v) => !v)}>
          <Text style={styles.detailToggle}>{showDetail ? 'Hide details' : 'Show details'}</Text>
        </Pressable>
        {showDetail ? <Text style={styles.reasonText}>{data.reason}</Text> : null}
      </View>

      {data.eligible && data.proposal ? (
        <View style={styles.card}>
          <Row label="Episodes" value={String(data.proposal.matchedTotalEpisodeCount + data.proposal.episodesToCreate)} />
          <Row label="Mapped watched" value={String(data.proposal.matchedWatchedEpisodeCount)} />
          {data.proposal.episodesToCreate > 0 ? <Row label="New episodes" value={String(data.proposal.episodesToCreate)} /> : null}
          {data.proposal.unmatchedWatchedOrphanCount > 0 ? <Row label="Preserved orphan watches" value={String(data.proposal.unmatchedWatchedOrphanCount)} /> : null}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Final derived status</Text>
            <StatusBadge status={data.proposal.proposedUserStatus} />
          </View>
          <Row label="Confidence" value={data.proposal.confidence === 'HIGH' ? 'High' : 'Borderline'} />
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={({ pressed }) => [styles.button, styles.secondaryButton, pressed && styles.pressed]} onPress={openSeries}>
          <Text style={styles.secondaryButtonText}>Review Series</Text>
        </Pressable>
        {canFindNewProvider ? (
          <Pressable style={({ pressed }) => [styles.button, styles.secondaryButton, pressed && styles.pressed]} onPress={openProviderSearch}>
            <Text style={styles.secondaryButtonText}>Find Provider</Text>
          </Pressable>
        ) : null}
        {canReviewSeasonShrink ? (
          <Pressable
            style={({ pressed }) => [styles.button, styles.primaryButton, pressed && styles.pressed, isReviewingSeasonShrink && styles.disabled]}
            onPress={handleReviewSeasonShrink}
            disabled={isReviewingSeasonShrink}
          >
            <Text style={styles.primaryButtonText}>{isReviewingSeasonShrink ? 'Saving…' : 'Review Season Mismatch'}</Text>
          </Pressable>
        ) : null}
        {canConfirm ? (
          <Pressable
            style={({ pressed }) => [styles.button, styles.primaryButton, pressed && styles.pressed, isConfirming && styles.disabled]}
            onPress={handleConfirm}
            disabled={isConfirming}
          >
            <Text style={styles.primaryButtonText}>{isConfirming ? 'Confirming…' : 'Confirm Migration'}</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { ...typography.bodySecondary },
  rowValue: { ...typography.body, fontWeight: '600' },
  summaryText: { ...typography.body },
  detailToggle: { ...typography.bodySecondary, color: colors.accent, fontWeight: '600' },
  reasonText: { ...typography.bodySecondary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  button: { flex: 1, minWidth: '45%', paddingVertical: spacing.md, borderRadius: radii.md, alignItems: 'center' },
  primaryButton: { backgroundColor: colors.accent },
  primaryButtonText: { ...typography.body, fontWeight: '700', color: '#0A0A0D' },
  secondaryButton: { backgroundColor: colors.surfaceElevated },
  secondaryButtonText: { ...typography.body, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
