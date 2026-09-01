import { binarize, decodePressureRows, otsuThreshold, type PressureRowsResult } from './lcd-crop';

export interface OfflinePressureResult {
  text: string;
  rows: PressureRowsResult['rows'];
  confidence: number;
}

const MAX_EDGE = 1600;

/** Загружает Blob в HTMLCanvasElement и возвращает ImageData. */
export async function loadImageData(blob: Blob): Promise<ImageData> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('invalid image'));
      img.src = url;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(img, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface BinarizedImage {
  bits: Uint8Array;
  width: number;
  height: number;
}

/** Переводит ImageData в бинарный слой 0|1: 1 = тёмный пиксель (штрих ЖК). */
export function imageDataToBinary(data: ImageData, margin: number, pad: number): BinarizedImage {
  const { width, height, data: px } = data;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i += 1) {
    const r = px[i * 4];
    const g = px[i * 4 + 1];
    const b = px[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  const hist = new Uint8Array(256);
  for (let i = 0; i < gray.length; i += 1) hist[gray[i]] += 1;
  const threshold = otsuThreshold(hist);
  const binary = binarize(gray, width, height, threshold);
  const padded = padBinary(binary, width, height, pad);
  const trimmed = trimBinary(padded.bits, padded.extraWidth, padded.extraHeight, margin);
  return { bits: trimmed.bits, width: trimmed.width, height: trimmed.height };
}

/** Добавляет светлый отступ (0) вокруг бинарной картинки по вертикали и горизонтали. */
export function padBinary(src: Uint8Array, width: number, height: number, pad: number): {
  bits: Uint8Array; extraWidth: number; extraHeight: number;
} {
  const nw = width + pad * 2;
  const nh = height + pad * 2;
  const out = new Uint8Array(nw * nh);
  for (let y = 0; y < height; y += 1) {
    const srcRow = y * width;
    const dstRow = (y + pad) * nw;
    for (let x = 0; x < width; x += 1) out[dstRow + x + pad] = src[srcRow + x];
  }
  return { bits: out, extraWidth: nw, extraHeight: nh };
}

/** Обрезает светлые поля вокруг бинарной картинки. */
export function trimBinary(src: Uint8Array, width: number, height: number, margin: number): {
  bits: Uint8Array; x: number; y: number; width: number; height: number;
} {
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (src[row + x] === 1) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { bits: new Uint8Array(0), x: 0, y: 0, width: 0, height: 0 };
  const x0 = Math.max(0, minX - margin);
  const y0 = Math.max(0, minY - margin);
  const w = Math.min(width - x0, maxX - minX + 1 + margin * 2);
  const h = Math.min(height - y0, maxY - minY + 1 + margin * 2);
  const bits = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const srcRow = (y0 + y) * width;
    const dstRow = y * w;
    for (let x = 0; x < w; x += 1) bits[dstRow + x] = src[srcRow + x0 + x];
  }
  return { bits, x: x0, y: y0, width: w, height: h };
}

/** Оффлайн-распознавание давления по фото тонометра. */
export async function recognizeOfflinePressure(
  blob: Blob,
  loader: (b: Blob) => Promise<ImageData> = loadImageData,
): Promise<OfflinePressureResult> {
  const data = await loader(blob);
  const pad = Math.max(8, Math.round(Math.min(data.width, data.height) * 0.02));
  const binary = imageDataToBinary(data, pad, pad);
  const rows = decodePressureRows(binary.bits, binary.width, binary.height).rows;
  return {
    text: rows.map(r => r.digits).join(' '),
    rows,
    confidence: rows.length === 0
      ? 0
      : rows.reduce((a, r) => a + r.confidence, 0) / rows.length,
  };
}
