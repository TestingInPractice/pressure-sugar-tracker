import { describe, expect, it } from 'vitest';
import { formatCell, formatBP } from './format';
import type { Field, FieldPart } from '../types';

const dt: Field = { id: 'd', name: 'Дата', type: 'datetime', required: true, width: 30 };
const num: Field = { id: 'n', name: 'Сахар', type: 'number', unit: 'ммоль/л', required: false, width: 30 };

const BP_PARTS: FieldPart[] = [
  { id: 'systolic', label: 'ВД' },
  { id: 'diastolic', label: 'НД' },
  { id: 'pulse', label: 'П' },
];

describe('formatCell', () => {
  it('shortens datetime to DD.MM HH:mm', () => {
    expect(formatCell(dt, '2026-08-23T19:00')).toBe('23.08 19:00');
  });

  it('passes through values without datetime pattern', () => {
    expect(formatCell(dt, 'мусор')).toBe('мусор');
    expect(formatCell(num, '5.6')).toBe('5.6');
  });
});

describe('formatBP', () => {
  it('formats 3 values as sys/dia pulse', () => {
    expect(formatBP({ systolic: 120, diastolic: 80, pulse: 70 }, BP_PARTS)).toBe('120/80 70');
  });
  it('formats 2 values as sys/dia', () => {
    expect(formatBP({ systolic: 120, diastolic: 80 }, BP_PARTS)).toBe('120/80');
  });
  it('renders single value alone', () => {
    expect(formatBP({ pulse: 70 }, BP_PARTS)).toBe('70');
  });
  it('returns empty for no value', () => {
    expect(formatBP(undefined, BP_PARTS)).toBe('');
    expect(formatBP({}, BP_PARTS)).toBe('');
  });
});
