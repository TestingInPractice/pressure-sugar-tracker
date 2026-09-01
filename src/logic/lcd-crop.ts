/**
 * Оффлайн-препроцессор для распознавания 7-сегментных цифр тонометра.
 *
 * Конвейер: grayscale → Otsu-бинаризация → обрезка по границам тёмных
 * пикселей → разбиение на строки (горизонтальная проекция) → разбиение каждой
 * строки на цифры (вертикальная проекция) → декод каждой цифры.
 *
 * Чистые функции оперируют над бинарной картинкой (Uint8Array 0|1) и не зависят
 * от Canvas/DOM — поэтому их легко тестировать. Первым элементом пикселя идёт
 * верхний левый угол, строки идут сверху вниз.
 */

import { decodeSevenSegmentDigit } from './seg-ocr';
import type { SegmentDigitResult } from './seg-ocr';

/** Порог Otsu по гистограмме яркости. */
export function otsuThreshold(hist: Uint8Array | number[]): number {
  const n = hist.length;
  let total = 0;
  for (let i = 0; i < n; i += 1) total += hist[i];
  if (total === 0) return Math.floor(n / 2);
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 0;
  for (let t = 0; t < n; t += 1) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * Бинаризует grayscale-картинку (0..255, синхронный массив) в 0|1.
 * Пиксель 1 = сегмент (по умолчанию тёмный при invert=false).
 */
export function binarize(
  gray: Uint8Array,
  width: number,
  height: number,
  threshold?: number,
  invert = false,
): Uint8Array {
  const hist = new Uint8Array(256);
  for (let i = 0; i < gray.length; i += 1) hist[gray[i]] += 1;
  const t = threshold ?? otsuThreshold(hist);
  const out = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i += 1) {
    const dark = gray[i] <= t;
    out[i] = dark !== invert ? 1 : 0;
  }
  void width;
  void height;
  return out;
}

/** Обрезает по границам активных (1) пикселей. */
export function trimBBox(
  binary: Uint8Array,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } | null {
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (binary[y * width + x] === 1) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export interface Band {
  start: number;
  length: number;
}

/**
 * Разбивает одномерную проекцию (активность по строке/колонке) на полосы,
 * разделённые нулевыми промежутками. Полосы короче minBand отбрасываются.
 */
export function splitBands(
  projection: ArrayLike<number>,
  minBand = 1,
): Band[] {
  const bands: Band[] = [];
  let start = -1;
  for (let i = 0; i <= projection.length; i += 1) {
    const active = i < projection.length && projection[i] > 0;
    if (active && start < 0) {
      start = i;
    } else if (!active && start >= 0) {
      if (i - start >= minBand) bands.push({ start, length: i - start });
      start = -1;
    }
  }
  return bands;
}

/**
 * Сливает соседние полосы, разделённые промежутком не больше maxGap.
 * Это нужно для цифр, чьи штрихи (вертикальные и горизонтальные сегменты)
 * не образуют единый непрерывный столбец проекции, но всё же принадлежат
 * одной цифре (например «1»). Полосы короче minBand в начале игнорируются.
 */
export function mergeCloseBands(bands: Band[], maxGap: number, minBand = 1): Band[] {
  if (bands.length === 0) return [];
  const merged: Band[] = [];
  let cur = { ...bands[0] };
  for (let i = 1; i < bands.length; i += 1) {
    const gap = bands[i].start - (cur.start + cur.length);
    if (gap <= maxGap) {
      cur = { start: cur.start, length: bands[i].start + bands[i].length - cur.start };
    } else {
      if (cur.length >= minBand) merged.push(cur);
      cur = { ...bands[i] };
    }
  }
  if (cur.length >= minBand) merged.push(cur);
  return merged;
}

/** Проекция по строкам (сумма активных пикселей на строку). */
export function rowProjection(binary: Uint8Array, width: number, height: number): number[] {
  const proj = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y += 1) {
    let s = 0;
    for (let x = 0; x < width; x += 1) s += binary[y * width + x];
    proj[y] = s;
  }
  return proj;
}

/** Проекция по колонкам (сумма активных пикселей на колонку). */
export function colProjection(binary: Uint8Array, width: number, height: number): number[] {
  const proj = new Array<number>(width).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) proj[x] += binary[y * width + x];
  }
  return proj;
}

/** Извлекает бинарные пиксели прямоугольной области. */
export function cropBinary(
  binary: Uint8Array,
  width: number,
  x: number,
  y: number,
  w: number,
  h: number,
): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      out[yy * w + xx] = binary[(y + yy) * width + (x + xx)];
    }
  }
  return out;
}

