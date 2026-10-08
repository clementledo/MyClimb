// Redessine les images des costumes dans assets/skins (fond transparent, WebP).
// Il faut esbuild, playwright-core, un Chromium et ImageMagick :
//   npm i --no-save esbuild playwright-core
//   CHROMIUM=/chemin/vers/chrome node scripts/skins/render.mjs
// Pour ne redessiner que certains costumes, les nommer à la suite :
//   CHROMIUM=/chemin/vers/chrome node scripts/skins/render.mjs bucheron cowboy
/* eslint-disable import/no-unresolved -- outils installés à part, pas dans l'application */
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../assets/skins');
const work = mkdtempSync(join(tmpdir(), 'skins-'));
await build({ entryPoints: [join(here, 'portrait.ts')], bundle: true, outfile: join(work, 'portrait.js'), logLevel: 'warning' });
writeFileSync(join(work, 'index.html'), '<!doctype html><body style="margin:0"><canvas id="c"></canvas><script src="portrait.js"></script>');

const ALL = [
  'classique',
  'competition',
  'retro',
  'astronaute',
  'dino',
  'banane',
  'heros',
  'ninja',
  'pirate',
  'robot',
  'noel',
  'licorne',
  'bucheron',
  'cowboy',
  'pompier',
  'abeille',
  'chat',
  'momie',
  'viking',
  'requin',
  'panda',
  'sorcier',
  'chevalier',
  'yeti',
  'samourai',
  'dragon',
  'golem',
  'cosmique',
];
// Costumes nommés sur la ligne de commande, sinon tous.
const asked = process.argv.slice(2);
const unknown = asked.filter((s) => !ALL.includes(s));
if (unknown.length) throw new Error(`Costumes inconnus : ${unknown.join(', ')}`);
const SKINS = asked.length ? asked : ALL;
const SHOTS = [
  { suffix: '', query: 'w=300&h=500&dist=5.9&ty=0.98' },
  { suffix: '_carte', query: 'w=480&h=480&dist=2.3&ty=1.47&pose=cross' },
];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
for (const shot of SHOTS) {
  const page = await browser.newPage();
  await page.goto(`file://${work}/index.html?${shot.query}`);
  await page.waitForFunction(() => window.ready === true);
  for (const skin of SKINS) {
    await page.evaluate((s) => window.shot(s), skin);
    const png = join(work, `${skin}${shot.suffix}.png`);
    const data = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
    writeFileSync(png, Buffer.from(data.split(',')[1], 'base64'));
    execFileSync('convert', [png, '-quality', '88', '-define', 'webp:alpha-quality=95', '-define', 'webp:method=6', join(out, `${skin}${shot.suffix}.webp`)]);
  }
  await page.close();
}
await browser.close();
