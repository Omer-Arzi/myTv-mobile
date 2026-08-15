import { fireEvent, render } from '@testing-library/react-native';
import { SeriesCard } from '../SeriesCard';

const baseProps = {
  title: 'Doctor Who',
  posterUrl: null,
  variant: 'list' as const,
  onPress: () => {},
};

describe('SeriesCard — release-status badge', () => {
  it('hides the release-status badge when releaseStatus is UNKNOWN — not shown as a literal "Unknown" pill', async () => {
    const { queryByText } = await render(<SeriesCard {...baseProps} releaseStatus="UNKNOWN" />);
    expect(queryByText('Unknown')).toBeNull();
  });

  it('shows the release-status badge for a real, confirmed release status', async () => {
    const { getByText } = await render(<SeriesCard {...baseProps} releaseStatus="RETURNING" />);
    expect(getByText('Returning')).toBeTruthy();
  });

  it('renders no release-status badge when releaseStatus is not provided at all', async () => {
    const { queryByText } = await render(<SeriesCard {...baseProps} />);
    expect(queryByText('Unknown')).toBeNull();
  });
});

describe('SeriesCard — warning indicator', () => {
  it('renders a warning label when provided', async () => {
    const { getByText } = await render(<SeriesCard {...baseProps} warning="Numbering risk" />);
    expect(getByText('Numbering risk')).toBeTruthy();
  });

  it('renders no warning label when not provided', async () => {
    const { queryByText } = await render(<SeriesCard {...baseProps} />);
    expect(queryByText('Numbering risk')).toBeNull();
  });
});

describe('SeriesCard — options button (rail variant only)', () => {
  it('renders no options button when onOptionsPress is not provided', async () => {
    const { queryByLabelText } = await render(<SeriesCard {...baseProps} variant="rail" />);
    expect(queryByLabelText('Series options')).toBeNull();
  });

  it('renders the options button for the rail variant when onOptionsPress is provided, and pressing it calls onOptionsPress without also triggering onPress', async () => {
    const onPress = jest.fn();
    const onOptionsPress = jest.fn();
    const { getByLabelText } = await render(<SeriesCard {...baseProps} variant="rail" onPress={onPress} onOptionsPress={onOptionsPress} />);

    fireEvent.press(getByLabelText('Series options'));

    expect(onOptionsPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('never renders the options button for the list variant, even if onOptionsPress is provided', async () => {
    const { queryByLabelText } = await render(<SeriesCard {...baseProps} variant="list" onOptionsPress={() => {}} />);
    expect(queryByLabelText('Series options')).toBeNull();
  });
});
