import { describe, it, expect, vi } from 'vitest';
import { saveSyncFile } from './sync-file';
import type { Entry, Report } from '../types';

const report: Pick<Report, 'id' | 'name' | 'fields'> = { id: 'r1', name: 'Отчёт АД', fields: [] };
const entries: Entry[] = [{ id: 'e1', reportId: 'r1', values: { f: 1 }, createdAt: 2 }];

describe('saveSyncFile', () => {
  it('uses Web Share API when supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true });
    await expect(saveSyncFile(report, entries, 1000)).resolves.toBe(true);
    expect(share).toHaveBeenCalledTimes(1);
    const arg = share.mock.calls[0][0] as { files: File[] };
    expect(arg.files[0].name).toBe('Отчёт АД-sync.json');
    expect(arg.files[0].type).toBe('application/json');
    // JSON внутри файла валиден и содержит отчёт
    const text = await arg.files[0].text();
    const parsed = JSON.parse(text) as { reportId: string };
    expect(parsed.reportId).toBe('r1');
    vi.unstubAllGlobals();
  });

  it('returns false on user cancellation (AbortError)', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'));
    vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true });
    await expect(saveSyncFile(report, entries, 1000)).resolves.toBe(false);
    vi.unstubAllGlobals();
  });

  it('falls back to <a download> when share is unavailable', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    let clicked = '';
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(tag => {
      const el = origCreate(tag);
      if (tag === 'a') el.addEventListener('click', () => { clicked = 'dl'; });
      return el;
    });
    await expect(saveSyncFile(report, entries, 1000)).resolves.toBe(true);
    expect(clicked).toBe('dl');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
