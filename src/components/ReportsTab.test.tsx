import { render, screen, fireEvent } from '@testing-library/react';
import { it, expect, beforeEach, vi } from 'vitest';
import ReportsTab from './ReportsTab';
import { db, putReport } from '../db/db';

beforeEach(async () => { await db.delete(); await db.open(); });

it('shows active reports and opens the creation wizard on add', async () => {
  await putReport({ id: 'x', name: 'Активный', fields: [], archived: false, createdAt: 1, updatedAt: 1 });
  await putReport({ id: 'y', name: 'Архивный', fields: [], archived: true, createdAt: 2, updatedAt: 2 });
  const opened: string[] = [];
  const onCreate = vi.fn();
  render(<ReportsTab openReport={id => opened.push(id)} onCreate={onCreate} />);
  expect(await screen.findByText('Активный')).toBeInTheDocument();
  expect(screen.queryByText('Архивный')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '+ Добавить отчёт' }));
  expect(onCreate).toHaveBeenCalledTimes(1);
  expect(await db.reports.count()).toBe(2); // wizard itself does not persist
});
