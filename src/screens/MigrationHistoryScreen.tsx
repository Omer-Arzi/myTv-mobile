import { useCallback } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { getMigrationHistory } from '../api/endpoints/migration-workbench';
import { queryKeys } from '../api/queryKeys';
import { Screen } from '../components/Screen';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { RootStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { formatDate } from '../utils/format';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

// Every migration ever applied for this user, most recent first — the
// durable audit trail behind GET /migration-workbench/history. Tapping a
// row opens MigrationHistoryDetailScreen, where rollback (preview then
// confirm) actually happens.
export function MigrationHistoryScreen() {
  const navigation = useNavigation<Navigation>();
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.migrationHistory,
    queryFn: getMigrationHistory,
  });

  const openDetail = useCallback((migrationId: string, seriesTitle: string) => navigation.navigate('MigrationHistoryDetail', { migrationId, seriesTitle }), [navigation]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <LoadingState />;

  return (
    <Screen refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}>
      {data.length === 0 ? (
        <EmptyState message="No migrations applied yet. Confirmed migrations from the Migration Workbench will show up here." />
      ) : (
        data.map((item) => (
          <Pressable key={item.id} style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={() => openDetail(item.id, item.seriesTitle)}>
            <View style={styles.rowText}>
              <Text style={typography.subheading}>{item.seriesTitle}</Text>
              <Text style={typography.bodySecondary}>{formatDate(item.appliedAt)}</Text>
              <View style={styles.badgeRow}>
                <StatusBadge status={item.userStatusBefore} />
                <Text style={styles.arrow}>→</Text>
                <StatusBadge status={item.userStatusAfter} />
                {item.rolledBack ? <Text style={styles.rolledBackLabel}>Rolled back</Text> : null}
              </View>
            </View>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  pressed: { opacity: 0.7 },
  rowText: { gap: spacing.xs },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  arrow: { ...typography.caption },
  rolledBackLabel: { ...typography.small, color: colors.warning, marginLeft: spacing.xs, borderRadius: radii.full },
});
