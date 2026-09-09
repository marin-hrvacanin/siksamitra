#!/usr/bin/env node
/**
 * Export a document as a page or as a picture.
 *
 *   npm run export -- corpus/chants/durga-suktam.json
 *   npm run export -- <doc> --style card --png --select '#sec-1/v-1'
 *   npm run export -- <doc> --style veda-union --png --svg --scale 3
 *   npm run export -- --styles            # what the styles are
 *
 * The HTML is always written: it is the lossless artefact, and the PNG and the
 * SVG are photographs of it, so asking for a picture without the page it came
 * from would leave nothing to reopen. `--no-html` says you meant it.
 *
 * Everything the window can do, a command can do (docs/AGENTS.md). This is the
 * command half of the two exports; the window's half is in `FileGroup.tsx` and
 * calls the same `exportHtml`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { EXPORT_STYLES, exportStyle } from '@siksamitra/tokens/export-styles';
import { SCRIPTS, buildPage, loadDoc } from './page.mjs';
import { toPng, toSvg, withBrowser } from './raster.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? fallback : argv[at + 1];
};

if (flag('styles') || argv.length === 0) {
  console.log('\n  the export styles\n');
  for (const s of EXPORT_STYLES) {
    console.log(`  ${s.id.padEnd(16)} ${s.name}`);
    console.log(`  ${' '.repeat(16)} ${s.note}`);
    console.log(`  ${' '.repeat(16)} theme ${s.doc} · ${s.mode} · ${s.frame} frame\n`);
  }
  console.log(`  scripts: ${SCRIPTS.join(', ')}\n`);
  process.exit(argv.length === 0 ? 2 : 0);
}

const source = argv[0];
const style = exportStyle(value('style', 'veda-union'));
const script = value('script', undefined);
const select = value('select', undefined);
const scale = Number(value('scale', '2'));
if (!Number.isFinite(scale) || scale <= 0) {
  console.error(`--scale ${value('scale', '')} is not a positive number`);
  process.exit(2);
}

const outDir = value('out', 'artifacts');
mkdirSync(outDir, { recursive: true });
const stem = join(outDir, `${basename(source).replace(/\.json$/, '')}-${style.id}`);

const doc = loadDoc(source);
const built = await buildPage(doc, { style: style.id, script, select });

console.log(`\n  ${doc.title} — ${style.name} (${style.frame}), ${built.script}`);
if (select !== undefined) console.log(`  selection: ${select}`);

if (!flag('no-html')) {
  writeFileSync(`${stem}.html`, built.html, 'utf8');
  console.log(`  ${stem}.html`.padEnd(56)
    + `${(built.html.length / 1048576).toFixed(2)} MB`
    + `  (${built.fonts.faces} faces, ${(built.fonts.bytes / 1024).toFixed(0)} KB of them)`);
}

if (flag('png') || flag('svg')) {
  await withBrowser(async (browser) => {
    if (flag('png')) {
      const png = await toPng(browser, built.html, { frame: style.frame, scale });
      writeFileSync(`${stem}.png`, png.bytes);
      console.log(`  ${stem}.png`.padEnd(56)
        + `${(png.bytes.length / 1024).toFixed(0)} KB`
        + `  ${Math.round(png.width)}x${Math.round(png.height)} at ${scale}x`);
    }
    if (flag('svg')) {
      const svg = await toSvg(browser, built.html, { frame: style.frame, doc: style.doc });
      writeFileSync(`${stem}.svg`, svg.text, 'utf8');
      console.log(`  ${stem}.svg`.padEnd(56)
        + `${(svg.text.length / 1024).toFixed(0)} KB`
        + `  ${svg.width}x${svg.height}`);
    }
  });
}

console.log(`\n  ${dirname(stem)}\n`);
