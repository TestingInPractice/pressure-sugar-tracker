import { render, screen, fireEvent } from '@testing-library/react';
import { it, expect, beforeEach } from 'vitest';
import App from './App';
import { db, putReport } from './db/db';

beforeEach(async () => { await db.delete(); await db.open(); });

it('renders app title', async () => {
  render(<App />);
  expect(screen.getByText('Трекер давления и сахара')).toBeInTheDocument();
  for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
});

it('shows offline pill when navigator.onLine is false', async () => {
  Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
  render(<App />);
  expect(screen.getByText('Офлайн')).toBeInTheDocument();
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
});

it('does not show offline pill when online', async () => {
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
  render(<App />);
  expect(screen.queryByText('Офлайн')).not.toBeInTheDocument();
});

it('tabbar stays visible on report screen and tabs navigate back', async () => {
  await putReport({ id: 'p1', name: 'A', fields: [], archived: false, createdAt: 1, updatedAt: 1 });
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Отчёты' }));
  fireEvent.click(await screen.findByRole('button', { name: 'A' }));
  await screen.findByRole('button', { name: '← Назад' });
  for (const t of ['Главная', 'Отчёты', 'Архив', 'Ещё']) {
    expect(screen.getByRole('button', { name: t })).toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Архив' }));
  expect(screen.queryByRole('button', { name: '← Назад' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Архив', })).toHaveAttribute('aria-current', 'true');
});
