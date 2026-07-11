import { ManualUserStatus, UserSeriesStatus } from '../api/types';

export interface SeriesStatusAction {
  // Exact copy this task requires — never implies history deletion.
  label: 'Put on hold' | 'Drop series' | 'Resume watching';
  targetStatus: ManualUserStatus;
  requiresConfirmation: boolean;
  // Only set when requiresConfirmation is true. Deliberately says nothing
  // about deleting/removing anything — status-only change, watch history
  // and progress are untouched (server/docs/on-hold-dropped-status-todo.md
  // Phase 5/8).
  confirmationMessage?: string;
}

const DROP_CONFIRMATION_MESSAGE =
  'Your watch history and progress are kept exactly as they are. You can resume this series anytime.';

const PUT_ON_HOLD: SeriesStatusAction = { label: 'Put on hold', targetStatus: 'PAUSED', requiresConfirmation: false };
const DROP_SERIES: SeriesStatusAction = {
  label: 'Drop series',
  targetStatus: 'DROPPED',
  requiresConfirmation: true,
  confirmationMessage: DROP_CONFIRMATION_MESSAGE,
};
// Requesting WATCHING is also how "resume" works — the backend derives the
// actually-correct resulting status (WATCHING/CAUGHT_UP/COMPLETED) rather
// than blindly setting WATCHING (series-query-helpers.ts::deriveManualStatusUpdate).
const RESUME_WATCHING: SeriesStatusAction = { label: 'Resume watching', targetStatus: 'WATCHING', requiresConfirmation: false };

// Which status-change actions are offered from the series-page options
// menu, per current userStatus. Never includes an action that would just
// set the status back to what it already is. Pure/no I/O so it's testable
// without mocking Alert or the API — see
// server/docs/on-hold-dropped-status-todo.md Phase 4/8 for the exact
// transition table this implements.
export function getAvailableStatusActions(currentStatus: UserSeriesStatus): SeriesStatusAction[] {
  switch (currentStatus) {
    case 'WATCHING':
    case 'CAUGHT_UP':
    // COMPLETED has no "resume" concept (nothing left to watch) — offered
    // the same two actions as CAUGHT_UP, the other active-ish state.
    case 'COMPLETED':
      return [PUT_ON_HOLD, DROP_SERIES];
    case 'PAUSED':
      return [RESUME_WATCHING, DROP_SERIES];
    case 'DROPPED':
      return [RESUME_WATCHING, PUT_ON_HOLD];
    // WATCHLIST (not yet started) and UNKNOWN (no real relationship yet)
    // have no on-hold/drop concept — no menu is shown for these (see
    // SeriesDetailScreen, which hides the options button entirely when
    // this returns an empty array).
    case 'WATCHLIST':
    case 'UNKNOWN':
    default:
      return [];
  }
}
