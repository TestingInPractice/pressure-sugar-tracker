import { describe, expect, it } from 'vitest';
import { formatCell } from './format';
import type { Field } from '../types';

const dt: Field = { id: 'd', name: 'Дата', type: 'datetime', required: true, width: 30 };
const num: Field = { id: 'n', name: 'Сахар', type: 'number', unit: 'ммоль/л', required: false, width: 30 };

describe('formatCell', () => {
  it('shortens datetime to DD.MM HH:mm', () => {
    expect(formatCell(dt, '2026-08-23T19:00')).toBe('23.08 19:00');
  });

  it('passes through values without datetime pattern', () => {
    expect(formatCell(dt, 'мусор')).toBe('мусор');
    expect(formatCell(num, '5.6')).toBe('5.6');
  });
});
