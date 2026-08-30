import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recognizeTextFromImage } from './ocr';

const mockSetParameters = vi.fn().mockResolvedValue(undefined);
const mockRecognize = vi.fn().mockResolvedValue({ data: { text: '120/80/65' } });
const mockTerminate = vi.fn().mockResolvedValue(undefined);
const mockCreateWorker = vi.fn().mockResolvedValue({
  setParameters: mockSetParameters,
  recognize: mockRecognize,
  terminate: mockTerminate,
});

vi.mock('tesseract.js', () => ({
  createWorker: (...args: unknown[]) => mockCreateWorker(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recognizeTextFromImage', () => {
  it('возвращает текст из worker.recognize', async () => {
    const text = await recognizeTextFromImage(new Blob(['x'], { type: 'image/png' }));
    expect(text).toBe('120/80/65');
  });

  it('создаёт worker с eng/oem=1 и локальными путями ассетов', async () => {
    await recognizeTextFromImage(new Blob(['x']));
    expect(mockCreateWorker).toHaveBeenCalledWith(
      'eng', 1,
      expect.objectContaining({
        workerPath: expect.stringContaining('tessdata/worker.min.js'),
        corePath: expect.stringContaining('tessdata/'),
        langPath: expect.stringContaining('tessdata'),
        gzip: true,
      }),
    );
  });

  it('освобождает worker после распознавания', async () => {
    await recognizeTextFromImage(new Blob(['x']));
    expect(mockTerminate).toHaveBeenCalledTimes(1);
  });
});