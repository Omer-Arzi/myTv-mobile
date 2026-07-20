import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, NavigationContainer, NavigationState, Theme } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { WebAlertHost } from './src/components/WebAlertHost';
import { AuthGate } from './src/components/AuthGate';
import { colors } from './src/theme/theme';
import { installRemoteLoggerListeners, logEvent } from './src/utils/remoteLogger';

// The currently-focused route's name, from React Navigation's own nested
// state tree — used only for the web remote-logger breadcrumb below (see
// remoteLogger.ts), not for any navigation decision.
function getFocusedRouteName(state: NavigationState | undefined): string | undefined {
  if (!state) return undefined;
  const route = state.routes[state.index ?? 0];
  return route.state ? getFocusedRouteName(route.state as NavigationState) : route.name;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// Extends React Navigation's own DarkTheme rather than building one from
// scratch — keeps default navigator chrome (headers, tab bars) consistent
// with our palette without having to restate every theme token.
const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.accent,
  },
};

export default function App() {
  const lastLoggedRouteRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    installRemoteLoggerListeners();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <NavigationContainer
            theme={navigationTheme}
            onStateChange={(state) => {
              // Web-only remote-logger breadcrumb (see remoteLogger.ts) —
              // only logs on an actual route change, not every internal
              // state update React Navigation fires onStateChange for.
              const routeName = getFocusedRouteName(state);
              if (routeName && routeName !== lastLoggedRouteRef.current) {
                lastLoggedRouteRef.current = routeName;
                logEvent('route_change', { routeName });
              }
            }}
          >
            <RootNavigator />
          </NavigationContainer>
        </AuthGate>
      </QueryClientProvider>
      <StatusBar style="light" />
      {Platform.OS === 'web' && <WebAlertHost />}
    </SafeAreaProvider>
  );
}
