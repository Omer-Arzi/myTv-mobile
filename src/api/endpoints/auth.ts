import { apiClient } from '../client';

export function login(password: string): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>('/auth/login', { password });
}

export function logout(): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>('/auth/logout');
}

// Deliberately reachable only if the server's session guard already let it
// through — a 401 here (see ApiError.status) IS the "not logged in" signal,
// not a special error case to catch separately. See AuthGate.tsx.
export function getAuthStatus(): Promise<{ authenticated: true }> {
  return apiClient.get<{ authenticated: true }>('/auth/status');
}
