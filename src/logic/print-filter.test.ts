import { describe, expect, it } from 'vitest';
import { datetimeFieldId, filterByRange } from './print-filter';
import type { Field, Entry } from '../types';

const dt: Field = { id: 'd1', name: 'Дата и время', type: 'datetime', required: true, width: 30 };
const otherDt: Field = { id: 'd2', name: 'Вторая дата', type: 'datetime', required: false, width: 30 };
const num: Field = { id: 'n1', name: 'Сахар', type: 'number', required: false, width: 30 };

const e = (id: string, v: string | number): Entry => ({ id, reportId: 'r', values: { d1: v }, createdAt: 0 });

describe('datetimeFieldId', () => {
  it('returns first datetime field id', () => {
    expect(datetimeFieldId([num, otherDt, dt])).toBe('d2');
  });
  it('returns undefined without datetime fields', () => {
    expect(datetimeFieldId([num])).toBeUndefined();
  });
});

describe('filterByRange', () => {
  const entries = [
    e('a', '2026-08-01T09:00'),
    e('b', '2026-08-23T19:00'),
    e('c', '2026-09-15T12:30'),
  ];

  it('keeps inclusive bounds on both sides', () => {
    const out = filterByRange(entries, 'd1', { from: '2026-08-01', to: '2026-08-23' });
    expect(out.map(x => x.id)).toEqual(['a', 'b']);
  });

  it('supports one-sided ranges', () => {
    expect(filterByRange(entries, 'd1', { from: '2026-09-01' }).map(x => x.id)).toEqual(['c']);
    expect(filterByRange(entries, 'd1', { to: '2026-08-23' }).map(x => x.id)).toEqual(['a', 'b']);
  });

  it('returns everything without field, range or bounds', () => {
    expect(filterByRange(entries, undefined, { from: '2026-09-01' })).toBe(entries);
    expect(filterByRange(entries, 'd1', null)).toBe(entries);
    expect(filterByRange(entries, 'd1', {})).toBe(entries);
  });

  it('excludes entries without valid datetime value when filtering', () => {
    expect(filterByRange([e('x', ''), e('y', 120)], 'd1', { from: '2026-01-01' }).map(x => x.id)).toEqual([]);
  });
});
