import { render, screen, fireEvent } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import ReminderPanel from './ReminderPanel';
import type { Report } from '../types';

const baseReport = (reminder?: { enabled: boolean; times: string[] }): Report => ({
  id: 'p1',
  name: 'Отчёт АД',
  fields: [],
  archived: false,
  createdAt: 1,
  updatedAt: 1,
  ...(reminder ? { reminder } : {}),
});

it('shows inline master-gate warning when master is OFF', () => {
  render(
    <ReminderPanel
      report={baseReport({ enabled: true, times: ['08:00'] })}
      masterOn={false}
      onChanged={() => {}}
    />,
  );
  expect(screen.getByText(/Рубильник напоминаний выключен/)).toBeInTheDocument();
});

it('calls onEnableMaster when gate warning button is clicked', () => {
  const onEnable = vi.fn();
  render(
    <ReminderPanel
      report={baseReport({ enabled: true, times: ['08:00'] })}
      masterOn={false}
      onChanged={() => {}}
      onEnableMaster={onEnable}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Включить напоминания/ }));
  expect(onEnable).toHaveBeenCalledTimes(1);
});

it('does not show gate warning when master is ON', () => {
  render(
    <ReminderPanel
      report={baseReport({ enabled: true, times: ['08:00'] })}
      masterOn={true}
      onChanged={() => {}}
    />,
  );
  expect(screen.queryByText(/Рубильник напоминаний выключен/)).not.toBeInTheDocument();
});

it('calendar button is disabled while no time is set', () => {
  render(<ReminderPanel report={baseReport({ enabled: true, times: [] })} masterOn={true} onChanged={() => {}} />);
  expect(screen.getByRole('button', { name: /Добавить в Календарь/ })).toBeDisabled();
});

it('adds a new time row via the add button', () => {
  const { container } = render(
    <ReminderPanel report={baseReport({ enabled: true, times: ['08:00'] })} masterOn={true} onChanged={() => {}} />,
  );
  const before = container.querySelectorAll('input[type="time"]').length;
  fireEvent.click(screen.getByRole('button', { name: /Добавить время/ }));
  const after = container.querySelectorAll('input[type="time"]').length;
  expect(after).toBe(before + 1);
});

it('suggests setting the alarm manually in the Clock app', () => {
  render(<ReminderPanel report={baseReport({ enabled: true, times: ['08:00'] })} masterOn={true} onChanged={() => {}} />);
  expect(screen.getByText(/установите его вручную в «Часах»/)).toBeInTheDocument();
  expect(screen.getByText(/подпишите «Давление»/)).toBeInTheDocument();
});
