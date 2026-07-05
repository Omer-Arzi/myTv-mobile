import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '../theme/theme';

interface Props {
  title: string;
  subtitle?: string;
  // An optional secondary control on the same line as the title (e.g. a
  // "Mark All Released" text-button) — kept generic rather than a fixed
  // button prop since callers style it themselves.
  action?: ReactNode;
}

export function SectionHeader({ title, subtitle, action }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {action}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.heading },
  subtitle: { ...typography.caption },
});
