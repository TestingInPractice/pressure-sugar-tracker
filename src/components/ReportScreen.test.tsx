import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ReportScreen from './ReportScreen';
import { db, putReport, putEntry, getSyncState, putSyncState, saveSettings } from '../db/db';
import { saveSyncFile } from '../logic/sync-file';
import { syncAfterEntry } from '../logic/entry-sync';

vi.mock('../logic/sync-file', () => ({
  saveSyncFile: vi.fn().mockResolvedValue({ kind: 'updated' }),
}));
vi.mock('../logic/entry-sync', () => ({
  syncAfterEntry: vi.fn().mockResolvedValue('noop'),
}));
const saveSyncMock = vi.mocked(saveSyncFile);
const syncAfterMock = vi.mocked(syncAfterEntry);

/** Кнопки действий живут в закрытом <details> — открываем всё для доступности. */
const openAllDetails = () => {
  document.querySelectorAll<HTMLDetailsElement>('details').forEach(d => { d.open = true; });
};

beforeEach(async () => {
  await db.delete(); await db.open();
  saveSyncMock.mockClear();
  saveSyncMock.mockResolvedValue({ kind: 'updated' });
  syncAfterMock.mockClear();
  syncAfterMock.mockResolvedValue('noop');
});

const seed = () =>
  putReport({ id: 'p1', name: 'Отчёт АД', fields: [], archived: false, createdAt: 1, updatedAt: 1 });

it('PDF icon opens bottom sheet; Печать calls window.print()', async () => {
  await seed();
  const printSpy = vi.fn();
  vi.stubGlobal('print', printSpy);
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await screen.findByRole('button', { name: '+ Запись' });
  fireEvent.click(screen.getByRole('button', { name: 'Экспорт PDF' }));
  expect(screen.getByText('Экспорт отчёта')).toBeInTheDocument();
  const printBtn = screen.getByRole('button', { name: 'Печать' });
  fireEvent.click(printBtn);
  expect(printSpy).toHaveBeenCalledTimes(1);
  vi.unstubAllGlobals();
});

it('heart icon opens CloudTips in a new tab', async () => {
  await seed();
  const openSpy = vi.fn();
  vi.stubGlobal('open', openSpy);
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  const heart = await screen.findByRole('button', { name: 'Поддержать проект' });
  fireEvent.click(heart);
  expect(openSpy).toHaveBeenCalledTimes(1);
  expect(openSpy.mock.calls[0][0]).toBe('https://pay.cloudtips.ru/p/e21e29f5');
  expect(openSpy.mock.calls[0][1]).toBe('_blank');
  vi.unstubAllGlobals();
});

