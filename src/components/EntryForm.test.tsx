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
        photoResult={{ status: 'done', message: 'Распознано: 120/80/65. Проверьте и исправьте при необходимости.' }}
      />
    );
    expect(screen.getByText('Распознано: 120/80/65. Проверьте и исправьте при необходимости.')).toBeInTheDocument();
  });

  it('показывает статус error', () => {
    render(
      <EntryForm
        fields={[OTHER_FIELD]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        photoResult={{ status: 'error', message: 'Распознать не удалось. Введите значение вручную' }}
      />
    );
    expect(screen.getByText('Распознать не удалось. Введите значение вручную')).toBeInTheDocument();
  });

  it('не показывает сообщение при idle/undefined', () => {
    renderForm([OTHER_FIELD]);
    expect(screen.queryByText(/Распознано|распознать/i)).toBeNull();
  });
});

describe('EntryForm draft field highlight', () => {
  const BP_FIELD: Field = {
    id: 'bp', name: 'ВД / НД / П', type: 'text', unit: 'мм рт. ст.', required: true, width: 2,
  };

  it('помечает поле-черновик классом и фокусирует его', () => {
    render(
      <EntryForm
        fields={[BP_FIELD]}
        initial={{ bp: '135/85' }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        draftFieldId="bp"
      />
    );
    const label = screen.getByText(/в[дд] \/ н[дд] \/ п/i).closest('label');
    expect(label).toHaveClass('draft-field');
    const input = screen.getByDisplayValue('135/85');
    expect(document.activeElement).toBe(input);
  });
});
