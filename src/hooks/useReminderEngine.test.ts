import { it, expect, vi, beforeEach } from 'vitest';
import { runEngineTick } from './useReminderEngine';
import { db, putReport } from '../db/db';
import type { Report } from '../types';

beforeEach(async () => { await db.delete(); await db.open(); });

const T0 = Date.parse('2026-08-23T09:00:00Z');

const report: Report = {
  id: 'r1', name: 'Давление', archived: false, createdAt: 0, updatedAt: 0,
  fields: [],
  reminder: { enabled: true, datetime: new Date(T0).toISOString() },
};

it('fires due reminder, persists state, reports title', async () => {
  await putReport(report);
  const notify = vi.fn();
  const titles = await runEngineTick(T0, notify);
  expect(titles).toContain('Давление');
  expect(notify).toHaveBeenCalledWith('Давление');
  const saved = (await db.reports.get('r1'))!;
  expect(saved.reminderState?.repeatsDone).toBe(1);
});

it('respects master switch', async () => {
  await putReport(report);
  const titles = await runEngineTick(T0, vi.fn(), { masterOn: false });
  expect(titles).toEqual([]);
});

it('does not refire within 10 minutes', async () => {
  await putReport(report);
  await runEngineTick(T0, vi.fn());
  const titles = await runEngineTick(T0 + 5 * 60_000, vi.fn());
  expect(titles).toEqual([]);
});
