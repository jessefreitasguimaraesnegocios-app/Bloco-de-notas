import sharp from 'sharp';
import { mkdirSync } from 'fs';

mkdirSync('public', { recursive: true });

function iconSvg(size) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect fill="#0a0a0c" width="100%" height="100%"/>
  <rect x="12%" y="12%" width="76%" height="76%" rx="18%" fill="none" stroke="#00ffff" stroke-width="${Math.max(4, size / 48)}"/>
  <path d="M${size * 0.35} ${size * 0.42} L${size * 0.5} ${size * 0.58} L${size * 0.65} ${size * 0.38}" stroke="#00ffff" stroke-width="${size / 64}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;
}

for (const size of [192, 512]) {
  await sharp(Buffer.from(iconSvg(size))).png().toFile(`public/pwa-${size}x${size}.png`);
}

console.log('Wrote public/pwa-192x192.png and public/pwa-512x512.png');
