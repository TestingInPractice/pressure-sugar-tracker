import { it, expect } from 'vitest';
import { makeDefaultFields, createDefaultReport, stripRemovedFieldValues, assertFieldsLimit, genId } from './report-config';

it('default template matches spec', () => {
  const fields = makeDefaultFields();
  expect(fields.map(f => f.name)).toEqual(['№', 'Дата и время', 'ВД / НД / П', 'Сахар', 'Примечание']);
  expect(fields.find(f => f.name === 'Сахар')?.unit).toBeUndefined();
  expect(fields.find(f => f.name === 'Примечание')?.width).toBeLessThan(30);
  expect(fields.filter(f => f.name !== 'Примечание').every(f => f.width === 30)).toBe(true);
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

it('genId emits unique UUID-based ids across prefixes and repetitions', () => {
  const ids = new Set<string>();
  for (let i = 0; i < 5000; i += 1) {
    ids.add(genId(i % 2 === 0 ? 'rep' : 'ent'));
  }
  expect(ids.size).toBe(5000);
  expect([...ids][0]).toMatch(/^(rep|ent)-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
