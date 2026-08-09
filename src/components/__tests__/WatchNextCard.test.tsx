import { render } from '@testing-library/react-native';
import { WatchNextCard, CaughtUpCard, shouldCommitSwipe } from '../WatchNextCard';

const LRI = '⁦';
const PDI = '⁩';

const baseProps = {
  seriesTitle: 'Doctor Who',
  imageUrl: null,
  seasonNumber: 3,
  episodeNumber: 11,
  episodeTitle: 'Utopia',
  onPress: () => {},
  onMarkWatched: () => {},
};

describe('WatchNextCard — remaining episodes indicator', () => {
  it('shows "+N" in the middle of a series, excluding the displayed episode itself', async () => {
    const { getByText, queryByText } = await render(<WatchNextCard {...baseProps} remainingEpisodesAfterNext={87} />);

    // The SxxEyy label is unchanged.
    expect(getByText('S3E11')).toBeTruthy();
    // "87" is the count of episodes AFTER S3E11 — the displayed episode is
    // not itself included in that number (this is the component faithfully
    // rendering whatever the server already excluded it from — see
    // server/src/modules/me/me-query-helpers.ts::computeRemainingEpisodesAfterNext
    // for where the exclusion actually happens).
    expect(getByText(`${LRI}+87${PDI}`)).toBeTruthy();
    expect(queryByText('Final episode')).toBeNull();
  });

  it('renders the plus sign before the number (left-to-right character order)', async () => {
    const { getByText } = await render(<WatchNextCard {...baseProps} remainingEpisodesAfterNext={5} />);
    const node = getByText(`${LRI}+5${PDI}`);
    const raw = node.props.children as string;
    const stripped = raw.replace(LRI, '').replace(PDI, '');
    expect(stripped).toBe('+5');
    expect(stripped.indexOf('+')).toBe(0);
  });

  it('wraps the indicator text in bidi isolate marks so an RTL context cannot visually reorder it to "87+"', async () => {
    const { getByText } = await render(<WatchNextCard {...baseProps} remainingEpisodesAfterNext={87} />);
    const node = getByText(`${LRI}+87${PDI}`);
    const raw = node.props.children as string;
    expect(raw.startsWith(LRI)).toBe(true);
    expect(raw.endsWith(PDI)).toBe(true);
    // Never the reversed form.
    expect(raw).not.toContain('87+');
  });

  it('shows "Final episode" (never "+0") when this is the final known episode of a confirmed-ended show', async () => {
    const { getByText, queryByText } = await render(
      <WatchNextCard {...baseProps} seasonNumber={4} episodeNumber={10} remainingEpisodesAfterNext={0} releaseStatus="ENDED" />,
    );
    expect(getByText('S4E10')).toBeTruthy();
    expect(getByText('Final episode')).toBeTruthy();
    expect(queryByText(`${LRI}+0${PDI}`)).toBeNull();
    expect(queryByText('0')).toBeNull();
  });

  it('shows "Latest episode" (never "Final episode") when nothing is queued but the show is still RETURNING', async () => {
    const { getByText, queryByText } = await render(
      <WatchNextCard {...baseProps} seasonNumber={4} episodeNumber={10} remainingEpisodesAfterNext={0} releaseStatus="RETURNING" />,
    );
    expect(getByText('S4E10')).toBeTruthy();
    expect(getByText('Latest episode')).toBeTruthy();
    expect(queryByText('Final episode')).toBeNull();
  });

  it('renders neither the count nor the final-episode label when remainingEpisodesAfterNext is not provided', async () => {
    const { getByText, queryByText } = await render(<WatchNextCard {...baseProps} />);
    expect(getByText('S3E11')).toBeTruthy();
    expect(queryByText('Final episode')).toBeNull();
    expect(queryByText(/^\+/)).toBeNull();
  });

  it('renders nothing for the indicator when catalog position is unreliable (null) — never guesses "+0"', async () => {
    const { queryByText } = await render(<WatchNextCard {...baseProps} remainingEpisodesAfterNext={null} />);
    expect(queryByText('Final episode')).toBeNull();
    expect(queryByText(/^\+/)).toBeNull();
    expect(queryByText('0')).toBeNull();
  });

  it('does not change any other Continue Watching content — poster pill, episode title, and action button stay as before', async () => {
    const { getByText, getByLabelText } = await render(<WatchNextCard {...baseProps} remainingEpisodesAfterNext={87} />);
    expect(getByText('Doctor Who')).toBeTruthy();
    expect(getByText('Utopia')).toBeTruthy();
    expect(getByLabelText('Mark episode as watched')).toBeTruthy();
  });
});

