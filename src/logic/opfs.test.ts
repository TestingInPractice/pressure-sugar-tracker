import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeLocalSnapshot, readLocalSnapshot } from './opfs';
import type { Entry, Report } from '../types';

const report: Pick<Report, 'id' | 'name' | 'fields'> = {
  id: 'r1',
  name: 'Отчёт АД',
  fields: [{ id: 'f1', name: 'Сахар', type: 'number', required: false, width: 30 }],
};
const entries: Entry[] = [{ id: 'e1', reportId: 'r1', values: { f1: 5 }, createdAt: 2 }];

function makeDir(store: Map<string, string>) {
  return {
    getFileHandle: vi.fn(async (name: string, opts?: { create?: boolean }) => {
      if (!store.has(name) && !opts?.create) throw new DOMException('not found', 'NotFoundError');
      const writable = {
        write: async (data: string) => { store.set(name, String(data)); },
        close: async () => {},
      };
      return {
        getFile: () => ({ text: async () => store.get(name) ?? '' }),
        createWritable: () => writable,
      } as unknown as FileSystemFileHandle;
    }),
  } as unknown as FileSystemDirectoryHandle;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('writeLocalSnapshot', () => {
  it('writes and overwrites the same OPFS file', async () => {
    const store = new Map<string, string>();
    const dir = makeDir(store);
    vi.stubGlobal('navigator', { storage: { getDirectory: async () => dir } } as unknown as Navigator);

    await writeLocalSnapshot(report, entries, 1000);
    await writeLocalSnapshot(report, [...entries, { id: 'e2', reportId: 'r1', values: { f1: 6 }, createdAt: 3 }], 2000);

    const raw = store.get('local-backup.json');
    expect(raw).toBeDefined();
    const snap = JSON.parse(raw ?? '{}') as { version: number; reportId: string; entries: Entry[] };
    expect(snap.version).toBe(1);
    expect(snap.reportId).toBe('r1');
    expect(snap.entries).toHaveLength(2);
  });

  it('returns false without OPFS support', async () => {
    vi.stubGlobal('navigator', {} as unknown as Navigator);
    await expect(writeLocalSnapshot(report, entries, 1000)).resolves.toBe(false);
  });
});

describe('readLocalSnapshot', () => {
  it('reads back the written snapshot', async () => {
    const store = new Map<string, string>();
    const dir = makeDir(store);
    vi.stubGlobal('navigator', { storage: { getDirectory: async () => dir } } as unknown as Navigator);

    await writeLocalSnapshot(report, entries, 1000);
    const snap = await readLocalSnapshot();

    expect(snap?.reportId).toBe('r1');
    expect(snap?.entries).toHaveLength(1);
    expect(snap?.syncedAt).toBe(new Date(1000).toISOString());
  });

  it('returns undefined when file is absent', async () => {
    const store = new Map<string, string>();
    const dir = makeDir(store);
    vi.stubGlobal('navigator', { storage: { getDirectory: async () => dir } } as unknown as Navigator);

    await expect(readLocalSnapshot()).resolves.toBeUndefined();
  });

  it('ignores malformed content', async () => {
    const store = new Map<string, string>([['local-backup.json', '{"version":99}']]);
    const dir = makeDir(store);
    vi.stubGlobal('navigator', { storage: { getDirectory: async () => dir } } as unknown as Navigator);

    await expect(readLocalSnapshot()).resolves.toBeUndefined();
  });

  it('returns undefined without OPFS support', async () => {
    vi.stubGlobal('navigator', {} as unknown as Navigator);
    await expect(readLocalSnapshot()).resolves.toBeUndefined();
  });
});
