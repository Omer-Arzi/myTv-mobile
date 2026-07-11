import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { confirmMigration, getMigrationProposal } from '../api/endpoints/migration-workbench';
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

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.migrationProposal(seriesId),
    queryFn: () => getMigrationProposal(seriesId),
  });

  const openSeries = useCallback(() => navigation.navigate('SeriesDetail', { seriesId, title }), [navigation, seriesId, title]);

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

  const handleConfirm = useCallback(() => {
    Alert.alert('Confirm Migration', `This will correct ${title ?? 'this series'}’ catalog and recompute its status. This cannot be undone from the app.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm Migration', style: 'destructive', onPress: () => mutation.mutate() },
    ]);
  }, [mutation, title]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <LoadingState />;

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
      ) : (
        <View style={styles.card}>
          <Text style={styles.reasonText}>{data.reason}</Text>
        </View>
      )}

      <SectionHeader title="Migration proposal" />
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
      ) : (
        <View style={styles.card}>
          <Text style={styles.reasonText}>{data.reason}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={({ pressed }) => [styles.button, styles.secondaryButton, pressed && styles.pressed]} onPress={openSeries}>
          <Text style={styles.secondaryButtonText}>Review Series</Text>
        </Pressable>
        {data.eligible ? (
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
  reasonText: { ...typography.bodySecondary },
  actions: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  button: { flex: 1, paddingVertical: spacing.md, borderRadius: radii.md, alignItems: 'center' },
  primaryButton: { backgroundColor: colors.accent },
  primaryButtonText: { ...typography.body, fontWeight: '700', color: '#0A0A0D' },
  secondaryButton: { backgroundColor: colors.surfaceElevated },
  secondaryButtonText: { ...typography.body, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
