export interface PressureReading {
  sys: number | null;
  dia: number | null;
  pulse: number | null;
}

const OCR_DIGIT_MAP: Record<string, string> = {
  O: '0', o: '0', Q: '0',
  I: '1', l: '1', '|': '1',
  S: '5', s: '5',
  B: '8', b: '8',
  Z: '2', z: '2',
};

const RANGES = {
  sys: { min: 60, max: 250 },
  dia: { min: 40, max: 150 },
  pulse: { min: 30, max: 220 },
} as const;

const escapeRegExp = (ch: string): string => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Собираем regex из ключей карты, чтобы карта и regex не расходились.
const OCR_DIGIT_PATTERN = new RegExp(
  Object.keys(OCR_DIGIT_MAP).map(escapeRegExp).join('|'),
  'g',
);

const normalize = (raw: string): string =>
  raw.replace(OCR_DIGIT_PATTERN, ch => OCR_DIGIT_MAP[ch] ?? ch);

export function parsePressureText(raw: string): PressureReading {
  const numbers = (normalize(raw).match(/\d{2,3}/g) ?? []).map(Number);
  const result: PressureReading = { sys: null, dia: null, pulse: null };
  for (const n of numbers) {
    if (result.sys === null && n >= RANGES.sys.min && n <= RANGES.sys.max) {
      result.sys = n;
    } else if (result.dia === null && n >= RANGES.dia.min && n <= RANGES.dia.max) {
      result.dia = n;
    } else if (result.pulse === null && n >= RANGES.pulse.min && n <= RANGES.pulse.max) {
      result.pulse = n;
    }
  }
  return result;
}

export function formatPressureReading(r: PressureReading): string {
  return [r.sys, r.dia, r.pulse].filter((v): v is number => v !== null).join('/');
}