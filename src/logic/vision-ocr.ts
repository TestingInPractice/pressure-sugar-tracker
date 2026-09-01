import { formatPressureReading, parsePressureText } from './ocr-parse';

export interface VisionSettings {
  /** Базовый URL OpenAI-совместимого прокси, например http://127.0.0.1:8787/v1 */
  baseUrl: string;
  /** API-ключ пользователя. Хранится только в localStorage, в код не попадает. */
  apiKey: string;
  /** Идентификатор vision-модели, например qwen/qwen3-vl-32b-instruct */
  model: string;
}

export interface VisionPressureResult {
  /** Строка вида "105/70/96" или '' если не удалось распарсить. */
  text: string;
  /** 1 если распознано успешно, иначе 0. */
  confidence: number;
}

const STORAGE_KEY = 'pressure-vision-settings';

export const DEFAULT_VISION_SETTINGS: VisionSettings = {
  baseUrl: 'http://127.0.0.1:8787/v1',
  apiKey: '',
  model: 'qwen/qwen3-vl-32b-instruct',
};

const VISION_PROMPT =
  'Read the 3 numbers on this blood pressure monitor LCD (SYS/DIA/PULSE). ' +
  'Reply ONLY the numbers in format SYS/DIA/PULSE. No explanation.';

export function loadVisionSettings(): VisionSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p: Partial<VisionSettings> = JSON.parse(raw);
      return {
        baseUrl: typeof p.baseUrl === 'string' && p.baseUrl.trim() !== '' ? p.baseUrl.trim() : DEFAULT_VISION_SETTINGS.baseUrl,
        apiKey: typeof p.apiKey === 'string' ? p.apiKey : '',
        model: typeof p.model === 'string' && p.model.trim() !== '' ? p.model.trim() : DEFAULT_VISION_SETTINGS.model,
      };
    }
  } catch {
    // повреждённые данные — используем дефолты
  }
  return { ...DEFAULT_VISION_SETTINGS };
}

export function saveVisionSettings(settings: VisionSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Читает Blob как base64-строку (без префикса data:). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const res = fr.result as string;
      resolve(res.split(',')[1] ?? '');
    };
    fr.onerror = () => reject(new Error('read failed'));
    fr.readAsDataURL(blob);
  });
}

/** Распознаёт давление по фото через vision-модель на локальном прокси. */
export async function recognizeVisionPressure(
  blob: Blob,
  settings: VisionSettings,
  base64Loader: (b: Blob) => Promise<string> = blobToBase64,
): Promise<VisionPressureResult> {
  const base64 = await base64Loader(blob);
  const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const mime = blob.type || 'image/jpeg';
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
            { type: 'text', text: VISION_PROMPT },
          ],
        },
      ],
      max_tokens: 120,
    }),
  });
  if (!resp.ok) throw new Error(`vision http ${resp.status}`);
  const data: unknown = await resp.json();
  const content =
    typeof data === 'object' && data !== null &&
    Array.isArray((data as { choices?: unknown[] }).choices) &&
    typeof (data as { choices: { message?: { content?: unknown } }[] }).choices[0]?.message?.content === 'string'
      ? (data as { choices: { message: { content: string } }[] }).choices[0].message.content
      : '';
  const formatted = formatPressureReading(parsePressureText(content));
  return { text: formatted, confidence: formatted === '' ? 0 : 1 };
}