import type { Entry, Field } from '../types';

export interface DateRange { from?: string; to?: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Первый в отчёте датник — по нему фильтруем период печати */
export function datetimeFieldId(fields: Field[]): string | undefined {
  return fields.find(f => f.type === 'datetime')?.id;
}

/**
 * Оставляет записи, чья дата (первые 10 символов значения датника,
 * формат YYYY-MM-DD) попадает в диапазон включительно.
 * Без поля/диапазона/границ возвращает список как есть.
 */
export function filterByRange(entries: Entry[], fieldId: string | undefined, range: DateRange | null | undefined): Entry[] {
  if (!fieldId || !range || (!range.from && !range.to)) return entries;
  return entries.filter(e => {
    const v = e.values[fieldId];
    if (typeof v !== 'string') return false;
    const d = v.slice(0, 10);
    if (!DATE.test(d)) return false;
    return (!range.from || d >= range.from) && (!range.to || d <= range.to);
  });
}
