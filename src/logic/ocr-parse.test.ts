import { describe, it, expect } from 'vitest';
import { parsePressureText, formatPressureReading } from './ocr-parse';

describe('parsePressureText', () => {
  it('возвращает null-ы на пустом и мусорном вводе', () => {
    expect(parsePressureText('')).toEqual({ sys: null, dia: null, pulse: null });
    expect(parsePressureText('abc def ghi')).toEqual({ sys: null, dia: null, pulse: null });
    expect(parsePressureText('12 8')).toEqual({ sys: null, dia: null, pulse: null }); // 12<60, 8<30
  });

  it('разбирает "120/80/65" и срезает единицы измерения', () => {
    expect(parsePressureText('120/80/65')).toEqual({ sys: 120, dia: 80, pulse: 65 });
    expect(parsePressureText('120/80/65 mmHg')).toEqual({ sys: 120, dia: 80, pulse: 65 });
  });

  it('чинит типичные OCR-ошибки O/I/S/B/Z', () => {
    expect(parsePressureText('1Z0 8O 65')).toEqual({ sys: 120, dia: 80, pulse: 65 });
    expect(parsePressureText('l20/BI/6S')).toEqual({ sys: 120, dia: 81, pulse: 65 });
  });

  it('поддерживает разделители "/", "-", пробел', () => {
    expect(parsePressureText('120-80-65')).toEqual({ sys: 120, dia: 80, pulse: 65 });
    expect(parsePressureText('120 80 65')).toEqual({ sys: 120, dia: 80, pulse: 65 });
  });

  it('частичное распознавание: пульс/диастола отсутствуют', () => {
    expect(parsePressureText('120/80')).toEqual({ sys: 120, dia: 80, pulse: null });
    expect(parsePressureText('120')).toEqual({ sys: 120, dia: null, pulse: null });
    expect(parsePressureText('80 65')).toEqual({ sys: 80, dia: 65, pulse: null });
  });

  it('числа вне диапазонов отбрасываются, не съедая слоты', () => {
    expect(parsePressureText('120/300/65')).toEqual({ sys: 120, dia: 65, pulse: null }); // 300>150 — отброшено, слот dia заняла 65
    expect(parsePressureText('120/80/999')).toEqual({ sys: 120, dia: 80, pulse: null });
    expect(parsePressureText('300/120/80/65')).toEqual({ sys: 120, dia: 80, pulse: 65 });
  });
});

describe('formatPressureReading', () => {
  it('форматирует полные/частичные/pустые значения', () => {
    expect(formatPressureReading({ sys: 120, dia: 80, pulse: 65 })).toBe('120/80/65');
    expect(formatPressureReading({ sys: 120, dia: 80, pulse: null })).toBe('120/80');
    expect(formatPressureReading({ sys: 120, dia: null, pulse: null })).toBe('120');
    expect(formatPressureReading({ sys: 120, dia: 80, pulse: 65 })).toBe('120/80/65');
  });
});