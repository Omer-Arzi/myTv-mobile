import { getRemainingEpisodesIndicator } from '../remainingEpisodesIndicator';

const LRI = '⁦';
const PDI = '⁩';

describe('getRemainingEpisodesIndicator', () => {
  it('renders "+N" for a middle-of-series count', () => {
    const result = getRemainingEpisodesIndicator(87);
    expect(result).not.toBeNull();
    expect(result?.isFinalEpisode).toBe(false);
    // The displayed episode itself is excluded from the count by the
    // server (see computeRemainingEpisodesAfterNext) — this helper just
    // formats whatever number it's given, so this asserts the formatting
    // contract: the number passed in is rendered verbatim, not adjusted.
    expect(result?.text).toContain('87');
  });

  it('puts the plus sign before the number in the raw string (left-to-right character order)', () => {
    const result = getRemainingEpisodesIndicator(87);
    const withoutIsolateMarks = result!.text.replace(new RegExp(LRI, 'g'), '').replace(new RegExp(PDI, 'g'), '');
    expect(withoutIsolateMarks).toBe('+87');
    expect(withoutIsolateMarks.indexOf('+')).toBeLessThan(withoutIsolateMarks.indexOf('8'));
  });

  it('wraps the indicator in Unicode LRI/PDI bidi isolate marks so an RTL context cannot reorder it to "87+"', () => {
    const result = getRemainingEpisodesIndicator(87);
    expect(result?.text.startsWith(LRI)).toBe(true);
    expect(result?.text.endsWith(PDI)).toBe(true);
    expect(result?.text).toBe(`${LRI}+87${PDI}`);
  });

  it('shows "Final episode" (not "+0") when remaining count is 0', () => {
    const result = getRemainingEpisodesIndicator(0);
    expect(result).toEqual({ text: 'Final episode', isFinalEpisode: true });
    expect(result?.text).not.toContain('0');
    expect(result?.text).not.toContain('+');
  });

  it('renders nothing when there is no known next episode (undefined)', () => {
    expect(getRemainingEpisodesIndicator(undefined)).toBeNull();
  });

  it('renders nothing when catalog position could not be reliably determined (null) — never guesses "+0"', () => {
    expect(getRemainingEpisodesIndicator(null)).toBeNull();
  });

  it('handles a large remaining count the same way as a small one', () => {
    expect(getRemainingEpisodesIndicator(1)?.text).toBe(`${LRI}+1${PDI}`);
    expect(getRemainingEpisodesIndicator(971)?.text).toBe(`${LRI}+971${PDI}`);
  });
});
