const TESSDATA_BASE = `${import.meta.env.BASE_URL}tessdata`;

// Локальная обёртка поверх Worker из tesseract.js: пакет типизирует
// tessedit_pageseg_mode как enum PSM, из-за чего строковый литерал '6'
// не проходит проверку типов. Ограничиваемся только тем, что используем.
interface OcrWorker {
  setParameters(params: { tessedit_char_whitelist?: string; tessedit_pageseg_mode?: string }): Promise<unknown>;
  recognize(image: Blob): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
}

export async function recognizeTextFromImage(image: Blob): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker: OcrWorker = await createWorker('eng', 1, {
    workerPath: `${TESSDATA_BASE}/worker.min.js`,
    corePath: `${TESSDATA_BASE}/`,
    langPath: TESSDATA_BASE, // без слэша в конце: формула langPath + langCode + '.traineddata.gz'
    gzip: true,
  });
  try {
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789/ -',
      tessedit_pageseg_mode: '6', // единый блок — экран тонометра
    });
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}