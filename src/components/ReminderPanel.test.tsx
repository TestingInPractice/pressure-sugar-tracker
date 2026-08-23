import { render, screen, fireEvent } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import ReminderPanel from './ReminderPanel';
import type { Report } from '../types';

const baseReport = (reminder?: { enabled: boolean; datetime: string }): Report => ({
  id: 'p1',
  name: 'Отчёт АД',
  fields: [],
  archived: false,
  createdAt: 1,
  updatedAt: 1,
  ...(reminder ? { reminder } : {}),
});

it('opens Shortcuts bridge link with HH:mm on tap', () => {
  let href = '';
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    href = this.href;
  });
  render(
    <ReminderPanel
      report={baseReport({ enabled: true, datetime: new Date('2026-08-23T07:30').toISOString() })}
      masterOn={true}
      onChanged={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Поставить будильник в Часах/ }));
  expect(href.startsWith('shortcuts://run-shortcut?name=')).toBe(true);
  expect(href).toContain(encodeURIComponent('Будильник'));
  expect(href.endsWith('text=07%3A30')).toBe(true);
  clickSpy.mockRestore();
});

it('alarm button is disabled while no time is chosen', () => {
  render(<ReminderPanel report={baseReport()} masterOn={true} onChanged={() => {}} />);
  expect(screen.getByRole('button', { name: /Поставить будильник в Часах/ })).toBeDisabled();
});

it('renders one-time setup recipe in collapsible help', () => {
  render(<ReminderPanel report={baseReport({ enabled: true, datetime: new Date().toISOString() })} masterOn={true} onChanged={() => {}} />);
  expect(screen.getByText(/Как создать команду/)).toBeInTheDocument();
});
