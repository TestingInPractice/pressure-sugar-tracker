import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ReportScreen from './ReportScreen';
import { db, putReport, putEntry, getSyncState, putSyncState } from '../db/db';
import { saveSyncFile } from '../logic/sync-file';

vi.mock('../logic/sync-file', () => ({ saveSyncFile: vi.fn().mockResolvedValue(true) }));
const saveSyncMock = vi.mocked(saveSyncFile);

import { recognizeOfflinePressure } from '../logic/ocr-offline';
vi.mock('../logic/ocr-offline', () => ({ recognizeOfflinePressure: vi.fn() }));
const mockRecognize = vi.mocked(recognizeOfflinePressure);

import { recognizeVisionPressure, loadVisionSettings, saveVisionSettings } from '../logic/vision-ocr';
vi.mock('../logic/vision-ocr', () => ({
  recognizeVisionPressure: vi.fn(),
  loadVisionSettings: vi.fn(),
  saveVisionSettings: vi.fn(),
}));
const mockVision = vi.mocked(recognizeVisionPressure);
const mockLoadVisionSettings = vi.mocked(loadVisionSettings);
const mockSaveVisionSettings = vi.mocked(saveVisionSettings);

beforeEach(async () => {
  await db.delete(); await db.open();
  saveSyncMock.mockClear(); mockRecognize.mockReset();
  mockVision.mockReset(); mockLoadVisionSettings.mockReset(); mockSaveVisionSettings.mockReset();
  localStorage.clear();
  mockLoadVisionSettings.mockReturnValue({ baseUrl: 'http://127.0.0.1:8787/v1', apiKey: '', model: 'qwen/qwen3-vl-32b-instruct' });
});

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
  for (const name of ['← Назад', 'Настроить поля', 'Архивировать', 'Напоминание', 'Синхронизация', '+ Запись', 'Печать/PDF']) {
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

const seedWithEntry = async (v: number) => {
  await putReport({ id: 'p1', name: 'Отчёт АД', fields: [], archived: false, createdAt: 1, updatedAt: 1 });
  await putEntry({ id: 'e0', reportId: 'p1', values: { f1: v }, createdAt: 1 });
};

const clickSync = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Синхронизация' }));
};

