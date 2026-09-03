import { it, expect } from 'vitest';
import { makeDefaultFields, createDefaultReport, stripRemovedFieldValues, assertFieldsLimit } from './report-config';

it('default template matches spec', () => {
  const fields = makeDefaultFields();
  expect(fields.map(f => f.name)).toEqual(['Номер', 'Дата и время', 'ВД / НД / П', 'Сахар', 'Примечание']);
  expect(fields.every(f => f.width === 30)).toBe(true);
  const dt = fields.find(f => f.type === 'datetime')!;
  expect(dt.required).toBe(true);
  const pressure = fields.find(f => f.name === 'ВД / НД / П')!;
  expect(pressure.type).toBe('bp');
  expect(pressure.parts?.map(p => p.label)).toEqual(['ВД', 'НД', 'П']);
});

it('creates draft report', () => {
  const r = createDefaultReport();
  expect(r.archived).toBe(false);
  expect(r.fields.length).toBe(5);
});

it('strips values of removed fields', () => {
  const entries = [
    { id: 'e1', reportId: 'r', values: { a: 1, b: 2 }, createdAt: 0 },
  ];
  const out = stripRemovedFieldValues(entries, new Set(['b']));
  expect(out[0].values).toEqual({ b: 2 });
});

it('enforces field limit', () => {
  expect(() => assertFieldsLimit(11)).toThrow(/10/);
  expect(() => assertFieldsLimit(10)).not.toThrow();
});
