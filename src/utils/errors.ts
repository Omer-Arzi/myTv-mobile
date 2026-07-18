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

// Both the watch-all endpoints (server/src/common/watch-all-logic.ts's
// checkWatchAllAllowed) and DELETE /episode-watches/:watchId (attached
// note/rating/emotion protection) reject with this same "retry with
// force=true" 400 shape — one shared predicate so every force-retry flow in
// the app (SeriesDetailScreen, UpcomingTimeline) recognizes it identically
// and can never silently drift apart. Matching on the message substring
// (rather than "any 400") keeps this from misfiring on an unrelated
// validation error.
export function isForceRequiredError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 400 && err.message.includes('force=true');
}
