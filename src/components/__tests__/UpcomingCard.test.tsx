import { render } from '@testing-library/react-native';
import { UpcomingCard } from '../UpcomingCard';
import { UpcomingItem } from '../../api/types';

function makeItem(overrides: Partial<UpcomingItem> = {}): UpcomingItem {
  return {
    seriesId: 's1',
    seriesTitle: 'The Great Voyage',
    posterUrl: null,
    episodeId: 'e1',
    seasonId: 'se1',
    seasonNumber: 1,
    episodeNumber: 6,
    episodeTitle: 'Signal Lost',
    airDateOnly: '2026-07-15',
    airDateInstant: '2026-07-15T00:00:00.000Z',
    hasKnownReleaseTime: false,
    isReleased: true,
    isWatched: false,
    episodeWatchId: null,
    seriesUserStatus: 'WATCHING',
    seriesReleaseStatus: 'RETURNING',
    badges: { seasonPremiere: false, seriesPremiere: false },
    ...overrides,
  };
}

describe('UpcomingCard', () => {
  it('renders series title, episode code, and episode title', async () => {
    const { getByText } = await render(<UpcomingCard item={makeItem()} dayOffset={0} isInLater={false} onPress={() => {}} onToggleWatched={() => {}} />);
    expect(getByText('The Great Voyage')).toBeTruthy();
    expect(getByText('S1E6  Signal Lost')).toBeTruthy();
  });

  it('does not render a platform/network field anywhere on the card', async () => {
    const { queryByText } = await render(<UpcomingCard item={makeItem()} dayOffset={0} isInLater={false} onPress={() => {}} onToggleWatched={() => {}} />);
    // No such prop exists on UpcomingItem at all (compile-time enforced),
    // this is a belt-and-suspenders behavioral check that no hardcoded
    // platform string ever sneaks into the rendered output.
    expect(queryByText(/netflix|hbo|Prime Video|ABC|CBS|NBC/i)).toBeNull();
  });

  it('shows the localized time when hasKnownReleaseTime is true', async () => {
    const item = makeItem({ hasKnownReleaseTime: true, airDateInstant: '2026-07-15T21:30:00.000Z' });
    const expectedTime = new Date(item.airDateInstant).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const { getByText } = await render(<UpcomingCard item={item} dayOffset={0} isInLater={false} onPress={() => {}} onToggleWatched={() => {}} />);
    expect(getByText(expectedTime)).toBeTruthy();
  });

  it('never shows a time placeholder ("Unknown"/"--") when the time is unknown — it is simply omitted', async () => {
    const { queryByText } = await render(
      <UpcomingCard item={makeItem({ hasKnownReleaseTime: false })} dayOffset={0} isInLater={false} onPress={() => {}} onToggleWatched={() => {}} />,
    );
    expect(queryByText('Unknown')).toBeNull();
    expect(queryByText('--')).toBeNull();
  });

  it('shows the day count only when inside the Later section', async () => {
    const { getByText, queryByText } = await render(
      <UpcomingCard item={makeItem()} dayOffset={19} isInLater={true} onPress={() => {}} onToggleWatched={() => {}} />,
    );
    expect(getByText('19 days')).toBeTruthy();

    const notLater = await render(<UpcomingCard item={makeItem()} dayOffset={19} isInLater={false} onPress={() => {}} onToggleWatched={() => {}} />);
    expect(notLater.queryByText('19 days')).toBeNull();
  });

  it('shows a Series Premiere badge, preferring it over Season Premiere when both apply', async () => {
    const item = makeItem({ badges: { seasonPremiere: true, seriesPremiere: true } });
    const { getByText, queryByText } = await render(<UpcomingCard item={item} dayOffset={0} isInLater={false} onPress={() => {}} onToggleWatched={() => {}} />);
    expect(getByText('Series Premiere')).toBeTruthy();
    expect(queryByText('Season Premiere')).toBeNull();
  });

  it('shows a Season Premiere badge when only that applies', async () => {
    const item = makeItem({ badges: { seasonPremiere: true, seriesPremiere: false } });
    const { getByText } = await render(<UpcomingCard item={item} dayOffset={0} isInLater={false} onPress={() => {}} onToggleWatched={() => {}} />);
    expect(getByText('Season Premiere')).toBeTruthy();
  });

  it('renders a watch-toggle control for a released, unwatched episode', async () => {
    const { getByLabelText } = await render(
      <UpcomingCard item={makeItem({ isReleased: true, isWatched: false })} dayOffset={0} isInLater={false} onPress={() => {}} onToggleWatched={() => {}} />,
    );
    expect(getByLabelText('Mark episode as watched')).toBeTruthy();
  });

  it('renders an unwatch control for a watched episode', async () => {
    const { getByLabelText } = await render(
      <UpcomingCard item={makeItem({ isReleased: true, isWatched: true, episodeWatchId: 'w1' })} dayOffset={0} isInLater={false} onPress={() => {}} onToggleWatched={() => {}} />,
    );
    expect(getByLabelText('Mark episode as unwatched')).toBeTruthy();
  });

  it('never renders a watch-toggle control for a future, unreleased, unwatched episode', async () => {
    const { queryByLabelText } = await render(
      <UpcomingCard
        item={makeItem({ isReleased: false, isWatched: false, airDateOnly: '2030-01-01' })}
        dayOffset={100}
        isInLater={true}
        onPress={() => {}}
        onToggleWatched={() => {}}
      />,
    );
    expect(queryByLabelText('Mark episode as watched')).toBeNull();
    expect(queryByLabelText('Mark episode as unwatched')).toBeNull();
  });
});