// PanResponder's raw touch/gestureState machinery has no established
// simulation pattern in this codebase's RTL setup (see other test files —
// nothing fires real responderMove/touchStart sequences), so the actual
// commit decision is exercised here directly as a pure function instead of
// through a simulated gesture. Values are deliberately far from any real
// constant's exact boundary (huge/tiny/zero) rather than hardcoding the
// source's exact threshold numbers, so these don't silently drift out of
// sync with WatchNextCard's own tuning.
describe('shouldCommitSwipe — swipe commit decision', () => {
  it('never commits on no movement, regardless of velocity', () => {
    expect(shouldCommitSwipe(0, 0)).toBe(false);
  });

  it('does not commit on a small drag with no real velocity — avoids accidental triggering', () => {
    expect(shouldCommitSwipe(5, 0)).toBe(false);
  });

  it('does not commit on high velocity alone with essentially no distance — a bump, not a flick', () => {
    expect(shouldCommitSwipe(1, 50)).toBe(false);
  });

  it('commits on distance alone once dx is far past any reasonable threshold, even at zero velocity', () => {
    expect(shouldCommitSwipe(100000, 0)).toBe(true);
  });

  it('commits on a fast flick — a real but short drag combined with high velocity — even far short of the full distance threshold', () => {
    expect(shouldCommitSwipe(50, 5)).toBe(true);
  });

  it('does not commit on that same short drag distance at low/idle velocity — the fast-flick path requires real speed, not just some movement', () => {
    expect(shouldCommitSwipe(50, 0.001)).toBe(false);
  });
});

describe('CaughtUpCard — CAUGHT_UP vs COMPLETED copy', () => {
  const caughtUpCardProps = { seriesTitle: 'Doctor Who', imageUrl: null, onPress: () => {} };

  it('shows "You\'re all caught up" / "Caught up" for a still-airing show with no next episode yet — never implies the series ended', async () => {
    const { getByText, queryByText } = await render(<CaughtUpCard {...caughtUpCardProps} outcome="CAUGHT_UP" />);
    expect(getByText("You're all caught up")).toBeTruthy();
    expect(getByText('Caught up')).toBeTruthy();
    expect(queryByText('Series completed')).toBeNull();
    expect(queryByText('Completed')).toBeNull();
  });

  it('shows "Series completed" / "Completed" for a confirmed-ended/cancelled show with no next episode', async () => {
    const { getByText, queryByText } = await render(<CaughtUpCard {...caughtUpCardProps} outcome="COMPLETED" />);
    expect(getByText('Series completed')).toBeTruthy();
    expect(getByText('Completed')).toBeTruthy();
    expect(queryByText("You're all caught up")).toBeNull();
  });

  it('never renders the ambiguous "No more episodes" phrasing for either outcome', async () => {
    const caughtUp = await render(<CaughtUpCard {...caughtUpCardProps} outcome="CAUGHT_UP" />);
    const completed = await render(<CaughtUpCard {...caughtUpCardProps} outcome="COMPLETED" />);
    expect(caughtUp.queryByText(/no more episodes/i)).toBeNull();
    expect(completed.queryByText(/no more episodes/i)).toBeNull();
  });
});
