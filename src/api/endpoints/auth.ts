import { apiClient } from '../client';
import { clearAuthToken, setAuthToken } from '../authToken';

// Stores the returned bearer token itself — callers don't need to touch
// authToken.ts directly. See client.ts for how it's attached to requests.
export async function login(password: string): Promise<void> {
  const { token } = await apiClient.post<{ token: string }>('/auth/login', { password });
  await setAuthToken(token);
}

// Purely local — there's no server-side session to invalidate for a bearer
// token (see server/docs/auth.md); logging out just means forgetting it.
export function logout(): Promise<void> {
  return clearAuthToken();
}

// Deliberately reachable only if the server's session guard already let it
// through — a 401 here (see ApiError.status) IS the "not logged in" signal,
// not a special error case to catch separately. See AuthGate.tsx.
export function getAuthStatus(): Promise<{ authenticated: true }> {
  return apiClient.get<{ authenticated: true }>('/auth/status');
}
