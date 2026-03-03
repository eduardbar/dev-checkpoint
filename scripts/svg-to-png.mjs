import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const imagesDir = join(__dirname, '..', 'images');

const conversions = [
  { svg: 'og-twitter.svg',      png: 'og-twitter.png',      width: 1200, height: 628 },
  { svg: 'og-github.svg',       png: 'og-github.png',       width: 1280, height: 640 },
  { svg: 'og-producthunt.svg',  png: 'og-producthunt.png',  width: 240,  height: 240 },
];

const browser = await chromium.launch();

for (const { svg, png, width, height } of conversions) {
  const svgContent = readFileSync(join(imagesDir, svg), 'utf8');
  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);

  const page = await browser.newPage();
  await page.setViewportSize({ width, height });
  await page.goto(dataUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const pngPath = join(imagesDir, png);
  await page.screenshot({ path: pngPath, fullPage: false });
  await page.close();

  console.log(`✅ ${png} (${width}x${height})`);
}

await browser.close();
console.log('\nDone! All 3 OG images converted.');
