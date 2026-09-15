import sharp from 'sharp';
import { PNG } from 'pngjs';
import fs from 'node:fs';

const MASTER = 'scripts/icon-master.png';
const THRESHOLD = 40; // отсекаем полупрозрачное «гало», оставляем ядро рисунка
const MASKABLE_BG = { r: 14, g: 116, b: 144 }; // #0e7490 — тема приложения

if (!fs.existsSync(MASTER)) {
  console.error('Нет scripts/icon-master.png — исходник иконки.');
  process.exit(1);
}

// 1. Декодируем мастер и ищем bounding box непрозрачного ядра
const png = PNG.sync.read(fs.readFileSync(MASTER));
const mw = png.width;
const mh = png.height;
const data = png.data;

let minX = mw;
let minY = mh;
let maxX = -1;
let maxY = -1;

for (let y = 0; y < mh; y++) {
  for (let x = 0; x < mw; x++) {
    const a = data[(y * mw + x) * 4 + 3];
    if (a > THRESHOLD) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const cropW = maxX - minX + 1;
const cropH = maxY - minY + 1;
console.log(`content bbox: (${minX},${minY}) ${cropW}x${cropH} (canvas ${mw}x${mh})`);

// 2. Доминирующий цвет по внешнему кольцу ядра (8%) — им зальём подложку
let rSum = 0;
let gSum = 0;
let bSum = 0;
let wSum = 0;
for (let y = 0; y < cropH; y++) {
  for (let x = 0; x < cropW; x++) {
    const i = ((minY + y) * mw + (minX + x)) * 4;
    const a = data[i + 3];
    if (a <= THRESHOLD) continue;
    const inRing =
      x < cropW * 0.08 || y < cropH * 0.08 || x > cropW * 0.92 || y > cropH * 0.92;
    if (!inRing) continue;
    rSum += data[i] * a;
    gSum += data[i + 1] * a;
    bSum += data[i + 2] * a;
    wSum += a;
  }
}
const BG = {
  r: Math.round(rSum / wSum),
  g: Math.round(gSum / wSum),
  b: Math.round(bSum / wSum),
};
console.log(`backing color: rgb(${BG.r},${BG.g},${BG.b})`);

// 3. Генерируем иконки: ядро на весь квадрат + подложка под прозрачные углы
//    (flatten делает картинку полностью непрозрачной — iOS не покажет белого)
const src = sharp(MASTER).extract({ left: minX, top: minY, width: cropW, height: cropH });

const sizes = [
  { file: 'public/icon-180.png', size: 180 },
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
];

for (const { file, size } of sizes) {
  await src
    .clone()
    .resize(size, size)
    .flatten({ background: BG })
    .png()
    .toFile(file);
  console.log(`wrote ${file} (${size}x${size}, full-bleed)`);
}

// 4. Maskable (Android): то же ядро в безопасной зоне 80% на фоне темы
const ms = 512;
const cs = Math.round(ms * 0.8);
const pad = Math.round((ms - cs) / 2);
await src
  .clone()
  .resize(cs, cs)
  .extend({ top: pad, bottom: pad, left: pad, right: pad, background: MASKABLE_BG })
  .flatten({ background: MASKABLE_BG })
  .png()
  .toFile('public/icon-maskable-512.png');
console.log('wrote public/icon-maskable-512.png (512x512, maskable)');

console.log('icons written');