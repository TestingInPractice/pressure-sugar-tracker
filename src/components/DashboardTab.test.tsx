import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { it, expect, beforeEach, vi } from 'vitest';
import DashboardTab from './DashboardTab';
import { db, putReport, putEntry } from '../db/db';
import type { Field } from '../types';

const bpField: Field = {
  id: 'bp1', name: 'ВД / НД / П', type: 'bp', required: false, width: 30,
  parts: [{ id: 'systolic', label: 'ВД' }, { id: 'diastolic', label: 'НД' }, { id: 'pulse', label: 'П' }],
};
const sugarField: Field = { id: 's1', name: 'Сахар', type: 'number', unit: 'ммоль/л', required: false, width: 30 };
const dtField: Field = { id: 'd1', name: 'Дата и время', type: 'datetime', required: true, width: 30 };

beforeEach(async () => { await db.delete(); await db.open(); });

it('shows empty state with single CTA when no reports', async () => {
  const onCreate = vi.fn();
  render(<DashboardTab onCreate={onCreate} />);
  expect(await screen.findByText('Начните отслеживать показатели')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Новый отчёт' }));
  expect(onCreate).toHaveBeenCalledTimes(1);
});

it('quick-add opens bottom sheet with prefilled datetime and last values', async () => {
  await putReport({ id: 'r1', name: 'Давление', fields: [bpField, sugarField, dtField], archived: false, createdAt: 1, updatedAt: 1 });
  await putEntry({ id: 'e1', reportId: 'r1', values: { bp1: { systolic: 120, diastolic: 80 }, s1: 5.5, d1: '2026-08-20T10:00' }, createdAt: 1 });
  render(<DashboardTab onCreate={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Добавить запись в Давление' }));
  // Bottom sheet should be visible with prefilled values
  expect(await screen.findByText('Давление', { selector: '.bottom-sheet__title' })).toBeInTheDocument();
  expect(screen.getByLabelText(/^ВД/)).toHaveValue('120');
  expect(screen.getByLabelText(/^НД/)).toHaveValue('80');
  expect(screen.getByLabelText(/Сахар/)).toHaveValue('5.5');
  const dtVal = (screen.getByLabelText(/Дата и время/) as HTMLInputElement).value;
  expect(dtVal).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

it('quick-add saves a new entry', async () => {
  await putReport({ id: 'r1', name: 'Давление', fields: [bpField, dtField], archived: false, createdAt: 1, updatedAt: 1 });
  render(<DashboardTab onCreate={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Добавить запись в Давление' }));
  await screen.findByText('Давление', { selector: '.bottom-sheet__title' });
  fireEvent.change(screen.getByLabelText(/^ВД/), { target: { value: '130' } });
  fireEvent.change(screen.getByLabelText(/^НД/), { target: { value: '85' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(async () => {
    const rows = await db.entries.where('reportId').equals('r1').toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].values.bp1).toEqual({ systolic: '130', diastolic: '85' });
  });
  expect(await screen.findByText('Запись сохранена')).toBeInTheDocument();
});

it('shows backup row with date when last-backup-at is set', async () => {
  const backupDate = '2026-09-01T12:00:00.000Z';
  localStorage.setItem('last-backup-at', backupDate);
  await putReport({ id: 'r1', name: 'Давление', fields: [bpField, dtField], archived: false, createdAt: 1, updatedAt: 1 });
  render(<DashboardTab onCreate={() => {}} onGoMore={() => {}} />);
  await screen.findByLabelText('Отчёт для графика');
  const row = document.querySelector('.backup-row');
  expect(row).not.toBeNull();
  expect(row!.textContent).toContain('Бэкап');
  expect(row!.textContent).toContain('01.09.2026');
});

it('calls onGoMore when backup row button is clicked', async () => {
  const onGoMore = vi.fn();
  await putReport({ id: 'r1', name: 'Давление', fields: [bpField, dtField], archived: false, createdAt: 1, updatedAt: 1 });
  render(<DashboardTab onCreate={() => {}} onGoMore={onGoMore} />);
  await screen.findByLabelText('Отчёт для графика');
  fireEvent.click(screen.getByRole('button', { name: 'Настроить' }));
  expect(onGoMore).toHaveBeenCalledTimes(1);
});

it('hides backup row when onGoMore is not provided', async () => {
  await putReport({ id: 'r1', name: 'Давление', fields: [bpField, dtField], archived: false, createdAt: 1, updatedAt: 1 });
  render(<DashboardTab onCreate={() => {}} />);
  await screen.findByLabelText('Отчёт для графика');
  expect(document.querySelector('.backup-row')).toBeNull();
});

const seedChartReports = async () => {
  await putReport({ id: 'r1', name: 'Давление', fields: [bpField, sugarField, dtField], archived: false, createdAt: 1, updatedAt: 1 });
  await putReport({ id: 'r2', name: 'Сахар', fields: [sugarField, dtField], archived: false, createdAt: 2, updatedAt: 2 });
  await putEntry({ id: 'e1', reportId: 'r1', values: { bp1: { systolic: 120, diastolic: 80, pulse: 70 }, s1: 5.0, d1: '2026-08-20T10:00' }, createdAt: 1 });
  await putEntry({ id: 'e2', reportId: 'r1', values: { bp1: { systolic: 130, diastolic: 85, pulse: 72 }, s1: 6.0, d1: '2026-08-21T10:00' }, createdAt: 2 });
  await putEntry({ id: 'e3', reportId: 'r2', values: { s1: 5.5, d1: '2026-08-20T10:00' }, createdAt: 3 });
};

const dashChartCircles = (dashed: boolean) =>
  Array.from(document.querySelectorAll('.dash-chart circle'))
    .filter(c => (c.getAttribute('stroke-dasharray') !== null) === dashed);

it('chart defaults to pressure with solid sys and dashed dia lines', async () => {
  await seedChartReports();
  render(<DashboardTab onCreate={() => {}} />);
  await screen.findByText('Верхнее');
  expect(screen.getByText('Нижнее')).toBeInTheDocument();
  expect(dashChartCircles(false)).toHaveLength(2);
  expect(dashChartCircles(true)).toHaveLength(2);
});

it('chart switches to pulse on metric change', async () => {
  await seedChartReports();
  render(<DashboardTab onCreate={() => {}} />);
  await screen.findByText('Верхнее');
  fireEvent.click(screen.getByRole('button', { name: 'Пульс' }));
  expect(await screen.findByText('Пульс', { selector: '.trend-chart__legend-item' })).toBeInTheDocument();
  expect(screen.queryByText('Нижнее')).toBeNull();
  expect(dashChartCircles(false)).toHaveLength(2);
});

it('chart switches data on report change', async () => {
  await seedChartReports();
  render(<DashboardTab onCreate={() => {}} />);
  await screen.findByText('Верхнее');
  fireEvent.change(screen.getByLabelText('Отчёт для графика'), { target: { value: 'r2' } });
  expect(await screen.findByText(/нет данных «Давление»/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Сахар' }));
  expect(await screen.findByText('Сахар', { selector: '.trend-chart__legend-item' })).toBeInTheDocument();
  expect(document.querySelectorAll('.dash-chart circle')).toHaveLength(1);
});

it('disables sugar metric when report has no sugar field', async () => {
  await putReport({ id: 'r1', name: 'Давление', fields: [bpField, dtField], archived: false, createdAt: 1, updatedAt: 1 });
  await putEntry({ id: 'e1', reportId: 'r1', values: { bp1: { systolic: 120, diastolic: 80 }, d1: '2026-08-20T10:00' }, createdAt: 1 });
  render(<DashboardTab onCreate={() => {}} />);
  await screen.findByText('Верхнее');
  expect(screen.getByRole('button', { name: 'Сахар' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Пульс' })).not.toBeDisabled();
});

it('chart shows last 10 same-day readings as separate points', async () => {
  await putReport({ id: 'r1', name: 'Давление', fields: [bpField, dtField], archived: false, createdAt: 1, updatedAt: 1 });
  for (let i = 0; i < 12; i++) {
    await putEntry({
      id: `e${i}`, reportId: 'r1',
      values: { bp1: { systolic: 120 + i, diastolic: 80 }, d1: `2026-08-20T${String(i).padStart(2, '0')}:00` },
      createdAt: i,
    });
  }
  render(<DashboardTab onCreate={() => {}} />);
  await screen.findByText('Верхнее');
  expect(document.querySelectorAll('.dash-chart circle')).toHaveLength(20);
});

it('chart shows target lines when targets set and toggle on', async () => {
  await putReport({
    id: 'r1', name: 'Давление', fields: [bpField, dtField], archived: false, createdAt: 1, updatedAt: 1,
    targets: { sys: 120, dia: 80 },
  });
  await putEntry({ id: 'e1', reportId: 'r1', values: { bp1: { systolic: 130, diastolic: 85 }, d1: '2026-08-20T10:00' }, createdAt: 1 });
  render(<DashboardTab onCreate={() => {}} />);
  await screen.findByText('Верхнее');
  expect(document.querySelectorAll('.dash-chart [data-target]')).toHaveLength(2);
  fireEvent.click(screen.getByLabelText('Норма на графике'));
  expect(document.querySelectorAll('.dash-chart [data-target]')).toHaveLength(0);
  expect(localStorage.getItem('chart-show-targets')).toBe('0');
});

it('chart shows no target lines when targets unset', async () => {
  await putReport({ id: 'r1', name: 'Давление', fields: [bpField, dtField], archived: false, createdAt: 1, updatedAt: 1 });
  await putEntry({ id: 'e1', reportId: 'r1', values: { bp1: { systolic: 130, diastolic: 85 }, d1: '2026-08-20T10:00' }, createdAt: 1 });
  render(<DashboardTab onCreate={() => {}} />);
  await screen.findByText('Верхнее');
  expect(document.querySelectorAll('.dash-chart [data-target]')).toHaveLength(0);
});
