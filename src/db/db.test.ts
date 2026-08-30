import { describe, it, expect, beforeEach } from 'vitest';
import { db, getSettings, saveSettings, putReport, getReport,
         listReports, deleteReport, putEntry, listEntries, deleteEntry,
         latestEntryAt, getAllData, replaceEverything } from './db';
import { getSyncState, putSyncState, deleteSyncState } from './db';
import type { Report, Entry } from '../types';
import type { Field } from '../types';
import type { SyncState } from '../types';

beforeEach(async () => { await db.delete(); await db.open(); });

const field = (id: string): Field => ({ id, name: 'f', type: 'number', required: false, width: 30 });

describe('settings', () => {
  it('defaults masterOn=true', async () => {
    expect((await getSettings()).masterOn).toBe(true);
  });
  it('persists saved value', async () => {
    await saveSettings({ masterOn: false });
    expect((await getSettings()).masterOn).toBe(false);
  });
});

describe('reports & entries', () => {
  it('splits active and archived lists', async () => {
    const r1: Report = { id: 'a', name: 'A', fields: [], archived: false, createdAt: 1, updatedAt: 1 };
    const r2: Report = { id: 'b', name: 'B', fields: [], archived: true, createdAt: 2, updatedAt: 2 };
    await putReport(r1); await putReport(r2);
    expect((await listReports(false)).map(r => r.id)).toEqual(['a']);
    expect((await listReports(true)).map(r => r.id)).toEqual(['b']);
  });
  it('latestEntryAt returns newest createdAt', async () => {
    const e1: Entry = { id: 'e1', reportId: 'a', values: {}, createdAt: 100 };
    const e2: Entry = { id: 'e2', reportId: 'a', values: {}, createdAt: 200 };
    await putEntry(e1); await putEntry(e2);
    expect(await latestEntryAt('a')).toBe(200);
    expect(await latestEntryAt('zzz')).toBeUndefined();
  });
});

describe('backup plumbing', () => {
  it('getAllData + replaceEverything round-trips', async () => {
    const r: Report = { id: 'a', name: 'A', fields: [field('f1')], archived: false, createdAt: 1, updatedAt: 1 };
    await putReport(r);
    await putEntry({ id: 'e1', reportId: 'a', values: { f1: 120 }, createdAt: 5 });
    const snap = await getAllData();
    await deleteReport('a'); await deleteEntry('e1');
    await replaceEverything(snap);
    expect(await getReport('a')).toBeTruthy();
    expect((await listEntries('a'))[0].values.f1).toBe(120);
  });

  it('replaceEverything clears sync states', async () => {
    const r: Report = { id: 'a', name: 'A', fields: [], archived: false, createdAt: 1, updatedAt: 1 };
    await putReport(r);
    await putSyncState({ reportId: 'a', reportName: 'A', fields: [], entries: [], syncedAt: 1 });
    const snap = await getAllData();
    await replaceEverything(snap);
    expect(await getSyncState('a')).toBeUndefined();
  });
});

describe('sync state', () => {
  it('round-trips a sync state', async () => {
    const st: SyncState = {
      reportId: 'a', reportName: 'Отчёт',
      fields: [{ id: 'f1', name: 'ВД / НД / П', type: 'text', required: false, width: 30 }],
      entries: [{ id: 'e1', reportId: 'a', values: { f1: '120/80' }, createdAt: 5 }],
      syncedAt: 100,
    };
    await putSyncState(st);
    expect(await getSyncState('a')).toEqual(st);
    expect(await getSyncState('zzz')).toBeUndefined();
  });

  it('deleteSyncState removes the row', async () => {
    await putSyncState({ reportId: 'a', reportName: 'R', fields: [], entries: [], syncedAt: 1 });
    await deleteSyncState('a');
    expect(await getSyncState('a')).toBeUndefined();
  });

  it('deleteReport cascades to sync state', async () => {
    await putReport({ id: 'a', name: 'A', fields: [], archived: false, createdAt: 1, updatedAt: 1 });
    await putSyncState({ reportId: 'a', reportName: 'A', fields: [], entries: [], syncedAt: 1 });
    await deleteReport('a');
    expect(await getSyncState('a')).toBeUndefined();
  });
});
