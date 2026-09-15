import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { it, expect, beforeEach, vi } from 'vitest';
import MoreTab from './MoreTab';
import { db, putReport } from '../db/db';

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
