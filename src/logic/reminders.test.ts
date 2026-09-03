import { describe, it, expect } from 'vitest';
import { computeDue, onFired, toLocalInputValue, normalizeReminder } from './reminders';

process.env.TZ = 'UTC';

const MIN = 60_000;
const T9 = Date.parse('2026-08-23T09:00:00Z'); // местное 09:00 при TZ=UTC
const T7 = Date.parse('2026-08-23T07:00:00Z');

const reminder = { enabled: true, times: ['08:00'] };
const base = { masterOn: true, reminder };

describe('computeDue', () => {
  it('fires when the time is reached and never fired', () => {
    expect(computeDue(base, T9)).toBe(true);
    expect(computeDue(base, T7)).toBe(false); // время ещё не наступило (07:00 < 08:00)
  });

  it('silences when master switch is off', () => {
    expect(computeDue({ ...base, masterOn: false }, T9)).toBe(false);
  });

  it('ignores disabled reminder and empty times', () => {
    expect(computeDue({ ...base, reminder: { enabled: false, times: ['08:00'] } }, T9)).toBe(false);
    expect(computeDue({ ...base, reminder: { enabled: true, times: [] } }, T9)).toBe(false);
  });

  it('does not refire same time after onFired', () => {
    const state = onFired(reminder, undefined, T9);
    expect(computeDue({ ...base, state }, T9 + 5 * MIN)).toBe(false);
  });

  it('fires for the next time after the earlier one is done', () => {
    const two = { enabled: true, times: ['08:00', '20:00'] };
    const state = onFired(two, undefined, T9); // обрабатывает 08:00
    const T21 = Date.parse('2026-08-23T21:00:00Z');
    expect(computeDue({ masterOn: true, reminder: two, state }, T21)).toBe(true);
  });

  it('stays silent when an entry was recorded after the reminder time', () => {
    // на 08:00 запись внесена в 08:30 — молчим
    expect(computeDue({ ...base, state: { day: '2026-08-23', doneTimes: [] }, latestEntryAt: Date.parse('2026-08-23T08:30:00Z') }, T9)).toBe(false);
  });

  it('fires when latest entry predates the reminder time', () => {
    expect(computeDue({ ...base, latestEntryAt: T7 }, T9)).toBe(true);
  });

  it('resets done times on a new day', () => {
    const state = onFired(reminder, undefined, T9);
    const nextDay = Date.parse('2026-08-24T09:00:00Z');
    expect(computeDue({ ...base, state }, nextDay)).toBe(true);
  });
});

describe('onFired', () => {
  it('marks the earliest reached time as done', () => {
    const st = onFired({ enabled: true, times: ['08:00', '20:00'] }, undefined, T9);
    expect(st.day).toBe('2026-08-23');
    expect(st.doneTimes).toEqual(['08:00']);
  });

  it('accumulates doneTimes across firings', () => {
    const two = { enabled: true, times: ['08:00', '20:00'] };
    const s1 = onFired(two, undefined, T9);
    const T21 = Date.parse('2026-08-23T21:00:00Z');
    const s2 = onFired(two, s1, T21);
    expect(s2.doneTimes).toEqual(['08:00', '20:00']);
  });
});

describe('normalizeReminder', () => {
  it('passes through times array unchanged', () => {
    expect(normalizeReminder({ enabled: true, times: ['08:00'] })).toEqual({ enabled: true, times: ['08:00'] });
  });

  it('migrates legacy datetime to a single time', () => {
    const legacy = { enabled: true, datetime: new Date(T9).toISOString() } as never;
    const out = normalizeReminder(legacy as Parameters<typeof normalizeReminder>[0]);
    expect(out).toEqual({ enabled: true, times: ['09:00'] });
  });

  it('returns undefined for empty input', () => {
    expect(normalizeReminder(undefined)).toBeUndefined();
  });
});

describe('toLocalInputValue', () => {
  it('round-trips offset-aware ISO through local datetime-local value (TZ-agnostic)', () => {
    const iso = new Date('2026-08-24T06:00:00.000Z').toISOString();
    expect(new Date(toLocalInputValue(iso)).toISOString()).toBe(iso);
  });
  it('maps undefined and empty string to empty string', () => {
    expect(toLocalInputValue(undefined)).toBe('');
    expect(toLocalInputValue('')).toBe('');
  });
  it('formats LOCAL components, not UTC wall-clock', () => {
    const iso = new Date('2026-08-24T06:00:00.000Z').toISOString();
    const v = toLocalInputValue(iso);
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
