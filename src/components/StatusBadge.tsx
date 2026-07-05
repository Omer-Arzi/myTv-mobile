import { StyleSheet, Text, View } from 'react-native';
import { getStatusColor } from '../theme/statusColors';
import { radii, spacing } from '../theme/theme';
import { formatStatusLabel } from '../utils/format';

interface Props {
  status: string;
}

// Renders any ReleaseStatus/UserSeriesStatus value as a small pill,
// colored by getStatusColor and label-formatted ("IN_PRODUCTION" ->
// "In Production"). One component so status coloring/formatting can never
// drift between screens.
export function StatusBadge({ status }: Props) {
  const { bg, fg } = getStatusColor(status);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{formatStatusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  label: { fontSize: 12, fontWeight: '600' },
});
