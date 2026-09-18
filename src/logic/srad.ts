/**
 * СрАд (среднее артериальное давление) — расчёт и классификация.
 * Формула: СрАд = (САД + 2×ДАД)/3 — стандартная клиническая оценка MAP.
 * Классификация: <70 гипотония, 70–110 нормотония, >110 гипертония.
 * Независима от classifyBP: это отдельная классификация по среднему давлению.
 */

import type { BPValues } from '../types';
import type { StatusColor } from './classification';

export type SradCategory = 'hypotension' | 'normotension' | 'hypertension';

/** СрАд = (САД + 2×ДАД)/3, округление до целого. undefined при отсутствии/нечисловых значениях. */
export function computeSrad(bp: BPValues | undefined): number | undefined {
  if (!bp) return undefined;
  const sys = bp.systolic;
  const dia = bp.diastolic;
  if (sys === undefined || dia === undefined) return undefined;
  if (String(sys).trim() === '' || String(dia).trim() === '') return undefined;
  const sysN = Number(sys);
  const diaN = Number(dia);
  if (!Number.isFinite(sysN) || !Number.isFinite(diaN)) return undefined;
  return Math.round((sysN + 2 * diaN) / 3);
}

/** Фиксированная норма СрАд (нормотония): 70–110 мм рт.ст. */
export const SRAD_NORM = { low: 70, high: 110 } as const;

/** Классификация по СрАд: <70 гипотония, 70–110 нормотония, >110 гипертония. */
export function classifySrad(map: number | undefined): SradCategory | undefined {
  if (map === undefined) return undefined;
  if (map < SRAD_NORM.low) return 'hypotension';
  if (map <= SRAD_NORM.high) return 'normotension';
  return 'hypertension';
}

export const SRAD_CATEGORY_LABEL: Record<SradCategory, string> = {
  hypotension: 'Гипотония',
  normotension: 'Нормотония',
  hypertension: 'Гипертония',
};

export const SRAD_CATEGORY_COLOR: Record<SradCategory, StatusColor> = {
  hypotension: 'red',
  normotension: 'green',
  hypertension: 'yellow',
};