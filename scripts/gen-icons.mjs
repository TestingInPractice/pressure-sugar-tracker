import { PNG } from 'pngjs';
import fs from 'node:fs';
for (const size of [192, 512]) {
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 37; png.data[i + 1] = 99; png.data[i + 2] = 235; png.data[i + 3] = 255;
  }
  fs.writeFileSync(`public/icon-${size}.png`, PNG.sync.write(png));
}
console.log('icons written');
