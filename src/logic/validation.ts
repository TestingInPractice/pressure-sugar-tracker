import type { Field } from '../types';

export function validateEntry(
  fields: Field[],
  values: Record<string, string | number>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
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
