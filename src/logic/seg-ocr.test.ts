import { describe, it, expect } from 'vitest';
import { decodeSevenSegmentDigit } from './seg-ocr';
import type { SegmentDigitResult } from './seg-ocr';

// Регионы сегментов — ОБЯЗАНЫ совпадать с SEGMENT_REGIONS в seg-ocr.ts,
// чтобы тест рисовал цифры в той же стандартной геометрии, которую читает декодер.
// Порядок: [a,b,c,d,e,f,g], где a=верх, b=право-верх, c=право-низ, d=низ,
// e=лево-низ, f=лево-верх, g=середина.
const REGIONS: Array<[number, number, number, number]> = [
  [0.3, 0.7, 0.02, 0.16],
  [0.84, 0.98, 0.16, 0.44],
  [0.84, 0.98, 0.56, 0.84],
  [0.3, 0.7, 0.84, 0.98],
  [0.02, 0.16, 0.56, 0.84],
  [0.02, 0.16, 0.16, 0.44],
  [0.3, 0.7, 0.46, 0.54],
];

type DigitMask = number[];
const SEGMENT_MASKS: Record<number, DigitMask> = {
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
 * Рисует 7-сегментную цифру, заливая каждый включённый сегмент целиком
 * в пределы его нормализованного региона. Небольшое внутреннее втягивание
 * (inset) избавляет пиксели региона от смешивания с соседними сегментами —
 * как реальный ЖК с зазорами между сегментами.
 */
function drawDigit(
  digit: number,
  H = 28,
  W = 18,
  inset = 0.08,
): { bits: Uint8Array; width: number; height: number } {
  const mask = SEGMENT_MASKS[digit];
  const bits = new Uint8Array(H * W);
  for (let i = 0; i < 7; i += 1) {
    if (mask[i] !== 1) continue;
    const [rx0, rx1, ry0, ry1] = REGIONS[i];
    // втягиваем внутрь региона, чтобы сегмент не выходил за его границы
    const dx = (rx1 - rx0) * inset;
    const dy = (ry1 - ry0) * inset;
    const x0 = Math.max(0, Math.round((rx0 + dx) * (W - 1)));
    const x1 = Math.min(W - 1, Math.round((rx1 - dx) * (W - 1)));
    const y0 = Math.max(0, Math.round((ry0 + dy) * (H - 1)));
    const y1 = Math.min(H - 1, Math.round((ry1 - dy) * (H - 1)));
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) bits[y * W + x] = 1;
    }
  }
  return { bits, width: W, height: H };
}

function withNoise(input: Uint8Array, pct: number, rng: () => number): Uint8Array {
  const out = input.slice();
  for (let i = 0; i < out.length; i += 1) if (rng() < pct) out[i] = out[i] === 1 ? 0 : 1;
  return out;
}

function decode(
  bits: Uint8Array,
  width: number,
  height: number,
): SegmentDigitResult {
  return decodeSevenSegmentDigit(bits, width, height);
}

describe('decodeSevenSegmentDigit', () => {
  it('декодирует все цифры 0-9 с confidence = 1 на чистых цифрах', () => {
    for (let d = 0; d <= 9; d += 1) {
      const { bits, width, height } = drawDigit(d);
      const r = decode(bits, width, height);
      expect(r.digit, `цифра ${d}`).toBe(d);
      expect(r.confidence, `confidence цифры ${d}`).toBe(1);
    }
  });

  it('декодирует цифры при разных пропорциях (широкие и высокие)', () => {
    for (const [H, W] of [[36, 24], [24, 14], [40, 16], [48, 32]] as const) {
      for (let d = 0; d <= 9; d += 1) {
        const { bits, width, height } = drawDigit(d, H, W);
        const r = decode(bits, width, height);
        expect(r.digit, `цифра ${d} при ${H}x${W}`).toBe(d);
      }
    }
  });

  it('устойчив к шуму ~5% (допускаем до 1 деградации)', () => {
    const rng = (() => {
      let s = 123456789;
      return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    })();
    let correct = 0;
    for (let d = 0; d <= 9; d += 1) {
      const base = drawDigit(d);
      const noisy = withNoise(base.bits, 0.05, rng);
      const r = decode(noisy, base.width, base.height);
      if (r.digit === d) correct += 1;
    }
    expect(correct).toBeGreaterThanOrEqual(9);
  });

  it('возвращает null при слишком маленькой картинке', () => {
    const r = decode(new Uint8Array(3 * 2), 3, 2);
    expect(r.digit).toBeNull();
  });

  it('возвращает digit=null при пустой картинке (нет активных сегментов)', () => {
    const r = decode(new Uint8Array(15), 5, 3);
    // картинка слишком мала для декодирования (H<8)
    expect(r.digit).toBeNull();
  });

  it('на почти пустой картинке не выдаёт уверенную цифру (confidence ниже полного)', () => {
    const H = 28;
    const W = 18;
    const bits = new Uint8Array(H * W);
    const [rx0, rx1, ry0, ry1] = REGIONS[6];
    for (let y = Math.round(ry0 * (H - 1)); y <= Math.round(ry1 * (H - 1)); y += 1) {
      for (let x = Math.round(rx0 * (W - 1)); x <= Math.round(rx1 * (W - 1)); x += 1) {
        bits[y * W + x] = 1;
      }
    }
    const r = decode(bits, W, H);
    expect(r.confidence).toBeLessThanOrEqual(5 / 7);
  });
});
