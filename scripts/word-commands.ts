/**
 * WRITE THE ADD-IN'S TAB — the manifest block, the keyboard shortcuts and
 * every picture — out of `commands-table.ts`.
 *
 *   npm run gen:word-commands
 *
 * The manifest's `<VersionOverrides>` comes from `manifest-commands.ts`. A
 * command's icon is either the app's own glyph (`packages/ui`'s icon table,
 * the one the app's ribbon draws), rasterised at the three sizes Word asks
 * for, or — for the insert menus — the character itself, drawn by
 * `tools/word-glyphs.mjs` in the face the app's palette uses.
 * `commands-table.test.ts` fails when any of it is stale.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { WORD_MARKS, WORD_RIBBON_FILL, WORD_RIBBON_INK, WORD_RIBBON_INK_ON_FILL } from '../packages/tokens/src/word.js';
import { ICONS } from '../packages/ui/src/icons.generated.js';
import { ICONS_NEEDED, iconFile } from '../apps/word-addin/src/commands-table.js';
import {
  ICON_SIZES, SHORTCUTS_FILE, iconPath, shortcuts, withCommands,
} from '../apps/word-addin/src/manifest-commands.js';
// @ts-expect-error — a JavaScript tool, typed by use.
import { drawGlyphs } from '../tools/word-glyphs.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ADDIN = join(ROOT, 'apps', 'word-addin');
const ASSETS = join(ADDIN, 'assets');

/**
 * WHAT COLOUR EACH PICTURE IS — the owner's choice: the mark in the colour it
 * gets on the page, everything else in the app's own ink.
 *
 * A holding's box is his green, a svara's stroke and the svarabhakti's dot his
 * red, the letters the rules replaced his blue, a pause his pause red — every
 * one from `WORD_MARKS`, the values measured off his template, so a button
 * shows what it will draw. Inside a glyph only the part tagged `data-mark`
 * (the box, the stroke, the dot) takes the colour and the letter stays ink,
 * as on the page; a change or a pause is coloured whole, because on the page
 * the whole letter is.
 *
 * A PNG CANNOT FOLLOW WORD'S THEME, and Word has no dark-theme picture for an
 * add-in. The ink was the app's light chrome ink and was faint on the dark
 * ribbon — the owner's report — so it is `WORD_RIBBON_INK`, the grey equally
 * readable on both ribbons (see there for the measurement).
 */
const hex = (c: string): string => (c.startsWith('#') ? c : `#${c}`);
const INK = hex(WORD_RIBBON_INK);
/* The holding boxes: a shape with an inside, filled light, the letter dark in it. */
const FILLED = new Set<string>(['hold-short', 'hold-long']);

const MARK_INK: Partial<Record<keyof typeof ICONS, { mark: string; whole?: true }>> = {
  'hold-short': { mark: hex(WORD_MARKS.holdShort.color) },
  'hold-long': { mark: hex(WORD_MARKS.holdLong.color) },
  'svara-anudatta': { mark: hex(WORD_MARKS.svara.color) },
  'svara-svarita': { mark: hex(WORD_MARKS.svara.color) },
  'svara-dirgha': { mark: hex(WORD_MARKS.svara.color) },
  svarabhakti: { mark: hex(WORD_MARKS.svara.color) },
  'change-anusvara': { mark: hex(WORD_MARKS.change.color), whole: true },
  'change-visarga': { mark: hex(WORD_MARKS.change.color), whole: true },
  /* Short blue, long red — the owner's ruling (2026-09-30); one line each. */
  'bar-short': { mark: hex(WORD_MARKS.change.color), whole: true },
  'bar-long': { mark: hex(WORD_MARKS.pause.color), whole: true },
};

/** The glyph's body, with its mark part in the mark's colour. */
function coloured(name: keyof typeof ICONS): { body: string; ink: string } {
  const body = ICONS[name].body;
  const c = MARK_INK[name];
  if (c === undefined) return { body, ink: INK };
  if (c.whole === true) return { body, ink: c.mark };
  const filled = FILLED.has(name);
  return {
    body: body.replace(/<(path|circle)[^>]*data-mark="1"[^>]*\/>/g, (el) => {
      const marked = el.replaceAll('currentColor', c.mark);
      return filled ? marked.replace('fill="none"', `fill="${hex(WORD_RIBBON_FILL)}"`) : marked;
    }),
    ink: filled ? hex(WORD_RIBBON_INK_ON_FILL) : INK,
  };
}

const manifestPath = join(ADDIN, 'manifest.xml');
writeFileSync(manifestPath, withCommands(readFileSync(manifestPath, 'utf8')));
writeFileSync(join(ASSETS, SHORTCUTS_FILE), shortcuts());

/* Start from nothing, so a command that is gone takes its pictures with it. */
const ribbon = join(ASSETS, 'ribbon');
if (existsSync(ribbon)) for (const f of readdirSync(ribbon)) rmSync(join(ribbon, f));
mkdirSync(ribbon, { recursive: true });
const put = (file: string, size: number, png: Buffer): void => {
  writeFileSync(join(ASSETS, iconPath(file, size)), png);
};

const named = new Map<string, keyof typeof ICONS>();
const chars = new Map<string, string>();
for (const icon of ICONS_NEEDED) {
  if ('name' in icon) named.set(iconFile(icon), icon.name);
  else chars.set(iconFile(icon), icon.ch);
}

for (const [file, name] of named) {
  const glyph = ICONS[name];
  const { body, ink } = coloured(name);
  for (const size of ICON_SIZES) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${glyph.viewBox}" width="${size}" `
      + `height="${size}" color="${ink}" fill="${ink}">${body}</svg>`;
    put(file, size, await sharp(Buffer.from(svg)).png().toBuffer());
  }
}
await drawGlyphs([...chars].map(([file, ch]) => ({ file, ch })), ICON_SIZES, INK, put);

console.log(`manifest written; icons: ${named.size} glyphs and ${chars.size} characters × ${ICON_SIZES.length} sizes`);
