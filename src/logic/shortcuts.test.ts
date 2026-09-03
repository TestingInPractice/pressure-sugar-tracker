import { describe, expect, it } from 'vitest';
import { buildShortcutUrl, buildShortcutUrls, SHORTCUT_NAME } from './shortcuts';

describe('buildShortcutUrl', () => {
  it('encodes a single HH:MM time into the shortcut params', () => {
    expect(buildShortcutUrl('07:30')).toBe(
      `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&input=text&text=07%3A30`,
    );
  });

  it('encodes cyrillic shortcut name safely', () => {
    const url = buildShortcutUrl('22:05', 'Мой будильник');
    expect(url).not.toMatch(/[А-я]/);
    expect(url).toContain('name=%D0%9C%D0%BE%D0%B9%20');
    expect(url.endsWith('text=22%3A05')).toBe(true);
  });
});

describe('buildShortcutUrls', () => {
  it('returns one url per time', () => {
    const urls = buildShortcutUrls(['08:00', '20:00']);
    expect(urls).toHaveLength(2);
    expect(urls[0].endsWith('text=08%3A00')).toBe(true);
    expect(urls[1].endsWith('text=20%3A00')).toBe(true);
  });

  it('returns empty array for no times', () => {
    expect(buildShortcutUrls([])).toEqual([]);
  });
});
