import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import FieldsEditor from './FieldsEditor';
import { db } from '../db/db';
import type { Report } from '../types';

beforeEach(async () => { await db.delete(); await db.open(); });

const base: Report = {
  id: 'r1', name: 'R', archived: false, createdAt: 0, updatedAt: 0,
  fields: [
    { id: 'f1', name: 'A', type: 'number', required: false, width: 30 },
  ],
};

describe('FieldsEditor', () => {
  it('blocks adding beyond 10 fields', () => {
    render(<FieldsEditor report={{ ...base, fields: Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, name: `F${i}`, type: 'text' as const, required: false, width: 30 })) }} onSaved={() => {}} />);
    expect(screen.getByRole('button', { name: '+ Поле' })).toBeDisabled();
  });

  it('cannot remove the last field', () => {
    render(<FieldsEditor report={base} onSaved={() => {}} />);
    expect(screen.getByRole('button', { name: 'Удалить поле' })).toBeDisabled();
  });

  it('saves edited field props', () => {
    let saved: Report | null = null;
    render(<FieldsEditor report={base} onSaved={r => { saved = r; }} />);
    const nameInput = screen.getByDisplayValue('A');
    fireEvent.change(nameInput, { target: { value: 'Давление' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить поля' }));
    expect(saved!.fields[0].name).toBe('Давление');
  });
});
