import { UserSeriesStatus } from '../api/types';
import { useSeriesOptionsMenu } from '../hooks/useSeriesOptionsMenu';
import { SeriesCard, SeriesCardSize } from './SeriesCard';

interface Props {
  seriesId: string;
  userStatus: UserSeriesStatus;
  // Whether to render the userStatus badge on the card itself — distinct
  // from whether the options menu is offered (that's always driven by
  // userStatus regardless of this flag). Haven't Started Yet's userStatus
  // is always WATCHLIST by definition (see this section's own DTO comment)
  // and was never shown as a badge before this menu existed, so it stays
  // hidden there; Haven't Watched For A While already showed its badge.
  showBadge?: boolean;
  title: string;
  posterUrl?: string | null;
  subtitle?: string | null;
  size?: SeriesCardSize;
  onPress: () => void;
}

// Thin wrapper around SeriesCard (rail variant) that wires up the shared
// "..." options menu (useSeriesOptionsMenu.ts) — its own component so the
// hook's per-card mutation/query state is a real, isolated React instance
// rather than being called from inside a bare FlatList renderItem callback
// (which isn't a component and would violate the rules of hooks). Used by
// every Home rail that has a real, known userStatus for its items —
// Recently Watched doesn't currently carry userStatus in its API response,
// so it still renders a plain SeriesCard without this wrapper for now.
export function HomeRailSeriesCard({ seriesId, userStatus, showBadge, title, posterUrl, subtitle, size, onPress }: Props) {
  const { openMenu, hasMenu } = useSeriesOptionsMenu(seriesId);

  return (
    <SeriesCard
      variant="rail"
      size={size}
      title={title}
      posterUrl={posterUrl}
      subtitle={subtitle}
      userStatus={showBadge ? userStatus : undefined}
      onPress={onPress}
      onOptionsPress={hasMenu(userStatus) ? () => openMenu(userStatus) : undefined}
    />
  );
}
