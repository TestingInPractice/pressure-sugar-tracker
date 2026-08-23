import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { it, expect, beforeEach } from 'vitest';
import ReportsTab from './ReportsTab';
import { db, putReport } from '../db/db';

beforeEach(async () => { await db.delete(); await db.open(); });

it('shows active reports and creates one from template', async () => {
  await putReport({ id: 'x', name: 'Активный', fields: [], archived: false, createdAt: 1, updatedAt: 1 });
  await putReport({ id: 'y', name: 'Архивный', fields: [], archived: true, createdAt: 2, updatedAt: 2 });
  const opened: string[] = [];
  render(<ReportsTab openReport={id => opened.push(id)} />);
  expect(await screen.findByText('Активный')).toBeInTheDocument();
  expect(screen.queryByText('Архивный')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '+ Добавить отчёт' }));
  await waitFor(async () => {
    const reports = await db.reports.toArray();
    expect(reports.some(r => r.name === 'Новый отчёт' && r.fields.length === 5)).toBe(true);
  });
});
