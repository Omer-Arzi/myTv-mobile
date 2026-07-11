import { ReactNode } from 'react';
import { RefreshControlProps, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/theme';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  // Lets a screen temporarily disable scrolling — e.g. while a child card
  // (WatchNextCard) has locked onto a horizontal swipe, as an extra
  // defensive layer against this ScrollView's native pan recognizer
  // fighting it on a diagonal drag. Defaults to normal scrolling.
  scrollEnabled?: boolean;
}

// The one place screen background/safe-area handling lives — every screen
// wraps its content in this instead of repeating SafeAreaView/ScrollView
// boilerplate with its own background color.
export function Screen({
  children,
  scroll = true,
  refreshControl,
  contentContainerStyle,
  edges = ['top', 'bottom'],
  scrollEnabled = true,
}: Props) {
  if (!scroll) {
    return (
      <SafeAreaView style={styles.container} edges={edges}>
        <View style={[styles.staticContent, contentContainerStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={edges}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: spacing.xxl },
  staticContent: { flex: 1 },
});