/**
 * Увеличивает бинарную картинку до высоты targetH целочисленным
 * ближайшим соседом, сохраняя пропорции (ширина масштабируется по тому же
 * коэффициенту). Нужно, чтобы узкие цифры (например «1») достигали размеров,
 * при которых декодер 7-сегментов стабилен, не искажая относительного
 * положения сегментов.
 */
export function scaleBinary(
  binary: Uint8Array,
  width: number,
  height: number,
  targetH: number,
): { bits: Uint8Array; width: number; height: number } {
  if (height >= targetH) {
    return { bits: binary.slice(), width, height };
  }
  const scale = targetH / height;
  const outW = Math.max(1, Math.round(width * scale));
  const outH = targetH;
  const out = new Uint8Array(outW * outH);
  for (let y = 0; y < outH; y += 1) {
    const sy = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < outW; x += 1) {
      const sx = Math.min(width - 1, Math.floor(x / scale));
      out[y * outW + x] = binary[sy * width + sx];
    }
  }
  return { bits: out, width: outW, height: outH };
}

export interface DigitCell {
  region: { x: number; y: number; width: number; height: number };
  result: SegmentDigitResult;
}

export interface DigitRowResult {
  digits: string;
  confidence: number;
  cells: DigitCell[];
}

/**
 * Декодирует одну строку цифр: находит цифры вертикальной проекцией внутри
 * заданной полосы и распознаёт каждую. Строка считается пустой, если не нашлось
 * ни одной подходящей по габаритам цифры.
 */
export function decodeDigitRow(
  binary: Uint8Array,
  width: number,
  rowY: number,
  rowH: number,
): DigitRowResult {
  const sub = cropBinary(binary, width, 0, rowY, width, rowH);
  const colProj = colProjection(sub, width, rowH);
  const minCharW = Math.max(2, Math.round(rowH * 0.12));
  const mergeGap = Math.max(1, Math.round(rowH * 0.1));
  const targetH = Math.max(28, rowH);
  const bands = splitBands(colProj);
  const chars = mergeCloseBands(bands, mergeGap, minCharW);

  const cells: DigitCell[] = [];
  for (const band of chars) {
    const bandBits = cropBinary(sub, width, band.start, 0, band.length, rowH);
    const trim = trimBBox(bandBits, band.length, rowH);
    if (!trim) continue;
    const sw = trim.width;
    const sh = trim.height;
    const region = { x: rowY + band.start + trim.x, y: rowY + trim.y, width: sw, height: sh };
    if (sw / sh < 0.32) {
      cells.push({ region, result: { digit: 1, confidence: 1 } });
      continue;
    }
    const scaled = scaleBinary(
      cropBinary(sub, width, band.start + trim.x, trim.y, sw, sh),
      sw,
      sh,
      targetH,
    );
    const result = decodeSevenSegmentDigit(scaled.bits, scaled.width, scaled.height);
    if (result.digit === null) continue;
    cells.push({ region, result });
  }

  const digits = cells.map((c) => String(c.result.digit)).join('');
  const confidence = cells.length === 0
    ? 0
    : cells.reduce((a, c) => a + c.result.confidence, 0) / cells.length;
  return { digits, confidence, cells };
}

/** Разбивает бинарную картинку на строки по горизонтальной проекции. */
export function splitIntoRows(
  binary: Uint8Array,
  width: number,
  height: number,
): Array<{ y: number; height: number }> {
  const proj = rowProjection(binary, width, height);
  const minRowH = Math.max(4, Math.round(height * 0.03));
  const bands = splitBands(proj, minRowH);
  const mergeGap = Math.max(2, Math.round(height * 0.05));
  return mergeCloseBands(bands, mergeGap, minRowH).map((b) => ({ y: b.start, height: b.length }));
}

export interface PressureRowsResult {
  rows: DigitRowResult[];
}

/**
 * Декодирует все строки цифр в бинарной картинке (например три строки
 * тонометра — SYS, DIA, PULSE). Порядок строк — сверху вниз.
 */
export function decodePressureRows(
  binary: Uint8Array,
  width: number,
  height: number,
): PressureRowsResult {
  const trim = trimBBox(binary, width, height);
  if (!trim) return { rows: [] };
  const rows = splitIntoRows(binary, width, height);
  const result: DigitRowResult[] = [];
  for (const row of rows) {
    result.push(decodeDigitRow(binary, width, row.y, row.height));
  }
  return { rows: result };
}
