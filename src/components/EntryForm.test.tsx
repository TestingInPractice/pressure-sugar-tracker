import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EntryForm from './EntryForm';
import type { Field } from '../types';
import { recognizeTextFromImage } from '../logic/ocr';

vi.mock('../logic/ocr', () => ({
  recognizeTextFromImage: vi.fn(),
}));

const mockRecognize = vi.mocked(recognizeTextFromImage);

const BP_FIELD: Field = {
  id: 'bp', name: 'ВД / НД / П', type: 'text', required: false, width: 2,
};
const OTHER_FIELD: Field = {
  id: 'note', name: 'Примечание', type: 'text', required: false, width: 2,
};

function makeFile(name = 'bp.png'): File {
  return new File(['fake'], name, { type: 'image/png' });
}

function renderForm(fields: Field[]) {
  return render(<EntryForm fields={fields} onSave={vi.fn()} onCancel={vi.fn()} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EntryForm photo button', () => {
  it('показывает кнопку «Фото», когда есть поле «ВД / НД / П»', () => {
    renderForm([BP_FIELD, OTHER_FIELD]);
    expect(screen.getByText('Фото')).toBeInTheDocument();
  });

  it('скрывает кнопку «Фото», когда поля нет', () => {
    renderForm([OTHER_FIELD]);
    expect(screen.queryByText('Фото')).not.toBeInTheDocument();
  });

  it('успех: подставляет "120/80/65" в поле и показывает «Готово»', async () => {
    mockRecognize.mockResolvedValue('120/80/65');
    renderForm([BP_FIELD]);
    fireEvent.change(screen.getByLabelText('Фото'), { target: { files: [makeFile()] } });
    await waitFor(() => {
      const input = screen.getByLabelText(/в[дд] \/ н[дд] \/ п/i) as HTMLInputElement;
      expect(input.value).toBe('120/80/65');
      expect(screen.getByText(/готово: 120\/80\/65/i)).toBeInTheDocument();
    });
  });

  it('частичное распознавание: подставляет "120/80"', async () => {
    mockRecognize.mockResolvedValue('120/80');
    renderForm([BP_FIELD]);
    fireEvent.change(screen.getByLabelText('Фото'), { target: { files: [makeFile()] } });
    await waitFor(() => {
      const input = screen.getByLabelText(/в[дд] \/ н[дд] \/ п/i) as HTMLInputElement;
      expect(input.value).toBe('120/80');
    });
  });

  it('мусор: поле не трогает, показывает ошибку распознавания', async () => {
    mockRecognize.mockResolvedValue('zxcvbn');
    renderForm([BP_FIELD]);
    fireEvent.change(screen.getByLabelText('Фото'), { target: { files: [makeFile()] } });
    await waitFor(() => {
      const input = screen.getByLabelText(/в[дд] \/ н[дд] \/ п/i) as HTMLInputElement;
      expect(input.value).toBe('');
      expect(screen.getByText(/не удалось распознать/i)).toBeInTheDocument();
    });
  });

  it('ошибка worker: показывает статус недоступности, поле не трогает', async () => {
    mockRecognize.mockRejectedValue(new Error('worker failed'));
    renderForm([BP_FIELD]);
    fireEvent.change(screen.getByLabelText('Фото'), { target: { files: [makeFile()] } });
    await waitFor(() => {
      expect(screen.getByText(/распознавание недоступно/i)).toBeInTheDocument();
    });
  });

  it('не меняет другие поля формы', async () => {
    mockRecognize.mockResolvedValue('120/80/65');
    renderForm([BP_FIELD, OTHER_FIELD]);
    fireEvent.change(screen.getByLabelText(/примечание/i), { target: { value: 'утро' } });
    fireEvent.change(screen.getByLabelText('Фото'), { target: { files: [makeFile()] } });
    await waitFor(() => {
      const note = screen.getByLabelText(/примечание/i) as HTMLInputElement;
      expect(note.value).toBe('утро');
    });
  });
});
