import { formatAttentionWarningLabel } from '../format';

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
