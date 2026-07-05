import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/theme';
import { getErrorMessage, isConnectionError } from '../utils/errors';

interface Props {
  error: unknown;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: Props) {
  const title = isConnectionError(error) ? "Can't reach the server" : 'Something went wrong';
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{getErrorMessage(error)}</Text>
      <Pressable style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.background },
  title: { ...typography.subheading },
  message: { ...typography.bodySecondary, textAlign: 'left' },
  button: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
  },
  buttonText: { color: '#0A0A0D', fontWeight: '700', fontSize: 14 },
});
