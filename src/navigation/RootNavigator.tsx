import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { SeriesDetailScreen } from '../screens/SeriesDetailScreen';
import { NeedsAttentionScreen } from '../screens/NeedsAttentionScreen';
import { MigrationProposalScreen } from '../screens/MigrationProposalScreen';
import { MigrationHistoryScreen } from '../screens/MigrationHistoryScreen';
import { MigrationHistoryDetailScreen } from '../screens/MigrationHistoryDetailScreen';
import { ProviderCandidateSearchScreen } from '../screens/ProviderCandidateSearchScreen';
import { RootStackParamList } from './types';
import { colors } from '../theme/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { color: colors.textPrimary },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen
        name="SeriesDetail"
        component={SeriesDetailScreen}
        options={({ route }) => ({ title: route.params.title ?? 'Series', headerBackTitle: 'Back' })}
      />
      <Stack.Screen name="NeedsAttention" component={NeedsAttentionScreen} options={{ title: 'Needs Attention', headerBackTitle: 'Back' }} />
      <Stack.Screen
        name="MigrationProposal"
        component={MigrationProposalScreen}
        options={({ route }) => ({ title: route.params.title ?? 'Migration Proposal', headerBackTitle: 'Back' })}
      />
      <Stack.Screen name="MigrationHistory" component={MigrationHistoryScreen} options={{ title: 'Migration History', headerBackTitle: 'Back' }} />
      <Stack.Screen
        name="MigrationHistoryDetail"
        component={MigrationHistoryDetailScreen}
        options={({ route }) => ({ title: route.params.seriesTitle ?? 'Migration', headerBackTitle: 'Back' })}
      />
      <Stack.Screen
        name="ProviderCandidateSearch"
        component={ProviderCandidateSearchScreen}
        options={({ route }) => ({ title: route.params.title ?? 'Find Provider', headerBackTitle: 'Back' })}
      />
    </Stack.Navigator>
  );
}
