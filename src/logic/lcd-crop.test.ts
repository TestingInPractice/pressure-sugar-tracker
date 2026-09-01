import { describe, it, expect } from 'vitest';
import {
  otsuThreshold,
  binarize,
  trimBBox,
  splitBands,
  rowProjection,
  decodeDigitRow,
  decodePressureRows,
  cropBinary,
  splitIntoRows,
} from './lcd-crop';

const REGIONS: Array<[number, number, number, number]> = [
  [0.3, 0.7, 0.02, 0.16],
  [0.84, 0.98, 0.16, 0.44],
  [0.84, 0.98, 0.56, 0.84],
  [0.3, 0.7, 0.84, 0.98],
  [0.02, 0.16, 0.56, 0.84],
  [0.02, 0.16, 0.16, 0.44],
  [0.3, 0.7, 0.46, 0.54],
];

const MASKS: Record<number, number[]> = {
  0: [1, 1, 1, 1, 1, 1, 0], 1: [0, 1, 1, 0, 0, 0, 0], 2: [1, 1, 0, 1, 1, 0, 1],
  3: [1, 1, 1, 1, 0, 0, 1], 4: [0, 1, 1, 0, 0, 1, 1], 5: [1, 0, 1, 1, 0, 1, 1],
  6: [1, 0, 1, 1, 1, 1, 1], 7: [1, 1, 1, 0, 0, 0, 0], 8: [1, 1, 1, 1, 1, 1, 1],
  9: [1, 1, 1, 1, 0, 1, 1],
};

/** Рисует одиночную цифру заданной высоты/ширины с зазором между сегментами. */
function drawDigitPixels(digit: number, H: number, W: number, inset = 0.02): Uint8Array {
  const mask = MASKS[digit];
  const bits = new Uint8Array(H * W);
  for (let i = 0; i < 7; i += 1) {
    if (mask[i] !== 1) continue;
    const [rx0, rx1, ry0, ry1] = REGIONS[i];
    const dx = (rx1 - rx0) * inset;
    const dy = (ry1 - ry0) * inset;
    const x0 = Math.max(0, Math.round((rx0 + dx) * (W - 1)));
    const x1 = Math.min(W - 1, Math.round((rx1 - dx) * (W - 1)));
    const y0 = Math.max(0, Math.round((ry0 + dy) * (H - 1)));
    const y1 = Math.min(H - 1, Math.round((ry1 - dy) * (H - 1)));
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) bits[y * W + x] = 1;
  }
  return bits;
}

/** Собирает строку цифр в общую картинку с промежутками (межцифровой зазор). */
function drawRow(digits: number[], digitH = 28, digitW = 18, gap = 12): { bits: Uint8Array; width: number; height: number } {
  const height = digitH;
  const width = digits.length * digitW + (digits.length - 1) * gap;
  const bits = new Uint8Array(height * width);
  for (let i = 0; i < digits.length; i += 1) {
    const cell = drawDigitPixels(digits[i], digitH, digitW);
    const x0 = i * (digitW + gap);
    for (let y = 0; y < digitH; y += 1) {
      for (let x = 0; x < digitW; x += 1) {
        bits[y * width + (x0 + x)] = cell[y * digitW + x];
      }
    }
  }
  return { bits, width, height };
}

describe('otsuThreshold', () => {
  it('возвращает порог между двумя пиками (непрерывная бинарная гистограмма)', () => {
    const hist = new Array<number>(256).fill(0);
    for (let i = 0; i < 120; i += 1) hist[i] = 50;
    for (let i = 136; i < 256; i += 1) hist[i] = 50;
    const t = otsuThreshold(hist);
    expect(t).toBeGreaterThanOrEqual(118);
    expect(t).toBeLessThanOrEqual(138);
  });

  it('возвращает середину диапазона при пустой гистограмме', () => {
    expect(otsuThreshold(new Array<number>(256).fill(0))).toBe(128);
  });
});

describe('binarize', () => {
  it('помечает тёмные пиксели как 1, светлые как 0', () => {
    const gray = new Uint8Array([10, 200, 30, 250]);
    const bin = binarize(gray, 2, 2, 128);
    expect(Array.from(bin)).toEqual([1, 0, 1, 0]);
  });
});

