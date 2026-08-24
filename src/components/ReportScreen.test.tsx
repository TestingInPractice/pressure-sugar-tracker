import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ReportScreen from './ReportScreen';
import { db, putReport, putEntry } from '../db/db';

beforeEach(async () => { await db.delete(); await db.open(); });

const seed = () =>
  putReport({ id: 'p1', name: 'Отчёт АД', fields: [], archived: false, createdAt: 1, updatedAt: 1 });

it('renders «Печать/PDF» button that calls window.print()', async () => {
  await seed();
  const printSpy = vi.fn();
  vi.stubGlobal('print', printSpy);
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  const btn = await screen.findByRole('button', { name: 'Печать/PDF' });
  fireEvent.click(btn);
  expect(printSpy).toHaveBeenCalledTimes(1);
  vi.unstubAllGlobals();
});

it('has hidden .print-title heading and .no-print on action buttons', async () => {
  await seed();
  const { container } = render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await screen.findByRole('button', { name: 'Печать/PDF' });
  const title = container.querySelector('.print-title');
  expect(title).not.toBeNull();
  expect(title?.textContent).toBe('Отчёт АД');
  for (const name of ['← Назад', 'Настроить поля', 'Архивировать', 'Напоминание', '+ Запись', 'Печать/PDF']) {
    const btn = screen.getByRole('button', { name });
    expect(btn.className).toContain('no-print');
  }
  fireEvent.click(screen.getByRole('button', { name: '+ Запись' }));
  expect(document.querySelector('form.no-print')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Напоминание' }));
  expect(document.querySelector('section.no-print')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Настроить поля' }));
  expect(document.querySelector('.fields-editor.no-print')).not.toBeNull();
});

it('removeEntry does NOT delete when confirm is declined', async () => {
  await seed();
  await putEntry({ id: 'e1', reportId: 'p1', values: {}, createdAt: 1 });
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: '🗑' }));
  await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
  expect(await db.entries.count()).toBe(1);
  confirmSpy.mockRestore();
});

it('removeEntry deletes after confirm accepted', async () => {
  await seed();
  await putEntry({ id: 'e1', reportId: 'p1', values: {}, createdAt: 1 });
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: '🗑' }));
  await waitFor(async () => expect(await db.entries.count()).toBe(0));
  expect(await screen.findByText('Нет записей')).toBeInTheDocument();
  confirmSpy.mockRestore();
});

it('renames report via inline editor', async () => {
  await seed();
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Переименовать отчёт' }));
  const input = screen.getByLabelText('Название отчёта');
  expect(input).toHaveValue('Отчёт АД');
  fireEvent.change(input, { target: { value: 'Утро 23 августа' } });
  fireEvent.click(screen.getByRole('button', { name: '✓' }));
  await waitFor(async () => {
    const r = await db.reports.get('p1');
    expect(r?.name).toBe('Утро 23 августа');
  });
  const headings = await screen.findAllByRole('heading', { name: 'Утро 23 августа' });
  expect(headings.length).toBeGreaterThan(0);
});

it('rename keeps old name when draft is blank', async () => {
  await seed();
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Переименовать отчёт' }));
  fireEvent.change(screen.getByLabelText('Название отчёта'), { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: '✓' }));
  expect(await db.reports.get('p1')).toMatchObject({ name: 'Отчёт АД' });
});

it('deletes report with entries after confirm accepted', async () => {
  await seed();
  await putEntry({ id: 'e1', reportId: 'p1', values: {}, createdAt: 1 });
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const onBack = vi.fn();
  render(<ReportScreen reportId="p1" onBack={onBack} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Удалить отчёт' }));
  await waitFor(async () => expect(await db.reports.get('p1')).toBeUndefined());
  expect(await db.entries.count()).toBe(0);
  expect(onBack).toHaveBeenCalledTimes(1);
  confirmSpy.mockRestore();
});

it('keeps report when delete confirm declined', async () => {
  await seed();
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Удалить отчёт' }));
  await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
  expect(await db.reports.get('p1')).toBeTruthy();
  confirmSpy.mockRestore();
});

it('prefills next row number for new entry and restores it if cleared', async () => {
  await putReport({ id: 'p3', name: 'Р3',
    fields: [
      { id: 'n', name: 'Номер', type: 'number', required: false, width: 30 },
      { id: 'd', name: 'Дата и время', type: 'datetime', required: true, width: 30 },
    ],
    archived: false, createdAt: 1, updatedAt: 1 });
  await putEntry({ id: 'e9', reportId: 'p3', values: { n: 7, d: '2026-08-23T10:00' }, createdAt: 1 });
  render(<ReportScreen reportId="p3" onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: '+ Запись' }));
  expect(await screen.findByLabelText('Номер')).toHaveValue('8');
  fireEvent.change(screen.getByLabelText('Номер'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText(/Дата и время/), { target: { value: '2026-08-24T09:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(async () => {
    const rows = await db.entries.where('reportId').equals('p3').toArray();
    const saved = rows.find(r => r.values.d === '2026-08-24T09:00');
    expect(saved?.values.n).toBe(8);
  });
});

it('print range filters entries by datetime field', async () => {
  await putReport({ id: 'p2', name: 'Р2',
    fields: [{ id: 'd1', name: 'Дата и время', type: 'datetime', required: true, width: 30 }],
    archived: false, createdAt: 1, updatedAt: 1 });
  await putEntry({ id: 'e1', reportId: 'p2', values: { d1: '2026-08-23T19:00' }, createdAt: 1 });
  await putEntry({ id: 'e2', reportId: 'p2', values: { d1: '2026-09-01T10:00' }, createdAt: 2 });
  const printSpy = vi.fn();
  vi.stubGlobal('print', printSpy);
  render(<ReportScreen reportId="p2" onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Печать/PDF' }));
  expect(await screen.findByLabelText('С')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('По'), { target: { value: '2026-08-31' } });
  await waitFor(() => expect(screen.queryByText('01.09 10:00')).toBeNull());
  expect(screen.getByText('23.08 19:00')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Печать' }));
  expect(printSpy).toHaveBeenCalledTimes(1);
  vi.unstubAllGlobals();
});

it('index.css contains @media print rules per brief', () => {
  const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf-8');
  expect(css).toContain('@media print');
  expect(css).toContain('.app-header, .tabbar, .no-print { display: none !important; }');
  expect(css).toContain('.print-title { display: block !important; font-size: 18pt; margin-bottom: 8pt; }');
  expect(css).toContain('.actions-col { display: none !important; }');
  expect(css).toContain('.entries-table { width: 100%; border-collapse: collapse; table-layout: auto; }');
  expect(css).toContain('.entries-table th, .entries-table td { border: 1pt solid #333; padding: 2pt 4pt; overflow-wrap: anywhere; text-align: left; vertical-align: top; }');
  expect(css).toContain('.entries-table th.col-number, .entries-table td.col-number { width: 1% !important; white-space: nowrap; }');
  expect(css).toContain('.entries-table tbody tr:last-child td { border-bottom: 1pt solid #333 !important; }');
  expect(css).toContain('.print-root { zoom: 0.8; }');
  // вне @media print заголовок скрыт на экране
  expect(css).toMatch(/}\s*\.print-title \{ display: none; \}/);
});
