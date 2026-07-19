import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { login } from '../api/endpoints/auth';
import { Screen } from '../components/Screen';
import { colors, radii, spacing, typography } from '../theme/theme';
import { getErrorMessage } from '../utils/errors';

interface Props {
  // Called on a successful login — AuthGate (the only caller) flips its own
  // isAuthenticated state to true in response, swapping this screen out for
  // the real app. This screen has no navigation of its own to do.
  onLoggedIn: () => void;
}

// Rendered by AuthGate in place of the whole app (outside NavigationContainer
// — this has nowhere to navigate to yet) whenever GET /auth/status 401s.
// Deployments that never set APP_PASSWORD (local dev) never see this at
// all — see server/docs/auth.md.
export function LoginScreen({ onLoggedIn }: Props) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!password || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await login(password);
      onLoggedIn();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen scroll={false}>
      <View style={styles.container}>
        <Text style={styles.title}>MyTV</Text>
        <Text style={styles.subtitle}>Enter the password to continue</Text>

        <TextInput
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (error) setError(null);
          }}
          onSubmitEditing={handleSubmit}
          placeholder="Password"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          secureTextEntry
          autoFocus
          returnKeyType="go"
          editable={!isSubmitting}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, (!password || isSubmitting) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!password || isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator size="small" color="#0A0A0D" /> : <Text style={styles.buttonText}>Log In</Text>}
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  title: { ...typography.title, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { ...typography.bodySecondary, textAlign: 'center', marginBottom: spacing.lg },
  input: {
    ...typography.body,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 15, fontWeight: '700', color: '#0A0A0D' },
});
