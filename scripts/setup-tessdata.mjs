// Копирует ассеты Tesseract.js из node_modules в public/tessdata/
// и скачивает eng.traineddata.gz один раз (идемпотентно, офлайн-безопасно).
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'public', 'tessdata');
mkdirSync(dest, { recursive: true });

const copies = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core.wasm.js', 'tesseract-core.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd.wasm.js', 'tesseract-core-simd.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd.wasm.js', 'tesseract-core-relaxedsimd.wasm.js'],
];
for (const [src, out] of copies) {
  cpSync(join(root, src), join(dest, out));
}

const langFile = join(dest, 'eng.traineddata.gz');
if (!existsSync(langFile)) {
  const res = await fetch('https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz');
  if (!res.ok) throw new Error(`не удалось скачать eng.traineddata.gz: HTTP ${res.status}`);
  writeFileSync(langFile, Buffer.from(await res.arrayBuffer()));
}
