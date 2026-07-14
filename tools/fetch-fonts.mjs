/* Самостоятельный хостинг шрифтов: скачивает woff2 с Google Fonts и собирает локальный fonts.css.
   Оставляем только latin/latin-ext/cyrillic/cyrillic-ext сабсеты. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'assets/fonts');
mkdirSync(outDir, { recursive: true });

const CSS_URL = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=STIX+Two+Text:ital,wght@0,400..700;1,400&display=swap';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const KEEP = new Set(['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext']);

const css = await (await fetch(CSS_URL, { headers: { 'User-Agent': UA } })).text();

const blocks = [...css.matchAll(/\/\* ([\w-]+) \*\/\s*@font-face\s*\{([\s\S]*?)\}/g)];
let outCss = '/* Сгенерировано tools/fetch-fonts.mjs — локальные шрифты (Google Fonts, OFL) */\n';
let count = 0;

for (const [, subset, body] of blocks) {
  if (!KEEP.has(subset)) continue;
  const url = body.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  const family = body.match(/font-family:\s*'([^']+)'/)?.[1];
  const style = body.match(/font-style:\s*(\w+)/)?.[1];
  const weight = body.match(/font-weight:\s*([\d ]+)/)?.[1]?.trim();
  if (!url || !family) continue;

  const slug = `${family.toLowerCase().replace(/\s+/g, '-')}-${weight.replace(' ', '-')}${style === 'italic' ? '-italic' : ''}-${subset}.woff2`;
  const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  writeFileSync(resolve(outDir, slug), buf);
  count++;

  outCss += `/* ${subset} */\n@font-face {\n${body.replace(/url\(https:[^)]+\)\s*format\('woff2'\)/, `url('${slug}') format('woff2')`).trim()}\n}\n`;
}

writeFileSync(resolve(outDir, 'fonts.css'), outCss, 'utf8');
console.log(`✓ скачано файлов: ${count}, собран assets/fonts/fonts.css`);
