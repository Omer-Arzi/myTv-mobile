// Minimal typed fetch wrapper for the MyTv backend (API_CONTRACT.md in the
// server repo is the source of truth for these shapes). Every request is
// implicitly treated as the same dev user by the backend (single-user app)
// — deployments that set APP_PASSWORD additionally require the bearer
// token from POST /auth/login, attached below as an Authorization header.
// Deliberately NOT a cookie — see server/docs/auth.md's "Why a bearer
// token, not a cookie" (Railway's *.up.railway.app subdomains are
// different *sites* to a browser, making a cookie third-party and subject
// to Safari/iOS's default blocking).

import { API_BASE_URL } from './config';
import { setAuthState } from './authState';
import { clearAuthToken, getAuthToken } from './authToken';

// Matches the Nest validation/HTTP-exception error shape documented in
// API_CONTRACT.md's "Error shape" section: { statusCode, message, error }
// where message is either a string or a string[] (class-validator).
interface ApiErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: ApiErrorBody,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Without an explicit timeout, a wrong/unreachable API_BASE_URL just hangs
// (no fetch failure, no error state — the app "feels stuck"). This forces a
// connection error within a few seconds instead.
const REQUEST_TIMEOUT_MS = 8000;

function connectionErrorMessage(detail: string): string {
  return [
    `Could not reach the server at ${API_BASE_URL}.`,
    '',
    '• Make sure the backend server is running.',
    '• Check that EXPO_PUBLIC_API_BASE_URL in .env is set correctly.',
    '• On a physical iPhone, "localhost" refers to the phone, not your Mac — use your Mac\'s LAN IP instead (see mobile/README.md).',
    '',
    `(${detail})`,
  ].join('\n');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  const token = await getAuthToken();

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
      signal: timeoutController.signal,
    });
  } catch (err) {
    // Network failure (backend unreachable, wrong API_BASE_URL, offline,
    // timeout, etc.) — status 0 distinguishes this from a real HTTP error status.
    const detail =
      (err as Error).name === 'AbortError' ? `timed out after ${REQUEST_TIMEOUT_MS / 1000}s` : (err as Error).message;
    throw new ApiError(connectionErrorMessage(detail), 0);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // Any 401 — not just from the initial GET /auth/status check AuthGate
    // makes on launch, but a session that expires mid-use on any later
    // request too — clears the now-invalid token and kicks the whole app
    // back to the login screen.
    if (response.status === 401) {
      void clearAuthToken();
      setAuthState(false);
    }

    let body: ApiErrorBody | undefined;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // Non-JSON error body — fall through with body undefined.
    }
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new ApiError(message ?? `Request to ${path} failed with status ${response.status}`, response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string): Promise<T> => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
};
