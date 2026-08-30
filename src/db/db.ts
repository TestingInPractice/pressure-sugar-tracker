import Dexie, { type Table } from 'dexie';
import type { Report, Entry, Settings, Snapshot, SyncState } from '../types';

interface SettingsRow extends Settings { key: string }

class TrackerDb extends Dexie {
  reports!: Table<Report, string>;
  entries!: Table<Entry, string>;
  settings!: Table<SettingsRow, string>;
  syncs!: Table<SyncState, string>;

  constructor() {
    super('tracker-db');
    this.version(1).stores({
      reports: 'id',
      entries: 'id, reportId, createdAt',
      settings: 'key',
    });
    this.version(2).stores({
      syncs: 'reportId',
    });
  }
}

export const db = new TrackerDb();

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('app');
  return { masterOn: row?.masterOn ?? true };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.settings.put({ key: 'app', ...s });
}

export async function getReport(id: string): Promise<Report | undefined> {
  return db.reports.get(id);
}

export async function putReport(r: Report): Promise<void> {
  await db.reports.put(r);
}

export async function deleteReport(id: string): Promise<void> {
  await db.transaction('rw', db.reports, db.entries, db.syncs, async () => {
    await db.reports.delete(id);
    await db.entries.where('reportId').equals(id).delete();
    await db.syncs.delete(id);
  });
}

export async function listReports(archived: boolean): Promise<Report[]> {
  const rows = await db.reports.toArray();
  return rows.filter(r => r.archived === archived).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listEntries(reportId: string): Promise<Entry[]> {
  const rows = await db.entries.where('reportId').equals(reportId).toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function putEntry(e: Entry): Promise<void> {
  await db.entries.put(e);
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}

export async function latestEntryAt(reportId: string): Promise<number | undefined> {
  const rows = await db.entries.where('reportId').equals(reportId).toArray();
  if (rows.length === 0) return undefined;
  return Math.max(...rows.map(r => r.createdAt));
}

export async function getAllData(): Promise<Snapshot> {
  return {
    settings: await getSettings(),
    reports: await db.reports.toArray(),
    entries: await db.entries.toArray(),
  };
}

export async function replaceEverything(snap: Snapshot): Promise<void> {
  await db.transaction('rw', db.reports, db.entries, db.settings, db.syncs, async () => {
    await Promise.all([db.reports.clear(), db.entries.clear(), db.settings.clear(), db.syncs.clear()]);
    await db.settings.put({ key: 'app', ...snap.settings });
    await db.reports.bulkPut(snap.reports);
    await db.entries.bulkPut(snap.entries);
  });
}

export async function getSyncState(reportId: string): Promise<SyncState | undefined> {
  return db.syncs.get(reportId);
}

export async function putSyncState(state: SyncState): Promise<void> {
  await db.syncs.put(state);
}

export async function deleteSyncState(reportId: string): Promise<void> {
  await db.syncs.delete(reportId);
}
