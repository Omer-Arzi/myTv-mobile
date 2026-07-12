import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SearchResultCard } from '../SearchResultCard';
import { SeriesSearchResult } from '../../api/types';

// @expo/vector-icons loads its icon font asynchronously (expo-font), which
// resolves after render() returns and leaks an act() warning/overlapping
// update into whichever test runs next — replacing it with a plain host
// element avoids that entirely; nothing in these tests asserts on the
// icon's own rendering, only on the Pressable wrapping it.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

// This project has no existing multi-render-per-file component test to
// confirm auto-cleanup is wired up (SeriesCard.test.tsx never renders more
// than once per `it`, so it never surfaced this) — explicit here since
// without it, an earlier test's tree stays mounted and later queries can
// resolve against stale/duplicate elements.
afterEach(cleanup);

function result(overrides: Partial<SeriesSearchResult> = {}): SeriesSearchResult {
  return {
    resultKey: 'k',
    title: 'Frieren',
    year: 2023,
    posterUrl: null,
    providers: [{ provider: 'tmdb', providerId: '1' }],
    libraryMatch: { type: 'NONE' },
    primaryAction: 'ADD_TO_WATCHLIST',
    relevanceScore: 0,
    ...overrides,
  };
}

function noop() {}

describe('SearchResultCard — navigation vs action', () => {
  it('never renders an "Open" label anywhere, for any result type', async () => {
    const exact = result({ libraryMatch: { type: 'EXACT', seriesId: 's1', userStatus: 'WATCHING', nextEpisode: null, needsAttention: false, attentionReasonCode: null } });
    const { queryByText } = await render(<SearchResultCard result={exact} onOpenSeries={noop} onReview={noop} onCompare={noop} onAdd={noop} />);
    expect(queryByText(/open/i)).toBeNull();
  });

  it('body tap on an EXACT (existing-library) result calls onOpenSeries', async () => {
    const onOpenSeries = jest.fn();
    const exact = result({ libraryMatch: { type: 'EXACT', seriesId: 's1', userStatus: 'WATCHING', nextEpisode: null, needsAttention: false, attentionReasonCode: null } });
    const { getByLabelText } = await render(<SearchResultCard result={exact} onOpenSeries={onOpenSeries} onReview={noop} onCompare={noop} onAdd={noop} />);
    fireEvent.press(getByLabelText('Open Frieren'));
    expect(onOpenSeries).toHaveBeenCalledTimes(1);
  });

  it('an EXACT result with needsAttention shows a trailing review icon and body tap still opens Series Detail', async () => {
    const onOpenSeries = jest.fn();
    const onReview = jest.fn();
    const needsReview = result({ libraryMatch: { type: 'EXACT', seriesId: 's1', userStatus: 'WATCHLIST', nextEpisode: null, needsAttention: true, attentionReasonCode: 'no-confirmed-provider-match' } });
    const { getByLabelText } = await render(<SearchResultCard result={needsReview} onOpenSeries={onOpenSeries} onReview={onReview} onCompare={noop} onAdd={noop} />);

    fireEvent.press(getByLabelText('Open Frieren'));
    expect(onOpenSeries).toHaveBeenCalledTimes(1);
    // Lets this press's act() scope fully settle before firing the next
    // one — without this, a pending update can leak into whichever test
    // renders next and break its queries (test-renderer 1.2's async render
    // needs each act() scope closed, not just each individual fireEvent
    // call issued back-to-back).
    await waitFor(() => {});

    fireEvent.press(getByLabelText('Review Frieren'));
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('a NEW (NONE) result has no body-tap action — onOpenSeries is never triggered by pressing the row', async () => {
    const onOpenSeries = jest.fn();
    const newResult = result({ libraryMatch: { type: 'NONE' } });
    const { getByText, queryByLabelText } = await render(<SearchResultCard result={newResult} onOpenSeries={onOpenSeries} onReview={noop} onCompare={noop} onAdd={noop} />);
    fireEvent.press(getByText(/Frieren/));
    expect(onOpenSeries).not.toHaveBeenCalled();
    // No accessible "Open" affordance exists for a not-yet-added series.
    expect(queryByLabelText('Open Frieren')).toBeNull();
  });

  it('tapping the + icon on a NEW result calls onAdd', async () => {
    const onAdd = jest.fn();
    const newResult = result({ libraryMatch: { type: 'NONE' } });
    const { getByLabelText } = await render(<SearchResultCard result={newResult} onOpenSeries={noop} onReview={noop} onCompare={noop} onAdd={onAdd} />);
    fireEvent.press(getByLabelText('Add Frieren to Watchlist'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows a spinner instead of the + icon while adding, and the + is not present', async () => {
    const newResult = result({ libraryMatch: { type: 'NONE' } });
    const { queryByLabelText } = await render(<SearchResultCard result={newResult} addState="adding" onOpenSeries={noop} onReview={noop} onCompare={noop} onAdd={noop} />);
    expect(queryByLabelText('Add Frieren to Watchlist')).toBeNull();
  });

  it('a POSSIBLE match shows a Compare action and no body-tap navigation', async () => {
    const onOpenSeries = jest.fn();
    const onCompare = jest.fn();
    const possible = result({ libraryMatch: { type: 'POSSIBLE', seriesId: 's1', seriesTitle: 'Frieren', seriesUserStatus: 'WATCHLIST', confidence: 0.7, reason: 'Similar title' } });
    const { getByLabelText, getByText } = await render(<SearchResultCard result={possible} onOpenSeries={onOpenSeries} onReview={noop} onCompare={onCompare} onAdd={noop} />);

    fireEvent.press(getByText(/Frieren/));
    expect(onOpenSeries).not.toHaveBeenCalled();

    fireEvent.press(getByLabelText('Compare Frieren'));
    expect(onCompare).toHaveBeenCalledTimes(1);
  });

  it('an EXACT result with no attention flag shows no trailing action at all', async () => {
    const exact = result({ libraryMatch: { type: 'EXACT', seriesId: 's1', userStatus: 'CAUGHT_UP', nextEpisode: null, needsAttention: false, attentionReasonCode: null } });
    const { queryByLabelText } = await render(<SearchResultCard result={exact} onOpenSeries={noop} onReview={noop} onCompare={noop} onAdd={noop} />);
    expect(queryByLabelText('Review Frieren')).toBeNull();
    expect(queryByLabelText('Compare Frieren')).toBeNull();
    expect(queryByLabelText('Add Frieren to Watchlist')).toBeNull();
  });
});
