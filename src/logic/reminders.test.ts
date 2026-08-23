import { describe, it, expect } from 'vitest';
import { computeDue, onFired } from './reminders';
import { MAX_REPEATS, REPEAT_INTERVAL_MIN } from '../constants';

const T0 = Date.parse('2026-08-23T09:00:00Z');
const MIN = 60_000;
const reminder = { enabled: true, datetime: new Date(T0).toISOString() };

const base = { masterOn: true, reminder };

describe('computeDue', () => {
  it('fires immediately when time reached and never fired', () => {
    expect(computeDue(base, T0)).toBe(true);
    expect(computeDue(base, T0 - MIN)).toBe(false); // время ещё не наступило
  });
  it('silences everything when master switch is off', () => {
    expect(computeDue({ ...base, masterOn: false }, T0)).toBe(false);
  });
  it('ignores disabled reminder', () => {
    expect(computeDue({ ...base, reminder: { ...reminder, enabled: false } }, T0)).toBe(false);
  });
  it('does not refire before interval elapses', () => {
    const state = onFired(undefined, T0);
    expect(computeDue({ ...base, state }, T0 + 5 * MIN)).toBe(false);
  });
  it('refires after interval while repeats remain', () => {
    let state = onFired(undefined, T0);
    expect(computeDue({ ...base, state }, T0 + REPEAT_INTERVAL_MIN * MIN)).toBe(true);
  });
  it(`caps at ${MAX_REPEATS} firings total (hardcode)`, () => {
    let state = onFired(onFired(onFired(undefined, T0), T0 + 10 * MIN), T0 + 20 * MIN);
    expect(state.repeatsDone).toBe(3);
    expect(computeDue({ ...base, state }, T0 + 30 * MIN)).toBe(false);
  });
  it('stays silent when an entry was recorded after reminder time', () => {
    expect(computeDue({ ...base, latestEntryAt: T0 + 1 }, T0 + 2 * MIN)).toBe(false);
  });
  it('fires when latest entry predates reminder', () => {
    expect(computeDue({ ...base, latestEntryAt: T0 - 1 }, T0)).toBe(true);
  });
});

describe('onFired', () => {
  it('counts firings', () => {
    expect(onFired(undefined, 1).repeatsDone).toBe(1);
    expect(onFired({ repeatsDone: 2 }, 9).repeatsDone).toBe(3);
    expect(onFired({ repeatsDone: 2 }, 9).lastNotifiedAt).toBe(9);
  });
});
