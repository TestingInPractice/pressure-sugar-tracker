/**
 * Детерминистический распознаватель 7-сегментных ЖК-цифр (как на тонометре).
 *
 * Вход — бинарная картинка одной цифры (пиксель true = сегмент активен),
 * обрезанная по границам цифры и нормализованная к вертикальной ориентации.
 *
 * Вместо хрупких одиночных тестовых точек декодер оценивает каждый из 7
 * сегментов по доле активных пикселей в его нормализованном прямоугольнике
 * (регион в долях ширины/высоты). Регионы соответствуют стандартной геометрии
 * 7-сегментного ЖК: вертикальные сегменты у краёв (x≈0.1 и x≈0.9), горизонтальные
 * по центру. Такой подход устойчив к мелким растровым шумам и не зависит от
 * абсолютного размера цифры.
 *
 * Не зависит от DOM/Canvas — чистые функции, легко тестировать.
 */

/** Битовая маска цифры: [a, b, c, d, e, f, g]. Верх = a, право верх = b,
 *  право низ = c, низ = d, лево низ = e, лево верх = f, середина = g. */
const SEGMENT_MASKS: Record<number, number[]> = {
  0: [1, 1, 1, 1, 1, 1, 0],
  1: [0, 1, 1, 0, 0, 0, 0],
  2: [1, 1, 0, 1, 1, 0, 1],
  3: [1, 1, 1, 1, 0, 0, 1],
  4: [0, 1, 1, 0, 0, 1, 1],
  5: [1, 0, 1, 1, 0, 1, 1],
  6: [1, 0, 1, 1, 1, 1, 1],
  7: [1, 1, 1, 0, 0, 0, 0],
  8: [1, 1, 1, 1, 1, 1, 1],
  9: [1, 1, 1, 1, 0, 1, 1],
};

/**
 * Регион каждого сегмента в долях ширины/высоты цифры: [x0, x1, y0, y1].
 * Стандартная геометрия 7-сегментного ЖК. Порядок сегментов: [a,b,c,d,e,f,g].
 */
const SEGMENT_REGIONS: Array<[number, number, number, number]> = [
  [0.3, 0.7, 0.02, 0.16], // a — верх (горизонтальный)
  [0.84, 0.98, 0.16, 0.44], // b — право верх (вертикальный)
  [0.84, 0.98, 0.56, 0.84], // c — право низ (вертикальный)
  [0.3, 0.7, 0.84, 0.98], // d — низ (горизонтальный)
  [0.02, 0.16, 0.56, 0.84], // e — лево низ (вертикальный)
  [0.02, 0.16, 0.16, 0.44], // f — лево верх (вертикальный)
  [0.3, 0.7, 0.46, 0.54], // g — середина (горизонтальный)
];

/** Доля активных пикселей в регионе, при которой сегмент считается включённым. */
const SEGMENT_ON_FRACTION = 0.25;

export interface SegmentDigitResult {
  digit: number | null;
  /** 0..1 — доля из 7 сегментов, совпавших с эталонной маской. */
  confidence: number;
}

/** Доля активных пикселей в заданном нормализованном регионе сегмента. */
function segmentFill(
  bits: Uint8Array,
  width: number,
  height: number,
  region: [number, number, number, number],
): number {
  const [fx0, fx1, fy0, fy1] = region;
  const x0 = Math.max(0, Math.round(fx0 * (width - 1)));
  const x1 = Math.min(width - 1, Math.round(fx1 * (width - 1)));
  const y0 = Math.max(0, Math.round(fy0 * (height - 1)));
  const y1 = Math.min(height - 1, Math.round(fy1 * (height - 1)));
  if (x1 < x0 || y1 < y0) return 0;
  let sum = 0;
  let count = 0;
  for (let cy = y0; cy <= y1; cy += 1) {
    for (let cx = x0; cx <= x1; cx += 1) {
      sum += bits[cy * width + cx];
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

/**
 * Декодирует бинарную картинку одной цифры.
 *
 * @param bits — бинарные пиксели (0|1), длина width*height, пиксель 1 = сегмент активен.
 * @param width — ширина картинки в пикселях.
 * @param height — высота картинки в пикселях.
 */
export function decodeSevenSegmentDigit(
  bits: Uint8Array,
  width: number,
  height: number,
): SegmentDigitResult {
  if (height < 8 || width < 6 || bits.length < width * height) {
    return { digit: null, confidence: 0 };
  }
  const active = new Array<boolean>(7);
  for (let i = 0; i < 7; i += 1) {
    active[i] = segmentFill(bits, width, height, SEGMENT_REGIONS[i]) > SEGMENT_ON_FRACTION;
  }

  let bestDigit: number | null = null;
  let bestScore = -1;
  for (const [digit, mask] of Object.entries(SEGMENT_MASKS)) {
    let score = 0;
    for (let i = 0; i < 7; i += 1) {
      if (active[i] === (mask[i] === 1)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestDigit = Number(digit);
    }
  }
  return { digit: bestDigit, confidence: bestScore / 7 };
}