it('has hidden .print-title heading and .no-print on nav bar and add button', async () => {
  await seed();
  const { container } = render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await screen.findByRole('button', { name: '+ Запись' });
  const title = container.querySelector('.print-title');
  expect(title).not.toBeNull();
  expect(title?.textContent).toBe('Отчёт АД');
    const nav = container.querySelector('.report-nav');
    expect(nav?.className).toContain('no-print');
    expect(screen.getByRole('button', { name: '+ Запись' }).className).toContain('no-print');
    openAllDetails();
    for (const name of ['← Назад', 'Архивировать', 'Напоминание', 'Синхронизация', 'Удалить отчёт']) {
      const btn = screen.getByRole('button', { name });
      expect(btn.closest('.report-nav.no-print')).not.toBeNull();
    }
    fireEvent.click(screen.getByRole('button', { name: '+ Запись' }));
    expect(document.querySelector('form.no-print')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Напоминание' }));
    expect(document.querySelector('section.no-print')).not.toBeNull();
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

it('renames report via menu editor', async () => {
  await seed();
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  openAllDetails();
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
  openAllDetails();
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
  await screen.findByRole('button', { name: '+ Запись' });
  openAllDetails();
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
  await screen.findByRole('button', { name: '+ Запись' });
  openAllDetails();
  fireEvent.click(await screen.findByRole('button', { name: 'Удалить отчёт' }));
  await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
  expect(await db.reports.get('p1')).toBeTruthy();
  confirmSpy.mockRestore();
});

it('hides the auto numbering field but stamps the next number and prefills current datetime', async () => {
  await putReport({ id: 'p3', name: 'Р3',
    fields: [
      { id: 'n', name: 'Номер', type: 'number', required: false, width: 30 },
      { id: 'd', name: 'Дата и время', type: 'datetime', required: true, width: 30 },
    ],
    archived: false, createdAt: 1, updatedAt: 1 });
  await putEntry({ id: 'e9', reportId: 'p3', values: { n: 7, d: '2026-08-23T10:00' }, createdAt: 1 });
  render(<ReportScreen reportId="p3" onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: '+ Запись' }));
  expect(screen.queryByLabelText('Номер')).toBeNull();
  const dtVal = (screen.getByLabelText('Дата и время *') as HTMLInputElement).value;
  expect(dtVal).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(async () => {
    const rows = await db.entries.where('reportId').equals('p3').toArray();
    expect(rows).toHaveLength(2);
    const saved = rows.find(r => r.values.d !== '2026-08-23T10:00');
    expect(saved?.values.n).toBe(8);
  });
});

it('hides field from form and table via Поля отчёта toggle', async () => {
  await putReport({ id: 'p4', name: 'Р4', fields: [
    { id: 'n', name: 'Номер', type: 'number', required: false, width: 30 },
    { id: 'd', name: 'Дата и время', type: 'datetime', required: true, width: 30 },
    { id: 's', name: 'Сахар', type: 'number', unit: 'ммоль/л', required: false, width: 30 },
  ], archived: false, createdAt: 1, updatedAt: 1 });
  render(<ReportScreen reportId="p4" onBack={() => {}} />);
  await screen.findByRole('button', { name: '+ Запись' });
  openAllDetails();
  const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
  expect(boxes[0]).toBeDisabled();
  expect(boxes[1]).toBeDisabled();
  expect(boxes[2]).not.toBeDisabled();
  fireEvent.click(boxes[2]);
  await waitFor(async () => {
    expect((await db.reports.get('p4'))?.fields.find(f => f.id === 's')?.hidden).toBe(true);
  });
  fireEvent.click(screen.getByRole('button', { name: '+ Запись' }));
  expect(document.querySelector('form')?.textContent).not.toMatch(/Сахар/);
  expect(screen.queryByText(/Сахар, ммоль\/л/)).toBeNull();
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
  await screen.findByRole('button', { name: '+ Запись' });
  fireEvent.click(screen.getByRole('button', { name: 'Экспорт PDF' }));
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
  expect(css).toContain('.app-header, .tabbar, .no-print, .entries-cards { display: none !important; }');
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

const seedWithEntry = async (v: number) => {
  await putReport({ id: 'p1', name: 'Отчёт АД', fields: [], archived: false, createdAt: 1, updatedAt: 1 });
  await putEntry({ id: 'e0', reportId: 'p1', values: { f1: v }, createdAt: 1 });
};

const clickSync = async () => {
  await screen.findByRole('button', { name: '+ Запись' });
  openAllDetails();
  fireEvent.click(await screen.findByRole('button', { name: 'Синхронизация' }));
};

it('first sync creates sync state, saves file and reports creation', async () => {
  await seedWithEntry(0);
  saveSyncMock.mockResolvedValue({ kind: 'created' });
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await clickSync();
  await waitFor(async () => {
    const st = await getSyncState('p1');
    expect(st?.entries).toHaveLength(1);
  });
  expect(await screen.findByText(/Создан файл синхронизации \(1/)).toBeInTheDocument();
  expect(saveSyncMock).toHaveBeenCalledTimes(1);
  const [argReport, argEntries] = saveSyncMock.mock.calls[0];
  expect(argReport.name).toBe('Отчёт АД');
  expect(argEntries).toHaveLength(1);
});

it('append-only sync updates state without confirm', async () => {
  await seedWithEntry(0);
  await putSyncState({
    reportId: 'p1', reportName: 'Отчёт АД', fields: [], syncedAt: 1,
    entries: [{ id: 'e0', reportId: 'p1', values: { f1: 0 }, createdAt: 1 }],
  });
  await putEntry({ id: 'e9', reportId: 'p1', values: { f1: 9 }, createdAt: 9 });
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  const confirmSpy = vi.spyOn(window, 'confirm');
  await clickSync();
  await waitFor(async () => expect((await getSyncState('p1'))?.entries).toHaveLength(2));
  expect(confirmSpy).not.toHaveBeenCalled();
  expect(await screen.findByText(/добавлено 1/)).toBeInTheDocument();
  confirmSpy.mockRestore();
});

it('identical sync reports no actualization needed without touching state', async () => {
  await seedWithEntry(0);
  await putSyncState({
    reportId: 'p1', reportName: 'Отчёт АД', fields: [], syncedAt: 1,
    entries: [{ id: 'e0', reportId: 'p1', values: { f1: 0 }, createdAt: 1 }],
  });
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await clickSync();
  expect(await screen.findByText('Актуализация не нужна')).toBeInTheDocument();
  expect(saveSyncMock).not.toHaveBeenCalled();
  expect((await getSyncState('p1'))?.syncedAt).toBe(1);
});

it('conflict with confirm replaces sync state and saves file', async () => {
  await seedWithEntry(5);
  await putSyncState({
    reportId: 'p1', reportName: 'Отчёт АД', fields: [], syncedAt: 1,
    entries: [{ id: 'e0', reportId: 'p1', values: { f1: 999 }, createdAt: 1 }],
  });
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await clickSync();
  await waitFor(async () => {
    const st = await getSyncState('p1');
    expect(st?.entries[0].values.f1).toBe(5);
  });
  expect(await screen.findByText('Файл обновлён')).toBeInTheDocument();
  expect(saveSyncMock).toHaveBeenCalledTimes(1);
  confirmSpy.mockRestore();
});

it('conflict with decline leaves sync state and file untouched', async () => {
  await seedWithEntry(5);
  const orig = {
    reportId: 'p1', reportName: 'Отчёт АД', fields: [], syncedAt: 1,
    entries: [{ id: 'e0', reportId: 'p1', values: { f1: 999 }, createdAt: 1 }],
  };
  await putSyncState(orig);
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await clickSync();
  await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
  expect(await screen.findByText('Файл не изменён')).toBeInTheDocument();
  expect(await getSyncState('p1')).toEqual(orig);
  expect(saveSyncMock).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});

it('cancelled save (AbortError) reports cancellation without writing sync state', async () => {
  await seedWithEntry(0);
  saveSyncMock.mockResolvedValue({ kind: 'cancelled' });
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await clickSync();
  expect(await screen.findByText('Сохранение отменено')).toBeInTheDocument();
  expect(await getSyncState('p1')).toBeUndefined();
});

it('saveSyncFile rejection reports error without writing sync state', async () => {
  await seedWithEntry(0);
  saveSyncMock.mockRejectedValue(new Error('share failed'));
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await clickSync();
  expect(await screen.findByText('Не удалось выполнить синхронизацию. Попробуйте ещё раз')).toBeInTheDocument();
  expect(await getSyncState('p1')).toBeUndefined();
});

it('auto-syncs silently when enabled and hints when no file selected', async () => {
  syncAfterMock.mockResolvedValue('ios-manual');
  await seedWithEntry(0);
  await saveSettings({ masterOn: true, syncOn: true });
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: '+ Запись' }));
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(syncAfterMock).toHaveBeenCalled());
  expect(await screen.findByText(/кнопкой «Синхронизация»/)).toBeInTheDocument();
});

