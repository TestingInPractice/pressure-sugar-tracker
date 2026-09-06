import { it, expect, vi, beforeEach } from 'vitest';
import { syncAfterEntry } from './entry-sync';
import { autoSyncIfHandle, hasFsAccess, saveSyncFile } from './sync-file';
import { getSyncState } from '../db/db';
import type { Entry, Report, SyncState } from '../types';

const handleStore = new Map<string, FileSystemFileHandle>();
const syncStore = new Map<string, SyncState>();

vi.mock('../db/db', () => ({
  getSyncFileHandle: vi.fn(async (id: string) => handleStore.get(id)),
  getSyncState: vi.fn(async (id: string) => syncStore.get(id)),
  putSyncState: vi.fn(async (s: SyncState) => { syncStore.set(s.reportId, s); }),
}));

vi.mock('./sync-file', () => ({
  autoSyncIfHandle: vi.fn(),
  hasFsAccess: vi.fn(),
  saveSyncFile: vi.fn(),
}));

const autoSyncMock = vi.mocked(autoSyncIfHandle);
const fsAccessMock = vi.mocked(hasFsAccess);
const saveSyncMock = vi.mocked(saveSyncFile);
const getSyncStateMock = vi.mocked(getSyncState);

const rep = (id: string): Pick<Report, 'id' | 'name' | 'fields'> =>
  ({ id, name: 'Отчёт АД', fields: [] });
const ents = (id: string): Entry[] =>
  ([{ id: 'e1', reportId: id, values: { f1: 0 }, createdAt: 1 }]);

function makeHandle() {
  return {
    createWritable: () => ({ write: async () => {}, close: async () => {} }),
    requestPermission: () => 'granted',
  } as unknown as FileSystemFileHandle;
}

beforeEach(() => {
  handleStore.clear();
  syncStore.clear();
  autoSyncMock.mockReset();
  fsAccessMock.mockReset();
  saveSyncMock.mockReset();
  getSyncStateMock.mockClear();
  autoSyncMock.mockResolvedValue('written');
  fsAccessMock.mockReturnValue(false);
  saveSyncMock.mockResolvedValue({ kind: 'created' });
});

it('returns noop for empty entries without touching storage', async () => {
  expect(await syncAfterEntry(rep('t1'), [])).toBe('noop');
  expect(autoSyncMock).not.toHaveBeenCalled();
  expect(saveSyncMock).not.toHaveBeenCalled();
});

it('delegates to autoSyncIfHandle when a handle is stored', async () => {
  handleStore.set('t2', makeHandle());
  expect(await syncAfterEntry(rep('t2'), ents('t2'))).toBe('written');
  expect(autoSyncMock).toHaveBeenCalledTimes(1);
  expect(saveSyncMock).not.toHaveBeenCalled();
});

it('maps autoSync no-handle to noop and failed to failed', async () => {
  handleStore.set('t3', makeHandle());
  autoSyncMock.mockResolvedValue('no-handle');
  expect(await syncAfterEntry(rep('t3'), ents('t3'))).toBe('noop');
  autoSyncMock.mockResolvedValue('failed');
  expect(await syncAfterEntry(rep('t3'), ents('t3'))).toBe('failed');
});

it('returns ios-manual without FSAccess (iPhone)', async () => {
  fsAccessMock.mockReturnValue(false);
  expect(await syncAfterEntry(rep('t4'), ents('t4'), { allowFirstSave: true })).toBe('ios-manual');
  expect(saveSyncMock).not.toHaveBeenCalled();
});

it('returns noop without allowFirstSave (background effect)', async () => {
  fsAccessMock.mockReturnValue(true);
  expect(await syncAfterEntry(rep('t5'), ents('t5'))).toBe('noop');
  expect(await syncAfterEntry(rep('t5'), ents('t5'), { allowFirstSave: false })).toBe('noop');
  expect(saveSyncMock).not.toHaveBeenCalled();
});

it('first live save creates sync state via picker and returns first-saved', async () => {
  fsAccessMock.mockReturnValue(true);
  expect(await syncAfterEntry(rep('t6'), ents('t6'), { allowFirstSave: true })).toBe('first-saved');
  expect(saveSyncMock).toHaveBeenCalledTimes(1);
  const [argReport, argEntries] = saveSyncMock.mock.calls[0];
  expect(argReport.name).toBe('Отчёт АД');
  expect(argEntries).toHaveLength(1);
  expect(syncStore.get('t6')?.entries).toHaveLength(1);
});

it('does not repeat first-save on subsequent entries', async () => {
  fsAccessMock.mockReturnValue(true);
  expect(await syncAfterEntry(rep('t7'), ents('t7'), { allowFirstSave: true })).toBe('first-saved');
  saveSyncMock.mockClear();
  expect(await syncAfterEntry(rep('t7'), [...ents('t7'), { id: 'e2', reportId: 't7', values: {}, createdAt: 2 }], { allowFirstSave: true })).toBe('noop');
  expect(saveSyncMock).not.toHaveBeenCalled();
});

it('leaves existing sync state alone when handle is gone (backup import)', async () => {
  fsAccessMock.mockReturnValue(true);
  syncStore.set('t8', {
    reportId: 't8', reportName: 'Отчёт АД', fields: [], syncedAt: 1, entries: ents('t8'),
  });
  expect(await syncAfterEntry(rep('t8'), ents('t8'), { allowFirstSave: true })).toBe('noop');
  expect(saveSyncMock).not.toHaveBeenCalled();
});

it('cancelled picker returns noop without writing sync state', async () => {
  fsAccessMock.mockReturnValue(true);
  saveSyncMock.mockResolvedValue({ kind: 'cancelled' });
  expect(await syncAfterEntry(rep('t9'), ents('t9'), { allowFirstSave: true })).toBe('noop');
  expect(syncStore.get('t9')).toBeUndefined();
});

it('saveSyncFile rejection returns failed', async () => {
  fsAccessMock.mockReturnValue(true);
  saveSyncMock.mockRejectedValue(new Error('share failed'));
  expect(await syncAfterEntry(rep('t10'), ents('t10'), { allowFirstSave: true })).toBe('failed');
  expect(syncStore.get('t10')).toBeUndefined();
});
