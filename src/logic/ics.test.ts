import { describe, it, expect } from 'vitest';
import { buildIcs, icsFilename } from './ics';

describe('buildIcs', () => {
  const ics = buildIcs('uid-1', 'Внести измерения: Давление', '2026-08-24T09:00:00');

  it('has calendar skeleton and CRLF endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('\r\n');
  });
  it('contains event with UTC start', () => {
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART:20260824T090000Z');
    expect(ics).toContain('UID:uid-1');
    expect(ics).toContain('SUMMARY:Внести измерения: Давление');
  });
  it('contains zero-trigger alarm', () => {
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:PT0S');
  });
});

describe('icsFilename', () => {
  it('sanitizes cyrillic and spaces', () => {
    expect(icsFilename('Давление и сахар!')).toMatch(/^napominanie-[a-z0-9-]+\.ics$/);
  });
});
