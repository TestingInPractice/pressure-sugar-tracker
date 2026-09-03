function localStamp(time: string, day: string): string {
  const d = new Date(`${day}T${time}:00`);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function eventLines(uid: string, title: string, startStamp: string): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    'DTSTAMP:20260101T000000Z',
    `DTSTART:${startStamp}`,
    'RRULE:FREQ=DAILY',
    'DURATION:PT5M',
    `SUMMARY:${esc(title)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(title)}`,
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
  ];
}

/** Строит .ics с ежедневным повторением (RRULE FREQ=DAILY) для каждого времени. */
export function buildIcs(title: string, times: string[], day: string): string {
  const events = times.map((time, i) => eventLines(`${i + 1}-${esc(title)}`, title, localStamp(time, day)).join('\r\n'));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//pressure-sugar-tracker//RU', ...events, 'END:VCALENDAR'].join('\r\n') + '\r\n';
}

export function icsFilename(_name: string): string {
  return `napominanie-${Date.now()}.ics`;
}
