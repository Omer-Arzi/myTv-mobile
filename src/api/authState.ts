// A tiny module-level pub-sub, not a full state library — this app has
// exactly one thing to broadcast (session validity), and it needs to be
// reachable from the API client itself (client.ts, deep inside every
// request) as well as from the top-level AuthGate component that decides
// whether to render the login screen or the app. Any 401 from any request
// (not just the initial GET /auth/status check) should be able to kick the
// whole app back to the login screen — e.g. a session that expires mid-use.
type Listener = (authenticated: boolean) => void;

const listeners = new Set<Listener>();

export function subscribeToAuthState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAuthState(authenticated: boolean): void {
  for (const listener of listeners) listener(authenticated);
}
