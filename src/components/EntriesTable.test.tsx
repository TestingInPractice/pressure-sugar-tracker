import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EntriesTable from './EntriesTable';
import EntryForm from './EntryForm';
import type { Field, Entry } from '../types';
import userEvent from '@testing-library/user-event';

const fields: Field[] = [
  { id: 'f1', name: 'Давление', type: 'number', unit: 'мм рт.ст.', required: true, width: 30 },
  { id: 'f2', name: 'Примечание', type: 'text', required: false, width: 30 },
];

const entry: Entry = { id: 'e1', reportId: 'r', values: { f1: 120, f2: 'утром' }, createdAt: 5 };

describe('EntriesTable + EntryForm', () => {
  it('renders rows with fixed column widths and wraps values', () => {
    render(<EntriesTable report={{ fields }} entries={[entry]} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('утром')).toBeInTheDocument();
    const cell = screen.getByText('утром').closest('td')!;
    expect(cell).toHaveStyle({ maxWidth: '30ch' });
  });

  it('form validates required fields before save', async () => {
    const saved: unknown[] = [];
    render(<EntryForm fields={fields} onSave={v => saved.push(v)} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(saved).toHaveLength(0);
    expect(screen.getByText('Обязательное поле')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Давление/), '130');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(saved).toHaveLength(1);
  });
});
