import { isEpisodeReleased } from '../episodeRelease';

const NOW = new Date('2026-07-11T00:00:00.000Z');

describe('isEpisodeReleased', () => {
  it('returns true for a past airDate', () => {
    expect(isEpisodeReleased('2026-07-08T00:00:00.000Z', NOW)).toBe(true);
  });

  it('returns true for an airDate exactly equal to now', () => {
    expect(isEpisodeReleased(NOW.toISOString(), NOW)).toBe(true);
  });

  it('returns false for a future airDate', () => {
    expect(isEpisodeReleased('2026-07-15T00:00:00.000Z', NOW)).toBe(false);
  });

  it('returns false for a null airDate (conservative, matches server semantics)', () => {
    expect(isEpisodeReleased(null, NOW)).toBe(false);
  });

  it('returns false for an unparseable airDate string', () => {
    expect(isEpisodeReleased('not-a-date', NOW)).toBe(false);
  });
});
