import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_VISION_SETTINGS,
  blobToBase64,
  loadVisionSettings,
  recognizeVisionPressure,
  saveVisionSettings,
} from './vision-ocr';

const KEY = 'sk-test123';

function jsonResponse(content: string): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('loadVisionSettings / saveVisionSettings', () => {
  beforeEach(() => localStorage.clear());

  it('возвращает дефолты без сохранённых данных', () => {
    expect(loadVisionSettings()).toEqual(DEFAULT_VISION_SETTINGS);
  });

  it('сохраняет и загружает настройки, включая apiKey (только localStorage)', () => {
    const s = { baseUrl: 'http://10.0.0.2:8787/v1', apiKey: KEY, model: 'm2' };
    saveVisionSettings(s);
    const loaded = loadVisionSettings();
    expect(loaded.baseUrl).toBe('http://10.0.0.2:8787/v1');
    expect(loaded.apiKey).toBe(KEY);
    expect(loaded.model).toBe('m2');
  });

  it('не позволяет записать пустой baseUrl или model (подставляются дефолты)', () => {
    saveVisionSettings({ baseUrl: '   ', apiKey: KEY, model: '' });
    const loaded = loadVisionSettings();
    expect(loaded.baseUrl).toBe(DEFAULT_VISION_SETTINGS.baseUrl);
    expect(loaded.model).toBe(DEFAULT_VISION_SETTINGS.model);
    expect(loaded.apiKey).toBe(KEY);
  });

  it('переживает повреждённый JSON в localStorage', () => {
    localStorage.setItem('pressure-vision-settings', '{broken');
    expect(loadVisionSettings()).toEqual(DEFAULT_VISION_SETTINGS);
  });
});

describe('blobToBase64', () => {
  it('читает Blob в base64 без префикса data:', async () => {
    const b = new Blob(['abc'], { type: 'image/jpeg' });
    const b64 = await blobToBase64(b);
    expect(b64).toBe('YWJj');
  });
});

describe('recognizeVisionPressure', () => {
  beforeEach(() => localStorage.clear());

  it('распознаёт 105/70/96 из ответа модели', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse('105/70/96'));
    vi.stubGlobal('fetch', fetchMock);

    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    const res = await recognizeVisionPressure(
      blob,
      { baseUrl: 'http://127.0.0.1:8787/v1', apiKey: KEY, model: 'qwen/qwen3-vl-32b-instruct' },
      async () => 'QUJD',
    );

    expect(res.text).toBe('105/70/96');
    expect(res.confidence).toBe(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8787/v1/chat/completions');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('qwen/qwen3-vl-32b-instruct');
    expect(body.messages[0].content[0].image_url.url).toContain('data:image/jpeg;base64,QUJD');
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    vi.unstubAllGlobals();
  });

  it('нормализует trailing slash в baseUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse('120/80/65'));
    vi.stubGlobal('fetch', fetchMock);
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    const res = await recognizeVisionPressure(
      blob,
      { baseUrl: 'http://127.0.0.1:8787/v1/', apiKey: KEY, model: 'm' },
      async () => 'QQ==',
    );
    expect(res.text).toBe('120/80/65');
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8787/v1/chat/completions');
    vi.unstubAllGlobals();
  });

  it('возвращает text="" если модель ответила мусором', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse('я не вижу цифр'));
    vi.stubGlobal('fetch', fetchMock);
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    const res = await recognizeVisionPressure(blob, { ...DEFAULT_VISION_SETTINGS, apiKey: KEY }, async () => 'QQ==');
    expect(res.text).toBe('');
    expect(res.confidence).toBe(0);
    vi.unstubAllGlobals();
  });

  it('пробрасывает ошибку сети (прокси недоступен)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    await expect(recognizeVisionPressure(blob, { ...DEFAULT_VISION_SETTINGS, apiKey: KEY }, async () => 'QQ=='))
      .rejects.toThrow('fetch failed');
    vi.unstubAllGlobals();
  });

  it('пробрасывает ошибку HTTP 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    await expect(recognizeVisionPressure(blob, { ...DEFAULT_VISION_SETTINGS, apiKey: KEY }, async () => 'QQ=='))
      .rejects.toThrow('vision http 401');
    vi.unstubAllGlobals();
  });
});