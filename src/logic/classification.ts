/**
 * Классификация показателей давления и сахара.
 * Цветовые пороги:
 *   - Зелёный (green):  норма
 *   - Жёлтый (yellow): повышен / пограничное
 *   - Красный (red):    высокий / критический
 */

import type { BPValues } from '../types';

export type StatusColor = 'green' | 'yellow' | 'red';

/** Определить поле BP в массиве полей по типу 'bp' или имени, содержащему 'ВД'. */
export function isBPFieldName(name: string): boolean {
  return name.includes('ВД');
}

/** Определить поле сахара в массиве полей: тип number и (имя содержит 'сахар' или единица 'ммоль'). */
export function isSugarField(name: string, unit?: string): boolean {
  const n = name.toLowerCase();
  const u = (unit ?? '').toLowerCase();
  return n.includes('сахар') || u.includes('ммоль');
}

/**
 * Классифицировать давление по систолическому и диастолическому.
 * Пороги (жёлтый = пограничное, красный = высокое):
 *   Систолическое:  ≥140 → red, ≥120 → yellow, <120 → green
 *   Диастолическое: ≥90  → red, ≥80  → yellow, <80  → green
 * Общий статус = худший из двух.
 */
export function classifyBP(bp: BPValues | undefined): StatusColor {
  if (!bp) return 'green';
  const sys = Number(bp.systolic);
  const dia = Number(bp.diastolic);
  const sysColor: StatusColor =
    !Number.isFinite(sys) ? 'green' :
    sys >= 140 ? 'red' :
    sys >= 120 ? 'yellow' : 'green';
  const diaColor: StatusColor =
    !Number.isFinite(dia) ? 'green' :
    dia >= 90 ? 'red' :
    dia >= 80 ? 'yellow' : 'green';
  return worstColor(sysColor, diaColor);
}

/**
 * Классифицировать сахар.
 * Пороги (ммоль/л):
 *   ≥7.0 → red, ≥5.5 → yellow, <5.5 → green
 */
export function classifySugar(value: string | number | BPValues | undefined): StatusColor {
  if (value === undefined || value === null || value === '') return 'green';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'green';
  if (n >= 7.0) return 'red';
  if (n >= 5.5) return 'yellow';
  return 'green';
}

function worstColor(a: StatusColor, b: StatusColor): StatusColor {
  if (a === 'red' || b === 'red') return 'red';
  if (a === 'yellow' || b === 'yellow') return 'yellow';
  return 'green';
}
