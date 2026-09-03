import { render, screen, fireEvent } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import CreateReportScreen from './CreateReportScreen';
import type { Report } from '../types';

function captured() {
  let value: Report | undefined;
  return { get: () => value, set: (r: Report) => { value = r; } };
}

it('persists a report with default fields and edited name on create', () => {
  const cap = captured();
  render(<CreateReportScreen onCreate={cap.set} onCancel={() => {}} />);
  fireEvent.change(screen.getByLabelText('Название отчёта'), { target: { value: 'Мой трекер' } });
  fireEvent.click(screen.getByRole('button', { name: 'Создать отчёт' }));
  expect(cap.get()?.name).toBe('Мой трекер');
  expect(cap.get()?.fields.length).toBe(5);
  const bp = cap.get()?.fields.find(f => f.name === 'ВД / НД / П');
  expect(bp?.type).toBe('bp');
});

it('falls back to default name when blank', () => {
  const cap = captured();
  render(<CreateReportScreen onCreate={cap.set} onCancel={() => {}} />);
  fireEvent.change(screen.getByLabelText('Название отчёта'), { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Создать отчёт' }));
  expect(cap.get()?.name).toBe('Новый отчёт');
});

it('calls onCancel on back', () => {
  const onCancel = vi.fn();
  render(<CreateReportScreen onCreate={() => {}} onCancel={onCancel} />);
  fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});
