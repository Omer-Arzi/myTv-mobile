import { ReactNode, useEffect, useState } from 'react';
import { getAuthStatus } from '../api/endpoints/auth';
import { subscribeToAuthState } from '../api/authState';
import { LoadingState } from './LoadingState';
import { LoginScreen } from '../screens/LoginScreen';

interface Props {
  children: ReactNode;
}

// Renders LoginScreen instead of `children` (the whole rest of the app,
// including NavigationContainer — this gate has nowhere to navigate to,
// so it sits above it, not inside a stack screen) whenever there's no
// valid session. A deployment that never sets APP_PASSWORD (local dev)
// never shows the login screen at all — GET /auth/status always succeeds
// there (see server/docs/auth.md) — so this is a no-op wrapper for the
// existing local dev experience.
export function AuthGate({ children }: Props) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAuthStatus()
      .then(() => {
        if (!cancelled) setIsAuthenticated(true);
      })
      .catch(() => {
        // A 401 means "not logged in" — the expected, normal unauthenticated
        // state, not an error to alarm about. Anything else (network
        // failure, unreachable server) surfaces the same way: no session
        // can be confirmed, so the login screen is still the right thing
        // to show — its own login attempt will report the real problem.
        if (!cancelled) setIsAuthenticated(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Session can also expire mid-use (any later request 401s) — see
  // api/client.ts's setAuthState call and api/authState.ts.
  useEffect(() => subscribeToAuthState(setIsAuthenticated), []);

  if (isAuthenticated === null) return <LoadingState />;
  if (!isAuthenticated) return <LoginScreen onLoggedIn={() => setIsAuthenticated(true)} />;
  return <>{children}</>;
}
