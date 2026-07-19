import { useEffect, useState } from 'react';
import { AlertButton, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/theme';

interface AlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

interface AlertRequest {
  title: string;
  message?: string;
  buttons: AlertButton[];
  cancelable: boolean;
  onDismiss?: () => void;
}

let showHandler: ((request: AlertRequest) => void) | null = null;

// Web-only replacement for RN's Alert.alert, which on react-native-web is a
// thin, unstyled window.alert/confirm shim that can't represent 3+ custom
// buttons (this app's "Series Options" menu needs 3-4) and looks like
// browser chrome rather than this app's design. Mounted once at the app
// root (see App.tsx, web-only) and driven imperatively so call sites (see
// ../utils/appAlert.ts) stay a near drop-in swap for Alert.alert. Native
// iOS/Android never call into this — they keep the real system Alert.
export function showWebAlert(
  title: string,
  message?: string,
  buttons: AlertButton[] = [{ text: 'OK' }],
  options?: AlertOptions,
) {
  if (!showHandler) {
    // Host not mounted yet — shouldn't happen once App.tsx renders it, but
    // fall back to a plain window.alert so a call never silently no-ops.
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  showHandler({
    title,
    message,
    buttons: buttons.length > 0 ? buttons : [{ text: 'OK' }],
    cancelable: options?.cancelable ?? true,
    onDismiss: options?.onDismiss,
  });
}

export function WebAlertHost() {
  const [request, setRequest] = useState<AlertRequest | null>(null);

  useEffect(() => {
    showHandler = setRequest;
    return () => {
      showHandler = null;
    };
  }, []);

  if (!request) return null;

  const handleButtonPress = (onPress?: () => void) => {
    setRequest(null);
    onPress?.();
  };

  const handleBackdropPress = () => {
    if (!request.cancelable) return;
    const dismiss = request.onDismiss;
    setRequest(null);
    dismiss?.();
  };

  // Mirrors NoteEditModal's row-of-filled-buttons look for the common
  // confirm/cancel + plain-OK cases (<=2 buttons). 3+ buttons only happens
  // for the "Series Options" action-sheet-style menu, which reads better as
  // a plain vertical list of rows than as filled side-by-side buttons.
  const isRow = request.buttons.length <= 2;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleBackdropPress}>
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{request.title}</Text>
          {request.message ? <Text style={styles.message}>{request.message}</Text> : null}

          <View style={isRow ? styles.buttonRow : styles.buttonStack}>
            {request.buttons.map((button, index) =>
              isRow ? (
                <Pressable
                  key={`${button.text}-${index}`}
                  style={[styles.rowButton, rowButtonStyle(button.style)]}
                  onPress={() => handleButtonPress(button.onPress)}
                >
                  <Text style={rowButtonTextStyle(button.style)}>{button.text}</Text>
                </Pressable>
              ) : (
                <Pressable
                  key={`${button.text}-${index}`}
                  style={[styles.stackButton, index > 0 && styles.stackButtonDivider]}
                  onPress={() => handleButtonPress(button.onPress)}
                >
                  <Text style={stackButtonTextStyle(button.style)}>{button.text}</Text>
                </Pressable>
              ),
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function rowButtonStyle(style?: AlertButton['style']) {
  if (style === 'destructive') return styles.rowButtonDestructive;
  if (style === 'cancel') return styles.rowButtonCancel;
  return styles.rowButtonDefault;
}

function rowButtonTextStyle(style?: AlertButton['style']) {
  if (style === 'destructive') return styles.rowButtonDestructiveText;
  if (style === 'cancel') return styles.rowButtonCancelText;
  return styles.rowButtonDefaultText;
}

function stackButtonTextStyle(style?: AlertButton['style']) {
  if (style === 'destructive') return styles.stackButtonDestructiveText;
  if (style === 'cancel') return styles.stackButtonCancelText;
  return styles.stackButtonDefaultText;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { ...typography.subheading },
  message: { ...typography.body, color: colors.textSecondary },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  buttonStack: { marginTop: spacing.md, marginHorizontal: -spacing.lg, marginBottom: -spacing.lg },
  rowButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  rowButtonDefault: { backgroundColor: colors.accent },
  rowButtonDefaultText: { color: '#0A0A0D', fontWeight: '700', fontSize: 15 },
  rowButtonCancel: { backgroundColor: colors.surfaceElevated },
  rowButtonCancelText: { ...typography.body, fontWeight: '600' },
  rowButtonDestructive: { backgroundColor: colors.danger },
  rowButtonDestructiveText: { color: '#0A0A0D', fontWeight: '700', fontSize: 15 },
  stackButton: { paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center' },
  stackButtonDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  stackButtonDefaultText: { ...typography.body, color: colors.accent, fontWeight: '600' },
  stackButtonCancelText: { ...typography.body, color: colors.textSecondary, fontWeight: '700' },
  stackButtonDestructiveText: { ...typography.body, color: colors.danger, fontWeight: '600' },
});
