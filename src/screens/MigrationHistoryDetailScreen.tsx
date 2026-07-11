import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMigrationHistoryDetail, previewRollback, rollbackMigration } from '../api/endpoints/migration-workbench';
import { queryKeys } from '../api/queryKeys';
import { Screen } from '../components/Screen';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { SectionHeader } from '../components/SectionHeader';
import { StatusBadge } from '../components/StatusBadge';
import { RootStackParamList } from '../navigation/types';
import { MigrationRollbackPreview } from '../api/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { formatDate } from '../utils/format';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'MigrationHistoryDetail'>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

// "Migration completed" detail — provider before/after, catalog change,
// progress before/after, and the rollback preview/confirm flow. Rollback
// always requires a preview first (fetched on demand, not auto-loaded, so
// a user only ever sees it after explicitly asking) and an explicit
// confirmation dialog before the real, irreversible-again write happens.
export function MigrationHistoryDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<DetailRoute>();
  const { migrationId } = route.params;
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<MigrationRollbackPreview | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.migrationHistoryDetail(migrationId),
    queryFn: () => getMigrationHistoryDetail(migrationId),
  });

  const previewMutation = useMutation({
    mutationFn: () => previewRollback(migrationId),
    onSuccess: (result) => setPreview(result),
    onError: (err: unknown) => Alert.alert('Could not preview rollback', err instanceof Error ? err.message : 'Something went wrong.'),
  });

  const rollbackMutation = useMutation({
    mutationFn: () => rollbackMigration(migrationId),
    onMutate: () => setIsRollingBack(true),
    onSettled: () => setIsRollingBack(false),
    onSuccess: (result) => {
      // Refresh everything the rollback could have changed.
      queryClient.invalidateQueries({ queryKey: queryKeys.migrationWorkbench });
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
      queryClient.invalidateQueries({ queryKey: queryKeys.home });
      queryClient.invalidateQueries({ queryKey: queryKeys.migrationHistory });
      queryClient.invalidateQueries({ queryKey: queryKeys.migrationHistoryDetail(migrationId) });
      Alert.alert('Rollback complete', result.message, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    },
    onError: (err: unknown) => Alert.alert('Rollback failed', err instanceof Error ? err.message : 'Something went wrong.'),
  });

  const handleConfirmRollback = useCallback(() => {
    Alert.alert('Confirm rollback', 'This will restore the previous provider and progress, and remove episodes this migration added. Watched history will remain preserved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm rollback', style: 'destructive', onPress: () => rollbackMutation.mutate() },
    ]);
  }, [rollbackMutation]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <LoadingState />;

  return (
    <Screen>
      <SectionHeader title="Migration completed" subtitle={formatDate(data.appliedAt) ?? undefined} />

      <SectionHeader title="Provider" />
      <View style={styles.card}>
        <Row label="Old" value={data.providerBefore?.provider ?? 'None'} />
        <Row label="New" value={data.providerAfter.provider ?? 'Unknown'} />
      </View>

      <SectionHeader title="Catalog" />
      <View style={styles.card}>
        <Row label="Episodes added" value={String(data.episodesInsertedCount)} />
        <Row label="Episodes updated" value={String(data.episodesUpdatedCount)} />
        <Row label="Preserved orphan watches" value={String(data.preservedOrphanEpisodeCount)} />
      </View>

      <SectionHeader title="Progress" />
      <View style={styles.card}>
        <View style={styles.row}>
          <StatusBadge status={data.userStatusBefore} />
          <Text style={styles.rowLabel}>→</Text>
          <StatusBadge status={data.userStatusAfter} />
        </View>
        <Row label="Watched history" value="Preserved" />
      </View>

      {data.rolledBackAt ? (
        <View style={styles.card}>
          <Text style={styles.rolledBackText}>Rolled back on {formatDate(data.rolledBackAt)}.</Text>
        </View>
      ) : preview ? (
        <>
          <SectionHeader title="Rollback will:" />
          <View style={styles.card}>
            {preview.eligible ? (
              <>
                <Text style={styles.bullet}>• restore provider to {preview.wouldRestoreProvider?.provider ?? 'none'}</Text>
                <Text style={styles.bullet}>• restore progress to {preview.wouldRestoreUserStatus}</Text>
                <Text style={styles.bullet}>• remove {preview.wouldRemoveEpisodeCount} migration-added episode(s)</Text>
                <Text style={styles.watchedPreserved}>Watched history will remain preserved.</Text>
                <Pressable style={({ pressed }) => [styles.button, styles.primaryButton, pressed && styles.pressed, isRollingBack && styles.disabled]} onPress={handleConfirmRollback} disabled={isRollingBack}>
                  <Text style={styles.primaryButtonText}>{isRollingBack ? 'Rolling back…' : 'Confirm rollback'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.reasonText}>Rollback is not available:</Text>
                {preview.explanations.map((explanation, i) => (
                  <Text key={i} style={styles.bullet}>• {explanation}</Text>
                ))}
              </>
            )}
          </View>
        </>
      ) : (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.button, styles.secondaryButton, pressed && styles.pressed]}
            onPress={() => previewMutation.mutate()}
            disabled={previewMutation.isPending}
          >
            <Text style={styles.secondaryButtonText}>{previewMutation.isPending ? 'Loading…' : 'Preview rollback'}</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: radii.md, backgroundColor: colors.surface, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  rowLabel: { ...typography.bodySecondary },
  rowValue: { ...typography.body, fontWeight: '600' },
  reasonText: { ...typography.bodySecondary },
  bullet: { ...typography.bodySecondary },
  watchedPreserved: { ...typography.body, color: colors.success, fontWeight: '600', marginTop: spacing.sm },
  rolledBackText: { ...typography.bodySecondary, color: colors.warning },
  actions: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  button: { paddingVertical: spacing.md, borderRadius: radii.md, alignItems: 'center' },
  primaryButton: { backgroundColor: colors.danger, marginTop: spacing.md },
  primaryButtonText: { ...typography.body, fontWeight: '700', color: '#0A0A0D' },
  secondaryButton: { backgroundColor: colors.surfaceElevated },
  secondaryButtonText: { ...typography.body, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
