import { describe, expect, it } from 'vitest';
import { numberingFieldId, nextEntryNumber } from './entry-number';
import type { Field, Entry } from '../types';

const mk = (name: string, type: Field['type']): Field =>
  ({ id: `f-${name}`, name, type, required: false, width: 30 });

let seq = 0;
const e = (v: string | number | undefined): Entry =>
  ({ id: `x${++seq}`, reportId: 'r', values: { 'f-Номер': v as string | number }, createdAt: 0 });

describe('numberingFieldId', () => {
  it('finds number field named Номер', () => {
    expect(numberingFieldId([mk('Номер', 'number'), mk('Дата и время', 'datetime')])).toBe('f-Номер');
  });
  it('ignores non-number and unrelated fields', () => {
    expect(numberingFieldId([mk('Дата и время', 'datetime'), mk('Сахар', 'number')])).toBeUndefined();
  });
});

describe('nextEntryNumber', () => {
  it('starts at 1 for empty list', () => {
    expect(nextEntryNumber([], 'f-Номер')).toBe(1);
  });
  it('continues after max, ignoring gaps and junk', () => {
    expect(nextEntryNumber([e(1), e('2'), e('5'), e('abc'), e('')], 'f-Номер')).toBe(6);
  });
  it('returns undefined without numbering field', () => {
    expect(nextEntryNumber([e(1)], undefined)).toBeUndefined();
  });
});
