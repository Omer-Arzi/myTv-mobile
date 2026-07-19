import { setAuthState, subscribeToAuthState } from '../authState';

describe('authState pub-sub', () => {
  it('notifies a subscribed listener when the state changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToAuthState(listener);
    setAuthState(false);
    expect(listener).toHaveBeenCalledWith(false);
    unsubscribe();
  });

  it('stops notifying a listener after it unsubscribes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToAuthState(listener);
    unsubscribe();
    setAuthState(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies every currently-subscribed listener, independently', () => {
    const a = jest.fn();
    const b = jest.fn();
    const unsubA = subscribeToAuthState(a);
    const unsubB = subscribeToAuthState(b);
    setAuthState(false);
    expect(a).toHaveBeenCalledWith(false);
    expect(b).toHaveBeenCalledWith(false);
    unsubA();
    setAuthState(true);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    unsubB();
  });
});
