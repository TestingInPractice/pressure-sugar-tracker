import sharp from 'sharp';
import fs from 'node:fs';

if (!fs.existsSync('scripts/icon-master.png')) {
  console.error('Нет scripts/icon-master.png — исходник иконки.');
  process.exit(1);
}

const MASTER = 'scripts/icon-master.png';
const MASKABLE_BG = '#0e7490'; // тема приложения

// Обычные иконки: как есть, прозрачность сохраняется (iOS сам скругляет углы)
const sizes = [
  { file: 'public/icon-180.png', size: 180 },
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
];

for (const { file, size } of sizes) {
  await sharp(MASTER).resize(size, size).png().toFile(file);
  console.log(`wrote ${file} (${size}x${size})`);
}

// Maskable (Android): полноцветный квадрат без прозрачности,
// контент — в безопасной зоне 80% по центру
const maskableSize = 512;
const contentSize = Math.round(maskableSize * 0.8);
const pad = Math.round((maskableSize - contentSize) / 2);
await sharp(MASTER)
  .resize(contentSize, contentSize)
  .extend({
    top: pad,
    bottom: pad,
    left: pad,
    right: pad,
    background: MASKABLE_BG,
  })
  .png()
  .toFile('public/icon-maskable-512.png');
console.log('wrote public/icon-maskable-512.png (512x512, maskable)');

console.log('icons written');