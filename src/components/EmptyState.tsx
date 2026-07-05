import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/theme';

interface Props {
  message: string;
}

export function EmptyState({ message }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  text: { ...typography.bodySecondary, color: colors.textTertiary },
});
