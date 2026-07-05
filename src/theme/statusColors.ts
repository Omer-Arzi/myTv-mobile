import { colors } from './theme';

export interface StatusColor {
  bg: string;
  fg: string;
}

// One mapping covering both ReleaseStatus and UserSeriesStatus — the two
// enums never share a raw string value, so a single lookup is safe and
// keeps StatusBadge from needing to know which kind of status it was given.
const STATUS_COLORS: Record<string, StatusColor> = {
  // ReleaseStatus (server/prisma/schema.prisma)
  RETURNING: { bg: colors.successSoft, fg: colors.success },
  ENDED: { bg: colors.neutralSoft, fg: colors.neutral },
  CANCELLED: { bg: colors.dangerSoft, fg: colors.danger },
  IN_PRODUCTION: { bg: colors.warningSoft, fg: colors.warning },

  // UserSeriesStatus
  WATCHING: { bg: colors.accentSoft, fg: colors.accent },
  CAUGHT_UP: { bg: colors.successSoft, fg: colors.success },
  COMPLETED: { bg: colors.neutralSoft, fg: colors.neutral },
  DROPPED: { bg: colors.dangerSoft, fg: colors.danger },
  PAUSED: { bg: colors.warningSoft, fg: colors.warning },
  WATCHLIST: { bg: colors.neutralSoft, fg: colors.neutral },

  UNKNOWN: { bg: colors.neutralSoft, fg: colors.neutral },
};

export function getStatusColor(status: string): StatusColor {
  return STATUS_COLORS[status] ?? { bg: colors.neutralSoft, fg: colors.neutral };
}
