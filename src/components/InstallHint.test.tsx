import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import InstallHint from './InstallHint';

const DISMISS_KEY = 'install-hint-dismissed';

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window.navigator, 'standalone', { value: undefined, writable: true, configurable: true });
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q: string) => ({
    matches: false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('shows iOS copy when not installed and on iOS', () => {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    writable: true,
    configurable: true,
  });
  render(<InstallHint />);
  expect(screen.getByText(/Установить на iPhone/)).toBeInTheDocument();
  expect(screen.getByText(/Поделиться/)).toBeInTheDocument();
});

it('hides when already dismissed', () => {
  localStorage.setItem(DISMISS_KEY, '1');
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    writable: true,
    configurable: true,
  });
  const { container } = render(<InstallHint />);
  expect(container.querySelector('.install-hint')).toBeNull();
});

it('dismisses and persists flag', () => {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    writable: true,
    configurable: true,
  });
  render(<InstallHint />);
  fireEvent.click(screen.getByRole('button', { name: /Закрыть подсказку/ }));
  expect(localStorage.getItem(DISMISS_KEY)).toBe('1');
  expect(screen.queryByText(/Установить на iPhone/)).not.toBeInTheDocument();
});

it('hides when navigator.standalone is true (installed)', () => {
  Object.defineProperty(window.navigator, 'standalone', { value: true, writable: true, configurable: true });
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    writable: true,
    configurable: true,
  });
  const { container } = render(<InstallHint />);
  expect(container.querySelector('.install-hint')).toBeNull();
});

it('hides when display-mode standalone matches', () => {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q: string) => ({
    matches: q === '(display-mode: standalone)',
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    writable: true,
    configurable: true,
  });
  const { container } = render(<InstallHint />);
  expect(container.querySelector('.install-hint')).toBeNull();
});
