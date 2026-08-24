import type { Entry, Field } from '../types';

/** Поле автонумерации строк — числовое поле, имя которого начинается со «Номер» */
export function numberingFieldId(fields: Field[]): string | undefined {
  return fields.find(f => f.type === 'number' && f.name.trim().toLowerCase().startsWith('номер'))?.id;
}

/**
 * Следующий номер строки: максимум среди существующих значений + 1.
 * Пробелы и не-числа игнорируются; без поля автонумерации вернёт undefined.
 */
export function nextEntryNumber(entries: Entry[], fieldId: string | undefined): number | undefined {
  if (!fieldId) return undefined;
  const nums = entries
    .map(en => Number.parseInt(String(en.values[fieldId] ?? ''), 10))
    .filter(n => Number.isFinite(n));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}
