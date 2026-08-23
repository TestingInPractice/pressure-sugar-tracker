import type { Field, Report, Entry } from '../types';
import { MAX_FIELDS, DEFAULT_FIELD_WIDTH } from '../constants';

let seq = 0;
export function genId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

function mkField(name: string, type: Field['type'], unit?: string, required = false): Field {
  return { id: genId('fld'), name, type, unit, required, width: DEFAULT_FIELD_WIDTH };
}

export function makeDefaultFields(): Field[] {
  return [
    mkField('Номер', 'number'),
    mkField('Дата и время', 'datetime', undefined, true),
    mkField('Давление', 'number', 'мм рт.ст.'),
    mkField('Сахар', 'number', 'ммоль/л'),
    mkField('Примечание', 'text'),
  ];
}

export function createDefaultReport(): Report {
  const now = Date.now();
  return {
    id: genId('rep'),
    name: 'Новый отчёт',
    fields: makeDefaultFields(),
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function stripRemovedFieldValues(entries: Entry[], keptFieldIds: Set<string>): Entry[] {
  return entries.map(e => ({
    ...e,
    values: Object.fromEntries(Object.entries(e.values).filter(([k]) => keptFieldIds.has(k))),
  }));
}

export function assertFieldsLimit(count: number): void {
  if (count > MAX_FIELDS) throw new Error(`Максимум полей: ${MAX_FIELDS}`);
}
