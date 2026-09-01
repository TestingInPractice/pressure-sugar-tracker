import { describe, it, expect, vi } from 'vitest';
import {
  imageDataToBinary,
  padBinary,
  trimBinary,
  recognizeOfflinePressure,
} from './ocr-offline';

/** Строит ImageData из строк (X = тёмный пиксель, . = светлый). */
function imageDataFromRows(rows: string[]): ImageData {
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const off = (y * w + x) * 4;
      const dark = (rows[y][x] ?? '.') === 'X';
      const v = dark ? 0 : 255;
      px[off] = v;
      px[off + 1] = v;
      px[off + 2] = v;
      px[off + 3] = 255;
    }
  }
  return { width: w, height: h, data: px } as ImageData;
}

describe('padBinary / trimBinary', () => {
  it('padBinary добавляет светлый отступ со всех сторон', () => {
    const src = new Uint8Array([1, 1, 1, 1]); // 2x2 всё тёмное
    const p = padBinary(src, 2, 2, 1);
    expect(p.extraWidth).toBe(4);
    expect(p.extraHeight).toBe(4);
    expect(p.bits[0]).toBe(0); // углы светлые
    expect(p.bits[1 * 4 + 1]).toBe(1);
  });

  it('trimBinary обрезает светлые поля', () => {
    const src = new Uint8Array([
      0, 0, 0, 0, 0, 0,
      0, 0, 1, 1, 0, 0,
      0, 0, 1, 1, 0, 0,
      0, 0, 0, 0, 0, 0,
    ]); // 6x4, блок 2x2 в центре
    const t = trimBinary(src, 6, 4, 0);
    expect(t.width).toBe(2);
    expect(t.height).toBe(2);
    expect(Array.from(t.bits)).toEqual([1, 1, 1, 1]);
  });
});

describe('imageDataToBinary', () => {
  it('бинаризует тёмные пиксели в 1 и обрезает поля', () => {
    const img = imageDataFromRows(['...', '.X.', '...']);
    const bin = imageDataToBinary(img, 0, 0);
    expect(bin.width).toBe(1);
    expect(bin.height).toBe(1);
    expect(bin.bits[0]).toBe(1);
  });
});

describe('recognizeOfflinePressure', () => {
  it('пустая картинка даёт пустой текст и confidence 0', async () => {
    const result = await recognizeOfflinePressure(
      new Blob(['x'], { type: 'image/png' }),
      async () => imageDataFromRows(['........', '........']),
    );
    expect(result.text).toBe('');
    expect(result.confidence).toBe(0);
    expect(result.rows).toEqual([]);
  });

  it('вызывает переданный загрузчик и возвращает текст из строк', async () => {
    const loader = vi.fn(async () => imageDataFromRows(['.X.', '.X.', '.X.']));
    const result = await recognizeOfflinePressure(new Blob(['x']), loader);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(typeof result.text).toBe('string');
    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });
});
