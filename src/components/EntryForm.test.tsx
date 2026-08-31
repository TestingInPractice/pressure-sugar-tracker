import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EntryForm from './EntryForm';
import type { Field } from '../types';

const OTHER_FIELD: Field = {
  id: 'note', name: 'Примечание', type: 'text', required: false, width: 2,
};

function renderForm(fields: Field[]) {
  return render(<EntryForm fields={fields} onSave={vi.fn()} onCancel={vi.fn()} />);
}

describe('EntryForm photo result message', () => {
  it('показывает статус done', () => {
    render(
      <EntryForm
        fields={[OTHER_FIELD]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        photoResult={{ status: 'done', message: 'Готово: 120/80/65' }}
      />
    );
    expect(screen.getByText('Готово: 120/80/65')).toBeInTheDocument();
  });

  it('показывает статус error', () => {
    render(
      <EntryForm
        fields={[OTHER_FIELD]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        photoResult={{ status: 'error', message: 'Не удалось распознать. Попробуйте другое фото' }}
      />
    );
    expect(screen.getByText('Не удалось распознать. Попробуйте другое фото')).toBeInTheDocument();
  });

  it('не показывает сообщение при idle/undefined', () => {
    renderForm([OTHER_FIELD]);
    expect(screen.queryByText(/Готово|не удалось/i)).toBeNull();
  });
});
