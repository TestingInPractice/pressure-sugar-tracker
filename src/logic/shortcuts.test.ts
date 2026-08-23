import { describe, expect, it } from 'vitest';
import { buildShortcutsUrl, SHORTCUT_NAME } from './shortcuts';

describe('buildShortcutsUrl', () => {
  it('extracts HH:mm from datetime-local and encodes params', () => {
    const url = buildShortcutsUrl('2026-08-23T07:30');
    expect(url).toBe(
      `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&input=text&text=07%3A30`,
    );
  });

  it('encodes cyrillic shortcut name safely', () => {
    const url = buildShortcutsUrl('2026-08-23T22:05', 'Мой будильник');
    expect(url).not.toMatch(/[А-я]/);
    expect(url).toContain('name=%D0%9C%D0%BE%D0%B9%20');
    expect(url.endsWith('text=22%3A05')).toBe(true);
  });
});
