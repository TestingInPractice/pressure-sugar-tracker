import { describe, it, expect } from 'vitest';
import { buildExportJson, parseImport, BackupError } from './backup';
import type { Snapshot } from '../types';

const snap: Snapshot = {
  settings: { masterOn: false, syncOn: true },
  reports: [{ id: 'r1', name: 'Отчёт', fields: [], archived: false, createdAt: 1, updatedAt: 1 }],
  entries: [{ id: 'e1', reportId: 'r1', values: {}, createdAt: 2 }],
};

describe('backup export/import', () => {
  it('round-trips snapshot', () => {
    const parsed = parseImport(buildExportJson(snap));
    expect(parsed.settings).toEqual({ masterOn: false, syncOn: true });
    expect(parsed.reports[0].id).toBe('r1');
    expect(parsed.entries[0].id).toBe('e1');
  });

  it('rejects garbage', () => {
    expect(() => parseImport('not json{')).toThrow(BackupError);
  });

  it('rejects wrong version', () => {
    const bad = JSON.stringify({ ...snap, version: 2 });
    expect(() => parseImport(bad)).toThrow(/версия/);
  });

  it('rejects missing arrays', () => {
    expect(() => parseImport(JSON.stringify({ version: 1 }))).toThrow(BackupError);
  });
});
