import { it, expect, vi, beforeEach } from 'vitest';
import { runEngineTick } from './useReminderEngine';
import { db, putReport } from '../db/db';
import type { Report } from '../types';

process.env.TZ = 'UTC';

beforeEach(async () => { await db.delete(); await db.open(); });

const T0 = Date.parse('2026-08-23T09:00:00Z'); // местное 09:00 при TZ=UTC

const report: Report = {
  id: 'r1', name: 'Давление', archived: false, createdAt: 0, updatedAt: 0,
  fields: [],
  reminder: { enabled: true, times: ['08:00'] },
};

it('fires due reminder, persists state, reports title', async () => {
  await putReport(report);
  const notify = vi.fn();
  const items = await runEngineTick(T0, notify);
  expect(items).toHaveLength(1);
  expect(items[0].title).toBe('Давление');
  expect(items[0].reportId).toBe('r1');
  expect(notify).toHaveBeenCalledWith('Давление');
  const saved = (await db.reports.get('r1'))!;
  expect(saved.reminderState?.day).toBe('2026-08-23');
  expect(saved.reminderState?.doneTimes).toEqual(['08:00']);
});

it('respects master switch', async () => {
  await putReport(report);
  const items = await runEngineTick(T0, vi.fn(), { masterOn: false });
  expect(items).toEqual([]);
});

it('does not refire the same time within the day', async () => {
  await putReport(report);
  await runEngineTick(T0, vi.fn());
  const items = await runEngineTick(T0 + 5 * 60_000, vi.fn());
  expect(items).toEqual([]);
});
