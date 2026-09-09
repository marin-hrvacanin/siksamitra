/**
 * A document and a style, out the other end as one self-contained `.html`.
 *
 * The building is `apps/web/src/views/export-page.tsx`, which the window calls
 * too. This file is only the half a command answers differently: the
 * stylesheets come off the disk instead of out of `document.styleSheets`, and a
 * font file is read rather than fetched.
 *
 * Run it under `tsx` with the two flags in `tsconfig.render.json`'s header —
 * `--tsconfig tools/export/tsconfig.render.json --import ./tools/export/no-css.mjs`
 * — or the `.tsx` files will not compile and the render package's stylesheet
 * imports will not resolve. `cli.mjs` and both gates are launched that way by
 * `package.json`.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openChantDoc } from '@siksamitra/engine';
import { EXPORT_SCRIPTS, buildExportPage } from '../../apps/web/src/views/export-page.js';
import { appCss } from './css.mjs';

const FONTS = join(resolve(import.meta.dirname, '../..'), 'assets/fonts');

/** What goes in the manifest's `engine`, and in the page's generator meta. */
export const ENGINE = 'siksamitra-cli';

export const SCRIPTS = [...EXPORT_SCRIPTS];

/** Read a `.json` chant off disk. */
export function loadDoc(path) {
  return openChantDoc(JSON.parse(readFileSync(path, 'utf8')));
}

/** Where a command gets the three things only its host can give it. */
const io = {
  css: () => appCss(),
  faceCss: () => readFileSync(join(FONTS, 'fonts.css'), 'utf8'),
  fontBytes: (file) => readFileSync(join(FONTS, file)).toString('base64'),
};

export function buildPage(doc, options = {}) {
  return buildExportPage(doc, { engine: ENGINE, ...options }, io);
}
