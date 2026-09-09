#!/usr/bin/env node
/**
 * Generate every icon size the three installers want, from one source.
 *
 * One source, because eleven hand-exported PNGs drift: someone updates the
 * 256px and forgets the 32px, and the taskbar shows last year's mark. The
 * source is an SVG so it scales without a second original.
 *
 * The glyph is `श` — the first letter of śikṣā — set in the bundled Devanagari
 * face on the accent colour, so the icon is the program's own identity rather
 * than a generic document sheet.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src-tauri', 'icons');
mkdirSync(OUT, { recursive: true });

const SOURCE = join(HERE, 'icon.svg');
const svg = readFileSync(SOURCE);

/*
 * The DOCUMENT icon — a second source, on purpose.
 *
 * Once the program is installed it owns `.smdoc`, and a file manager shows
 * this on every one of them. It has to read as a FILE at 16px, which the
 * application's own mark does not: a folder of documents would otherwise look
 * like a folder of copies of the program.
 */
const DOC_SOURCE = join(HERE, 'document-icon.svg');
const docSvg = readFileSync(DOC_SOURCE);

/** What each platform's bundler looks for. */
const PNGS = [
  ['32x32.png', 32], ['128x128.png', 128], ['128x128@2x.png', 256],
  ['icon.png', 512],
  ['Square30x30Logo.png', 30], ['Square44x44Logo.png', 44],
  ['Square71x71Logo.png', 71], ['Square89x89Logo.png', 89],
  ['Square107x107Logo.png', 107], ['Square142x142Logo.png', 142],
  ['Square150x150Logo.png', 150], ['Square284x284Logo.png', 284],
  ['Square310x310Logo.png', 310], ['StoreLogo.png', 50],
];

for (const [name, size] of PNGS) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(OUT, name));
}

// Windows wants a multi-resolution .ico, not a PNG named .ico.
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const buffers = await Promise.all(icoSizes.map((s) =>
  sharp(svg, { density: 384 }).resize(s, s).png().toBuffer()));
writeFileSync(join(OUT, 'icon.ico'), await pngToIco(buffers));

// macOS wants .icns. `iconutil` is macOS-only, so on other platforms the 1024
// PNG is written and the real .icns is produced on the Mac that builds the dmg.
await sharp(svg, { density: 512 }).resize(1024, 1024).png()
  .toFile(join(OUT, 'icon-1024.png'));

/*
 * The document icon, in the sizes each platform's association wants:
 *   Windows  a multi-resolution `.ico`, named in `bundle.fileAssociations`
 *   Linux    PNGs, installed into the icon theme beside the `.desktop` entry
 *   macOS    a `.icns`, produced on the Mac that builds the dmg
 */
const docIco = await Promise.all(icoSizes.map((s) =>
  sharp(docSvg, { density: 384 }).resize(s, s).png().toBuffer()));
writeFileSync(join(OUT, 'document.ico'), await pngToIco(docIco));
for (const size of [32, 64, 128, 256, 512]) {
  await sharp(docSvg, { density: 512 }).resize(size, size).png()
    .toFile(join(OUT, 'document-' + size + '.png'));
}
await sharp(docSvg, { density: 512 }).resize(1024, 1024).png()
  .toFile(join(OUT, 'document-1024.png'));

/*
 * AND THE WEB APP'S FAVICON, from the same source.
 *
 * It was a hand-written file of its own — a purple `श` set in Georgia, with
 * its colours escaped as `%23` so they did not even apply — which is to say
 * the program wore three different marks: one in the taskbar, one on its
 * files, and one in a browser tab. One source, or they drift, and they had.
 */
const WEB = join(HERE, '..', '..', 'web', 'public');
writeFileSync(join(WEB, 'favicon.svg'), svg);
await sharp(svg, { density: 512 }).resize(180, 180).png()
  .toFile(join(WEB, 'apple-touch-icon.png'));

console.log(`\n  ${PNGS.length} PNGs + icon.ico -> ${OUT}`);
console.log('  favicon.svg + apple-touch-icon.png -> apps/web/public');
console.log('  document.ico + 6 document PNGs — the icon a .smdoc file shows');
console.log('  icon.icns must be produced on macOS: iconutil -c icns icon.iconset\n');