it('shows no hint when auto-sync writes to the file', async () => {
  syncAfterMock.mockResolvedValue('written');
  await seedWithEntry(0);
  await saveSettings({ masterOn: true, syncOn: true });
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: '+ Запись' }));
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(syncAfterMock).toHaveBeenCalled());
  expect(screen.queryByText(/кнопкой «Синхронизация»/)).toBeNull();
});

it('saving with syncOn calls syncAfterEntry with allowFirstSave:true', async () => {
  await seed();
  await saveSettings({ masterOn: true, syncOn: true });
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: '+ Запись' }));
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(syncAfterMock).toHaveBeenCalled());
  expect(syncAfterMock.mock.calls.some(([, , opts]) => opts?.allowFirstSave === true)).toBe(true);
});

it('background effect syncs with allowFirstSave:false after an entry is added', async () => {
  await seedWithEntry(0);
  await saveSettings({ masterOn: true, syncOn: true });
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: '+ Запись' }));
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => {
    expect(syncAfterMock.mock.calls.some(([, , o]) => o?.allowFirstSave === false)).toBe(true);
  }, { timeout: 3000 });
});

it('does not call syncAfterEntry when syncOn is off', async () => {
  await seedWithEntry(0);
  await saveSettings({ masterOn: true, syncOn: false });
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: '+ Запись' }));
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(async () => expect(await db.entries.count()).toBe(2));
  await new Promise(r => setTimeout(r, 700));
  expect(syncAfterMock).not.toHaveBeenCalled();
});

