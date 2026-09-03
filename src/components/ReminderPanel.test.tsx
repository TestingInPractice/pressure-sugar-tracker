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

it('opens a Shortcuts bridge link for each configured time', () => {
  const hrefs: string[] = [];
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    hrefs.push(this.href);
  });
  render(
    <ReminderPanel
      report={baseReport({ enabled: true, times: ['07:30', '20:00'] })}
      masterOn={true}
      onChanged={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Поставить будильник в Часах/ }));
  expect(hrefs).toHaveLength(2);
  expect(hrefs[0].startsWith('shortcuts://run-shortcut?name=')).toBe(true);
  expect(hrefs[0]).toContain(encodeURIComponent('Будильник'));
  expect(hrefs[0].endsWith('text=07%3A30')).toBe(true);
  expect(hrefs[1].endsWith('text=20%3A00')).toBe(true);
  clickSpy.mockRestore();
});

it('alarm and calendar buttons are disabled while no time is set', () => {
  render(<ReminderPanel report={baseReport({ enabled: true, times: [] })} masterOn={true} onChanged={() => {}} />);
  expect(screen.getByRole('button', { name: /Поставить будильник в Часах/ })).toBeDisabled();
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

it('renders one-time setup recipe in collapsible help', () => {
  render(<ReminderPanel report={baseReport({ enabled: true, times: ['08:00'] })} masterOn={true} onChanged={() => {}} />);
  expect(screen.getByText(/Как создать команду/)).toBeInTheDocument();
});
