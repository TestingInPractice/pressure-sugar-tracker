import { describe, it, expect } from 'vitest';
import { buildIcs, icsFilename } from './ics';

describe('buildIcs', () => {
  const ics = buildIcs('Внести измерения: Давление', ['09:00', '20:30'], '2026-08-24');

  it('has calendar skeleton and CRLF endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('\r\n');
  });

  it('emits one daily-recurring event per time with local wall-clock DTSTART', () => {
    const count = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(count).toBe(2);
    expect(ics).toContain('DTSTART:20260824T090000');
    expect(ics).toContain('DTSTART:20260824T203000');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('SUMMARY:Внести измерения: Давление');
  });

  it('contains zero-trigger alarm in each event', () => {
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:PT0S');
  });
});

describe('icsFilename', () => {
  it('produces stable .ics filename', () => {
    expect(icsFilename('Давление')).toMatch(/^napominanie-\d+\.ics$/);
  });
});
