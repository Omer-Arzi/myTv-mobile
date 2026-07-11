import { render } from '@testing-library/react-native';
import { WatchNextCard } from '../WatchNextCard';

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

  it('shows "Final episode" (never "+0") when this is the final known episode', async () => {
    const { getByText, queryByText } = await render(
      <WatchNextCard {...baseProps} seasonNumber={4} episodeNumber={10} remainingEpisodesAfterNext={0} />,
    );
    expect(getByText('S4E10')).toBeTruthy();
    expect(getByText('Final episode')).toBeTruthy();
    expect(queryByText(`${LRI}+0${PDI}`)).toBeNull();
    expect(queryByText('0')).toBeNull();
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
