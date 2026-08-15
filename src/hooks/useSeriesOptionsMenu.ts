import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertButton } from 'react-native';
import { removeFromWatchlist, updateSeriesStatus, UpdateSeriesStatusResponse } from '../api/endpoints/series';
import { queryKeys } from '../api/queryKeys';
import { UserSeriesStatus } from '../api/types';
import { getAvailableStatusActions, SeriesStatusAction } from '../utils/seriesStatusActions';
import { appAlert } from '../utils/appAlert';
import { confirmAsync } from '../utils/confirmAsync';
import { getErrorMessage } from '../utils/errors';

// The "..." options menu, extracted out of SeriesDetailScreen so Home's
// rail cards (Watch Next, Recently Watched, Haven't Watched For A While,
// Haven't Started Yet) can trigger the exact same status-change actions
// without a second implementation. Deliberately NOT the same menu contents
// for every status, though: getAvailableStatusActions (Put on hold / Drop
// series / Resume watching) returns an empty list for WATCHLIST — those
// actions assume the user has actually started the series, which a
// watchlisted-but-not-started show hasn't. WATCHLIST instead gets "Remove
// from Watchlist," a genuinely different operation (deletes the
// WatchlistItem row via DELETE /series/:id/watchlist — never touches
// catalog or watch history, unlike updateSeriesStatus's PATCH), which is
// the actual thing "remove this from the list" means for that status.
export function useSeriesOptionsMenu(seriesId: string, onStatusUpdated?: (result: UpdateSeriesStatusResponse) => void) {
  const queryClient = useQueryClient();

  const invalidateAfterChange = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    void queryClient.invalidateQueries({ queryKey: queryKeys.seriesLists });
    void queryClient.invalidateQueries({ queryKey: ['upcoming'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.seriesDetail(seriesId) });
  };

  const updateStatusMutation = useMutation({
    mutationFn: (targetStatus: SeriesStatusAction['targetStatus']) => updateSeriesStatus(seriesId, targetStatus),
    // onStatusUpdated runs first — lets a caller (e.g. SeriesDetailScreen)
    // optimistically patch its own cached data for instant UI feedback
    // before the broader invalidation-triggered refetch lands.
    onSuccess: (result) => {
      onStatusUpdated?.(result);
      invalidateAfterChange();
    },
    onError: (mutationError) => appAlert('Could Not Update Status', getErrorMessage(mutationError)),
  });

  const removeFromWatchlistMutation = useMutation({
    mutationFn: () => removeFromWatchlist(seriesId),
    onSuccess: invalidateAfterChange,
    onError: (mutationError) => appAlert('Could Not Remove', getErrorMessage(mutationError)),
  });

  const runStatusAction = async (action: SeriesStatusAction) => {
    if (action.requiresConfirmation) {
      const confirmed = await confirmAsync(action.label, action.confirmationMessage ?? '', action.label);
      if (!confirmed) return;
    }
    updateStatusMutation.mutate(action.targetStatus);
  };

  const runRemoveFromWatchlist = async () => {
    const confirmed = await confirmAsync(
      'Remove from Watchlist?',
      'This removes it from your watchlist. It never touches your catalog or watch history — you can search and add it again anytime.',
      'Remove',
    );
    if (!confirmed) return;
    removeFromWatchlistMutation.mutate();
  };

  // Mirrors SeriesDetailScreen's handleOpenStatusMenu — one native/web
  // Alert with one button per available action. Hidden entirely (caller's
  // responsibility, same as before) when there's nothing to offer.
  const openMenu = (currentStatus: UserSeriesStatus) => {
    if (currentStatus === 'WATCHLIST') {
      const buttons: AlertButton[] = [
        { text: 'Remove from Watchlist', style: 'destructive', onPress: () => void runRemoveFromWatchlist() },
        { text: 'Cancel', style: 'cancel' },
      ];
      appAlert('Series Options', undefined, buttons, { cancelable: true });
      return;
    }

    const actions = getAvailableStatusActions(currentStatus);
    if (actions.length === 0) return;

    const buttons: AlertButton[] = [
      ...actions.map((action) => ({ text: action.label, onPress: () => void runStatusAction(action) })),
      { text: 'Cancel', style: 'cancel' as const },
    ];
    appAlert('Series Options', undefined, buttons, { cancelable: true });
  };

  // WATCHLIST always has an action (Remove); every other status defers to
  // getAvailableStatusActions (empty only for UNKNOWN, which no card in
  // this app currently renders with an options button anyway).
  const hasMenu = (currentStatus: UserSeriesStatus) => currentStatus === 'WATCHLIST' || getAvailableStatusActions(currentStatus).length > 0;

  return { openMenu, hasMenu, isPending: updateStatusMutation.isPending || removeFromWatchlistMutation.isPending };
}
