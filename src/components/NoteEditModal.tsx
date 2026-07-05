import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/theme';

interface Props {
  visible: boolean;
  episodeLabel: string;
  initialText: string | null;
  isSaving: boolean;
  onSave: (text: string) => void;
  onClose: () => void;
}

const NOTE_MAX_LENGTH = 2000;

// A plain RN Modal rather than a stack screen — this is a lightweight
// single-field edit, not a navigable destination of its own.
export function NoteEditModal({ visible, episodeLabel, initialText, isSaving, onSave, onClose }: Props) {
  const [text, setText] = useState(initialText ?? '');

  // Reset the draft whenever a different episode is opened for editing.
  useEffect(() => {
    if (visible) setText(initialText ?? '');
  }, [visible, initialText]);

  const trimmed = text.trim();
  const canSave = trimmed.length > 0 && !isSaving;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={isSaving ? undefined : onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Edit Note</Text>
          <Text style={styles.subtitle}>{episodeLabel}</Text>

          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Add a note about this episode..."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={NOTE_MAX_LENGTH}
            editable={!isSaving}
            autoFocus
          />
          <Text style={styles.counter}>{`${text.length}/${NOTE_MAX_LENGTH}`}</Text>

          <View style={styles.buttonRow}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={isSaving}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.saveButton, !canSave && styles.saveButtonDisabled]}
              onPress={() => onSave(trimmed)}
              disabled={!canSave}
            >
              {isSaving ? <ActivityIndicator size="small" color="#0A0A0D" /> : <Text style={styles.saveButtonText}>Save</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
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
  subtitle: { ...typography.caption, marginBottom: spacing.xs },
  input: {
    ...typography.body,
    minHeight: 100,
    maxHeight: 200,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  counter: { ...typography.small, alignSelf: 'flex-end' },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  button: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: { backgroundColor: colors.surfaceElevated },
  cancelButtonText: { ...typography.body, fontWeight: '600' },
  saveButton: { backgroundColor: colors.accent },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#0A0A0D', fontWeight: '700', fontSize: 15 },
});