describe('trimBBox', () => {
  it('находит границы активных пикселей', () => {
    const w = 5;
    const h = 4;
    const bin = new Uint8Array(w * h);
    bin[1 * w + 2] = 1;
    bin[2 * w + 3] = 1;
    const b = trimBBox(bin, w, h);
    expect(b).toEqual({ x: 2, y: 1, width: 2, height: 2 });
  });

  it('возвращает null на пустой картинке', () => {
    expect(trimBBox(new Uint8Array(15), 5, 3)).toBeNull();
  });
});

describe('splitBands', () => {
  it('разбивает проекцию на полосы по нулевым промежуткам', () => {
    const proj = [3, 3, 0, 0, 2, 2, 2, 0, 1];
    const bands = splitBands(proj);
    expect(bands).toEqual([
      { start: 0, length: 2 },
      { start: 4, length: 3 },
      { start: 8, length: 1 },
    ]);
  });

  it('отбрасывает полосы короче minBand', () => {
    const proj = [1, 0, 5, 5, 5];
    expect(splitBands(proj, 2)).toEqual([{ start: 2, length: 3 }]);
  });
});

describe('rowProjection', () => {
  it('считает сумму активных пикселей на строку', () => {
    const bin = new Uint8Array([1, 1, 0, 0, 1, 1]); // 2x3
    expect(rowProjection(bin, 3, 2)).toEqual([2, 2]);
  });
});

describe('decodeDigitRow', () => {
  it('распознаёт строку цифр в правильном порядке', () => {
    const { bits, width, height } = drawRow([1, 0, 5]);
    const row = decodeDigitRow(bits, width, 0, height);
    expect(row.digits).toBe('105');
    expect(row.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('пустая строка даёт пустой результат', () => {
    const empty = new Uint8Array(18 * 28);
    const row = decodeDigitRow(empty, 18, 0, 28);
    expect(row.digits).toBe('');
    expect(row.confidence).toBe(0);
  });

  it('cropBinary верно извлекает область', () => {
    const src = new Uint8Array([1, 2, 3, 4, 5, 6]); // 3x2
    const cut = cropBinary(src, 3, 1, 0, 2, 2);
    expect(Array.from(cut)).toEqual([2, 3, 5, 6]);
  });
});

describe('decodePressureRows', () => {
  function drawMultiRow(rows: number[][], rowGap = 20): { bits: Uint8Array; width: number; height: number } {
    const digitH = 28;
    const digitW = 18;
    const single = rows.map((r) => drawRow(r, digitH, digitW, 12));
    const maxW = Math.max(...single.map((s) => s.width));
    const height = rows.length * digitH + (rows.length - 1) * rowGap;
    const bits = new Uint8Array(height * maxW);
    for (let ri = 0; ri < rows.length; ri += 1) {
      const y0 = ri * (digitH + rowGap);
      for (let y = 0; y < digitH; y += 1) {
        for (let x = 0; x < single[ri].width; x += 1) {
          bits[(y0 + y) * maxW + x] = single[ri].bits[y * single[ri].width + x];
        }
      }
    }
    return { bits, width: maxW, height };
  }

  it('распознаёт три строки цифр в правильном порядке', () => {
    const { bits, width, height } = drawMultiRow([[1, 0, 5], [7, 0], [9, 6]]);
    const res = decodePressureRows(bits, width, height);
    expect(res.rows.map((r) => r.digits)).toEqual(['105', '70', '96']);
  });

  it('пустая картинка даёт пустой результат', () => {
    const res = decodePressureRows(new Uint8Array(50 * 120), 120, 50);
    expect(res.rows).toEqual([]);
  });

  it('splitIntoRows находит отдельные строки', () => {
    const { bits, width, height } = drawMultiRow([[1], [2], [3]]);
    const rows = splitIntoRows(bits, width, height);
    expect(rows.length).toBe(3);
    expect(rows[0].height).toBeGreaterThanOrEqual(15); // плотная полоса активных пикселей
  });
});
