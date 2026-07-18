import { formatAttentionWarningLabel, formatConfidencePercent } from '../format';

describe('formatAttentionWarningLabel', () => {
  it('maps known-episode-numbering-risk to a short card-sized label', () => {
    expect(formatAttentionWarningLabel('known-episode-numbering-risk')).toBe('Numbering risk');
  });

  it('maps no-confirmed-provider-match to a short card-sized label', () => {
    expect(formatAttentionWarningLabel('no-confirmed-provider-match')).toBe('Unconfirmed match');
  });

  it('falls back to a generic label for an unrecognized reasonCode', () => {
    expect(formatAttentionWarningLabel('some-future-reason-code')).toBe('Needs review');
  });
});

describe('formatConfidencePercent', () => {
  it('formats the exact reported bug value: a normalized 0.8 as "80%"', () => {
    expect(formatConfidencePercent(0.8)).toBe('80%');
  });

  it('formats the full range boundaries: 0 as "0%" and 1 as "100%"', () => {
    expect(formatConfidencePercent(0)).toBe('0%');
    expect(formatConfidencePercent(1)).toBe('100%');
  });

  it('rounds to the nearest whole percent', () => {
    expect(formatConfidencePercent(0.755)).toBe('76%');
    expect(formatConfidencePercent(0.754)).toBe('75%');
  });
});
