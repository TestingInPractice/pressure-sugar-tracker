import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders three bp inputs and saves them as an object', () => {
    const bp: Field = {
      id: 'bp1', name: 'ВД / НД / П', type: 'bp', required: false, width: 30,
      parts: [{ id: 'systolic', label: 'ВД' }, { id: 'diastolic', label: 'НД' }, { id: 'pulse', label: 'П' }],
    };
    let saved: unknown;
    render(<EntryForm fields={[bp]} onSave={v => { saved = v; }} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText(/^ВД/), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText(/^НД/), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText(/^П/), { target: { value: '70' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(saved).toEqual({ bp1: { systolic: '120', diastolic: '80', pulse: '70' } });
  });

  it('hides the auto numbering field but keeps other fields visible', () => {
    const fields: Field[] = [
      { id: 'n', name: 'Номер', type: 'number', required: false, width: 30 },
      { id: 'd', name: 'Дата и время', type: 'datetime', required: true, width: 30 },
    ];
    renderForm(fields);
    expect(screen.queryByLabelText('Номер')).toBeNull();
    expect(screen.getByLabelText(/Дата и время/)).toBeInTheDocument();
  });
});
