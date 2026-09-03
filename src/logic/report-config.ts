import type { Field, Report, Entry } from '../types';
import { MAX_FIELDS, DEFAULT_FIELD_WIDTH } from '../constants';

let seq = 0;
export function genId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export const BP_PARTS = [
  { id: 'systolic', label: 'ВД' },
  { id: 'diastolic', label: 'НД' },
  { id: 'pulse', label: 'П' },
] as const;

function mkField(name: string, type: Field['type'], unit?: string, required = false): Field {
  return { id: genId('fld'), name, type, unit, required, width: DEFAULT_FIELD_WIDTH };
}

export function mkBPField(name = 'ВД / НД / П'): Field {
  return {
    id: genId('fld'),
    name,
    type: 'bp',
    required: false,
    width: DEFAULT_FIELD_WIDTH,
    parts: BP_PARTS.map(({ id, label }) => ({ id, label })),
  };
}

export function makeDefaultFields(): Field[] {
  return [
    mkField('Номер', 'number'),
    mkField('Дата и время', 'datetime', undefined, true),
    mkBPField(),
    mkField('Сахар', 'number', 'ммоль/л'),
    mkField('Примечание', 'text'),
  ];
}

export function createDefaultReport(name = 'Новый отчёт', fields = makeDefaultFields()): Report {
  const now = Date.now();
  return {
    id: genId('rep'),
    name,
    fields,
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
