import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSeriesOptionsMenu } from '../useSeriesOptionsMenu';
import { UserSeriesStatus } from '../../api/types';

// hasMenu is what gates SeriesCard's options button — this is the one
// piece of behavior worth its own test beyond SeriesCard's own button
// tests and seriesStatusActions.test.ts (which already covers
// getAvailableStatusActions exhaustively): WATCHLIST must always report a
// menu (the new "Remove from Watchlist" action), which
// getAvailableStatusActions alone deliberately does NOT provide.
function HasMenuProbe({ status }: { status: UserSeriesStatus }) {
  const { hasMenu } = useSeriesOptionsMenu('series-1');
  return <Text>{hasMenu(status) ? 'has-menu' : 'no-menu'}</Text>;
}

async function renderProbe(status: UserSeriesStatus) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <HasMenuProbe status={status} />
    </QueryClientProvider>,
  );
}

describe('useSeriesOptionsMenu — hasMenu', () => {
  it('reports a menu for WATCHLIST (Remove from Watchlist), even though getAvailableStatusActions itself returns none', async () => {
    const { findByText } = await renderProbe('WATCHLIST');
    expect(await findByText('has-menu')).toBeTruthy();
  });

  it('reports no menu for UNKNOWN', async () => {
    const { findByText } = await renderProbe('UNKNOWN');
    expect(await findByText('no-menu')).toBeTruthy();
  });

  it('reports a menu for WATCHING (Put on hold / Drop series)', async () => {
    const { findByText } = await renderProbe('WATCHING');
    expect(await findByText('has-menu')).toBeTruthy();
  });
});
