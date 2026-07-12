import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/theme';

const AUTO_DISMISS_MS = 3000;

interface Props {
  message: string | null;
  onDismiss: () => void;
}

// A single, self-contained bottom toast — no toast library/global provider
// exists anywhere in this app, and Search is (so far) the only screen that
// needs one (Add-failure, per the approved UX plan: "icon reverts to +
// silently, brief toast at screen bottom" rather than growing the card with
// inline error text). Scoped locally to whichever screen renders it rather
// than a new app-wide system, since nothing else needs one yet.
export function Toast({ message, onDismiss }: Props) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.toast}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, bottom: spacing.xl, alignItems: 'center' },
  toast: { backgroundColor: colors.surfaceElevated, borderRadius: radii.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  text: { ...typography.caption, color: colors.textPrimary },
});
