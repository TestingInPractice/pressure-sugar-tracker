import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveSyncFile, autoSyncIfHandle } from './sync-file';
import type { Entry, Report, SyncState } from '../types';

const handleStore = new Map<string, FileSystemFileHandle>();
const syncStore = new Map<string, SyncState>();

vi.mock('../db/db', () => ({
  getSyncFileHandle: vi.fn(async (id: string) => handleStore.get(id)),
  putSyncFileHandle: vi.fn(async (id: string, h: FileSystemFileHandle) => { handleStore.set(id, h); }),
  getSyncState: vi.fn(async (id: string) => syncStore.get(id)),
  putSyncState: vi.fn(async (s: SyncState) => { syncStore.set(s.reportId, s); }),
}));

const report: Pick<Report, 'id' | 'name' | 'fields'> = { id: 'r1', name: 'Отчёт АД', fields: [] };
const entries: Entry[] = [{ id: 'e1', reportId: 'r1', values: { f: 1 }, createdAt: 2 }];

function makeHandle(writes: string[]) {
  const writable = {
    write: async (data: string) => { writes.push(typeof data === 'string' ? data : String(data)); },
    close: async () => {},
  };
  return {
    createWritable: () => writable,
    requestPermission: () => 'granted',
  } as unknown as FileSystemFileHandle;
}

beforeEach(() => {
  handleStore.clear();
  syncStore.clear();
  vi.unstubAllGlobals();
  delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  delete (globalThis as unknown as { FileSystemFileHandle?: unknown }).FileSystemFileHandle;
});

describe('saveSyncFile', () => {
  it('creates a new file on first sync and stores the handle', async () => {
    const writes: string[] = [];
    const handle = makeHandle(writes);
    const picker = vi.fn().mockResolvedValue(handle);
    (window as unknown as { showSaveFilePicker: typeof picker }).showSaveFilePicker = picker;
    vi.stubGlobal('FileSystemFileHandle', class {});

    const res = await saveSyncFile(report, entries, 1000);

    expect(res).toEqual({ kind: 'created' });
    expect(picker).toHaveBeenCalledTimes(1);
    expect(handleStore.get('r1')).toBe(handle);
    expect(writes).toHaveLength(1);
    const parsed = JSON.parse(writes[0]) as { reportId: string };
    expect(parsed.reportId).toBe('r1');
  });

  it('reuses the stored handle on next sync: no picker, same file overwritten', async () => {
    const writes: string[] = [];
    const handle = makeHandle(writes);
    const picker = vi.fn().mockResolvedValue(handle);
    (window as unknown as { showSaveFilePicker: typeof picker }).showSaveFilePicker = picker;
    vi.stubGlobal('FileSystemFileHandle', class {});

    await saveSyncFile(report, entries, 1000);
    handleStore.set('r1', handle);

    const res = await saveSyncFile(
      report,
      [...entries, { id: 'e2', reportId: 'r1', values: { f: 2 }, createdAt: 3 }],
      2000,
    );

    expect(res).toEqual({ kind: 'updated' });
    expect(picker).toHaveBeenCalledTimes(1);
    expect(writes).toHaveLength(2);
  });

  it('uses stored handle even with picker present but handle persisted', async () => {
    const writes: string[] = [];
    const handle = makeHandle(writes);
    const picker = vi.fn().mockResolvedValue(handle);
    (window as unknown as { showSaveFilePicker: typeof picker }).showSaveFilePicker = picker;
    vi.stubGlobal('FileSystemFileHandle', class {});
    handleStore.set('r1', handle);

    const res = await saveSyncFile(report, entries, 1000);

    expect(res).toEqual({ kind: 'updated' });
    expect(picker).not.toHaveBeenCalled();
    expect(writes).toHaveLength(1);
  });

  it('falls back to <a download> when share/file access unavailable', async () => {
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    let clicked = '';
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(tag => {
      const el = origCreate(tag);
      if (tag === 'a') el.addEventListener('click', () => { clicked = 'dl'; });
      return el;
    });
    const res = await saveSyncFile(report, entries, 1000);
    expect(res).toEqual({ kind: 'created' });
    expect(clicked).toBe('dl');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses Web Share API when supported and no FS access', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true });
    const res = await saveSyncFile(report, entries, 1000);
    expect(res).toEqual({ kind: 'shared' });
    expect(share).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('returns cancelled on share AbortError', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'));
    vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true });
    const res = await saveSyncFile(report, entries, 1000);
    expect(res).toEqual({ kind: 'cancelled' });
    vi.unstubAllGlobals();
  });

  it('returns cancelled when picker aborts before handle exists', async () => {
    const picker = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'));
    (window as unknown as { showSaveFilePicker: typeof picker }).showSaveFilePicker = picker;
    vi.stubGlobal('FileSystemFileHandle', class {});
    const res = await saveSyncFile(report, entries, 1000);
    expect(res).toEqual({ kind: 'cancelled' });
  });
});

describe('autoSyncIfHandle', () => {
  it('returns no-handle when no sync file was ever selected', async () => {
    const res = await autoSyncIfHandle(report, entries);
    expect(res).toBe('no-handle');
  });

  it('writes silently to the stored handle and updates sync state', async () => {
    const writes: string[] = [];
    handleStore.set('r1', makeHandle(writes));
    const res = await autoSyncIfHandle(report, entries);
    expect(res).toBe('written');
    expect(writes).toHaveLength(1);
    expect(syncStore.get('r1')?.reportId).toBe('r1');
  });

  it('returns noop without writing when data is unchanged from last sync', async () => {
    const writes: string[] = [];
    handleStore.set('r1', makeHandle(writes));
    syncStore.set('r1', { reportId: 'r1', reportName: report.name, fields: report.fields, entries, syncedAt: 1 });
    const res = await autoSyncIfHandle(report, entries);
    expect(res).toBe('noop');
    expect(writes).toHaveLength(0);
  });
});
