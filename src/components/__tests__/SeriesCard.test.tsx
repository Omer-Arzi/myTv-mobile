import { render } from '@testing-library/react-native';
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
