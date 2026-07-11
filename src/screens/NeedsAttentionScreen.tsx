import { useCallback } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { getMigrationWorkbench } from '../api/endpoints/migration-workbench';
import { queryKeys } from '../api/queryKeys';
import { Screen } from '../components/Screen';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { SectionHeader } from '../components/SectionHeader';
import { SeriesCard } from '../components/SeriesCard';
import { EmptyState } from '../components/EmptyState';
import { RootStackParamList } from '../navigation/types';
import { MigrationWorkbenchItem } from '../api/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { groupMigrationWorkbenchItems } from '../utils/groupMigrationWorkbenchItems';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

// The "Needs Attention" inbox is now the Migration Workbench — every
// series still requiring migration work (not just "provider confirmation
// required"), grouped into 4 categories, prioritized deterministic-first:
// Ready Automatic, Ready for Confirmation, Needs Episode Review, No
// Reliable Provider — see groupMigrationWorkbenchItems.ts. GET
// /migration-workbench already does the real classification; this screen
// only partitions the response into sections and renders it. A
// NO_RELIABLE_PROVIDER item opens the "Find Provider" candidate-search
// flow instead of the proposal screen — there's no proposal to review
// until an identity is confirmed. Never auto-runs any migration.
export function NeedsAttentionScreen() {
  const navigation = useNavigation<Navigation>();
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.migrationWorkbench,
    queryFn: getMigrationWorkbench,
  });

  const openItem = useCallback(
    (item: MigrationWorkbenchItem) => {
      if (item.category === 'NO_RELIABLE_PROVIDER') {
        navigation.navigate('ProviderCandidateSearch', { seriesId: item.seriesId, title: item.title });
      } else {
        navigation.navigate('MigrationProposal', { seriesId: item.seriesId, title: item.title });
      }
    },
    [navigation],
  );
  const openHistory = useCallback(() => navigation.navigate('MigrationHistory'), [navigation]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <LoadingState />;

  const sections = groupMigrationWorkbenchItems(data);

  return (
    <Screen refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}>
      <Pressable style={({ pressed }) => [styles.historyButton, pressed && styles.pressed]} onPress={openHistory}>
        <Text style={styles.historyButtonText}>Migration History</Text>
      </Pressable>

      {sections.length === 0 ? (
        <EmptyState message="Nothing needs attention — every series in your library has finished migrating." />
      ) : (
        sections.map((section) => (
          <View key={section.category}>
            <SectionHeader title={section.title} />
            {section.items.map((item) => (
              <SeriesCard
                key={item.seriesId}
                variant="list"
                title={item.title}
                posterUrl={item.posterUrl}
                subtitle={item.category === 'NO_RELIABLE_PROVIDER' ? 'Tap to find a provider match' : item.reason}
                onPress={() => openItem(item)}
              />
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  historyButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    alignSelf: 'flex-start',
  },
  historyButtonText: { ...typography.caption, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
