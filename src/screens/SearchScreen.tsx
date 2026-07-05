import { StyleSheet, Text } from 'react-native';
import { Screen } from '../components/Screen';
import { colors, spacing, typography } from '../theme/theme';

// Placeholder only — no search functionality yet. The backend currently
// has no "search TMDb and add a new series" endpoint either (see
// API_CONTRACT.md's "Not available yet"), so this screen has nothing real
// to call yet.
export function SearchScreen() {
  return (
    <Screen scroll={false} contentContainerStyle={styles.container}>
      <Text style={styles.glyph}>🔍</Text>
      <Text style={styles.title}>Search</Text>
      <Text style={styles.subtitle}>Coming soon.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 40, textAlign: 'center', marginBottom: spacing.md, opacity: 0.6 },
  title: { ...typography.heading, textAlign: 'center' },
  subtitle: { ...typography.bodySecondary, textAlign: 'center', marginTop: spacing.xs, color: colors.textTertiary },
});
