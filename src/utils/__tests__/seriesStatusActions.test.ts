import { getAvailableStatusActions } from '../seriesStatusActions';

describe('getAvailableStatusActions', () => {
  it('offers Put on hold / Drop series from WATCHING', () => {
    const actions = getAvailableStatusActions('WATCHING');
    expect(actions.map((a) => a.label)).toEqual(['Put on hold', 'Drop series']);
    expect(actions.map((a) => a.targetStatus)).toEqual(['PAUSED', 'DROPPED']);
  });

  it('offers Put on hold / Drop series from CAUGHT_UP', () => {
    expect(getAvailableStatusActions('CAUGHT_UP').map((a) => a.label)).toEqual(['Put on hold', 'Drop series']);
  });

  it('offers Put on hold / Drop series from COMPLETED (no resume concept — nothing left to watch)', () => {
    expect(getAvailableStatusActions('COMPLETED').map((a) => a.label)).toEqual(['Put on hold', 'Drop series']);
  });

  it('offers Resume watching / Drop series from PAUSED (on hold)', () => {
    const actions = getAvailableStatusActions('PAUSED');
    expect(actions.map((a) => a.label)).toEqual(['Resume watching', 'Drop series']);
    expect(actions.map((a) => a.targetStatus)).toEqual(['WATCHING', 'DROPPED']);
  });

  it('offers Resume watching / Put on hold from DROPPED', () => {
    const actions = getAvailableStatusActions('DROPPED');
    expect(actions.map((a) => a.label)).toEqual(['Resume watching', 'Put on hold']);
    expect(actions.map((a) => a.targetStatus)).toEqual(['WATCHING', 'PAUSED']);
  });

  it('never offers the current status as an action', () => {
    for (const status of ['WATCHING', 'CAUGHT_UP', 'COMPLETED', 'PAUSED', 'DROPPED'] as const) {
      const targets = getAvailableStatusActions(status).map((a) => a.targetStatus);
      expect(targets).not.toContain(status);
    }
  });

  it('offers nothing for WATCHLIST and UNKNOWN — no on-hold/drop concept applies yet', () => {
    expect(getAvailableStatusActions('WATCHLIST')).toEqual([]);
    expect(getAvailableStatusActions('UNKNOWN')).toEqual([]);
  });

  it('only "Drop series" requires confirmation; Put on hold / Resume watching do not', () => {
    for (const status of ['WATCHING', 'CAUGHT_UP', 'COMPLETED', 'PAUSED', 'DROPPED'] as const) {
      for (const action of getAvailableStatusActions(status)) {
        expect(action.requiresConfirmation).toBe(action.label === 'Drop series');
      }
    }
  });

  it('the Drop series confirmation message never implies history/data deletion', () => {
    const dropAction = getAvailableStatusActions('WATCHING').find((a) => a.label === 'Drop series');
    const message = dropAction?.confirmationMessage ?? '';
    expect(message.toLowerCase()).not.toContain('delete');
    expect(message.toLowerCase()).not.toContain('remove');
    expect(message.toLowerCase()).not.toContain('lose');
  });
});
