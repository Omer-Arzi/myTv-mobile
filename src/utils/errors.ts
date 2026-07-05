import { ApiError } from '../api/client';

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

// status 0 is how client.ts flags a network-level failure (unreachable
// host, wrong API_BASE_URL, timeout) rather than a real HTTP error status.
export function isConnectionError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}