it('first sync creates sync state, saves file and reports creation', async () => {
  await seedWithEntry(0);
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await clickSync();
  await waitFor(async () => {
    const st = await getSyncState('p1');
    expect(st?.entries).toHaveLength(1);
  });
  expect(await screen.findByText(/Синхронизация создана \(1/)).toBeInTheDocument();
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
  saveSyncMock.mockResolvedValue(false);
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

const seedWithBP = () =>
  putReport({ id: 'pBp', name: 'БП', archived: false, createdAt: 1, updatedAt: 1,
    fields: [
      { id: 'bp', name: 'ВД / НД / П', type: 'text', required: false, width: 30 },
      { id: 'd', name: 'Дата и время', type: 'datetime', required: true, width: 30 },
    ] });

it('показывает кнопку «Фото» при наличии поля «ВД / НД / П»', async () => {
  await seedWithBP();
  render(<ReportScreen reportId="pBp" onBack={() => {}} />);
  expect(await screen.findByLabelText('Фото')).toBeInTheDocument();
});

it('скрывает кнопку «Фото» при отсутствии поля', async () => {
  await seed();
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await screen.findByRole('button', { name: '+ Запись' });
  expect(screen.queryByLabelText('Фото')).toBeNull();
});

it('успех: открывает форму с датой и распознанным значением', async () => {
  await seedWithBP();
  mockRecognize.mockResolvedValue({ text: '120 80 65', rows: [], confidence: 1 });
  render(<ReportScreen reportId="pBp" onBack={() => {}} />);
  fireEvent.change(await screen.findByLabelText('Фото'), { target: { files: [new File(['x'], 'bp.png', { type: 'image/png' })] } });
  const bp = await screen.findByLabelText(/в[дд] \/ н[дд] \/ п/i);
  expect(bp).toHaveValue('120/80/65');
  const date = screen.getByLabelText(/Дата и время/) as HTMLInputElement;
  expect(date.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  expect(await screen.findByText('Распознано: 120/80/65. Проверьте и исправьте при необходимости.')).toBeInTheDocument();
});

it('мусор: форма открывается, поле пусто, сообщение ошибки', async () => {
  await seedWithBP();
  mockRecognize.mockResolvedValue({ text: 'zxcvbn', rows: [], confidence: 0 });
  render(<ReportScreen reportId="pBp" onBack={() => {}} />);
  fireEvent.change(await screen.findByLabelText('Фото'), { target: { files: [new File(['x'], 'bp.png', { type: 'image/png' })] } });
  const bp = await screen.findByLabelText(/в[дд] \/ н[дд] \/ п/i);
  expect(bp).toHaveValue('');
  expect((screen.getByLabelText(/Дата и время/) as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  expect(await screen.findByText('Распознать не удалось. Введите значение вручную')).toBeInTheDocument();
});

it('worker ошибка: форма открывается, сообщение «Недоступно»', async () => {
  await seedWithBP();
  mockRecognize.mockRejectedValue(new Error('w'));
  render(<ReportScreen reportId="pBp" onBack={() => {}} />);
  fireEvent.change(await screen.findByLabelText('Фото'), { target: { files: [new File(['x'], 'bp.png', { type: 'image/png' })] } });
  const bp = await screen.findByLabelText(/в[дд] \/ н[дд] \/ п/i);
  expect(bp).toHaveValue('');
  expect(await screen.findByText('Распознавание недоступно. Попробуйте ещё раз')).toBeInTheDocument();
});

it('после cancel статус сбрасывается', async () => {
  await seedWithBP();
  mockRecognize.mockResolvedValue({ text: '120 80 65', rows: [], confidence: 1 });
  render(<ReportScreen reportId="pBp" onBack={() => {}} />);
  fireEvent.change(await screen.findByLabelText('Фото'), { target: { files: [new File(['x'], 'bp.png', { type: 'image/png' })] } });
  await screen.findByText('Распознано: 120/80/65. Проверьте и исправьте при необходимости.');
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  fireEvent.click(screen.getByRole('button', { name: '+ Запись' }));
  expect(screen.queryByText('Распознано: 120/80/65. Проверьте и исправьте при необходимости.')).toBeNull();
});

it('vision: при заданном ключе распознавание идёт через vision и оффлайн не вызывается', async () => {
  await seedWithBP();
  mockLoadVisionSettings.mockReturnValue({ baseUrl: 'http://127.0.0.1:8787/v1', apiKey: 'sk-test', model: 'm' });
  mockVision.mockResolvedValue({ text: '105/70/96', confidence: 1 });
  mockRecognize.mockResolvedValue({ text: '13 37', rows: [], confidence: 1 });
  render(<ReportScreen reportId="pBp" onBack={() => {}} />);
  fireEvent.change(await screen.findByLabelText('Фото'), { target: { files: [new File(['x'], 'bp.png', { type: 'image/png' })] } });
  const bp = await screen.findByLabelText(/в[дд] \/ н[дд] \/ п/i);
  expect(bp).toHaveValue('105/70/96');
  expect(mockVision).toHaveBeenCalledTimes(1);
  expect(mockRecognize).not.toHaveBeenCalled();
});

it('vision: при ошибке прокси падает обратно на оффлайн-декодер', async () => {
  await seedWithBP();
  mockLoadVisionSettings.mockReturnValue({ baseUrl: 'http://127.0.0.1:8787/v1', apiKey: 'sk-test', model: 'm' });
  mockVision.mockRejectedValue(new Error('fetch failed'));
  mockRecognize.mockResolvedValue({ text: '120 80 65', rows: [], confidence: 1 });
  render(<ReportScreen reportId="pBp" onBack={() => {}} />);
  fireEvent.change(await screen.findByLabelText('Фото'), { target: { files: [new File(['x'], 'bp.png', { type: 'image/png' })] } });
  const bp = await screen.findByLabelText(/в[дд] \/ н[дд] \/ п/i);
  expect(bp).toHaveValue('120/80/65');
  expect(mockRecognize).toHaveBeenCalledTimes(1);
});

it('vision: при мусорном ответе модели тоже падает на оффлайн', async () => {
  await seedWithBP();
  mockLoadVisionSettings.mockReturnValue({ baseUrl: 'http://127.0.0.1:8787/v1', apiKey: 'sk-test', model: 'm' });
  mockVision.mockResolvedValue({ text: '', confidence: 0 });
  mockRecognize.mockResolvedValue({ text: '120 80 65', rows: [], confidence: 1 });
  render(<ReportScreen reportId="pBp" onBack={() => {}} />);
  fireEvent.change(await screen.findByLabelText('Фото'), { target: { files: [new File(['x'], 'bp.png', { type: 'image/png' })] } });
  const bp = await screen.findByLabelText(/в[дд] \/ н[дд] \/ п/i);
  expect(bp).toHaveValue('120/80/65');
});

it('vision: кнопка «Настройки распознавания» сохраняет ключ в localStorage', async () => {
  await seedWithBP();
  render(<ReportScreen reportId="pBp" onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Настройки распознавания' }));
  const keyInput = screen.getByLabelText('API-ключ vision');
  fireEvent.change(keyInput, { target: { value: 'sk-newkey' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(mockSaveVisionSettings).toHaveBeenCalledWith(
    expect.objectContaining({ apiKey: 'sk-newkey' }),
  );
});
