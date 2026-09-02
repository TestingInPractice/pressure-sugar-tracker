import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EntryForm from './EntryForm';
import type { Field } from '../types';

function renderForm(fields: Field[]) {
  return render(<EntryForm fields={fields} onSave={vi.fn()} onCancel={vi.fn()} />);
}

describe('EntryForm', () => {
  it('renders save and cancel buttons', () => {
    renderForm([
      { id: 'note', name: 'Примечание', type: 'text', required: false, width: 2 },
    ]);
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument();
  });
});
