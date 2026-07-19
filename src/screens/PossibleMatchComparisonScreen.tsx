import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmProviderIdentity } from '../api/endpoints/migration-workbench';
import { Screen } from '../components/Screen';
import { PosterImage } from '../components/PosterImage';
import { StatusBadge } from '../components/StatusBadge';
import { RootStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { formatConfidencePercent } from '../utils/format';
import { appAlert } from '../utils/appAlert';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type ComparisonRoute = RouteProp<RootStackParamList, 'PossibleMatchComparison'>;

// A lightweight 1-vs-1 comparison — deliberately its own small screen
// rather than a repurposed ProviderCandidateSearchScreen (which compares
// one KNOWN local series against MANY external candidates; this is the
// inverse: one external search result against ONE uncertain local series).
// Built from the same visual pieces (poster pairs, confidence/reason text)
// but with its own focused layout, per the approved implementation
// decision. Never allows Add/navigation away with the ambiguity still
// unresolved except via an explicit Cancel.
export function PossibleMatchComparisonScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<ComparisonRoute>();
  const { candidateTitle, candidateYear, candidatePosterUrl, candidateProvider, candidateProviderId, possibleSeriesId, possibleSeriesTitle, possibleSeriesUserStatus, confidence, reason, onTreatAsDifferent } = route.params;
  const queryClient = useQueryClient();

  const confirmMutation = useMutation({
    mutationFn: () => confirmProviderIdentity(possibleSeriesId, { provider: candidateProvider, providerId: candidateProviderId, confidence }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search'] });
      navigation.goBack();
    },
    onError: (err: unknown) => appAlert('Could not save identity', err instanceof Error ? err.message : 'Something went wrong.'),
  });

  const openExisting = useCallback(() => {
    navigation.navigate('SeriesDetail', { seriesId: possibleSeriesId, title: possibleSeriesTitle });
  }, [navigation, possibleSeriesId, possibleSeriesTitle]);

  const handleConfirmSame = useCallback(() => {
    appAlert('Confirm same series', `Confirm "${candidateTitle}" as the same series as "${possibleSeriesTitle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => confirmMutation.mutate() },
    ]);
  }, [candidateTitle, possibleSeriesTitle, confirmMutation]);

  const handleTreatAsDifferent = useCallback(() => {
    onTreatAsDifferent();
    navigation.goBack();
  }, [onTreatAsDifferent, navigation]);

  const handleCancel = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <Screen>
      <View style={styles.pairRow}>
        <View style={styles.pairColumn}>
          <PosterImage uri={candidatePosterUrl} width={100} height={150} title={candidateTitle} />
          <Text style={typography.subheading} numberOfLines={2}>
            {candidateTitle}
            {candidateYear ? ` (${candidateYear})` : ''}
          </Text>
          <Text style={styles.caption}>Search result</Text>
        </View>
        <View style={styles.pairColumn}>
          <PosterImage uri={null} width={100} height={150} title={possibleSeriesTitle} />
          <Text style={typography.subheading} numberOfLines={2}>
            {possibleSeriesTitle}
          </Text>
          <StatusBadge status={possibleSeriesUserStatus} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.rowLabel}>{reason}</Text>
        <Text style={styles.caption}>{formatConfidencePercent(confidence)} title match confidence</Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={openExisting}>
          <Text style={styles.primaryButtonText}>Open existing series</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, confirmMutation.isPending && styles.disabled]}
          onPress={handleConfirmSame}
          disabled={confirmMutation.isPending}
        >
          <Text style={styles.secondaryButtonText}>{confirmMutation.isPending ? 'Confirming…' : 'Confirm same series'}</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={handleTreatAsDifferent}>
          <Text style={styles.secondaryButtonText}>They are different</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pairRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  pairColumn: { alignItems: 'center', gap: spacing.xs, flex: 1 },
  caption: { ...typography.caption },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radii.md, backgroundColor: colors.surface, gap: spacing.xs },
  rowLabel: { ...typography.body },
  actions: { marginHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm },
  primaryButton: { paddingVertical: spacing.md, borderRadius: radii.md, alignItems: 'center', backgroundColor: colors.accent },
  primaryButtonText: { ...typography.body, fontWeight: '700', color: '#0A0A0D' },
  secondaryButton: { paddingVertical: spacing.md, borderRadius: radii.md, alignItems: 'center', backgroundColor: colors.surfaceElevated },
  secondaryButtonText: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  cancelButton: { paddingVertical: spacing.md, alignItems: 'center' },
  cancelButtonText: { ...typography.body, color: colors.textSecondary },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
