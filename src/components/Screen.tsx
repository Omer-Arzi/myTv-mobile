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
}

// The one place screen background/safe-area handling lives — every screen
// wraps its content in this instead of repeating SafeAreaView/ScrollView
// boilerplate with its own background color.
export function Screen({ children, scroll = true, refreshControl, contentContainerStyle, edges = ['top', 'bottom'] }: Props) {
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
