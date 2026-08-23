import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { it, expect, beforeEach } from 'vitest';
import ArchiveTab from './ArchiveTab';
import { db, putReport } from '../db/db';

beforeEach(async () => { await db.delete(); await db.open(); });

it('lists archived and unarchives', async () => {
  await putReport({ id: 'a', name: 'Старый', fields: [], archived: true, createdAt: 1, updatedAt: 1 });
  render(<ArchiveTab openReport={() => {}} />);
  expect(await screen.findByText('Старый')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Разархивировать' }));
  await waitFor(async () => {
    expect((await db.reports.get('a'))!.archived).toBe(false);
  });
});