it('shows sync file info when sync state exists', async () => {
  await seedWithEntry(0);
  await putSyncState({
    reportId: 'p1', reportName: 'Отчёт АД', fields: [], syncedAt: 1700000000000,
    entries: [{ id: 'e0', reportId: 'p1', values: { f1: 0 }, createdAt: 1 }],
  });
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  expect(await screen.findByText(/Файл: .*Отчёт АД-sync\.json.*· 1 запись/)).toBeInTheDocument();
});

it('hides sync file info when never synced', async () => {
  await seedWithEntry(0);
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await screen.findByRole('button', { name: '+ Запись' });
  expect(screen.queryByText(/Файл: .*sync\.json/)).not.toBeInTheDocument();
});

const seedPrintable = async () => {
  await putReport({
    id: 'pp', name: 'Печать', archived: false, createdAt: 1, updatedAt: 1,
    fields: [
      { id: 'd', name: 'Дата и время', type: 'datetime', required: true, width: 30 },
      { id: 'bp1', name: 'ВД / НД / П', type: 'bp', required: false, width: 30,
        parts: [{ id: 'systolic', label: 'ВД' }, { id: 'diastolic', label: 'НД' }, { id: 'pulse', label: 'П' }] },
      { id: 's1', name: 'Сахар', type: 'number', unit: 'ммоль/л', required: false, width: 30 },
    ],
    targets: { sys: 120, dia: 80 },
  });
  await putEntry({ id: 'e1', reportId: 'pp', values: { bp1: { systolic: 130, diastolic: 85 }, s1: 5.5, d: '2026-08-20T10:00' }, createdAt: 1 });
};

it('print dialog offers charts and norms, print block renders them', async () => {
  await seedPrintable();
  render(<ReportScreen reportId="pp" onBack={() => {}} />);
  await screen.findByRole('button', { name: '+ Запись' });
  fireEvent.click(screen.getByRole('button', { name: 'Экспорт PDF' }));
  expect(screen.getByLabelText('График: давление')).toBeChecked();
  expect(screen.getByLabelText('График: сахар')).toBeChecked();
  expect(screen.getByLabelText('Норма на графиках')).toBeChecked();
  await screen.findByText('130/85');
  const block = document.querySelector('.print-charts');
  expect(block).not.toBeNull();
  expect(block!.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2);
  expect(block!.querySelectorAll('[data-target]')).toHaveLength(2);
});

