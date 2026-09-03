import type { Field, BPValues, Entry } from '../types';

export function validateEntry(
  fields: Field[],
  values: Entry['values'],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.type === 'bp') {
      const obj = (values[field.id] ?? {}) as Partial<BPValues>;
      const parts = field.parts ?? [];
      const raw: Record<string, unknown> = {};
      for (const p of parts) raw[p.id] = obj[p.id as keyof typeof obj];
      const hasAny = parts.some(p => raw[p.id] !== undefined && String(raw[p.id]).trim() !== '');
      if (field.required && !hasAny) {
        errors[field.id] = 'Обязательное поле';
        continue;
      }
      if (!hasAny) continue;
      for (const p of parts) {
        const v = raw[p.id];
        if (v === undefined || String(v).trim() === '') continue;
        if (!Number.isFinite(Number(v))) errors[field.id] = `Введите число (${p.label})`;
      }
      continue;
    }
    const raw = values[field.id];
    const isEmpty =
      raw === undefined || raw === null || String(raw).trim() === '';
    if (field.required && isEmpty) {
      errors[field.id] = 'Обязательное поле';
      continue;
    }
    if (isEmpty) continue;
    if (field.type === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n)) errors[field.id] = 'Введите число';
    }
  }
  return errors;
}
