import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { it, expect, beforeEach, vi } from 'vitest';
import MoreTab from './MoreTab';
import { db, putReport, putEntry } from '../db/db';
import { buildReportExportJson } from '../logic/report-export';

beforeEach(async () => { await db.delete(); await db.open(); });

function mockDownload() {
  const urls: string[] = [];
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
  return urls;
}

it('exports a valid backup json', async () => {
  await putReport({ id: 'r1', name: 'R', fields: [], archived: false, createdAt: 1, updatedAt: 1 });
  mockDownload();
  let clicked = '';
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(tag => {
    const el = origCreate(tag);
    if (tag === 'a') el.addEventListener('click', () => { clicked = 'dl'; });
    return el;
  });
  render(<MoreTab onDataChanged={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Экспорт бэкапа' }));
  await waitFor(() => expect(clicked).toBe('dl'));
});

it('import rejects broken file with error message', async () => {
  render(<MoreTab onDataChanged={() => {}} />);
  const input = screen.getByLabelText('Импорт бэкапа');
  await fireEvent.change(input, { target: { files: [new File(['garbage{'], 'b.json')] } });
  expect(await screen.findByText(/повреждён|не JSON/i)).toBeInTheDocument();
  expect(await db.reports.count()).toBe(0);
});

it('import rejects valid JSON with junk element shapes and keeps DB untouched', async () => {
  render(<MoreTab onDataChanged={() => {}} />);
  const input = screen.getByLabelText('Импорт бэкапа');
  const bad = JSON.stringify({ version: 1, settings: { masterOn: true }, reports: [42], entries: [] });
  await fireEvent.change(input, { target: { files: [new File([bad], 'b.json')] } });
  expect(await screen.findByText('Структура файла не соответствует формату бэкапа')).toBeInTheDocument();
  expect(await db.reports.count()).toBe(0);
  expect(await db.entries.count()).toBe(0);
});

it('donate block mentions supporting the project and opens CloudTips', () => {
  const openSpy = vi.fn();
  vi.stubGlobal('open', openSpy);
  render(<MoreTab onDataChanged={() => {}} />);
  expect(screen.getByText('Поддержать проект')).toBeInTheDocument();
  expect(screen.getByText(/разрабатывать новые приложения.*виртуальные машины/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '♥️ Поддержать' }));
  expect(openSpy).toHaveBeenCalledTimes(1);
  expect(openSpy.mock.calls[0][0]).toBe('https://pay.cloudtips.ru/p/866cf60d');
  expect(openSpy.mock.calls[0][1]).toBe('_blank');
  vi.unstubAllGlobals();
});

const reportFile = (reportId = 'nr1', name = 'Новый отчёт') => {
  const { report, entries } = JSON.parse(buildReportExportJson(
    { id: reportId, name, fields: [{ id: 'f1', name: 'Давление', type: 'text', required: true, width: 30 }], archived: false, createdAt: 10, updatedAt: 11 },
    [{ id: 'ne1', reportId, values: { f1: '120/80' }, createdAt: 12 }],
  ));
  return { report, entries };
};

const importFile = (data: object) =>
  fireEvent.change(screen.getByLabelText('Импорт отчёта'), {
    target: { files: [new File([JSON.stringify(data)], 'r.json')] },
  });

it('imports a new report with its entries', async () => {
  render(<MoreTab onDataChanged={() => {}} />);
  const { report, entries } = reportFile();
  await importFile({ version: 1, kind: 'report', report, entries });
  await waitFor(async () => expect(await db.reports.get('nr1')).toBeTruthy());
  expect((await db.entries.toArray()).map(e => e.id)).toEqual(['ne1']);
});

it('replaces an existing report when confirmed', async () => {
  await putReport({ id: 'nr1', name: 'Новый отчёт', fields: [], archived: true, createdAt: 1, updatedAt: 1 });
  await putEntry({ id: 'old', reportId: 'nr1', values: {}, createdAt: 1 });
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<MoreTab onDataChanged={() => {}} />);
  const { report, entries } = reportFile();
  await importFile({ version: 1, kind: 'report', report, entries });
  await waitFor(async () => expect(confirmSpy).toHaveBeenCalled());
  expect(await db.entries.toArray()).toHaveLength(1);
  expect((await db.entries.toArray())[0].id).toBe('ne1');
  expect((await db.reports.get('nr1'))?.archived).toBe(false);
});

it('adds a copy with fresh ids when conflict is declined', async () => {
  await putReport({ id: 'nr1', name: 'Новый отчёт', fields: [], archived: false, createdAt: 1, updatedAt: 1 });
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<MoreTab onDataChanged={() => {}} />);
  const { report, entries } = reportFile();
  await importFile({ version: 1, kind: 'report', report, entries });
  await waitFor(async () => expect(confirmSpy).toHaveBeenCalled());
  await waitFor(async () => expect((await db.reports.toArray())).toHaveLength(2));
  const original = await db.reports.get('nr1');
  expect(original?.name).toBe('Новый отчёт');
  const copy = (await db.reports.toArray()).find(r => r.id !== 'nr1');
  expect(copy?.name).toBe('Новый отчёт (копия)');
  const copyEntries = (await db.entries.toArray()).filter(e => e.reportId === copy?.id);
  expect(copyEntries).toHaveLength(1);
  expect(copyEntries[0].id).not.toBe('ne1');
});

it('importing a backup file shows report-specific error', async () => {
  render(<MoreTab onDataChanged={() => {}} />);
  await importFile({ version: 1, settings: { masterOn: true, syncOn: false }, reports: [], entries: [] });
  expect(await screen.findByText(/полный бэкап/)).toBeInTheDocument();
});