it('print chart toggles remove charts and norm lines', async () => {
  await seedPrintable();
  render(<ReportScreen reportId="pp" onBack={() => {}} />);
  await screen.findByRole('button', { name: '+ Запись' });
  fireEvent.click(screen.getByRole('button', { name: 'Экспорт PDF' }));
  await screen.findByLabelText('График: давление');
  await screen.findByText('130/85');
  fireEvent.click(screen.getByLabelText('График: давление'));
  fireEvent.click(screen.getByLabelText('Норма на графиках'));
  const block = document.querySelector('.print-charts');
  expect(block!.textContent).not.toMatch(/Верхнее/);
  expect(block!.querySelectorAll('[data-target]')).toHaveLength(0);
  expect(block!.querySelectorAll('svg').length).toBeGreaterThanOrEqual(1);
});

it('saves personal targets via visible Мои нормы panel', async () => {
  await seed();
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await screen.findByRole('button', { name: '+ Запись' });
  expect(screen.getByText('Нормы не заданы')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Изменить' }));
  fireEvent.change(screen.getByLabelText('Верхнее (ВД)'), { target: { value: '120' } });
  fireEvent.change(screen.getByLabelText('Нижнее (НД)'), { target: { value: '80' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(async () => {
    expect((await db.reports.get('p1'))?.targets).toEqual({ sys: 120, dia: 80, pulse: undefined, sugar: undefined });
  });
  expect(screen.getByText(/ВД 120 · НД 80/)).toBeInTheDocument();
});

it('bottom sheet opens from PDF icon and closes via overlay click', async () => {
  await seed();
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await screen.findByRole('button', { name: '+ Запись' });
  fireEvent.click(screen.getByRole('button', { name: 'Экспорт PDF' }));
  expect(screen.getByText('Экспорт отчёта')).toBeInTheDocument();
  fireEvent.click(document.querySelector('.bottom-sheet-overlay')!);
  await waitFor(() => expect(screen.queryByText('Экспорт отчёта')).toBeNull());
});

it('bottom sheet closes via Закрыть button', async () => {
  await seed();
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await screen.findByRole('button', { name: '+ Запись' });
  fireEvent.click(screen.getByRole('button', { name: 'Экспорт PDF' }));
  expect(screen.getByText('Экспорт отчёта')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Закрыть'));
  await waitFor(() => expect(screen.queryByText('Экспорт отчёта')).toBeNull());
});

it('bottom sheet Сбросить clears range', async () => {
  await putReport({ id: 'p2', name: 'Р2',
    fields: [{ id: 'd1', name: 'Дата и время', type: 'datetime', required: true, width: 30 }],
    archived: false, createdAt: 1, updatedAt: 1 });
  await putEntry({ id: 'e1', reportId: 'p2', values: { d1: '2026-08-23T19:00' }, createdAt: 1 });
  render(<ReportScreen reportId="p2" onBack={() => {}} />);
  await screen.findByRole('button', { name: '+ Запись' });
  fireEvent.click(screen.getByRole('button', { name: 'Экспорт PDF' }));
  fireEvent.change(screen.getByLabelText('По'), { target: { value: '2026-08-22' } });
  await waitFor(() => expect(screen.queryByText('23.08 19:00')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
  expect(screen.getByText('23.08 19:00')).toBeInTheDocument();
});

it('bottom sheet contains Сохранить PDF button', async () => {
  await seed();
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await screen.findByRole('button', { name: '+ Запись' });
  fireEvent.click(screen.getByRole('button', { name: 'Экспорт PDF' }));
  expect(screen.getByRole('button', { name: 'Сохранить PDF' })).toBeInTheDocument();
});

it('overflow menu no longer contains Печать or Экспорт PDF', async () => {
  await seed();
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await screen.findByRole('button', { name: '+ Запись' });
  openAllDetails();
  const popover = document.querySelector('.overflow-menu__popover')!;
  expect(popover.querySelector('button')).not.toBeNull();
  expect(popover.textContent).not.toContain('Печать');
  expect(popover.textContent).not.toContain('Экспорт PDF');
  expect(popover.textContent).toContain('Синхронизация');
});
