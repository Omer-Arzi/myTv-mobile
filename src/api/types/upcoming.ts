import { ReleaseStatus, UserSeriesStatus } from './common';

// Mirrors server/src/modules/me/dto/upcoming-item.dto.ts. Deliberately NO
// platform/network/channel field — see
// server/docs/upcoming-timeline-todo.md "Do not display platform". No
// pre-formatted localized time string either — this app has no per-user
// timezone, so localization (and day-bucketing) is entirely a client
// concern, done in src/utils/upcomingGrouping.ts.
export interface UpcomingItem {
  seriesId: string;
  seriesTitle: string;
  posterUrl: string | null;
  episodeId: string;
  seasonId: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  // "YYYY-MM-DD", raw provider value — never passed through a timezone
  // conversion. See upcomingGrouping.ts's resolveEffectiveLocalDateKey.
  airDateOnly: string;
  // ISO instant, UTC-midnight-parsed for a date-only value (existing
  // app-wide convention — see server/src/common/release-date-policy.ts).
  airDateInstant: string;
  // Always false today — no integrated provider supplies episode
  // time-of-day. When true, render the localized time; when false, never
  // show a placeholder/"Unknown"/"--", just omit the time entirely.
  hasKnownReleaseTime: boolean;
  isReleased: boolean;
  isWatched: boolean;
  episodeWatchId: string | null;
  seriesUserStatus: UserSeriesStatus;
  seriesReleaseStatus: ReleaseStatus;
  badges: {
    seasonPremiere: boolean;
    seriesPremiere: boolean;
  };
}

export interface UpcomingDayBucket {
  date: string; // "YYYY-MM-DD", raw provider-date space (see MeService.getUpcoming)
  items: UpcomingItem[];
}

// Mirrors server/src/modules/me/dto/upcoming-page.dto.ts. `today` is
// diagnostic only (the server's own UTC calendar date) — never used for
// client-side "Today" grouping, which always uses the device's own local
// date (this app has no per-user timezone).
export interface UpcomingPage {
  from: string;
  to: string;
  today: string;
  days: UpcomingDayBucket[];
  hasMorePast: boolean;
  hasMoreFuture: boolean;
}
