import { it, expect, vi, afterEach } from 'vitest';
import {
  buildReportExportJson, parseReportImport, reportExportFilename, shareReportFile,
} from './report-export';
import type { Report, Entry } from '../types';

const report: Report = {
  id: 'r1', name: 'Отчёт АД', fields: [{ id: 'f1', name: 'Давление', type: 'text', required: true, width: 30 }],
  archived: false, createdAt: 1, updatedAt: 2,
};
const entries: Entry[] = [
  { id: 'e1', reportId: 'r1', values: { f1: '120/80' }, createdAt: 3 },
  { id: 'e2', reportId: 'r1', values: { f1: '130/90' }, createdAt: 4 },
  { id: 'e3', reportId: 'other', values: { f1: 'x' }, createdAt: 5 },
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('build → parse round-trip keeps report and own entries only', () => {
  const { report: r, entries: es } = parseReportImport(buildReportExportJson(report, entries));
  expect(r).toEqual(report);
  expect(es.map(e => e.id)).toEqual(['e1', 'e2']);
});

it('rejects trash and non-JSON', () => {
  expect(() => parseReportImport('garbage{')).toThrow('повреждён или это не JSON');
  expect(() => parseReportImport('42')).toThrow('Неверный формат файла');
});

it('rejects wrong version', () => {
  const json = JSON.stringify({ version: 2, kind: 'report', report, entries: [] });
  expect(() => parseReportImport(json)).toThrow('Неподдерживаемая версия');
});

it('rejects backup files with pointer to backup import', () => {
  const json = JSON.stringify({ version: 1, settings: {}, reports: [], entries: [] });
  expect(() => parseReportImport(json)).toThrow('полный бэкап');
});

it('rejects files without report shape and with junk entries', () => {
  expect(() => parseReportImport(JSON.stringify({ version: 1, kind: 'report', entries: [] })))
    .toThrow('нет данных отчёта');
  const bad = JSON.stringify({ version: 1, kind: 'report', report, entries: [42] });
  expect(() => parseReportImport(bad)).toThrow('не соответствует формату отчёта');
});

it('filename is safe latin/cyrillic slug with date', () => {
  expect(reportExportFilename('Отчёт АД: утро!')).toMatch(/^Отчёт-АД_-утро_-\d{4}-\d{2}-\d{2}\.json$/);
  expect(reportExportFilename('   ')).toMatch(/^report-\d{4}-\d{2}-\d{2}\.json$/);
});

it('downloads the file when Web Share is unavailable', async () => {
  const urls: string[] = [];
  vi.stubGlobal('URL', { createObjectURL: () => { urls.push('blob:x'); return 'blob:x'; }, revokeObjectURL: () => {} });
  let clicked = '';
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(tag => {
    const el = origCreate(tag);
    if (tag === 'a') el.addEventListener('click', () => { clicked = 'dl'; });
    return el;
  });
  const res = await shareReportFile('{}', 'r.json', 't');
  expect(res).toEqual({ kind: 'created' });
  expect(clicked).toBe('dl');
  expect(urls.length).toBe(1);
});

it('uses Web Share API when supported', async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true });
  const res = await shareReportFile('{}', 'r.json', 't');
  expect(res).toEqual({ kind: 'shared' });
  expect(share).toHaveBeenCalledTimes(1);
  expect(share.mock.calls[0][0].title).toBe('t');
});

it('returns cancelled on share AbortError', async () => {
  const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'));
  vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true });
  const res = await shareReportFile('{}', 'r.json', 't');
  expect(res).toEqual({ kind: 'cancelled' });
});